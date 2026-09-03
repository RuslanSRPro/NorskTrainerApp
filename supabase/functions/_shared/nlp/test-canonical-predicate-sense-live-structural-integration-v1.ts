import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  buildCanonicalSurfaceDocumentV1,
} from './canonical-surface-boundary-v1.ts';

import {
  buildCanonicalConstructionCandidateLatticePatchV1,
} from './canonical-construction-candidate-lattice-v1.ts';

import {
  buildCanonicalConstructionProjectionsFromFrozenGrammarV1,
  type CanonicalConstructionMorphRegistryEntryV1,
  type CanonicalFrozenGrammarFactV1,
} from './canonical-construction-projection-adapter-v1.ts';

import {
  deriveCanonicalPredicateSenseSourceRoleProjectionsV1,
} from './canonical-predicate-sense-source-role-adapter-v1.ts';

import {
  deriveCanonicalPredicateSenseRoleOntologyV1,
  filterCanonicalPredicateSenseSourceRolesByOntologyV1,
} from './canonical-predicate-sense-role-ontology-v1.ts';

import {
  bindCanonicalPredicateSenseSourceRolesToOccurrencesV1,
} from './canonical-predicate-sense-occurrence-binding-v1.ts';

import {
  buildCanonicalPredicateSenseCandidateLatticePatchV1,
} from './canonical-predicate-sense-candidate-lattice-v1.ts';


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


// ====================================================================
// Exact frozen/live source facts already verified in v1.44 snapshots.
// ====================================================================

const CONSTRUCTION_SOURCE:
  CanonicalFrozenGrammarFactV1 = {
    candidateId:
      'fd5b9c73-6f64-4ca0-901f-ffa0cfe5f8ed',

    candidateCode:
      'verb.compound_form.finite_aux_nonfinite_main',

    sourceSection:
      '7.2',

    status:
      'source_verified',

    requiresHumanVerification:
      false,

    extractedPayload: {
      language:
        'no',

      candidate_code:
        'verb.compound_form.finite_aux_nonfinite_main',

      construction:
        'compound_verbal_form',

      finite_role:
        'auxiliary',

      nonfinite_role:
        'main_verb',

      semantic_block:
        'verb.compound_form',

      source_section:
        '7.2',
    },

    digitalModel: {
      model: {
        type:
          'construction_compatibility',

        subtype:
          'finite_auxiliary_nonfinite_main_verb',

        version:
          1,

        learning: {
          source_strict_runtime:
            true,
        },
      },
    },

    executionContract: {
      audit: {
        version:
          1,

        disposition:
          'KEEP_GRAMMAR_RUNTIME',
      },

      execution: {
        role:
          'construction',

        consumed_by: [
          'construction_resolution',
          'predicate_builder',
        ],
      },

      placement: {
        target_layers: [
          'runtime',
        ],
      },
    },
  };


const FINITE_INVENTORY:
  CanonicalFrozenGrammarFactV1 = {
    candidateId:
      '9655ab7a-dacf-4a39-a942-df2b9f1e63a1',

    candidateCode:
      'verb.form.finite.inventory',

    sourceSection:
      '7.1.2',

    status:
      'source_verified',

    requiresHumanVerification:
      false,

    extractedPayload: {
      language:
        'no',

      candidate_code:
        'verb.form.finite.inventory',

      source_section:
        '7.1.2',

      form_types: [
        'present',
        'past',
        'imperative',
      ],
    },
  };


const NONFINITE_INVENTORY:
  CanonicalFrozenGrammarFactV1 = {
    candidateId:
      '9eb36805-2d3b-40a9-816e-59cc8278780e',

    candidateCode:
      'verb.form.nonfinite.inventory',

    sourceSection:
      '7.1.2',

    status:
      'source_verified',

    requiresHumanVerification:
      false,

    extractedPayload: {
      language:
        'no',

      candidate_code:
        'verb.form.nonfinite.inventory',

      source_section:
        '7.1.2',

      form_types: [
        'infinitive',
        'past_participle',
      ],
    },
  };


const MORPH_REGISTRY:
  CanonicalConstructionMorphRegistryEntryV1[] = [
    {
      pos:
        'verb',

      form_key:
        'present',

      form_scope:
        'token',

      canonical_features: {
        Tense:
          'Pres',

        VerbForm:
          'Fin',
      },
    },

    {
      pos:
        'verb',

      form_key:
        'past',

      form_scope:
        'token',

      canonical_features: {
        Tense:
          'Past',

        VerbForm:
          'Fin',
      },
    },

    {
      pos:
        'verb',

      form_key:
        'imperative',

      form_scope:
        'token',

      canonical_features: {
        Mood:
          'Imp',

        VerbForm:
          'Fin',
      },
    },

    {
      pos:
        'verb',

      form_key:
        'infinitive',

      form_scope:
        'token',

      canonical_features: {
        VerbForm:
          'Inf',
      },
    },

    {
      pos:
        'verb',

      form_key:
        'past_participle',

      form_scope:
        'token',

      canonical_features: {
        Tense:
          'Past',

        VerbForm:
          'Part',
      },
    },
  ];


const ROLE_ONTOLOGY_SNAPSHOT = {
  read_only:
    true,

  write_performed:
    false,

  frozen_grammar_immutable:
    true,

  reference_facts: [
    {
      candidate_code:
        'verb.auxiliary.grammatical_meaning',

      status:
        'source_verified',

      requires_human_verification:
        false,

      source_section:
        '7.2.1',

      extracted_payload: {
        verb_role:
          'auxiliary',

        meaning_type:
          'grammatical',
      },

      digital_model: {
        model: {
          type:
            'semantic_definition',
        },
      },

      execution_contract: {
        audit: {
          disposition:
            'KEEP_REFERENCE_ONLY',
        },

        execution: {
          role:
            'semantic_reference',
        },

        placement: {
          target_layers: [
            'grammar_reference',
          ],
        },
      },
    },

    {
      candidate_code:
        'verb.main_verb.lexical_meaning',

      status:
        'source_verified',

      requires_human_verification:
        false,

      source_section:
        '7.2.1',

      extracted_payload: {
        verb_role:
          'main_verb',

        meaning_type:
          'lexical',
      },

      digital_model: {
        model: {
          type:
            'semantic_definition',
        },
      },

      execution_contract: {
        audit: {
          disposition:
            'KEEP_REFERENCE_ONLY',
        },

        execution: {
          role:
            'semantic_reference',
        },

        placement: {
          target_layers: [
            'grammar_reference',
          ],
        },
      },
    },
  ],
} as const;


const SOURCE_ROLE_SNAPSHOT = {
  version:
    'canonical-construction-projection-snapshot-v1',

  plane:
    'build_control',

  read_only:
    true,

  write_performed:
    false,

  frozen_grammar_immutable:
    true,

  candidates: [{
    status:
      'source_verified',

    candidate_id:
      CONSTRUCTION_SOURCE
        .candidateId,

    candidate_code:
      CONSTRUCTION_SOURCE
        .candidateCode,

    source_section:
      CONSTRUCTION_SOURCE
        .sourceSection,

    requires_human_verification:
      false,

    extracted_payload:
      CONSTRUCTION_SOURCE
        .extractedPayload,

    digital_model:
      CONSTRUCTION_SOURCE
        .digitalModel,

    execution_contract:
      CONSTRUCTION_SOURCE
        .executionContract,
  }],
} as const;


// ====================================================================
// Canonical graph fixture
// ====================================================================

function tokenBySurface(
  graph:
    CanonicalLanguageGraphV1,

  surface:
    string,
): LanguageGraphNodeV1 {
  const token =
    graph.nodes.find(
      (node) =>
        node.type ===
          'token' &&
        node.features.surface ===
          surface,
    );

  if (!token) {
    throw new Error(
      `token missing: ${surface}`,
    );
  }

  return token;
}


function addMorphReadings(
  graph:
    CanonicalLanguageGraphV1,

  rows: Array<{
    surface: string;

    canonicalFeatures:
      Record<string, unknown>;
  }>,
): CanonicalLanguageGraphV1 {
  const nodes:
    LanguageGraphNodeV1[] = [];

  for (
    const [
      index,
      row,
    ] of rows.entries()
  ) {
    const token =
      tokenBySurface(
        graph,
        row.surface,
      );

    nodes.push({
      id:
        `morph:live-integration:${index}:${token.id}`,

      type:
        'morph_reading',

      subtype:
        'verb',

      status:
        'candidate',

      span:
        token.span
          ? { ...token.span }
          : undefined,

      features: {
        pos:
          'verb',

        canonicalFeatures:
          row.canonicalFeatures,
      },

      producer:
        'canonical_candidate_lattice_v1',

      evidenceIds: [
        `evidence:morph:live-integration:${index}:${token.id}`,
      ],

      provenanceIds: [
        'prov:live-integration:morph',
      ],
    });
  }

  const patch:
    GraphPatchV1 = {
    producer:
      'canonical_candidate_lattice_v1',

    producerVersion:
      '1',

    nodes,

    evidence:
      nodes.map(
        (node) => ({
          id:
            node.evidenceIds[0],

          kind:
            'morphological',

          status:
            'supports',

          targetIds: [
            node.id,
          ],

          payload: {
            exactLiveIntegration:
              true,
          },

          producer:
            'canonical_candidate_lattice_v1',

          provenanceIds: [
            'prov:live-integration:morph',
          ],
        }),
      ),

    provenance: [{
      id:
        'prov:live-integration:morph',

      sourceType:
        'system',

      sourceId:
        'live-integration-test',
    }],
  };

  return applyGraphPatchV1(
    graph,
    patch,
  );
}


function addStructuralPredicate(
  graph:
    CanonicalLanguageGraphV1,

  headSurface:
    string,
): CanonicalLanguageGraphV1 {
  const token =
    tokenBySurface(
      graph,
      headSurface,
    );

  const predicateId =
    `predicate:live-integration:${token.id}`;

  const evidenceId =
    `evidence:${predicateId}`;

  const patch:
    GraphPatchV1 = {
    producer:
      'canonical_predicate_candidate_lattice_v1',

    producerVersion:
      '1',

    nodes: [{
      id:
        predicateId,

      type:
        'predicate',

      subtype:
        'predicate',

      status:
        'candidate',

      span:
        token.span
          ? { ...token.span }
          : undefined,

      features: {
        role:
          'predicate',

        sentenceIndex:
          token.features
            .sentenceIndex,

        anchorHeadId:
          token.id,

        realizedByPhraseId:
          'phrase:live-integration:vp',

        candidateGeneration:
          'canonical_predicate_candidate_lattice_v1',
      },

      producer:
        'canonical_predicate_candidate_lattice_v1',

      evidenceIds: [
        evidenceId,
      ],

      provenanceIds: [
        'prov:live-integration:predicate',
      ],
    }],

    evidence: [{
      id:
        evidenceId,

      kind:
        'source_rule',

      status:
        'supports',

      targetIds: [
        predicateId,
      ],

      payload: {
        exactStructuralPredicateContract:
          true,
      },

      producer:
        'canonical_predicate_candidate_lattice_v1',

      provenanceIds: [
        'prov:live-integration:predicate',
      ],
    }],

    provenance: [{
      id:
        'prov:live-integration:predicate',

      sourceType:
        'system',

      sourceId:
        'live-integration-test',
    }],
  };

  return applyGraphPatchV1(
    graph,
    patch,
  );
}


function buildIntegratedGraph(
  text:
    string,

  finiteSurface:
    string,

  nonfiniteSurface:
    string,

  nonfiniteFeatures:
    Record<string, unknown>,
): {
  graph:
    CanonicalLanguageGraphV1;

  predicateId:
    string;

  finiteTokenId:
    string;

  nonfiniteTokenId:
    string;
} {
  let graph =
    createCanonicalLanguageGraphV1(
      buildCanonicalSurfaceDocumentV1(
        text,
      ),
    );

  graph =
    addMorphReadings(
      graph,
      [
        {
          surface:
            finiteSurface,

          canonicalFeatures: {
            Tense:
              'Pres',

            VerbForm:
              'Fin',
          },
        },

        {
          surface:
            nonfiniteSurface,

          canonicalFeatures:
            nonfiniteFeatures,
        },
      ],
    );

  const projectionResult =
    buildCanonicalConstructionProjectionsFromFrozenGrammarV1({
      constructionSource:
        CONSTRUCTION_SOURCE,

      finiteInventory:
        FINITE_INVENTORY,

      nonfiniteInventory:
        NONFINITE_INVENTORY,

      morphRegistry:
        MORPH_REGISTRY,
    });

  assert(
    projectionResult.status ===
      'ready',
    projectionResult
      .blockingReasons
      .join(', '),
  );

  const constructionPatch =
    buildCanonicalConstructionCandidateLatticePatchV1(
      graph,
      projectionResult
        .projections,
    );

  graph =
    applyGraphPatchV1(
      graph,
      constructionPatch,
    );

  graph =
    addStructuralPredicate(
      graph,
      finiteSurface,
    );

  const predicate =
    graph.nodes.find(
      (node) =>
        node.type ===
          'predicate',
    );

  assert(
    predicate,
    'predicate missing',
  );

  const finite =
    tokenBySurface(
      graph,
      finiteSurface,
    );

  const nonfinite =
    tokenBySurface(
      graph,
      nonfiniteSurface,
    );

  return {
    graph,

    predicateId:
      predicate.id,

    finiteTokenId:
      finite.id,

    nonfiniteTokenId:
      nonfinite.id,
  };
}


function roleProjections() {
  const result =
    deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
      SOURCE_ROLE_SNAPSHOT,
    );

  assert(
    result.status ===
      'ready',
    JSON.stringify(
      result.diagnostics,
    ),
  );

  assert(
    result.projections.length ===
      2,
    `role projections=${result.projections.length}`,
  );

  const ontology =
    deriveCanonicalPredicateSenseRoleOntologyV1(
      ROLE_ONTOLOGY_SNAPSHOT,
    );

  assert(
    ontology.status ===
      'ready',
    JSON.stringify(
      ontology.diagnostics,
    ),
  );

  const filtered =
    filterCanonicalPredicateSenseSourceRolesByOntologyV1(
      result.projections,
      ontology.roles,
    );

  assert(
    filtered.rejected.length ===
      0,
    `unexpected rejected source roles=${
      JSON.stringify(
        filtered.rejected,
      )
    }`,
  );

  return filtered.accepted;
}


function sensePatchFor(
  graph:
    CanonicalLanguageGraphV1,
) {
  const binding =
    bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
      graph,
      roleProjections(),
    );

  const sensePatch =
    buildCanonicalPredicateSenseCandidateLatticePatchV1(
      graph,
      binding.evidenceFacts,
    );

  return {
    binding,
    sensePatch,
  };
}


// ====================================================================
// Goldens
// ====================================================================

Deno.test(
  'v1.44 predicate sense A2.3: exact live Fin+Inf source reaches auxiliary sense candidate',
  () => {
    const fixture =
      buildIntegratedGraph(
        'har skrive',
        'har',
        'skrive',
        {
          VerbForm:
            'Inf',
        },
      );

    const {
      binding,
      sensePatch,
    } =
      sensePatchFor(
        fixture.graph,
      );

    assert(
      binding.evidenceFacts.length ===
        1,
      `bound evidence=${binding.evidenceFacts.length}`,
    );

    assert(
      binding.evidenceFacts[0]
        .sense ===
        'auxiliary',
      `sense=${binding.evidenceFacts[0].sense}`,
    );

    assert(
      binding.evidenceFacts[0]
        .predicateId ===
        fixture.predicateId,
      'evidence bound to wrong predicate',
    );

    assert(
      binding.evidenceFacts[0]
        .headTokenId ===
        fixture.finiteTokenId,
      'evidence bound to wrong occurrence',
    );

    const senses =
      (sensePatch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'semantic_unit' &&
            node.subtype ===
              'predicate_sense',
        );

    assert(
      senses.length ===
        1,
      `sense candidates=${senses.length}`,
    );

    assert(
      senses[0].features.sense ===
        'auxiliary',
      `sense=${senses[0].features.sense}`,
    );

    assert(
      senses[0].status ===
        'candidate',
      'auxiliary sense auto-resolved',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.3: exact live Fin+PastPart source reaches same auxiliary occurrence evidence',
  () => {
    const fixture =
      buildIntegratedGraph(
        'har skrevet',
        'har',
        'skrevet',
        {
          Tense:
            'Past',

          VerbForm:
            'Part',
        },
      );

    const {
      binding,
      sensePatch,
    } =
      sensePatchFor(
        fixture.graph,
      );

    assert(
      binding.evidenceFacts.length ===
        1,
      `bound evidence=${binding.evidenceFacts.length}`,
    );

    assert(
      binding.evidenceFacts[0]
        .sense ===
        'auxiliary',
      `sense=${binding.evidenceFacts[0].sense}`,
    );

    assert(
      (sensePatch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'semantic_unit' &&
            node.features.sense ===
              'auxiliary',
        )
        .length === 1,
      'past-participle branch did not reach auxiliary sense candidate',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.3: source nonfinite main_verb role does not migrate onto finite predicate',
  () => {
    const fixture =
      buildIntegratedGraph(
        'har skrive',
        'har',
        'skrive',
        {
          VerbForm:
            'Inf',
        },
      );

    const roles =
      roleProjections();

    assert(
      roles.some(
        (projection) =>
          projection.memberRef ===
            'nonfinite' &&
          projection.sense ===
            'main_verb',
      ),
      'source main_verb projection missing',
    );

    const binding =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        roles,
      );

    assert(
      !binding.evidenceFacts.some(
        (fact) =>
          fact.sense ===
            'main_verb',
      ),
      'nonfinite role leaked onto finite structural predicate',
    );

    assert(
      binding.evidenceFacts.every(
        (fact) =>
          fact.headTokenId ===
            fixture.finiteTokenId,
      ),
      'predicate sense evidence escaped exact finite occurrence',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.3: composition preserves no-hidden-word-order property',
  () => {
    const fixture =
      buildIntegratedGraph(
        'skrive har',
        'har',
        'skrive',
        {
          VerbForm:
            'Inf',
        },
      );

    const {
      binding,
      sensePatch,
    } =
      sensePatchFor(
        fixture.graph,
      );

    assert(
      binding.evidenceFacts.length ===
        1,
      `reverse-order evidence=${binding.evidenceFacts.length}`,
    );

    assert(
      binding.evidenceFacts[0]
        .sense ===
        'auxiliary',
      'occurrence binder introduced a hidden word-order rule',
    );

    assert(
      (sensePatch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'semantic_unit',
        )
        .length === 1,
      'reverse-order structural candidate failed at semantic composition',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.3: exact live composition remains candidate-only and graph-invariant safe',
  () => {
    const fixture =
      buildIntegratedGraph(
        'har skrive',
        'har',
        'skrive',
        {
          VerbForm:
            'Inf',
        },
      );

    const {
      binding,
      sensePatch,
    } =
      sensePatchFor(
        fixture.graph,
      );

    assert(
      binding.evidenceFacts.every(
        (fact) =>
          fact.status ===
            'candidate',
      ),
      'structural source resolved semantic evidence',
    );

    assert(
      (sensePatch.nodes ?? [])
        .every(
          (node) =>
            node.status ===
              'candidate',
        ),
      'sense node auto-resolved',
    );

    assert(
      (sensePatch.alternativeSets ?? [])
        .every(
          (set) =>
            set.status ===
              'open' &&
            set.resolvedMemberIds
              .length === 0,
        ),
      'sense alternative set auto-resolved',
    );

    const finalGraph =
      applyGraphPatchV1(
        fixture.graph,
        sensePatch,
      );

    const errors =
      assertCanonicalLanguageGraphV1(
        finalGraph,
      );

    assert(
      errors.length ===
        0,
      `graph invariant errors: ${errors.join(', ')}`,
    );

    const serialized =
      JSON.stringify({
        binding,
        sensePatch,
      });

    assert(
      !serialized.includes(
        'lexical_class',
      ),
      'lexical-class evidence leaked into structural-only integration',
    );
  },
);