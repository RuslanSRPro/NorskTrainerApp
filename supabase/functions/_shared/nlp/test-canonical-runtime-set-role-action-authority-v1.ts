import {
  deriveCanonicalRuntimeSetRoleActionAuthoritiesV1,
} from "./canonical-runtime-set-role-action-authority-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function defaultActions(): unknown[] {
  return [{
    action: "set_role",
    target: "subject",
    role: "subject",
    reason: "nrg_subject_definition",
  }];
}

function row(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const actions = Array.isArray(overrides.actions)
    ? overrides.actions
    : defaultActions();

  const defaultIrSpec = {
    source: {
      primary_candidate_code:
        "grammar.foundations.sentence.subject_predicate_core",

      supporting_candidate_codes: [
        "grammar.foundations.subject",
      ],
    },

    actions,
  };

  return {
    id: "manifest-subject-finite",

    code: "ir.structural.clause.subject_finite_predicate",

    authoring_status: "validated",

    actions,

    ir_spec: defaultIrSpec,

    ...overrides,
  };
}

Deno.test(
  "A4.1.1 validated top-level set_role shape is preserved opaque",
  () => {
    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row(),
    ]);

    assert(
      result.status === "ready",
      `status=${result.status} reasons=${result.blockingReasons.join(",")}`,
    );

    assert(
      result.authorities.length === 1,
      `authorities=${result.authorities.length}`,
    );

    const authority = result.authorities[0];

    assert(
      authority.actionName === "set_role",
      "action name changed",
    );

    assert(
      authority.actionTargetLabel === "subject",
      "target label changed",
    );

    assert(
      authority.topLevelRoleLabel === "subject",
      "top-level role changed",
    );

    assert(
      authority.nestedValueRoleLabel === null,
      "nested role invented",
    );

    assert(
      authority.roleShape === "top_level_role",
      `shape=${authority.roleShape}`,
    );

    assert(
      authority.reasonLabel === "nrg_subject_definition",
      "reason label changed",
    );
  },
);

Deno.test(
  "A4.1.2 nested value.role is preserved as a distinct structural site",
  () => {
    const actions = [{
      action: "set_role",
      target: "predicate_phrase",
      value: {
        role: "predicate",
      },
      reason_code: "predicate_projection",
    }];

    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        actions,
        ir_spec: {
          source: {
            primary_candidate_code: "predicate.source",
          },
          actions,
        },
      }),
    ]);

    assert(
      result.status === "ready",
      result.blockingReasons.join(","),
    );

    const authority = result.authorities[0];

    assert(
      authority.topLevelRoleLabel === null,
      "top-level role invented",
    );

    assert(
      authority.nestedValueRoleLabel === "predicate",
      "nested role not preserved",
    );

    assert(
      authority.roleShape === "nested_value_role",
      `shape=${authority.roleShape}`,
    );

    assert(
      authority.reasonCodeLabel === "predicate_projection",
      "reason_code changed",
    );
  },
);

Deno.test(
  "A4.1.3 equal role labels at both structural sites remain shape evidence only",
  () => {
    const actions = [{
      action: "set_role",
      target: "x",
      role: "subject",
      value: {
        role: "subject",
      },
    }];

    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        actions,
        ir_spec: {
          source: {},
          actions,
        },
      }),
    ]);

    assert(
      result.status === "ready",
      result.blockingReasons.join(","),
    );

    assert(
      result.authorities[0]
        .roleShape ===
        "top_level_and_nested_equal",
      "dual role shape not preserved",
    );

    assert(
      result.governance
        .roleSemanticsResolved === false,
      "equal labels became semantic truth",
    );
  },
);

Deno.test(
  "A4.1.4 conflicting top-level and nested role labels fail closed",
  () => {
    const actions = [{
      action: "set_role",
      target: "x",
      role: "subject",
      value: {
        role: "predicate",
      },
    }];

    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        actions,
        ir_spec: {
          source: {},
          actions,
        },
      }),
    ]);

    assert(
      result.status === "blocked",
      "conflicting role sites were accepted",
    );

    assert(
      result.authorities.length === 0,
      "authority survived conflicting role sites",
    );
  },
);

Deno.test(
  "A4.1.5 missing target fails closed",
  () => {
    const actions = [{
      action: "set_role",
      role: "subject",
    }];

    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        actions,
        ir_spec: {
          source: {},
          actions,
        },
      }),
    ]);

    assert(
      result.status === "blocked",
      "missing target was accepted",
    );
  },
);

Deno.test(
  "A4.1.6 missing role fails closed",
  () => {
    const actions = [{
      action: "set_role",
      target: "subject",
    }];

    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        actions,
        ir_spec: {
          source: {},
          actions,
        },
      }),
    ]);

    assert(
      result.status === "blocked",
      "missing role was accepted",
    );
  },
);

Deno.test(
  "A4.1.7 unvalidated manifest cannot produce authority",
  () => {
    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        authoring_status: "draft",
      }),
    ]);

    assert(
      result.status === "blocked",
      "draft manifest was accepted",
    );

    assert(
      result.authorities.length === 0,
      "draft manifest produced authority",
    );
  },
);

Deno.test(
  "A4.1.8 conflicting manifest action snapshots fail closed",
  () => {
    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        actions: [{
          action: "set_role",
          target: "subject",
          role: "subject",
        }],

        ir_spec: {
          source: {},
          actions: [{
            action: "create_clause",
            target: "predicate",
          }],
        },
      }),
    ]);

    assert(
      result.status === "blocked",
      "conflicting action snapshots were accepted",
    );

    assert(
      result.authorities.length === 0,
      "conflicting snapshots produced authority",
    );
  },
);

Deno.test(
  "A4.1.9 duplicate manifest identity fails closed",
  () => {
    const first = row();

    const second = row();

    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      first,
      second,
    ]);

    assert(
      result.status === "blocked",
      "duplicate manifest identity was accepted",
    );

    assert(
      result.authorities.length === 0,
      "duplicate identity produced authority",
    );
  },
);

Deno.test(
  "A4.1.10 multiple set_role actions remain separate candidates without execution",
  () => {
    const actions = [
      {
        action: "set_role",
        target: "subject",
        role: "subject",
        reason: "reason_a",
      },
      {
        action: "set_role",
        target: "predicate",
        role: "predicate",
        reason: "reason_b",
      },
    ];

    const result = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1([
      row({
        actions,
        ir_spec: {
          source: {
            primary_candidate_code: "source.primary",

            supporting_candidate_codes: [
              "source.support",
              "source.primary",
            ],
          },
          actions,
        },
      }),
    ]);

    assert(
      result.status === "ready",
      result.blockingReasons.join(","),
    );

    assert(
      result.authorities.length === 2,
      `authorities=${result.authorities.length}`,
    );

    assert(
      result.authorities[0].actionIndex === 0 &&
        result.authorities[1].actionIndex === 1,
      "action occurrence identity collapsed",
    );

    assert(
      JSON.stringify(
        result.authorities[0]
          .sourceCandidateCodes,
      ) ===
        JSON.stringify([
          "source.primary",
          "source.support",
        ]),
      "source provenance changed",
    );

    const g = result.governance;

    assert(
      g.actionShapeAuthorityResolved === true &&
        g.actionTargetPreservedOpaque === true &&
        g.roleLabelsPreservedOpaque === true &&
        g.targetBindingSemanticsResolved === false &&
        g.roleSemanticsResolved === false &&
        g.subjectRoleSemanticsResolved === false &&
        g.subjectOfRelationInferred === false &&
        g.graphOperationResolved === false &&
        g.nodeRoleFeatureMutationResolved === false &&
        g.runtimeConditionExecuted === false &&
        g.runtimeScopeExecutionPerformed === false &&
        g.cardinalityEnforcementPerformed === false &&
        g.occurrenceBindingPerformed === false &&
        g.winnerSelected === false &&
        g.graphMutationPerformed === false &&
        g.manifestMutationPerformed === false &&
        g.frozenGrammarMutationPerformed === false &&
        g.learnerErrorClassified === false &&
        g.candidateOnly === true &&
        g.frozenGrammarReadOnly === true,
      "A4.1 crossed opaque action-authority boundary",
    );
  },
);
