// supabase/functions/_shared/change-log.ts
// Norsk Trainer — Lexicon Change Log v2
//
// Universal audit helper for dictionary / lexicon changes.
//
// It compares BEFORE and AFTER objects and writes only real changes to
// public.lexicon_change_log.
//
// Intended usage from any worker:
//
//   await logLexiconChanges(supabase, {
//     entityType: 'expression_catalog',
//     entityId,
//     lemma,
//     runId: LEXICON_RUN_ID,
//     workerName: WORKER_NAME,
//     jobId,
//     changeType: 'verification',
//     before,
//     after,
//     verificationVersion: VERIFICATION_VERSION,
//     methodVersion: VERIFICATION_METHOD_VERSION,
//   });
//
// Important:
//   This helper does NOT update the source table.
//   It only logs differences.

type SupabaseLike = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{
      data?: unknown;
      error?: unknown;
    }>;
  };
};

export type LexiconChangeType =
  | 'insert'
  | 'update'
  | 'delete'
  | 'enrichment'
  | 'verification'
  | 'relation'
  | 'translation'
  | 'forms';

export type LogLexiconChangesArgs = {
  entityType:
    | 'lexeme'
    | 'expression_catalog'
    | 'lexeme_form_variant'
    | 'lexeme_relation'
    | 'semantic_relation'
    | 'translation'
    | string;

  entityId: string;
  lemma?: string | null;

  runId: string;
  jobId?: string | null;
  workerName?: string | null;

  changeType?: LexiconChangeType;
  changeSource?: string;

  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;

  verificationVersion?: number | null;
  methodVersion?: number | null;

  ignoreFields?: string[];
};

const DEFAULT_IGNORE_FIELDS = new Set([
  'updated_at',
  'created_at',
]);

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function normalizeObject(
  value?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!value) return {};

  const out: Record<string, unknown> = {};

  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue === undefined) continue;
    out[key] = fieldValue;
  }

  return out;
}

export function diffObjects(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
  ignoreFields: string[] = [],
): {
  changedFields: string[];
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
} {
  const ignored = new Set([...DEFAULT_IGNORE_FIELDS, ...ignoreFields]);

  const beforeObj = normalizeObject(before);
  const afterObj = normalizeObject(after);

  const keys = new Set([
    ...Object.keys(beforeObj),
    ...Object.keys(afterObj),
  ]);

  const changedFields: string[] = [];
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const key of [...keys].sort()) {
    if (ignored.has(key)) continue;

    const oldValue = beforeObj[key];
    const newValue = afterObj[key];

    if (stableStringify(oldValue) !== stableStringify(newValue)) {
      changedFields.push(key);
      oldValues[key] = oldValue ?? null;
      newValues[key] = newValue ?? null;
    }
  }

  return {
    changedFields,
    oldValues,
    newValues,
  };
}

export async function logLexiconChanges(
  supabase: SupabaseLike,
  args: LogLexiconChangesArgs,
): Promise<{
  logged: boolean;
  changed_fields: string[];
  error?: unknown;
}> {
  const diff = diffObjects(
    args.before,
    args.after,
    args.ignoreFields ?? [],
  );

  if (diff.changedFields.length === 0) {
    return {
      logged: false,
      changed_fields: [],
    };
  }

  const workerName =
    args.workerName ??
    args.changeSource ??
    'pipeline';

  const payload = {
    entity_type: args.entityType,
    entity_id: args.entityId,
    lemma: args.lemma ?? null,
    run_id: args.runId,
    job_id: args.jobId ?? null,
    worker_name: workerName,
    change_type: args.changeType ?? 'update',
    change_source: args.changeSource ?? workerName,
    old_values: diff.oldValues,
    new_values: diff.newValues,
    changed_fields: diff.changedFields,
    verification_version: args.verificationVersion ?? null,
    method_version: args.methodVersion ?? null,
  };

  const { error } = await supabase
    .from('lexicon_change_log')
    .insert(payload);

  if (error) {
    console.log('[LEXICON CHANGE LOG] insert failed', {
      entityType: args.entityType,
      entityId: args.entityId,
      runId: args.runId,
      jobId: args.jobId ?? null,
      workerName,
      changedFields: diff.changedFields,
      error,
    });

    return {
      logged: false,
      changed_fields: diff.changedFields,
      error,
    };
  }

  return {
    logged: true,
    changed_fields: diff.changedFields,
  };
}