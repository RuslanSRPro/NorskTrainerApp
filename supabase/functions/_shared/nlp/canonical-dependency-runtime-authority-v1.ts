// Norsk Trainer — Canonical Dependency Runtime Authority V1
//
// v1.46 A0
//
// Generic read-only projection:
//
//   validated Runtime IR manifest
//        +
//   create_dependency action
//        ->
//   opaque dependency action authority
//
// This layer intentionally DOES NOT interpret dependency semantics.
//
// It does NOT:
// - know any dependency relation names;
// - infer subject/object/complement/argument semantics;
// - decide dependency direction;
// - bind source/target graph nodes;
// - create canonical graph edges;
// - create alternative sets;
// - resolve candidates;
// - assume validated means activated;
// - mutate frozen grammar.
//
// Action target, relation, execution phase, runtime family and action value
// are preserved as runtime authority.
//
// Endpoint interpretation belongs to a later governed adapter.

export const CANONICAL_DEPENDENCY_RUNTIME_AUTHORITY_V1 =
  'canonical_dependency_runtime_authority_v1';


export type CanonicalDependencyRuntimeManifestAuthorityRowV1 = {
  id?:
    unknown;

  code?:
    unknown;

  authoring_status?:
    unknown;

  runtime_family?:
    unknown;

  execution_phase?:
    unknown;

  constraint_strength?:
    unknown;

  actions?:
    unknown;

  ir_spec?:
    unknown;
};


export type CanonicalDependencyRuntimeActionAuthorityV1 = {
  id:
    string;

  status:
    'candidate';

  manifestId:
    string;

  manifestCode:
    string;

  runtimeFamily:
    string;

  executionPhase:
    string;

  constraintStrength:
    string | null;

  actionIndex:
    number;

  relation:
    string;

  actionTarget:
    string;

  actionValue:
    Record<string, unknown> | null;

  reasonCode:
    string | null;

  sourceCandidateCodes:
    string[];

  governance: {
    validatedManifestRequired:
      true;

    createDependencyActionRequired:
      true;

    relationPreservedOpaque:
      true;

    actionTargetPreservedOpaque:
      true;

    actionValuePreservedOpaque:
      true;

    executionPhasePreservedOpaque:
      true;

    runtimeFamilyPreservedOpaque:
      true;

    endpointDirectionResolved:
      false;

    endpointBindingPerformed:
      false;

    dependencySemanticsResolved:
      false;

    canonicalEdgeGenerated:
      false;

    alternativeSetGenerated:
      false;

    productionActivationAssumed:
      false;

    manifestMutationPerformed:
      false;

    candidateOnly:
      true;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalDependencyRuntimeAuthorityResultV1 = {
  producer:
    typeof CANONICAL_DEPENDENCY_RUNTIME_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalDependencyRuntimeActionAuthorityV1[];

  blockingReasons:
    string[];
};


function stringValue(
  value:
    unknown,
): string | undefined {
  if (
    typeof value !==
      'string'
  ) {
    return undefined;
  }

  const trimmed =
    value.trim();

  return (
    trimmed ||
    undefined
  );
}


function objectValue(
  value:
    unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return {
    ...(value as
      Record<string, unknown>),
  };
}


function unique(
  values:
    readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}


function idPart(
  value:
    string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    '%',
    '_',
  );
}


function sourceCandidateCodes(
  irSpec:
    unknown,
): string[] {
  const ir =
    objectValue(
      irSpec,
    );

  if (!ir) {
    return [];
  }


  const source =
    objectValue(
      ir.source,
    );

  if (!source) {
    return [];
  }


  const codes:
    string[] = [];


  const primary =
    stringValue(
      source.primary_candidate_code,
    );

  if (primary) {
    codes.push(
      primary,
    );
  }


  if (
    Array.isArray(
      source.supporting_candidate_codes,
    )
  ) {
    for (
      const value of
        source.supporting_candidate_codes
    ) {
      const code =
        stringValue(
          value,
        );

      if (code) {
        codes.push(
          code,
        );
      }
    }
  }


  return unique(
    codes,
  );
}


export function deriveCanonicalDependencyRuntimeAuthoritiesV1(
  rows:
    readonly CanonicalDependencyRuntimeManifestAuthorityRowV1[],
): CanonicalDependencyRuntimeAuthorityResultV1 {
  const blockingReasons:
    string[] = [];

  const authorities:
    CanonicalDependencyRuntimeActionAuthorityV1[] = [];

  const seenManifestIds =
    new Set<
      string
    >();

  const seenManifestCodes =
    new Set<
      string
    >();


  for (
    const row of
      rows
  ) {
    if (
      stringValue(
        row.authoring_status,
      ) !==
        'validated'
    ) {
      continue;
    }


    const manifestId =
      stringValue(
        row.id,
      );

    const manifestCode =
      stringValue(
        row.code,
      );

    const runtimeFamily =
      stringValue(
        row.runtime_family,
      );

    const executionPhase =
      stringValue(
        row.execution_phase,
      );


    if (
      !manifestId ||
      !manifestCode ||
      !runtimeFamily ||
      !executionPhase
    ) {
      blockingReasons.push(
        `validated_manifest:${manifestCode ?? manifestId ?? 'unknown'}:identity_or_runtime_contract_missing`,
      );

      continue;
    }


    if (
      seenManifestIds.has(
        manifestId,
      )
    ) {
      blockingReasons.push(
        `manifest:${manifestId}:duplicate_id`,
      );
    }

    seenManifestIds.add(
      manifestId,
    );


    if (
      seenManifestCodes.has(
        manifestCode,
      )
    ) {
      blockingReasons.push(
        `manifest:${manifestCode}:duplicate_code`,
      );
    }

    seenManifestCodes.add(
      manifestCode,
    );


    if (
      !Array.isArray(
        row.actions,
      )
    ) {
      continue;
    }


    const provenance =
      sourceCandidateCodes(
        row.ir_spec,
      );


    row.actions.forEach(
      (
        rawAction,
        actionIndex,
      ) => {
        const action =
          objectValue(
            rawAction,
          );


        if (
          !action ||
          stringValue(
            action.action,
          ) !==
            'create_dependency'
        ) {
          return;
        }


        const relation =
          stringValue(
            action.relation,
          );

        const actionTarget =
          stringValue(
            action.target,
          );


        if (
          !relation ||
          !actionTarget
        ) {
          blockingReasons.push(
            `manifest:${manifestCode}:action:${actionIndex}:dependency_contract_missing`,
          );

          return;
        }


        const value =
          objectValue(
            action.value,
          );


        authorities.push({
          id: [
            'dependency-runtime-authority-v1',
            idPart(
              manifestCode,
            ),
            String(
              actionIndex,
            ),
          ].join(':'),

          status:
            'candidate',

          manifestId,

          manifestCode,

          runtimeFamily,

          executionPhase,

          constraintStrength:
            stringValue(
              row.constraint_strength,
            ) ??
            null,

          actionIndex,

          relation,

          actionTarget,

          actionValue:
            value,

          reasonCode:
            stringValue(
              action.reason_code,
            ) ??
            null,

          sourceCandidateCodes:
            provenance,

          governance: {
            validatedManifestRequired:
              true,

            createDependencyActionRequired:
              true,

            relationPreservedOpaque:
              true,

            actionTargetPreservedOpaque:
              true,

            actionValuePreservedOpaque:
              true,

            executionPhasePreservedOpaque:
              true,

            runtimeFamilyPreservedOpaque:
              true,

            endpointDirectionResolved:
              false,

            endpointBindingPerformed:
              false,

            dependencySemanticsResolved:
              false,

            canonicalEdgeGenerated:
              false,

            alternativeSetGenerated:
              false,

            productionActivationAssumed:
              false,

            manifestMutationPerformed:
              false,

            candidateOnly:
              true,

            frozenGrammarReadOnly:
              true,
          },
        });
      },
    );
  }


  const uniqueReasons =
    unique(
      blockingReasons,
    );


  if (
    uniqueReasons.length >
      0
  ) {
    return {
      producer:
        CANONICAL_DEPENDENCY_RUNTIME_AUTHORITY_V1,

      producerVersion:
        '1',

      status:
        'blocked',

      authorities:
        [],

      blockingReasons:
        uniqueReasons,
    };
  }


  return {
    producer:
      CANONICAL_DEPENDENCY_RUNTIME_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities:
      authorities.sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      ),

    blockingReasons:
      [],
  };
}