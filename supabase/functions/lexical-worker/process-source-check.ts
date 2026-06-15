import type {
  AuthoritativeRelationCandidate,
  SourceCheck,
  LookupResult,
} from './types.ts';

import { getCachedLookup, saveLookupCache } from './cache.ts';
import { lookupSource } from './adapters.ts';

function sanitizeEvidence(
  raw: Record<string, unknown> | null | undefined,
) {
  const evidence = {
    ...(raw ?? {}),
  } as Record<string, unknown>;

  delete evidence.registered_entry;
  delete evidence.whole_unit_match;
  delete evidence.component_match;
  delete evidence.usage_match;

  return evidence;
}

function entityForCheck(
  check: SourceCheck,
): { type: 'lexeme' | 'expression'; id: string } | null {
  if (check.expression_id) {
    return {
      type: 'expression',
      id: check.expression_id,
    };
  }

  if (check.lexeme_id) {
    return {
      type: 'lexeme',
      id: check.lexeme_id,
    };
  }

  return null;
}

function normalizeRelationTarget(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function validRelationCandidate(
  candidate: AuthoritativeRelationCandidate,
): boolean {
  const target = normalizeRelationTarget(
    candidate.target_text ?? '',
  );

  if (!target) return false;
  if (target.length < 2) return false;
  if (target.length > 80) return false;
  if (target.split(' ').length > 8) return false;

  return true;
}

async function saveAuthoritativeRelations(
  supabase: any,
  check: SourceCheck,
  result: LookupResult,
): Promise<void> {
  const entity = entityForCheck(check);

  if (!entity) return;

  const relations =
    result.authoritative_relations ?? [];

  if (!relations.length) return;

  for (const relation of relations) {
    if (!validRelationCandidate(relation)) {
      continue;
    }

    const { error } = await supabase.rpc(
      'save_authoritative_semantic_relation',
      {
        p_source_entity_type: entity.type,
        p_source_entity_id: entity.id,

        p_relation_type: relation.relation_type,

        p_target_text: normalizeRelationTarget(
          relation.target_text,
        ),

        p_source: relation.source,
        p_confidence: relation.confidence,

        p_status: 'candidate',

        p_evidence: {
          source_check_id: check.id,
          job_id: check.job_id,
          item_id: check.item_id,
          query: check.query,
          query_type: check.query_type,
          evidence_label:
            relation.evidence_label ?? null,
          version:
            'authoritative-relation-persistence-v1',
        },

        p_urls: relation.url
          ? [relation.url]
          : [],

        p_target_entity_type: null,
        p_target_entity_id: null,
      },
    );

    if (error) {
      throw new Error(
        `save_authoritative_semantic_relation failed for ${check.id}: ${error.message}`,
      );
    }
  }
}

export async function processSourceCheck(
  supabase: any,
  check: SourceCheck,
): Promise<void> {
  let result: LookupResult | null =
    await getCachedLookup(supabase, check);

  if (!result) {
    result = await lookupSource(check);

    await saveLookupCache(
      supabase,
      check,
      result,
    );
  }

  const evidence = {
    ...sanitizeEvidence(result.evidence),

    original_quality: result.quality,

    registered_entry:
      result.registered_entry ?? false,

    whole_unit_match:
      result.whole_unit_match ?? false,

    component_match:
      result.component_match ?? false,

    usage_match:
      result.usage_match ?? false,
  };

  const { error } = await supabase.rpc(
    'update_lexeme_source_check_status',
    {
      p_check_id: check.id,

      p_status: result.status,

      p_quality: result.quality,

      p_found: result.found,

      p_error_code: result.error
        ? 'lookup_error'
        : null,

      p_error_message:
        result.error ?? null,

      p_evidence: evidence,

      p_urls: result.urls ?? [],

      p_authoritative_relations:
        result.authoritative_relations ?? [],
    },
  );

  if (error) {
    throw new Error(
      `update_lexeme_source_check_status failed for ${check.id}: ${error.message}`,
    );
  }

  await saveAuthoritativeRelations(
    supabase,
    check,
    result,
  );
}