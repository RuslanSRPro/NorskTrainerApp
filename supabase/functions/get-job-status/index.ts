// supabase/functions/get-job-status/index.ts
// Polling endpoint for analyze-text background jobs.
//
// ПРАВКА: isReady теперь вычисляется из public.get_job_progress(job_id)
// (view job_progress_v), а не из lexeme_processing_jobs.status —
// это поле не обновляется синхронно с реальным состоянием
// lexeme_processing_items / lexeme_source_checks, из-за чего клиент
// мог получать status='pending' бесконечно, даже когда items реально
// уже done. Легковесный ответ теперь всегда содержит progress —
// клиент может рисовать прогресс-бар даже до готовности.
//
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // ФИКС: некоторые упрощённые "Test function" интерфейсы (Supabase
    // Dashboard) не дают способа указать query-параметр для GET-запроса —
    // только Request Body. Добавлен fallback: если job_id нет в URL,
    // пробуем прочитать его из тела запроса (как raw "job_id=..." или JSON).
    let jobId = url.searchParams.get('job_id');

    if (!jobId) {
      try {
        const rawBody = await req.text();

        if (rawBody) {
          // Пробуем как JSON: { "job_id": "..." }
          try {
            const parsed = JSON.parse(rawBody);
            if (parsed?.job_id) jobId = String(parsed.job_id);
          } catch {
            // Не JSON — пробуем как "job_id=..." (form-urlencoded/raw text)
            const match = rawBody.match(/job_id\s*=\s*["']?([0-9a-fA-F-]{36})["']?/);
            if (match) jobId = match[1];
          }
        }
      } catch {
        // тело не читается — оставляем jobId как null, ниже вернём 400
      }
    }

    if (!jobId) {
      return Response.json(
        { ok: false, error: 'job_id query param is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    // 1. Job row (для created_at/summary — метаданные, не для проверки готовности)
    const { data: job, error: jobError } = await supabase
      .from('lexeme_processing_jobs')
      .select(`
        id, status, total_items, done_items,
        partial_items, failed_items, skipped_items,
        summary, created_at, updated_at
      `)
      .eq('id', jobId)
      .single();

    if (jobError) throw jobError;

    // 2. Реальный прогресс — единственный источник правды для готовности.
    const { data: progressData, error: progressError } = await supabase
      .rpc('get_job_progress', { p_job_id: jobId });

    if (progressError) throw progressError;

    const progress = progressData ?? {
      job_id: jobId,
      total_items: 0,
      done_items: 0,
      pending_items: 0,
      failed_items: 0,
      stuck_items: 0,
      pending_checks: 0,
      progress_ratio: 0,
      progress_percent: 0,
      ready_for_promotion: false,
      has_stuck_items: false,
      status: 'not_started',
    };

    const isReady = progress.ready_for_promotion === true;
    let autoResumed = false;

    if (!isReady && job.status !== 'done') {
      try {
        const { data: shouldResume, error: resumeClaimError } = await supabase.rpc(
          'claim_job_resume',
          { p_job_id: jobId, p_stale_seconds: 90 },
        );

        if (resumeClaimError) {
          console.error('get-job-status: claim_job_resume failed', jobId, resumeClaimError);
        } else if (shouldResume === true) {
          console.log('get-job-status: auto-resuming stalled job', jobId);
          autoResumed = true;

          EdgeRuntime.waitUntil(
            fetch(`${SUPABASE_URL}/functions/v1/job-orchestrator`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ job_id: jobId }),
            }).catch((resumeError) => {
              console.error('get-job-status: auto-resume fetch failed', jobId, resumeError);
            }),
          );
        }
      } catch (resumeException) {
        console.error('get-job-status: auto-resume threw', jobId, resumeException);
      }
    }

    // 3. Если не готово — лёгкий ответ с прогрессом, без items.
    if (!isReady) {
      return Response.json(
        {
          ok: true,
          ready: false,
          auto_resumed: autoResumed,
          job,
          progress,
        },
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Готово — подтягиваем полные items с переводами + CEFR.
    const { data: items, error: itemsError } = await supabase
      .from('lexeme_processing_items')
      .select(`
        id, raw_input, normalized_input, normalized_lemma,
        surface_form, pos, match_type, expression_id, lexeme_id,
        status, current_stage, result_summary
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    const lexemeIds = (items ?? [])
      .map((i) => i.lexeme_id)
      .filter((id): id is string => Boolean(id));

    let lexemeMap = new Map<string, any>();
    if (lexemeIds.length > 0) {
      const { data: lexemeData } = await supabase
        .from('lexemes')
        .select('id, lemma, pos, cefr_level, frequency_rank, frequency_ipm')
        .in('id', lexemeIds);
      lexemeMap = new Map((lexemeData ?? []).map((l) => [l.id, l]));
    }

    let translationMap = new Map<string, { uk: string; en: string }>();
    if (lexemeIds.length > 0) {
      const { data: translations } = await supabase
        .from('entity_translations')
        .select('lexeme_id, language_code, translation')
        .in('lexeme_id', lexemeIds)
        .eq('source', 'lexin')
        .eq('translation_type', 'primary')
        .eq('sense_rank', 1)
        .eq('translation_rank', 1);

      for (const t of translations ?? []) {
        if (!translationMap.has(t.lexeme_id)) {
          translationMap.set(t.lexeme_id, { uk: '', en: '' });
        }
        const entry = translationMap.get(t.lexeme_id)!;
        if (t.language_code === 'uk') entry.uk = t.translation;
        if (t.language_code === 'en') entry.en = t.translation;
      }
    }

    const enrichedItems = (items ?? []).map((item) => {
      const lexeme = item.lexeme_id ? lexemeMap.get(item.lexeme_id) : null;
      const translation = item.lexeme_id ? translationMap.get(item.lexeme_id) : null;
      return {
        ...item,
        cefr_level: lexeme?.cefr_level ?? null,
        frequency_rank: lexeme?.frequency_rank ?? null,
        frequency_ipm: lexeme?.frequency_ipm ?? null,
        translation_uk: translation?.uk ?? null,
        translation_en: translation?.en ?? null,
      };
    });

    return Response.json(
      {
        ok: true,
        ready: true,
        job,
        progress,
        items: enrichedItems,
      },
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});