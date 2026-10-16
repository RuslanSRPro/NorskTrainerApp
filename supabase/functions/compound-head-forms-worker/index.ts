// compound-head-forms-worker (D10 15.10.2026, agreed)
//
// For a word WITHOUT its own Ordbøkene article that NAOB knows as a whole
// (vinterjakke):
//   1. dictionary split (see _shared/d10-compound-split.ts) ->
//      d10_write_compound_analysis_v1 (source dictionary_split);
//   2. forms from the head card -> d10_publish_compound_head_forms_v1
//      (separate table; lexeme_form_display_v2 is not touched).
// Ambiguous split -> d10_record_compound_review_v1, nothing written.
// Called by job-enrichment-batch-worker after the forms chain. Its result
// never fails the forms chain (the caller treats it as an addition).
//
// Body: { lexemeIds: string[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  hasInternalSecretApiKey,
  hasInternalServiceAuthorization,
} from '../_shared/authoritative-morphology-v2/internal-authorization.ts';
import { decideSplit, type HeadInfo } from '../_shared/d10-compound-split.ts';

const WORKER_NAME = 'compound-head-forms-worker';
const MAX_LEXEMES = 25;
const ALLOWED_POS = new Set(['noun', 'adjective', 'verb']);
const ORDBOKENE_TIMEOUT_MS = 8_000;
const MAX_LIVE_LOOKUPS = 8;

type Supa = ReturnType<typeof createClient>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type LexemeResult = {
  lexemeId: string;
  lemma?: string;
  status: string;
  detail?: unknown;
};

// Ordbøkene exact headword search (scope e). A server failure throws: the
// split is then not decided now, never decided wrongly.
export async function ordbokeneHasHeadword(word: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  const url = new URL('https://ord.uib.no/api/articles');
  url.searchParams.set('w', word);
  url.searchParams.set('dict', 'bm');
  url.searchParams.set('scope', 'e');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORDBOKENE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.toString(), {
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Ordbokene returned HTTP ${response.status}`);
    const payload = await response.json() as { articles?: { bm?: unknown[] } };
    return Array.isArray(payload?.articles?.bm) && payload.articles!.bm!.length > 0;
  } finally {
    clearTimeout(timer);
  }
}

export async function processLexeme(
  supabase: Supa,
  lexeme: { id: string; lemma: string; pos: string },
  fetchImpl: FetchLike = fetch,
): Promise<LexemeResult> {
  const base = { lexemeId: lexeme.id, lemma: lexeme.lemma };
  if (!ALLOWED_POS.has(lexeme.pos)) return { ...base, status: 'pos_not_supported' };

  const { count: ownRows, error: ownError } = await supabase
    .from('lexeme_form_display_v2').select('form_key', { count: 'exact', head: true })
    .eq('lexeme_id', lexeme.id);
  if (ownError) throw new Error(`OWN_FORMS_LOAD_FAILED:${ownError.message}`);
  if ((ownRows ?? 0) > 0) return { ...base, status: 'own_forms' };

  // Ordbøkene answered "no article" (not an outage) and NAOB knows the word.
  const { data: checks, error: checksError } = await supabase
    .from('lexeme_source_checks').select('source, status, found')
    .eq('lexeme_id', lexeme.id).in('source', ['Ordbokene', 'NAOB']);
  if (checksError) throw new Error(`CHECKS_LOAD_FAILED:${checksError.message}`);
  const ord = (checks ?? []).filter((c: any) => c.source === 'Ordbokene');
  const ordAnswered = ord.some((c: any) => ['done', 'partial'].includes(c.status));
  if (!ordAnswered || ord.some((c: any) => c.found === true)) {
    return { ...base, status: 'ordbokene_not_confirmed_missing' };
  }
  if (!(checks ?? []).some((c: any) => c.source === 'NAOB' && c.found === true)) {
    return { ...base, status: 'not_confirmed_by_naob' };
  }

  let liveLookups = 0;
  const decision = await decideSplit(lexeme.lemma, lexeme.pos, {
    headInfo: async (heads, pos) => {
      const { data, error } = await supabase.from('lexeme_form_display_v2')
        .select('lexeme_id, lemma, form_key, primary_values, alternative_values')
        .in('lemma', heads).eq('pos', pos).eq('dictionary_code', 'bm');
      if (error) throw new Error(`HEAD_FORMS_LOAD_FAILED:${error.message}`);
      const byHead = new Map<string, Map<string, string[]>>();
      for (const row of (data ?? []) as any[]) {
        const head = String(row.lemma).toLowerCase();
        const cards = byHead.get(head) ?? new Map<string, string[]>();
        const sig = cards.get(row.lexeme_id) ?? [];
        sig.push(`${row.form_key}=${(row.primary_values ?? []).join(',')}|${(row.alternative_values ?? []).join(',')}`);
        cards.set(row.lexeme_id, sig);
        byHead.set(head, cards);
      }
      const out = new Map<string, HeadInfo>();
      for (const [head, cards] of byHead) {
        const sigs = new Set([...cards.values()].map((s) => s.sort().join(';')));
        out.set(head, { lexemeIds: [...cards.keys()].sort(), formsAgree: sigs.size === 1 });
      }
      return out;
    },
    isHeadword: async (word) => {
      // our base first: a card whose Ordbøkene check found the word
      const { data, error } = await supabase.from('lexemes').select('id').ilike('lemma', word).limit(20);
      if (error) throw new Error(`PREFIX_LOAD_FAILED:${error.message}`);
      const ids = ((data ?? []) as any[]).map((r) => r.id);
      if (ids.length) {
        const { data: found, error: foundError } = await supabase.from('lexeme_source_checks')
          .select('lexeme_id').in('lexeme_id', ids).eq('source', 'Ordbokene').eq('found', true).limit(1);
        if (foundError) throw new Error(`PREFIX_CHECK_LOAD_FAILED:${foundError.message}`);
        if ((found ?? []).length > 0) return true;
      }
      if (liveLookups >= MAX_LIVE_LOOKUPS) throw new Error('PREFIX_LOOKUP_LIMIT');
      liveLookups += 1;
      return await ordbokeneHasHeadword(word, fetchImpl);
    },
  });

  if (decision.status === 'no_split') return { ...base, status: 'no_split', detail: decision.reason };
  if (decision.status === 'ambiguous') {
    const { error } = await supabase.rpc('d10_record_compound_review_v1', {
      p_lexeme_id: lexeme.id, p_reason: decision.reason, p_candidates: decision.candidates,
    });
    if (error) throw new Error(`REVIEW_WRITE_FAILED:${error.message}`);
    return { ...base, status: 'review', detail: decision };
  }

  const evidence = {
    rule: 'd10_dictionary_split_v1', head: decision.head, head_lexeme_ids: decision.headLexemeIds,
    checked_first_parts: decision.checkedBases, confirmed_by: 'NAOB',
    excerpt: `${decision.parts[0]}${decision.links[0] ? '+' + decision.links[0] : ''}+${decision.parts[1]}`,
  };
  const { data: written, error: writeError } = await supabase.rpc('d10_write_compound_analysis_v1', {
    p_lexeme_id: lexeme.id, p_parts: decision.parts, p_links: decision.links,
    p_source: 'dictionary_split', p_confidence: 0.6, p_evidence: evidence,
  });
  if (writeError) throw new Error(`ANALYSIS_WRITE_FAILED:${writeError.message}`);

  const { data: rows, error: publishError } = await supabase.rpc('d10_publish_compound_head_forms_v1', {
    p_lexeme_id: lexeme.id, p_head_lexeme_ids: decision.headLexemeIds, p_evidence: evidence,
  });
  if (publishError) {
    // e.g. an existing NAOB split with another head: the analysis stays,
    // no forms by this head.
    return { ...base, status: 'split_without_forms', detail: { analysis: written, error: publishError.message } };
  }
  return { ...base, status: 'split_with_forms', detail: { analysis: written, rows, parts: decision.parts } };
}

if (import.meta.main) {
  Deno.serve(async (request: Request) => {
    if (request.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!hasInternalSecretApiKey(request.headers.get('apikey'), Deno.env.get('SUPABASE_SECRET_KEYS')) &&
        !hasInternalServiceAuthorization(request.headers.get('authorization'), serviceRoleKey)) {
      return json({ ok: false, error: 'INTERNAL_SERVICE_AUTH_REQUIRED' }, 403);
    }
    try {
      const body = await request.json().catch(() => ({}));
      const ids = Array.isArray(body?.lexemeIds)
        ? [...new Set(body.lexemeIds.filter((id: unknown) => typeof id === 'string'))].slice(0, MAX_LEXEMES) as string[]
        : [];
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (!ids.length) return json({ ok: true, worker: WORKER_NAME, processed: 0, results: [] });
      const { data: lexemes, error } = await supabase.from('lexemes').select('id, lemma, pos').in('id', ids);
      if (error) return json({ ok: false, worker: WORKER_NAME, error: error.message }, 500);
      const results: LexemeResult[] = [];
      for (const lexeme of (lexemes ?? []) as any[]) {
        try {
          results.push(await processLexeme(supabase, lexeme));
        } catch (e) {
          results.push({ lexemeId: lexeme.id, lemma: lexeme.lemma, status: 'error',
            detail: e instanceof Error ? e.message : String(e) });
        }
      }
      return json({ ok: results.every((r) => r.status !== 'error'), worker: WORKER_NAME,
        processed: results.length, results });
    } catch (e) {
      return json({ ok: false, worker: WORKER_NAME, error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
