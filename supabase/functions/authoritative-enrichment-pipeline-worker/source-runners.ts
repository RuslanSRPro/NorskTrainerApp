import type { EnrichmentInput, SourceEvidence } from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function invokeWorker(
  workerName: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${workerName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  let json: unknown = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw_text: text };
  }

  if (!res.ok) {
    throw new WorkerHttpError(workerName, res.status, json);
  }

  return json;
}

export async function runOrdbokenePipeline(
  input: EnrichmentInput,
): Promise<SourceEvidence> {
  try {
    const payload = buildOrdbokenePayload(input);

    const result = await invokeWorker(
      'ordbokene-lexeme-pipeline-worker',
      payload,
    );

    return {
      source: 'ordbokene',
      status: extractOrdbokeneStatus(result, input),
      diagnostic_status: extractOrdbokeneDiagnosticStatus(result),
      confidence: extractOrdbokeneConfidence(result, input),
      success: true,
      raw: result,
    };
  } catch (error) {
    if (isOrdbokeneNotListedError(error)) {
      return {
        source: 'ordbokene',
        status: 'not_listed',
        diagnostic_status: 'article_not_found',
        confidence: 1.0,
        success: true,
        error: null,
        raw: {
          ok: true,
          recovered_from_worker_error: true,
          reason:
            'ordbokene-lexeme-pipeline-worker returned HTTP error for a valid not_listed case',
          original_error: serializeError(error),
        },
      };
    }

    return {
      source: 'ordbokene',
      status: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runNaobPipeline(
  input: EnrichmentInput,
): Promise<SourceEvidence> {
  try {
    const payload = buildNaobPayload(input);

    const result = await invokeWorker(
      'naob-pipeline-worker',
      payload,
    );

    return {
      source: 'naob',
      status: extractNaobStatus(result),
      diagnostic_status: extractNaobDiagnosticStatus(result),
      confidence: extractNaobConfidence(result),
      success: true,
      raw: result,
    };
  } catch (error) {
    return {
      source: 'naob',
      status: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildOrdbokenePayload(
  input: EnrichmentInput,
): Record<string, unknown> {
  const lemma = normalizeText(input.lemma);

  if (!lemma && !input.expression_id && !input.lexeme_id) {
    throw new Error(
      'Ordbokene payload requires lemma, expression_id, or lexeme_id',
    );
  }

  return removeUndefined({
    item_type: input.item_type,
    lemma,
    expression_lemma:
      input.item_type === 'expression'
        ? lemma
        : undefined,
    expression_id: input.expression_id,
    lexeme_id: input.lexeme_id,
    pos: input.pos,
    force_refresh: input.force_refresh ?? false,
    update_catalog: input.update_catalog ?? true,
  });
}

function buildNaobPayload(
  input: EnrichmentInput,
): Record<string, unknown> {
  const lemma = normalizeText(input.lemma);
  const sourceLemma = normalizeText(input.source_lemma);

  if (input.item_type === 'expression') {
    if (!lemma) {
      throw new Error('NAOB expression payload requires lemma');
    }

    if (!sourceLemma) {
      throw new Error('NAOB expression payload requires source_lemma');
    }

    return removeUndefined({
      expression_lemma: lemma,
      source_lemma: sourceLemma,
      candidate_slugs: input.candidate_slugs,
      expression_id: input.expression_id,
      force_refresh: input.force_refresh ?? false,
      update_catalog: input.update_catalog ?? true,
    });
  }

  if (input.item_type === 'lexeme') {
    if (!lemma) {
      throw new Error('NAOB lexeme payload requires lemma');
    }

    return removeUndefined({
      lemma,
      source_lemma: sourceLemma || lemma,
      lexeme_id: input.lexeme_id,
      pos: input.pos,
      force_refresh: input.force_refresh ?? false,
      update_catalog: input.update_catalog ?? true,
    });
  }

  throw new Error(`Unsupported item_type: ${input.item_type}`);
}

function extractOrdbokeneStatus(
  result: unknown,
  input: EnrichmentInput,
): string | null {
  if (!result || typeof result !== 'object') return null;

  const direct =
    extractStatus(result, 'ordbokene_status') ??
    extractStatus(result, 'status');

  if (direct) return normalizeNegativeStatus(direct);

  const obj = result as Record<string, unknown>;
  const steps = asRecord(obj.steps);
  const articleLookup = asRecord(steps?.article_lookup);
  const articleId = articleLookup?.article_id;

  const hasArticle =
    articleLookup?.ok === true &&
    (typeof articleId === 'number' || typeof articleId === 'string');

  if (hasArticle && input.item_type === 'expression') {
    return 'expr_entry';
  }

  if (hasArticle && input.item_type === 'lexeme') {
    return 'entry';
  }

  return null;
}

function extractOrdbokeneDiagnosticStatus(
  result: unknown,
): string | null {
  if (!result || typeof result !== 'object') return null;

  const direct =
    extractStatus(result, 'ordbokene_diagnostic_status') ??
    extractStatus(result, 'diagnostic_status');

  if (direct) return direct;

  const obj = result as Record<string, unknown>;
  const steps = asRecord(obj.steps);
  const articleLookup = asRecord(steps?.article_lookup);
  const articleId = articleLookup?.article_id;

  if (
    articleLookup?.ok === true &&
    (typeof articleId === 'number' || typeof articleId === 'string')
  ) {
    return 'matched_article_lookup';
  }

  return null;
}

function extractOrdbokeneConfidence(
  result: unknown,
  input: EnrichmentInput,
): number | null {
  const direct = extractConfidence(result);

  if (direct !== null) return direct;

  const status = extractOrdbokeneStatus(result, input);

  switch (status) {
    case 'expr_entry':
      return 1.0;
    case 'entry':
      return 1.0;
    case 'sub_article':
      return 0.9;
    case 'article_ref':
      return 0.6;
    case 'not_listed':
      return 1.0;
    default:
      return null;
  }
}

function extractNaobStatus(result: unknown): string | null {
  const direct =
    extractStatus(result, 'naob_status') ??
    extractStatus(result, 'status');

  if (direct) return normalizeNegativeStatus(direct);

  const obj = asRecord(result);
  const resultObj = asRecord(obj?.result);

  if (resultObj?.matched === false) {
    return 'not_listed';
  }

  const steps = asRecord(obj?.steps);
  const batch = asRecord(steps?.naob_expression_batch_worker);
  const data = asRecord(batch?.data);

  if (data?.matched === false) {
    return 'not_listed';
  }

  const attempts = Array.isArray(data?.attempts) ? data.attempts : [];

  if (
    attempts.length > 0 &&
    attempts.every((attempt) => {
      const attemptObj = asRecord(attempt);
      return attemptObj?.naob_status === 'not_found';
    })
  ) {
    return 'not_listed';
  }

  return null;
}

function extractNaobDiagnosticStatus(result: unknown): string | null {
  const direct =
    extractStatus(result, 'diagnostic_status') ??
    extractStatus(result, 'naob_diagnostic_status');

  if (direct) return direct;

  const obj = asRecord(result);
  const resultObj = asRecord(obj?.result);

  if (resultObj?.matched === false) {
    return 'expression_not_found_in_candidate_articles';
  }

  const steps = asRecord(obj?.steps);
  const batch = asRecord(steps?.naob_expression_batch_worker);
  const data = asRecord(batch?.data);

  if (data?.matched === false) {
    return 'expression_not_found_in_candidate_articles';
  }

  return null;
}

function extractNaobConfidence(result: unknown): number | null {
  const direct = extractConfidence(result);

  if (direct !== null) return direct;

  const status = extractNaobStatus(result);

  switch (status) {
    case 'uttrykk':
      return 1.0;
    case 'example':
      return 0.8;
    case 'not_listed':
      return 1.0;
    default:
      return null;
  }
}

function extractStatus(
  result: unknown,
  key: string,
): string | null {
  if (!result || typeof result !== 'object') return null;

  const obj = result as Record<string, unknown>;

  if (typeof obj[key] === 'string') {
    return obj[key] as string;
  }

  if (
    obj.result &&
    typeof obj.result === 'object' &&
    typeof (obj.result as Record<string, unknown>)[key] === 'string'
  ) {
    return (obj.result as Record<string, unknown>)[key] as string;
  }

  if (
    obj.data &&
    typeof obj.data === 'object' &&
    typeof (obj.data as Record<string, unknown>)[key] === 'string'
  ) {
    return (obj.data as Record<string, unknown>)[key] as string;
  }

  if (
    obj.evidence &&
    typeof obj.evidence === 'object' &&
    typeof (obj.evidence as Record<string, unknown>)[key] === 'string'
  ) {
    return (obj.evidence as Record<string, unknown>)[key] as string;
  }

  return null;
}

function extractConfidence(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;

  const obj = result as Record<string, unknown>;

  if (typeof obj.confidence === 'number') {
    return obj.confidence;
  }

  if (
    obj.result &&
    typeof obj.result === 'object' &&
    typeof (obj.result as Record<string, unknown>).confidence === 'number'
  ) {
    return (obj.result as Record<string, unknown>).confidence as number;
  }

  if (
    obj.data &&
    typeof obj.data === 'object' &&
    typeof (obj.data as Record<string, unknown>).confidence === 'number'
  ) {
    return (obj.data as Record<string, unknown>).confidence as number;
  }

  if (
    obj.evidence &&
    typeof obj.evidence === 'object' &&
    typeof (obj.evidence as Record<string, unknown>).confidence === 'number'
  ) {
    return (obj.evidence as Record<string, unknown>).confidence as number;
  }

  return null;
}

function isOrdbokeneNotListedError(error: unknown): boolean {
  const text = serializeError(error);
  return text.includes('No Ordbokene article found for lemma=');
}

function normalizeNegativeStatus(status: string): string {
  if (status === 'not_found') return 'not_listed';
  return status;
}

function normalizeText(value?: string): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ');

  return normalized.length > 0 ? normalized : undefined;
}

function removeUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  );
}

function asRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

function serializeError(error: unknown): string {
  try {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

class WorkerHttpError extends Error {
  workerName: string;
  status: number;
  payload: unknown;

  constructor(workerName: string, status: number, payload: unknown) {
    super(`${workerName} failed: ${status} ${JSON.stringify(payload)}`);
    this.name = 'WorkerHttpError';
    this.workerName = workerName;
    this.status = status;
    this.payload = payload;
  }
}