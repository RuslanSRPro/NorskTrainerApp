// naob-forms-worker (D10 16.10.2026, agreed: "если нет форм в Ordbøkene то
// смотреть в НАОБ")
//
// For a NOUN card that has no Ordbøkene forms (no rows in
// lexeme_form_display_v2) and no forms built from a compound head:
//   1. NAOB search page of the lemma -> articles of the part of speech
//      "substantiv" with exactly this headword;
//   2. each article page -> the forms NAOB lists in "BØYNING"
//      (_shared/d10-naob-forms.ts);
//   3. all articles with forms give the same forms -> d10_publish_naob_forms_v1
//      (separate table lexeme_naob_forms_v1; lexeme_form_display_v2 is not
//      touched). Different forms -> d10_record_naob_forms_review_v1, nothing
//      written.
// Called by job-enrichment-batch-worker after the compound step. Its result
// never fails the forms chain. A NAOB outage throws for that word only: it is
// then not decided now, never decided wrongly.
//
// Body: { lexemeIds: string[] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  hasInternalSecretApiKey,
  hasInternalServiceAuthorization,
} from '../_shared/authoritative-morphology-v2/internal-authorization.ts';
import {
  decideNaobForms,
  normalizeWord,
  parseNaobArticle,
  parseNaobSearch,
  type NaobArticle,
} from '../_shared/d10-naob-forms.ts';

const WORKER_NAME = 'naob-forms-worker';
const MAX_LEXEMES = 25;
const MAX_ARTICLES = 4;
const FETCH_TIMEOUT_MS = 8_000;
const TIME_BUDGET_MS = 40_000;
const ALLOWED_POS = new Set(['noun']);
const NAOB = 'https://naob.no';

type Supa = ReturnType<typeof createClient>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type LexemeResult = {
  lexemeId: string;
  lemma?: string;
  status: string;
  detail?: unknown;
};

export async function fetchNaobPage(url: string, fetchImpl: FetchLike = fetch): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NAOB returned HTTP ${response.status} for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const { count: headRows, error: headError } = await supabase
    .from('lexeme_compound_head_forms_v1').select('form_key', { count: 'exact', head: true })
    .eq('lexeme_id', lexeme.id);
  if (headError) throw new Error(`COMPOUND_FORMS_LOAD_FAILED:${headError.message}`);
  if ((headRows ?? 0) > 0) return { ...base, status: 'compound_forms' };

  const lemma = normalizeWord(lexeme.lemma);
  if (!lemma || /\s/.test(lemma)) return { ...base, status: 'not_single_word' };

  const searchUrl = `${NAOB}/s%C3%B8k?q=${encodeURIComponent(lemma)}`;
  const listing = parseNaobSearch(await fetchNaobPage(searchUrl, fetchImpl));
  const slugs = listing.entries
    .filter((e) => e.headword === lemma && e.pos === 'substantiv')
    .map((e) => e.slug);
  if (!slugs.length) return { ...base, status: 'no_naob_article_of_pos' };
  if (listing.total !== null && listing.shown !== null && listing.total > listing.shown) {
    return await review(supabase, base, 'naob_listing_incomplete', { searchUrl, shown: listing.shown, total: listing.total });
  }
  if (slugs.length > MAX_ARTICLES) {
    return await review(supabase, base, 'naob_too_many_articles', { searchUrl, slugs });
  }

  const parsed: Array<{ slug: string; article: NaobArticle }> = [];
  for (const slug of slugs) {
    await pause(150);
    parsed.push({ slug, article: parseNaobArticle(await fetchNaobPage(`${NAOB}/ordbok/${slug}`, fetchImpl)) });
  }

  const decision = decideNaobForms(lemma, parsed);
  if (decision.status === 'no_forms') return { ...base, status: 'naob_no_forms', detail: { ignored: decision.ignored } };
  if (decision.status === 'review') return await review(supabase, base, decision.reason, decision.detail);

  const evidence = {
    rule: 'd10_naob_boeyning_v1',
    search_url: searchUrl,
    article_urls: decision.used.map((s) => `${NAOB}/ordbok/${s}`),
    naob_slugs: decision.used,
    ignored_slugs: decision.ignored,
    genus: decision.genus,
  };
  const { data: rows, error: publishError } = await supabase.rpc('d10_publish_naob_forms_v1', {
    p_lexeme_id: lexeme.id,
    p_forms: decision.forms.map((f) => ({ ...f, accepted_articles: decision.articles })),
    p_evidence: evidence,
  });
  if (publishError) {
    return { ...base, status: 'publish_refused', detail: publishError.message };
  }
  return { ...base, status: 'naob_forms', detail: { rows, slugs: decision.used } };
}

async function review(supabase: Supa, base: { lexemeId: string; lemma?: string }, reason: string, detail: unknown): Promise<LexemeResult> {
  const { error } = await supabase.rpc('d10_record_naob_forms_review_v1', {
    p_lexeme_id: base.lexemeId, p_reason: reason, p_detail: detail ?? {},
  });
  if (error) throw new Error(`REVIEW_WRITE_FAILED:${error.message}`);
  return { ...base, status: 'review', detail: { reason, detail } };
}

export async function processAll(
  supabase: Supa,
  lexemes: Array<{ id: string; lemma: string; pos: string }>,
  fetchImpl: FetchLike = fetch,
  now: () => number = Date.now,
): Promise<LexemeResult[]> {
  const started = now();
  const results: LexemeResult[] = [];
  for (const lexeme of lexemes) {
    if (now() - started > TIME_BUDGET_MS) {
      results.push({ lexemeId: lexeme.id, lemma: lexeme.lemma, status: 'deferred' });
      continue;
    }
    try {
      results.push(await processLexeme(supabase, lexeme, fetchImpl));
    } catch (e) {
      results.push({ lexemeId: lexeme.id, lemma: lexeme.lemma, status: 'error',
        detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
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
      const results = await processAll(supabase, (lexemes ?? []) as any[]);
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
