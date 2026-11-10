// D10 25.10.2026 (agreed, point 4): ONE list of the reasons that are a
// decision about a single word, not a failure of the job. A word with such a
// reason is shown "for review" (it does not become a learning card); the rest
// of the job finishes normally. Any reason NOT in these lists still blocks
// the job (needs_manual_review), so a real error is never hidden.
// Used by: job-enrichment-batch-worker, ai-enrichment-worker,
// completion-contract runtime, pipeline-supervisor, get-job-status.

// Admission gate: the word could not be admitted automatically.
export const GATE_REVIEW_CODES: ReadonlySet<string> = new Set([
  'AMBIGUOUS_POS_WITHOUT_ARTICLE',      // part of speech unclear, no own article
  'CONFIRMED_ORDBOKENE_POS_CONFLICT',   // the dictionary confirms another part of speech
  'CONFIRMED_ARTICLE_POS_CONFLICT',
  'NO_CONFIRMED_WHOLE_UNIT_REGISTRATION', // not found as a whole word / expression
  'unknown_pos_requires_review',
  // D10 10.11.2026 (D10_job_problems_v1): a family expression the dictionaries did not verify stays a grey
  // candidate - a decision about that expression, not a failure of the job (gå / ta jobs ended "needs review").
  'FAMILY_EXPRESSION_NOT_VERIFIED',
]);

// Enrichment: the card exists but a step cannot fill it. The first five are
// the codes job-enrichment-batch-worker already treated as "for review"
// (15.10 / 17.10.2026); the last two are added on 25.10.2026.
export const ENRICHMENT_REVIEW_CODES: readonly string[] = [
  'AI_POS_SENSE_REVIEW_REJECTED',
  'AI_SINGLE_TRANSLATION_REQUIRED',
  'AI_REQUESTED_EXAMPLE_MISSING',
  'AI_SOURCE_PERIOD_CHANGED_TO_NEW_MOON',
  'pos_mismatch_filtered',
  'SELECTED_BM_ARTICLE_REQUIRED',         // no unique article of the POS for AI
  'SELECTED_ARTICLE_DEFINITION_MISSING',  // the article has no explanation
  // D10 10.11.2026 (D10_job_problems_v1): the AI example was generated twice and both times its highlighted
  // words did not match the sentence - a decision about one word (no example), not a failure of the job.
  'AI_EXAMPLE_HIGHLIGHTS_INVALID',
];

export const ENRICHMENT_REVIEW_PATTERN = new RegExp(ENRICHMENT_REVIEW_CODES.join('|'));

// AI context codes: the word gets the "for review" mark of 15.10.2026.
export const AI_CONTEXT_REVIEW_CODES: readonly string[] = [
  'SELECTED_BM_ARTICLE_REQUIRED',
  'SELECTED_ARTICLE_DEFINITION_MISSING',
];

export function aiContextReviewCode(message: string): string | null {
  const text = String(message ?? '');
  return AI_CONTEXT_REVIEW_CODES.find((code) => text.startsWith(code)) ?? null;
}

type GateItem = {
  status?: unknown;
  current_stage?: unknown;
  admission_reason?: unknown;
  admission_status?: unknown;
  promotion_status?: unknown;
};

// A function word rejected by design (same rule as the completion snapshot).
export function isFunctionWordItem(item: GateItem): boolean {
  return item?.current_stage === 'admission_gate' &&
    item?.admission_status === 'rejected' &&
    typeof item?.admission_reason === 'string' && item.admission_reason.startsWith('function_word_');
}

// A word stopped at the admission gate with a review reason.
export function isGateReviewItem(item: GateItem): boolean {
  return item?.status === 'done' &&
    item?.current_stage === 'admission_gate' &&
    item?.promotion_status === 'not_promoted' &&
    typeof item?.admission_reason === 'string' &&
    GATE_REVIEW_CODES.has(item.admission_reason);
}

// D10 27.10.2026 (agreed): a closed "surface as lemma" probe
// (_shared/d10-surface-probe.ts). Like a function word it is rejected by
// design: neither "for review" nor a blocker. Same rule as the completion
// snapshot v2 (admission_reason surface_probe_*, rule_type surface_probe).
export function isSurfaceProbeItem(item: GateItem): boolean {
  return item?.status === 'done' &&
    item?.current_stage === 'admission_gate' &&
    item?.promotion_status === 'not_promoted' &&
    item?.admission_status === 'rejected' &&
    typeof item?.admission_reason === 'string' &&
    item.admission_reason.startsWith('surface_probe_');
}
