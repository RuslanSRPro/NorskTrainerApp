// supabase/functions/analyze-text/expression-merge.ts
// Norsk Trainer — Expression Merge v1
//
// Responsibility:
//   Deduplicate expression PlannedItems coming from different discovery stages:
//
//   - Parser known expressions
//   - Candidate Generator
//   - Lexeme360 network
//
// This module does NOT parse text.
// This module does NOT verify.
// This module does NOT write to database.

import { normalizeExpression } from '../_shared/nlp/normalize.ts';
import type { PlannedItem } from './grammar-parser.ts';

function expressionKey(item: PlannedItem): string {
  return normalizeExpression(
    item.normalized_lemma ||
      item.normalized_input ||
      item.surface_form ||
      item.raw_input ||
      '',
  );
}

function priority(item: PlannedItem): number {
  if (item.match_strategy === 'exact_expression') return 100;
  if (item.match_strategy === 'compound_normalized') return 95;
  if (item.match_strategy === 'lexeme360_network_candidate') return 80;
  if (item.match_strategy === 'candidate_generator') return 60;
  return 10;
}

function mergeInto(target: PlannedItem, incoming: PlannedItem) {
  const targetAny = target as any;
  const incomingAny = incoming as any;

  target.expression_id = target.expression_id ?? incoming.expression_id;
  target.expression_subtype =
    target.expression_subtype ?? incoming.expression_subtype ?? null;

  target.network_root_lemma =
    target.network_root_lemma ?? incoming.network_root_lemma ?? null;

  target.compound_normalized =
    target.compound_normalized ?? incoming.compound_normalized ?? null;

  target.resolved = target.resolved ?? incoming.resolved ?? null;

  targetAny.verification_status =
    targetAny.verification_status ??
    incomingAny.verification_status ??
    null;

  targetAny.candidate_strategy =
    targetAny.candidate_strategy ??
    incomingAny.candidate_strategy ??
    null;

  const sources = new Set<string>(targetAny.match_sources ?? []);

  if (target.match_strategy) sources.add(target.match_strategy);
  if (incoming.match_strategy) sources.add(incoming.match_strategy);

  targetAny.match_sources = [...sources];

  targetAny.merged_from = [
    ...(targetAny.merged_from ?? []),
    {
      raw_input: incoming.raw_input,
      normalized_lemma: incoming.normalized_lemma,
      match_strategy: incoming.match_strategy,
      expression_id: incoming.expression_id,
      expression_subtype: incoming.expression_subtype ?? null,
      network_root_lemma: incoming.network_root_lemma ?? null,
    },
  ];
}

export function mergeExpressionItems(items: PlannedItem[]): {
  items: PlannedItem[];
  merged_count: number;
} {
  const result: PlannedItem[] = [];
  const byKey = new Map<string, PlannedItem>();
  let mergedCount = 0;

  for (const item of items) {
    if (item.match_type !== 'expression') {
      result.push(item);
      continue;
    }

    const key = expressionKey(item);

    if (!key) {
      result.push(item);
      continue;
    }

    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, item);
      result.push(item);
      continue;
    }

    mergedCount++;

    const existingPriority = priority(existing);
    const incomingPriority = priority(item);

    if (incomingPriority > existingPriority) {
      mergeInto(item, existing);

      const index = result.indexOf(existing);
      if (index >= 0) result[index] = item;

      byKey.set(key, item);
    } else {
      mergeInto(existing, item);
    }
  }

  console.log('[EXPRESSION MERGE]', {
    input_items: items.length,
    output_items: result.length,
    merged_count: mergedCount,
    merged_expressions: result
      .filter((item) => (item as any).match_sources?.length > 1)
      .map((item) => ({
        lemma: item.normalized_lemma,
        expression_id: item.expression_id,
        match_strategy: item.match_strategy,
        match_sources: (item as any).match_sources,
        network_root_lemma: item.network_root_lemma,
        expression_subtype: item.expression_subtype,
      })),
  });

  return {
    items: result,
    merged_count: mergedCount,
  };
}