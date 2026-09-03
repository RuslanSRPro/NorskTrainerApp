import {
  deriveCanonicalPredicateSenseRoleOntologyV1,
  filterCanonicalPredicateSenseSourceRolesByOntologyV1,
  type CanonicalPredicateSenseRoleOntologySnapshotV1,
} from './canonical-predicate-sense-role-ontology-v1.ts';

import type {
  CanonicalPredicateSenseSourceRoleProjectionV1,
} from './canonical-predicate-sense-source-role-adapter-v1.ts';


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


// Exact frozen semantic-definition facts verified live.
//
// These are reference ontology only.
// They DO NOT become runtime evidence themselves.
const LIVE_ROLE_ONTOLOGY_SNAPSHOT:
  CanonicalPredicateSenseRoleOntologySnapshotV1 = {
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
          language:
            'no',

          verb_role:
            'auxiliary',

          meaning_type:
            'grammatical',

          candidate_code:
            'verb.auxiliary.grammatical_meaning',

          source_section:
            '7.2.1',
        },

        digital_model: {
          model: {
            type:
              'semantic_definition',

            subtype:
              'auxiliary_grammatical_role',

            learning: {
              source_strict_runtime:
                false,
            },
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

            consumed_by:
              [],
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
          language:
            'no',

          verb_role:
            'main_verb',

          meaning_type:
            'lexical',

          candidate_code:
            'verb.main_verb.lexical_meaning',

          source_section:
            '7.2.1',
        },

        digital_model: {
          model: {
            type:
              'semantic_definition',

            subtype:
              'main_verb_lexical_role',

            learning: {
              source_strict_runtime:
                false,
            },
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

            consumed_by:
              [],
          },

          placement: {
            target_layers: [
              'grammar_reference',
            ],
          },
        },
      },
    ],
  };


function projection(
  sense: string,
): CanonicalPredicateSenseSourceRoleProjectionV1 {
  return {
    projectionId:
      `projection:test:${sense}`,

    sourceCandidateCode:
      'test.runtime.construction',

    sourceSection:
      '7.test',

    modelType:
      'construction_compatibility',

    executionRole:
      'construction',

    roleField:
      'head_role',

    memberRef:
      'head',

    sense,

    sourceCandidateCodes: [
      'test.runtime.construction',
    ],

    sourceSections: [
      '7.test',
    ],

    evidenceKind:
      'source_rule',

    projectionPolicy:
      'source_role_candidate_support_only',

    frozenGrammarReadOnly:
      true,
  };
}


Deno.test(
  'v1.44 predicate sense A2.4: exact frozen semantic definitions create auxiliary and main_verb ontology',
  () => {
    const result =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        LIVE_ROLE_ONTOLOGY_SNAPSHOT,
      );

    assert(
      result.status ===
        'ready',
      `status=${result.status}`,
    );

    const roles =
      result.roles
        .map(
          (definition) =>
            definition.role,
        )
        .sort();

    assert(
      JSON.stringify(
        roles,
      ) ===
        JSON.stringify([
          'auxiliary',
          'main_verb',
        ]),
      `roles=${JSON.stringify(roles)}`,
    );

    assert(
      result.roles.every(
        (definition) =>
          definition.runtimeExecutable ===
            false &&
          definition.ontologyOnly ===
            true,
      ),
      'reference ontology was promoted to executable evidence',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: structural finite_verb role is rejected by semantic ontology',
  () => {
    const ontology =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        LIVE_ROLE_ONTOLOGY_SNAPSHOT,
      );

    assert(
      ontology.status ===
        'ready',
      'ontology blocked',
    );

    const filtered =
      filterCanonicalPredicateSenseSourceRolesByOntologyV1(
        [
          projection(
            'finite_verb',
          ),
        ],
        ontology.roles,
      );

    assert(
      filtered.accepted.length ===
        0,
      'finite_verb became predicate sense',
    );

    assert(
      filtered.rejected.length ===
        1,
      `rejected=${filtered.rejected.length}`,
    );

    assert(
      filtered.rejected[0]
        .reason ===
        'role_not_in_frozen_semantic_ontology',
      'wrong rejection reason',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: source-defined semantic roles pass without renaming',
  () => {
    const ontology =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        LIVE_ROLE_ONTOLOGY_SNAPSHOT,
      );

    const filtered =
      filterCanonicalPredicateSenseSourceRolesByOntologyV1(
        [
          projection(
            'auxiliary',
          ),

          projection(
            'main_verb',
          ),
        ],
        ontology.roles,
      );

    assert(
      filtered.accepted.length ===
        2,
      `accepted=${filtered.accepted.length}`,
    );

    const senses =
      filtered.accepted
        .map(
          (item) =>
            item.sense,
        )
        .sort();

    assert(
      JSON.stringify(senses) ===
        JSON.stringify([
          'auxiliary',
          'main_verb',
        ]),
      `source labels changed: ${JSON.stringify(senses)}`,
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: unknown role is blocked rather than normalized heuristically',
  () => {
    const ontology =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        LIVE_ROLE_ONTOLOGY_SNAPSHOT,
      );

    const filtered =
      filterCanonicalPredicateSenseSourceRolesByOntologyV1(
        [
          projection(
            'some_future_role',
          ),
        ],
        ontology.roles,
      );

    assert(
      filtered.accepted.length ===
        0,
      'unknown role was accepted',
    );

    assert(
      filtered.rejected.length ===
        1,
      'unknown role missing rejection',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: unverified semantic definition does not enter ontology',
  () => {
    const snapshot = {
      ...LIVE_ROLE_ONTOLOGY_SNAPSHOT,

      reference_facts: [
        {
          ...LIVE_ROLE_ONTOLOGY_SNAPSHOT
            .reference_facts![0],

          status:
            'draft',
        },
      ],
    };

    const result =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        snapshot,
      );

    assert(
      result.roles.length ===
        0,
      'unverified semantic definition entered ontology',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: runtime semantic definition is not accepted as ontology reference',
  () => {
    const source =
      LIVE_ROLE_ONTOLOGY_SNAPSHOT
        .reference_facts![0];

    const snapshot = {
      ...LIVE_ROLE_ONTOLOGY_SNAPSHOT,

      reference_facts: [{
        ...source,

        execution_contract: {
          audit: {
            disposition:
              'KEEP_GRAMMAR_RUNTIME',
          },

          execution: {
            role:
              'semantic_reference',
          },

          placement: {
            target_layers: [
              'runtime',
            ],
          },
        },
      }],
    };

    const result =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        snapshot,
      );

    assert(
      result.roles.length ===
        0,
      'runtime fact was misused as reference ontology definition',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: non-semantic-definition model cannot define sense vocabulary',
  () => {
    const source =
      LIVE_ROLE_ONTOLOGY_SNAPSHOT
        .reference_facts![0];

    const snapshot = {
      ...LIVE_ROLE_ONTOLOGY_SNAPSHOT,

      reference_facts: [{
        ...source,

        digital_model: {
          model: {
            type:
              'construction_compatibility',
          },
        },
      }],
    };

    const result =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        snapshot,
      );

    assert(
      result.roles.length ===
        0,
      'construction metadata defined semantic ontology',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: unsafe snapshot blocks ontology completely',
  () => {
    const snapshot = {
      ...LIVE_ROLE_ONTOLOGY_SNAPSHOT,

      read_only:
        false,
    };

    const result =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        snapshot,
      );

    assert(
      result.status ===
        'blocked',
      `status=${result.status}`,
    );

    assert(
      result.roles.length ===
        0,
      'unsafe snapshot produced ontology',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.4: ontology derivation and filtering are deterministic',
  () => {
    const a =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        LIVE_ROLE_ONTOLOGY_SNAPSHOT,
      );

    const b =
      deriveCanonicalPredicateSenseRoleOntologyV1(
        LIVE_ROLE_ONTOLOGY_SNAPSHOT,
      );

    assert(
      JSON.stringify(a) ===
        JSON.stringify(b),
      'ontology derivation is not deterministic',
    );

    const fa =
      filterCanonicalPredicateSenseSourceRolesByOntologyV1(
        [
          projection(
            'finite_verb',
          ),

          projection(
            'auxiliary',
          ),
        ],
        a.roles,
      );

    const fb =
      filterCanonicalPredicateSenseSourceRolesByOntologyV1(
        [
          projection(
            'finite_verb',
          ),

          projection(
            'auxiliary',
          ),
        ],
        b.roles,
      );

    assert(
      JSON.stringify(fa) ===
        JSON.stringify(fb),
      'ontology filter is not deterministic',
    );
  },
);