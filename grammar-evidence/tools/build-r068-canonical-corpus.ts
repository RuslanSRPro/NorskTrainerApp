import { buildCanonicalSurfaceDocumentV1 } from '../../supabase/functions/_shared/nlp/canonical-surface-boundary-v1.ts';
import {
  assertSqlStructuralCompatibilityMapV1,
  buildSqlStructuralCompatibilityMapV1,
  toSqlStructuralRpcTokensV1,
} from '../../supabase/functions/_shared/nlp/sql-structural-compatibility-map-v1.ts';

const cases = [
  { text: 'Katten sover', expectedSubject: 'Katten', expectedPredicate: 'sover' },
  { text: 'Jeg sover', expectedSubject: 'Jeg', expectedPredicate: 'sover' },
  { text: 'Han er glad', expectedSubject: 'Han', expectedPredicate: 'er glad' },
  { text: 'Hunden spiser fisken', expectedSubject: 'Hunden', expectedPredicate: 'spiser' },
  { text: 'Jenta leser boken', expectedSubject: 'Jenta', expectedPredicate: 'leser' },
  { text: 'Barnet drikker vann', expectedSubject: 'Barnet', expectedPredicate: 'drikker' },
  { text: 'Fisken spiser hunden', expectedSubject: 'Fisken', expectedPredicate: 'spiser' },
  { text: 'Jeg spiser fisken', expectedSubject: 'Jeg', expectedPredicate: 'spiser' },
  { text: 'Hunden spiser raskt', expectedSubject: 'Hunden', expectedPredicate: 'spiser' },
  { text: 'Hunden spiser fisken i dag', expectedSubject: 'Hunden', expectedPredicate: 'spiser' },
  { text: 'Den store hunden spiser fisken', expectedSubject: 'hunden', expectedPredicate: 'spiser' },
  { text: 'Spiser hunden fisken?', expectedSubject: 'hunden', expectedPredicate: 'Spiser' },
  { text: 'Hunden og fisken', expectedSubject: null, expectedPredicate: null },
  { text: 'Hunden', expectedSubject: null, expectedPredicate: null },
] as const;

const corpus = cases.map((item) => {
  const surface = buildCanonicalSurfaceDocumentV1(item.text);
  if (surface.sentences.length !== 1) {
    throw new Error('expected_one_sentence:' + item.text);
  }
  const map = buildSqlStructuralCompatibilityMapV1(surface, 0);
  const errors = assertSqlStructuralCompatibilityMapV1(surface, map);
  if (errors.length) throw new Error(item.text + ':' + errors.join(','));
  return {
    text: item.text,
    expectedSubject: item.expectedSubject,
    expectedPredicate: item.expectedPredicate,
    canonicalTokenIds: map.tokens.map((token) => token.canonicalTokenId),
    excludedCanonicalTokenIds: map.excludedCanonicalTokenIds,
    rpcTokens: toSqlStructuralRpcTokensV1(map),
  };
});

console.log(JSON.stringify({ producer: 'canonical-surface-boundary-v1 + sql-structural-compatibility-map-v1', releaseCode: 'runtime-structural-v1.37', cases: corpus }, null, 2));
