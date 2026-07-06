import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  CURRENT_RUN_ID,
  CURRENT_VERIFICATION_VERSION,
  CURRENT_METHOD_VERSION,
  DEFAULT_BATCH_SIZE,
} from '../_shared/lexicon-run-config.ts';

const WORKER_NAME = 'lexicon-refresh-orchestrator';

type EntityTable =
  | 'expression_catalog'
  | 'lexemes'
  | 'lexeme_form_variants'
  | 'lexeme_relations'
  | 'semantic_unit_relations'
  | 'lexeme_semantic_enrichment'
  | 'expression_semantic_enrichment';

type RequestBody = {
  entityTable?: EntityTable;
  entityType?: string;
  batchSize?: number;
  runId?: string;
};

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const body = await safeJson<RequestBody>(req);

  const runId = body.runId ?? CURRENT_RUN_ID;
  const batchSize = body.batchSize ?? DEFAULT_BATCH_SIZE;
  const entityTable = body.entityTable ?? 'expression_catalog';
  const entityType = body.entityType ?? 'expression';

  const batchId = `${entityTable}-${Date.now()}`;

  await supabase.rpc('start_lexicon_batch', {
    p_run_id: runId,
    p_batch_id: batchId,
    p_worker_name: WORKER_NAME,
    p_entity_table: entityTable,
    p_entity_type: entityType,
    p_batch_size: batchSize,
    p_metadata: {
      verification_version: CURRENT_VERIFICATION_VERSION,
      method_version: CURRENT_METHOD_VERSION,
    },
  });

  try {
    const { data: batch, error: batchError } = await getBatch(
      supabase,
      entityTable,
      runId,
      batchSize,
    );

    if (batchError) throw batchError;

    const rows = batch ?? [];

    if (rows.length === 0) {
      await supabase.rpc('finish_lexicon_batch', {
        p_run_id: runId,
        p_batch_id: batchId,
        p_worker_name: WORKER_NAME,
        p_status: 'finished',
        p_processed_count: 0,
        p_updated_count: 0,
        p_inserted_count: 0,
        p_failed_count: 0,
        p_error_message: null,
        p_metadata: { message: 'No rows to process' },
      });

      return jsonResponse({
        ok: true,
        runId,
        batchId,
        entityTable,
        processed: 0,
        message: 'No rows to process',
      });
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      processed++;

      try {
        const before = { ...row };

        /*
          Здесь позже будет полный pipeline:

          1. verification worker
          2. forms worker
          3. semantic worker
          4. relations worker
          5. promotion SQL v9
          6. read final row
          7. log final change

          Сейчас делаем минимальный safe refresh-mark,
          чтобы проверить orchestration layer.
        */

        const patch = {
          verification_version: CURRENT_VERIFICATION_VERSION,
          verification_method_version: CURRENT_METHOD_VERSION,
          last_verification_run: runId,
          source_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: updatedRow, error: updateError } = await supabase
          .from(entityTable)
          .update(patch)
          .eq('id', row.id)
          .select('*')
          .single();

        if (updateError) throw updateError;

        const after = updatedRow;

        await supabase.rpc('log_lexicon_final_change', {
          p_entity_table: entityTable,
          p_entity_type: entityType,
          p_entity_id: row.id,
          p_lemma: row.lemma ?? row.value ?? null,
          p_run_id: runId,
          p_change_type: 'verification',
          p_change_source: WORKER_NAME,
          p_old_values: before,
          p_new_values: after,
          p_verification_version: CURRENT_VERIFICATION_VERSION,
          p_method_version: CURRENT_METHOD_VERSION,
          p_worker_name: WORKER_NAME,
          p_job_id: batchId,
          p_created_by: WORKER_NAME,
        });

        updated++;
      } catch (rowError) {
        failed++;

        console.log('[ORCHESTRATOR] row failed', {
          entityTable,
          rowId: row.id,
          error: rowError,
        });
      }
    }

    await supabase.rpc('finish_lexicon_batch', {
      p_run_id: runId,
      p_batch_id: batchId,
      p_worker_name: WORKER_NAME,
      p_status: failed > 0 ? 'finished_with_errors' : 'finished',
      p_processed_count: processed,
      p_updated_count: updated,
      p_inserted_count: 0,
      p_failed_count: failed,
      p_error_message: failed > 0 ? `${failed} rows failed` : null,
      p_metadata: {
        entity_table: entityTable,
        entity_type: entityType,
      },
    });

    return jsonResponse({
      ok: true,
      runId,
      batchId,
      entityTable,
      processed,
      updated,
      failed,
    });
  } catch (error) {
    await supabase.rpc('finish_lexicon_batch', {
      p_run_id: runId,
      p_batch_id: batchId,
      p_worker_name: WORKER_NAME,
      p_status: 'failed',
      p_processed_count: 0,
      p_updated_count: 0,
      p_inserted_count: 0,
      p_failed_count: 1,
      p_error_message: String(error),
      p_metadata: {},
    });

    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
});

async function getBatch(
  supabase: any,
  entityTable: EntityTable,
  runId: string,
  batchSize: number,
) {
  if (entityTable === 'expression_catalog') {
    return await supabase
      .from('expression_catalog')
      .select('*')
      .neq('last_verification_run', runId)
      .order('lemma', { ascending: true })
      .limit(batchSize);
  }

  if (entityTable === 'lexemes') {
    return await supabase
      .from('lexemes')
      .select('*')
      .neq('last_verification_run', runId)
      .order('lemma', { ascending: true })
      .limit(batchSize);
  }

  if (entityTable === 'lexeme_form_variants') {
    return await supabase
      .from('lexeme_form_variants')
      .select('*')
      .neq('last_verification_run', runId)
      .order('normalized_value', { ascending: true })
      .limit(batchSize);
  }

  return await supabase
    .from(entityTable)
    .select('*')
    .neq('last_verification_run', runId)
    .order('created_at', { ascending: true })
    .limit(batchSize);
}

async function safeJson<T>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch {
    return {} as T;
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}