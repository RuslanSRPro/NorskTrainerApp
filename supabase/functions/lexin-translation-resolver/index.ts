import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const LEXIN_SOURCE = 'lexin';
const LEXIN_BASE_URL = 'https://editorportal.oslomet.no/api/v1/findwords';

// Two modes:
//
// mode = 'gloss_candidates' (default)
//   Source: lexin_gloss_candidates WHERE translation_status = 'pending'
//   Use case: translate Lexin E-idi gloss terms (observere, se, ...)
//
// mode = 'semantic_relations'
//   Source: authoritative_semantic_relations WHERE target_text IS NOT NULL
//           AND target_entity_id IS NULL (unresolved relations)
//   Use case: translate Ordbokene/NAOB related_candidate targets
//             (rekke, ryke, overskride, ...)
//   Bonus: fills target_entity_id when lexeme found in DB
//
// Both modes:
//   - One Lexin call per unique target_text (deduplication)
//   - Write to entity_translations ONLY when target_lexeme_id found in lexemes
//   - If no lexeme found: hold translation data, don't write to entity_translations
//   - 150ms delay between Lexin requests (polite to OsloMet API)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch { return String(value); }
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isExactMatch(entries: any[], word: string): boolean {
  const normalized = normalizeKey(word);
  return entries.some((e: any) => {
    if (e.type === 'E-lem') {
      const t = normalizeKey(e.text ?? '');
      return t === normalized || t.replace(/^å\s+/, '') === normalized;
    }
    if (e.type === 'E-idi') {
      const exprPart = normalizeKey((e.text ?? '').split('(')[0]);
      return exprPart === normalized;
    }
    return false;
  });
}

async function fetchLexinTranslations(word: string): Promise<{
  ukrLem: string[];
  ukrDef: string[];
  engLem: string[];
  found: boolean;
  url: string;
}> {
  const encoded = encodeURIComponent(word);
  const url = `${LEXIN_BASE_URL}?searchWord=${encoded}&lang=bokm%C3%A5l-ukrainsk&page=1&selectLang=bokm%C3%A5l-ukrainsk&includeEngLang=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      Origin: 'https://lexin.oslomet.no',
      Referer: 'https://lexin.oslomet.no/',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) throw new Error(`Lexin HTTP ${response.status} for "${word}"`);

  const text = await response.text();
  if (!text || text.length < 5 || text === '[]' || text === '{}') {
    return { ukrLem: [], ukrDef: [], engLem: [], found: false, url };
  }

  const data = JSON.parse(text);
  const result = data?.result ?? data?.results ?? data?.data ?? [];
  const groups: any[][] = Array.isArray(result) ? result : [];
  const ukrLem: string[] = [];
  const ukrDef: string[] = [];
  const engLem: string[] = [];

  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    if (!isExactMatch(group, word)) continue;
    for (const e of group) {
      if (e.type === 'Ukr-lem' && e.text?.trim()) ukrLem.push(e.text.trim());
      if (e.type === 'Ukr-def' && e.text?.trim()) ukrDef.push(e.text.trim());
      if (e.type === 'B-lem' && e.text?.trim()) engLem.push(e.text.trim());
    }
  }

  return {
    ukrLem, ukrDef, engLem,
    found: ukrLem.length > 0 || ukrDef.length > 0 || engLem.length > 0,
    url,
  };
}

// ── Source loaders ────────────────────────────────────────────────────────────

async function loadGlossCandidates(supabase: any, limit: number) {
  const { data, error } = await supabase
    .from('lexin_gloss_candidates')
    .select('id, gloss_term, source_lexeme_id, source_expression_id')
    .eq('translation_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit * 5);

  if (error) throw new Error(`load gloss_candidates: ${safeStringify(error)}`);

  // Deduplicate by term
  const uniqueTerms = new Map<string, { ids: string[]; sourceExpressionId: string | null }>();
  for (const c of data ?? []) {
    const term = normalizeKey(c.gloss_term ?? '');
    if (!term) continue;
    if (!uniqueTerms.has(term)) {
      uniqueTerms.set(term, { ids: [], sourceExpressionId: c.source_expression_id ?? null });
    }
    uniqueTerms.get(term)!.ids.push(c.id);
  }

  return { totalRows: data?.length ?? 0, uniqueTerms };
}

async function loadSemanticRelations(
  supabase: any,
  limit: number,
  sources: string[],
  relationTypes: string[],
) {
  const { data, error } = await supabase
    .from('authoritative_semantic_relations')
    .select('id, target_text, source, relation_type, source_entity_type, source_entity_id')
    .in('source', sources)
    .in('relation_type', relationTypes)
    .not('target_text', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit * 5);

  if (error) throw new Error(`load semantic_relations: ${safeStringify(error)}`);

  // Deduplicate by target_text — same word may appear in many relations
  const uniqueTerms = new Map<string, { ids: string[]; sourceExpressionId: null }>();
  for (const r of data ?? []) {
    const term = normalizeKey(r.target_text ?? '');
    if (!term) continue;
    if (!uniqueTerms.has(term)) {
      uniqueTerms.set(term, { ids: [], sourceExpressionId: null });
    }
    uniqueTerms.get(term)!.ids.push(r.id);
  }

  return { totalRows: data?.length ?? 0, uniqueTerms };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 50), 200);
    const dryRun = body.dry_run !== false;
    const mode: 'gloss_candidates' | 'semantic_relations' =
      body.mode === 'semantic_relations' ? 'semantic_relations' : 'gloss_candidates';

    // Semantic relations mode options
    const sources: string[] = body.sources ?? ['Ordbokene', 'NAOB'];
    const relationTypes: string[] = body.relation_types ?? [
      'related_candidate',
      'compare_with',
    ];

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Load source data
    let totalRows = 0;
    let uniqueTerms: Map<string, { ids: string[]; sourceExpressionId: string | null }>;

    if (mode === 'gloss_candidates') {
      const loaded = await loadGlossCandidates(supabase, limit);
      totalRows = loaded.totalRows;
      uniqueTerms = loaded.uniqueTerms;
    } else {
      const loaded = await loadSemanticRelations(supabase, limit, sources, relationTypes);
      totalRows = loaded.totalRows;
      uniqueTerms = loaded.uniqueTerms;
    }

    if (uniqueTerms.size === 0) {
      return jsonResponse({
        ok: true,
        mode,
        message: mode === 'gloss_candidates'
          ? 'No pending gloss candidates'
          : 'No unresolved semantic relation targets',
        resolved: 0,
      });
    }

    const toResolve = Array.from(uniqueTerms.entries()).slice(0, limit);

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        mode,
        total_rows: totalRows,
        unique_terms: uniqueTerms.size,
        would_resolve: toResolve.length,
        terms: toResolve.map(([term]) => term),
      });
    }

    // ── Resolve each term ─────────────────────────────────────────────────────
    const resolved: Array<{
      term: string;
      translation_found: boolean;
      target_found: boolean;
      translations_written: number;
      lexeme_id?: string;
      note?: string;
      error?: string;
    }> = [];

    for (const [term, { ids, sourceExpressionId }] of toResolve) {
      try {
        // TECH DEBT: exact lemma match — inflected forms won't be found.
        const { data: lexemeRow } = await supabase
          .from('lexemes')
          .select('id')
          .eq('lemma', term)
          .maybeSingle();

        const targetLexemeId = lexemeRow?.id ?? null;
        const lexinResult = await fetchLexinTranslations(term);

        const translationStatus = lexinResult.found ? 'resolved' : 'not_found';
        const ukTranslation = lexinResult.ukrLem[0] ?? null;
        const ukDefinition = lexinResult.ukrDef[0] ?? null;
        const enTranslation = lexinResult.engLem[0] ?? null;

        let translationsWritten = 0;

        // Write translations ONLY when lexeme found — never misattribute to source entity
        if (lexinResult.found && targetLexemeId) {
          // Deduplicate and rank globally per language.
          // Lexin may return same translation in multiple groups —
          // rank=1 is the first unique translation per language.
          const writeTranslations = async (
            rawList: string[],
            lang: string,
            type: string,
          ) => {
            const seen = new Set<string>();
            let rank = 0;
            for (const raw of rawList) {
              const text = raw.trim();
              const key = text.toLowerCase();
              if (!text || seen.has(key)) continue;
              seen.add(key);
              rank++;
              const { error } = await supabase
                .from('entity_translations')
                .upsert(
                  {
                    lexeme_id: targetLexemeId,
                    expression_id: null,
                    language_code: lang,
                    translation: text,
                    translation_type: type,
                    translation_rank: rank,
                    source: LEXIN_SOURCE,
                    confidence: 'high',
                    notes: term,
                    updated_at: new Date().toISOString(),
                  },
                  {
                    onConflict:
                      'lexeme_id,expression_id,language_code,translation_type,source,translation',
                  },
                );
              if (!error) translationsWritten++;
            }
          };

          await writeTranslations(lexinResult.ukrLem, 'uk', 'primary');
          await writeTranslations(lexinResult.engLem, 'en', 'primary');
        }

        // Mode-specific status updates
        if (mode === 'gloss_candidates') {
          await supabase
            .from('lexin_gloss_candidates')
            .update({
              uk_translation: ukTranslation,
              uk_definition: ukDefinition,
              translation_status: translationStatus,
              translation_source: LEXIN_SOURCE,
              target_lexeme_id: targetLexemeId,
              target_status: targetLexemeId ? 'resolved' : 'pending',
              evidence: {
                lexin_translations: {
                  uk_lem: lexinResult.ukrLem,
                  uk_def: lexinResult.ukrDef,
                  en_lem: lexinResult.engLem,
                },
                note: !targetLexemeId
                  ? 'translation held — lexeme not in DB yet'
                  : undefined,
              },
              updated_at: new Date().toISOString(),
            })
            .in('id', ids);

        } else {
          // semantic_relations mode: fill target_entity_id when lexeme found.
          // This saves a separate relation-resolver pass.
          if (targetLexemeId) {
            await supabase
              .from('authoritative_semantic_relations')
              .update({
                target_entity_id: targetLexemeId,
                target_entity_type: 'lexeme',
                updated_at: new Date().toISOString(),
              })
              .in('id', ids);
          }
          // Note: we don't track translation_status on semantic_relations directly.
          // The presence of entity_translations row for this lexeme_id is the source of truth.
        }

        resolved.push({
          term,
          translation_found: lexinResult.found,
          target_found: Boolean(targetLexemeId),
          translations_written: translationsWritten,
          lexeme_id: targetLexemeId ?? undefined,
          note: !targetLexemeId && lexinResult.found
            ? 'Translation found but held — lexeme not in DB yet'
            : undefined,
        });

        await new Promise((r) => setTimeout(r, 150));

      } catch (err) {
        if (mode === 'gloss_candidates') {
          await supabase
            .from('lexin_gloss_candidates')
            .update({ translation_status: 'not_found', updated_at: new Date().toISOString() })
            .in('id', ids);
        }

        resolved.push({
          term,
          translation_found: false,
          target_found: false,
          translations_written: 0,
          error: safeStringify(err),
        });
      }
    }

    const withTranslation = resolved.filter((r) => r.translation_found).length;
    const withTarget = resolved.filter((r) => r.target_found).length;
    const written = resolved.filter((r) => r.translations_written > 0).length;
    const totalWritten = resolved.reduce((s, r) => s + r.translations_written, 0);
    const heldPending = resolved.filter((r) => r.translation_found && !r.target_found).length;
    const errors = resolved.filter((r) => r.error);

    return jsonResponse({
      ok: true,
      dry_run: false,
      mode,
      total_rows: totalRows,
      unique_terms: uniqueTerms.size,
      resolved: resolved.length,
      translation_found: withTranslation,
      target_found: withTarget,
      written_to_entity_translations: written,
      total_translations_written: totalWritten,
      held_pending: heldPending,
      errors: errors.length > 0 ? errors : undefined,
      results: resolved,
    });

  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});