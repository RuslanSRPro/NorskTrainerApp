// Norsk Trainer — Runtime Binding Definition Authority V1
//
// v1.46 A3.0
//
// Purpose:
//
//   validated dependency Runtime IR manifest
//       +
//   exact A0 create_dependency authority
//       ->
//   opaque binding-definition authority
//
// This layer preserves the Runtime IR binding contract.
//
// It DOES NOT execute:
// - entity;
// - scope;
// - cardinality;
// - where;
// - where operators;
// - reference expressions.
//
// It does not enumerate graph occurrences.
// It does not map runtime entity labels to Canonical Graph node types.
// It does not resolve dotted refs.
// It does not create dependency edges.
//
// All runtime labels remain opaque.
//
// Candidate != resolved.
// Validated != activated.
// Frozen grammar is read-only.

import type {
  CanonicalDependencyRuntimeActionAuthorityV1,
  CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from './canonical-dependency-runtime-authority-v1.ts';


export const CANONICAL_RUNTIME_BINDING_DEFINITION_AUTHORITY_V1 =
  'canonical_runtime_binding_definition_authority_v1';


export type CanonicalRuntimeBindingDefinitionAuthorityV1 = {
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

  bindingName:
    string;

  bindingDefinition:
    Record<string, unknown>;

  entityLabel:
    string | null;

  scopeLabel:
    string | null;

  cardinalityLabel:
    string | null;

  whereClause:
    Record<string, unknown> | null;

  topLevelWhereOperator:
    string | null;

  supportingDependencyAuthorityIds:
    string[];

  governance: {
    exactValidatedManifestRequired:
      true;

    exactA0DependencyAuthorityRequired:
      true;

    bindingNamePreservedOpaque:
      true;

    bindingDefinitionPreservedOpaque:
      true;

    entityLabelPreservedOpaque:
      true;

    scopeLabelPreservedOpaque:
      true;

    cardinalityLabelPreservedOpaque:
      true;

    whereClausePreservedOpaque:
      true;

    whereOperatorPreservedOpaque:
      true;

    entitySemanticsResolved:
      false;

    scopeSemanticsResolved:
      false;

    cardinalitySemanticsResolved:
      false;

    whereSemanticsResolved:
      false;

    referenceSemanticsResolved:
      false;

    occurrenceEnumerationPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    endpointRoleResolved:
      false;

    dependencyDirectionResolved:
      false;

    dependencySemanticsResolved:
      false;

    canonicalEdgeGenerated:
      false;

    grammaticalFunctionResolved:
      false;

    complementArgumentAttachmentResolved:
      false;

    realizesSlotGenerated:
      false;

    productionActivationAssumed:
      false;

    candidateOnly:
      true;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalRuntimeBindingDefinitionAuthorityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_BINDING_DEFINITION_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalRuntimeBindingDefinitionAuthorityV1[];

  manifestsWithoutBindings:
    string[];

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


  return value as
    Record<string, unknown>;
}


function canonicalize(
  value:
    unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      canonicalize,
    );
  }


  const object =
    objectValue(
      value,
    );


  if (!object) {
    return value;
  }


  const result:
    Record<string, unknown> = {};


  for (
    const key of
      Object.keys(
        object,
      ).sort()
  ) {
    result[key] =
      canonicalize(
        object[key],
      );
  }


  return result;
}


function canonicalObject(
  value:
    unknown,
): Record<string, unknown> | null {
  const object =
    objectValue(
      value,
    );


  if (!object) {
    return null;
  }


  return canonicalize(
    object,
  ) as Record<string, unknown>;
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


function safeA0Authority(
  authority:
    CanonicalDependencyRuntimeActionAuthorityV1,
): boolean {
  const g =
    authority.governance;


  return (
    authority.status ===
      'candidate' &&

    Boolean(
      stringValue(
        authority.id,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.manifestId,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.manifestCode,
      ),
    ) &&

    g.validatedManifestRequired ===
      true &&

    g.createDependencyActionRequired ===
      true &&

    g.relationPreservedOpaque ===
      true &&

    g.actionTargetPreservedOpaque ===
      true &&

    g.actionValuePreservedOpaque ===
      true &&

    g.endpointDirectionResolved ===
      false &&

    g.endpointBindingPerformed ===
      false &&

    g.dependencySemanticsResolved ===
      false &&

    g.canonicalEdgeGenerated ===
      false &&

    g.productionActivationAssumed ===
      false &&

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function exactManifestRow(
  rows:
    readonly CanonicalDependencyRuntimeManifestAuthorityRowV1[],

  manifestId:
    string,

  manifestCode:
    string,
): CanonicalDependencyRuntimeManifestAuthorityRowV1 | undefined {
  const matches =
    rows.filter(
      (row) =>
        stringValue(
          row.id,
        ) ===
          manifestId &&
        stringValue(
          row.code,
        ) ===
          manifestCode,
    );


  return (
    matches.length ===
      1
  )
    ? matches[0]
    : undefined;
}


function manifestBindings(
  row:
    CanonicalDependencyRuntimeManifestAuthorityRowV1,
): Record<string, unknown> | null {
  const irSpec =
    objectValue(
      row.ir_spec,
    );


  if (!irSpec) {
    return null;
  }


  return canonicalObject(
    irSpec.bindings,
  );
}


export function deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
  dependencyAuthorities:
    readonly CanonicalDependencyRuntimeActionAuthorityV1[],

  rows:
    readonly CanonicalDependencyRuntimeManifestAuthorityRowV1[],
): CanonicalRuntimeBindingDefinitionAuthorityResultV1 {
  const blockingReasons:
    string[] = [];

  const authorities:
    CanonicalRuntimeBindingDefinitionAuthorityV1[] = [];

  const manifestsWithoutBindings:
    string[] = [];


  const authorityIds =
    new Set<
      string
    >();


  for (
    const authority of
      dependencyAuthorities
  ) {
    if (
      authorityIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `authority:${authority.id}:duplicate`,
      );

      continue;
    }


    authorityIds.add(
      authority.id,
    );


    if (
      !safeA0Authority(
        authority,
      )
    ) {
      blockingReasons.push(
        `authority:${authority.id}:unsafe_a0_contract`,
      );
    }
  }


  const grouped =
    new Map<
      string,
      CanonicalDependencyRuntimeActionAuthorityV1[]
    >();


  for (
    const authority of
      dependencyAuthorities
  ) {
    if (
      !safeA0Authority(
        authority,
      )
    ) {
      continue;
    }


    const key =
      `${authority.manifestId}\u0000${authority.manifestCode}`;


    const existing =
      grouped.get(
        key,
      ) ??
      [];


    existing.push(
      authority,
    );


    grouped.set(
      key,
      existing,
    );
  }


  for (
    const group of
      [...grouped.values()]
        .sort(
          (a, b) =>
            a[0].manifestCode.localeCompare(
              b[0].manifestCode,
            ),
        )
  ) {
    const first =
      group[0];


    const row =
      exactManifestRow(
        rows,
        first.manifestId,
        first.manifestCode,
      );


    if (!row) {
      blockingReasons.push(
        `manifest:${first.manifestCode}:exact_row_missing_or_ambiguous`,
      );

      continue;
    }


    if (
      stringValue(
        row.authoring_status,
      ) !==
        'validated' ||
      stringValue(
        row.runtime_family,
      ) !==
        first.runtimeFamily ||
      stringValue(
        row.execution_phase,
      ) !==
        first.executionPhase
    ) {
      blockingReasons.push(
        `manifest:${first.manifestCode}:runtime_contract_mismatch`,
      );

      continue;
    }


    const bindings =
      manifestBindings(
        row,
      );


    if (!bindings) {
      manifestsWithoutBindings.push(
        first.manifestCode,
      );

      continue;
    }


    const supportingIds =
      group
        .map(
          (authority) =>
            authority.id,
        )
        .sort();


    for (
      const bindingName of
        Object.keys(
          bindings,
        ).sort()
    ) {
      const definition =
        canonicalObject(
          bindings[
            bindingName
          ],
        );


      if (!definition) {
        blockingReasons.push(
          `manifest:${first.manifestCode}:binding:${bindingName}:definition_not_object`,
        );

        continue;
      }


      const whereClause =
        canonicalObject(
          definition.where,
        );


      authorities.push({
        id: [
          'runtime-binding-definition-authority-v1',
          idPart(
            first.manifestCode,
          ),
          idPart(
            bindingName,
          ),
        ].join(':'),

        status:
          'candidate',

        manifestId:
          first.manifestId,

        manifestCode:
          first.manifestCode,

        runtimeFamily:
          first.runtimeFamily,

        executionPhase:
          first.executionPhase,

        bindingName,

        bindingDefinition:
          definition,

        entityLabel:
          stringValue(
            definition.entity,
          ) ??
          null,

        scopeLabel:
          stringValue(
            definition.scope,
          ) ??
          null,

        cardinalityLabel:
          stringValue(
            definition.cardinality,
          ) ??
          null,

        whereClause,

        topLevelWhereOperator:
          stringValue(
            whereClause?.op,
          ) ??
          null,

        supportingDependencyAuthorityIds:
          supportingIds,

        governance: {
          exactValidatedManifestRequired:
            true,

          exactA0DependencyAuthorityRequired:
            true,

          bindingNamePreservedOpaque:
            true,

          bindingDefinitionPreservedOpaque:
            true,

          entityLabelPreservedOpaque:
            true,

          scopeLabelPreservedOpaque:
            true,

          cardinalityLabelPreservedOpaque:
            true,

          whereClausePreservedOpaque:
            true,

          whereOperatorPreservedOpaque:
            true,

          entitySemanticsResolved:
            false,

          scopeSemanticsResolved:
            false,

          cardinalitySemanticsResolved:
            false,

          whereSemanticsResolved:
            false,

          referenceSemanticsResolved:
            false,

          occurrenceEnumerationPerformed:
            false,

          occurrenceBindingPerformed:
            false,

          endpointRoleResolved:
            false,

          dependencyDirectionResolved:
            false,

          dependencySemanticsResolved:
            false,

          canonicalEdgeGenerated:
            false,

          grammaticalFunctionResolved:
            false,

          complementArgumentAttachmentResolved:
            false,

          realizesSlotGenerated:
            false,

          productionActivationAssumed:
            false,

          candidateOnly:
            true,

          frozenGrammarReadOnly:
            true,
        },
      });
    }
  }


  const reasons =
    unique(
      blockingReasons,
    );


  if (
    reasons.length >
      0
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_BINDING_DEFINITION_AUTHORITY_V1,

      producerVersion:
        '1',

      status:
        'blocked',

      authorities:
        [],

      manifestsWithoutBindings:
        unique(
          manifestsWithoutBindings,
        ),

      blockingReasons:
        reasons,
    };
  }


  return {
    producer:
      CANONICAL_RUNTIME_BINDING_DEFINITION_AUTHORITY_V1,

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

    manifestsWithoutBindings:
      unique(
        manifestsWithoutBindings,
      ),

    blockingReasons:
      [],
  };
}