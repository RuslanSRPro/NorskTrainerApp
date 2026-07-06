import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { minConfidence } from '../../../services/confidence.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type EntityType = 'lexeme' | 'expression';

type AuditRow = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  lemma: string | null;
  pos: string | null;
  translation_ua: string | null;
  translation_en: string | null;
  cefr: string | null;
  frequency_rank: number | null;
  frequency_level: string | null;
  topic: string | null;
  verification_tier: string | null;
  source_verified: string | null;
  verification_status: string | null;
  verification_evidence: Record<string, unknown> | null;
};

type AggregateVerificationTier =
  | 'dictionary_entry'
  | 'dictionary_match'
  | 'normative_reference'
  | 'usage_evidence'
  | 'component_match'
  | 'ai_candidate';

type SourceEvidence = {
  source: string;
  quality: string | null;
  registered_entry: boolean;
  whole_unit_match: boolean;
  component_match: boolean;
  usage_match: boolean;
};

const AUTHORITATIVE_DICTIONARIES = new Set(['NAOB', 'Ordbokene']);

function hasValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
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

function splitSources(value: string | null): string[] {
  if (!value) return [];

  return value
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
}

function confidenceFromSourceCount(
  sourceCount: number,
): 'high' | 'medium' | 'low' {
  if (sourceCount >= 3) return 'high';
  if (sourceCount >= 2) return 'medium';
  return 'low';
}

function extractSourceEvidence(
  verificationEvidence: Record<string, unknown> | null,
): SourceEvidence[] {
  if (!verificationEvidence || typeof verificationEvidence !== 'object') {
    return [];
  }

  return Object.entries(verificationEvidence).map(([source, raw]) => {
    const value = raw as any;
    const inner = value?.evidence ?? {};

    return {
      source,

      quality:
        value?.original_quality ??
        value?.quality ??
        inner?.original_quality ??
        inner?.quality ??
        null,

      registered_entry: value?.registered_entry === true,
      whole_unit_match: value?.whole_unit_match === true,
      component_match: value?.component_match === true,

      usage_match:
        value?.usage_match === true ||
        inner?.usage_match === true,
    };
  });
}

function aggregateVerificationTier(
  evidence: SourceEvidence[],
): AggregateVerificationTier {
  const hasAuthoritativeRegistered = evidence.some(
    (e) =>
      AUTHORITATIVE_DICTIONARIES.has(e.source) &&
      e.registered_entry === true,
  );

  if (hasAuthoritativeRegistered) return 'dictionary_entry';

  const hasAuthoritativeStructuredWholeUnit = evidence.some(
    (e) =>
      AUTHORITATIVE_DICTIONARIES.has(e.source) &&
      e.whole_unit_match === true &&
      e.quality === 'structured_entry_match',
  );

  if (hasAuthoritativeStructuredWholeUnit) return 'dictionary_match';

  const hasNormativeReference = evidence.some(
    (e) =>
      e.source === 'Språkrådet' &&
      e.quality === 'normative_reference',
  );

  if (hasNormativeReference) return 'normative_reference';

  const hasUsageEvidence = evidence.some(
    (e) =>
      e.usage_match === true ||
      [
        'usage_example_match',
        'learner_dictionary',
        'exact_expression_match',
      ].includes(e.quality ?? ''),
  );

  if (hasUsageEvidence) return 'usage_evidence';

  const hasComponentEvidence = evidence.some(
    (e) =>
      e.component_match === true ||
      e.quality === 'component_match' ||
      e.quality === 'search_page_match',
  );

  if (hasComponentEvidence) return 'component_match';

  return 'ai_candidate';
}

function reviewStatusFromTier(
  tier: AggregateVerificationTier,
): 'trusted' | 'candidate' | 'weak' {
  if (
    tier === 'dictionary_entry' ||
    tier === 'dictionary_match' ||
    tier === 'normative_reference'
  ) {
    return 'trusted';
  }

  if (tier === 'usage_evidence') {
    return 'candidate';
  }

  return 'weak';
}

function auditSemantic(row: AuditRow) {
  const conflicts: string[] = [];
  const notes: string[] = [];

  const lemma = row.lemma?.trim() ?? '';
  const pos = row.pos?.trim() ?? '';

  const hasUa = hasValue(row.translation_ua);
  const hasEn = hasValue(row.translation_en);
  const hasCefr = hasValue(row.cefr);
  const hasFrequency = typeof row.frequency_rank === 'number';

  const sources = splitSources(row.source_verified);
  const sourceCount = sources.length;

  const verificationTier = row.verification_tier ?? '';
  const isExpression =
    row.entity_type === 'expression' ||
    pos === 'expression';

  const sourceEvidence = extractSourceEvidence(row.verification_evidence);
  const aggregateTier = aggregateVerificationTier(sourceEvidence);

  const evidenceSourceCount = sourceEvidence.filter(
    (e) =>
      e.registered_entry ||
      e.whole_unit_match ||
      e.component_match ||
      e.usage_match ||
      e.quality,
  ).length;

  if (!lemma) conflicts.push('missing_lemma');
  if (!pos || pos === 'unknown') notes.push('missing_or_unknown_pos');

  if (!hasUa && !hasEn) notes.push('missing_translation');
  if (!hasCefr) notes.push('missing_cefr');
  if (!hasFrequency) notes.push('missing_frequency');
  if (!row.source_verified) notes.push('missing_source_verified');
  if (sourceCount <= 1) notes.push('low_source_count');
  if (lemma.includes(' ')) notes.push('multiword_lemma');

  if (verificationTier.includes('dictionary_match')) {
    notes.push('legacy_dictionary_match_needs_recheck');
  }

  if (verificationTier.includes('component')) {
    notes.push('component_based_verification');
  }

  if (isExpression && aggregateTier === 'component_match') {
    conflicts.push('expression_component_only');
  }

  if (isExpression && lemma.split(/\s+/).length < 2) {
    conflicts.push('expression_too_short');
  }

  if (isExpression && sources.includes('Wiktionary')) {
    notes.push('wiktionary_expression_needs_caution');
  }

  if (isExpression && sources.includes('NAOB')) {
    notes.push('naob_expression_signal');
  }

  if (isExpression && sources.includes('Ordbokene')) {
    notes.push('ordbokene_expression_signal');
  }

  if (lemma === 'nysgjerring') {
    conflicts.push('likely_typo_should_be_nysgjerrig');
  }

  if (row.topic === 'nature_weather' && lemma.includes('klar til')) {
    conflicts.push('topic_mismatch');
  }

  if (row.translation_ua && row.translation_ua.trim() === lemma) {
    conflicts.push('translation_ua_same_as_lemma');
  }

  if (
    row.translation_en &&
    row.translation_en.trim().toLowerCase() === lemma.toLowerCase()
  ) {
    conflicts.push('translation_en_same_as_lemma');
  }

  let reviewStatus: 'trusted' | 'candidate' | 'weak' | 'conflicted';

  if (conflicts.length > 0) {
    reviewStatus = 'conflicted';
  } else {
    reviewStatus = reviewStatusFromTier(aggregateTier);
  }

  const sourceConfidence = confidenceFromSourceCount(
    evidenceSourceCount || sourceCount,
  );

  const verificationConfidence =
    reviewStatus === 'trusted'
      ? 'high'
      : reviewStatus === 'candidate'
        ? 'medium'
        : 'low';

  const formConfidence =
    hasCefr && hasFrequency
      ? 'high'
      : hasCefr || hasFrequency
        ? 'medium'
        : 'low';

  const semanticConfidence =
    conflicts.length === 0 && hasUa && hasEn
      ? 'high'
      : conflicts.length === 0
        ? 'medium'
        : 'low';

  const learningConfidence = minConfidence(
    semanticConfidence,
    verificationConfidence,
    sourceConfidence,
    formConfidence,
  );

  return {
    quality: 'semantic_audit_v5_evidence_aware',
    semantic_confidence: semanticConfidence,
    verification_confidence: verificationConfidence,
    source_confidence: sourceConfidence,
    form_confidence: formConfidence,
    learning_confidence: learningConfidence,
    review_status: reviewStatus,
    aggregate_tier: aggregateTier,
    source_evidence: sourceEvidence,
    conflicts,
    audit_notes: notes,
    evidence: {
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      lemma,
      pos,
      source_count: sourceCount,
      evidence_source_count: evidenceSourceCount,
      sources,
      source_verified: row.source_verified,
      verification_tier: row.verification_tier,
      verification_status: row.verification_status,
      aggregate_verification_tier: aggregateTier,
      source_evidence: sourceEvidence,
      has_translation_ua: hasUa,
      has_translation_en: hasEn,
      has_cefr: hasCefr,
      has_frequency: hasFrequency,
      confidence_model: {
        semantic_confidence: semanticConfidence,
        verification_confidence: verificationConfidence,
        source_confidence: sourceConfidence,
        form_confidence: formConfidence,
        learning_confidence: learningConfidence,
      },
    },
  };
}

// ── Claim + audit functions ───────────────────────────────────────────────────

async function claimLexemes(
  limit: number,
  jobId: string | null,
): Promise<AuditRow[]> {
  const { data, error } = await supabase.rpc(
    'claim_next_semantic_audit',
    {
      p_limit: limit,
      p_job_id: jobId,
    },
  );

  if (error) {
    throw new Error(
      `claim_next_semantic_audit failed: ${safeStringify(error)}`,
    );
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    entity_type: 'lexeme',
    entity_id: row.lexeme_id,
  }));
}

async function claimExpressions(
  limit: number,
  jobId: string | null,
): Promise<AuditRow[]> {
  const { data, error } = await supabase.rpc(
    'claim_next_expression_semantic_audit',
    {
      p_limit: limit,
      p_job_id: jobId,
    },
  );

  if (error) {
    throw new Error(
      `claim_next_expression_semantic_audit failed: ${safeStringify(error)}`,
    );
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    entity_type: 'expression',
    entity_id: row.expression_id,
    lemma: row.lemma,
    pos: row.pos ?? 'expression',
    translation_ua: row.translation_ua,
    translation_en: row.translation_en,
    cefr: row.cefr,
    frequency_rank: row.frequency_rank,
    frequency_level: row.frequency_level,
    topic: row.topic,
    verification_tier: row.verification_tier,
    source_verified: row.source_verified,
    verification_status: row.verification_status,
    verification_evidence: row.verification_evidence,
  }));
}

async function updateAudit(
  row: AuditRow,
  audit: ReturnType<typeof auditSemantic>,
) {
  if (row.entity_type === 'expression') {
    const { error } = await supabase.rpc(
      'update_expression_semantic_audit_status',
      {
        p_id: row.id,
        p_status: 'done',
        p_quality: audit.quality,
        p_semantic_confidence: audit.semantic_confidence,
        p_review_status: audit.review_status,
        p_conflicts: audit.conflicts,
        p_audit_notes: audit.audit_notes,
        p_source: 'semantic_audit_worker',
        p_evidence: audit.evidence,
        p_verification_confidence: audit.verification_confidence,
        p_source_confidence: audit.source_confidence,
        p_form_confidence: audit.form_confidence,
        p_learning_confidence: audit.learning_confidence,
      },
    );

    if (error) {
      throw new Error(
        `update_expression_semantic_audit_status failed: ${safeStringify(error)}`,
      );
    }

    return;
  }

  const { error } = await supabase.rpc(
    'update_semantic_audit_status',
    {
      p_id: row.id,
      p_status: 'done',
      p_quality: audit.quality,
      p_semantic_confidence: audit.semantic_confidence,
      p_review_status: audit.review_status,
      p_conflicts: audit.conflicts,
      p_audit_notes: audit.audit_notes,
      p_source: 'semantic_audit_worker',
      p_evidence: audit.evidence,
      p_verification_confidence: audit.verification_confidence,
      p_source_confidence: audit.source_confidence,
      p_form_confidence: audit.form_confidence,
      p_learning_confidence: audit.learning_confidence,
    },
  );

  if (error) {
    throw new Error(
      `update_semantic_audit_status failed: ${safeStringify(error)}`,
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const limit =
      typeof body.limit === 'number' && body.limit > 0
        ? body.limit
        : 50;

    const jobId =
      typeof body.job_id === 'string' && body.job_id.trim().length > 0
        ? body.job_id.trim()
        : null;

    const lexemeRows = await claimLexemes(limit, jobId);
    const remaining = Math.max(0, limit - lexemeRows.length);
    const expressionRows =
      remaining > 0
        ? await claimExpressions(remaining, jobId)
        : [];

    const rows = [...lexemeRows, ...expressionRows];
    const results = [];

    for (const row of rows) {
      try {
        const audit = auditSemantic(row);
        await updateAudit(row, audit);

        results.push({
          entity_type: row.entity_type,
          id: row.id,
          entity_id: row.entity_id,
          lemma: row.lemma,
          review_status: audit.review_status,
          aggregate_verification_tier:
            audit.evidence.aggregate_verification_tier,
          semantic_confidence: audit.semantic_confidence,
          verification_confidence: audit.verification_confidence,
          source_confidence: audit.source_confidence,
          form_confidence: audit.form_confidence,
          learning_confidence: audit.learning_confidence,
          conflicts: audit.conflicts,
          notes: audit.audit_notes,
          ok: true,
        });
      } catch (e) {
        console.error('semantic audit row failed', {
          row,
          error: safeStringify(e),
        });

        results.push({
          entity_type: row.entity_type,
          id: row.id,
          entity_id: row.entity_id,
          lemma: row.lemma,
          ok: false,
          error: safeStringify(e),
        });
      }
    }

    return Response.json(
      {
        ok: true,
        requested_job_id: jobId,
        claimed: rows.length,
        lexeme_claimed: lexemeRows.length,
        expression_claimed: expressionRows.length,
        results,
      },
      {
        headers: corsHeaders,
      },
    );
  } catch (e) {
    console.error('semantic-audit-worker fatal error', e);

    return Response.json(
      {
        ok: false,
        error: safeStringify(e),
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});