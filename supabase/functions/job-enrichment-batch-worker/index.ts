import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// job-enrichment-batch-worker
//
// ПРОИСХОЖДЕНИЕ: раньше вся enrichment-логика (Ordbokene, NAOB, Expression
// translation+AI, Authoritative+AI, 360° neighborhood) жила внутри
// job-orchestrator и запускалась ОДНИМ Promise.all внутри ОДНОГО
// EdgeRuntime.waitUntil(), без пагинации — каждая цепочка обрабатывала до 20
// items последовательным for...await. Для job'ов с multi-word "ta"-семейством
// (23 expression-items на один job) это надёжно превышало лимит времени
// выполнения Edge Function: диагностика по логам entity_translations
// показала, что из 23 expressions AI-перевод реально получили только 2,
// после чего вся фоновая цепочка молча замолкала на 4+ минуты без единой
// ошибки — job при этом уже отчитался статусом 'ready' клиенту, поэтому
// проблема была не видна снаружи вообще.
//
// Тот же принцип пагинации, что уже подтверждён рабочим в
// job-completion-auditor (offset/limit/has_more, лимит батча уменьшен после
// логов с reason: "WallClockTime"), применён здесь ко ВСЕМ enrichment-цепочкам.
//
// ВАЖНО: обрабатываем ОДНУ цепочку за вызов (параметр `chain`), а не все
// сразу — сложение времени нескольких последовательных цепочек в одном
// вызове воспроизводит ту же проблему на новом уровне. Внешний драйвер
// (pipeline-supervisor) вызывает эту функцию в цикле, по одной цепочке за
// раз, пока has_more не станет false по всем цепočкам сразу.
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Безопасный размер батча — по образцу job-completion-auditor (было 20,
// снижено до диапазона, который в auditor'е уже подтверждён логами как не
// превышающий лимит платформы даже при реальных вызовах к внешним API).
const DEFAULT_BATCH_LIMIT = 8;
const MAX_BATCH_LIMIT = 15;

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
  } catch {
    return String(value);
  }
}

type ChainResult = {
  processed: number;
  has_more: boolean;
  next_offset: number | null;
  total: number | null;
};

const EMPTY_RESULT: ChainResult = { processed: 0, has_more: false, next_offset: null, total: 0 };

// ----------------------------------------------------------------------------
// Ordbokene enrichment (Variant B / lexeme + standalone expression path)
// ----------------------------------------------------------------------------
async function enqueueOrdbokeneEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .or('expression_id.not.is.null,lexeme_id.not.is.null')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('enqueueOrdbokeneEnrichment: failed to load promoted items for job', jobId, safeStringify(error));
    return EMPTY_RESULT;
  }

  for (const item of promotedItems ?? []) {
    const lemma = item.normalized_lemma ?? item.surface_form;
    if (!lemma) continue;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ordbokene-lexeme-pipeline-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lemma, parent_lexeme_id: item.lexeme_id ?? null, dry_run: false }),
      });

      const result = await response.json().catch(() => ({ ok: false }));
      if (!result.ok) {
        console.error('enqueueOrdbokeneEnrichment: pipeline failed for', lemma, 'job', jobId, safeStringify(result));
      }
    } catch (enrichError) {
      console.error('enqueueOrdbokeneEnrichment: request failed for', lemma, 'job', jobId, safeStringify(enrichError));
    }
  }

  const hasMore = (count ?? 0) > offset + limit;
  return {
    processed: promotedItems?.length ?? 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: count ?? null,
  };
}

// ----------------------------------------------------------------------------
// NAOB enrichment (expression-only)
// ----------------------------------------------------------------------------
async function enqueueNaobEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('enqueueNaobEnrichment: failed to load promoted items for job', jobId, safeStringify(error));
    return EMPTY_RESULT;
  }

  for (const item of promotedItems ?? []) {
    const expressionLemma = item.normalized_lemma ?? item.surface_form;
    if (!expressionLemma) continue;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/naob-pipeline-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression_lemma: expressionLemma, update_catalog: true }),
      });

      const result = await response.json().catch(() => ({ ok: false }));
      if (!result.ok) {
        console.error('enqueueNaobEnrichment: pipeline failed for', expressionLemma, 'job', jobId, safeStringify(result));
      }
    } catch (enrichError) {
      console.error('enqueueNaobEnrichment: request failed for', expressionLemma, 'job', jobId, safeStringify(enrichError));
    }
  }

  const hasMore = (count ?? 0) > offset + limit;
  return {
    processed: promotedItems?.length ?? 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: count ?? null,
  };
}

// ----------------------------------------------------------------------------
// Expression translation (Lexin, EXPRESSION MODE)
// ----------------------------------------------------------------------------
async function enqueueExpressionTranslationEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .eq('match_type', 'expression')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('enqueueExpressionTranslationEnrichment: failed to load promoted items for job', jobId, safeStringify(error));
    return EMPTY_RESULT;
  }

  for (const item of promotedItems ?? []) {
    const expressionLemma = item.normalized_lemma ?? item.surface_form;
    if (!expressionLemma || !item.expression_id) continue;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/lexin-enrichment-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression_id: item.expression_id, lemma: expressionLemma, dry_run: false }),
      });

      const result = await response.json().catch(() => ({ ok: false }));
      if (!result.ok) {
        console.error(
          'enqueueExpressionTranslationEnrichment: Lexin failed for',
          expressionLemma,
          'job',
          jobId,
          safeStringify(result),
        );
      }
    } catch (enrichError) {
      console.error(
        'enqueueExpressionTranslationEnrichment: request failed for',
        expressionLemma,
        'job',
        jobId,
        safeStringify(enrichError),
      );
    }
  }

  const hasMore = (count ?? 0) > offset + limit;
  return {
    processed: promotedItems?.length ?? 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: count ?? null,
  };
}

// ----------------------------------------------------------------------------
// Expression AI-fallback
// ----------------------------------------------------------------------------
async function callAiFallbackForExpression(expressionId: string, jobId?: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-enrichment-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression_id: expressionId, dry_run: false, limit: 1 }),
    });

    const result = await response.json().catch(() => ({ ok: false }));
    if (!result.ok) {
      console.error(
        'callAiFallbackForExpression: pipeline failed for expression',
        expressionId,
        jobId ? `job ${jobId}` : '(neighborhood enrichment)',
        safeStringify(result),
      );
    }
  } catch (enrichError) {
    console.error(
      'callAiFallbackForExpression: request failed for expression',
      expressionId,
      jobId ? `job ${jobId}` : '(neighborhood enrichment)',
      safeStringify(enrichError),
    );
  }
}

async function enqueueExpressionAiFallbackEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .eq('match_type', 'expression')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('enqueueExpressionAiFallbackEnrichment: failed to load promoted items for job', jobId, safeStringify(error));
    return EMPTY_RESULT;
  }

  for (const item of promotedItems ?? []) {
    if (!item.expression_id) continue;
    await callAiFallbackForExpression(item.expression_id, jobId);
  }

  const hasMore = (count ?? 0) > offset + limit;
  return {
    processed: promotedItems?.length ?? 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: count ?? null,
  };
}

// ----------------------------------------------------------------------------
// Authoritative verification (lexemes only) + AI-fallback for lexemes
// ----------------------------------------------------------------------------
async function enqueueAuthoritativeEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('enqueueAuthoritativeEnrichment: failed to load promoted items for job', jobId, safeStringify(error));
    return EMPTY_RESULT;
  }

  for (const item of promotedItems ?? []) {
    const lemma = item.normalized_lemma ?? item.surface_form;
    if (!lemma || !item.lexeme_id) continue;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/authoritative-enrichment-pipeline-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_type: 'lexeme', lemma, lexeme_id: item.lexeme_id, force_refresh: false }),
      });

      const result = await response.json().catch(() => ({ ok: false }));
      if (!result.ok) {
        console.error('enqueueAuthoritativeEnrichment: pipeline failed for', lemma, 'job', jobId, safeStringify(result));
      }
    } catch (enrichError) {
      console.error('enqueueAuthoritativeEnrichment: request failed for', lemma, 'job', jobId, safeStringify(enrichError));
    }
  }

  const hasMore = (count ?? 0) > offset + limit;
  return {
    processed: promotedItems?.length ?? 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: count ?? null,
  };
}

async function callAiFallbackForLexeme(lexemeId: string, jobId?: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-enrichment-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lexeme_id: lexemeId, dry_run: false, limit: 1 }),
    });

    const result = await response.json().catch(() => ({ ok: false }));
    if (!result.ok) {
      console.error(
        'callAiFallbackForLexeme: pipeline failed for lexeme',
        lexemeId,
        jobId ? `job ${jobId}` : '(neighborhood enrichment)',
        safeStringify(result),
      );
    }
  } catch (enrichError) {
    console.error(
      'callAiFallbackForLexeme: request failed for lexeme',
      lexemeId,
      jobId ? `job ${jobId}` : '(neighborhood enrichment)',
      safeStringify(enrichError),
    );
  }
}

async function enqueueAiFallbackEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('enqueueAiFallbackEnrichment: failed to load promoted items for job', jobId, safeStringify(error));
    return EMPTY_RESULT;
  }

  for (const item of promotedItems ?? []) {
    if (!item.lexeme_id) continue;
    await callAiFallbackForLexeme(item.lexeme_id, jobId);
  }

  const hasMore = (count ?? 0) > offset + limit;
  return {
    processed: promotedItems?.length ?? 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: count ?? null,
  };
}

// ----------------------------------------------------------------------------
// 360° neighborhood enrichment
//
// ВАЖНО — известное упрощение относительно оригинального рекурсивного BFS:
// оригинальный код в job-orchestrator держал currentFrontier в памяти одной
// длинной инвокации и на каждой глубине пересчитывал соседей ИМЕННО от
// успешно обогащённых на предыдущей глубине целей. Здесь, чтобы каждый вызов
// оставался маленьким и статeless (без утечки состояния между HTTP-вызовами),
// фронтир глубины 1 всегда пересчитывается заново из promoted items job'а
// (дёшево и идемпотентно), а глубина 2 пересчитывается из лексем, у которых
// уже есть entity_translations с source='lexin' И которые являются целями
// связей от фронтира глубины 1 — это очень близкая, но не побитово идентичная
// аппроксимация исходного `enriched` (который включал любой ok:true результат
// пайплайна, не только конкретно Lexin-источник). Разница может проявиться
// только в том, КАКИЕ соседи попадут на глубину 2 в редких edge-case, не в
// корректности самого обогащения. Если нужна полная идентичность семантики —
// потребуется таблица состояния (например, pipeline_supervisor_step_log —
// см. docx-план) для хранения frontier ID между вызовами; до тех пор это
// осознанный компромисс ради безопасной пагинации.
// ----------------------------------------------------------------------------

const NEIGHBORS_PER_LEXEME = 15;

async function discoverMeaningExtensions(lexemeIds: string[]): Promise<string[]> {
  if (!lexemeIds.length) return [];

  const discovered = new Set<string>();

  const { data: lexemeRows } = await supabase.from('lexemes').select('id, lemma').in('id', lexemeIds);
  const lemmas = (lexemeRows ?? []).map((l) => l.lemma).filter(Boolean);

  if (lemmas.length > 0) {
    const { data: expressions } = await supabase
      .from('expression_catalog')
      .select('lexeme_id')
      .in('root_lemma', lemmas)
      .not('lexeme_id', 'is', null)
      .limit(lexemeIds.length * NEIGHBORS_PER_LEXEME);

    for (const expr of expressions ?? []) {
      if (expr.lexeme_id) discovered.add(expr.lexeme_id);
    }
  }

  const { data: asr } = await supabase
    .from('authoritative_semantic_relations')
    .select('target_entity_id')
    .in('source_entity_id', lexemeIds)
    .not('target_entity_id', 'is', null)
    .in('status', ['candidate', 'trusted'])
    .limit(lexemeIds.length * NEIGHBORS_PER_LEXEME);

  for (const rel of asr ?? []) {
    if (rel.target_entity_id) discovered.add(rel.target_entity_id);
  }

  for (const id of lexemeIds) discovered.delete(id);

  return [...discovered];
}

async function getFrontierForDepth(jobId: string, depth: number): Promise<string[]> {
  const { data: promotedItems } = await supabase
    .from('lexeme_processing_items')
    .select('lexeme_id')
    .eq('job_id', jobId)
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token');

  const depth1Frontier = [...new Set((promotedItems ?? []).map((i) => i.lexeme_id).filter(Boolean) as string[])];

  if (depth <= 1) return depth1Frontier;

  // depth === 2: соседи глубины 1, уже обогащённые Lexin'ом (см. комментарий
  // выше про приближение к исходной BFS-семантике).
  const depth1Neighbors = await discoverMeaningExtensions(depth1Frontier);
  if (!depth1Neighbors.length) return [];

  const { data: enriched } = await supabase
    .from('entity_translations')
    .select('lexeme_id')
    .in('lexeme_id', depth1Neighbors)
    .eq('source', 'lexin');

  return [...new Set((enriched ?? []).map((e) => e.lexeme_id).filter(Boolean) as string[])];
}

async function enqueueNeighborhoodEnrichment(
  jobId: string,
  depth: number,
  offset: number,
  limit: number,
): Promise<ChainResult & { depth: number }> {
  const frontier = await getFrontierForDepth(jobId, depth);

  if (!frontier.length) {
    return { processed: 0, has_more: false, next_offset: null, total: 0, depth };
  }

  const allNeighbors = await discoverMeaningExtensions(frontier);

  if (!allNeighbors.length) {
    return { processed: 0, has_more: false, next_offset: null, total: 0, depth };
  }

  const { data: alreadyEnriched } = await supabase
    .from('entity_translations')
    .select('lexeme_id')
    .in('lexeme_id', allNeighbors)
    .eq('source', 'lexin');

  const enrichedSet = new Set((alreadyEnriched ?? []).map((t) => t.lexeme_id));
  const toEnrich = allNeighbors.filter((id) => !enrichedSet.has(id));

  const pageIds = toEnrich.slice(offset, offset + limit);

  if (!pageIds.length) {
    return { processed: 0, has_more: false, next_offset: null, total: toEnrich.length, depth };
  }

  const { data: targetLexemes } = await supabase.from('lexemes').select('id, lemma').in('id', pageIds);

  for (const target of targetLexemes ?? []) {
    if (!target.lemma || !target.id) continue;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/authoritative-enrichment-pipeline-worker`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_type: 'lexeme', lemma: target.lemma, lexeme_id: target.id, force_refresh: false }),
      });

      const result = await response.json().catch(() => ({ ok: false }));
      if (result.ok) {
        await callAiFallbackForLexeme(target.id);
      }
    } catch (err) {
      console.error('enqueueNeighborhoodEnrichment: failed for', target.lemma, safeStringify(err));
    }
  }

  const hasMore = offset + limit < toEnrich.length;
  return {
    processed: targetLexemes?.length ?? 0,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: toEnrich.length,
    depth,
  };
}

// ----------------------------------------------------------------------------
// HTTP entrypoint — processes ONE chain per invocation
// ----------------------------------------------------------------------------

const VALID_CHAINS = [
  'ordbokene',
  'naob',
  'expression_translation',
  'expression_ai_fallback',
  'authoritative',
  'authoritative_ai_fallback',
  'neighborhood',
] as const;

type Chain = (typeof VALID_CHAINS)[number];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    const jobId = String(body.job_id ?? '').trim();
    if (!jobId) return jsonResponse({ ok: false, error: 'job_id is required' }, 400);

    const chain = body.chain as Chain;
    if (!VALID_CHAINS.includes(chain)) {
      return jsonResponse({ ok: false, error: `chain must be one of: ${VALID_CHAINS.join(', ')}` }, 400);
    }

    const limit = Math.min(Math.max(Number(body.limit ?? DEFAULT_BATCH_LIMIT), 1), MAX_BATCH_LIMIT);
    const offset = Math.max(Number(body.offset ?? 0), 0);
    const depth = Math.min(Math.max(Number(body.depth ?? 1), 1), 2); // only used by 'neighborhood'

    let result: ChainResult & { depth?: number };

    switch (chain) {
      case 'ordbokene':
        result = await enqueueOrdbokeneEnrichment(jobId, offset, limit);
        break;
      case 'naob':
        result = await enqueueNaobEnrichment(jobId, offset, limit);
        break;
      case 'expression_translation':
        result = await enqueueExpressionTranslationEnrichment(jobId, offset, limit);
        break;
      case 'expression_ai_fallback':
        result = await enqueueExpressionAiFallbackEnrichment(jobId, offset, limit);
        break;
      case 'authoritative':
        result = await enqueueAuthoritativeEnrichment(jobId, offset, limit);
        break;
      case 'authoritative_ai_fallback':
        result = await enqueueAiFallbackEnrichment(jobId, offset, limit);
        break;
      case 'neighborhood':
        result = await enqueueNeighborhoodEnrichment(jobId, depth, offset, limit);
        break;
    }

    return jsonResponse({
      ok: true,
      job_id: jobId,
      chain,
      offset,
      limit,
      ...result,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});