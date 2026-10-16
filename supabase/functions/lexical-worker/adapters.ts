import type {
  SourceCheck,
  LookupResult,
} from './types.ts';

import type {
  SourceLookupResult,
} from '../verification/adapters/shared.ts';

import { checkNAOBLive } from '../verification/adapters/naob.ts';
import { checkOrdbokeneLive } from '../verification/adapters/ordbokene.ts';
import { checkWiktionaryLive } from '../verification/adapters/wiktionary.ts';
import { checkSpraakradetLive } from '../verification/adapters/sprakradet.ts';
import { checkLexinLive } from '../verification/adapters/lexin.ts';
import { posScope, type PosScopedLookup } from '../verification/adapters/pos-scope.ts';

export async function lookupSource(
  check: SourceCheck,
): Promise<LookupResult> {
  if (check.stage !== 'lemma') {
    return {
      status: 'failed',
      quality: 'error',
      found: false,
      error: `Unsupported stage in worker v1: ${check.stage}`,
    };
  }

  try {
    const query = check.query;

    const result =
      check.source === 'NAOB'
        ? await checkNAOBLive(query, query, check.pos)
        : check.source === 'Ordbokene'
          ? await checkOrdbokeneLive(query, query, check.pos, check.expected_expression_article, check.bound_token_article_ids,
              check.cached_search_article_ids?.length
                ? { articleIds: check.cached_search_article_ids, checkedAt: check.cached_search_checked_at ?? null }
                : null)
          : check.source === 'Wiktionary'
            ? await checkWiktionaryLive(query, query, check.pos)
            : check.source === 'Språkrådet'
              ? await checkSpraakradetLive(
                  query,
                  query,
                )
              : check.source === 'Lexin'
                ? await checkLexinLive(
                    query,
                    query,
                    check.pos,
                  )
                : null;

    if (!result) {
      return {
        status: 'failed',
        quality: 'error',
        found: false,
        error: `Unknown source: ${check.source}`,
      };
    }

    // D10 15.10.2026 (step B): Ordbøkene filters by the card POS itself, so a
    // found article is a POS match. Språkrådet shows no POS.
    const scoped: PosScopedLookup = result as PosScopedLookup;
    if (!scoped.pos_scope) {
      scoped.pos_scope = check.source === 'Ordbokene' && check.query_type === 'token' && result.found === true && check.pos
        ? posScope(check.pos, [check.pos], 'ordbokene_pos_filter')
        : posScope(check.query_type === 'token' ? check.pos : null, [], null);
    }
    return normalizeSourceLookupResult(scoped);
  } catch (error) {
    return {
      status: 'failed',
      quality: 'error',
      found: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

function normalizeSourceLookupResult(
  result: PosScopedLookup,
): LookupResult {
  return {
    status:
      result.quality === 'error'
        ? 'failed'
        : result.quality === 'not_found' ||
            result.quality === 'not_checked'
          ? 'partial'
          : 'done',

    quality:
      result.quality ===
        'registered_entry' ||
      result.quality ===
        'structured_entry_match'
        ? 'strong'
        : result.quality ===
              'exact_expression_match' ||
            result.quality ===
              'learner_dictionary' ||
            result.quality ===
              'normative_reference'
          ? 'medium'
          : result.quality ===
                'not_found'
            ? 'not_found'
            : result.quality === 'error'
              ? 'error'
              : 'weak',

    found: result.found === true,

    registered_entry:
      result.registered_entry,

    whole_unit_match:
      result.whole_unit_match,

    component_match:
      result.component_match,

    usage_match:
      result.usage_match,

    urls: result.urls,

    authoritative_relations:
      result.authoritative_relations,

    evidence: {
      source: result.source,

      original_quality:
        result.quality,

      evidence_label:
        result.evidence_label,

      note: result.note,

      raw_preview:
        result.raw_preview,

      // D10 15.10.2026 (step B): additive, read by the server tier.
      requested_pos: result.pos_scope?.requested_pos ?? null,
      found_pos: result.pos_scope?.found_pos ?? [],
      pos_match: result.pos_scope?.pos_match ?? 'not_applicable',
      pos_basis: result.pos_scope?.pos_basis ?? null,
    },

    error: result.error ?? null,
  };
}
