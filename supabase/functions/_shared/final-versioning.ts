// supabase/functions/_shared/final-versioning.ts
// Norsk Trainer — Final Versioning Helper
//
// Purpose:
//   Capture final OLD → NEW state for lexicon entities after a text-analysis job
//   has completed its full job-orchestrator flow.
//
// Important:
//   This helper does not update lexicon data.
//   It only reads final rows and calls public.log_lexicon_final_change().

type SupabaseLike = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data?: unknown;
    error?: unknown;
  }>;
};

type RawJobItem = {
  expression_id?: string | null;
  lexeme_id?: string | null;
};

export type JobEntityRow = {
  entity_table: string;
  entity_type: string;
  entity_id: string;
  lemma: string | null;
  row_data: Record<string, unknown>;
};

const VERSIONING_WORKER_NAME = 'final-versioning';

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

export async function loadJobEntities(
  supabase: SupabaseLike,
  jobId: string,
): Promise<JobEntityRow[]> {
  const { data: items, error } = await supabase
    .from('lexeme_processing_items')
    .select('expression_id, lexeme_id')
    .eq('job_id', jobId);

  if (error) throw error;

  const rawItems = (items ?? []) as RawJobItem[];

  const expressionIds = uniqueStrings(
    rawItems.map((item) => item.expression_id),
  );

  const lexemeIds = uniqueStrings(
    rawItems.map((item) => item.lexeme_id),
  );

  const result: JobEntityRow[] = [];

  if (expressionIds.length > 0) {
    const { data, error: expressionError } = await supabase
      .from('expression_catalog')
      .select('*')
      .in('id', expressionIds);

    if (expressionError) throw expressionError;

    for (const row of data ?? []) {
      result.push({
        entity_table: 'expression_catalog',
        entity_type: 'expression',
        entity_id: row.id,
        lemma: row.lemma ?? null,
        row_data: row,
      });
    }
  }

  if (lexemeIds.length > 0) {
    const { data, error: lexemeError } = await supabase
      .from('lexemes')
      .select('*')
      .in('id', lexemeIds);

    if (lexemeError) throw lexemeError;

    for (const row of data ?? []) {
      result.push({
        entity_table: 'lexemes',
        entity_type: 'lexeme',
        entity_id: row.id,
        lemma: row.lemma ?? null,
        row_data: row,
      });
    }
  }

  return result;
}

export async function versionCompletedJob(
  supabase: SupabaseLike,
  args: {
    jobId: string;
    runId: string;
    before: JobEntityRow[];
    verificationVersion: number;
    methodVersion: number;
  },
): Promise<{
  logged_attempts: number;
  entities_seen: number;
}> {
  const after = await loadJobEntities(supabase, args.jobId);

  const beforeMap = new Map(
    args.before.map((row) => [
      `${row.entity_table}:${row.entity_id}`,
      row,
    ]),
  );

  let loggedAttempts = 0;

  for (const afterRow of after) {
    const key = `${afterRow.entity_table}:${afterRow.entity_id}`;
    const beforeRow = beforeMap.get(key);

    const { error } = await supabase.rpc(
      'log_lexicon_final_change',
      {
        p_entity_table: afterRow.entity_table,
        p_entity_type: afterRow.entity_type,
        p_entity_id: afterRow.entity_id,
        p_lemma: afterRow.lemma,
        p_run_id: args.runId,
        p_change_type: 'final_version',
        p_change_source: VERSIONING_WORKER_NAME,
        p_old_values: beforeRow?.row_data ?? {},
        p_new_values: afterRow.row_data,
        p_verification_version: args.verificationVersion,
        p_method_version: args.methodVersion,
        p_worker_name: VERSIONING_WORKER_NAME,
        p_job_id: args.jobId,
        p_created_by: VERSIONING_WORKER_NAME,
      },
    );

    if (error) {
      throw new Error(
        `log_lexicon_final_change failed for ${key}: ${JSON.stringify(error)}`,
      );
    }

    loggedAttempts++;
  }

  return {
    logged_attempts: loggedAttempts,
    entities_seen: after.length,
  };
}