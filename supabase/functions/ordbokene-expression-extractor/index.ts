import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function renderContent(node: any): string | null {
  const content = node?.content;

  if (typeof content !== 'string') return null;

  const items = Array.isArray(node.items) ? [...node.items] : [];

  return content
    .replace(/\$/g, () => {
      const item = items.shift();

      if (!item) return '$';

      if (item.type_ === 'usage') {
        return item.text ?? '$';
      }

      if (item.type_ === 'entity') {
        return item.text ?? `[${item.id}]`;
      }

      if (item.type_ === 'article_ref') {
        return item.lemmas?.[0]?.lemma ?? '$';
      }

      return item.text ?? item.id ?? '$';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyCandidate(lemma: string): string {
  const value = lemma.trim().toLowerCase();

  if (value.endsWith('?')) return 'question_phrase';
  if (value.endsWith('!')) return 'exclamation_phrase';

  const tokens = value.split(/\s+/);

  if (
    tokens.some((t) =>
      [
        'jeg',
        'du',
        'han',
        'hun',
        'vi',
        'dere',
        'de',
        'det',
        'den',
        'noe',
        'hva',
      ].includes(t),
    )
  ) {
    return 'sentence_phrase';
  }

  return 'expression';
}

function collectSubArticles(node: unknown, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;

  if (Array.isArray(node)) {
    for (const item of node) collectSubArticles(item, out);
    return out;
  }

  const obj = node as Record<string, unknown>;

  if (obj.type_ === 'sub_article') {
    out.push(obj);
  }

  for (const value of Object.values(obj)) {
    collectSubArticles(value, out);
  }

  return out;
}

function collectExamples(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;

  if (Array.isArray(node)) {
    for (const item of node) collectExamples(item, out);
    return out;
  }

  const obj = node as any;

  if (obj.type_ === 'example' && obj.quote) {
    const rendered = renderContent(obj.quote);
    if (rendered) out.push(rendered);
  }

  for (const value of Object.values(obj)) {
    collectExamples(value, out);
  }

  return out;
}

function collectFirstExplanation(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = collectFirstExplanation(item);
      if (found) return found;
    }
    return null;
  }

  const obj = node as any;

  if (obj.type_ === 'explanation') {
    const rendered = renderContent(obj);
    if (rendered) return rendered;
  }

  for (const value of Object.values(obj)) {
    const found = collectFirstExplanation(value);
    if (found) return found;
  }

  return null;
}

function getSubArticleLemma(subArticle: any): string | null {
  return (
    subArticle?.article?.lemmas?.[0]?.lemma ??
    subArticle?.lemmas?.[0] ??
    null
  );
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));

    const articleId = Number(body.article_id);
    const dictionaryCode = String(body.dictionary_code ?? 'bm');

    if (!Number.isFinite(articleId) || articleId <= 0) {
      return jsonResponse(
        {
          ok: false,
          error: 'article_id is required',
        },
        400,
      );
    }

    if (!['bm', 'nn'].includes(dictionaryCode)) {
      return jsonResponse(
        {
          ok: false,
          error: 'dictionary_code must be bm or nn',
        },
        400,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          ok: false,
          error: 'Missing Supabase env vars',
        },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: cachedArticle, error: cacheError } = await supabase
      .from('ordbokene_article_cache')
      .select('article_id, dictionary_code, lemma, payload')
      .eq('article_id', articleId)
      .eq('dictionary_code', dictionaryCode)
      .maybeSingle();

    if (cacheError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_article_cache',
          error: cacheError.message,
          details: cacheError,
        },
        500,
      );
    }

    if (!cachedArticle?.payload) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_article_cache',
          error: 'article payload not found in cache',
          article_id: articleId,
          dictionary_code: dictionaryCode,
        },
        404,
      );
    }

    const payload = cachedArticle.payload;

    const parentLemma =
      cachedArticle.lemma ??
      payload?.lemmas?.[0]?.lemma ??
      payload?.lemmas?.[0]?.final_lexeme ??
      null;

    const subArticles = collectSubArticles(payload);

    const results = [];
    const skipped = [];

    for (const sub of subArticles) {
      const candidateArticleId = Number(
        sub.article_id ?? sub.article?.article_id,
      );

      const lemma = getSubArticleLemma(sub);
      const candidateDictionaryCode = sub.article?.dict_id ?? dictionaryCode;

      if (
        !Number.isFinite(candidateArticleId) ||
        !lemma ||
        typeof lemma !== 'string'
      ) {
        skipped.push({
          reason: 'missing candidate article_id or lemma',
        });
        continue;
      }

      const definitionPreview =
        collectFirstExplanation(sub.article?.body) ??
        collectFirstExplanation(sub) ??
        null;

      const examples = collectExamples(sub.article?.body).slice(0, 10);

      const normalizedKey = normalizeKey(lemma);
      const candidateKind = classifyCandidate(lemma);

      const { error: saveError } = await supabase.rpc(
        'save_ordbokene_expression_candidate',
        {
          p_parent_article_id: articleId,
          p_parent_dictionary_code: dictionaryCode,
          p_parent_lemma: parentLemma,

          p_candidate_article_id: candidateArticleId,
          p_candidate_dictionary_code: candidateDictionaryCode,

          p_lemma: lemma,
          p_normalized_key: normalizedKey,

          p_word_class: sub.article?.word_class ?? null,
          p_article_type: sub.article?.article_type ?? null,

          p_definition_preview: definitionPreview,
          p_examples: examples,
          p_payload: sub,
          p_candidate_kind: candidateKind,
        },
      );

      if (saveError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'save_candidate',
            candidate_article_id: candidateArticleId,
            lemma,
            error: saveError.message,
            details: saveError,
          },
          500,
        );
      }

      results.push({
        candidate_article_id: candidateArticleId,
        lemma,
        normalized_key: normalizedKey,
        candidate_kind: candidateKind,
        word_class: sub.article?.word_class ?? null,
        article_type: sub.article?.article_type ?? null,
        definition_preview: definitionPreview,
        examples,
      });
    }

    return jsonResponse({
      ok: true,
      parent_article_id: articleId,
      parent_dictionary_code: dictionaryCode,
      parent_lemma: parentLemma,
      found: subArticles.length,
      saved: results.length,
      skipped: skipped.length,
      results,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        stage: 'unhandled_exception',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      },
      500,
    );
  }
});