// supabase/functions/analyze-text/candidate-catalog-bridge.ts
// Norsk Trainer — Candidate/Catalog Bridge v1
//
// Responsibility:
//   Bridge step between candidate-generator.ts and expression-resolver.ts.
//
//   candidate-generator.ts creates PlannedItems with expression_id: null,
//   assuming a later step will look them up by normalized_lemma. That step
//   never existed — expression-resolver.ts only resolves items that ALREADY
//   have an expression_id (by design, see its docstring). This module fills
//   that gap: it looks up each candidate's normalized_lemma directly in
//   expression_catalog, and if a match exists, sets expression_id + resolved
//   so the item behaves exactly like a normally-resolved expression from
//   this point onward (including for the Lexeme360 dedupe-by-id logic in
//   addLexeme360NetworkCandidates, and for promote_verification_results_for_job,
//   which would otherwise create a DUPLICATE expression_catalog row for an
//   expression that already exists).
//
// Important:
//   This module does NOT generate candidates (candidate-generator.ts does).
//   This module does NOT parse text (grammar-parser.ts does).
//   This module does NOT resolve already-linked expression_id items
//   (expression-resolver.ts does — this module only handles orphans).
//   This module does NOT write to the database.
//
// Run this BEFORE addLexeme360NetworkCandidates() in analyze-text/index.ts,
// so that its existingExpressionIds Set already contains any expression_id
// resolved here — preventing the network-candidate loader from re-adding
// the same expression a second time.

import { normalizeExpression } from '../_shared/nlp/normalize.ts';
import type { PlannedItem } from './grammar-parser.ts';

type SupabaseLike = {
  from: (table: string) => any;
};

type ExpressionCatalogRow = {
  id: string;
  lemma: string | null;
  root_lemma: string | null;
  lexeme_id: string | null;
  verification_status: string | null;
  expression_subtype: string | null;
};

// Same priority order used elsewhere in the pipeline (Lexin translation
// ranking, entity_translations sync trigger) — kept consistent on purpose.
const VERIFICATION_PRIORITY: Record<string, number> = {
  multi_source: 1,
  authoritative: 2,
  usage_verified: 3,
  candidate: 4,
};

function verificationRank(status: string | null): number {
  return VERIFICATION_PRIORITY[status ?? ''] ?? 9;
}

function normalizeRootLemma(value: unknown): string | null {
  const normalized = normalizeExpression(String(value ?? ''))
    .replace(/^å\s+/i, '')
    .trim();

  return normalized || null;
}

function inferRootLemmaFromLemma(lemma: string | null | undefined): string | null {
  const normalized = normalizeRootLemma(lemma);
  if (!normalized) return null;
  return normalized.split(/\s+/)[0] || null;
}

function isOrphanCandidate(item: PlannedItem): boolean {
  return (
    item.match_type === 'expression' &&
    !item.expression_id &&
    (item.match_strategy as unknown as string) === 'candidate_generator'
  );
}

/**
 * Looks up candidate_generator-produced items in expression_catalog by
 * normalized_lemma. Mutates matching items in place (sets expression_id,
 * resolved, network_root_lemma, expression_subtype, match_strategy),
 * mirroring the shape expression-resolver.ts produces for normal expressions.
 */
export async function resolveCandidatesAgainstCatalog(
  supabase: SupabaseLike,
  items: PlannedItem[],
): Promise<{ matched: number; unmatched: number }> {
  const orphans = items.filter(isOrphanCandidate);

  if (!orphans.length) {
    return { matched: 0, unmatched: 0 };
  }

  const lemmaKeys = [
    ...new Set(
      orphans
        .map((item) => normalizeExpression(item.normalized_lemma || item.normalized_input))
        .filter(Boolean),
    ),
  ];

  if (!lemmaKeys.length) {
    return { matched: 0, unmatched: orphans.length };
  }

  const { data, error } = await supabase
    .from('expression_catalog')
    .select(`
      id,
      lemma,
      root_lemma,
      lexeme_id,
      verification_status,
      expression_subtype
    `)
    .in('lemma', lemmaKeys);

  if (error) throw error;

  // Pick the best row per normalized lemma key, in case of duplicates
  // (should not normally happen, but be defensive rather than let
  // .maybeSingle()-style code throw on multiple rows).
  const bestByLemma = new Map<string, ExpressionCatalogRow>();

  for (const row of (data ?? []) as ExpressionCatalogRow[]) {
    const key = normalizeExpression(row.lemma ?? '');
    if (!key) continue;

    const existing = bestByLemma.get(key);

    if (!existing || verificationRank(row.verification_status) < verificationRank(existing.verification_status)) {
      bestByLemma.set(key, row);
    }
  }

  let matched = 0;
  let unmatched = 0;

  for (const item of orphans) {
    const key = normalizeExpression(item.normalized_lemma || item.normalized_input);
    const row = key ? bestByLemma.get(key) : undefined;

    if (!row) {
      unmatched++;
      continue;
    }

    const lemma = normalizeExpression(row.lemma || '');
    const rootLemma =
      normalizeRootLemma(row.root_lemma) || inferRootLemmaFromLemma(row.lemma);

    item.expression_id = row.id;
    item.network_root_lemma = rootLemma;
    item.expression_subtype = row.expression_subtype ?? item.expression_subtype ?? null;
    (item as any).verification_status = row.verification_status ?? null;

    item.resolved = row.lexeme_id
      ? {
          lexeme_id: row.lexeme_id,
          lemma,
          pos: 'expression',
          form_type: 'expression',
          grammatical_features: {
            resolver: 'candidate_generator_catalog_lookup',
            expression_id: row.id,
            root_lemma: rootLemma,
            verification_status: row.verification_status ?? null,
            expression_subtype: row.expression_subtype ?? null,
          },
          confidence: 'high',
          source: 'expression_catalog',
        }
      : null;

    item.match_strategy = 'candidate_generator_catalog_lookup' as any;

    matched++;
  }

  console.log('[CANDIDATE CATALOG BRIDGE]', {
    orphans: orphans.length,
    lemma_keys: lemmaKeys.length,
    catalog_rows_found: data?.length ?? 0,
    matched,
    unmatched,
    samples: orphans.slice(0, 10).map((item) => ({
      lemma: item.normalized_lemma,
      expression_id: item.expression_id,
      resolved_lexeme_id: item.resolved?.lexeme_id ?? null,
      match_strategy: item.match_strategy,
    })),
  });

  return { matched, unmatched };
}