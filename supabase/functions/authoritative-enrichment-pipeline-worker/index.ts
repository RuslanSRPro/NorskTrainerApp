import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { EnrichmentInput } from './types.ts';
import { runNaobPipeline, runOrdbokenePipeline } from './source-runners.ts';
import { buildUnifiedEvidenceSummary } from './evidence-summary.ts';
import { logLexiconChanges } from '../_shared/change-log.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Expression promotion types ────────────────────────────────────────────────
//
// Verification status ladder for expression_catalog:
//
//   candidate
//       ↓
//   usage_verified   ← confirmed by usage evidence (e.g. Ordbokene sub_article)
//       ↓
//   authoritative    ← confirmed by one registered dictionary entry
//       ↓
//   multi_source     ← confirmed by 2+ independent sources
//
// IMPORTANT v6 behavior:
//   - verification_status contains ONLY trust level.
//   - verification_method contains HOW the status was derived.
//   - verification_source contains primary source, when applicable.
//   - Downgrade is currently ALLOWED because the existing database may contain
//     over-verified statuses from old test pipelines.
//   - If input.expression_id is missing or stale, Promotion tries to recover the
//     expression_catalog row by normalized_key / lemma before skipping.
//   - After a full dictionary refresh, add max-status upgrade-only logic.
//
// Promotion happens here (Enrichment), not in semantic-audit-worker.
// Reason: lexeme_id is a structural fact ("does lexeme exist?"),
// not a semantic quality judgement ("is the entry well-formed?").
// semantic-audit-worker handles only: review_status, conflicts, confidence.

type ExpressionVerificationStatus =
  | 'usage_verified'
  | 'authoritative'
  | 'multi_source';

type ExpressionVerificationMethod =
  | 'sub_article'
  | 'dictionary_entry'
  | 'multi_source';

type ExpressionCatalogCurrentRow = {
  id: string;
  lemma: string | null;
  root_lemma: string | null;
  lexeme_id: string | null;
  verification_status: string | null;
  verification_method?: string | null;
  verification_source?: string | null;
  verification_method_version?: number | null;
  verification_version?: number | null;
  source_checked_at?: string | null;
  last_verification_run?: string | null;
};

type PromotionResult = {
  attempted: boolean;
  promoted: boolean;
  lexeme_id: string | null;
  previous_lexeme_id: string | null;
  current_lexeme_id: string | null;
  previous_status: string | null;
  new_status: ExpressionVerificationStatus | null;
  verification_status: ExpressionVerificationStatus | null;
  previous_method: string | null;
  new_method: ExpressionVerificationMethod | null;
  verification_method: ExpressionVerificationMethod | null;
  previous_source: string | null;
  new_source: string | null;
  verification_source: string | null;
  verification_method_version: number | null;
  root_lemma: string | null;
  verification_version: number;
  source_checked_at: string | null;
  expression_id: string | null;
  recovered_expression_id: boolean;
  reason: string;
};

const VERIFICATION_VERSION = 5;
const VERIFICATION_METHOD_VERSION = 1;
const WORKER_VERSION = 'v6';
const WORKER_NAME = 'authoritative-enrichment-pipeline-worker';
const LEXICON_RUN_ID =
  Deno.env.get('LEXICON_RUN_ID') ?? 'verification-v5-full-refresh';

// Normalize expression lemma for lexemes table lookup.
function normalizeLemmaForLexeme(lemma: string): string {
  return lemma
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '');
}

function normalizeRootLemma(value?: string | null): string | null {
  const normalized = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/^å\s+/i, '')
    .replace(/\s+/g, ' ');

  return normalized || null;
}

function inferRootLemmaFromLemma(lemma?: string | null): string | null {
  const normalized = normalizeLemmaForLexeme(String(lemma ?? ''));
  if (!normalized) return null;
  return normalized.split(/\s+/)[0] || null;
}

function getInputRootLemma(input: EnrichmentInput): string | null {
  return (
    normalizeRootLemma((input as any).root_lemma) ||
    normalizeRootLemma((input as any).network_root_lemma) ||
    normalizeRootLemma(input.source_lemma) ||
    inferRootLemmaFromLemma(input.lemma)
  );
}

function getPositiveSources(
  evidence: ReturnType<typeof buildUnifiedEvidenceSummary>,
): string[] {
  const sources = new Set<string>();

  for (const detail of evidence.summary.source_details ?? []) {
    const isPositive =
      detail.registered_entry === true ||
      detail.usage_match === true ||
      detail.tier === 'usage_evidence';

    if (isPositive && typeof detail.source === 'string') {
      sources.add(detail.source);
    }
  }

  return [...sources];
}

function getFirstRegisteredEntrySource(
  evidence: ReturnType<typeof buildUnifiedEvidenceSummary>,
): string | null {
  const detail = evidence.summary.source_details.find(
    (d) => d.registered_entry === true,
  );

  return typeof detail?.source === 'string' ? detail.source : null;
}

function getFirstUsageEvidenceSource(
  evidence: ReturnType<typeof buildUnifiedEvidenceSummary>,
): string | null {
  const detail = evidence.summary.source_details.find(
    (d) => d.usage_match === true || d.tier === 'usage_evidence',
  );

  return typeof detail?.source === 'string' ? detail.source : null;
}

type VerificationDecision = {
  status: ExpressionVerificationStatus;
  method: ExpressionVerificationMethod;
  source: string | null;
  method_version: number;
};

// Determine verification decision based on evidence summary.
// Returns both trust level and verification method.
function determineVerificationDecision(
  evidence: ReturnType<typeof buildUnifiedEvidenceSummary>,
): VerificationDecision | null {
  const summary = evidence.summary;

  if (summary.positive_sources === 0) return null;

  // 2+ positive sources → multi_source
  if (summary.positive_sources >= 2) {
    const sources = getPositiveSources(evidence);

    return {
      status: 'multi_source',
      method: 'multi_source',
      source: sources.length ? sources.join(',') : null,
      method_version: VERIFICATION_METHOD_VERSION,
    };
  }

  // 1 registered dictionary entry (expr_entry, uttrykk, entry) → authoritative
  const hasRegisteredEntry = summary.source_details.some(
    (d) => d.registered_entry === true,
  );

  if (hasRegisteredEntry) {
    return {
      status: 'authoritative',
      method: 'dictionary_entry',
      source: getFirstRegisteredEntrySource(evidence),
      method_version: VERIFICATION_METHOD_VERSION,
    };
  }

  // Usage evidence only (sub_article, example, article_ref) → usage_verified
  const hasUsageEvidence = summary.source_details.some(
    (d) => d.usage_match === true || d.tier === 'usage_evidence',
  );

  if (hasUsageEvidence) {
    return {
      status: 'usage_verified',
      method: 'sub_article',
      source: getFirstUsageEvidenceSource(evidence),
      method_version: VERIFICATION_METHOD_VERSION,
    };
  }

  return null;
}

async function updateLexemeRootLemmaBestEffort(
  lexemeId: string,
  rootLemma: string | null,
) {
  if (!lexemeId || !rootLemma) return;

  const { error } = await supabase
    .from('lexemes')
    .update({
      root_lemma: rootLemma,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lexemeId);

  if (error) {
    console.log('[PROMOTION] root_lemma lexeme update skipped/failed', {
      lexemeId,
      rootLemma,
      error,
    });
  }
}

// Find existing lexeme for expression, or create a new one.
// Searches by normalized_key first (most reliable), then lemma variants.
async function findOrCreateExpressionLexeme(
  lemma: string,
  normalizedKey?: string | null,
  rootLemma?: string | null,
): Promise<string | null> {
  if (!lemma?.trim()) return null;

  const normalizedLemma = normalizeLemmaForLexeme(lemma);
  const lookupKey = normalizedKey?.trim() || normalizedLemma;
  const displayLemma = lemma.trim().toLowerCase().startsWith('å ')
    ? lemma.trim()
    : `å ${normalizedLemma}`;

  // 1. Search by normalized_key / lemma.
  const { data: byKey } = await supabase
    .from('lexemes')
    .select('id')
    .eq('lemma', lookupKey)
    .eq('pos', 'expression')
    .maybeSingle();

  if (byKey?.id) {
    await updateLexemeRootLemmaBestEffort(byKey.id, rootLemma ?? null);
    return byKey.id;
  }

  // 2. Try normalized lemma without "å" prefix.
  if (normalizedLemma !== lookupKey) {
    const { data: byLemma } = await supabase
      .from('lexemes')
      .select('id')
      .eq('lemma', normalizedLemma)
      .eq('pos', 'expression')
      .maybeSingle();

    if (byLemma?.id) {
      await updateLexemeRootLemmaBestEffort(byLemma.id, rootLemma ?? null);
      return byLemma.id;
    }
  }

  // 3. Try display form with "å" prefix.
  if (displayLemma !== lookupKey && displayLemma !== normalizedLemma) {
    const { data: byDisplay } = await supabase
      .from('lexemes')
      .select('id')
      .eq('lemma', displayLemma)
      .eq('pos', 'expression')
      .maybeSingle();

    if (byDisplay?.id) {
      await updateLexemeRootLemmaBestEffort(byDisplay.id, rootLemma ?? null);
      return byDisplay.id;
    }
  }

  // 4. Create new lexeme.
  // root_lemma is updated in a separate best-effort step so this still works
  // if older deployments do not yet have lexemes.root_lemma.
  const { data: created, error: createError } = await supabase
    .from('lexemes')
    .insert({
      lemma: lookupKey,
      display_form: displayLemma,
      pos: 'expression',
      verification_tier: 'candidate',
      is_learning_lexeme: false,
    })
    .select('id')
    .single();

  if (createError) {
    console.error('[PROMOTION] create lexeme error', createError);
    return null;
  }

  const createdId = created?.id ?? null;
  if (createdId) {
    await updateLexemeRootLemmaBestEffort(createdId, rootLemma ?? null);
  }

  return createdId;
}

async function readExpressionCatalogRow(
  expressionCatalogId: string,
): Promise<ExpressionCatalogCurrentRow | null> {
  const { data, error } = await supabase
    .from('expression_catalog')
    .select(`
      id,
      lemma,
      root_lemma,
      lexeme_id,
      verification_status,
      verification_method,
      verification_source,
      verification_method_version,
      verification_version,
      source_checked_at,
      last_verification_run
    `)
    .eq('id', expressionCatalogId)
    .maybeSingle();

  if (error) {
    console.error('[PROMOTION] read expression_catalog error', {
      expressionCatalogId,
      error,
    });
    return null;
  }

  return data as ExpressionCatalogCurrentRow | null;
}

async function findExpressionCatalogIdByLemma(
  lemma?: string | null,
): Promise<string | null> {
  const normalizedLemma = normalizeLemmaForLexeme(String(lemma ?? ''));

  if (!normalizedLemma) return null;

  // 1. Preferred lookup: normalized_key.
  const { data: byNormalizedKey, error: normalizedKeyError } = await supabase
    .from('expression_catalog')
    .select('id')
    .eq('normalized_key', normalizedLemma)
    .maybeSingle();

  if (normalizedKeyError) {
    console.log('[PROMOTION] normalized_key lookup failed/skipped', {
      normalizedLemma,
      error: normalizedKeyError,
    });
  }

  if (byNormalizedKey?.id) {
    return byNormalizedKey.id;
  }

  // 2. Fallback: lemma exactly matches normalized lemma.
  const { data: byLemma, error: lemmaError } = await supabase
    .from('expression_catalog')
    .select('id')
    .eq('lemma', normalizedLemma)
    .maybeSingle();

  if (lemmaError) {
    console.log('[PROMOTION] lemma lookup failed/skipped', {
      normalizedLemma,
      error: lemmaError,
    });
  }

  if (byLemma?.id) {
    return byLemma.id;
  }

  // 3. Fallback: lemma with "å " prefix, for legacy rows.
  const withInfinitiveMarker = `å ${normalizedLemma}`;

  const { data: byDisplayLemma, error: displayLemmaError } = await supabase
    .from('expression_catalog')
    .select('id')
    .eq('lemma', withInfinitiveMarker)
    .maybeSingle();

  if (displayLemmaError) {
    console.log('[PROMOTION] display lemma lookup failed/skipped', {
      withInfinitiveMarker,
      error: displayLemmaError,
    });
  }

  return byDisplayLemma?.id ?? null;
}

async function resolveExpressionCatalogIdForPromotion(
  input: EnrichmentInput,
): Promise<{
  expression_id: string | null;
  recovered: boolean;
}> {
  const directExpressionId =
    typeof input.expression_id === 'string' &&
    input.expression_id.trim().length > 0
      ? input.expression_id.trim()
      : null;

  if (directExpressionId) {
    const existing = await readExpressionCatalogRow(directExpressionId);

    if (existing?.id) {
      return {
        expression_id: existing.id,
        recovered: false,
      };
    }

    // If direct ID points to legacy lexemes.id or stale data, do not trust it.
    // Try to recover the real expression_catalog.id by lemma.
    console.log('[PROMOTION] direct expression_id not found in catalog; trying lemma recovery', {
      directExpressionId,
      lemma: input.lemma ?? null,
    });
  }

  const recoveredId = await findExpressionCatalogIdByLemma(input.lemma);

  return {
    expression_id: recoveredId,
    recovered: Boolean(recoveredId),
  };
}

async function updateExpressionCatalogMetadataBestEffort(
  expressionCatalogId: string,
  params: {
    rootLemma: string | null;
    sourceCheckedAt: string;
    verificationVersion: number;
  },
) {
  const payload: Record<string, unknown> = {
    source_checked_at: params.sourceCheckedAt,
    verification_version: params.verificationVersion,
    updated_at: new Date().toISOString(),
  };

  if (params.rootLemma) {
    payload.root_lemma = params.rootLemma;
  }

  const { error } = await supabase
    .from('expression_catalog')
    .update(payload)
    .eq('id', expressionCatalogId);

  if (error) {
    console.log('[PROMOTION] metadata update skipped/failed', {
      expressionCatalogId,
      payload,
      error,
    });
  }
}

// Link expression_catalog entry to lexeme and set verification_status.
// v6 behavior:
//   - updates existing rows even if lexeme_id is already set;
//   - allows verification_status downgrade during database rewrite;
//   - updates source_checked_at and verification_version best-effort;
//   - returns previous/current state for auditing.
async function linkExpressionToLexeme(
  expressionCatalogId: string,
  lexemeId: string,
  decision: VerificationDecision,
  rootLemma: string | null,
  jobId: string | null,
): Promise<{
  ok: boolean;
  previous_lexeme_id: string | null;
  current_lexeme_id: string | null;
  previous_status: string | null;
  previous_method: string | null;
  previous_source: string | null;
  new_status: ExpressionVerificationStatus;
  new_method: ExpressionVerificationMethod;
  new_source: string | null;
  method_version: number;
  source_checked_at: string;
  reason: string;
}> {
  const existing = await readExpressionCatalogRow(expressionCatalogId);
  const sourceCheckedAt = new Date().toISOString();

  if (!existing) {
    return {
      ok: false,
      previous_lexeme_id: null,
      current_lexeme_id: null,
      previous_status: null,
      previous_method: null,
      previous_source: null,
      new_status: decision.status,
      new_method: decision.method,
      new_source: decision.source,
      method_version: decision.method_version,
      source_checked_at: sourceCheckedAt,
      reason: 'expression_catalog_not_found',
    };
  }

  const finalLexemeId = existing.lexeme_id || lexemeId;
  const finalRootLemma = rootLemma || normalizeRootLemma(existing.root_lemma);

  const afterForLog: ExpressionCatalogCurrentRow = {
    ...existing,
    lexeme_id: finalLexemeId,
    verification_status: decision.status,
    verification_method: decision.method,
    verification_source: decision.source,
    verification_method_version: decision.method_version,
    verification_version: VERIFICATION_VERSION,
    source_checked_at: sourceCheckedAt,
    last_verification_run: LEXICON_RUN_ID,
    root_lemma: finalRootLemma,
  };

  const { error } = await supabase
    .from('expression_catalog')
    .update({
      lexeme_id: finalLexemeId,
      verification_status: decision.status,
      verification_method: decision.method,
      verification_source: decision.source,
      verification_method_version: decision.method_version,
      verification_version: VERIFICATION_VERSION,
      source_checked_at: sourceCheckedAt,
      last_verification_run: LEXICON_RUN_ID,
      root_lemma: finalRootLemma,
      updated_at: sourceCheckedAt,
    })
    .eq('id', expressionCatalogId);

  if (error) {
    console.error('[PROMOTION] link/update error', {
      expressionCatalogId,
      lexemeId,
      finalLexemeId,
      decision,
      rootLemma: finalRootLemma,
      error,
    });
    return {
      ok: false,
      previous_lexeme_id: existing.lexeme_id ?? null,
      current_lexeme_id: existing.lexeme_id ?? null,
      previous_status: existing.verification_status ?? null,
      previous_method: existing.verification_method ?? null,
      previous_source: existing.verification_source ?? null,
      new_status: decision.status,
      new_method: decision.method,
      new_source: decision.source,
      method_version: decision.method_version,
      source_checked_at: sourceCheckedAt,
      reason: 'catalog_update_failed',
    };
  }

  await updateExpressionCatalogMetadataBestEffort(expressionCatalogId, {
    rootLemma: finalRootLemma,
    sourceCheckedAt,
    verificationVersion: VERIFICATION_VERSION,
  });

  const changeLog = await logLexiconChanges(supabase, {
    entityType: 'expression_catalog',
    entityId: expressionCatalogId,
    lemma: existing.lemma ?? null,
    runId: LEXICON_RUN_ID,
    jobId,
    workerName: WORKER_NAME,
    changeType: 'verification',
    changeSource: WORKER_NAME,
    before: existing as Record<string, unknown>,
    after: afterForLog as Record<string, unknown>,
    verificationVersion: VERIFICATION_VERSION,
    methodVersion: decision.method_version,
  });

  console.log('[PROMOTION] expression_catalog updated', {
    expressionCatalogId,
    previous_lexeme_id: existing.lexeme_id ?? null,
    current_lexeme_id: finalLexemeId,
    previous_status: existing.verification_status ?? null,
    new_status: decision.status,
    previous_method: existing.verification_method ?? null,
    new_method: decision.method,
    previous_source: existing.verification_source ?? null,
    new_source: decision.source,
    verification_method_version: decision.method_version,
    root_lemma: finalRootLemma,
    source_checked_at: sourceCheckedAt,
    verification_version: VERIFICATION_VERSION,
    last_verification_run: LEXICON_RUN_ID,
    change_log: changeLog,
  });

  return {
    ok: true,
    previous_lexeme_id: existing.lexeme_id ?? null,
    current_lexeme_id: finalLexemeId,
    previous_status: existing.verification_status ?? null,
    previous_method: existing.verification_method ?? null,
    previous_source: existing.verification_source ?? null,
    new_status: decision.status,
    new_method: decision.method,
    new_source: decision.source,
    method_version: decision.method_version,
    source_checked_at: sourceCheckedAt,
    reason: existing.lexeme_id ? 'updated_existing_lexeme' : 'linked_new_lexeme',
  };
}

function skipPromotion(
  reason: string,
  expressionId: string | null = null,
  recoveredExpressionId = false,
): PromotionResult {
  return {
    attempted: false,
    promoted: false,
    lexeme_id: null,
    previous_lexeme_id: null,
    current_lexeme_id: null,
    previous_status: null,
    new_status: null,
    verification_status: null,
    previous_method: null,
    new_method: null,
    verification_method: null,
    previous_source: null,
    new_source: null,
    verification_source: null,
    verification_method_version: null,
    root_lemma: null,
    verification_version: VERIFICATION_VERSION,
    source_checked_at: null,
    expression_id: expressionId,
    recovered_expression_id: recoveredExpressionId,
    reason,
  };
}

// Main promotion entry point.
// Runs after evidence is collected, only for expressions with sufficient evidence.
async function promoteExpressionIfVerified(
  input: EnrichmentInput,
  evidence: ReturnType<typeof buildUnifiedEvidenceSummary>,
): Promise<PromotionResult> {
  if (input.item_type !== 'expression') {
    return skipPromotion('not_expression');
  }

  if (input.update_catalog === false) {
    return skipPromotion('update_catalog_disabled');
  }

  if (!input.lemma?.trim()) {
    return skipPromotion('no_lemma');
  }

  const resolvedExpressionId = await resolveExpressionCatalogIdForPromotion(
    input,
  );

  if (!resolvedExpressionId.expression_id) {
    return skipPromotion(
      'no_expression_id',
      null,
      resolvedExpressionId.recovered,
    );
  }

  const decision = determineVerificationDecision(evidence);

  if (!decision) {
    return skipPromotion(
      'insufficient_evidence',
      resolvedExpressionId.expression_id,
      resolvedExpressionId.recovered,
    );
  }

  const existing = await readExpressionCatalogRow(
    resolvedExpressionId.expression_id,
  );

  const rootLemma =
    normalizeRootLemma(existing?.root_lemma) ||
    getInputRootLemma(input);

  const lexemeId = await findOrCreateExpressionLexeme(
    input.lemma,
    (input as any).normalized_key ?? null,
    rootLemma,
  );

  if (!lexemeId) {
    return {
      attempted: true,
      promoted: false,
      lexeme_id: null,
      previous_lexeme_id: existing?.lexeme_id ?? null,
      current_lexeme_id: existing?.lexeme_id ?? null,
      previous_status: existing?.verification_status ?? null,
      new_status: decision.status,
      verification_status: decision.status,
      previous_method: existing?.verification_method ?? null,
      new_method: decision.method,
      verification_method: decision.method,
      previous_source: existing?.verification_source ?? null,
      new_source: decision.source,
      verification_source: decision.source,
      verification_method_version: decision.method_version,
      root_lemma: rootLemma,
      verification_version: VERIFICATION_VERSION,
      source_checked_at: null,
      expression_id: resolvedExpressionId.expression_id,
      recovered_expression_id: resolvedExpressionId.recovered,
      reason: 'lexeme_create_failed',
    };
  }

  const jobId =
    (input as any).job_id ??
    (input as any).processing_job_id ??
    (input as any).jobId ??
    null;

  const linked = await linkExpressionToLexeme(
    resolvedExpressionId.expression_id,
    lexemeId,
    decision,
    rootLemma,
    jobId,
  );

  return {
    attempted: true,
    promoted: linked.ok,
    lexeme_id: linked.current_lexeme_id,
    previous_lexeme_id: linked.previous_lexeme_id,
    current_lexeme_id: linked.current_lexeme_id,
    previous_status: linked.previous_status,
    new_status: linked.new_status,
    verification_status: linked.new_status,
    previous_method: linked.previous_method,
    new_method: linked.new_method,
    verification_method: linked.new_method,
    previous_source: linked.previous_source,
    new_source: linked.new_source,
    verification_source: linked.new_source,
    verification_method_version: linked.method_version,
    root_lemma: rootLemma,
    verification_version: VERIFICATION_VERSION,
    source_checked_at: linked.source_checked_at,
    expression_id: resolvedExpressionId.expression_id,
    recovered_expression_id: resolvedExpressionId.recovered,
    reason: linked.ok ? linked.reason : linked.reason,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const input = await req.json() as EnrichmentInput;

    validateInput(input);

    const itemId =
      input.item_type === 'expression'
        ? input.expression_id ?? input.lemma!
        : input.lexeme_id ?? input.lemma!;

    const ordbokene = await runOrdbokenePipeline(input);
    const naob = await runNaobPipeline(input);

    const evidence = buildUnifiedEvidenceSummary({
      item_type: input.item_type,
      item_id: itemId,
      ordbokene,
      naob,
    });

    // Promote expression_catalog after evidence is collected.
    // Sets lexeme_id + verification_status. v6 writes verification_status/method/source and lexicon change log and can recover missing/stale
    // expression_id from normalized_key/lemma.
    const promotion = await promoteExpressionIfVerified(input, evidence);

    return json({
      ok: true,
      worker: 'authoritative-enrichment-pipeline-worker',
      version: WORKER_VERSION,
      input: {
        item_type: input.item_type,
        lemma: input.lemma ?? null,
        expression_id: input.expression_id ?? null,
        lexeme_id: input.lexeme_id ?? null,
        source_lemma: input.source_lemma ?? null,
        candidate_slugs: input.candidate_slugs ?? null,
        force_refresh: input.force_refresh ?? false,
        update_catalog: input.update_catalog ?? true,
        root_lemma:
          (input as any).root_lemma ??
          (input as any).network_root_lemma ??
          null,
        normalized_key: (input as any).normalized_key ?? null,
        job_id:
          (input as any).job_id ??
          (input as any).processing_job_id ??
          (input as any).jobId ??
          null,
        lexicon_run_id: LEXICON_RUN_ID,
      },
      evidence,
      promotion,
    });
  } catch (error) {
    return json({
      ok: false,
      worker: 'authoritative-enrichment-pipeline-worker',
      version: WORKER_VERSION,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

function validateInput(input: EnrichmentInput) {
  if (!input.item_type) {
    throw new Error('item_type is required');
  }

  if (!['expression', 'lexeme'].includes(input.item_type)) {
    throw new Error('item_type must be expression or lexeme');
  }

  const lemma = normalizeText(input.lemma);

  if (input.item_type === 'expression') {
    const hasExpressionId =
      typeof input.expression_id === 'string' &&
      input.expression_id.trim().length > 0;

    if (!hasExpressionId && !lemma) {
      throw new Error(
        'expression input requires either expression_id or lemma',
      );
    }

    if (lemma && !normalizeText(input.source_lemma)) {
      throw new Error(
        'expression input with lemma requires source_lemma for NAOB lookup',
      );
    }
  }

  if (input.item_type === 'lexeme') {
    const hasLexemeId =
      typeof input.lexeme_id === 'string' &&
      input.lexeme_id.trim().length > 0;

    if (!hasLexemeId && !lemma) {
      throw new Error(
        'lexeme input requires either lexeme_id or lemma',
      );
    }
  }
}

function normalizeText(value?: string): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ');

  return normalized.length > 0 ? normalized : undefined;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}