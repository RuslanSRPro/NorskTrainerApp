import type { SourceCheck, LookupResult } from './types.ts';
import type { SourceLookupResult } from '../verification/adapters/shared.ts';

import { checkNAOBLive } from '../verification/adapters/naob.ts';
import { checkOrdbokeneLive } from '../verification/adapters/ordbokene.ts';
import { checkWiktionaryLive } from '../verification/adapters/wiktionary.ts';
import { checkSpraakradetLive } from '../verification/adapters/sprakradet.ts';
import { checkLexinLive } from '../verification/adapters/lexin.ts';

export async function lookupSource(check: SourceCheck): Promise<LookupResult> {
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
        ? await checkNAOBLive(query, query)
        : check.source === 'Ordbokene'
          ? await checkOrdbokeneLive(query, query)
          : check.source === 'Wiktionary'
            ? await checkWiktionaryLive(query, query)
            : check.source === 'Språkrådet'
              ? await checkSpraakradetLive(query, query)
              : check.source === 'Lexin'
                ? await checkLexinLive(query, query)
                : null;

    if (!result) {
      return {
        status: 'failed',
        quality: 'error',
        found: false,
        error: `Unknown source: ${check.source}`,
      };
    }

    return normalizeSourceLookupResult(result);
  } catch (error) {
    return {
      status: 'failed',
      quality: 'error',
      found: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeSourceLookupResult(result: SourceLookupResult): LookupResult {
  return {
    status:
      result.quality === 'error'
        ? 'failed'
        : result.quality === 'not_found' || result.quality === 'not_checked'
          ? 'partial'
          : 'done',

    quality:
      result.quality === 'registered_entry' ||
      result.quality === 'structured_entry_match'
        ? 'strong'
        : result.quality === 'exact_expression_match' ||
            result.quality === 'learner_dictionary' ||
            result.quality === 'normative_reference'
          ? 'medium'
          : result.quality === 'not_found'
            ? 'not_found'
            : result.quality === 'error'
              ? 'error'
              : 'weak',

    found: result.found === true,
    registered_entry: result.registered_entry,
    whole_unit_match: result.whole_unit_match,
    component_match: result.component_match,
    usage_match: result.usage_match,
    urls: result.urls,
    evidence: {
      source: result.source,
      original_quality: result.quality,
      evidence_label: result.evidence_label,
      note: result.note,
      raw_preview: result.raw_preview,
    },
    error: result.error ?? null,
  };
}