// supabase/functions/naob-synonym-resolver/index.ts
//
// ============================================================================
// naob-synonym-resolver
//
// Мост между naob_expression_glosses (сырые глоссы, извлечённые
// naob-synonym-extractor из HTML статей NAOB) и authoritative_semantic_relations
// (рабочая таблица связей приложения — 7265 строк на момент проектирования,
// в отличие от semantic_unit_relations/canonical_semantic_units, которые
// оказались практически пустыми экспериментами).
//
// Архитектурное решение: ЭТО НЕ job-scoped enrichment-цепочка (в отличие от
// forms/naob_synonyms в job-enrichment-batch-worker). Резолвинг "существует
// ли уже лексема X в базе" — это факт о состоянии ВСЕЙ базы, не привязанный
// к конкретному job'у, который породил тот или иной глосс. База растёт со
// временем — то, что не резолвилось вчера, может резолвиться сегодня.
// Поэтому это отдельная maintenance-функция с пагинацией (offset/limit/
// has_more), вызываемая вручную или отдельным cron'ом, по тому же принципу,
// что и остальные offline-механизмы (seed_verification_refresh_batches).
//
// Что делает:
//   1. Берёт страницу строк naob_expression_glosses с gloss_type='direct'
//      (у 'reference' — это отсылка на другую статью, не синоним; у
//      'no_gloss' — синонима нет вообще).
//   2. Резолвит ИСТОЧНИК: normalized_key (= лемма самого выражения, см.
//      naob-synonym-extractor: normalized_key = g.expression_lemma) —
//      ищет совпадение в expression_catalog.normalized_key, затем в
//      lexemes.lemma.
//   3. Разбивает gloss_text на термины ТОЛЬКО по ';' — это соответствует
//      тому, как сам экстрактор их изначально собирал (glossParts.join('; ')).
//      Запятая внутри одного термина (например, "behandle, ha (noen som
//      helst) befatning med (en sak)") — это один смысловой оборот, не два
//      разных синонима, разбивать по ней нельзя.
//   4. Резолвит КАЖДЫЙ термин той же логикой (expression_catalog, затем
//      lexemes). Длинные обороты с скобками/запятыми внутри, скорее всего,
//      не найдут совпадения — это ожидаемо, не ошибка, они остаются
//      кандидатами с target_entity_id: null.
//   5. Пишет через уже существующую RPC save_authoritative_semantic_relation
//      (относится к authoritative_semantic_relations, unique key —
//      source_entity_type+source_entity_id+relation_type+target_text+source,
//      поэтому повторный прогон идемпотентен — upsert, не дублирует строки).
//      relation_type='synonym', source='naob_synonym_resolver', status
//      ВСЕГДА 'candidate' (текстовое совпадение — не гарантия смысловой
//      эквивалентности, финальное решение — за отдельным шагом проверки,
//      которого пока нет и не является частью этой задачи).
//
// Если источник (сам normalized_key) не резолвится ни в expression_catalog,
// ни в lexemes — строка глосса пропускается целиком (skipped), так как
// source_entity_id обязателен для save_authoritative_semantic_relation.
// ============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WORKER_NAME = 'naob-synonym-resolver';
const RELATION_TYPE = 'synonym';
const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 100;

// Безопасный потолок для full_run — защита от бесконечного цикла, если
// has_more почему-то никогда не станет false (баг в подсчёте/пагинации).
// 500 раундов по 100 строк = 50000 глоссов с запасом на годы роста.
const MAX_FULL_RUN_ROUNDS = 500;

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

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Убирает висячие скобки/пунктуацию по краям термина — сами скобочные
// пояснения внутри (например, "(noen som helst)") намеренно НЕ трогаем,
// они делают термин длинным и просто не найдут точного совпадения, что
// ожидаемо для описательных оборотов, а не однословных/устойчивых
// синонимов.
function cleanTerm(value: string): string {
  return normalizeKey(value)
    .replace(/^[.,;:\-\s]+/, '')
    .replace(/[.,;:\-\s]+$/, '')
    .trim();
}

type EntityRef = {
  entity_type: 'lexeme' | 'expression';
  entity_id: string;
};

type ResolveCache = Map<string, EntityRef | null>;

async function resolveEntityByLemma(
  normalizedLemma: string,
  cache: ResolveCache,
): Promise<EntityRef | null> {
  if (cache.has(normalizedLemma)) {
    return cache.get(normalizedLemma) ?? null;
  }

  // Многословные термины почти всегда expressions — проверяем
  // expression_catalog первым, чтобы не тратить лишний запрос на lexemes
  // для очевидных случаев, затем наоборот для однословных.
  const isMultiWord = normalizedLemma.includes(' ');

  const tryExpression = async (): Promise<EntityRef | null> => {
    const { data } = await supabase
      .from('expression_catalog')
      .select('id')
      .eq('normalized_key', normalizedLemma)
      .limit(1)
      .maybeSingle();

    return data?.id ? { entity_type: 'expression', entity_id: data.id } : null;
  };

  const tryLexeme = async (): Promise<EntityRef | null> => {
    const { data } = await supabase
      .from('lexemes')
      .select('id')
      .eq('lemma', normalizedLemma)
      .limit(1)
      .maybeSingle();

    return data?.id ? { entity_type: 'lexeme', entity_id: data.id } : null;
  };

  let result: EntityRef | null;

  if (isMultiWord) {
    result = (await tryExpression()) ?? (await tryLexeme());
  } else {
    result = (await tryLexeme()) ?? (await tryExpression());
  }

  cache.set(normalizedLemma, result);
  return result;
}

type GlossRow = {
  id: string;
  normalized_key: string;
  naob_slug: string;
  anchor_id: string;
  gloss_text: string | null;
  gloss_type: string;
  context_label: string | null;
};

type RowOutcome = {
  gloss_id: string;
  normalized_key: string;
  action: 'resolved' | 'skipped_no_source' | 'no_terms' | 'failed';
  source_entity?: EntityRef;
  terms_written?: number;
  terms_matched?: number;
  error?: string;
};

type PageResult = {
  offset: number;
  limit: number;
  total: number | null;
  has_more: boolean;
  next_offset: number | null;
  processed: number;
  resolved: number;
  skipped_no_source: number;
  failed: number;
  terms_written: number;
  terms_matched: number;
  outcomes: RowOutcome[];
};

async function processPage(
  offset: number,
  limit: number,
  dryRun: boolean,
  resolveCache: ResolveCache,
): Promise<PageResult> {
  const { data: glosses, error, count } = await supabase
    .from('naob_expression_glosses')
    .select('id, normalized_key, naob_slug, anchor_id, gloss_text, gloss_type, context_label', { count: 'exact' })
    .eq('gloss_type', 'direct')
    .not('gloss_text', 'is', null)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`load_glosses failed: ${safeStringify(error)}`);
  }

  const rows = (glosses ?? []) as GlossRow[];
  const outcomes: RowOutcome[] = [];

  let resolvedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let termsWrittenTotal = 0;
  let termsMatchedTotal = 0;

  for (const row of rows) {
    try {
      const sourceLemma = normalizeKey(row.normalized_key ?? '');
      if (!sourceLemma) {
        skippedCount++;
        outcomes.push({ gloss_id: row.id, normalized_key: row.normalized_key, action: 'skipped_no_source' });
        continue;
      }

      const sourceEntity = await resolveEntityByLemma(sourceLemma, resolveCache);

      if (!sourceEntity) {
        skippedCount++;
        outcomes.push({ gloss_id: row.id, normalized_key: row.normalized_key, action: 'skipped_no_source' });
        continue;
      }

      const terms = (row.gloss_text ?? '')
        .split(';')
        .map(cleanTerm)
        .filter((t) => t.length >= 2 && t.length <= 80);

      if (terms.length === 0) {
        outcomes.push({ gloss_id: row.id, normalized_key: row.normalized_key, action: 'no_terms', source_entity: sourceEntity });
        continue;
      }

      let written = 0;
      let matched = 0;

      for (const term of terms) {
        // Термин совпадает с самим источником (например, глосс случайно
        // повторяет лемму) — не создаём связь сущности с самой собой.
        if (term === sourceLemma) continue;

        const targetEntity = await resolveEntityByLemma(term, resolveCache);
        if (targetEntity) matched++;

        if (dryRun) {
          written++;
          continue;
        }

        const { data: rpcData, error: rpcError } = await supabase.rpc('save_authoritative_semantic_relation', {
          p_source_entity_type: sourceEntity.entity_type,
          p_source_entity_id: sourceEntity.entity_id,
          p_relation_type: RELATION_TYPE,
          p_target_text: term,
          p_source: WORKER_NAME,
          p_confidence: targetEntity ? 'medium' : 'low',
          p_status: 'candidate',
          p_evidence: {
            naob_gloss_id: row.id,
            naob_slug: row.naob_slug,
            anchor_id: row.anchor_id,
            gloss_type: row.gloss_type,
            context_label: row.context_label,
            full_gloss_text: row.gloss_text,
            worker: WORKER_NAME,
          },
          p_urls: [],
          p_target_entity_type: targetEntity?.entity_type ?? null,
          p_target_entity_id: targetEntity?.entity_id ?? null,
        });

        if (rpcError) {
          throw new Error(`save_authoritative_semantic_relation failed for term "${term}": ${safeStringify(rpcError)}`);
        }

        if (!rpcData) {
          // ФИКС (диагностика): RPC не вернула id, но и не выбросила
          // ошибку — supabase.rpc может "тихо" не выполнить insert без
          // заполнения error в редких случаях (проблема сериализации
          // ответа, скрытая проблема авторизации и т.п.). Раньше это
          // молча засчитывалось как успех (rpcError отсутствует), хотя
          // строка в БД не появлялась — именно так и произошло при первом
          // реальном прогоне 08.07: ok:true, failed:0, но 0 строк в
          // authoritative_semantic_relations. Теперь считаем такой случай
          // ошибкой явно, чтобы это было видно в outcomes, а не терялось.
          throw new Error(
            `save_authoritative_semantic_relation returned no id for term "${term}" (rpcData=${safeStringify(rpcData)}) — insert likely did not happen despite no rpcError`,
          );
        }

        written++;
      }

      termsWrittenTotal += written;
      termsMatchedTotal += matched;
      resolvedCount++;

      outcomes.push({
        gloss_id: row.id,
        normalized_key: row.normalized_key,
        action: 'resolved',
        source_entity: sourceEntity,
        terms_written: written,
        terms_matched: matched,
      });
    } catch (rowError) {
      failedCount++;
      outcomes.push({
        gloss_id: row.id,
        normalized_key: row.normalized_key,
        action: 'failed',
        error: safeStringify(rowError),
      });
    }
  }

  const hasMore = (count ?? 0) > offset + limit;

  return {
    offset,
    limit,
    total: count ?? null,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    processed: rows.length,
    resolved: resolvedCount,
    skipped_no_source: skippedCount,
    failed: failedCount,
    terms_written: termsWrittenTotal,
    terms_matched: termsMatchedTotal,
    outcomes,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

  try {
    const body = await req.json().catch(() => ({}));

    const limit = Math.min(Math.max(Number(body.limit ?? DEFAULT_BATCH_LIMIT), 1), MAX_BATCH_LIMIT);
    const dryRun = Boolean(body.dry_run ?? false);
    const fullRun = Boolean(body.full_run ?? false);

    // Общий resolveCache на весь прогон (и на все страницы full_run) —
    // одна и та же лемма встречается многократно среди 225+ строк,
    // кэш заметно сокращает число запросов к lexemes/expression_catalog.
    const resolveCache: ResolveCache = new Map();

    if (!fullRun) {
      const offset = Math.max(Number(body.offset ?? 0), 0);
      const page = await processPage(offset, limit, dryRun, resolveCache);

      return jsonResponse({
        ok: page.failed === 0,
        worker: WORKER_NAME,
        dry_run: dryRun,
        full_run: false,
        ...page,
      });
    }

    // ------------------------------------------------------------------
    // full_run: true — предназначен для cron. Эта функция не делает
    // внешних сетевых вызовов (только чтение/запись в БД), поэтому в
    // отличие от job-orchestrator/job-enrichment-batch-worker здесь не
    // нужна пошаговая модель с внешним оркестратором — можно безопасно
    // пройти все страницы циклом внутри одной инвокации.
    // ------------------------------------------------------------------
    let offset = 0;
    let round = 0;
    let hasMore = true;

    let totalProcessed = 0;
    let totalResolved = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let totalTermsWritten = 0;
    let totalTermsMatched = 0;
    let grandTotal: number | null = null;
    const roundSummaries: Array<{ offset: number; processed: number; resolved: number; failed: number }> = [];

    while (hasMore && round < MAX_FULL_RUN_ROUNDS) {
      const page = await processPage(offset, limit, dryRun, resolveCache);

      totalProcessed += page.processed;
      totalResolved += page.resolved;
      totalSkipped += page.skipped_no_source;
      totalFailed += page.failed;
      totalTermsWritten += page.terms_written;
      totalTermsMatched += page.terms_matched;
      grandTotal = page.total;

      roundSummaries.push({
        offset,
        processed: page.processed,
        resolved: page.resolved,
        failed: page.failed,
      });

      hasMore = page.has_more;
      offset = page.next_offset ?? offset + limit;
      round++;

      // Ни одной строки на странице — защита от бесконечного цикла, если
      // has_more почему-то остался true при пустой странице.
      if (page.processed === 0) break;
    }

    return jsonResponse({
      ok: totalFailed === 0,
      worker: WORKER_NAME,
      dry_run: dryRun,
      full_run: true,
      rounds: round,
      hit_max_rounds: round >= MAX_FULL_RUN_ROUNDS,
      total: grandTotal,
      processed: totalProcessed,
      resolved: totalResolved,
      skipped_no_source: totalSkipped,
      failed: totalFailed,
      terms_written: totalTermsWritten,
      terms_matched: totalTermsMatched,
      round_summaries: roundSummaries,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});