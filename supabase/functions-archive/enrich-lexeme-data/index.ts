// supabase/functions/enrich-lexeme-data/index.ts
// Norsk Trainer App — enrich-lexeme-data v1.0.6
//
// Збагачує lexemes + форми + синоніми використовуючи:
// 1. Існуючі дані з lexical_quality_audit (source_expertise)
// 2. Ordbokene API (article fetch для форм)
// 3. Gemini (translation_ua, example, frequency_level, cefr)
//
// Modes:
//   "fill_gaps"     — заповнює тільки порожні поля
//   "verify_forms"  — верифікує і виправляє форми з Ordbokene
//   "full"          — обидва режими

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY          = Deno.env.get("GEMINI_API_KEY") ?? "";
const TIMEOUT_MS              = envInt("ENRICH_TIMEOUT_MS", 12000);
const DELAY_MS                = envInt("ENRICH_DELAY_MS", 200);
const DEBUG                   = envBool("ENRICH_DEBUG", false);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type EnrichMode = "fill_gaps" | "verify_forms" | "full";
type PosType    = "noun" | "verb" | "adjective" | "expression" | "adverb";

type RequestBody = {
  mode?:       EnrichMode;
  pos?:        PosType | "all";
  limit?:      number;
  offset?:     number;
  dry_run?:    boolean;
  lexeme_ids?: string[];
};

// ── ENTRY POINT ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse("ok");

  try {
    const body      = (await req.json().catch(() => ({}))) as RequestBody;
    const mode      = body.mode       ?? "fill_gaps";
    const pos       = body.pos        ?? "all";
    const limit     = clamp(body.limit  ?? 10, 1, 50);
    const offset    = Math.max(0, body.offset ?? 0);
    const dryRun    = body.dry_run    ?? false;
    const lexemeIds = Array.isArray(body.lexeme_ids) ? body.lexeme_ids : [];

    const lexemes = await fetchLexemes({ pos, limit, offset, lexemeIds, mode });
    const results: Array<{ id: string; lemma: string; ok: boolean; changes: string[]; error?: string }> = [];
    const summary = { total: 0, enriched: 0, skipped: 0, errors: 0, byField: {} as Record<string, number> };

    for (const lexeme of lexemes) {
      try {
        const enrichment = await enrichLexeme(lexeme, mode);
        summary.total++;

        if (enrichment.changes.length === 0) {
          summary.skipped++;
          results.push({
            id: lexeme.id, lemma: lexeme.lemma, ok: true, changes: [],
            ...(DEBUG ? { _debug: enrichment.debug } : {}),
          });
          continue;
        }

        if (!dryRun) {
          await applyEnrichment(lexeme, enrichment);
        }

        summary.enriched++;
        for (const field of enrichment.changes) {
          summary.byField[field] = (summary.byField[field] ?? 0) + 1;
        }
        results.push({
          id: lexeme.id, lemma: lexeme.lemma, ok: true, changes: enrichment.changes,
          ...(DEBUG ? { _debug: enrichment.debug } : {}),
        });
        await delay(DELAY_MS);
      } catch (err) {
        summary.errors++;
        results.push({
          id: lexeme.id, lemma: lexeme.lemma, ok: false, changes: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return jsonResponse({
      ok: true, version: "1.0.8", mode, pos, dry_run: dryRun,
      limit, offset, count: lexemes.length,
      summary, results,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// ── FETCH LEXEMES ─────────────────────────────────────────────────────────────
async function fetchLexemes(args: {
  pos: string; limit: number; offset: number; lexemeIds: string[]; mode: EnrichMode;
}) {
  let query = supabase
    .from("lexemes")
    .select(`
      id, lemma, display_form, pos, cefr, status,
      translation_ua, translation_en, example, notes,
      frequency_level, frequency_rank, frequency_source,
      importance_score,
      verification, source, source_verified
    `)
    .order("created_at", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);

  if (args.lexemeIds.length > 0) {
    query = query.in("id", args.lexemeIds);
  } else {
    if (args.pos !== "all") query = query.eq("pos", args.pos);

    // For fill_gaps mode — fetch all and let enrichLexeme decide what to fill
    // (filtering here can miss records due to enum NULL handling)
    // No additional filter — enrichLexeme checks each field individually
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── MAIN ENRICHMENT LOGIC ────────────────────────────────────────────────────
async function enrichLexeme(lexeme: any, mode: EnrichMode) {
  const changes: string[]             = [];
  const updates: Record<string, any>  = {};
  const formUpdates: Record<string, any> = {};
  const newSynonyms: any[]            = [];

  // Step 1: Try to get data from existing audit results
  const auditData = await getAuditDataForLexeme(lexeme.id, lexeme.pos);

  // Step 2: Try Ordbokene article if registered_entry found
  let ordbokeneArticle: any = null;
  if (auditData?.ordbokeneArticleIds?.length) {
    ordbokeneArticle = await fetchOrdbokeneArticle(auditData.ordbokeneArticleIds[0]);
  }

  // Step 3: Parse NAOB raw_preview for EN translation, synonyms
  const naobData = parseNaobRawPreview(auditData?.naobRawPreview ?? "");

  // Step 4: Gemini for UA translation, example, frequency, cefr
  const needsGemini =
    !lexeme.translation_ua   ||
    !lexeme.example          ||
    !lexeme.frequency_level  ||  // always enrich if frequency missing
    !lexeme.cefr;

  let geminiData: any = null;
  if (needsGemini && GEMINI_API_KEY) {
    geminiData = await callGeminiEnrich(lexeme, naobData, ordbokeneArticle);
    // If Gemini failed silently, try once more with simpler prompt
    if (!geminiData && !lexeme.frequency_level) {
      geminiData = await callGeminiFrequencyOnly(lexeme);
    }
  }

  // ── APPLY: translation_ua ──
  const proposedUa = geminiData?.translation_ua || naobData?.translation_ua || null;
  if (proposedUa && shouldUpdate(lexeme.translation_ua, lexeme.source_verified, mode)) {
    updates.translation_ua = proposedUa;
    changes.push("translation_ua");
  }

  // ── APPLY: translation_en ──
  const proposedEn =
    naobData?.translation_en ||
    ordbokeneArticle?.translation_en ||
    geminiData?.translation_en || null;
  if (proposedEn && shouldUpdate(lexeme.translation_en, lexeme.source_verified, mode)) {
    updates.translation_en = proposedEn;
    changes.push("translation_en");
  }

  // ── APPLY: example ──
  const proposedExample =
    naobData?.example ||
    ordbokeneArticle?.example ||
    geminiData?.example || null;
  if (proposedExample && shouldUpdate(lexeme.example, lexeme.source_verified, mode)) {
    updates.example = proposedExample;
    changes.push("example");
  }

  // ── APPLY: frequency_level ──
  // Ordbokene gives signal, Gemini normalizes to very_high|high|medium|low|rare
  const ordbokeneFreqSignal = ordbokeneArticle?.frequency_level ?? null;
  const geminiFreq          = geminiData?.frequency_level ?? null;
  // If Ordbokene says "high" but Gemini says "very_high" → trust Gemini (it normalizes better)
  const proposedFreq = ordbokeneFreqSignal && geminiFreq
    ? (geminiFreq === "very_high" ? "very_high" : ordbokeneFreqSignal)  // Gemini can upgrade to very_high
    : geminiFreq ?? ordbokeneFreqSignal ?? null;

  if (proposedFreq && isValidFrequency(proposedFreq) && !lexeme.frequency_level) {
    updates.frequency_level  = proposedFreq.toLowerCase();
    updates.frequency_source = ordbokeneFreqSignal ? "Ordbokene+Gemini" : "Gemini_estimate";
    changes.push("frequency_level");
  } else if (proposedFreq && isValidFrequency(proposedFreq) && mode === "full") {
    updates.frequency_level  = proposedFreq.toLowerCase();
    updates.frequency_source = "Gemini_estimate";
    changes.push("frequency_level");
  }

  // ── APPLY: frequency_rank ──
  const proposedRank = geminiData?.frequency_rank ?? null;
  if (proposedRank && typeof proposedRank === "number" && proposedRank > 0 && !lexeme.frequency_rank) {
    updates.frequency_rank = proposedRank;
    changes.push("frequency_rank");
  }

  // ── APPLY: importance_score ──
  const proposedImportance = geminiData?.importance_score ?? null;
  if (
    typeof proposedImportance === "number" &&
    proposedImportance >= 1 &&
    proposedImportance <= 100 &&
    !lexeme.importance_score
  ) {
    updates.importance_score = proposedImportance;
    changes.push("importance_score");
  }

  // ── APPLY: cefr ──
  const proposedCefr =
    ordbokeneArticle?.cefr ||
    geminiData?.cefr || null;
  if (proposedCefr && isValidCefr(proposedCefr) && !lexeme.cefr) {
    updates.cefr = proposedCefr.toUpperCase();
    changes.push("cefr");
  }

  // ── APPLY: notes ──
  const proposedNotes = geminiData?.notes_ua || null;
  if (proposedNotes && !lexeme.notes) {
    updates.notes = proposedNotes;
    changes.push("notes");
  }

  // ── APPLY: forms (verify_forms mode) ──
  if ((mode === "verify_forms" || mode === "full") && ordbokeneArticle) {
    const formChanges = await buildFormUpdates(lexeme, ordbokeneArticle);
    Object.assign(formUpdates, formChanges.updates);
    changes.push(...formChanges.changes);
  }

  // ── APPLY: synonyms from NAOB / Ordbokene ──
  const proposedSynonyms = [
    ...(naobData?.synonyms ?? []),
    ...(ordbokeneArticle?.synonyms ?? []),
  ];
  if (proposedSynonyms.length > 0) {
    newSynonyms.push(...proposedSynonyms);
    changes.push("synonyms");
  }

  return {
    updates, formUpdates, newSynonyms, changes,
    debug: {
      needsGemini,
      hasGeminiKey: Boolean(GEMINI_API_KEY),
      geminiDataNull: geminiData === null,
      geminiFreq: geminiData?.frequency_level ?? null,
      geminiUa: geminiData?.translation_ua ? geminiData.translation_ua.slice(0, 30) : null,
      auditFound: Boolean(auditData),
      ordbokeneArticleFound: Boolean(ordbokeneArticle),
      lexemeFreqLevel: lexeme.frequency_level,
      lexemeUa: lexeme.translation_ua ? lexeme.translation_ua.slice(0, 30) : null,
      lexemeExample: lexeme.example ? "present" : "missing",
    },
  };
}

// ── GET AUDIT DATA FOR LEXEME ─────────────────────────────────────────────────
async function getAuditDataForLexeme(lexemeId: string, pos: string) {
  // For expressions: go through expression_catalog → entity_id
  if (pos === "expression") {
    const { data: ecData } = await supabase
      .from("expression_catalog")
      .select("id")
      .eq("lexeme_id", lexemeId)
      .maybeSingle();

    if (!ecData?.id) return null;

    const { data: auditData } = await supabase
      .from("lexical_quality_audit")
      .select("source_expertise, proposed_source_verified, proposed_whole_unit_sources")
      .eq("entity_id", ecData.id)
      .eq("entity_table", "expression_catalog")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!auditData) return null;
    return parseAuditSourceExpertise(auditData.source_expertise);
  }

  // For noun/verb/adjective/adverb: entity_id = lexeme.id directly
  const entityTable = pos === "noun"      ? "noun_forms"
                    : pos === "verb"      ? "verb_forms"
                    : pos === "adjective" ? "adjective_forms"
                    : "lexemes";

  const { data: auditData } = await supabase
    .from("lexical_quality_audit")
    .select("source_expertise, proposed_source_verified, proposed_whole_unit_sources")
    .eq("entity_id", lexemeId)
    .eq("entity_table", entityTable)  // ← filter by correct table
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!auditData) return null;
  return parseAuditSourceExpertise(auditData.source_expertise);
}

function parseAuditSourceExpertise(sourceExpertise: any) {
  if (!sourceExpertise) return null;

  const ordbokene    = sourceExpertise.Ordbokene;
  const naob         = sourceExpertise.NAOB;

  // Extract Ordbokene article IDs from raw_preview
  const ordbokeneArticleIds: string[] = [];
  if (ordbokene?.raw_preview) {
    const preview = typeof ordbokene.raw_preview === "string"
      ? ordbokene.raw_preview
      : JSON.stringify(ordbokene.raw_preview);
    const matches = preview.match(/\b(\d{4,8})\b/g) ?? [];
    ordbokeneArticleIds.push(...matches.slice(0, 5));
  }

  return {
    naobRawPreview:       naob?.raw_preview as string ?? "",
    naobFound:            naob?.found === true,
    naobRegistered:       naob?.registered_entry === true,
    ordbokeneArticleIds,
    ordbokeneFound:       ordbokene?.found === true,
    ordbokeneRegistered:  ordbokene?.registered_entry === true,
  };
}

// ── ORDBOKENE ARTICLE FETCH ───────────────────────────────────────────────────
async function fetchOrdbokeneArticle(articleId: string): Promise<any> {
  try {
    const url  = `https://ord.uib.no/bm/${articleId}.json`;
    const res  = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json();
    return parseOrdbokeneArticle(data, articleId);
  } catch {
    return null;
  }
}

function parseOrdbokeneArticle(data: any, articleId: string): any {
  if (!data) return null;
  const text     = JSON.stringify(data).toLowerCase();
  const result: any = { articleId, raw: data };

  // Extract lemma/wordform
  result.lemma = data?.lemma ?? data?.word ?? data?.article?.lemmas?.[0]?.lemma ?? null;

  // Extract forms from paradigm
  const paradigm = data?.paradigm ?? data?.article?.paradigm ?? [];
  if (Array.isArray(paradigm) && paradigm.length) {
    result.forms = paradigm;
  }

  // Extract definitions/translations
  const defs = data?.definitions ?? data?.article?.body?.content ?? [];
  if (Array.isArray(defs) && defs.length) {
    const firstDef = defs[0];
    result.translation_en = extractDefinitionText(firstDef);
  }

  // Extract examples
  const examples = data?.examples ?? [];
  if (Array.isArray(examples) && examples.length) {
    result.example = examples[0]?.text ?? null;
  }

  // Extract synonyms
  const related = data?.related_articles ?? data?.synonyms ?? [];
  if (Array.isArray(related) && related.length) {
    result.synonyms = related
      .filter((r: any) => r?.type === "synonym" || r?.relation === "syn")
      .map((r: any) => r?.lemma ?? r?.word ?? r?.text)
      .filter(Boolean)
      .slice(0, 5);
  }

  // Infer frequency from Ordbokene usage markers
  // Note: Ordbokene signal is passed to Gemini for normalization to very_high/high/medium/low/rare
  if (text.includes("ekstremt vanlig") || text.includes("grunnleggende") || text.includes("høyfrekvent")) {
    result.frequency_level = "very_high";
  } else if (text.includes("svært vanlig") || text.includes("meget vanlig") || text.includes("meget hyppig")) {
    result.frequency_level = "high";
  } else if (text.includes("vanlig") || text.includes("hyppig") || text.includes("alminnelig")) {
    result.frequency_level = "medium";
  } else if (text.includes("sjelden") || text.includes("uvanlig") || text.includes("lite brukt")) {
    result.frequency_level = "low";
  } else if (text.includes("arkaisk") || text.includes("gammeldags") || text.includes("foreldet")) {
    result.frequency_level = "rare";
  }

  return result;
}

function extractDefinitionText(def: any): string {
  if (!def) return "";
  if (typeof def === "string") return def;
  return def?.content?.[0]?.text ?? def?.text ?? def?.explanation ?? "";
}

// ── NAOB RAW PREVIEW PARSER ───────────────────────────────────────────────────
function parseNaobRawPreview(raw: string): any {
  if (!raw) return null;

  // Decode HTML entities
  const text = raw
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&oslash;/g, "ø").replace(/&aring;/g, "å").replace(/&aelig;/g, "æ")
    .replace(/&Aring;/g, "Å").replace(/&Oslash;/g, "Ø").replace(/&AElig;/g, "Æ")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  const result: any = {};

  // Extract example sentence (look for italic or quoted text)
  const exampleMatch = text.match(/«([^»]+)»/) ?? text.match(/"([^"]{15,100})"/);
  if (exampleMatch) result.example = exampleMatch[1].trim();

  // Extract synonyms from "se også" or "synonym" sections
  const synonymMatch = text.match(/se også\s+([^\n.]+)/i);
  if (synonymMatch) {
    result.synonyms = synonymMatch[1].split(/[,;]/).map((s: string) => s.trim()).filter(Boolean).slice(0, 5);
  }

  // Extract English translation hints from parenthetical English words
  const enMatch = text.match(/\(([a-z][a-z\s,]+)\)/i);
  if (enMatch && /^[a-z\s,]+$/.test(enMatch[1])) {
    result.translation_en = enMatch[1].trim();
  }

  return result;
}

// ── GEMINI ENRICHMENT ─────────────────────────────────────────────────────────
async function callGeminiEnrich(lexeme: any, naobData: any, ordbokeneArticle: any): Promise<any> {
  const context = [
    naobData?.translation_en ? `EN from NAOB: ${naobData.translation_en}` : "",
    ordbokeneArticle?.translation_en ? `EN from Ordbokene: ${ordbokeneArticle.translation_en}` : "",
    lexeme.translation_en ? `Existing EN: ${lexeme.translation_en}` : "",
  ].filter(Boolean).join(". ");

  const prompt = `You are enriching a Norwegian language learning database.
Word: "${lexeme.lemma}" (${lexeme.pos})
${context ? `Context: ${context}` : ""}
Existing UA translation: "${lexeme.translation_ua || "missing"}"
Existing example: "${lexeme.example || "missing"}"
Existing CEFR: "${lexeme.cefr || "missing"}"
Existing frequency: "${lexeme.frequency_level || "missing"}"

Return ONLY JSON (no markdown):
{
  "translation_ua": "Ukrainian translation (natural, not literal)",
  "translation_en": "English translation if better than existing",
  "example": "One natural Norwegian example sentence using this word",
  "cefr": "A1|A2|B1|B2|C1|C2 (estimate)",
  "frequency_level": "very_high|high|medium|low|rare (corpus estimate for Norwegian learners)",
  "frequency_rank": number 1-10000 (estimated corpus rank, 1=most frequent),
  "importance_score": number 1-100 (learning importance: 100=critical, 1=rare/obscure),
  "notes_ua": "Short Ukrainian usage note (max 100 chars, optional)",
  "confidence": "high|medium|low"
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { _error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = parseJsonSafe(text);
    if (!parsed) return { _error: `JSON parse failed: ${text.slice(0, 200)}` };
    return parsed;
  } catch (e) {
    return { _error: e instanceof Error ? e.message : String(e) };
  }
}

// ── FORM UPDATES ──────────────────────────────────────────────────────────────
async function buildFormUpdates(lexeme: any, ordbokeneArticle: any) {
  const changes: string[] = [];
  const updates: Record<string, any> = {};
  if (!ordbokeneArticle?.forms) return { updates, changes };

  const pos = lexeme.pos;
  const forms = ordbokeneArticle.forms;

  if (pos === "noun") {
    const nounForms = extractNounForms(forms);
    if (Object.keys(nounForms).length > 0) {
      updates.noun_forms = nounForms;
      changes.push("noun_forms");
    }
  } else if (pos === "verb") {
    const verbForms = extractVerbForms(forms);
    if (Object.keys(verbForms).length > 0) {
      updates.verb_forms = verbForms;
      changes.push("verb_forms");
    }
  } else if (pos === "adjective") {
    const adjForms = extractAdjForms(forms);
    if (Object.keys(adjForms).length > 0) {
      updates.adjective_forms = adjForms;
      changes.push("adjective_forms");
    }
  }

  return { updates, changes };
}

function extractNounForms(paradigm: any[]): Record<string, string> {
  const forms: Record<string, string> = {};
  for (const p of (paradigm ?? [])) {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const form = p.form ?? p.word ?? "";
    if (!form) continue;
    if (tags.includes("SIN") && tags.includes("IND")) forms.ubest_entall = form;
    if (tags.includes("SIN") && tags.includes("DEF")) forms.best_entall  = form;
    if (tags.includes("PLU") && tags.includes("IND")) forms.ubest_flertall = form;
    if (tags.includes("PLU") && tags.includes("DEF")) forms.best_flertall  = form;
    if (tags.includes("MAS")) forms.official_gender = "masculine";
    if (tags.includes("FEM")) forms.official_gender = "feminine";
    if (tags.includes("NEU")) forms.official_gender = "neuter";
  }
  return forms;
}

function extractVerbForms(paradigm: any[]): Record<string, string> {
  const forms: Record<string, string> = {};
  for (const p of (paradigm ?? [])) {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const form = p.form ?? p.word ?? "";
    if (!form) continue;
    if (tags.includes("INF"))  forms.infinitiv  = form;
    if (tags.includes("PRS"))  forms.presens    = form;
    if (tags.includes("PST"))  forms.preteritum = form;
    if (tags.includes("PP") || tags.includes("PAST-PART")) forms.perfektum = form;
    if (tags.includes("IMP"))  forms.imperativ  = form;
  }
  return forms;
}

function extractAdjForms(paradigm: any[]): Record<string, string> {
  const forms: Record<string, string> = {};
  for (const p of (paradigm ?? [])) {
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const form = p.form ?? p.word ?? "";
    if (!form) continue;
    if (tags.includes("POS") && !tags.includes("NEU") && !tags.includes("PLU")) forms.positiv    = form;
    if (tags.includes("POS") && tags.includes("NEU"))  forms.intetkjonn  = form;
    if (tags.includes("POS") && tags.includes("PLU"))  forms.flertall    = form;
    if (tags.includes("COM"))  forms.komparativ  = form;
    if (tags.includes("SUP") && !tags.includes("DEF")) forms.superlativ  = form;
    if (tags.includes("SUP") && tags.includes("DEF"))  forms.best_superlativ = form;
  }
  return forms;
}

// ── APPLY ENRICHMENT ──────────────────────────────────────────────────────────
async function applyEnrichment(lexeme: any, enrichment: any) {
  const { updates, formUpdates, newSynonyms } = enrichment;

  // Update lexemes
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("lexemes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", lexeme.id);
    if (error) throw error;
  }

  // Update noun_forms
  if (formUpdates.noun_forms) {
    await supabase.from("noun_forms")
      .upsert({ lexeme_id: lexeme.id, ...formUpdates.noun_forms }, { onConflict: "lexeme_id" });
  }

  // Update verb_forms
  if (formUpdates.verb_forms) {
    await supabase.from("verb_forms")
      .upsert({ lexeme_id: lexeme.id, ...formUpdates.verb_forms }, { onConflict: "lexeme_id" });
  }

  // Update adjective_forms
  if (formUpdates.adjective_forms) {
    await supabase.from("adjective_forms")
      .upsert({ lexeme_id: lexeme.id, ...formUpdates.adjective_forms }, { onConflict: "lexeme_id" });
  }

  // Insert new synonyms
  if (newSynonyms.length > 0) {
    const rows = newSynonyms.map((syn: string) => ({
      lexeme_id:      lexeme.id,
      synonym_no:     syn,
      synonym_type:   "synonym",
      synonym_status: "ai_candidate",
    }));
    await supabase.from("synonyms").upsert(rows, { onConflict: "lexeme_id,synonym_no" });
  }
}


// ── GEMINI FREQUENCY ONLY (fallback) ─────────────────────────────────────────
async function callGeminiFrequencyOnly(lexeme: any): Promise<any> {
  if (!GEMINI_API_KEY) return null;
  const prompt = `For the Norwegian word/expression "${lexeme.lemma}" (${lexeme.pos}), estimate:
Return ONLY JSON: {"frequency_level":"very_high|high|medium|low|rare","cefr":"A1|A2|B1|B2|C1|C2","translation_ua":"short Ukrainian translation"}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return parseJsonSafe(text);
  } catch {
    return null;
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function shouldUpdate(existing: any, sourceVerified: string | null, mode: EnrichMode): boolean {
  // Always fill if empty
  if (!existing || existing === "") return true;
  // In fill_gaps mode — never overwrite existing
  if (mode === "fill_gaps") return false;
  // In full mode — overwrite only if source is low quality
  if (mode === "full") {
    // Don't overwrite data from authoritative sources
    if (sourceVerified && !sourceVerified.includes("Gemini")) return false;
    return true;
  }
  return false;
}

function isValidFrequency(v: string): boolean {
  return ["very_high", "high", "medium", "low", "rare"].includes(v.toLowerCase());
}

function isValidCefr(v: string): boolean {
  return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(v.toUpperCase());
}

function parseJsonSafe(text: string): any {
  const clean = text.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(clean.slice(s, e + 1)); } catch { return null; }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

function delay(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise(r => setTimeout(r, ms));
}

function clamp(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min;
}

function envInt(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (!v) return fallback;
  const p = Number.parseInt(v, 10);
  return Number.isFinite(p) ? p : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = Deno.env.get(name);
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function corsResponse(data: string): Response {
  return new Response(data, { headers: corsHeaders() });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}