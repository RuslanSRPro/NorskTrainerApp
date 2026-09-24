// Norsk Trainer — tests for Canonical TAM Morph Source Adapter V1

import {
  extractCanonicalTamMorphSourceFactsV1,
} from './canonical-tam-morph-source-adapter-v1.ts';

import {
  mapCanonicalTamSourceFactsV1,
  type CanonicalTamSourceMappingRuleV1,
} from './canonical-tam-source-mapping-v1.ts';

import type {
  CanonicalLanguageGraphV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function node(
  id: string,
  type: LanguageGraphNodeV1['type'],
  features: Record<string, unknown>,
  options?: {
    status?: LanguageGraphNodeV1['status'];
    tokenId?: string;
    provenanceIds?: string[];
  },
): LanguageGraphNodeV1 {
  const tokenId = options?.tokenId;

  return {
    id,
    type,
    status: options?.status ?? 'candidate',
    span:
      tokenId
        ? {
            startTokenId: tokenId,
            endTokenId: tokenId,
            tokenIds: [tokenId],
          }
        : undefined,
    features,
    producer: 'test',
    evidenceIds: [`evidence:${id}`],
    provenanceIds:
      options?.provenanceIds ?? [`prov:${id}`],
  };
}

function graph(
  overrides?: {
    predicateHead?: string;
    phraseHead?: string;
    morphToken?: string;
    canonicalFeatures?: Record<string, unknown>;
    morphStatus?: LanguageGraphNodeV1['status'];
    morphProvenance?: string[];
  },
): CanonicalLanguageGraphV1 {
  const predicateHead =
    overrides?.predicateHead ?? 'tok:1';

  const phraseHead =
    overrides?.phraseHead ?? 'tok:1';

  const morphToken =
    overrides?.morphToken ?? 'tok:1';

  return {
    version: 'canonical-language-graph-v1',
    documentId: 'doc:test',
    surfaceVersion: 'canonical-surface-boundary-v1',

    nodes: [
      node(
        'tok:1',
        'token',
        {},
        { tokenId: 'tok:1' },
      ),

      node(
        'morph:1',
        'morph_reading',
        {
          formKey: 'preterite',
          canonicalFeatures:
            overrides?.canonicalFeatures ??
            { Tense: 'Past', VerbForm: 'Fin' },
        },
        {
          tokenId: morphToken,
          status:
            overrides?.morphStatus ??
            'candidate',
          provenanceIds:
            overrides?.morphProvenance ??
            ['prov:canonical-candidate-lattice-v1:morph:verb:preterite'],
        },
      ),

      node(
        'phrase:1',
        'phrase',
        {
          headTokenId: phraseHead,
          headMorphReadingId: 'morph:1',
        },
      ),

      node(
        'predicate:1',
        'predicate',
        {
          realizedByPhraseId: 'phrase:1',
          anchorHeadId: predicateHead,
        },
      ),
    ],

    edges: [],
    evidence: [],
    provenance: [],
    alternativeSets: [],
    constraintTrace: [],
    producerState: {},

    invariants: {
      oneCanonicalGraph: true,
      stableSurfaceTokenIds: true,
      appendEvidenceDoNotReparseText: true,
      candidatesMayCoexist: true,
      resolvedFactsRequireEvidence: true,
      learnerErrorSeparateFromParserUncertainty: true,
    },
  };
}

Deno.test(
  'TAM A3 extracts explicit Tense=Past from the exact head morph occurrence',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph(),
      );

    assert(
      result.sourceFacts.length === 1,
      'expected one source fact',
    );

    assert(
      result.rejected.length === 0,
      'expected no rejection',
    );

    const fact = result.sourceFacts[0];

    assert(
      fact.predicateId === 'predicate:1',
      'predicate occurrence must be preserved',
    );

    assert(
      fact.headTokenId === 'tok:1',
      'head token occurrence must be preserved',
    );

    assert(
      fact.sourceKind ===
        'grammar_morph_form_registry_v1',
      'source contract must be explicit',
    );

    assert(
      fact.sourceKey === 'Tense' &&
      fact.sourceValue === 'Past',
      'explicit source feature must be preserved',
    );
  },
);

Deno.test(
  'TAM A3 fails closed when predicate and phrase heads disagree',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph({
          predicateHead: 'tok:1',
          phraseHead: 'tok:2',
        }),
      );

    assert(
      result.sourceFacts.length === 0,
      'must not emit a source fact',
    );

    assert(
      result.rejected[0]?.reason ===
        'head_occurrence_mismatch',
      'expected head occurrence mismatch',
    );
  },
);

Deno.test(
  'TAM A3 fails closed when morph reading belongs to another token occurrence',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph({
          morphToken: 'tok:2',
        }),
      );

    assert(
      result.sourceFacts.length === 0,
      'must not emit a source fact',
    );

    assert(
      result.rejected[0]?.reason ===
        'morph_occurrence_mismatch',
      'expected morph occurrence mismatch',
    );
  },
);

Deno.test(
  'TAM A3 does not infer tense from formKey when canonicalFeatures lacks Tense',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph({
          canonicalFeatures: {
            VerbForm: 'Fin',
          },
        }),
      );

    assert(
      result.sourceFacts.length === 0,
      'formKey must not fabricate TAM',
    );

    assert(
      result.rejected[0]?.reason ===
        'no_authorized_feature',
      'expected no authorized feature',
    );
  },
);

Deno.test(
  'TAM A3 does not generalize an unauthorized explicit Tense value',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph({
          canonicalFeatures: {
            Tense: 'Pres',
          },
        }),
      );

    assert(
      result.sourceFacts.length === 0,
      'A3 currently authorizes Past only',
    );

    assert(
      result.rejected[0]?.reason ===
        'no_authorized_feature',
      'expected no authorized feature',
    );
  },
);

Deno.test(
  'TAM A3 rejects blocked morph evidence',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph({
          morphStatus: 'blocked',
        }),
      );

    assert(
      result.sourceFacts.length === 0,
      'blocked morphology must not emit TAM source fact',
    );

    assert(
      result.rejected[0]?.reason ===
        'morph_reading_not_usable',
      'expected unusable morph reading',
    );
  },
);

Deno.test(
  'TAM A3 requires source provenance',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph({
          morphProvenance: [],
        }),
      );

    // Predicate and phrase provenance must not substitute for
    // missing morphology-source provenance.
    assert(
      result.sourceFacts.length === 0,
      'missing morphology provenance must fail closed',
    );

    assert(
      result.rejected[0]?.reason ===
        'missing_source_provenance',
      'expected missing source provenance',
    );
  },
);

Deno.test(
  'TAM A3 does not accept unrelated provenance as registry source provenance',
  () => {
    const result =
      extractCanonicalTamMorphSourceFactsV1(
        graph({
          morphProvenance: [
            'prov:some-other-producer:source:1',
          ],
        }),
      );

    assert(
      result.sourceFacts.length === 0,
      'unrelated provenance must not authorize registry-backed TAM source fact',
    );

    assert(
      result.rejected[0]?.reason ===
        'missing_source_provenance',
      'expected missing registry source provenance',
    );
  },
);
Deno.test(
  'TAM A3 source fact maps through A2 only with an explicit exact mapping',
  () => {
    const extracted =
      extractCanonicalTamMorphSourceFactsV1(
        graph(),
      );

    assert(
      extracted.sourceFacts.length === 1,
      'expected source fact',
    );

    const mapping:
      CanonicalTamSourceMappingRuleV1 = {
        id: 'tam-map:registry:Tense=Past',
        sourceKind:
          'grammar_morph_form_registry_v1',
        sourceKey: 'Tense',
        sourceValue: 'Past',
        scope: 'predicate',
        dimension: 'tense',
        value: 'past',
        provenanceIds: [
          'prov:tam-map:Tense=Past',
        ],
      };

    const mapped =
      mapCanonicalTamSourceFactsV1(
        extracted.sourceFacts,
        [mapping],
      );

    assert(
      mapped.rejected.length === 0,
      'exact A2 mapping should succeed',
    );

    assert(
      mapped.evidenceFacts.length === 1,
      'expected one mapped TAM evidence fact',
    );

    const fact = mapped.evidenceFacts[0];

    assert(
      fact.predicateId === 'predicate:1' &&
      fact.headTokenId === 'tok:1',
      'A2 must preserve occurrence identity',
    );

    assert(
      fact.dimension === 'tense' &&
      fact.value === 'past',
      'explicit A2 semantic mapping must be preserved',
    );

    assert(
      fact.status === 'candidate',
      'mapping must not resolve TAM',
    );
  },
);

Deno.test(
  'TAM A3 without an explicit A2 mapping does not create TAM semantics',
  () => {
    const extracted =
      extractCanonicalTamMorphSourceFactsV1(
        graph(),
      );

    const mapped =
      mapCanonicalTamSourceFactsV1(
        extracted.sourceFacts,
        [],
      );

    assert(
      mapped.evidenceFacts.length === 0,
      'no implicit TAM evidence allowed',
    );

    assert(
      mapped.rejected[0]?.reason ===
        'no_exact_mapping',
      'expected exact mapping requirement',
    );
  },
);

