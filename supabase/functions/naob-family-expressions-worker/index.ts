// supabase/functions/naob-family-expressions-worker/index.ts
// D10 07.11.2026 (agreed, D10_naob_family_v1): family 360 of a verb from NAOB.
// Called by job-orchestrator at the start of the job (dictionary step), once per verb:
//   1. NAOB search -> the articles "verb" with exactly this headword (fare -> the verb, not
//      the noun fare_2; the same rule as naob-forms-worker);
//   2. each article into naob_article_cache (if missing);
//   3. naob-synonym-extractor -> naob_expression_glosses (the expressions of the article);
//   4. d10_naob_family_bind_v1 -> new expressions into the catalog + bindings to the verb.
// Body: { lexeme_id: string, lemma: string }
// Answer: { ok, status, slugs, bind } ; ok=false only for a retryable failure.
// D10_naob_family_v2 (07.11.2026): when the search page gives no verb entry (gripe:
// one hit, NAOB shows the article instead of a list), the articles lemma, lemma_1 ...
// lemma_4 are checked directly: headword = lemma and part of speech "verb".
// D10_naob_reference_v1 (09.11.2026): an expression NAOB only refers elsewhere ("se vask") -> the referenced
// article is cached and extracted too, so the bind takes its direct definition. At most REF_FETCHES_PER_CALL
// articles are fetched from NAOB per call; while some remain the answer is status 'partial' (the step comes back).
// D10_naob_reference_v2 (10.11.2026): gå took 62 min and ended with a statement timeout. Every partial pass
// re-extracted the verb's own (huge) articles and every referenced article again, and a reference to an article
// NAOB does not have was tried on every pass. Now naob_extraction_log_v1 records what is done: the verb's
// articles are not re-extracted within 24 h (the passes of one job), a referenced article (or a missing one)
// is not processed again within 30 days, and a pass stops taking new work after REF_BUDGET_MS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  hasInternalSecretApiKey,
  hasInternalServiceAuthorization,
} from '../_shared/authoritative-morphology-v2/internal-authorization.ts';
import { normalizeWord, parseNaobArticle, parseNaobSearch } from '../_shared/d10-naob-forms.ts';

const NAOB = 'https://naob.no';
const FETCH_TIMEOUT_MS = 8_000;
const EXTRACTOR_TIMEOUT_MS = 15_000;
const MAX_ARTICLES = 4;
const REF_FETCHES_PER_CALL = 6;
const REF_BUDGET_MS = 18_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'nb,no;q=0.9' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`NAOB_HTTP_${response.status}:${url}`);
  return await response.text();
}

function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

// The article HTML from naob_article_cache, or fetched from NAOB and cached.
// null = NAOB has no such article (404).
async function articleHtml(supabase: ReturnType<typeof createClient>, slug: string): Promise<string | null> {
  const key = slug.toLowerCase();
  const { data: cached, error: cacheError } = await supabase
    .from('naob_article_cache').select('html').eq('normalized_key', key).maybeSingle();
  if (cacheError) throw new Error(`CACHE_LOOKUP_FAILED:${cacheError.message}`);
  if (cached?.html) return String(cached.html);
  const url = `${NAOB}/ordbok/${encodeURIComponent(slug)}`;
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'nb,no;q=0.9' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`NAOB_HTTP_${response.status}:${url}`);
  const html = await response.text();
  if (parseNaobArticle(html).status === 'no_article') return null;
  const now = new Date().toISOString();
  const { error: saveError } = await supabase.from('naob_article_cache').upsert(
    { lemma: key, normalized_key: key, url, html, fetched_at: now, updated_at: now },
    { onConflict: 'normalized_key' },
  );
  if (saveError) throw new Error(`CACHE_SAVE_FAILED:${saveError.message}`);
  return html;
}

// D10_naob_reference_v2: what was already extracted (or found missing) within the last `hours`.
async function extractionLog(supabase: ReturnType<typeof createClient>, kind: string, slugs: string[],
  hours: number): Promise<Set<string>> {
  if (!slugs.length) return new Set();
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await supabase.from('naob_extraction_log_v1').select('slug')
    .eq('kind', kind).in('slug', slugs).gte('checked_at', since);
  if (error) throw new Error(`EXTRACTION_LOG_READ_FAILED:${error.message}`);
  return new Set((data ?? []).map((r: { slug: string }) => r.slug));
}

async function logExtraction(supabase: ReturnType<typeof createClient>, kind: string, slug: string,
  status: 'extracted' | 'missing'): Promise<void> {
  const { error } = await supabase.from('naob_extraction_log_v1').upsert(
    { kind, slug, status, checked_at: new Date().toISOString() }, { onConflict: 'kind,slug' });
  if (error) throw new Error(`EXTRACTION_LOG_SAVE_FAILED:${error.message}`);
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!hasInternalSecretApiKey(request.headers.get('apikey'), Deno.env.get('SUPABASE_SECRET_KEYS')) &&
      !hasInternalServiceAuthorization(request.headers.get('authorization'), serviceRoleKey)) {
    return json({ ok: false, error: 'INTERNAL_SERVICE_AUTH_REQUIRED' }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const lexemeId = typeof body?.lexeme_id === 'string' ? body.lexeme_id : '';
  const lemma = normalizeWord(typeof body?.lemma === 'string' ? body.lemma : '');
  if (!/^[0-9a-f-]{36}$/i.test(lexemeId) || !lemma) {
    return json({ ok: false, error: 'LEXEME_ID_AND_LEMMA_REQUIRED' }, 400);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. verb articles of this headword
    const searchHtml = await fetchText(`${NAOB}/s%C3%B8k?q=${encodeURIComponent(lemma)}`);
    const listing = parseNaobSearch(searchHtml);
    let slugs = listing.entries
      .filter((e) => e.headword === lemma && e.pos.startsWith('verb'))
      .map((e) => decodeSlug(e.slug))
      .slice(0, MAX_ARTICLES);
    let found = 'search';
    if (!slugs.length) {
      found = 'direct';
      slugs = [];
      for (const slug of [lemma, `${lemma}_1`, `${lemma}_2`, `${lemma}_3`, `${lemma}_4`]) {
        const html = await articleHtml(supabase, slug);
        if (!html) continue;
        const article = parseNaobArticle(html);
        if (article.headword === lemma && (article.pos ?? '').startsWith('verb')) slugs.push(slug);
        if (slugs.length >= MAX_ARTICLES) break;
      }
    }
    if (!slugs.length) {
      return json({ ok: true, status: 'no_naob_verb_article', slugs: [],
        search_entries: listing.entries.slice(0, 10) });
    }

    // 2 + 3. cache + expressions of every article (not again within 24 h: the passes of one job)
    const rootLog = await extractionLog(supabase, 'root', slugs.map((s) => s.toLowerCase()), 24);
    for (const slug of slugs) {
      const key = slug.toLowerCase();
      if (rootLog.has(key)) continue;
      if (!(await articleHtml(supabase, slug))) throw new Error(`NAOB_ARTICLE_MISSING:${slug}`);
      const extractor = await fetch(`${supabaseUrl}/functions/v1/naob-synonym-extractor`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ naob_slug: key, dry_run: false }),
        signal: AbortSignal.timeout(EXTRACTOR_TIMEOUT_MS),
      });
      const extracted = await extractor.json().catch(() => null);
      if (!extractor.ok || extracted?.ok === false) {
        throw new Error(`EXTRACTOR_FAILED:${extractor.status}:${JSON.stringify(extracted).slice(0, 300)}`);
      }
      await logExtraction(supabase, 'root', key, 'extracted');
    }

    // 3b. referenced articles ("se vask" -> vask): cached + extracted, a few per call
    const started = Date.now();
    const keys = slugs.map((s) => s.toLowerCase());
    const { data: refs, error: refsError } = await supabase.from('naob_expression_glosses')
      .select('expression_lemma, gloss_text').in('naob_slug', keys).eq('gloss_type', 'reference');
    if (refsError) throw new Error(`REFS_LOAD_FAILED:${refsError.message}`);
    const targets = new Set<string>();
    for (const r of refs ?? []) {
      const expr = normalizeWord(String(r.expression_lemma ?? ''));
      if (!expr.startsWith(lemma + ' ')) continue;
      const m = String(r.gloss_text ?? '').match(/^\s*se\s+([^,;()]+)/i);
      if (!m) continue;
      const words = m[1].trim().toLowerCase().split(/\s+/).filter((w) => /^[a-zæøåé-]+$/.test(w));
      const target = words[words.length - 1];
      if (target && target !== lemma && target.length > 1) targets.add(target);
    }
    let fetched = 0;
    let remaining = 0;
    let extracted = 0;
    let skipped = 0;
    // one query for all targets: referenced articles processed (or missing) within 30 days are skipped
    const refLog = await extractionLog(supabase, 'reference', [...targets], 24 * 30);
    for (const target of targets) {
      if (refLog.has(target)) { skipped++; continue; }
      if (Date.now() - started > REF_BUDGET_MS) { remaining++; continue; }
      const candidates = [target, `${target}_1`, `${target}_2`, `${target}_3`];
      const { data: cachedRows, error: cachedError } = await supabase.from('naob_article_cache')
        .select('normalized_key').in('normalized_key', candidates);
      if (cachedError) throw new Error(`CACHE_LOOKUP_FAILED:${cachedError.message}`);
      const needsFetch = (cachedRows ?? []).length === 0;
      if (needsFetch && fetched >= REF_FETCHES_PER_CALL) {
        remaining++;
        continue;
      }
      let complete = true;
      let found = 0;
      for (const slug of candidates) {
        const html = await articleHtml(supabase, slug);
        if (!html) {
          if (slug !== target) break; // target_1 missing -> no more homographs
          continue;
        }
        found++;
        const ex = await fetch(`${supabaseUrl}/functions/v1/naob-synonym-extractor`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ naob_slug: slug, dry_run: false }),
          signal: AbortSignal.timeout(EXTRACTOR_TIMEOUT_MS),
        });
        if (ex.ok) extracted++; else complete = false;
      }
      if (needsFetch) fetched++;
      // a failed extraction is tried again on a later pass; done or missing is remembered
      if (complete) await logExtraction(supabase, 'reference', target, found ? 'extracted' : 'missing');
    }

    // 4. catalog + bindings
    const { data: bind, error: bindError } = await supabase.rpc('d10_naob_family_bind_v1', {
      p_root_lexeme_id: lexemeId,
      p_slugs: slugs.map((s) => s.toLowerCase()),
    });
    if (bindError) throw new Error(`BIND_FAILED:${bindError.message}`);
    return json({ ok: true, status: remaining > 0 ? 'partial' : 'bound', found, slugs, bind,
      references: { targets: targets.size, fetched, extracted, skipped, remaining } });
  } catch (error) {
    return json({ ok: false, status: 'retry', error: error instanceof Error ? error.message : String(error) }, 200);
  }
});
