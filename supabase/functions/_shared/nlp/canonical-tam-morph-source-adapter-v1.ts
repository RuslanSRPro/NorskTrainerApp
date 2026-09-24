// Norsk Trainer — Canonical TAM Morph Source Adapter V1
//
// v1.48 A3
//
// Extracts one explicitly authorized TAM source fact from the exact
// morphology reading that owns the head of the phrase realizing a predicate.
//
// This adapter:
//   - reads the graph only;
//   - requires exact predicate -> phrase -> head morph occurrence binding;
//   - reads explicit canonicalFeatures only;
//   - does not infer TAM from formKey, construction names, lemmas, or substrings;
//   - does not resolve TAM.
//
// First authorized mapping:
//   grammar_morph_form_registry_v1 canonicalFeatures["Tense"] === "Past"
//   -> explicit source fact Tense=Past.
//
// Semantic mapping to tense=past remains A2's responsibility.

import type {
  CanonicalLanguageGraphV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import type {
  CanonicalTamSourceFactV1,
} from './canonical-tam-source-mapping-v1.ts';

export const CANONICAL_TAM_MORPH_SOURCE_ADAPTER_PRODUCER_V1 =
  'canonical_tam_morph_source_adapter_v1';

export const CANONICAL_TAM_MORPH_SOURCE_ADAPTER_VERSION_V1 =
  '1';

export type CanonicalTamMorphSourceAdapterRejectionReasonV1 =
  | 'predicate_not_usable'
  | 'missing_realized_phrase'
  | 'phrase_not_usable'
  | 'head_occurrence_mismatch'
  | 'missing_head_morph_reading'
  | 'morph_reading_not_usable'
  | 'morph_occurrence_mismatch'
  | 'missing_source_provenance'
  | 'no_authorized_feature';

export type CanonicalTamMorphSourceAdapterRejectionV1 = {
  predicateId: string;
  reason: CanonicalTamMorphSourceAdapterRejectionReasonV1;
};

export type CanonicalTamMorphSourceAdapterResultV1 = {
  producer: typeof CANONICAL_TAM_MORPH_SOURCE_ADAPTER_PRODUCER_V1;
  producerVersion: typeof CANONICAL_TAM_MORPH_SOURCE_ADAPTER_VERSION_V1;
  sourceFacts: CanonicalTamSourceFactV1[];
  rejected: CanonicalTamMorphSourceAdapterRejectionV1[];
};

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function usableNode(node: LanguageGraphNodeV1 | undefined): boolean {
  return Boolean(
    node &&
    (
      node.status === 'candidate' ||
      node.status === 'resolved'
    ),
  );
}

function nodeById(
  graph: CanonicalLanguageGraphV1,
  id: string,
): LanguageGraphNodeV1 | undefined {
  return graph.nodes.find((node) => node.id === id);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function exactMorphTokenId(
  morph: LanguageGraphNodeV1,
): string | undefined {
  const tokenIds = morph.span?.tokenIds ?? [];

  if (tokenIds.length !== 1) {
    return undefined;
  }

  const tokenId = stringValue(tokenIds[0]);

  if (!tokenId) {
    return undefined;
  }

  if (
    morph.span?.startTokenId &&
    morph.span.startTokenId !== tokenId
  ) {
    return undefined;
  }

  if (
    morph.span?.endTokenId &&
    morph.span.endTokenId !== tokenId
  ) {
    return undefined;
  }

  return tokenId;
}

export function extractCanonicalTamMorphSourceFactsV1(
  graph: CanonicalLanguageGraphV1,
  predicateIds?: readonly string[],
): CanonicalTamMorphSourceAdapterResultV1 {
  const requested =
    predicateIds
      ? new Set(predicateIds)
      : undefined;

  const predicates =
    graph.nodes
      .filter(
        (node) =>
          node.type === 'predicate' &&
          (!requested || requested.has(node.id)),
      )
      .sort((a, b) => a.id.localeCompare(b.id));

  const sourceFacts: CanonicalTamSourceFactV1[] = [];
  const rejected: CanonicalTamMorphSourceAdapterRejectionV1[] = [];

  for (const predicate of predicates) {
    if (!usableNode(predicate)) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'predicate_not_usable',
      });
      continue;
    }

    const phraseId =
      stringValue(
        predicate.features.realizedByPhraseId,
      );

    if (!phraseId) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'missing_realized_phrase',
      });
      continue;
    }

    const phrase = nodeById(graph, phraseId);

    if (
      !phrase ||
      phrase.type !== 'phrase' ||
      !usableNode(phrase)
    ) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'phrase_not_usable',
      });
      continue;
    }

    const predicateHead =
      stringValue(
        predicate.features.anchorHeadId,
      );

    const phraseHead =
      stringValue(
        phrase.features.headTokenId,
      );

    if (
      !predicateHead ||
      !phraseHead ||
      predicateHead !== phraseHead
    ) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'head_occurrence_mismatch',
      });
      continue;
    }

    const morphId =
      stringValue(
        phrase.features.headMorphReadingId,
      );

    if (!morphId) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'missing_head_morph_reading',
      });
      continue;
    }

    const morph = nodeById(graph, morphId);

    if (
      !morph ||
      morph.type !== 'morph_reading' ||
      !usableNode(morph)
    ) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'morph_reading_not_usable',
      });
      continue;
    }

    const morphTokenId =
      exactMorphTokenId(morph);

    if (
      !morphTokenId ||
      morphTokenId !== predicateHead
    ) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'morph_occurrence_mismatch',
      });
      continue;
    }

    const morphProvenanceIds =
      uniqueStrings(
        morph.provenanceIds,
      );

    const registryMorphProvenanceIds =
      morphProvenanceIds.filter(
        (id) =>
          id.startsWith(
            'prov:canonical-candidate-lattice-v1:morph:',
          ),
      );

    if (registryMorphProvenanceIds.length === 0) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'missing_source_provenance',
      });
      continue;
    }

    const provenanceIds =
      uniqueStrings([
        ...morphProvenanceIds,
        ...phrase.provenanceIds,
        ...predicate.provenanceIds,
      ]);

    if (provenanceIds.length === 0) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'missing_source_provenance',
      });
      continue;
    }

    const canonicalFeatures =
      asRecord(
        morph.features.canonicalFeatures,
      );

    const tense =
      canonicalFeatures
        ? stringValue(
            canonicalFeatures['Tense'],
          )
        : undefined;

    const verbForm =
      canonicalFeatures
        ? stringValue(
            canonicalFeatures['VerbForm'],
          )
        : undefined;

    // v1.48 A4 finite-tense boundary.
    //
    // Production registry rows prove that both finite forms and
    // participles may carry Tense. Tense alone therefore cannot
    // authorize predicate-tense evidence.
    //
    // Authorized tuples:
    //   VerbForm=Fin + Tense=Past
    //   VerbForm=Fin + Tense=Pres
    if (
      verbForm !== 'Fin' ||
      (tense !== 'Past' && tense !== 'Pres')
    ) {
      rejected.push({
        predicateId: predicate.id,
        reason: 'no_authorized_feature',
      });
      continue;
    }

    sourceFacts.push({
      id:
        `tam-source:morph:${predicate.id}:${morph.id}:VerbForm=Fin:Tense=${tense}`,

      predicateId:
        predicate.id,

      headTokenId:
        predicateHead,

      sourceKind:
        'grammar_morph_form_registry_v1',

      sourceKey:
        'FiniteTense',

      sourceValue:
        tense,

      sourceId:
        morph.id,

      evidenceIds:
        uniqueStrings([
          ...morph.evidenceIds,
          ...phrase.evidenceIds,
          ...predicate.evidenceIds,
        ]),

      provenanceIds,
    });
  }

  return {
    producer:
      CANONICAL_TAM_MORPH_SOURCE_ADAPTER_PRODUCER_V1,

    producerVersion:
      CANONICAL_TAM_MORPH_SOURCE_ADAPTER_VERSION_V1,

    sourceFacts,
    rejected,
  };
}



