// naob-forms-worker (D10 16.10.2026, agreed: "если нет форм в Ordbøkene то
// смотреть в НАОБ"; 24.10.2026: division by NAOB articles)
//
// Default mode (forms chain), for a NOUN card without Ordbøkene forms and
// without forms built from a compound head:
//   * the card is bound to a NAOB article (division, see below) -> the forms
//     of THAT article only;
//   * otherwise: NAOB search -> articles "substantiv" with this headword ->
//     forms if all articles with forms agree, else "for review".
//   Forms go to lexeme_naob_forms_v1 (d10_publish_naob_forms_v1);
//   lexeme_form_display_v2 is not touched.
//
// Mode "split" (job-orchestrator, before the enrichment chains), for the
// nouns of a job without an Ordbøkene article: the NAOB articles are
// divided with THE SAME rule as Ordbøkene homographs (decideHomographs):
//   lowest article -> the main card; own forms + own meaning -> own card
//   (II, III...), added to the job; same forms -> one card (R8); no own
//   forms / no own meaning / same meaning -> no card, "for review".
//
// A NAOB outage throws for that word only: not decided now, never wrongly.
//
// Body: { lexemeIds: string[] }  or  { mode: 'split', jobId: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  hasInternalSecretApiKey,
  hasInternalServiceAuthorization,
} from '../_shared/authoritative-morphology-v2/internal-authorization.ts';
import {
  decideNaobForms,
  inflectedFormCount,
  normalizeWord,
  parseNaobArticle,
  parseNaobSearch,
  planNaobHomographs,
  type NaobArticle,
} from '../_shared/d10-naob-forms.ts';

const WORKER_NAME = 'naob-forms-worker';
const MAX_LEXEMES = 25;
const MAX_ARTICLES = 4;
const FETCH_TIMEOUT_MS = 8_000;
const TIME_BUDGET_MS = 40_000;
// split mode runs inside the orchestrator call (45 s budget of the supervisor)
const SPLIT_LEXEMES_PER_CALL = 2;
const SPLIT_TIME_BUDGET_MS = 20_000;
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

async function hasOtherForms(supabase: Supa, lexemeId: string): Promise<string | null> {
  const { count: ownRows, error: ownError } = await supabase
    .from('lexeme_form_display_v2').select('form_key', { count: 'exact', head: true })
    .eq('lexeme_id', lexemeId);
  if (ownError) throw new Error(`OWN_FORMS_LOAD_FAILED:${ownError.message}`);
  if ((ownRows ?? 0) > 0) return 'own_forms';
  const { count: headRows, error: headError } = await supabase
    .from('lexeme_compound_head_forms_v1').select('form_key', { count: 'exact', head: true })
    .eq('lexeme_id', lexemeId);
  if (headError) throw new Error(`COMPOUND_FORMS_LOAD_FAILED:${headError.message}`);
  if ((headRows ?? 0) > 0) return 'compound_forms';
  return null;
}

type Loaded =
  | { status: 'ok'; searchUrl: string; parsed: Array<{ slug: string; article: NaobArticle }> }
  | { status: 'none'; searchUrl: string }
  | { status: 'review'; reason: string; detail: unknown };

// NAOB search + every article "substantiv" with exactly this headword.
async function loadNaobNounArticles(lemma: string, fetchImpl: FetchLike): Promise<Loaded> {
  const searchUrl = `${NAOB}/s%C3%B8k?q=${encodeURIComponent(lemma)}`;
  const listing = parseNaobSearch(await fetchNaobPage(searchUrl, fetchImpl));
  const slugs = listing.entries
    .filter((e) => e.headword === lemma && e.pos === 'substantiv')
    .map((e) => e.slug);
  if (!slugs.length) return { status: 'none', searchUrl };
  if (listing.total !== null && listing.shown !== null && listing.total > listing.shown) {
    return { status: 'review', reason: 'naob_listing_incomplete', detail: { searchUrl, shown: listing.shown, total: listing.total } };
  }
  if (slugs.length > MAX_ARTICLES) {
    return { status: 'review', reason: 'naob_too_many_articles', detail: { searchUrl, slugs } };
  }
  const parsed: Array<{ slug: string; article: NaobArticle }> = [];
  for (const slug of slugs) {
    await pause(150);
    parsed.push({ slug, article: parseNaobArticle(await fetchNaobPage(`${NAOB}/ordbok/${slug}`, fetchImpl)) });
  }
  return { status: 'ok', searchUrl, parsed };
}

async function publishArticleForms(supabase: Supa, lexemeId: string, slug: string, article: NaobArticle,
  extra: Record<string, unknown>): Promise<{ rows?: number; error?: string }> {
  if (article.status !== 'ok' || inflectedFormCount(article) === 0) return { error: 'NO_FORMS_IN_ARTICLE' };
  const { data, error } = await supabase.rpc('d10_publish_naob_forms_v1', {
    p_lexeme_id: lexemeId,
    p_forms: article.forms.map((f) => ({ ...f, accepted_articles: article.articles })),
    p_evidence: {
      rule: 'd10_naob_boeyning_v1', article_urls: [`${NAOB}/ordbok/${slug}`],
      naob_slugs: [slug], genus: article.genus, ...extra,
    },
  });
  if (error) return { error: error.message };
  return { rows: Number(data ?? 0) };
}

async function bindingOf(supabase: Supa, lexemeId: string): Promise<{ slug: string; definition: string | null } | null> {
  const { data, error } = await supabase.rpc('d10_naob_card_binding_v1', { p_lexeme_id: lexemeId });
  if (error) throw new Error(`NAOB_BINDING_LOAD_FAILED:${error.message}`);
  const row = Array.isArray(data) ? data[0] : null;
  return row?.slug ? { slug: String(row.slug), definition: row.definition ?? null } : null;
}

// --------------------------------------------------------------------------
// Default mode (forms chain)
// --------------------------------------------------------------------------
export async function processLexeme(
  supabase: Supa,
  lexeme: { id: string; lemma: string; pos: string },
  fetchImpl: FetchLike = fetch,
): Promise<LexemeResult> {
  const base = { lexemeId: lexeme.id, lemma: lexeme.lemma };
  if (!ALLOWED_POS.has(lexeme.pos)) return { ...base, status: 'pos_not_supported' };

  const other = await hasOtherForms(supabase, lexeme.id);
  if (other) return { ...base, status: other };

  const lemma = normalizeWord(lexeme.lemma);
  if (!lemma || /\s/.test(lemma)) return { ...base, status: 'not_single_word' };

  // D10 24.10.2026: a card bound to a NAOB article takes only its forms.
  const binding = await bindingOf(supabase, lexeme.id);
  if (binding) {
    const article = parseNaobArticle(await fetchNaobPage(`${NAOB}/ordbok/${binding.slug}`, fetchImpl));
    if (article.headword !== lemma || article.pos !== 'substantiv') {
      return { ...base, status: 'naob_bound_article_changed', detail: { slug: binding.slug } };
    }
    const published = await publishArticleForms(supabase, lexeme.id, binding.slug, article, { bound: true });
    if (published.error === 'NO_FORMS_IN_ARTICLE') return { ...base, status: 'naob_no_forms', detail: { slug: binding.slug } };
    if (published.error) return { ...base, status: 'publish_refused', detail: published.error };
    return { ...base, status: 'naob_forms', detail: { rows: published.rows, slugs: [binding.slug], bound: true } };
  }

  const loaded = await loadNaobNounArticles(lemma, fetchImpl);
  if (loaded.status === 'none') return { ...base, status: 'no_naob_article_of_pos' };
  if (loaded.status === 'review') return await review(supabase, base, loaded.reason, loaded.detail);
  const { searchUrl, parsed } = loaded;

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

// --------------------------------------------------------------------------
// Split mode (job-orchestrator)
// --------------------------------------------------------------------------
export async function processSplit(
  supabase: Supa,
  lexeme: { id: string; lemma: string; pos: string },
  jobId: string | null,
  fetchImpl: FetchLike = fetch,
): Promise<LexemeResult & { added: number }> {
  const base = { lexemeId: lexeme.id, lemma: lexeme.lemma, added: 0 };
  if (!ALLOWED_POS.has(lexeme.pos)) return { ...base, status: 'pos_not_supported' };
  const other = await hasOtherForms(supabase, lexeme.id);
  if (other) return { ...base, status: other };
  const lemma = normalizeWord(lexeme.lemma);
  if (!lemma || /\s/.test(lemma)) return { ...base, status: 'not_single_word' };

  const loaded = await loadNaobNounArticles(lemma, fetchImpl);
  if (loaded.status === 'none') return { ...base, status: 'no_naob_article_of_pos' };
  if (loaded.status === 'review') return { ...(await review(supabase, base, loaded.reason, loaded.detail)), added: 0 };

  const plan = planNaobHomographs(lemma, loaded.parsed);
  const outcome: Array<Record<string, unknown>> = [];
  let added = 0;
  let mainBound = false;
  for (const entry of plan) {
    const definition = entry.article?.definitions.join(' | ') ?? null;
    const { data: cardId, error } = await supabase.rpc('d10_record_naob_homograph_v1', {
      p_main_lexeme_id: lexeme.id, p_slug: entry.slug, p_decision: entry.decision, p_hgno: entry.hgno,
      p_definition: definition,
      p_evidence: { reason: entry.reason, forms: entry.forms, version: 'd10-naob-homographs/v1',
        search_url: loaded.searchUrl, ...(entry.review ? { review: true } : {}) },
      p_job_id: jobId,
    });
    if (error) {
      outcome.push({ slug: entry.slug, decision: entry.decision, error: error.message });
      continue;
    }
    const row: Record<string, unknown> = { slug: entry.slug, decision: entry.decision, reason: entry.reason };
    if ((entry.decision === 'main_article' || entry.decision === 'r9_card') && cardId && entry.article) {
      if (entry.decision === 'main_article') mainBound = true;
      const published = await publishArticleForms(supabase, String(cardId), entry.slug, entry.article,
        { division: entry.decision });
      row.forms = published.error ?? published.rows;
      if (entry.decision === 'r9_card' && jobId) {
        const { data: itemId, error: injectError } = await supabase.rpc('d10_inject_homograph_item_v1', {
          p_job_id: jobId, p_card_lexeme_id: cardId, p_main_lexeme_id: lexeme.id,
        });
        if (injectError) row.inject_error = injectError.message;
        else if (itemId) added += 1;
      }
      row.card = cardId;
    }
    outcome.push(row);
  }
  if (!mainBound && plan.length > 0) {
    // nothing could be bound (all held back): shown for review, no forms
    await review(supabase, base, 'naob_division_no_main_article', outcome);
  }
  return { ...base, added, status: mainBound ? 'naob_divided' : 'naob_division_review', detail: outcome };
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

// One orchestrator tick: up to SPLIT_LEXEMES_PER_CALL nouns of the job. A
// word is marked done for the job also after an error, so a broken page
// never blocks the job (it is retried by the next job / audit).
export async function processSplitJob(
  supabase: Supa,
  jobId: string,
  fetchImpl: FetchLike = fetch,
  now: () => number = Date.now,
): Promise<{ ok: boolean; added: number; has_more: boolean; results: LexemeResult[] }> {
  const { data, error } = await supabase.rpc('d10_naob_split_candidates_for_job_v1', {
    p_job_id: jobId, p_limit: SPLIT_LEXEMES_PER_CALL + 1,
  });
  if (error) throw new Error(`SPLIT_CANDIDATES_FAILED:${error.message}`);
  const list = ((Array.isArray(data) ? data : []) as Array<{ lexeme_id: string; lemma: string; pos: string }>);
  const started = now();
  const results: LexemeResult[] = [];
  let added = 0;
  let processed = 0;
  for (const row of list.slice(0, SPLIT_LEXEMES_PER_CALL)) {
    if (processed > 0 && now() - started > SPLIT_TIME_BUDGET_MS) break;
    const lexeme = { id: row.lexeme_id, lemma: row.lemma, pos: row.pos };
    let result: LexemeResult & { added?: number };
    try {
      result = await processSplit(supabase, lexeme, jobId, fetchImpl);
    } catch (e) {
      result = { lexemeId: lexeme.id, lemma: lexeme.lemma, status: 'error',
        detail: e instanceof Error ? e.message : String(e) };
    }
    added += Number(result.added ?? 0);
    processed += 1;
    results.push(result);
    const { error: markError } = await supabase.rpc('d10_mark_naob_split_done_v1', {
      p_job_id: jobId, p_lexeme_id: lexeme.id,
      p_result: { status: result.status, added: result.added ?? 0 },
    });
    if (markError) throw new Error(`SPLIT_MARK_FAILED:${markError.message}`);
  }
  return { ok: results.every((r) => r.status !== 'error'), added, has_more: list.length > processed, results };
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
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (body?.mode === 'split') {
        const jobId = typeof body?.jobId === 'string' ? body.jobId : '';
        if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ ok: false, worker: WORKER_NAME, error: 'JOB_ID_REQUIRED' }, 400);
        const out = await processSplitJob(supabase, jobId);
        return json({ worker: WORKER_NAME, mode: 'split', ...out });
      }
      const ids = Array.isArray(body?.lexemeIds)
        ? [...new Set(body.lexemeIds.filter((id: unknown) => typeof id === 'string'))].slice(0, MAX_LEXEMES) as string[]
        : [];
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
