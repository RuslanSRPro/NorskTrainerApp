import type {
  CanonicalSurfaceDocumentV1,
  SurfaceTokenV1,
} from './canonical-surface-boundary-v1.ts';

export type SqlStructuralCompatibilityTokenV1 = {
  legacyIndex: number;
  canonicalTokenId: string;
  documentTokenIndex: number;
  canonicalSentenceTokenIndex: number;
  sentenceIndex: number;
  surface: string;
  normalizedSurface: string;
  startUtf16: number;
  endUtf16: number;
  kind: Extract<SurfaceTokenV1['kind'], 'word' | 'number'>;
};

export type SqlStructuralCompatibilityMapV1 = {
  version: 'sql-structural-compatibility-map-v1';
  sentenceIndex: number;
  sentenceId: string;
  tokens: SqlStructuralCompatibilityTokenV1[];
  canonicalToLegacy: Record<string, number>;
  excludedCanonicalTokenIds: string[];
  invariants: {
    noRetokenization: true;
    oneLegacyTokenToOneCanonicalToken: true;
    documentTokenIdentityPreserved: true;
    tokenIndexBase: 1;
    acceptedSurfaceKinds: readonly ['word', 'number'];
    excludedSurfaceTokensRemainCanonical: true;
  };
};

export type SqlStructuralRpcTokenV1 = {
  legacy_index: number;
  canonical_token_id: string;
  document_token_index: number;
  sentence_token_index: number;
  start_utf16: number;
  end_utf16: number;
  surface: string;
  normalized_surface: string;
  kind: 'word' | 'number';
};

export function buildSqlStructuralCompatibilityMapV1(
  surface: CanonicalSurfaceDocumentV1,
  sentenceIndex: number,
): SqlStructuralCompatibilityMapV1 {
  const sentence = surface.sentences[sentenceIndex];
  if (!sentence) throw new Error(`sentence_not_found:${sentenceIndex}`);

  const sentenceIds = new Set(sentence.tokenIds);
  const sentenceTokens = surface.tokens
    .filter((token) => sentenceIds.has(token.id))
    .sort(
      (a, b) =>
        (a.sentenceTokenIndex ?? Number.MAX_SAFE_INTEGER) -
        (b.sentenceTokenIndex ?? Number.MAX_SAFE_INTEGER),
    );

  const accepted = sentenceTokens.filter(
    (token): token is SurfaceTokenV1 & { kind: 'word' | 'number' } =>
      token.kind === 'word' || token.kind === 'number',
  );

  const tokens: SqlStructuralCompatibilityTokenV1[] = accepted.map(
    (token, index) => ({
      legacyIndex: index + 1,
      canonicalTokenId: token.id,
      documentTokenIndex: token.documentTokenIndex,
      canonicalSentenceTokenIndex: token.sentenceTokenIndex ?? -1,
      sentenceIndex,
      surface: token.surface,
      normalizedSurface: token.normalizedSurface,
      startUtf16: token.startUtf16,
      endUtf16: token.endUtf16,
      kind: token.kind,
    }),
  );

  const canonicalToLegacy: Record<string, number> = {};
  for (const token of tokens) canonicalToLegacy[token.canonicalTokenId] = token.legacyIndex;

  return {
    version: 'sql-structural-compatibility-map-v1',
    sentenceIndex,
    sentenceId: sentence.id,
    tokens,
    canonicalToLegacy,
    excludedCanonicalTokenIds: sentenceTokens
      .filter((token) => token.kind !== 'word' && token.kind !== 'number')
      .map((token) => token.id),
    invariants: {
      noRetokenization: true,
      oneLegacyTokenToOneCanonicalToken: true,
      documentTokenIdentityPreserved: true,
      tokenIndexBase: 1,
      acceptedSurfaceKinds: ['word', 'number'],
      excludedSurfaceTokensRemainCanonical: true,
    },
  };
}

export function canonicalTokenIdForSqlStructuralIndexV1(
  map: SqlStructuralCompatibilityMapV1,
  legacyIndex: unknown,
): string | undefined {
  const index = Number(legacyIndex);
  if (!Number.isInteger(index) || index < 1) return undefined;
  return map.tokens[index - 1]?.canonicalTokenId;
}

export function canonicalTokenIdsForSqlStructuralRangeV1(
  map: SqlStructuralCompatibilityMapV1,
  start: unknown,
  end: unknown,
): string[] {
  const from = Number(start);
  const to = Number(end);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return [];
  return map.tokens.slice(from - 1, to).map((token) => token.canonicalTokenId);
}

export function toSqlStructuralRpcTokensV1(
  map: SqlStructuralCompatibilityMapV1,
): SqlStructuralRpcTokenV1[] {
  return map.tokens.map((token) => ({
    legacy_index: token.legacyIndex,
    canonical_token_id: token.canonicalTokenId,
    document_token_index: token.documentTokenIndex,
    sentence_token_index: token.canonicalSentenceTokenIndex,
    start_utf16: token.startUtf16,
    end_utf16: token.endUtf16,
    surface: token.surface,
    normalized_surface: token.normalizedSurface,
    kind: token.kind,
  }));
}

export function assertSqlStructuralCompatibilityMapV1(
  surface: CanonicalSurfaceDocumentV1,
  map: SqlStructuralCompatibilityMapV1,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < map.tokens.length; i++) {
    const item = map.tokens[i];
    const expectedLegacyIndex = i + 1;

    if (item.legacyIndex !== expectedLegacyIndex) {
      errors.push(`non_contiguous_legacy_index:${expectedLegacyIndex}:${item.legacyIndex}`);
    }
    if (seen.has(item.canonicalTokenId)) errors.push(`duplicate_canonical_mapping:${item.canonicalTokenId}`);
    seen.add(item.canonicalTokenId);

    const token = surface.tokens.find((x) => x.id === item.canonicalTokenId);
    if (!token) {
      errors.push(`missing_canonical_token:${item.canonicalTokenId}`);
      continue;
    }
    if (token.sentenceIndex !== map.sentenceIndex) errors.push(`sentence_index_mismatch:${item.canonicalTokenId}`);
    if (token.documentTokenIndex !== item.documentTokenIndex) errors.push(`document_index_mismatch:${item.canonicalTokenId}`);
    if (token.kind !== 'word' && token.kind !== 'number') errors.push(`unsupported_surface_kind_leaked:${item.canonicalTokenId}`);
    if (surface.text.slice(item.startUtf16, item.endUtf16) !== item.surface) errors.push(`surface_span_mismatch:${item.canonicalTokenId}`);
  }

  const excluded = new Set(map.excludedCanonicalTokenIds);
  for (const tokenId of excluded) {
    if (seen.has(tokenId)) errors.push(`excluded_token_also_mapped:${tokenId}`);
  }

  return errors;
}
