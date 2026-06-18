import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JsonRecord = Record<string, unknown>;

type WorkerInput = {
  article_id?: number | string;
  dictionary_code?: string;
  dry_run?: boolean;
};

type ArticleRefCandidate = {
  source_article_id: number;
  source_dictionary_code: string;
  source_lemma: string | null;
  target_article_id: number | null;
  target_lemma: string;
  definition_id: string | number | null;
  definition_order: string | number | null;
  raw_article_ref: JsonRecord;
};

type ResolvedTarget = {
  target_entity_type: 'lexeme' | 'expression' | null;
  target_entity_id: string | null;
};

const ORDBOKENE_SOURCE = 'Ordbokene';
const RELATION_TYPE = 'related_candidate';
const CONFIDENCE = 'high';
const STATUS = 'candidate';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ');
}

function firstLemmaFromArticleRef(articleRef: JsonRecord): string | null {
  const lemmas = articleRef.lemmas;
  if (!Array.isArray(lemmas)) return null;

  for (const lemmaNode of lemmas) {
    if (!isRecord(lemmaNode)) continue;

    const lemma = lemmaNode.lemma;
    if (typeof lemma === 'string' && lemma.trim()) {
      return normalizeKey(lemma);
    }
  }

  return null;
}

function extractArticleId(articleRef: JsonRecord): number | null {
  const raw = articleRef.article_id;

  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function collectArticleRefs(
  value: unknown,
  result: JsonRecord[] = [],
): JsonRecord[] {
  if (Array.isArray(value)) {
    for (const item of value) collectArticleRefs(item, result);
    return result;
  }

  if (!isRecord(value)) return result;

  if (value.type_ === 'article_ref') {
    result.push(value);
  }

  for (const nested of Object.values(value)) {
    if (typeof nested === 'object' && nested !== null) {
      collectArticleRefs(nested, result);
    }
  }

  return result;
}

function distinctArticleRefs(args: {
  payload: unknown;
  source_article_id: number;
  source_dictionary_code: string;
  source_lemma: string | null;
}): ArticleRefCandidate[] {
  const refs = collectArticleRefs(args.payload);
  const seen = new Set<string>();
  const candidates: ArticleRefCandidate[] = [];

  for (const ref of refs) {
    const targetArticleId = extractArticleId(ref);
    const targetLemma = firstLemmaFromArticleRef(ref);

    if (!targetLemma) continue;

    const definitionId = (ref.definition_id ?? null) as string | number | null;
    const definitionOrder = (ref.definition_order ?? null) as
      | string
      | number
      | null;

    // Important:
    // authoritative_semantic_relations conflict key uses target_text,
    // so we deduplicate by target lemma, not by definition id.
    const key = JSON.stringify({
      targetLemma: normalizeKey(targetLemma),
      targetArticleId,
    });

    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      source_article_id: args.source_article_id,
      source_dictionary_code: args.source_dictionary_code,
      source_lemma: args.source_lemma,
      target_article_id: targetArticleId,
      target_lemma: normalizeKey(targetLemma),
      definition_id: definitionId,
      definition_order: definitionOrder,
      raw_article_ref: ref,
    });
  }

  return candidates;
}

function ordbokeneArticleUrl(
  dictionaryCode: string,
  articleId: number | null,
): string | null {
  if (!articleId) return null;
  return `https://ord.uib.no/${dictionaryCode}/article/${articleId}.json`;
}

async function resolveParentLexeme(
  supabase: ReturnType<typeof createClient>,
  lemma: string | null,
) {
  if (!lemma) {
    return {
      data: null,
      error: new Error('Article cache row has no lemma'),
    };
  }

  return await supabase
    .from('lexemes')
    .select('id, lemma, pos')
    .eq('lemma', normalizeKey(lemma))
    .limit(1)
    .maybeSingle();
}

async function resolveTarget(
  supabase: ReturnType<typeof createClient>,
  targetLemma: string,
): Promise<ResolvedTarget> {
  const normalized = normalizeKey(targetLemma);

  const lexemeResult = await supabase
    .from('lexemes')
    .select('id')
    .eq('lemma', normalized)
    .limit(1)
    .maybeSingle();

  if (lexemeResult.error) throw lexemeResult.error;

  if (lexemeResult.data?.id) {
    return {
      target_entity_type: 'lexeme',
      target_entity_id: lexemeResult.data.id,
    };
  }

  const expressionByKeyResult = await supabase
    .from('expression_catalog')
    .select('id')
    .eq('normalized_key', normalized)
    .limit(1)
    .maybeSingle();

  if (expressionByKeyResult.error) throw expressionByKeyResult.error;

  if (expressionByKeyResult.data?.id) {
    return {
      target_entity_type: 'expression',
      target_entity_id: expressionByKeyResult.data.id,
    };
  }

  const expressionByLemmaResult = await supabase
    .from('expression_catalog')
    .select('id')
    .eq('lemma', normalized)
    .limit(1)
    .maybeSingle();

  if (expressionByLemmaResult.error) throw expressionByLemmaResult.error;

  if (expressionByLemmaResult.data?.id) {
    return {
      target_entity_type: 'expression',
      target_entity_id: expressionByLemmaResult.data.id,
    };
  }

  return {
    target_entity_type: null,
    target_entity_id: null,
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return jsonResponse({ ok: true });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Use POST' }, 405);
    }

    const input = (await req.json().catch(() => ({}))) as WorkerInput;

    const articleId = Number(input.article_id);
    const dictionaryCode = String(input.dictionary_code ?? '').trim();
    const dryRun = input.dry_run !== false;

    if (!Number.isFinite(articleId) || articleId <= 0) {
      return jsonResponse({ ok: false, error: 'article_id is required' }, 400);
    }

    if (!dictionaryCode) {
      return jsonResponse(
        { ok: false, error: 'dictionary_code is required' },
        400,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          ok: false,
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: article, error: articleError } = await supabase
      .from('ordbokene_article_cache')
      .select('article_id, dictionary_code, lemma, word_class, payload')
      .eq('article_id', articleId)
      .eq('dictionary_code', dictionaryCode)
      .maybeSingle();

    if (articleError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_article_cache',
          error: safeStringify(articleError),
          details: articleError,
        },
        500,
      );
    }

    if (!article) {
      return jsonResponse(
        {
          ok: false,
          error: 'Article not found in ordbokene_article_cache',
          article_id: articleId,
          dictionary_code: dictionaryCode,
        },
        404,
      );
    }

    const sourceLemma =
      typeof article.lemma === 'string' ? normalizeKey(article.lemma) : null;

    const parentResult = await resolveParentLexeme(supabase, sourceLemma);

    if (parentResult.error) {
      return jsonResponse(
        {
          ok: false,
          stage: 'resolve_parent_lexeme',
          error: 'Could not resolve parent lexeme from article cache lemma',
          lemma: sourceLemma,
          details: safeStringify(parentResult.error),
        },
        400,
      );
    }

    if (!parentResult.data?.id) {
      return jsonResponse(
        {
          ok: false,
          stage: 'resolve_parent_lexeme',
          error: 'Parent lexeme not found in lexemes',
          lemma: sourceLemma,
        },
        404,
      );
    }

    const parentLexeme = parentResult.data;

    const candidates = distinctArticleRefs({
      payload: article.payload,
      source_article_id: articleId,
      source_dictionary_code: dictionaryCode,
      source_lemma: sourceLemma,
    });

    const relations = [];
    const skipped = [];

    for (const candidate of candidates) {
      try {
        const resolved = await resolveTarget(supabase, candidate.target_lemma);

        const sourceUrl = ordbokeneArticleUrl(dictionaryCode, articleId);
        const targetUrl = ordbokeneArticleUrl(
          dictionaryCode,
          candidate.target_article_id,
        );

        relations.push({
          source_entity_type: 'lexeme',
          source_entity_id: parentLexeme.id,
          relation_type: RELATION_TYPE,
          target_text: candidate.target_lemma,
          target_entity_type: resolved.target_entity_type,
          target_entity_id: resolved.target_entity_id,
          source: ORDBOKENE_SOURCE,
          confidence: CONFIDENCE,
          status: STATUS,
          evidence: {
            evidence_type: 'ordbokene_article_ref',
            source_article_id: candidate.source_article_id,
            source_dictionary_code: candidate.source_dictionary_code,
            source_lemma: candidate.source_lemma,
            target_article_id: candidate.target_article_id,
            target_lemma: candidate.target_lemma,
            definition_id: candidate.definition_id,
            definition_order: candidate.definition_order,
            raw_article_ref: candidate.raw_article_ref,
          },
          urls: [sourceUrl, targetUrl].filter(Boolean),
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        skipped.push({
          target_lemma: candidate.target_lemma,
          reason: safeStringify(error),
          candidate,
        });
      }
    }

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        article_id: articleId,
        dictionary_code: dictionaryCode,
        source_lemma: sourceLemma,
        source_entity_type: 'lexeme',
        source_entity_id: parentLexeme.id,
        processed: candidates.length,
        would_upsert: relations.length,
        skipped: skipped.length,
        relation_type: RELATION_TYPE,
        source: ORDBOKENE_SOURCE,
        confidence: CONFIDENCE,
        status: STATUS,
        relations,
        skipped_details: skipped,
      });
    }

    let upserted = 0;
    const upsertErrors = [];

    for (const relation of relations) {
      const { error: upsertError } = await supabase
        .from('authoritative_semantic_relations')
        .upsert(relation, {
          onConflict:
            'source_entity_type,source_entity_id,relation_type,target_text,source',
        });

      if (upsertError) {
        upsertErrors.push({
          target_text: relation.target_text,
          error: safeStringify(upsertError),
          details: upsertError,
        });
        continue;
      }

      upserted += 1;
    }

    if (upsertErrors.length > 0) {
      return jsonResponse(
        {
          ok: false,
          stage: 'upsert_relations',
          article_id: articleId,
          dictionary_code: dictionaryCode,
          source_lemma: sourceLemma,
          processed: candidates.length,
          attempted: relations.length,
          upserted,
          skipped: skipped.length,
          upsert_errors: upsertErrors,
          skipped_details: skipped,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      dry_run: false,
      article_id: articleId,
      dictionary_code: dictionaryCode,
      source_lemma: sourceLemma,
      source_entity_type: 'lexeme',
      source_entity_id: parentLexeme.id,
      processed: candidates.length,
      upserted,
      skipped: skipped.length,
      relation_type: RELATION_TYPE,
      source: ORDBOKENE_SOURCE,
      confidence: CONFIDENCE,
      status: STATUS,
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        stage: 'unhandled_exception',
        error: safeStringify(error),
        stack: error instanceof Error ? error.stack : null,
      },
      500,
    );
  }
});