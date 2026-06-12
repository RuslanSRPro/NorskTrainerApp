// supabase/functions/verify-lexeme-audit/index.ts
// Norsk Trainer App — verify-lexeme-audit v2.9.0
//
// Changes from v2.8.2:
// 1. NEW: Support for noun/verb/adjective/adverb lexeme auditing
//    → fetchLexemeRows(), auditLexeme(), buildLexemeSourceExpertise()
//    → buildLexemeAuditRecord(), mapStatusToTier()
// 2. NEW: entity="lexemes" routing + direct source_verified update in lexemes table
// 3. NEW: pos parameter in RequestBody
// 4. FIX: canonicalVerifiedSourceSummary() includes whole_unit_match sources
// 5. FIX: suggestExpressionSubtype() recognizes discourse_marker patterns
// 6. NAOB: parallel HTML + JSON API, take higher confidence result
// 7. Wiktionary: check both no.wiktionary.org AND en.wiktionary.org

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const ENABLE_LIVE_NAOB       = envBool("ENABLE_LIVE_NAOB", true);
const ENABLE_LIVE_ORDBOKENE  = envBool("ENABLE_LIVE_ORDBOKENE", true);
const ENABLE_LIVE_WIKTIONARY = envBool("ENABLE_LIVE_WIKTIONARY", true);
const ENABLE_GEMINI_ANALYSIS = envBool("ENABLE_GEMINI_ANALYSIS", false);
const LIVE_LOOKUP_TIMEOUT_MS = envInt("LIVE_LOOKUP_TIMEOUT_MS", 9000);
const SOURCE_DELAY_MS        = envInt("SOURCE_DELAY_MS", 150);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type EntityTable = "expression_catalog" | "lexemes" | "noun_forms" | "verb_forms" | "adjective_forms" | "adverbs" | "synonyms";
type AuditMode = "quality_audit";
type WhereMode = "all" | "missing_verification" | "needs_review" | "errors";
type SourceName = "NAOB" | "Ordbokene" | "Wiktionary" | "Språkrådet" | "Lexin" | "Gemini" | "Manual";

type VerificationStatus =
  | "authoritative"
  | "multi_source"
  | "dictionary"
  | "candidate_authoritative"
  | "component_verified"
  | "usage_verified"
  | "unregistered_usage_candidate"
  | "ai_supported"
  | "ai_candidate"
  | "unverified";

type EvidenceQuality =
  | "registered_entry"
  | "structured_entry_match"
  | "exact_expression_match"
  | "normative_reference"
  | "learner_dictionary"
  | "search_page_match"
  | "usage_example_match"
  | "component_match"
  | "ai_suggestion"
  | "manual_reference"
  | "not_found"
  | "not_checked"
  | "error";

type RequestBody = {
  mode?: AuditMode;
  entity?: EntityTable;
  pos?: string | null;
  limit?: number;
  offset?: number;
  where?: WhereMode;
  dry_run?: boolean;
  ids?: string[];
  live_lookup?: boolean;
  sources?: SourceName[];
  queue_mode?: "enqueue" | "process" | "status";
  queue_batch_size?: number;
  job_id?: string;
};

type ExpressionRow = {
  id: string;
  lemma: string | null;
  display_form: string | null;
  normalized_key: string | null;
  language?: string | null;
  pos?: string | null;
  expression_subtype?: string | null;
  subtype?: string | null;
  translation_ua?: string | null;
  translation_en?: string | null;
  example?: string | null;
  notes_ua?: string | null;
  cefr?: string | null;
  frequency_level?: string | null;
  frequency_rank?: number | null;
  importance_score?: number | null;
  source_naob?: boolean | null;
  source_wiktionary?: boolean | null;
  source_gemini?: boolean | null;
  source_ordbokene?: boolean | null;
  source_manual?: boolean | null;
  source_urls?: unknown;
  raw_sources?: unknown;
  verification?: string | null;
  verification_status?: string | null;
  source_verified?: string | null;
  linguistic_evidence?: string | null;
  confidence?: string | null;
  topic?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type LexemeRow = {
  id: string;
  lemma: string | null;
  display_form: string | null;
  pos: string | null;
  translation_ua?: string | null;
  translation_en?: string | null;
  example?: string | null;
  cefr?: string | null;
  frequency_level?: string | null;
  source_verified?: string | null;
  verification_tier?: string | null;
  verification_evidence?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

type SourceExpertiseItem = {
  checked: boolean;
  found: boolean | null;
  authoritative: boolean;
  quality: EvidenceQuality;
  registered_entry: boolean;
  whole_unit_match: boolean;
  component_match: boolean;
  usage_match: boolean;
  live_lookup: boolean;
  stored_hint: boolean;
  urls: string[];
  evidence_label?: string | null;
  note?: string | null;
  error?: string | null;
  raw_preview?: unknown;
};

type SourceExpertise = Partial<Record<SourceName, SourceExpertiseItem>>;

type SourceLookupResult = {
  source: SourceName;
  checked: boolean;
  found: boolean | null;
  quality: EvidenceQuality;
  registered_entry: boolean;
  whole_unit_match: boolean;
  component_match: boolean;
  usage_match: boolean;
  urls: string[];
  evidence_label?: string;
  note?: string;
  error?: string;
  raw_preview?: unknown;
};

type OldSourceHints = {
  source_naob: boolean;
  source_ordbokene: boolean;
  source_wiktionary: boolean;
  source_gemini: boolean;
  source_manual: boolean;
  source_verified: string | null;
  source_urls: unknown;
  raw_sources_present: boolean;
};

type AuditDecision = {
  proposed_verification_status: VerificationStatus;
  proposed_source_verified: string | null;
  proposed_whole_unit_sources: string | null;
  proposed_linguistic_evidence: string | null;
  confidence: "high" | "medium" | "low";
  family_verification_status: "canonical_verified" | "candidate_only" | "usage_pattern_only" | "component_pattern_only" | "not_verified";
  source_expertise: SourceExpertise;
  all_sources_found: string[];
  all_authoritative_sources_found: string[];
  registered_entry_found: boolean;
  registered_entry_sources: string[];
  verification_basis: Record<string, unknown>;
  source_evidence_scope: Record<string, EvidenceQuality>;
  unregistered_reason: string | null;
  old_source_hints: OldSourceHints;
  live_lookup_errors: Record<string, string>;
  subtype_suggestion: string | null;
  subtype_conflict: boolean;
  component_source_type: string | null;
  collocation_type: string | null;
  audit_notes: string;
  checks: unknown[];
  sources_found: unknown[];
  proposed_data: Record<string, unknown>;
  changed_fields: string[];
};

const LIVE_AUTHORITATIVE_SOURCES: SourceName[] = ["NAOB", "Ordbokene", "Wiktionary", "Språkrådet", "Lexin"];

const NORWEGIAN_PARTICLES    = new Set(["opp","ut","inn","ned","av","på","med","til","fram","frem","over","under","bort","igjen","sammen"]);
const NORWEGIAN_PREPOSITIONS = new Set(["av","i","på","til","for","fra","med","om","over","under","mellom","gjennom","hos","mot","etter","før","uten","innen","blant","rundt"]);
const LEGACY_SUBTYPE_MAP: Record<string,string> = { lexical_reflexive: "reflexive_verb" };

const DISCOURSE_MARKERS = new Set([
  "når det gjelder","det vil si","med andre ord","på den ene siden",
  "på den andre siden","dessuten","derimot","imidlertid","likevel",
  "dermed","derfor","selv om","til tross for","i tillegg til","ikke bare",
  "det er ingen tvil om","det er klart at","for øvrig","i så fall",
  "det ser du vel","det stemmer","som sagt","så å si","ikke sant",
  "vet du hva","hva er det","hva skjer","hva tenker du","du vet",
  "for å si det sånn","la oss si","så å si","rent faktisk",
  "faktisk sett","egentlig sett","kort sagt","for å oppsummere",
  "på den ene siden","på den annen side","i motsetning til",
  "som følge av","på grunn av","med tanke på","i forhold til",
  "med hensyn til","i lys av","ut fra","basert på"
]);

const CONFIRMATION_PHRASES = new Set([
  "det stemmer","ikke sant","er det ikke","er det riktig",
  "så klart","selvfølgelig","naturligvis","det er riktig"
]);

const REACTION_PHRASES = new Set([
  "så bra","kjempebra","veldig bra","ikke verst","det var hyggelig",
  "det var koselig","så synd","det er trist","stakkars","å nei",
  "å ja","å herregud","oi da","jøss","for all del"
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse("ok");
  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const mode: AuditMode      = body.mode   ?? "quality_audit";
    const entity: EntityTable  = body.entity ?? "expression_catalog";
    const limit    = clampNumber(body.limit  ?? 10, 1, 50);
    const offset   = Math.max(0, body.offset ?? 0);
    const where: WhereMode     = body.where  ?? "all";
    const dryRun   = body.dry_run    ?? false;
    const ids      = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    const liveLookup         = body.live_lookup ?? true;
    const requestedSources   = normalizeRequestedSources(body.sources);

    // ── QUEUE MODE ──────────────────────────────────────────────────────────
    if (body.queue_mode === "enqueue") {
      return await handleQueueEnqueue(entity, body.queue_batch_size ?? 10, body.pos ?? null);
    }
    if (body.queue_mode === "process") {
      return await handleQueueProcess({ dryRun, liveLookup, requestedSources, jobId: body.job_id });
    }
    if (body.queue_mode === "status") {
      return await handleQueueStatus();
    }
    // ────────────────────────────────────────────────────────────────────────

    if (mode !== "quality_audit") return jsonResponse({ ok: false, error: `Unsupported mode: ${mode}` }, 400);

    // Route to correct handler based on entity
    const isLexemeEntity = entity === "lexemes";

    const rows = isLexemeEntity
      ? await fetchLexemeRows({ limit, offset, where, ids, pos: body.pos ?? null })
      : await fetchExpressionRows({ limit, offset, where, ids });

    const results: Array<{ id: string; lemma: string | null; ok: boolean; error?: string }> = [];
    const summary = createSummary();

    for (const row of rows) {
      try {
        const decision = isLexemeEntity
          ? await auditLexeme(row as LexemeRow, { liveLookup, requestedSources })
          : await auditExpression(row as ExpressionRow, { liveLookup, requestedSources });

        incrementSummary(summary, "byEntity", isLexemeEntity ? "lexemes" : "expression_catalog");
        incrementSummary(summary, "byVerificationStatus", decision.proposed_verification_status);
        incrementSummary(summary, "bySource", decision.proposed_whole_unit_sources ?? decision.proposed_source_verified ?? "null");
        incrementSummary(summary, "byRegisteredEntry", decision.proposed_source_verified ?? "null");
        incrementSummary(summary, "byFormStatus", decision.family_verification_status);

        if (!dryRun) {
          const auditRecord = isLexemeEntity
            ? buildLexemeAuditRecord(row as LexemeRow, decision)
            : buildAuditRecord(row as ExpressionRow, decision);
          const { error } = await supabase.from("lexical_quality_audit").insert(auditRecord);
          if (error) throw error;

          // For lexemes: also update source_verified + verification_tier directly
          if (isLexemeEntity) {
            const updateData: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
              verification_evidence: decision.source_expertise,
            };
            if (decision.proposed_source_verified) {
              updateData.source_verified = decision.proposed_source_verified;
            }
            const tier = mapStatusToTier(decision.proposed_verification_status);
            if (tier) updateData.verification_tier = tier;

            await supabase.from("lexemes").update(updateData).eq("id", (row as LexemeRow).id);
          }
        }

        results.push({
          id: row.id, lemma: row.lemma, ok: true,
          ...(dryRun ? {
            verification_status: decision.proposed_verification_status,
            source_verified: decision.proposed_source_verified,
            source_expertise: Object.fromEntries(
              Object.entries(decision.source_expertise).map(([src, item]) => [src, {
                found: item?.found,
                quality: item?.quality,
                error: item?.error ?? null,
                evidence_label: item?.evidence_label,
                registered_entry: item?.registered_entry,
                whole_unit_match: item?.whole_unit_match,
              }])
            ),
          } : {}),
        });
      } catch (error) {
        summary.errors += 1;
        results.push({ id: row.id, lemma: row.lemma, ok: false, error: error instanceof Error ? error.message : String(error) });
        if (!dryRun && !isLexemeEntity) await insertErrorAudit(row as ExpressionRow, error);
      }
    }

    return jsonResponse({
      ok: true,
      version: "2.9.0",
      mode, entity, dry_run: dryRun, live_lookup: liveLookup,
      requested_sources: requestedSources, where, limit, offset,
      count: rows.length, error_count: summary.errors, summary, results,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function fetchExpressionRows(args: { limit: number; offset: number; where: WhereMode; ids: string[] }): Promise<ExpressionRow[]> {
  const { limit, offset, where, ids } = args;
  let query = supabase.from("expression_catalog").select("*").order("created_at", { ascending: true }).range(offset, offset + limit - 1);
  if (ids.length > 0)              query = query.in("id", ids);
  else if (where === "missing_verification") query = query.is("verification_status", null);
  else if (where === "needs_review")         query = query.or("verification_status.is.null,source_verified.is.null,linguistic_evidence.is.null");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExpressionRow[];
}

// ── LEXEME AUDIT (nouns, verbs, adjectives, adverbs) v2.9 ────────────────────

async function fetchLexemeRows(args: {
  limit: number; offset: number; where: WhereMode; ids: string[]; pos: string | null;
}): Promise<LexemeRow[]> {
  let query = supabase
    .from("lexemes")
    .select("id, lemma, display_form, pos, translation_ua, translation_en, example, cefr, frequency_level, source_verified, verification_tier, verification_evidence, created_at, updated_at")
    .order("created_at", { ascending: true })
    .range(args.offset, args.offset + args.limit - 1);

  if (args.ids.length > 0) {
    query = query.in("id", args.ids);
  } else {
    if (args.pos) query = query.eq("pos", args.pos);
    else query = query.not("pos", "eq", "expression");

    if (args.where === "missing_verification") {
      query = query.is("source_verified", null);
    } else if (args.where === "needs_review") {
      query = query.or("source_verified.is.null,verification_tier.is.null");
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LexemeRow[];
}

async function auditLexeme(
  row: LexemeRow,
  options: { liveLookup: boolean; requestedSources: SourceName[] }
): Promise<AuditDecision> {
  const lemma = (row.lemma ?? row.display_form ?? "").trim();

  const sourceExpertise = await buildLexemeSourceExpertise(lemma, options);
  const allSourcesFound = getSourcesFound(sourceExpertise, false);
  const allAuthoritativeSourcesFound = getSourcesFound(sourceExpertise, true);
  const registeredEntrySources = getRegisteredEntrySources(sourceExpertise);
  const registeredEntryFound = registeredEntrySources.length > 0;
  const sourceEvidenceScope = getSourceEvidenceScope(sourceExpertise);
  const liveLookupErrors = getLiveLookupErrors(sourceExpertise);

  const decisionCore = decideVerificationStatus({
    lemma,
    linguisticEvidence: row.pos ?? "word",
    sourceExpertise,
    registeredEntrySources,
    allAuthoritativeSourcesFound,
  });

  const proposedSourceVerified = canonicalVerifiedSourceSummary(sourceExpertise);
  const wholeUnitSources = canonicalWholeUnitSourceSummary(sourceExpertise);
  const familyVerificationStatus = decideFamilyVerificationStatus({
    status: decisionCore.status,
    registeredEntryFound,
    sourceExpertise,
  });

  const proposedData = {
    lemma: row.lemma, pos: row.pos,
    verification_status: decisionCore.status,
    source_verified: proposedSourceVerified,
    whole_unit_sources: wholeUnitSources,
    linguistic_evidence: row.pos ?? "word",
    confidence: decisionCore.confidence,
    family_verification_status: familyVerificationStatus,
    source_expertise: sourceExpertise,
    all_sources_found: allSourcesFound,
    all_authoritative_sources_found: allAuthoritativeSourcesFound,
    registered_entry_found: registeredEntryFound,
    registered_entry_sources: registeredEntrySources,
    verification_basis: decisionCore.verificationBasis,
    source_evidence_scope: sourceEvidenceScope,
    live_lookup_errors: liveLookupErrors,
  };

  return {
    proposed_verification_status: decisionCore.status,
    proposed_source_verified: proposedSourceVerified,
    proposed_whole_unit_sources: wholeUnitSources,
    proposed_linguistic_evidence: row.pos ?? "word",
    confidence: decisionCore.confidence,
    family_verification_status: familyVerificationStatus,
    source_expertise: sourceExpertise,
    all_sources_found: allSourcesFound,
    all_authoritative_sources_found: allAuthoritativeSourcesFound,
    registered_entry_found: registeredEntryFound,
    registered_entry_sources: registeredEntrySources,
    verification_basis: decisionCore.verificationBasis,
    source_evidence_scope: sourceEvidenceScope,
    unregistered_reason: registeredEntryFound ? null : `No registered entry found for ${row.pos} "${lemma}"`,
    old_source_hints: {
      source_naob: false, source_ordbokene: false, source_wiktionary: false,
      source_gemini: false, source_manual: false,
      source_verified: row.source_verified ?? null,
      source_urls: null, raw_sources_present: false,
    },
    live_lookup_errors: liveLookupErrors,
    subtype_suggestion: null,
    subtype_conflict: false,
    component_source_type: null,
    collocation_type: null,
    audit_notes: `v2.9 lexeme audit for "${lemma}" (${row.pos}). Status: ${decisionCore.status}. Sources: ${allAuthoritativeSourcesFound.join("+") || "none"}.`,
    checks: [{ check: "lexeme_audit", ok: true, pos: row.pos }],
    sources_found: buildSourcesFoundList(sourceExpertise),
    proposed_data: proposedData,
    changed_fields: ["source_verified", "verification_tier", "source_expertise"],
  };
}

async function buildLexemeSourceExpertise(
  lemma: string,
  options: { liveLookup: boolean; requestedSources: SourceName[] }
): Promise<SourceExpertise> {
  const expertise: SourceExpertise = {};

  if (options.requestedSources.includes("Ordbokene")) {
    expertise.Ordbokene = await sourceItemFromLookup(
      "Ordbokene", false,
      options.liveLookup && ENABLE_LIVE_ORDBOKENE,
      () => checkOrdbokeneLive(lemma, lemma)
    );
    await delay(SOURCE_DELAY_MS);
  }

  if (options.requestedSources.includes("NAOB")) {
    expertise.NAOB = await sourceItemFromLookup(
      "NAOB", false,
      options.liveLookup && ENABLE_LIVE_NAOB,
      () => checkNAOBLive(lemma, lemma)
    );
    await delay(SOURCE_DELAY_MS);
  }

  if (options.requestedSources.includes("Wiktionary")) {
    expertise.Wiktionary = await sourceItemFromLookup(
      "Wiktionary", false,
      options.liveLookup && ENABLE_LIVE_WIKTIONARY,
      () => checkWiktionaryLive(lemma, lemma)
    );
    await delay(SOURCE_DELAY_MS);
  }

  if (options.requestedSources.includes("Språkrådet")) {
    expertise.Språkrådet = await sourceItemFromLookup(
      "Språkrådet", false, options.liveLookup,
      () => checkSpraakradetLive(lemma, lemma)
    );
    await delay(SOURCE_DELAY_MS);
  }

  if (options.requestedSources.includes("Lexin")) {
    expertise.Lexin = await sourceItemFromLookup(
      "Lexin", false, options.liveLookup,
      () => checkLexinLive(lemma, lemma)
    );
    await delay(SOURCE_DELAY_MS);
  }

  expertise.Manual = sourceNotChecked("Manual", false, "Manual not checked for lexeme audit.");
  expertise.Gemini = sourceNotChecked("Gemini", false, "Gemini not used for lexeme audit.");

  return expertise;
}

function buildLexemeAuditRecord(row: LexemeRow, decision: AuditDecision): Record<string, unknown> {
  return {
    entity_table: "lexemes", entity_id: row.id,
    lemma: row.lemma, display_form: row.display_form,
    pos: row.pos ?? "noun", subtype: null,
    old_data: row, proposed_data: decision.proposed_data,
    old_verification: null, proposed_verification: null,
    old_verification_status: null,
    proposed_verification_status: decision.proposed_verification_status,
    old_source_verified: row.source_verified ?? null,
    proposed_source_verified: decision.proposed_source_verified,
    proposed_whole_unit_sources: decision.proposed_whole_unit_sources ?? null,
    old_linguistic_evidence: null,
    proposed_linguistic_evidence: decision.proposed_linguistic_evidence,
    old_cefr: row.cefr ?? null, proposed_cefr: row.cefr ?? null,
    old_frequency_level: row.frequency_level ?? null,
    proposed_frequency_level: row.frequency_level ?? null,
    changed_fields: decision.changed_fields,
    checks: decision.checks, sources_found: decision.sources_found,
    audit_status: "pending", audit_error: null,
    old_forms: null, proposed_forms: null, form_checks: null,
    form_verification_status: null, comparison_status: null,
    inflection_notes: null, confidence: decision.confidence,
    frequency_status: null, audit_notes: decision.audit_notes,
    relation_checks: null, semantic_relation_status: null,
    interchangeability_status: null,
    subtype_conflict: false, subtype_suggestion: null,
    component_source_type: null, collocation_type: null,
    family_verification_status: decision.family_verification_status,
    expression_synonym_status: null, expression_synonym_count: 0,
    source_expertise: decision.source_expertise,
    all_sources_found: decision.all_sources_found,
    all_authoritative_sources_found: decision.all_authoritative_sources_found,
    registered_entry_found: decision.registered_entry_found,
    registered_entry_sources: decision.registered_entry_sources,
    verification_basis: decision.verification_basis,
    source_evidence_scope: decision.source_evidence_scope,
    unregistered_reason: decision.unregistered_reason,
    old_source_hints: decision.old_source_hints,
    live_lookup_errors: decision.live_lookup_errors,
  };
}

function mapStatusToTier(status: VerificationStatus): string {
  switch (status) {
    case "multi_source":             return "dictionary_entry";
    case "authoritative":            return "dictionary_entry";
    case "dictionary":               return "dictionary_entry";
    case "candidate_authoritative":  return "dictionary_match";
    case "component_verified":       return "component_match";
    case "usage_verified":           return "usage_evidence";
    case "unregistered_usage_candidate": return "ai_candidate";
    case "ai_supported":             return "ai_candidate";
    case "ai_candidate":             return "ai_candidate";
    default:                         return "ai_candidate";
  }
}
// ─────────────────────────────────────────────────────────────────────────────

async function auditExpression(row: ExpressionRow, options: { liveLookup: boolean; requestedSources: SourceName[] }): Promise<AuditDecision> {
  const lemma       = cleanLemma(row.lemma ?? row.display_form ?? "");
  const displayForm = cleanLemma(row.display_form ?? row.lemma ?? "");
  const oldSubtype  = normalizeSubtype(row.expression_subtype ?? row.subtype ?? null);
  const oldSourceHints    = collectOldSourceHints(row);
  const subtypeSuggestion = suggestExpressionSubtype(lemma, oldSubtype);
  const subtypeConflict   = Boolean(oldSubtype && subtypeSuggestion && oldSubtype !== subtypeSuggestion);
  const linguisticEvidence = inferLinguisticEvidence(lemma, subtypeSuggestion ?? oldSubtype);
  const collocationType    = inferCollocationType(lemma, linguisticEvidence);

  const sourceExpertise              = await buildLiveSourceExpertise(row, lemma, displayForm, linguisticEvidence, options);
  const allSourcesFound              = getSourcesFound(sourceExpertise, false);
  const allAuthoritativeSourcesFound = getSourcesFound(sourceExpertise, true);
  const registeredEntrySources       = getRegisteredEntrySources(sourceExpertise);
  const registeredEntryFound         = registeredEntrySources.length > 0;
  const sourceEvidenceScope          = getSourceEvidenceScope(sourceExpertise);
  const liveLookupErrors             = getLiveLookupErrors(sourceExpertise);

  const decisionCore            = decideVerificationStatus({ lemma, linguisticEvidence, sourceExpertise, registeredEntrySources, allAuthoritativeSourcesFound });
  const proposedSourceVerified  = canonicalVerifiedSourceSummary(sourceExpertise);
  const familyVerificationStatus = decideFamilyVerificationStatus({ status: decisionCore.status, registeredEntryFound, sourceExpertise });
  const componentSourceType     = decideComponentSourceType(sourceExpertise);
  const unregisteredReason      = decideUnregisteredReason({ status: decisionCore.status, lemma, linguisticEvidence, subtype: subtypeSuggestion ?? oldSubtype, sourceExpertise });

  const checks      = buildChecks({ oldSubtype, subtypeSuggestion, subtypeConflict, sourceExpertise, registeredEntryFound, linguisticEvidence, oldSourceHints });
  const sourcesFound = buildSourcesFoundList(sourceExpertise);
  const wholeUnitSources = canonicalWholeUnitSourceSummary(sourceExpertise);

  const proposedData = {
    lemma: row.lemma, display_form: row.display_form, normalized_key: row.normalized_key,
    verification_status: decisionCore.status,
    source_verified: proposedSourceVerified,
    whole_unit_sources: wholeUnitSources,
    linguistic_evidence: linguisticEvidence, confidence: decisionCore.confidence,
    expression_subtype: subtypeSuggestion ?? oldSubtype,
    family_verification_status: familyVerificationStatus,
    source_expertise: sourceExpertise, all_sources_found: allSourcesFound,
    all_authoritative_sources_found: allAuthoritativeSourcesFound,
    registered_entry_found: registeredEntryFound, registered_entry_sources: registeredEntrySources,
    verification_basis: decisionCore.verificationBasis, source_evidence_scope: sourceEvidenceScope,
    unregistered_reason: unregisteredReason, old_source_hints: oldSourceHints,
    live_lookup_errors: liveLookupErrors,
  };

  const changedFields = computeChangedFields(row, proposedData);
  const auditNotes    = buildAuditNotes({ lemma, linguisticEvidence, status: decisionCore.status, registeredEntryFound, allAuthoritativeSourcesFound, subtypeConflict, oldSubtype, subtypeSuggestion, unregisteredReason, liveLookupErrors });

  return {
    proposed_verification_status: decisionCore.status,
    proposed_source_verified: proposedSourceVerified,
    proposed_whole_unit_sources: wholeUnitSources,
    proposed_linguistic_evidence: linguisticEvidence,
    confidence: decisionCore.confidence,
    family_verification_status: familyVerificationStatus,
    source_expertise: sourceExpertise,
    all_sources_found: allSourcesFound,
    all_authoritative_sources_found: allAuthoritativeSourcesFound,
    registered_entry_found: registeredEntryFound,
    registered_entry_sources: registeredEntrySources,
    verification_basis: decisionCore.verificationBasis,
    source_evidence_scope: sourceEvidenceScope,
    unregistered_reason: unregisteredReason,
    old_source_hints: oldSourceHints,
    live_lookup_errors: liveLookupErrors,
    subtype_suggestion: subtypeSuggestion,
    subtype_conflict: subtypeConflict,
    component_source_type: componentSourceType,
    collocation_type: collocationType,
    audit_notes: auditNotes,
    checks, sources_found: sourcesFound,
    proposed_data: proposedData, changed_fields: changedFields,
  };
}

async function buildLiveSourceExpertise(row: ExpressionRow, lemma: string, displayForm: string, linguisticEvidence: string, options: { liveLookup: boolean; requestedSources: SourceName[] }): Promise<SourceExpertise> {
  const expertise: SourceExpertise = {};
  const oldHints = collectOldSourceHints(row);

  for (const source of options.requestedSources) {
    if (source === "NAOB") {
      expertise.NAOB = await sourceItemFromLookup(source, oldHints.source_naob, options.liveLookup && ENABLE_LIVE_NAOB, () => checkNAOBLive(lemma, displayForm));
      await delay(SOURCE_DELAY_MS);
    }
    if (source === "Ordbokene") {
      expertise.Ordbokene = await sourceItemFromLookup(source, oldHints.source_ordbokene, options.liveLookup && ENABLE_LIVE_ORDBOKENE, () => checkOrdbokeneLive(lemma, displayForm));
      await delay(SOURCE_DELAY_MS);
    }
    if (source === "Wiktionary") {
      expertise.Wiktionary = await sourceItemFromLookup(source, oldHints.source_wiktionary, options.liveLookup && ENABLE_LIVE_WIKTIONARY, () => checkWiktionaryLive(lemma, displayForm));
      await delay(SOURCE_DELAY_MS);
    }
  }

  if (options.requestedSources.includes("Språkrådet") || options.requestedSources.includes("NAOB")) {
    expertise.Språkrådet = await sourceItemFromLookup(
      "Språkrådet", oldHintFromSource(row, "Språkrådet"), options.liveLookup,
      () => checkSpraakradetLive(lemma, displayForm)
    );
    await delay(SOURCE_DELAY_MS);
  } else {
    expertise.Språkrådet = sourceNotChecked("Språkrådet", oldHintFromSource(row, "Språkrådet"), "Språkrådet not in requested sources.");
  }

  if (options.requestedSources.includes("Lexin") || options.requestedSources.includes("NAOB")) {
    expertise.Lexin = await sourceItemFromLookup(
      "Lexin", false, options.liveLookup,
      () => checkLexinLive(lemma, displayForm)
    );
    await delay(SOURCE_DELAY_MS);
  } else {
    expertise.Lexin = sourceNotChecked("Lexin", false, "Lexin not in requested sources.");
  }
  expertise.Manual     = manualSourceExpertise(row);
  expertise.Gemini     = await geminiSourceExpertise(row, lemma, linguisticEvidence, options.liveLookup && ENABLE_GEMINI_ANALYSIS);
  return expertise;
}

async function sourceItemFromLookup(source: SourceName, storedHint: boolean, enabled: boolean, lookup: () => Promise<SourceLookupResult>): Promise<SourceExpertiseItem> {
  if (!enabled) return sourceNotChecked(source, storedHint, `${source} live lookup disabled.`);
  try {
    const result = await lookup();
    return { ...result, authoritative: true, live_lookup: true, stored_hint: storedHint };
  } catch (error) {
    return {
      checked: true, found: null, authoritative: true, quality: "error",
      registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
      live_lookup: true, stored_hint: storedHint, urls: [],
      evidence_label: `${source} live lookup failed`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sourceNotChecked(source: SourceName, storedHint: boolean, note: string): SourceExpertiseItem {
  return {
    checked: false, found: null, authoritative: source !== "Gemini", quality: "not_checked",
    registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
    live_lookup: false, stored_hint: storedHint, urls: [],
    evidence_label: `${source} not checked live`, note,
  };
}

async function checkNAOBLive(lemma: string, displayForm: string): Promise<SourceLookupResult> {
  const query = cleanLemma(lemma || displayForm);
  const queryNoAa = query.replace(/^å\s+/i, "").trim();
  const variants = Array.from(new Set([query, queryNoAa].filter(Boolean)));

  const [htmlResult, apiResult] = await Promise.allSettled([
    checkNAOBHtml(query, variants),
    checkNAOBApi(query, variants),
  ]);

  const html = htmlResult.status === "fulfilled" ? htmlResult.value : null;
  const api  = apiResult.status  === "fulfilled" ? apiResult.value  : null;

  const qualityRank: Record<EvidenceQuality, number> = {
    registered_entry: 5, structured_entry_match: 4,
    learner_dictionary: 4,
    exact_expression_match: 3,
    normative_reference: 2,
    search_page_match: 1,
    usage_example_match: 2, component_match: 1,
    ai_suggestion: 0, manual_reference: 0,
    not_found: -1, not_checked: -2, error: -3,
  };

  const htmlRank = html ? (qualityRank[html.quality] ?? -2) : -2;
  const apiRank  = api  ? (qualityRank[api.quality]  ?? -2) : -2;

  const winner = apiRank >= htmlRank ? api : html;
  const loser  = apiRank >= htmlRank ? html : api;

  if (!winner || winner.quality === "not_found" || winner.quality === "not_checked") {
    return {
      source: "NAOB", checked: true, found: false, quality: "not_found",
      registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
      urls: [...(html?.urls ?? []), ...(api?.urls ?? [])],
      evidence_label: "NAOB: both HTML and API lookup completed; no match found",
      raw_preview: { html_result: html?.evidence_label, api_result: api?.evidence_label },
    };
  }

  return {
    ...winner,
    evidence_label: `NAOB v2.8 (${apiRank >= htmlRank ? "API" : "HTML"} primary): ${winner.evidence_label}${loser ? ` | crosscheck: ${loser.evidence_label}` : ""}`,
    urls: [...new Set([...(winner.urls ?? []), ...(loser?.urls ?? [])])],
  };
}

async function checkNAOBHtml(query: string, variants: string[]): Promise<SourceLookupResult> {
  const urls: string[] = [];
  const errors: string[] = [];
  const responses: Array<{ url: string; text: string }> = [];

  for (const variant of variants) {
    const encoded = encodeURIComponent(variant);
    const quoted  = encodeURIComponent(`"${variant}"`);
    const candidateUrls = [
      `https://naob.no/ordbok/${encoded}`,
      `https://naob.no/s%C3%B8k?q=${encoded}`,
      `https://naob.no/s%C3%B8k?q=${quoted}`,
    ];
    for (const url of candidateUrls) {
      urls.push(url);
      try {
        const text = normalizeHtmlText(await fetchText(url));
        if (text) responses.push({ url, text });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${url}: ${msg}`);
        if (msg.includes("HTTP 429") || msg.includes("HTTP 503")) await delay(500);
      }
      await delay(100);
    }
  }

  if (!responses.length) {
    return {
      source: "NAOB", checked: false, found: null, quality: "not_checked",
      registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
      urls, evidence_label: "NAOB HTML unavailable",
      error: errors.slice(0, 4).join(" | "),
    };
  }

  const tokens = getTokens(query);

  for (const { url, text } of responses) {
    const exact = containsExactPhrase(text, query);
    const entryMarkers = includesAny(text, ["betydning og bruk","innholdsfortegnelse","full bokmålsnorm","etymologi","uttale","bøyning","ordbok"]);
    if (url.includes("/ordbok/") && exact && entryMarkers) {
      return makeLookup("NAOB", true, "registered_entry", true, true, false,
        includesAny(text, ["eksempel","sitat","sitater"]),
        [url], "NAOB HTML: registered entry page exact match", text);
    }
  }

  for (const { url, text } of responses) {
    if (containsExactPhrase(text, query)) {
      const zeroTreff = text.includes("0 treff i artikler") ||
                        text.includes("finnes ikke som oppslagsord") ||
                        text.includes("0 treff");
      if (zeroTreff) continue;
      const treffMatch = text.match(/(\d+)\s+treff/);
      const treffCount = treffMatch ? parseInt(treffMatch[1]) : 999;
      const label = `NAOB HTML: exact phrase on search/entry page (${treffCount} treff)`;
      return makeLookup("NAOB", true, "search_page_match", false, true, false, false,
        [url], label, text);
    }
  }

  let bestComponent: { url: string; text: string; hits: number } | null = null;
  for (const { url, text } of responses) {
    const hits = countTokenHits(text, tokens);
    if (!bestComponent || hits > bestComponent.hits) bestComponent = { url, text, hits };
  }

  if (tokens.length > 1 && bestComponent && bestComponent.hits > 0) {
    return makeLookup("NAOB", true, "component_match", false, false, true, false,
      [bestComponent.url], `NAOB HTML: component evidence ${bestComponent.hits}/${tokens.length}`, bestComponent.text);
  }

  return makeLookup("NAOB", false, "not_found", false, false, false, false,
    urls, "NAOB HTML: no match found", "");
}

async function checkNAOBApi(query: string, variants: string[]): Promise<SourceLookupResult> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const variant of variants) {
    const encoded = encodeURIComponent(variant);
    const lemmaUrl   = `https://naob.no/api/lemma/${encoded}`;
    const searchUrl  = `https://naob.no/api/search?q=${encoded}&limit=10`;
    urls.push(lemmaUrl, searchUrl);

    try {
      const data = await fetchJson(lemmaUrl);
      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (obj.id || obj.lemma || obj.article_id || obj.forms) {
          const lemmaMatch = containsExactPhrase(JSON.stringify(data), variant);
          if (lemmaMatch) {
            return makeLookup("NAOB", true, "registered_entry", true, true, false, false,
              [lemmaUrl], "NAOB API: direct lemma endpoint match", JSON.stringify(data).slice(0, 500));
          }
        }
      }
    } catch (e) {
      errors.push(`lemma: ${e instanceof Error ? e.message : String(e)}`);
    }

    await delay(100);

    try {
      const data = await fetchJson(searchUrl);
      if (data && typeof data === "object") {
        const text = JSON.stringify(data).toLowerCase();
        const exact = containsExactPhrase(text, variant);
        if (exact) {
          return makeLookup("NAOB", true, "search_page_match", false, true, false, false,
            [searchUrl], "NAOB API: search endpoint exact match", JSON.stringify(data).slice(0, 500));
        }
        const tokens = getTokens(variant);
        const hits = countTokenHits(text, tokens);
        if (tokens.length > 1 && hits > 0) {
          return makeLookup("NAOB", true, "component_match", false, false, true, false,
            [searchUrl], `NAOB API: component evidence ${hits}/${tokens.length}`, JSON.stringify(data).slice(0, 500));
        }
      }
    } catch (e) {
      errors.push(`search: ${e instanceof Error ? e.message : String(e)}`);
    }

    await delay(100);
  }

  return makeLookup("NAOB", false, "not_found", false, false, false, false,
    urls, `NAOB API: no match. Errors: ${errors.slice(0,3).join(", ")}`, "");
}

function norwegianLemmaVariants(word: string): string[] {
  const variants = new Set<string>([word]);
  const w = word.toLowerCase().trim();
  if (w.endsWith("et"))  variants.add(w.slice(0, -2));
  if (w.endsWith("en"))  variants.add(w.slice(0, -2));
  if (w.endsWith("a"))   variants.add(w.slice(0, -1));
  if (w.endsWith("ene")) variants.add(w.slice(0, -3));
  if (w.endsWith("ene")) variants.add(w.slice(0, -2));
  if (w.endsWith("er"))  variants.add(w.slice(0, -2));
  if (w.endsWith("landet")) variants.add(w.slice(0, -3));
  variants.add(word.charAt(0).toUpperCase() + word.slice(1));
  return [...variants].filter(v => v.length >= 2);
}

async function checkOrdbokeneLive(lemma: string, displayForm: string): Promise<SourceLookupResult> {
  const query = lemma || displayForm;
  const tokens = getTokens(query);

  const searchTerms = tokens.length === 1 ? norwegianLemmaVariants(query) : [query];

  const exactArticlesUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(query)}&dict=bm,nn&scope=e`;
  const exactSuggestUrl  = `https://ord.uib.no/api/suggest?q=${encodeURIComponent(query)}&dict=bm,nn&include=eif&n=20`;

  let articlePayload = await fetchJson(exactArticlesUrl);
  const suggestPayload = await fetchJson(exactSuggestUrl);

  let articleIds = extractOrdbokeneArticleIds(articlePayload);

  if (articleIds.length === 0 && tokens.length === 1) {
    for (const variant of norwegianLemmaVariants(query)) {
      if (variant === query) continue;
      const variantUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(variant)}&dict=bm,nn&scope=e`;
      const variantPayload = await fetchJson(variantUrl);
      const variantIds = extractOrdbokeneArticleIds(variantPayload);
      if (variantIds.length > 0) {
        articlePayload = variantPayload;
        articleIds = variantIds;
        break;
      }
      await delay(50);
    }
  }

  const exactSuggestTerms  = extractOrdbokeneSuggestExactTerms(suggestPayload);
  const exactSuggest       = exactSuggestTerms.some(t => normalizeForMatch(t) === normalizeForMatch(query));
  const extendedExact      = exactSuggestTerms.filter(t => {
    const nt = normalizeForMatch(t), nq = normalizeForMatch(query);
    return nt !== nq && nt.includes(nq);
  });

  if (articleIds.length > 0) {
    return {
      source: "Ordbokene", checked: true, found: true, quality: "registered_entry",
      registered_entry: true, whole_unit_match: true, component_match: false, usage_match: false,
      urls: [exactArticlesUrl, exactSuggestUrl],
      evidence_label: `Ordbokene registered entry: ${articleIds.slice(0,5).join(", ")}`,
      raw_preview: { article_ids: articleIds.slice(0,10) },
    };
  }

  if (exactSuggest) {
    return {
      source: "Ordbokene", checked: true, found: true, quality: "exact_expression_match",
      registered_entry: false, whole_unit_match: true, component_match: false, usage_match: false,
      urls: [exactArticlesUrl, exactSuggestUrl],
      evidence_label: "Ordbokene exact suggestion match",
      raw_preview: { exact_suggestions: exactSuggestTerms },
    };
  }

  if (extendedExact.length > 0) {
    return {
      source: "Ordbokene", checked: true, found: true, quality: "usage_example_match",
      registered_entry: false, whole_unit_match: false, component_match: false, usage_match: true,
      urls: [exactArticlesUrl, exactSuggestUrl],
      evidence_label: `Ordbokene extended: ${extendedExact.slice(0,3).join(", ")}`,
      raw_preview: { extended_exact: extendedExact.slice(0,10) },
    };
  }

  const componentUrls: string[] = [];
  const matchedComponents: string[] = [];

  for (const token of tokens) {
    if (!shouldCheckOrdbokeneComponent(token)) continue;
    const cUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(token)}&dict=bm,nn&scope=e`;
    const sUrl = `https://ord.uib.no/api/suggest?q=${encodeURIComponent(token)}&dict=bm,nn&include=eif&n=10`;
    componentUrls.push(cUrl, sUrl);
    const cData = await fetchJson(cUrl);
    const sData = await fetchJson(sUrl);
    if (extractOrdbokeneArticleIds(cData).length > 0 || ordbokenePayloadHasExactMatch(sData, token)) {
      matchedComponents.push(token);
    }
    await delay(75);
  }

  if (tokens.length > 1 && matchedComponents.length > 0) {
    return {
      source: "Ordbokene", checked: true, found: true, quality: "component_match",
      registered_entry: false, whole_unit_match: false, component_match: true, usage_match: false,
      urls: [exactArticlesUrl, exactSuggestUrl, ...componentUrls],
      evidence_label: `Ordbokene components: ${matchedComponents.join(", ")}`,
    };
  }

  return {
    source: "Ordbokene", checked: true, found: false, quality: "not_found",
    registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
    urls: [exactArticlesUrl, exactSuggestUrl, ...componentUrls],
    evidence_label: "Ordbokene: no match found",
  };
}

async function checkWiktionaryLive(lemma: string, displayForm: string): Promise<SourceLookupResult> {
  const query    = lemma || displayForm;
  const slug     = encodeURIComponent(query.replace(/\s+/g, "_"));
  const noUrl    = `https://no.wiktionary.org/wiki/${slug}`;
  const enUrl    = `https://en.wiktionary.org/wiki/${slug}`;

  const [noResult, enResult] = await Promise.allSettled([
    checkWiktionaryDomain(query, noUrl, ["norsk","bokmål","nynorsk"], true),
    checkWiktionaryDomain(query, enUrl, ["norwegian bokmål","norwegian nynorsk","bokmål","nynorsk"], false),
  ]);

  const no = noResult.status === "fulfilled" ? noResult.value : null;
  const en = enResult.status === "fulfilled" ? enResult.value : null;

  const qualityRank: Partial<Record<EvidenceQuality, number>> = {
    registered_entry: 4, exact_expression_match: 3, component_match: 1, not_found: -1, not_checked: -2,
  };

  const noRank = no ? (qualityRank[no.quality] ?? -2) : -2;
  const enRank = en ? (qualityRank[en.quality] ?? -2) : -2;

  const winner = noRank >= enRank ? no : en;
  const loser  = noRank >= enRank ? en : no;

  if (!winner || winner.quality === "not_found" || winner.quality === "not_checked") {
    return makeLookup("Wiktionary", false, "not_found", false, false, false, false,
      [...(no?.urls ?? []), ...(en?.urls ?? [])],
      "Wiktionary: both no. and en. checked; no Norwegian match found", "");
  }

  return {
    ...winner,
    source: "Wiktionary",
    evidence_label: `Wiktionary v2.8 (${noRank >= enRank ? "no." : "en."} domain): ${winner.evidence_label}${loser && loser.quality !== "not_found" ? ` | en.: ${loser.evidence_label}` : ""}`,
    urls: [...new Set([...(winner.urls ?? []), ...(loser?.urls ?? [])])],
  };
}

async function checkWiktionaryDomain(query: string, url: string, norwegianMarkers: string[], isNoDomain: boolean): Promise<SourceLookupResult> {
  const html = await fetchText(url).catch(e => {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("404") || msg.includes("Not Found")) return "";
    throw e;
  });

  if (!html) return makeLookup("Wiktionary", false, "not_found", false, false, false, false, [url], `${isNoDomain ? "no." : "en."}wiktionary: page not found`, "");

  const text             = normalizeHtmlText(html);
  const exact            = containsExactPhrase(text, query);
  const norwegianScoped  = includesAny(text, norwegianMarkers);
  const entryMarkers     = includesAny(text, ["substantiv","verb","adjektiv","adverb","uttrykk","bokmål","nynorsk","noun","verb","adjective"]);
  const tokens           = getTokens(query);
  const tokenHits        = countTokenHits(text, tokens);

  const hasNorwegianSection = isNoDomain
    ? norwegianScoped
    : /==\s*Norwegian\s+Bokmål\s*==/i.test(html) ||
      /==\s*Norwegian\s+Nynorsk\s*==/i.test(html) ||
      /Norwegian Bokmål.*?subsection/i.test(html);

  if (exact && hasNorwegianSection && entryMarkers)
    return makeLookup("Wiktionary", true, "registered_entry", true, true, false, false, [url], `Wiktionary ${isNoDomain ? "no." : "en."}: Norwegian entry exact match`, text);

  if (exact && hasNorwegianSection)
    return makeLookup("Wiktionary", true, "exact_expression_match", false, true, false, false, [url], `Wiktionary ${isNoDomain ? "no." : "en."}: Norwegian scoped exact signal`, text);

  if (tokens.length > 1 && tokenHits > 0)
    return makeLookup("Wiktionary", true, "component_match", false, false, true, false, [url], `Wiktionary ${isNoDomain ? "no." : "en."}: component evidence`, text);

  return makeLookup("Wiktionary", false, "not_found", false, false, false, false, [url], `Wiktionary ${isNoDomain ? "no." : "en."}: no Norwegian match`, text);
}

function makeLookup(source: SourceName, found: boolean, quality: EvidenceQuality, registered: boolean, whole: boolean, component: boolean, usage: boolean, urls: string[], label: string, raw: string): SourceLookupResult {
  return { source, checked: true, found, quality, registered_entry: registered, whole_unit_match: whole, component_match: component, usage_match: usage, urls, evidence_label: label, raw_preview: preview(raw) };
}

async function geminiSourceExpertise(row: ExpressionRow, lemma: string, linguisticEvidence: string, enabled: boolean): Promise<SourceExpertiseItem> {
  const storedHint = row.source_gemini === true || hasRawSource(row, "Gemini");
  if (!enabled || !GEMINI_API_KEY) {
    return {
      checked: false, found: storedHint ? true : null, authoritative: false,
      quality: storedHint ? "ai_suggestion" : "not_checked",
      registered_entry: false, whole_unit_match: storedHint,
      component_match: false, usage_match: storedHint,
      live_lookup: false, stored_hint: storedHint, urls: [],
      evidence_label: storedHint ? "Stored Gemini hint only" : "Gemini not checked",
      note: "Gemini is non-authoritative and never contributes to source_verified.",
    };
  }
  try {
    const analysis = await callGeminiForExpression(lemma, linguisticEvidence);
    const supported = analysis.exists_in_language === true;
    return {
      checked: true, found: supported, authoritative: false,
      quality: supported ? "ai_suggestion" : "not_found",
      registered_entry: false, whole_unit_match: supported,
      component_match: false, usage_match: supported,
      live_lookup: true, stored_hint: storedHint, urls: [],
      evidence_label: supported ? "Gemini: expression exists in language" : "Gemini: not supported",
      raw_preview: analysis,
      note: "Gemini is non-authoritative; enrichment only.",
    };
  } catch (error) {
    return {
      checked: true, found: null, authoritative: false, quality: "error",
      registered_entry: false, whole_unit_match: false,
      component_match: false, usage_match: false,
      live_lookup: true, stored_hint: storedHint, urls: [],
      evidence_label: "Gemini analysis failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function callGeminiForExpression(lemma: string, linguisticEvidence: string): Promise<Record<string, unknown>> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const prompt   = `Analyze the Norwegian expression "${lemma}". Return strict JSON only: exists_in_language boolean, expression_type string, reason string. Linguistic evidence: ${linguisticEvidence}.`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const json = await response.json();
  return parseFirstJsonObject(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
}

async function checkSpraakradetLive(lemma: string, displayForm: string): Promise<SourceLookupResult> {
  const query   = lemma || displayForm;
  const encoded = encodeURIComponent(query);
  const svarUrl = `https://sprakradet.no/?s=${encoded}`;
  const urls    = [svarUrl];

  try {
    const res = await fetchWithTimeout(svarUrl);
    if (!res.ok) {
      return {
        source: "Språkrådet", checked: true, found: null, quality: "error",
        registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
        urls, evidence_label: `Språkrådet HTTP ${res.status}`, error: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();
    const text = normalizeHtmlText(html);
    const exact     = containsExactPhrase(text, query);
    const tokens    = getTokens(query);
    const tokenHits = countTokenHits(text, tokens);
    const noResults = /ingen\s+treff\s+på/i.test(text) ||
                      /ingen\s+resultater\s+for/i.test(text) ||
                      /0\s+treff/i.test(text) ||
                      text.includes("Søket gav ingen treff") ||
                      text.includes("Fant ingen treff");
    const emptyPage = text.length < 500;

    const isMatch = (exact || (tokens.length >= 2 && tokenHits >= 2)) && !noResults && !emptyPage;
    if (isMatch) {
      const label = exact
        ? "Språkrådet: exact normative reference found"
        : `Språkrådet: token match (${tokenHits}/${tokens.length} tokens) — normative reference`;
      return {
        source: "Språkrådet", checked: true, found: true,
        quality: "normative_reference",
        registered_entry: false, whole_unit_match: false,
        component_match: false, usage_match: false,
        urls, evidence_label: label, raw_preview: preview(text.slice(0, 500)),
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      source: "Språkrådet", checked: true, found: null, quality: "error",
      registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
      urls, evidence_label: "Språkrådet lookup failed", error: msg,
    };
  }

  return makeLookup("Språkrådet", false, "not_found", false, false, false, false,
    urls, "Språkrådet svardatabasen: no normative reference found", "");
}

async function checkLexinLive(lemma: string, displayForm: string): Promise<SourceLookupResult> {
  const query   = lemma || displayForm;
  const encoded = encodeURIComponent(query);

  const uaUrl = `https://editorportal.oslomet.no/api/v1/findwords?searchWord=${encoded}&lang=bokm%C3%A5l-ukrainsk&page=1&selectLang=bokm%C3%A5l-ukrainsk&includeEngLang=0`;
  const noUrl = `https://editorportal.oslomet.no/api/v1/findwords?searchWord=${encoded}&lang=bokm%C3%A5l-bokm%C3%A5l&page=1&selectLang=bokm%C3%A5l-bokm%C3%A5l&includeEngLang=0`;
  const urls  = [uaUrl, noUrl];

  const errors: string[] = [];

  for (const [url, label] of [[uaUrl, "nob-ukr"], [noUrl, "nob-nob"]] as [string, string][]) {
    try {
      const text = await fetchLexinText(url);
      if (!text || text.length < 5 || text === "[]" || text === "{}") continue;

      let hasEntry = false;
      let translationUa: string | null = null;
      try {
        const data = JSON.parse(text);
        const result = data?.result ?? data?.results ?? data?.data ?? data?.words ?? data;
        const items = Array.isArray(result) ? result : [];

        if (items.length > 0) {
          const normalizedQuery = normalizeForMatch(query);
          let exactMatch = false;

          for (const group of items) {
            if (!Array.isArray(group)) continue;
            for (const entry of group) {
              if (!entry || typeof entry !== "object") continue;
              if (entry.type === "E-lem") {
                const lemmaText = normalizeForMatch(entry.text ?? "");
                const lemmaClean = lemmaText.replace(/^å\s+/, "").trim();
                const queryClean = normalizedQuery.replace(/^å\s+/, "").trim();
                if (lemmaText === normalizedQuery || lemmaClean === queryClean) {
                  exactMatch = true;
                }
              }
              if (exactMatch && (entry.type === "E-ukr" || entry.type === "ukr")) {
                translationUa = entry.text ?? entry.value ?? null;
              }
            }
            if (exactMatch) break;
          }
          hasEntry = exactMatch;
        }
      } catch { hasEntry = containsExactPhrase(normalizeForMatch(text), query); }

      if (hasEntry) {
        const uaNote = translationUa ? ` | UA: ${String(translationUa).slice(0, 50)}` : "";
        return {
          source: "Lexin" as SourceName, checked: true, found: true,
          quality: "learner_dictionary" as EvidenceQuality,
          registered_entry: true,
          whole_unit_match: true,
          component_match: false, usage_match: false,
          urls: [url],
          evidence_label: `Lexin OsloMet (${label}): registered entry found${uaNote}`,
          raw_preview: preview(text.slice(0, 500)),
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${label}: ${msg}`);
    }
  }

  if (errors.length > 0 && errors.every(e => e.includes("HTTP") || e.includes("abort") || e.includes("timeout"))) {
    return {
      source: "Lexin" as SourceName, checked: true, found: null, quality: "error",
      registered_entry: false, whole_unit_match: false, component_match: false, usage_match: false,
      urls, evidence_label: "Lexin unavailable",
      error: errors.slice(0, 3).join(" | "),
    };
  }

  return makeLookup("Lexin" as SourceName, false, "not_found", false, false, false, false,
    urls, "Lexin: no match found", "");
}

async function fetchLexinText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
      "Origin": "https://lexin.oslomet.no",
      "Referer": "https://lexin.oslomet.no/",
      "Cache-Control": "no-cache",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Lexin HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.text();
}

function decideVerificationStatus(args: { lemma: string; linguisticEvidence: string; sourceExpertise: SourceExpertise; registeredEntrySources: string[]; allAuthoritativeSourcesFound: string[] }): { status: VerificationStatus; confidence: "high" | "medium" | "low"; verificationBasis: Record<string, unknown> } {
  const { lemma, linguisticEvidence, sourceExpertise, registeredEntrySources, allAuthoritativeSourcesFound } = args;
  const authoritativeWholeUnit = Object.entries(sourceExpertise).filter(([, i]) => i?.authoritative && i.found === true && i.whole_unit_match).map(([s]) => s).sort();
  const authoritativeCandidate = Object.entries(sourceExpertise).filter(([, i]) => i?.authoritative && i.found === true && ["search_page_match","exact_expression_match","manual_reference","normative_reference"].includes(i.quality)).map(([s]) => s).sort();
  const componentSources       = Object.entries(sourceExpertise).filter(([, i]) => i?.authoritative && i.found === true && i.component_match).map(([s]) => s).sort();
  const authoritativeUsage     = Object.entries(sourceExpertise).filter(([, i]) => i?.authoritative && i.found === true && i.usage_match).map(([s]) => s).sort();
  const aiSupported            = sourceExpertise.Gemini?.found === true;
  const liveChecked            = Object.values(sourceExpertise).filter(i => i?.authoritative && i.live_lookup && i.checked).length;

  const primarySources = registeredEntrySources.filter(s => ["NAOB","Ordbokene","Lexin","Språkrådet"].includes(s));
  const wiktionaryOnly = registeredEntrySources.length > 0 && registeredEntrySources.every(s => s === "Wiktionary");

  if (registeredEntrySources.length >= 2 && primarySources.length >= 1) return { status: "multi_source", confidence: "high", verificationBasis: { rule: "registered_entry_in_multiple_authoritative_sources", registered_entry_sources: registeredEntrySources } };
  if (registeredEntrySources.length >= 2 && wiktionaryOnly) return { status: "multi_source", confidence: "medium", verificationBasis: { rule: "registered_entry_in_multiple_community_sources", registered_entry_sources: registeredEntrySources } };
  if (registeredEntrySources.length === 1 && primarySources.length === 1) return { status: "authoritative", confidence: "high", verificationBasis: { rule: "registered_entry_in_authoritative_source", registered_entry_sources: registeredEntrySources } };
  if (wiktionaryOnly) return { status: "usage_verified", confidence: "medium", verificationBasis: { rule: "registered_entry_in_community_dictionary_only_wiktionary", registered_entry_sources: registeredEntrySources } };
  if (authoritativeWholeUnit.length >= 1)  return { status: "candidate_authoritative",confidence: "medium", verificationBasis: { rule: "whole_unit_candidate_found_but_registered_entry_not_proven", sources: authoritativeWholeUnit } };
  if (authoritativeCandidate.length >= 1)  return { status: "candidate_authoritative",confidence: "medium", verificationBasis: { rule: "authoritative_candidate_signal", sources: authoritativeCandidate } };
  if (componentSources.length >= 1)        return { status: "component_verified",     confidence: "medium", verificationBasis: { rule: "components_verified_but_whole_unit_not_registered", sources: componentSources } };
  if (authoritativeUsage.length >= 1)      return { status: "usage_verified",         confidence: "medium", verificationBasis: { rule: "usage_supported_by_authoritative_source", sources: authoritativeUsage } };
  if (aiSupported && liveChecked > 0 && allAuthoritativeSourcesFound.length === 0) return { status: "unregistered_usage_candidate", confidence: "low", verificationBasis: { rule: "authoritative_checked_no_match_ai_only", authoritative_checked: liveChecked } };
  if (aiSupported) return { status: "ai_candidate", confidence: "low", verificationBasis: { rule: "ai_supported_only" } };
  return { status: "unverified", confidence: "low", verificationBasis: { rule: "no_evidence", lemma } };
}

function decideFamilyVerificationStatus(args: { status: VerificationStatus; registeredEntryFound: boolean; sourceExpertise: SourceExpertise }): AuditDecision["family_verification_status"] {
  const { status, registeredEntryFound, sourceExpertise } = args;
  if (registeredEntryFound || status === "authoritative" || status === "multi_source" || status === "dictionary") return "canonical_verified";
  if (status === "candidate_authoritative") return "candidate_only";
  if (status === "component_verified")      return "component_pattern_only";
  if (status === "usage_verified" || status === "unregistered_usage_candidate") return "usage_pattern_only";
  return Object.values(sourceExpertise).some(i => i?.found === true) ? "candidate_only" : "not_verified";
}

function decideComponentSourceType(sourceExpertise: SourceExpertise): string | null {
  const c = Object.entries(sourceExpertise).filter(([, i]) => i?.component_match).map(([s]) => s);
  return c.length ? canonicalJoin(c) : null;
}

function decideUnregisteredReason(args: { status: VerificationStatus; lemma: string; linguisticEvidence: string; subtype: string | null; sourceExpertise: SourceExpertise }): string | null {
  const { status, lemma, linguisticEvidence, subtype, sourceExpertise } = args;
  if (!["unregistered_usage_candidate","component_verified","ai_candidate","unverified","candidate_authoritative","usage_verified"].includes(status)) return null;
  const checked = Object.entries(sourceExpertise).filter(([, i]) => i?.authoritative && i.checked).map(([s]) => s).sort();
  if (status === "candidate_authoritative") return "Authoritative source signal found, but no registered whole-unit entry proven.";
  if (status === "usage_verified")          return "Usage supported by authoritative source, but expression not proven as registered entry.";
  if (status === "component_verified")      return "Only components verified; complete expression not registered as a unit.";
  if (status === "unregistered_usage_candidate") {
    const c = checked.length ? ` Checked: ${canonicalJoin(checked)}.` : "";
    if (linguisticEvidence === "collocation")    return `Productive collocation; authoritative lookup did not prove registered entry.${c}`;
    if (linguisticEvidence === "fixed_expression") return `Possible fixed expression; authoritative lookup did not prove registered entry.${c}`;
    return `Language usage likely exists but registration not proven.${c}`;
  }
  if (status === "ai_candidate") return "Only AI support available; do not treat as verified.";
  if (getTokens(lemma).length > 1) return "Multiword expression; components may be lexicalized while whole phrase not registered.";
  return `No registered authoritative entry for subtype ${subtype ?? "unknown"}.`;
}

function normalizeSubtype(value: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  return LEGACY_SUBTYPE_MAP[clean] ?? clean;
}

function suggestExpressionSubtype(lemma: string, oldSubtype: string | null): string | null {
  const normalized = normalizeForMatch(lemma);
  const tokens = getTokens(lemma);

  if (DISCOURSE_MARKERS.has(normalized))    return "discourse_marker";
  if (CONFIRMATION_PHRASES.has(normalized)) return "confirmation_phrase";
  if (REACTION_PHRASES.has(normalized))     return "reaction_phrase";

  if (tokens.length === 0) return oldSubtype;

  if (tokens.includes("seg"))   return "reflexive_verb";
  if (tokens.length === 2) {
    if (NORWEGIAN_PARTICLES.has(tokens[1]))    return "particle_verb";
    if (NORWEGIAN_PREPOSITIONS.has(tokens[1])) return "prepositional_verb";
  }
  if (tokens.length >= 3 && NORWEGIAN_PREPOSITIONS.has(tokens[tokens.length - 1])) return "prepositional_verb";

  if (oldSubtype === "idiom")            return "idiom";
  if (oldSubtype === "discourse_marker") return "discourse_marker";
  if (oldSubtype === "time_expression")  return "time_expression";
  if (oldSubtype === "question_pattern") return "question_pattern";
  if (oldSubtype === "reaction_phrase")  return "reaction_phrase";

  if (tokens.length >= 2) return "collocation";
  return oldSubtype ?? "fixed_expression";
}

function inferLinguisticEvidence(lemma: string, subtype: string | null): string {
  if (subtype === "idiom")             return "idiom";
  if (subtype === "collocation")       return "collocation";
  if (subtype === "discourse_marker")  return "fixed_expression";
  if (subtype === "confirmation_phrase") return "fixed_expression";
  if (subtype === "reaction_phrase")   return "fixed_expression";
  if (["particle_verb","prepositional_verb","reflexive_verb","fixed_expression"].includes(subtype ?? "")) return "fixed_expression";
  return getTokens(lemma).length >= 2 ? "collocation" : "fixed_expression";
}

function inferCollocationType(lemma: string, evidence: string): string | null {
  if (evidence !== "collocation") return null;
  const tokens = getTokens(lemma);
  if (tokens.length < 2) return null;
  if (NORWEGIAN_PREPOSITIONS.has(tokens[tokens.length - 1])) return "verb_preposition_pattern";
  if (tokens.includes("seg")) return "reflexive_pattern";
  return "verb_noun_or_productive_phrase";
}

// ── QUEUE SYSTEM ─────────────────────────────────────────────────────────────

async function handleQueueEnqueue(entity: EntityTable, batchSize: number, pos?: string | null): Promise<Response> {
  let pending: string[] = [];

  if (entity === "lexemes") {
    let q = supabase.from("lexemes").select("id").order("created_at", { ascending: true });
    if (pos) q = q.eq("pos", pos);
    else q = q.not("pos", "eq", "expression");
    const { data: allIds } = await q;

    const { data: auditedIds } = await supabase
      .from("lexical_quality_audit").select("entity_id").eq("entity_table", "lexemes");

    const audited = new Set((auditedIds ?? []).map((r: any) => r.entity_id));
    pending = (allIds ?? []).map((r: any) => r.id).filter((id: string) => !audited.has(id));
  } else {
    const { data: allIds } = await supabase
      .from("expression_catalog").select("id").order("created_at", { ascending: true });

    const { data: auditedIds } = await supabase
      .from("lexical_quality_audit").select("entity_id").eq("entity_table", "expression_catalog");

    const audited = new Set((auditedIds ?? []).map((r: any) => r.entity_id));
    pending = (allIds ?? []).map((r: any) => r.id).filter((id: string) => !audited.has(id));
  }

  if (pending.length === 0) {
    return jsonResponse({ ok: true, message: "All items already audited", pending: 0, entity, pos: pos ?? "all" });
  }

  const batches: string[][] = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    batches.push(pending.slice(i, i + batchSize));
  }

  const jobs = batches.map(ids => ({
    entity_ids: ids,
    entity_table: entity,
    status: "pending",
    created_at: new Date().toISOString(),
  }));

  const { data: inserted, error } = await supabase
    .from("audit_queue").insert(jobs).select("id");

  if (error) {
    if (error.message.includes("does not exist")) {
      return jsonResponse({
        ok: false,
        error: "audit_queue table not found. Run: CREATE TABLE audit_queue (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, entity_ids text[], entity_table text, status text DEFAULT 'pending', created_at timestamptz DEFAULT now(), started_at timestamptz, finished_at timestamptz, result jsonb, error text);",
      }, 400);
    }
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  return jsonResponse({
    ok: true, enqueued: jobs.length, total_pending: pending.length,
    batch_size: batchSize, entity, pos: pos ?? "all",
    job_ids: (inserted ?? []).map((r: any) => r.id),
  });
}

async function handleQueueProcess(options: {
  dryRun: boolean;
  liveLookup: boolean;
  requestedSources: SourceName[];
  jobId?: string;
}): Promise<Response> {
  let query = supabase
    .from("audit_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (options.jobId) query = query.eq("id", options.jobId);

  const { data: jobs, error } = await query;
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);
  if (!jobs?.length) return jsonResponse({ ok: true, message: "No pending jobs", processed: 0 });

  const job = jobs[0];

  await supabase.from("audit_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    const isLexemeJob = job.entity_table === "lexemes";
    const rows = isLexemeJob
      ? await fetchLexemeRows({ limit: job.entity_ids.length, offset: 0, where: "all", ids: job.entity_ids, pos: null })
      : await fetchExpressionRows({ limit: job.entity_ids.length, offset: 0, where: "all", ids: job.entity_ids });

    const results: any[] = [];
    const summary = createSummary();
    let errors = 0;

    for (const row of rows) {
      try {
        const decision = isLexemeJob
          ? await auditLexeme(row as LexemeRow, { liveLookup: options.liveLookup, requestedSources: options.requestedSources })
          : await auditExpression(row as ExpressionRow, { liveLookup: options.liveLookup, requestedSources: options.requestedSources });

        incrementSummary(summary, "byVerificationStatus", decision.proposed_verification_status);
        incrementSummary(summary, "bySource", decision.proposed_whole_unit_sources ?? "null");
        incrementSummary(summary, "byRegisteredEntry", decision.proposed_source_verified ?? "null");

        if (!options.dryRun) {
          const auditRecord = isLexemeJob
            ? buildLexemeAuditRecord(row as LexemeRow, decision)
            : buildAuditRecord(row as ExpressionRow, decision);
          await supabase.from("lexical_quality_audit").insert(auditRecord);

          if (isLexemeJob) {
            const updateData: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
              verification_evidence: decision.source_expertise,
            };
            if (decision.proposed_source_verified) updateData.source_verified = decision.proposed_source_verified;
            updateData.verification_tier = mapStatusToTier(decision.proposed_verification_status);
            await supabase.from("lexemes").update(updateData).eq("id", (row as LexemeRow).id);
          }
        }
        results.push({ id: row.id, lemma: row.lemma, ok: true, status: decision.proposed_verification_status });
      } catch (e) {
        errors++;
        results.push({ id: row.id, lemma: row.lemma, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const jobResult = { processed: rows.length, errors, summary, results };

    await supabase.from("audit_queue")
      .update({
        status: errors === rows.length ? "failed" : "done",
        finished_at: new Date().toISOString(),
        result: jobResult,
      })
      .eq("id", job.id);

    return jsonResponse({ ok: true, job_id: job.id, dry_run: options.dryRun, ...jobResult });
  } catch (e) {
    await supabase.from("audit_queue")
      .update({ status: "failed", error: e instanceof Error ? e.message : String(e) })
      .eq("id", job.id);
    return jsonResponse({ ok: false, job_id: job.id, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

async function handleQueueStatus(): Promise<Response> {
  const { data } = await supabase
    .from("audit_queue")
    .select("status")
    .order("created_at");

  const counts = { pending: 0, processing: 0, done: 0, failed: 0, total: 0 };
  for (const row of (data ?? [])) {
    counts[row.status as keyof typeof counts] = (counts[row.status as keyof typeof counts] ?? 0) + 1;
    counts.total++;
  }

  const { data: audited } = await supabase
    .from("lexical_quality_audit")
    .select("entity_id", { count: "exact", head: true })
    .eq("entity_table", "expression_catalog");

  return jsonResponse({
    ok: true,
    queue: counts,
    audited_total: (audited as any)?.count ?? 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function canonicalVerifiedSourceSummary(sourceExpertise: SourceExpertise): string | null {
  const verifiedSources = Object.entries(sourceExpertise)
    .filter(([, item]) =>
      item?.authoritative === true &&
      item?.found === true &&
      (
        item.registered_entry === true ||
        item.quality === "registered_entry" ||
        item.quality === "structured_entry_match"
      )
    )
    .map(([source]) => source)
    .sort();
  return verifiedSources.length ? canonicalJoin(verifiedSources) : null;
}

function canonicalWholeUnitSourceSummary(sourceExpertise: SourceExpertise): string | null {
  const sources = Object.entries(sourceExpertise)
    .filter(([, item]) =>
      item?.authoritative === true &&
      item?.found === true &&
      (
        item.registered_entry === true ||
        item.quality === "registered_entry" ||
        item.quality === "structured_entry_match" ||
        item.whole_unit_match === true
      )
    )
    .map(([source]) => source)
    .sort();
  return sources.length ? canonicalJoin(sources) : null;
}

function buildAuditRecord(row: ExpressionRow, decision: AuditDecision): Record<string, unknown> {
  return {
    entity_table: "expression_catalog", entity_id: row.id,
    lemma: row.lemma, display_form: row.display_form,
    pos: row.pos ?? "expression", subtype: row.expression_subtype ?? row.subtype ?? null,
    old_data: row, proposed_data: decision.proposed_data,
    old_verification: row.verification ?? null, proposed_verification: null,
    old_verification_status: row.verification_status ?? null,
    proposed_verification_status: decision.proposed_verification_status,
    old_source_verified: row.source_verified ?? null,
    proposed_source_verified: decision.proposed_source_verified,
    proposed_whole_unit_sources: decision.proposed_whole_unit_sources ?? null,
    old_linguistic_evidence: row.linguistic_evidence ?? null,
    proposed_linguistic_evidence: decision.proposed_linguistic_evidence,
    old_cefr: row.cefr ?? null, proposed_cefr: row.cefr ?? null,
    old_frequency_level: row.frequency_level ?? null,
    proposed_frequency_level: row.frequency_level ?? null,
    changed_fields: decision.changed_fields,
    checks: decision.checks, sources_found: decision.sources_found,
    audit_status: "pending", audit_error: null,
    old_forms: null, proposed_forms: null, form_checks: null,
    form_verification_status: null, comparison_status: null,
    inflection_notes: null, confidence: decision.confidence,
    frequency_status: null, audit_notes: decision.audit_notes,
    relation_checks: null, semantic_relation_status: null,
    interchangeability_status: null,
    subtype_conflict: decision.subtype_conflict,
    subtype_suggestion: decision.subtype_suggestion,
    component_source_type: decision.component_source_type,
    collocation_type: decision.collocation_type,
    family_verification_status: decision.family_verification_status,
    expression_synonym_status: null, expression_synonym_count: 0,
    source_expertise: decision.source_expertise,
    all_sources_found: decision.all_sources_found,
    all_authoritative_sources_found: decision.all_authoritative_sources_found,
    registered_entry_found: decision.registered_entry_found,
    registered_entry_sources: decision.registered_entry_sources,
    verification_basis: decision.verification_basis,
    source_evidence_scope: decision.source_evidence_scope,
    unregistered_reason: decision.unregistered_reason,
    old_source_hints: decision.old_source_hints,
    live_lookup_errors: decision.live_lookup_errors,
  };
}

async function insertErrorAudit(row: ExpressionRow, error: unknown): Promise<void> {
  await supabase.from("lexical_quality_audit").insert({
    entity_table: "expression_catalog", entity_id: row.id,
    lemma: row.lemma, display_form: row.display_form,
    pos: row.pos ?? "expression", subtype: row.expression_subtype ?? row.subtype ?? null,
    old_data: row, proposed_data: {},
    old_verification_status: row.verification_status ?? null, proposed_verification_status: null,
    old_source_verified: row.source_verified ?? null, proposed_source_verified: null,
    old_linguistic_evidence: row.linguistic_evidence ?? null, proposed_linguistic_evidence: null,
    changed_fields: [], checks: [], sources_found: [],
    audit_status: "error",
    audit_error: error instanceof Error ? error.message : String(error),
  });
}

function buildChecks(args: { oldSubtype: string | null; subtypeSuggestion: string | null; subtypeConflict: boolean; sourceExpertise: SourceExpertise; registeredEntryFound: boolean; linguisticEvidence: string; oldSourceHints: OldSourceHints }): unknown[] {
  return [
    { check: "identity_immutable", ok: true, note: "lemma/display_form/normalized_key not changed by audit" },
    { check: "old_sources_are_hints_only", ok: true, old_source_hints: args.oldSourceHints },
    { check: "subtype_validation", ok: !args.subtypeConflict, old_subtype: args.oldSubtype, subtype_suggestion: args.subtypeSuggestion },
    { check: "source_expertise_live_model", ok: true, sources: Object.fromEntries(Object.entries(args.sourceExpertise).map(([s, i]) => [s, { checked: i?.checked, found: i?.found, live_lookup: i?.live_lookup, quality: i?.quality, stored_hint: i?.stored_hint }])) },
    { check: "registered_entry_found", ok: args.registeredEntryFound },
    { check: "linguistic_evidence_classified", ok: Boolean(args.linguisticEvidence), linguistic_evidence: args.linguisticEvidence },
  ];
}

function buildSourcesFoundList(sourceExpertise: SourceExpertise): unknown[] {
  return Object.entries(sourceExpertise).map(([source, item]) => ({
    source, checked: item?.checked ?? false, found: item?.found ?? null,
    authoritative: item?.authoritative ?? false, quality: item?.quality ?? "not_checked",
    registered_entry: item?.registered_entry ?? false,
    whole_unit_match: item?.whole_unit_match ?? false,
    component_match: item?.component_match ?? false,
    usage_match: item?.usage_match ?? false,
    live_lookup: item?.live_lookup ?? false,
    stored_hint: item?.stored_hint ?? false,
    urls: item?.urls ?? [], evidence_label: item?.evidence_label ?? null, error: item?.error ?? null,
  }));
}

function buildAuditNotes(args: { lemma: string; linguisticEvidence: string; status: VerificationStatus; registeredEntryFound: boolean; allAuthoritativeSourcesFound: string[]; subtypeConflict: boolean; oldSubtype: string | null; subtypeSuggestion: string | null; unregisteredReason: string | null; liveLookupErrors: Record<string, string> }): string {
  const parts = [
    `v2.8 live source audit for "${args.lemma}".`,
    `Evidence: ${args.linguisticEvidence}. Status: ${args.status}.`,
    args.allAuthoritativeSourcesFound.length
      ? `Authoritative found: ${canonicalJoin(args.allAuthoritativeSourcesFound)}.`
      : "No authoritative match.",
  ];
  if (!args.registeredEntryFound) parts.push("No registered whole-unit entry proven.");
  if (args.subtypeConflict)       parts.push(`Subtype conflict: ${args.oldSubtype} → ${args.subtypeSuggestion}.`);
  const errs = Object.keys(args.liveLookupErrors);
  if (errs.length) parts.push(`Lookup errors: ${canonicalJoin(errs)}.`);
  if (args.unregisteredReason) parts.push(`Reason: ${args.unregisteredReason}`);
  return parts.join(" ");
}

function computeChangedFields(row: ExpressionRow, proposedData: Record<string, unknown>): string[] {
  const changed: string[] = [];
  const cmp: Array<[keyof ExpressionRow, string]> = [
    ["verification_status","verification_status"],["source_verified","source_verified"],
    ["linguistic_evidence","linguistic_evidence"],["confidence","confidence"],
    ["expression_subtype","expression_subtype"],
  ];
  for (const [oldKey, newKey] of cmp) if ((row[oldKey] ?? null) !== (proposedData[newKey] ?? null)) changed.push(newKey);
  changed.push("source_expertise","all_sources_found","all_authoritative_sources_found",
    "registered_entry_found","registered_entry_sources","verification_basis",
    "source_evidence_scope","unregistered_reason","old_source_hints","live_lookup_errors");
  return [...new Set(changed)];
}

function collectOldSourceHints(row: ExpressionRow): OldSourceHints {
  return {
    source_naob:       row.source_naob === true       || hasRawSource(row, "NAOB")       || sourceUrlsContain(row, "naob"),
    source_ordbokene:  row.source_ordbokene === true  || hasRawSource(row, "Ordbokene")  || sourceUrlsContain(row, "ordbok"),
    source_wiktionary: row.source_wiktionary === true || hasRawSource(row, "Wiktionary") || sourceUrlsContain(row, "wiktionary"),
    source_gemini:     row.source_gemini === true     || hasRawSource(row, "Gemini"),
    source_manual:     row.source_manual === true     || hasRawSource(row, "Manual"),
    source_verified:   row.source_verified ?? null,
    source_urls:       row.source_urls ?? null,
    raw_sources_present: Boolean(row.raw_sources),
  };
}

function oldHintFromSource(row: ExpressionRow, source: SourceName): boolean {
  const h = collectOldSourceHints(row);
  if (source === "NAOB")       return h.source_naob;
  if (source === "Ordbokene")  return h.source_ordbokene;
  if (source === "Wiktionary") return h.source_wiktionary;
  if (source === "Gemini")     return h.source_gemini;
  if (source === "Manual")     return h.source_manual;
  return false;
}

function manualSourceExpertise(row: ExpressionRow): SourceExpertiseItem {
  const storedHint = oldHintFromSource(row, "Manual");
  if (!storedHint) return sourceNotChecked("Manual", false, "No manual trusted reference stored.");
  return {
    checked: false, found: true, authoritative: true, quality: "manual_reference",
    registered_entry: false, whole_unit_match: true, component_match: false, usage_match: false,
    live_lookup: false, stored_hint: true, urls: [],
    evidence_label: "Historical manual source hint; not revalidated live",
    note: "Manual hints should be reviewed separately.",
  };
}

function hasRawSource(row: ExpressionRow, source: string): boolean {
  if (!row.raw_sources || typeof row.raw_sources !== "object") return false;
  const keys = Object.keys(row.raw_sources as Record<string, unknown>).map(k => k.toLowerCase());
  const s = source.toLowerCase();
  return keys.some(k => k.includes(s) || normalizeSourceKey(k).toLowerCase() === s);
}

function sourceUrlsContain(row: ExpressionRow, needle: string): boolean {
  return row.source_urls ? JSON.stringify(row.source_urls).toLowerCase().includes(needle.toLowerCase()) : false;
}

function getSourcesFound(sourceExpertise: SourceExpertise, authoritativeOnly: boolean): string[] {
  return Object.entries(sourceExpertise)
    .filter(([, i]) => i?.found === true)
    .filter(([, i]) => !authoritativeOnly || i?.authoritative === true)
    .map(([s]) => s).sort();
}

function getRegisteredEntrySources(sourceExpertise: SourceExpertise): string[] {
  return Object.entries(sourceExpertise)
    .filter(([, i]) => i?.authoritative && i.registered_entry === true)
    .map(([s]) => s).sort();
}

function getSourceEvidenceScope(sourceExpertise: SourceExpertise): Record<string, EvidenceQuality> {
  const out: Record<string, EvidenceQuality> = {};
  for (const [s, i] of Object.entries(sourceExpertise)) out[s] = i?.quality ?? "not_checked";
  return out;
}

function getLiveLookupErrors(sourceExpertise: SourceExpertise): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [s, i] of Object.entries(sourceExpertise)) if (i?.error) out[s] = i.error;
  return out;
}

function canonicalJoin(values: string[]): string { return [...new Set(values.filter(Boolean))].sort().join("+"); }
function containsExactPhrase(text: string, phrase: string): boolean { const a = normalizeForMatch(text), b = normalizeForMatch(phrase); return Boolean(b && a.includes(b)); }
function countTokenHits(text: string, tokens: string[]): number { const n = normalizeForMatch(text); return tokens.filter(t => n.includes(normalizeForMatch(t))).length; }
function includesAny(text: string, needles: string[]): boolean { const l = text.toLowerCase(); return needles.some(n => l.includes(n.toLowerCase())); }
function preview(text: string, max = 500): string { return text.slice(0, max); }
function shouldCheckOrdbokeneComponent(token: string): boolean {
  const c = normalizeForMatch(token);
  if (c.length < 2) return false;
  if (NORWEGIAN_PREPOSITIONS.has(c)) return false;
  if (["å","i","og","det","den","en","ei","et","til","med","på","av","om"].includes(c)) return false;
  return true;
}
function ordbokenePayloadHasExactMatch(payload: unknown, query: string): boolean {
  const exact = normalizeForMatch(query);
  if (!exact) return false;
  return extractOrdbokeneSuggestExactTerms(payload).some(t => normalizeForMatch(t) === exact);
}
function extractOrdbokeneSuggestExactTerms(payload: unknown): string[] {
  const terms = new Set<string>();
  const root = payload as Record<string, unknown> | null;
  const a = root && typeof root === "object" ? (root.a as Record<string, unknown> | undefined) : undefined;
  const exact = a && Array.isArray(a.exact) ? a.exact : [];
  for (const item of exact) {
    if (typeof item === "string") { if (item.trim()) terms.add(item.trim()); }
    else if (Array.isArray(item)) { if (typeof item[0] === "string" && item[0].trim()) terms.add(item[0].trim()); }
    else if (item && typeof item === "object") {
      const v = String((item as Record<string,unknown>).word ?? (item as Record<string,unknown>).lemma ?? "").trim();
      if (v) terms.add(v);
    }
  }
  return [...terms];
}
function extractOrdbokeneArticleIds(payload: unknown): string[] {
  const ids = new Set<string>();
  const addId = (v: unknown) => { const s = String(v ?? "").trim(); if (s && /^[0-9]+$/.test(s)) ids.add(s); };
  const root = payload as Record<string, unknown> | null;
  const articles = root && typeof root === "object" ? (root.articles as Record<string, unknown> | undefined) : undefined;
  if (articles && typeof articles === "object") {
    for (const v of Object.values(articles)) {
      if (Array.isArray(v)) v.forEach(addId); else addId(v);
    }
  }
  if (Array.isArray(payload)) payload.forEach(addId);
  visitJson(payload, (key, value) => {
    if (["article_id","articleid","article","id","artikelnr","art_id"].includes(key.toLowerCase())) addId(value);
  });
  return [...ids];
}
function visitJson(value: unknown, visitor: (key: string, value: unknown) => void, key = ""): void {
  visitor(key, value);
  if (Array.isArray(value)) value.forEach((item, i) => visitJson(item, visitor, String(i)));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) visitJson(v, visitor, k);
  }
}
async function fetchText(url: string): Promise<string> {
  const r = await fetchWithTimeout(url, { method: "GET", headers: { "User-Agent": "NorskTrainerAuditBot/2.9.0", "Accept": "text/html,application/json;q=0.8,*/*;q=0.7", "Accept-Language": "nb,no,en;q=0.8" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.text();
}
async function fetchJson(url: string): Promise<unknown> {
  const r = await fetchWithTimeout(url, { method: "GET", headers: { "User-Agent": "NorskTrainerAuditBot/2.9.0", "Accept": "application/json,text/plain;q=0.9,*/*;q=0.7", "Accept-Language": "nb,no,en;q=0.8" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  const text = await r.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return { raw_text: text }; }
}
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), LIVE_LOOKUP_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}
function normalizeHtmlText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
}
function normalizeForMatch(value: string): string {
  return value.toLowerCase().normalize("NFC").replace(/[«»"""'`´]/g,"").replace(/[()\[\]{}.,;:!?]/g," ").replace(/\s+/g," ").trim();
}
function delay(ms: number): Promise<void> { return ms <= 0 ? Promise.resolve() : new Promise(r => setTimeout(r, ms)); }
function parseFirstJsonObject(text: string): Record<string, unknown> {
  const clean = text.replace(/```json|```/g,"").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) return {};
  try { return JSON.parse(clean.slice(s, e + 1)); } catch { return {}; }
}
function getTokens(v: string): string[] { return cleanLemma(v).toLowerCase().split(/\s+/).map(x => x.trim()).filter(Boolean); }
function cleanLemma(v: string): string { return v.replace(/^å\s+/i,"").trim().replace(/\s+/g," "); }
function clampNumber(v: number, min: number, max: number): number { return Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min; }
function normalizeRequestedSources(sources: SourceName[] | undefined): SourceName[] {
  if (!Array.isArray(sources) || sources.length === 0) return LIVE_AUTHORITATIVE_SOURCES;
  const allowed = new Set<SourceName>(LIVE_AUTHORITATIVE_SOURCES);
  return [...new Set(sources.filter(s => allowed.has(s)))];
}
function normalizeSourceKey(source: string): string {
  const s = source.trim().toLowerCase();
  if (s.includes("naob")) return "NAOB";
  if (s.includes("ordbok")) return "Ordbokene";
  if (s.includes("wiktionary")) return "Wiktionary";
  if (s.includes("språk") || s.includes("sprak")) return "Språkrådet";
  if (s.includes("gemini")) return "Gemini";
  if (s.includes("manual")) return "Manual";
  return source;
}
function envBool(name: string, fallback: boolean): boolean {
  const v = Deno.env.get(name);
  if (v == null) return fallback;
  return ["1","true","yes","on"].includes(v.toLowerCase());
}
function envInt(name: string, fallback: number): number {
  const v = Deno.env.get(name);
  if (!v) return fallback;
  const p = Number.parseInt(v, 10);
  return Number.isFinite(p) ? p : fallback;
}
function createSummary() {
  return {
    byEntity: {} as Record<string,number>,
    byVerificationStatus: {} as Record<string,number>,
    bySource: {} as Record<string,number>,
    byRegisteredEntry: {} as Record<string,number>,
    byFormStatus: {} as Record<string,number>,
    errors: 0,
  };
}
function incrementSummary(summary: ReturnType<typeof createSummary>, bucket: "byEntity"|"byVerificationStatus"|"bySource"|"byRegisteredEntry"|"byFormStatus", key: string) {
  summary[bucket][key] = (summary[bucket][key] ?? 0) + 1;
}
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() } });
}
function corsResponse(data: string): Response { return new Response(data, { headers: corsHeaders() }); }
function corsHeaders(): Record<string,string> {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
}