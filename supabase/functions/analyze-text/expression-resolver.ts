// supabase/functions/analyze-text/expression-resolver.ts
// Norsk Trainer — Expression Resolver v1
//
// Responsibility:
//   Resolve expression PlannedItems into dictionary-aware objects.
//
// Current v1:
//   - DB-only resolver.
//   - Reads expression_catalog.
//   - Fills resolved, network_root_lemma, expression_subtype, verification_status.
//
// Future v2 extension:
//   expression_catalog
//      ↓
//   trusted_expressions
//      ↓
//   Ordbokene
//      ↓
//   NAOB
//      ↓
//   Lexin
//      ↓
//   Wiktionary
//
// Important:
//   This module does NOT parse text.
//   This module does NOT generate candidates.
//   This module does NOT call Lexeme360.
//   This module does NOT promote lexemes.
//   This module does NOT write to database.

import { normalizeExpression } from '../_shared/nlp/normalize.ts';
import type { PlannedItem, SurfaceResolution } from './grammar-parser.ts';

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

export type ExpressionResolution = SurfaceResolution & {
  root_lemma: string | null;
  verification_status: string | null;
  expression_subtype: string | null;
};

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

function buildExpressionResolution(
  row: ExpressionCatalogRow,
): ExpressionResolution {
  const lemma = normalizeExpression(row.lemma || '');

  return {
    lexeme_id: row.lexeme_id,
    lemma,
    pos: 'expression',
    form_type: 'expression',
    grammatical_features: {
      resolver: 'expression_catalog',
      expression_id: row.id,
      root_lemma: row.root_lemma ?? null,
      verification_status: row.verification_status ?? null,
      expression_subtype: row.expression_subtype ?? null,
    },
    confidence: row.lexeme_id ? 'high' : 'medium',
    source: 'expression_catalog',

    root_lemma:
      normalizeRootLemma(row.root_lemma) ||
      inferRootLemmaFromLemma(row.lemma),

    verification_status: row.verification_status ?? null,
    expression_subtype: row.expression_subtype ?? null,
  };
}

export async function resolveExpressions(
  supabase: SupabaseLike,
  items: PlannedItem[],
): Promise<{
  resolved: number;
  unresolved: number;
}> {
  const expressionIds = [
    ...new Set(
      items
        .filter((item) => item.match_type === 'expression')
        .map((item) => item.expression_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (!expressionIds.length) {
    return {
      resolved: 0,
      unresolved: 0,
    };
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
    .in('id', expressionIds);

  if (error) throw error;

  const byId = new Map<string, ExpressionCatalogRow>();

  for (const row of data ?? []) {
    byId.set(String(row.id), row as ExpressionCatalogRow);
  }

  let resolved = 0;
  let unresolved = 0;

  for (const item of items) {
    if (item.match_type !== 'expression') continue;
    if (!item.expression_id) {
      unresolved++;
      continue;
    }

    const row = byId.get(item.expression_id);

    if (!row) {
      unresolved++;
      continue;
    }

    const expressionResolution = buildExpressionResolution(row);

    item.resolved = expressionResolution;
    item.network_root_lemma = expressionResolution.root_lemma;
    item.expression_subtype =
      expressionResolution.expression_subtype ?? item.expression_subtype ?? null;

    (item as any).verification_status =
      expressionResolution.verification_status;

    resolved++;
  }

  console.log('[EXPRESSION RESOLVER]', {
    expression_ids: expressionIds.length,
    resolved,
    unresolved,
    samples: items
      .filter((item) => item.match_type === 'expression')
      .slice(0, 10)
      .map((item) => ({
        surface: item.surface_form,
        lemma: item.normalized_lemma,
        expression_id: item.expression_id,
        lexeme_id: item.resolved?.lexeme_id ?? null,
        network_root_lemma: item.network_root_lemma ?? null,
        verification_status: (item as any).verification_status ?? null,
        expression_subtype: item.expression_subtype ?? null,
      })),
  });

  return {
    resolved,
    unresolved,
  };
}