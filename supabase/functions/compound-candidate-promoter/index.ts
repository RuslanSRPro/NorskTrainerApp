// supabase/functions/compound-candidate-promoter/index.ts
//
// ============================================================================
// Мост между authoritative_semantic_relations (кандидаты
// compound_component_candidate, извлечённые NAOB-адаптером через regex
// "sammensetning av X og Y" в lexical-worker при обычном прогоне
// analyze-text) и lexeme_compound_analyses/lexeme_compound_components
// (реальные данные, которые читает триггер d10_apply_verified_compound_
// projection на lexeme_form_display_v2 для цветовой раскраски компаунда
// в приложении).
//
// Найдено 29.09.2026: regex-паттерн для compound_component_candidate
// существует и реально срабатывает (подтверждено на живых данных), но
// НИ ОДИН воркер никогда не читал эти кандидаты — они просто копятся в
// authoritative_semantic_relations со status='candidate' и никуда не
// превращаются. По образцу expression-candidate-promoter (тот же паттерн
// для has_expression-кандидатов).
//
// Что делает:
//   1. claim_next_compound_candidates(limit) — отдельный claim-RPC
//      (миграция ..._add_compound_candidate_claim_rpc.sql), НЕ пересекается
//      с общим claim_next_relation_candidates (та берёт любой relation_type
//      и могла бы конкурировать за блокировки с будущими потребителями
//      synonym_candidate/related_candidate/derived_candidate).
//   2. Для каждого кандидата: target_text — это сырой текст вида
//      "bil og nøkkel" (уже lowercase/trim от самого save_authoritative_
//      semantic_relation). Разбиваем на токены по "og"/"eller"/запятой.
//   3. Перебором линковочных элементов ('', 's', 'e' — стандартные
//      норвежские linking elements) между токенами ищем комбинацию, чья
//      конкатенация ТОЧНО (без учёта регистра) совпадает с леммой исходной
//      лексемы. Если совпадения нет — кандидат размечается 'needs_review'
//      (не мусор, но и не то, что можно доверить без глаз человека), а не
//      тихо теряется и не зацикливается на повторных попытках.
//   4. При успехе — INSERT в lexeme_compound_analyses (status=
//      'source_verified', как того требует d10_verified_compound_parts) +
//      lexeme_compound_components (по одной строке на часть, is_head=true
//      у последней — норвежские композиты правоголовые). Затем no-op UPDATE
//      lemma=lemma на lexeme_form_display_v2 для этой лексемы — заново
//      триггерит d10_apply_verified_compound_projection (он BEFORE INSERT
//      OR UPDATE, сам факт UPDATE'а достаточен, даже если значение не
//      меняется — Postgres всё равно вызывает BEFORE UPDATE триггер).
//   5. Кандидат помечается 'promoted' (успех) / 'needs_review' (не удалось
//      разобрать) / 'unresolvable' (source lexeme не найден или
//      source_entity_type не 'lexeme' — терминальные, не будут повторно
//      забираться, т.к. claim фильтрует status='candidate').
//
// НЕ вызывается автоматически — не подключено ни к какому cron. Запускать
// вручную (см. invoke-compound-candidate-promoter-v1.ps1), сначала с
// dry_run=true на малом limit, проверить outcomes, только потом реальный
// прогон. Подключение к regular pipeline (cron) — отдельное решение,
// сознательно не делается в рамках этого файла.
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

const WORKER_NAME = 'compound-candidate-promoter';
const DEFAULT_BATCH_LIMIT = 25;
const MAX_BATCH_LIMIT = 100;

// Стандартные норвежские linking elements между частями композита.
// '' — без линка (blåbær = blå + bær), 's' (arbeidsplass = arbeid+s+plass),
// 'e' (barnehage = barn+e+hage). Другие (напр. 'a') встречаются гораздо
// реже и сознательно не включены — такие случаи уйдут в 'needs_review'
// вместо ложного совпадения.
const LINKS = ['', 's', 'e'];

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

type RelationRow = {
  id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_text: string;
  source: string | null;
  confidence: string | null;
  evidence: unknown;
  urls: unknown;
};

type Reconstruction = { parts: string[]; links: string[] };

function splitCandidateTokens(targetText: string): string[] {
  return String(targetText || '')
    .split(/\s*(?:,|\bog\b|\beller\b)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

function tryReconstruct(lemma: string, tokens: string[]): Reconstruction | null {
  const n = tokens.length;
  if (n < 2) return null;

  const gaps = n - 1;
  const totalCombos = Math.pow(LINKS.length, gaps);
  const normalizedLemma = lemma.trim().toLowerCase();

  for (let c = 0; c < totalCombos; c++) {
    const combo: string[] = [];
    let rem = c;
    for (let g = 0; g < gaps; g++) {
      combo.push(LINKS[rem % LINKS.length]);
      rem = Math.floor(rem / LINKS.length);
    }

    let built = tokens[0];
    for (let i = 0; i < combo.length; i++) {
      built += combo[i] + tokens[i + 1];
    }

    if (built.toLowerCase() === normalizedLemma) {
      return { parts: tokens, links: combo };
    }
  }

  return null;
}

function confidenceToNumber(confidence: string | null): number {
  switch ((confidence || '').toLowerCase()) {
    case 'high': return 0.9;
    case 'low': return 0.5;
    default: return 0.7; // 'medium' — то, что реально всегда шлёт naob.ts сейчас
  }
}

async function markRelation(
  id: string,
  status: 'promoted' | 'needs_review' | 'unresolvable',
  note: string | null,
  existingEvidence: unknown,
): Promise<void> {
  const evidence = {
    ...(existingEvidence && typeof existingEvidence === 'object' ? existingEvidence : {}),
    compound_promoter_note: note,
    compound_promoter_status: status,
    compound_promoter_at: new Date().toISOString(),
  };

  await supabase
    .from('authoritative_semantic_relations')
    .update({ status, evidence, updated_at: new Date().toISOString() })
    .eq('id', id);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit ?? DEFAULT_BATCH_LIMIT), 1), MAX_BATCH_LIMIT);
    const dryRun = Boolean(body.dry_run ?? false);

    const { data: relations, error: relError } = await supabase.rpc(
      'claim_next_compound_candidates',
      { p_limit: limit },
    );

    if (relError) {
      return jsonResponse({ ok: false, stage: 'load_relations', error: safeStringify(relError) }, 500);
    }

    const toProcess = (relations ?? []) as RelationRow[];

    if (toProcess.length === 0) {
      return jsonResponse({ ok: true, worker: WORKER_NAME, processed: 0, message: 'No compound candidates found' });
    }

    // Резолвим лемму исходной лексемы батчем, не по одному.
    const sourceLexemeIds = [...new Set(
      toProcess.filter((r) => r.source_entity_type === 'lexeme').map((r) => r.source_entity_id),
    )];

    const lemmaByLexemeId = new Map<string, string>();
    if (sourceLexemeIds.length > 0) {
      const { data: lexemeRows } = await supabase
        .from('lexemes')
        .select('id, lemma')
        .in('id', sourceLexemeIds);
      for (const row of lexemeRows ?? []) lemmaByLexemeId.set(row.id, row.lemma);
    }

    // Заранее резолвим id компонентов по всем кандидатным токенам сразу
    // (один запрос на весь батч, не по одному на кандидата/токен).
    const allCandidateTokens = new Set<string>();
    for (const rel of toProcess) {
      for (const t of splitCandidateTokens(rel.target_text)) allCandidateTokens.add(t.toLowerCase());
    }

    const lexemeIdByLemma = new Map<string, string>();
    if (allCandidateTokens.size > 0) {
      const { data: componentRows } = await supabase
        .from('lexemes')
        .select('id, lemma')
        .in('lemma', [...allCandidateTokens]);
      for (const row of componentRows ?? []) {
        lexemeIdByLemma.set(String(row.lemma).toLowerCase(), row.id);
      }
    }

    const outcomes: Array<Record<string, unknown>> = [];
    let promoted = 0;
    let needsReview = 0;
    let unresolvable = 0;
    let failed = 0;
    let wouldPromote = 0;

    for (const rel of toProcess) {
      try {
        if (rel.source_entity_type !== 'lexeme') {
          if (!dryRun) await markRelation(rel.id, 'unresolvable', 'source_entity_type is not lexeme', rel.evidence);
          unresolvable++;
          outcomes.push({ relation_id: rel.id, target_text: rel.target_text, action: 'unresolvable', reason: 'source_entity_type is not lexeme' });
          continue;
        }

        const lemma = lemmaByLexemeId.get(rel.source_entity_id);
        if (!lemma) {
          if (!dryRun) await markRelation(rel.id, 'unresolvable', 'source lexeme not found', rel.evidence);
          unresolvable++;
          outcomes.push({ relation_id: rel.id, target_text: rel.target_text, action: 'unresolvable', reason: 'source lexeme not found' });
          continue;
        }

        const tokens = splitCandidateTokens(rel.target_text);
        if (tokens.length < 2) {
          if (!dryRun) await markRelation(rel.id, 'needs_review', `could not split into >=2 components: "${rel.target_text}"`, rel.evidence);
          needsReview++;
          outcomes.push({ relation_id: rel.id, lemma, target_text: rel.target_text, action: 'needs_review', reason: 'fewer than 2 tokens' });
          continue;
        }

        const reconstruction = tryReconstruct(lemma, tokens);
        if (!reconstruction) {
          if (!dryRun) {
            await markRelation(
              rel.id, 'needs_review',
              `no linking-element combination reproduces lemma "${lemma}" from [${tokens.join(', ')}]`,
              rel.evidence,
            );
          }
          needsReview++;
          outcomes.push({ relation_id: rel.id, lemma, target_text: rel.target_text, action: 'needs_review', reason: 'no reconstruction matched lemma', tokens });
          continue;
        }

        if (dryRun) {
          wouldPromote++;
          outcomes.push({
            relation_id: rel.id, lemma, target_text: rel.target_text,
            action: 'would_promote', parts: reconstruction.parts, links: reconstruction.links,
          });
          continue;
        }

        const { data: analysis, error: analysisError } = await supabase
          .from('lexeme_compound_analyses')
          .insert({
            compound_lexeme_id: rel.source_entity_id,
            analysis_type: 'compound',
            status: 'source_verified',
            component_count: reconstruction.parts.length,
            head_component_position: reconstruction.parts.length,
            confidence: confidenceToNumber(rel.confidence),
          })
          .select('id')
          .single();

        if (analysisError) throw analysisError;

        const componentRows = reconstruction.parts.map((part, idx) => ({
          compound_analysis_id: analysis.id,
          component_position: idx + 1,
          component_role:
            idx === 0 ? 'forledd'
            : idx === reconstruction.parts.length - 1 ? 'etterledd'
            : 'intermediate_component',
          component_lexeme_id: lexemeIdByLemma.get(part.toLowerCase()) ?? null,
          component_surface: part,
          linking_element_after: idx < reconstruction.links.length ? (reconstruction.links[idx] || null) : null,
          is_head: idx === reconstruction.parts.length - 1,
          metadata: {
            promoted_by: WORKER_NAME,
            relation_id: rel.id,
            source: rel.source,
          },
        }));

        const { error: componentsError } = await supabase
          .from('lexeme_compound_components')
          .insert(componentRows);

        if (componentsError) throw componentsError;

        // ФИКС (29.09.2026, найдено на живых данных — barnehage): раньше
        // тут был no-op UPDATE lemma=lemma, рассчитанный на переигровку
        // триггера d10_apply_verified_compound_projection. На практике
        // analyses/components записались верно, а проекция в
        // lexeme_form_display_v2 всё равно осталась false — ошибка этого
        // конкретного вызова не проверялась и тихо проглатывалась. Вместо
        // того чтобы полагаться на побочный эффект UPDATE'а, вызываем ту
        // же самую функцию d10_verified_compound_parts напрямую по RPC и
        // пишем результат явно — тот же источник истины, что и у триггера,
        // но без зависимости от того, сработает ли повторный триггер.
        const { data: verifiedParts, error: partsError } = await supabase.rpc(
          'd10_verified_compound_parts',
          { p_lexeme_id: rel.source_entity_id, p_lemma: lemma },
        );

        if (partsError) throw partsError;

        if (Array.isArray(verifiedParts) && verifiedParts.length >= 2) {
          const { error: projectionError } = await supabase
            .from('lexeme_form_display_v2')
            .update({
              is_compound: true,
              compound_parts: verifiedParts,
              headword: lemma,
            })
            .eq('lexeme_id', rel.source_entity_id);

          if (projectionError) throw projectionError;
        }

        await markRelation(rel.id, 'promoted', null, rel.evidence);

        promoted++;
        outcomes.push({
          relation_id: rel.id, lemma, target_text: rel.target_text,
          action: 'promoted', parts: reconstruction.parts, links: reconstruction.links,
          analysis_id: analysis.id,
        });
      } catch (e) {
        failed++;
        outcomes.push({ relation_id: rel.id, target_text: rel.target_text, action: 'failed', error: safeStringify(e) });
      }
    }

    return jsonResponse({
      ok: failed === 0,
      worker: WORKER_NAME,
      dry_run: dryRun,
      processed: toProcess.length,
      promoted,
      would_promote: wouldPromote,
      needs_review: needsReview,
      unresolvable,
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
