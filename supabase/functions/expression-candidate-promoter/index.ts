// supabase/functions/expression-candidate-promoter/index.ts
//
// ============================================================================
// Мост между authoritative_semantic_relations (кандидаты has_expression,
// собранные из Ordbokene/NAOB) и expression_catalog (реальный жизненный
// цикл выражений: verification, Lexin-перевод, formи, AI-fallback).
//
// Найдено 27.07.2026: RPC claim_next_relation_candidates/
// complete_relation_resolution существовали в БД с 07.07.2026, но ни разу
// не вызывались ни одним edge function — 1132 качественных кандидата
// (2389 связей от 537 слов) простаивали без движения.
//
// Что делает:
//   1. claim_next_relation_candidates(limit) — забирает пачку кандидатов
//      (status='candidate', target_entity_id IS NULL) с блокировкой
//      (FOR UPDATE SKIP LOCKED) — безопасно при параллельных вызовах.
//   2. Для каждого — создаёт (или находит уже существующую) строку в
//      expression_catalog: lemma/normalized_key = target_text,
//      root_lemma = лемма исходной лексемы, lexeme_id = null (ещё не
//      промоушено в отдельную карточку — это сделает обычный
//      enrichment-pipeline позже, как и для любого другого выражения),
//      verification_status = 'candidate' (та же семантика, что уже
//      использует вариант А / Lexeme360 для серых карточек).
//   3. complete_relation_resolution — обновляет relation:
//      target_entity_type='expression', target_entity_id=<новый id>,
//      status='trusted' (кандидат успешно материализован).
//
// ВАЖНО: сама RPC claim_next_relation_candidates фильтрует
// target_entity_id IS NULL — но найденные 1132 "потерянных" кандидата уже
// ИМЕЮТ заполненный target_entity_id (заранее сгенерированный UUID,
// никогда не использованный). Эта функция поэтому НЕ использует
// claim_next_relation_candidates для основного потока (он их не увидит),
// а работает напрямую с этими "предвыделенными", но никогда не
// созданными записями — отдельная выборка ниже.
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

const WORKER_NAME = 'expression-candidate-promoter';
const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 100;

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

type RelationRow = {
  id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_text: string;
  target_entity_id: string;
  source: string | null;
  confidence: string | null;
  evidence: unknown;
};

type Outcome = {
  relation_id: string;
  target_text: string;
  action: 'created' | 'linked_existing' | 'skipped_no_source_lemma' | 'failed';
  expression_id?: string;
  error?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit ?? DEFAULT_BATCH_LIMIT), 1), MAX_BATCH_LIMIT);
    const dryRun = Boolean(body.dry_run ?? false);

    const { data: relations, error: relError } = await supabase.rpc(
      'get_stranded_expression_candidates',
      { p_limit: limit },
    );

    if (relError) {
      return jsonResponse({ ok: false, stage: 'load_relations', error: safeStringify(relError) }, 500);
    }

    const toProcess = (relations ?? []) as RelationRow[];

    if (toProcess.length === 0) {
      return jsonResponse({ ok: true, worker: WORKER_NAME, processed: 0, message: 'No stranded candidates found' });
    }

    // Резолвим лемму исходной лексемы для root_lemma — батчем, не по одному.
    const sourceLexemeIds = [...new Set(
      toProcess.filter((r) => r.source_entity_type === 'lexeme').map((r) => r.source_entity_id),
    )];
    const sourceExpressionIds = [...new Set(
      toProcess.filter((r) => r.source_entity_type === 'expression').map((r) => r.source_entity_id),
    )];

    const lemmaByLexemeId = new Map<string, string>();
    if (sourceLexemeIds.length > 0) {
      const { data: lexemeRows } = await supabase
        .from('lexemes')
        .select('id, lemma')
        .in('id', sourceLexemeIds);
      for (const row of lexemeRows ?? []) lemmaByLexemeId.set(row.id, row.lemma);
    }

    const rootLemmaByExpressionId = new Map<string, string>();
    if (sourceExpressionIds.length > 0) {
      const { data: expressionRows } = await supabase
        .from('expression_catalog')
        .select('id, root_lemma, lemma')
        .in('id', sourceExpressionIds);
      for (const row of expressionRows ?? []) {
        rootLemmaByExpressionId.set(row.id, row.root_lemma || row.lemma);
      }
    }

    const outcomes: Outcome[] = [];
    let created = 0;
    let linkedExisting = 0;
    let skipped = 0;
    let failed = 0;

    for (const rel of toProcess) {
      try {
        const rootLemma = rel.source_entity_type === 'lexeme'
          ? lemmaByLexemeId.get(rel.source_entity_id)
          : rootLemmaByExpressionId.get(rel.source_entity_id);

        if (!rootLemma) {
          // ФІКС (за зауваженням код-рев'ю, 27.07.2026): раніше цей
          // кандидат просто пропускався, залишаючись status='candidate' —
          // наступний тик cron'а (кожні 5 хв) знову забирав його через
          // get_stranded_expression_candidates (вона фільтрує саме по
          // status='candidate'), знову skip, і так нескінченно. При
          // великій кількості "мертвих" кандидатів (джерело видалене/
          // source_entity_type не lexeme чи expression) вони почали б
          // витісняти реально оброблювані записи з обмеженого limit=25
          // вікна кожного тику. Тепер помічаємо термінальним статусом
          // 'unresolvable' — get_stranded_expression_candidates (WHERE
          // status='candidate') більше їх не побачить, а вони залишаються
          // видимими в БД для ручного розбору (не видаляються).
          if (!dryRun) {
            await supabase
              .from('authoritative_semantic_relations')
              .update({ status: 'unresolvable' })
              .eq('id', rel.id);
          }

          skipped++;
          outcomes.push({
            relation_id: rel.id, target_text: rel.target_text,
            action: 'skipped_no_source_lemma',
          });
          continue;
        }

        const normalizedTarget = normalizeKey(rel.target_text);

        if (dryRun) {
          outcomes.push({
            relation_id: rel.id, target_text: rel.target_text,
            action: 'created', expression_id: rel.target_entity_id,
          });
          created++;
          continue;
        }

        // ФИКС (27.07.2026, знайдено на живих даних: falle i synd/falle
        // noen i ryggen/hvilken vei vinden blåser — усі впали з 23505):
        // реальний unique constraint expression_catalog_unique_key —
        // UNIQUE (normalized_key) БЕЗ root_lemma. Один і той самий вираз
        // фізично може існувати лише ОДИН раз у всій базі, незалежно від
        // того, до якого кореневого дієслова він відноситься (напр. один
        // вираз міг бути знайдений одночасно як похідний від двох різних
        // дієслів). Попередня перевірка шукала пару (normalized_key +
        // root_lemma) — не знаходила існуючий запис під ІНШИМ root_lemma,
        // намагалась вставити дублікат і падала на реальному constraint.
        const { data: existingByKey } = await supabase
          .from('expression_catalog')
          .select('id')
          .eq('normalized_key', normalizedTarget)
          .maybeSingle();

        let expressionId = existingByKey?.id ?? null;

        if (expressionId) {
          linkedExisting++;
        } else {
          const relSource = String(rel.source ?? '').toLowerCase();
          const isFromNaob = relSource.includes('naob');
          const isFromOrdbokene = relSource.includes('ordbokene');
          // ФІКС (за зауваженням код-рев'ю, 27.07.2026): раніше було
          // `source_ordbokene: relSource.includes('ordbokene') ||
          // !relSource.includes('naob')` — це помилково позначало
          // source_ordbokene=true для БУДЬ-ЯКОГО джерела, що не naob,
          // включно з порожнім/невідомим значенням. Явний allowlist:
          // якщо джерело не розпізнане як naob чи ordbokene — обидва
          // прапорці залишаються false (чесно "невідоме джерело"), а не
          // мовчки приписуються Ordbokene.

          const { data: inserted, error: insertError } = await supabase
            .from('expression_catalog')
            .insert({
              id: rel.target_entity_id, // используем предвыделенный uuid
              lemma: rel.target_text,
              display_form: rel.target_text,
              normalized_key: normalizedTarget,
              language: 'nb',
              pos: 'expression',
              root_lemma: normalizeKey(rootLemma),
              importance_score: 0,
              source_naob: isFromNaob,
              source_wiktionary: false,
              source_gemini: false,
              source_ordbokene: isFromOrdbokene,
              source_manual: false,
              source_urls: [],
              raw_sources: {
                relation_id: rel.id,
                relation_source: rel.source,
                relation_evidence: rel.evidence ?? null,
                promoted_by: WORKER_NAME,
                promoted_at: new Date().toISOString(),
              },
              verification: 'ai_candidate',
              confidence: rel.confidence ?? 'medium',
              verification_status: 'candidate',
              verification_version: 1,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          expressionId = inserted.id;
          created++;
        }

        const { error: completeError } = await supabase.rpc('complete_relation_resolution', {
          p_relation_id: rel.id,
          p_target_entity_type: 'expression',
          p_target_entity_id: expressionId,
          p_status: 'trusted',
        });

        if (completeError) throw completeError;

        outcomes.push({
          relation_id: rel.id, target_text: rel.target_text,
          action: expressionId === rel.target_entity_id ? 'created' : 'linked_existing',
          expression_id: expressionId,
        });
      } catch (e) {
        failed++;
        outcomes.push({
          relation_id: rel.id, target_text: rel.target_text,
          action: 'failed', error: safeStringify(e),
        });
      }
    }

    return jsonResponse({
      ok: failed === 0,
      worker: WORKER_NAME,
      dry_run: dryRun,
      processed: toProcess.length,
      created,
      linked_existing: linkedExisting,
      skipped,
      failed,
      outcomes,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});