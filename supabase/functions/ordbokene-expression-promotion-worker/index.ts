import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function tokenCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function firstExample(examples: unknown): string | null {
  if (!Array.isArray(examples)) return null;

  const first = examples.find(
    (item) => typeof item === 'string' && item.trim(),
  );

  return typeof first === 'string' ? first.trim() : null;
}

// ФИКС: raw Postgres unique_violation error code — используется для
// распознавания race condition при INSERT (см. комментарий ниже).
const POSTGRES_UNIQUE_VIOLATION = '23505';

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 20), 100);
    const dryRun = Boolean(body.dry_run ?? true);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { ok: false, error: 'Missing Supabase env vars' },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: candidates, error: candidateError } = await supabase
      .from('ordbokene_expression_candidates')
      .select(
        [
          'id',
          'lemma',
          'normalized_key',
          'definition_preview',
          'examples',
          'candidate_article_id',
          'candidate_dictionary_code',
          'candidate_kind',
          'status',
          'promoted_expression_id',
          'parent_lemma',            // used as root_lemma in expression_catalog
        ].join(', '),
      )
      .eq('status', 'candidate')
      .eq('candidate_kind', 'expression')
      .is('promoted_expression_id', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (candidateError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_candidates',
          error: candidateError.message,
          details: candidateError,
        },
        500,
      );
    }

    const results = [];

    // ФИКС: вынесена в отдельную функцию — используется и на "нормальном"
    // пути (нашли existingExpression через SELECT сразу), и на "аварийном"
    // пути (проиграли гонку при INSERT, перечитали и обрабатываем как
    // duplicate). Раньше эта логика была только инлайн в одном месте —
    // теперь переиспользуется без дублирования.
    async function markAsDuplicateAndBackfill(
      candidate: any,
      normalizedKey: string,
      rootLemma: string | null,
      reviewPriority: string,
      reviewReason: string | null,
      existingExpression: { id: string; normalized_key: string; ordbokene_status: string | null; root_lemma: string | null },
      noteOverride?: string,
    ) {
      let ordbokeneStatusBackfilled = false;
      let rootLemmaBackfilled = false;

      if (!dryRun) {
        const { error: duplicateUpdateError } = await supabase
          .from('ordbokene_expression_candidates')
          .update({
            status: 'duplicate',
            promoted_expression_id: existingExpression.id,
            review_priority: reviewPriority,
            review_reason: reviewReason,
            review_note:
              noteOverride ??
              'Promotion skipped: matched existing expression_catalog.normalized_key',
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidate.id);

        if (duplicateUpdateError) {
          throw Object.assign(new Error('mark_duplicate_failed'), {
            stage: 'mark_duplicate',
            candidate_id: candidate.id,
            details: duplicateUpdateError,
          });
        }

        const catalogUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (existingExpression.ordbokene_status !== 'expr_entry') {
          catalogUpdates.ordbokene_status = 'sub_article';
          ordbokeneStatusBackfilled = true;
        }

        if (!existingExpression.root_lemma && rootLemma) {
          catalogUpdates.root_lemma = rootLemma;
          rootLemmaBackfilled = true;
        }

        if (Object.keys(catalogUpdates).length > 1) {
          const { error: backfillError } = await supabase
            .from('expression_catalog')
            .update(catalogUpdates)
            .eq('id', existingExpression.id);

          if (backfillError) {
            throw Object.assign(new Error('backfill_failed'), {
              stage: 'backfill_expression_catalog',
              candidate_id: candidate.id,
              expression_id: existingExpression.id,
              details: backfillError,
            });
          }
        }
      }

      return { ordbokeneStatusBackfilled, rootLemmaBackfilled };
    }

    for (const candidate of candidates ?? []) {
      const normalizedKey = normalizeKey(
        candidate.normalized_key ?? candidate.lemma,
      );

      const tokens = tokenCount(candidate.lemma);

      const reviewPriority = tokens <= 2 ? 'high' : 'normal';

      const reviewReason =
        tokens <= 2
          ? 'Short phrasal expression: valuable but higher duplicate/ambiguity risk'
          : null;

      // root_lemma: the parent article lemma from which this expression was
      // discovered. Stored in expression_catalog so that lexin-enrichment-worker
      // can use it as root_word in expression mode without manual lookup.
      // e.g. "legge merke til" → parent_lemma = "merke"
      const rootLemma = candidate.parent_lemma
        ? normalizeKey(String(candidate.parent_lemma))
        : null;

      const { data: existingExpression, error: existingError } = await supabase
        .from('expression_catalog')
        .select('id, normalized_key, ordbokene_status, root_lemma')
        .eq('normalized_key', normalizedKey)
        .maybeSingle();

      if (existingError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'check_existing_expression',
            normalized_key: normalizedKey,
            error: existingError.message,
            details: existingError,
          },
          500,
        );
      }

      if (existingExpression) {
        try {
          const { ordbokeneStatusBackfilled, rootLemmaBackfilled } =
            await markAsDuplicateAndBackfill(
              candidate,
              normalizedKey,
              rootLemma,
              reviewPriority,
              reviewReason,
              existingExpression,
            );

          results.push({
            candidate_id: candidate.id,
            lemma: candidate.lemma,
            normalized_key: normalizedKey,
            token_count: tokens,
            review_priority: reviewPriority,
            review_reason: reviewReason,
            root_lemma: rootLemma,
            action: dryRun ? 'would_mark_duplicate' : 'marked_duplicate',
            expression_id: existingExpression.id,
            ordbokene_status_backfilled: ordbokeneStatusBackfilled,
            root_lemma_backfilled: rootLemmaBackfilled,
          });
        } catch (e: any) {
          return jsonResponse(
            { ok: false, stage: e.stage ?? 'mark_duplicate', candidate_id: candidate.id, error: e.message, details: e.details },
            500,
          );
        }

        continue;
      }

      const sourceUrl =
        `https://ord.uib.no/${candidate.candidate_dictionary_code}/article/${candidate.candidate_article_id}.json`;

      if (dryRun) {
        results.push({
          candidate_id: candidate.id,
          lemma: candidate.lemma,
          normalized_key: normalizedKey,
          token_count: tokens,
          review_priority: reviewPriority,
          review_reason: reviewReason,
          root_lemma: rootLemma,
          action: 'would_promote',
          source_url: sourceUrl,
        });

        continue;
      }

      const { data: insertedExpression, error: insertError } = await supabase
        .from('expression_catalog')
        .insert({
          lemma: candidate.lemma,
          display_form: candidate.lemma,
          normalized_key: normalizedKey,
          language: 'no',
          pos: 'expression',
          expression_subtype: 'ordbokene_sub_article',

          // root_lemma enables autonomous lexin-enrichment-worker orchestration:
          // the orchestrator reads this field and passes it as root_word.
          root_lemma: rootLemma,

          example: firstExample(candidate.examples),
          notes_ua: null,

          source_ordbokene: true,
          source_manual: false,
          source_gemini: false,
          source_naob: false,
          source_wiktionary: false,

          source_urls: [sourceUrl],

          raw_sources: {
            source: 'Ordbokene',
            source_type: 'sub_article',
            article_id: candidate.candidate_article_id,
            dictionary_code: candidate.candidate_dictionary_code,
            definition_preview: candidate.definition_preview,
            examples: candidate.examples ?? [],
            token_count: tokens,
            review_priority: reviewPriority,
            review_reason: reviewReason,
          },

          ordbokene_status: 'sub_article',

          verification: 'needs_review',
          confidence: 'medium',
          verification_status: 'candidate',
          verification_tier: 'candidate',

          verification_evidence: {
            source: 'Ordbokene',
            evidence_type: 'sub_article',
            article_id: candidate.candidate_article_id,
            dictionary_code: candidate.candidate_dictionary_code,
            source_url: sourceUrl,
            definition_preview: candidate.definition_preview,
            token_count: tokens,
            review_priority: reviewPriority,
            review_reason: reviewReason,
          },

          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      // ============================================================
      // ФИКС: race condition ("duplicate key value violates unique
      // constraint expression_catalog_unique_key"). Между SELECT-проверкой
      // выше (существует ли строка) и этим INSERT другой параллельный
      // вызов этой же функции (для другого lexeme/job, но той же
      // normalized_key) мог успеть вставить строку раньше нас — classic
      // TOCTOU race, усилившаяся сегодня после включения параллельной
      // обработки нескольких job'ов одновременно (MAX_JOBS_PER_TICK=3,
      // CONCURRENCY=3 в job-enrichment-batch-worker).
      //
      // Раньше это приводило к падению всего item'а с 500 и попаданием
      // job'а в needs_manual_review — хотя по сути ничего плохого не
      // произошло, мы просто проиграли гонку за создание той же самой
      // записи. Теперь: если INSERT падает именно с unique_violation
      // (23505) — считаем это НЕ ошибкой, а "нас опередили", перечитываем
      // выигравшую строку и обрабатываем её ТЕМ ЖЕ путём, что и обычный
      // duplicate (backfill root_lemma/ordbokene_status при необходимости).
      // ============================================================
      if (insertError) {
        const isRaceCondition =
          insertError.code === POSTGRES_UNIQUE_VIOLATION ||
          /duplicate key value violates unique constraint/i.test(insertError.message ?? '');

        if (isRaceCondition) {
          const { data: winnerExpression, error: winnerError } = await supabase
            .from('expression_catalog')
            .select('id, normalized_key, ordbokene_status, root_lemma')
            .eq('normalized_key', normalizedKey)
            .maybeSingle();

          if (winnerError || !winnerExpression) {
            // Крайне маловероятно (строка должна существовать, раз именно
            // она вызвала unique_violation), но на всякий случай — не
            // маскируем настоящую проблему тихим success.
            return jsonResponse(
              {
                ok: false,
                stage: 'race_condition_recovery_failed',
                candidate_id: candidate.id,
                normalized_key: normalizedKey,
                original_insert_error: insertError.message,
                recovery_error: winnerError?.message ?? 'expression not found after unique_violation',
              },
              500,
            );
          }

          try {
            const { ordbokeneStatusBackfilled, rootLemmaBackfilled } =
              await markAsDuplicateAndBackfill(
                candidate,
                normalizedKey,
                rootLemma,
                reviewPriority,
                reviewReason,
                winnerExpression,
                'Promotion lost a race condition with a concurrent insert; recovered as duplicate.',
              );

            results.push({
              candidate_id: candidate.id,
              lemma: candidate.lemma,
              normalized_key: normalizedKey,
              token_count: tokens,
              review_priority: reviewPriority,
              review_reason: reviewReason,
              root_lemma: rootLemma,
              action: 'marked_duplicate_after_race',
              expression_id: winnerExpression.id,
              ordbokene_status_backfilled: ordbokeneStatusBackfilled,
              root_lemma_backfilled: rootLemmaBackfilled,
            });
          } catch (e: any) {
            return jsonResponse(
              { ok: false, stage: e.stage ?? 'mark_duplicate_after_race', candidate_id: candidate.id, error: e.message, details: e.details },
              500,
            );
          }

          continue;
        }

        // Не race condition — настоящая ошибка, ведём себя как раньше.
        return jsonResponse(
          {
            ok: false,
            stage: 'insert_expression_catalog',
            candidate_id: candidate.id,
            lemma: candidate.lemma,
            normalized_key: normalizedKey,
            error: insertError.message,
            details: insertError,
          },
          500,
        );
      }

      const { error: updateError } = await supabase
        .from('ordbokene_expression_candidates')
        .update({
          status: 'promoted',
          promoted_expression_id: insertedExpression.id,
          promoted_at: new Date().toISOString(),
          review_priority: reviewPriority,
          review_reason: reviewReason,
          review_note:
            reviewReason ??
            'Promoted to expression_catalog from Ordbokene sub_article',
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);

      if (updateError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'update_candidate_promoted',
            candidate_id: candidate.id,
            expression_id: insertedExpression.id,
            error: updateError.message,
            details: updateError,
          },
          500,
        );
      }

      results.push({
        candidate_id: candidate.id,
        lemma: candidate.lemma,
        normalized_key: normalizedKey,
        token_count: tokens,
        review_priority: reviewPriority,
        review_reason: reviewReason,
        root_lemma: rootLemma,
        action: 'promoted',
        expression_id: insertedExpression.id,
      });
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      processed: candidates?.length ?? 0,
      would_promote: results.filter((r) => r.action === 'would_promote').length,
      promoted: results.filter((r) => r.action === 'promoted').length,
      duplicates: results.filter(
        (r) =>
          r.action === 'would_mark_duplicate' ||
          r.action === 'marked_duplicate' ||
          r.action === 'marked_duplicate_after_race',
      ).length,
      high_review_priority: results.filter(
        (r) => r.review_priority === 'high',
      ).length,
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