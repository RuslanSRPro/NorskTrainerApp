// Norsk Trainer — Runtime Binding Entity Compatibility V1
//
// v1.46 A3.1
//
// Purpose:
//
//   A3.0 opaque Runtime IR binding entity label
//        +
//   explicit Canonical Graph node-type authority
//        +
//   exact opaque label equality
//        ->
//   candidate entity-label compatibility
//
// This layer does NOT claim that Runtime IR entity semantics have been
// resolved merely because two opaque labels are equal.
//
// It proves only:
//   "this runtime entity label is lexically compatible with this
//    independently-authorized Canonical Graph node-type label."
//
// No Runtime IR entity vocabulary is hardcoded here.
//
// Therefore labels that do not occur in the supplied canonical node-type
// authority remain unmapped automatically.
//
// No occurrence enumeration.
// No scope / where / cardinality execution.
// No graph mutation.
// Candidate != resolved.

import type {
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from './canonical-runtime-binding-definition-authority-v1.ts';


export const CANONICAL_RUNTIME_BINDING_ENTITY_COMPATIBILITY_V1 =
  'canonical_runtime_binding_entity_compatibility_v1';


export type CanonicalGraphNodeTypeAuthorityV1 = {
  authorityId:
    string;

  status:
    'proven';

  nodeType:
    LanguageGraphNodeV1['type'];

  source:
    'canonical_language_graph_core_v1';
};


export type CanonicalRuntimeBindingEntityCompatibilityV1 = {
  id:
    string;

  status:
    'candidate';

  bindingDefinitionAuthorityId:
    string;

  manifestId:
    string;

  manifestCode:
    string;

  bindingName:
    string;

  runtimeEntityLabel:
    string;

  canonicalNodeType:
    LanguageGraphNodeV1['type'];

  canonicalNodeTypeAuthorityId:
    string;

  governance: {
    exactBindingDefinitionAuthorityRequired:
      true;

    exactCanonicalNodeTypeAuthorityRequired:
      true;

    exactOpaqueLabelMatch:
      true;

    runtimeEntityVocabularyHardcoded:
      false;

    canonicalNodeTypeInferredFromName:
      false;

    entitySemanticsResolved:
      false;

    occurrenceDomainResolved:
      false;

    occurrenceEnumerationPerformed:
      false;

    scopeSemanticsResolved:
      false;

    whereSemanticsResolved:
      false;

    cardinalitySemanticsResolved:
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

    compatibilityOnly:
      true;

    candidateOnly:
      true;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalRuntimeBindingEntityCompatibilityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_BINDING_ENTITY_COMPATIBILITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  candidates:
    CanonicalRuntimeBindingEntityCompatibilityV1[];

  unmappedBindingDefinitionAuthorityIds:
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


function safeBindingAuthority(
  authority:
    CanonicalRuntimeBindingDefinitionAuthorityV1,
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

    Boolean(
      stringValue(
        authority.bindingName,
      ),
    ) &&

    g.exactValidatedManifestRequired ===
      true &&

    g.exactA0DependencyAuthorityRequired ===
      true &&

    g.bindingNamePreservedOpaque ===
      true &&

    g.bindingDefinitionPreservedOpaque ===
      true &&

    g.entityLabelPreservedOpaque ===
      true &&

    g.entitySemanticsResolved ===
      false &&

    g.scopeSemanticsResolved ===
      false &&

    g.cardinalitySemanticsResolved ===
      false &&

    g.whereSemanticsResolved ===
      false &&

    g.referenceSemanticsResolved ===
      false &&

    g.occurrenceEnumerationPerformed ===
      false &&

    g.occurrenceBindingPerformed ===
      false &&

    g.canonicalEdgeGenerated ===
      false &&

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


export function deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
  bindingAuthorities:
    readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],

  canonicalNodeTypeAuthorities:
    readonly CanonicalGraphNodeTypeAuthorityV1[],
): CanonicalRuntimeBindingEntityCompatibilityResultV1 {
  const blockingReasons:
    string[] = [];

  const candidates:
    CanonicalRuntimeBindingEntityCompatibilityV1[] = [];

  const unmapped:
    string[] = [];


  const seenBindingAuthorityIds =
    new Set<
      string
    >();


  for (
    const authority of
      bindingAuthorities
  ) {
    if (
      seenBindingAuthorityIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:duplicate`,
      );

      continue;
    }


    seenBindingAuthorityIds.add(
      authority.id,
    );


    if (
      !safeBindingAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:unsafe_contract`,
      );
    }
  }


  const nodeTypeByLabel =
    new Map<
      string,
      CanonicalGraphNodeTypeAuthorityV1
    >();


  const seenCanonicalAuthorityIds =
    new Set<
      string
    >();


  for (
    const authority of
      canonicalNodeTypeAuthorities
  ) {
    const authorityId =
      stringValue(
        authority.authorityId,
      );


    const nodeType =
      stringValue(
        authority.nodeType,
      );


    if (
      !authorityId ||
      !nodeType ||
      authority.status !==
        'proven' ||
      authority.source !==
        'canonical_language_graph_core_v1'
    ) {
      blockingReasons.push(
        `canonical_node_type_authority:${authorityId ?? 'unknown'}:unsafe_contract`,
      );

      continue;
    }


    if (
      seenCanonicalAuthorityIds.has(
        authorityId,
      )
    ) {
      blockingReasons.push(
        `canonical_node_type_authority:${authorityId}:duplicate_id`,
      );
    }


    seenCanonicalAuthorityIds.add(
      authorityId,
    );


    if (
      nodeTypeByLabel.has(
        nodeType,
      )
    ) {
      blockingReasons.push(
        `canonical_node_type:${nodeType}:ambiguous_authority`,
      );

      continue;
    }


    nodeTypeByLabel.set(
      nodeType,
      authority,
    );
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
        CANONICAL_RUNTIME_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        '1',

      status:
        'blocked',

      candidates:
        [],

      unmappedBindingDefinitionAuthorityIds:
        [],

      blockingReasons:
        reasons,
    };
  }


  for (
    const bindingAuthority of
      bindingAuthorities
  ) {
    const entityLabel =
      stringValue(
        bindingAuthority.entityLabel,
      );


    if (!entityLabel) {
      unmapped.push(
        bindingAuthority.id,
      );

      continue;
    }


    const canonicalAuthority =
      nodeTypeByLabel.get(
        entityLabel,
      );


    if (!canonicalAuthority) {
      unmapped.push(
        bindingAuthority.id,
      );

      continue;
    }


    candidates.push({
      id: [
        'runtime-binding-entity-compatibility-v1',
        idPart(
          bindingAuthority.id,
        ),
        idPart(
          canonicalAuthority.nodeType,
        ),
      ].join(':'),

      status:
        'candidate',

      bindingDefinitionAuthorityId:
        bindingAuthority.id,

      manifestId:
        bindingAuthority.manifestId,

      manifestCode:
        bindingAuthority.manifestCode,

      bindingName:
        bindingAuthority.bindingName,

      runtimeEntityLabel:
        entityLabel,

      canonicalNodeType:
        canonicalAuthority.nodeType,

      canonicalNodeTypeAuthorityId:
        canonicalAuthority.authorityId,

      governance: {
        exactBindingDefinitionAuthorityRequired:
          true,

        exactCanonicalNodeTypeAuthorityRequired:
          true,

        exactOpaqueLabelMatch:
          true,

        runtimeEntityVocabularyHardcoded:
          false,

        canonicalNodeTypeInferredFromName:
          false,

        entitySemanticsResolved:
          false,

        occurrenceDomainResolved:
          false,

        occurrenceEnumerationPerformed:
          false,

        scopeSemanticsResolved:
          false,

        whereSemanticsResolved:
          false,

        cardinalitySemanticsResolved:
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

        compatibilityOnly:
          true,

        candidateOnly:
          true,

        frozenGrammarReadOnly:
          true,
      },
    });
  }


  return {
    producer:
      CANONICAL_RUNTIME_BINDING_ENTITY_COMPATIBILITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    candidates:
      candidates.sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      ),

    unmappedBindingDefinitionAuthorityIds:
      unique(
        unmapped,
      ),

    blockingReasons:
      [],
  };
}