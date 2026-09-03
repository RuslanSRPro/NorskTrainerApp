// Norsk Trainer — Canonical Phrase Head Projection Adapter V1
//
// Read-only adapter from a frozen Grammar Knowledge / historical-manifest
// snapshot into CanonicalPhraseRuntimeRuleV1.
//
// Architectural invariants:
//
// - Grammar Knowledge is immutable.
// - Historical manifest is immutable.
// - Historical compiled strategy is NOT reused.
// - phrase_type and head_ref come from validated manifest actions.
// - morphology comes from frozen inventory + canonical morph registry.
// - no language-specific aliases are hardcoded.
// - incomplete / contradictory source data => BLOCKED.
// - output exists only in memory; no grammar_rules row is created.

import type {
  CanonicalPhraseRuntimeRuleV1,
  CanonicalPhraseRuntimeSourceRefV1,
} from './canonical-phrase-candidate-lattice-v1.ts';

export const CANONICAL_PHRASE_HEAD_PROJECTION_ADAPTER_V1 =
  'canonical_phrase_head_projection_adapter_v1';

export const CANONICAL_PHRASE_HEAD_PROJECTION_ADAPTER_VERSION_V1 =
  '1';

type Json = Record<string, unknown>;

type MorphRegistryEntryV1 = {
  pos: string;
  formKey: string;
  formScope: string;
  canonicalFeatures: Record<string, unknown>;
  provenancePolicy?: string | null;
};

type ActionDescriptorV1 = {
  target: string;
  phraseType: string;
};

export type CanonicalPhraseHeadProjectionAdapterResultV1 = {
  adapter:
    typeof CANONICAL_PHRASE_HEAD_PROJECTION_ADAPTER_V1;

  adapterVersion:
    typeof CANONICAL_PHRASE_HEAD_PROJECTION_ADAPTER_VERSION_V1;

  status: 'ready' | 'blocked';

  rule?: CanonicalPhraseRuntimeRuleV1;

  blockingReasons: string[];

  derived: {
    phraseType?: string;
    headRef?: string;
    pos?: string;
    commonCanonicalFeatures:
      Record<string, string>;
  };

  governance: {
    frozenGrammarReadOnly: true;
    manifestReadOnly: true;
    grammarRuleMaterialized: false;
    productionActivated: false;
  };
};

function asRecord(
  value: unknown,
): Json {
  return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ? value as Json
    : {};
}

function stringValue(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const v = value.trim();

  return v || undefined;
}

function normalizedLabel(
  value: unknown,
): string | undefined {
  return stringValue(value)
    ?.normalize('NFC')
    .toLocaleLowerCase('nb-NO');
}

function unique<T>(
  values: readonly T[],
): T[] {
  return [...new Set(values)];
}

function stringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return unique(
    value
      .map((item) =>
        stringValue(item)
      )
      .filter(
        (item): item is string =>
          Boolean(item),
      ),
  );
}

function stableScalarFeatureEntries(
  features: Record<string, unknown>,
): Array<[string, string]> {
  const out:
    Array<[string, string]> = [];

  for (
    const [key, value] of
      Object.entries(features)
        .sort(([a], [b]) =>
          a.localeCompare(b)
        )
  ) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out.push([
        key,
        String(value),
      ]);
    }
  }

  return out;
}

function commonFeatureIntersection(
  sets:
    readonly Record<string, unknown>[],
): Record<string, string> {
  if (!sets.length) {
    return {};
  }

  const common =
    new Map(
      stableScalarFeatureEntries(
        sets[0],
      ),
    );

  for (
    const set of sets.slice(1)
  ) {
    const current =
      new Map(
        stableScalarFeatureEntries(
          set,
        ),
      );

    for (
      const [key, value] of
        [...common.entries()]
    ) {
      if (
        current.get(key) !== value
      ) {
        common.delete(key);
      }
    }
  }

  return Object.fromEntries(
    [...common.entries()]
      .sort(([a], [b]) =>
        a.localeCompare(b)
      ),
  );
}

function featureWhere(
  bindingRef: string,
  features: Record<string, string>,
): unknown {
  const expressions =
    Object.entries(features)
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([key, value]) => ({
        op: 'has_feature',

        left: {
          ref:
            `${bindingRef}.morph`,
        },

        right:
          `${key}=${value}`,
      }));

  if (expressions.length === 1) {
    return expressions[0];
  }

  return {
    all: expressions,
  };
}

function registryRows(
  value: unknown,
): MorphRegistryEntryV1[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out:
    MorphRegistryEntryV1[] = [];

  for (const raw of value) {
    const row =
      asRecord(raw);

    const pos =
      normalizedLabel(row.pos);

    const formKey =
      stringValue(
        row.form_key ??
          row.formKey,
      );

    const formScope =
      stringValue(
        row.form_scope ??
          row.formScope,
      );

    if (
      !pos ||
      !formKey ||
      !formScope
    ) {
      continue;
    }

    out.push({
      pos,

      formKey,

      formScope,

      canonicalFeatures:
        asRecord(
          row.canonical_features ??
            row.canonicalFeatures,
        ),

      provenancePolicy:
        stringValue(
          row.provenance_policy ??
            row.provenancePolicy,
        ) ?? null,
    });
  }

  return out;
}

function actionDescriptor(
  raw: unknown,
  expectedAction: string,
): ActionDescriptorV1 | undefined {
  const action =
    asRecord(raw);

  if (
    stringValue(action.action) !==
      expectedAction
  ) {
    return undefined;
  }

  const target =
    stringValue(action.target);

  const value =
    asRecord(action.value);

  const phraseType =
    stringValue(
      value.phrase_type ??
        value.phraseType,
    );

  if (
    !target ||
    !phraseType
  ) {
    return undefined;
  }

  return {
    target,
    phraseType,
  };
}

function sourceRef(
  fact: Json,
): CanonicalPhraseRuntimeSourceRefV1 | undefined {
  const candidateId =
    stringValue(
      fact.candidate_id ??
        fact.candidateId,
    );

  const candidateCode =
    stringValue(
      fact.candidate_code ??
        fact.candidateCode,
    );

  if (!candidateCode) {
    return undefined;
  }

  return {
    candidateId,

    candidateCode,

    sourceSection:
      stringValue(
        fact.source_section ??
          fact.sourceSection,
      ),

    status:
      stringValue(fact.status),

    // This projection has no newly materialized grammar_rule.
    // Provenance is therefore manifest/build-plane provenance.
    bindingLevel:
      'manifest',
  };
}

export function buildCanonicalPhraseHeadProjectionFromSnapshotV1(
  snapshot: unknown,
): CanonicalPhraseHeadProjectionAdapterResultV1 {
  const adapter =
    CANONICAL_PHRASE_HEAD_PROJECTION_ADAPTER_V1;

  const adapterVersion =
    CANONICAL_PHRASE_HEAD_PROJECTION_ADAPTER_VERSION_V1;

  const root =
    asRecord(snapshot);

  const source =
    asRecord(root.source);

  const inventory =
    asRecord(
      root.morphology_inventory ??
        root.morphologyInventory,
    );

  const manifest =
    asRecord(
      root.manifest_projection ??
        root.manifestProjection,
    );

  const blockingReasons:
    string[] = [];

  // ------------------------------------------------------------------
  // Snapshot safety gate
  // ------------------------------------------------------------------

  if (root.read_only !== true) {
    blockingReasons.push(
      'snapshot:not_read_only',
    );
  }

  if (root.write_performed !== false) {
    blockingReasons.push(
      'snapshot:write_performed_not_false',
    );
  }

  if (
    root.frozen_grammar_immutable !==
      true
  ) {
    blockingReasons.push(
      'snapshot:frozen_grammar_not_immutable',
    );
  }

  if (
    root.historical_manifest_interpretation_only !==
      true
  ) {
    blockingReasons.push(
      'snapshot:historical_manifest_not_interpretation_only',
    );
  }

  // ------------------------------------------------------------------
  // Frozen source gate
  // ------------------------------------------------------------------

  const sourceCode =
    stringValue(
      source.candidate_code ??
        source.candidateCode,
    );

  const sourceId =
    stringValue(
      source.candidate_id ??
        source.candidateId,
    );

  const sourceStatus =
    stringValue(source.status);

  if (
    !sourceCode ||
    !sourceId
  ) {
    blockingReasons.push(
      'source:identity_missing',
    );
  }

  if (
    sourceStatus !==
      'source_verified'
  ) {
    blockingReasons.push(
      'source:not_source_verified',
    );
  }

  if (
    source.requires_human_verification ===
      true ||
    source.requiresHumanVerification ===
      true
  ) {
    blockingReasons.push(
      'source:human_verification_required',
    );
  }

  const sourceExecution =
    asRecord(
      asRecord(
        source.execution_contract ??
          source.executionContract,
      ).audit,
    );

  if (
    stringValue(
      sourceExecution.disposition,
    ) !==
      'KEEP_GRAMMAR_RUNTIME'
  ) {
    blockingReasons.push(
      'source:not_keep_grammar_runtime',
    );
  }

  const sourcePayload =
    asRecord(
      source.extracted_payload ??
        source.extractedPayload,
    );

  if (
    !stringValue(
      sourcePayload.construction,
    )
  ) {
    blockingReasons.push(
      'source:construction_missing',
    );
  }

  if (
    !stringValue(
      sourcePayload.head_role,
    )
  ) {
    blockingReasons.push(
      'source:head_role_missing',
    );
  }

  // ------------------------------------------------------------------
  // Frozen morphology inventory
  // ------------------------------------------------------------------

  const inventoryCode =
    stringValue(
      inventory.candidate_code ??
        inventory.candidateCode,
    );

  const inventoryId =
    stringValue(
      inventory.candidate_id ??
        inventory.candidateId,
    );

  if (
    !inventoryCode ||
    !inventoryId
  ) {
    blockingReasons.push(
      'inventory:identity_missing',
    );
  }

  if (
    stringValue(inventory.status) !==
      'source_verified'
  ) {
    blockingReasons.push(
      'inventory:not_source_verified',
    );
  }

  if (
    inventory.requires_human_verification ===
      true ||
    inventory.requiresHumanVerification ===
      true
  ) {
    blockingReasons.push(
      'inventory:human_verification_required',
    );
  }

  const inventoryPayload =
    asRecord(
      inventory.extracted_payload ??
        inventory.extractedPayload,
    );

  const formTypes =
    stringArray(
      inventoryPayload.form_types ??
        inventoryPayload.formTypes,
    );

  if (!formTypes.length) {
    blockingReasons.push(
      'inventory:form_types_missing',
    );
  }

  // ------------------------------------------------------------------
  // Manifest action interpretation
  // ------------------------------------------------------------------

  const manifestId =
    stringValue(
      manifest.manifest_id ??
        manifest.manifestId,
    );

  const manifestCode =
    stringValue(
      manifest.manifest_code ??
        manifest.manifestCode,
    );

  if (
    !manifestId ||
    !manifestCode
  ) {
    blockingReasons.push(
      'manifest:identity_missing',
    );
  }

  if (
    stringValue(
      manifest.authoring_status ??
        manifest.authoringStatus,
    ) !==
      'validated'
  ) {
    blockingReasons.push(
      'manifest:not_validated',
    );
  }

  if (
    sourceCode &&
    stringValue(
      manifest.primary_candidate_code ??
        manifest.primaryCandidateCode,
    ) !==
      sourceCode
  ) {
    blockingReasons.push(
      'manifest:primary_source_mismatch',
    );
  }

  const actions =
    Array.isArray(manifest.actions)
      ? manifest.actions
      : [];

  const createActions =
    actions
      .map((action) =>
        actionDescriptor(
          action,
          'create_phrase',
        )
      )
      .filter(
        (
          action,
        ): action is ActionDescriptorV1 =>
          Boolean(action),
      );

  const headActions =
    actions
      .map((action) =>
        actionDescriptor(
          action,
          'set_head',
        )
      )
      .filter(
        (
          action,
        ): action is ActionDescriptorV1 =>
          Boolean(action),
      );

  if (createActions.length !== 1) {
    blockingReasons.push(
      'manifest:create_phrase_action_not_unique',
    );
  }

  if (headActions.length !== 1) {
    blockingReasons.push(
      'manifest:set_head_action_not_unique',
    );
  }

  const createAction =
    createActions.length === 1
      ? createActions[0]
      : undefined;

  const headAction =
    headActions.length === 1
      ? headActions[0]
      : undefined;

  let phraseType:
    string | undefined;

  let headRef:
    string | undefined;

  if (
    createAction &&
    headAction
  ) {
    if (
      createAction.target !==
        headAction.target
    ) {
      blockingReasons.push(
        'manifest:head_target_disagreement',
      );
    }

    if (
      createAction.phraseType !==
        headAction.phraseType
    ) {
      blockingReasons.push(
        'manifest:phrase_type_disagreement',
      );
    }

    if (
      createAction.target ===
        headAction.target &&
      createAction.phraseType ===
        headAction.phraseType
    ) {
      headRef =
        createAction.target;

      phraseType =
        createAction.phraseType;
    }
  }

  // ------------------------------------------------------------------
  // Registry -> common canonical morphology
  // ------------------------------------------------------------------

  const registry =
    registryRows(
      root.morph_registry ??
        root.morphRegistry,
    );

  const matchedRegistry:
    MorphRegistryEntryV1[] = [];

  for (const formType of formTypes) {
    const matches =
      registry.filter(
        (entry) =>
          entry.formScope ===
            'token' &&
          normalizedLabel(
            entry.formKey,
          ) ===
            normalizedLabel(
              formType,
            ),
      );

    if (matches.length !== 1) {
      blockingReasons.push(
        `morph_registry:${formType}:missing_or_ambiguous`,
      );

      continue;
    }

    matchedRegistry.push(
      matches[0],
    );
  }

  const positions =
    unique(
      matchedRegistry.map(
        (entry) =>
          entry.pos,
      ),
    );

  const pos =
    positions.length === 1
      ? positions[0]
      : undefined;

  if (
    matchedRegistry.length > 0 &&
    positions.length !== 1
  ) {
    blockingReasons.push(
      'morph_registry:pos_not_unique',
    );
  }

  const commonCanonicalFeatures =
    commonFeatureIntersection(
      matchedRegistry.map(
        (entry) =>
          entry.canonicalFeatures,
      ),
    );

  if (
    matchedRegistry.length > 0 &&
    Object.keys(
      commonCanonicalFeatures,
    ).length === 0
  ) {
    blockingReasons.push(
      'morph_registry:no_common_canonical_features',
    );
  }

  // ------------------------------------------------------------------
  // Fail closed
  // ------------------------------------------------------------------

  if (
    blockingReasons.length > 0 ||
    !sourceCode ||
    !sourceId ||
    !inventoryCode ||
    !inventoryId ||
    !manifestCode ||
    !manifestId ||
    !phraseType ||
    !headRef ||
    !pos ||
    Object.keys(
      commonCanonicalFeatures,
    ).length === 0
  ) {
    return {
      adapter,
      adapterVersion,

      status:
        'blocked',

      blockingReasons:
        unique(
          blockingReasons,
        ).sort(),

      derived: {
        phraseType,
        headRef,
        pos,
        commonCanonicalFeatures,
      },

      governance: {
        frozenGrammarReadOnly:
          true,

        manifestReadOnly:
          true,

        grammarRuleMaterialized:
          false,

        productionActivated:
          false,
      },
    };
  }

  // ------------------------------------------------------------------
  // Source provenance
  // ------------------------------------------------------------------

  const sourceRefs =
    [
      sourceRef(source),
      sourceRef(inventory),
    ].filter(
      (
        ref,
      ): ref is CanonicalPhraseRuntimeSourceRefV1 =>
        Boolean(ref),
    );

  const sourceCandidateCodes =
    unique(
      sourceRefs.map(
        (ref) =>
          ref.candidateCode,
      ),
    ).sort();

  const sourceSections =
    unique(
      sourceRefs
        .map(
          (ref) =>
            ref.sourceSection,
        )
        .filter(
          (
            section,
          ): section is string =>
            Boolean(section),
        ),
    ).sort();

  // ------------------------------------------------------------------
  // Runtime projection
  //
  // This is intentionally NOT the historical compiled rule.
  //
  // head_only is a generic canonical execution operator, while the
  // phrase identity/head slot come from frozen manifest actions.
  // ------------------------------------------------------------------

  const rule:
    CanonicalPhraseRuntimeRuleV1 = {

    ruleId:
      `projection:${manifestId}`,

    ruleCode:
      `projection:${manifestCode}:head_only`,

    runtimeFamily:
      stringValue(
        manifest.runtime_family ??
          manifest.runtimeFamily,
      ),

    executionPhase:
      stringValue(
        manifest.execution_phase ??
          manifest.executionPhase,
      ),

    patternType:
      'phrase_pattern',

    constraintStrength:
      stringValue(
        manifest.constraint_strength ??
          manifest.constraintStrength,
      ),

    pattern: {
      bindings: {
        [headRef]: {
          scope:
            'sentence',

          entity:
            'candidate',

          cardinality:
            'one_or_more',

          where:
            featureWhere(
              headRef,
              commonCanonicalFeatures,
            ),
        },
      },

      head_ref:
        headRef,

      phrase_type:
        phraseType,

      build_strategy:
        'head_only',

      projection_metadata: {
        adapter,
        adapterVersion,

        sourceConstruction:
          stringValue(
            sourcePayload.construction,
          ),

        sourceHeadRole:
          stringValue(
            sourcePayload.head_role,
          ),

        morphRegistryPos:
          pos,

        frozenGrammarReadOnly:
          true,

        historicalManifestInterpretationOnly:
          true,
      },
    },

    sourceRefs,

    ruleSourceCandidateCodes:
      [],

    manifestSourceCandidateCodes:
      sourceCandidateCodes,

    sourceCandidateCodes,

    sourceSections,

    manifestCode,
  };

  return {
    adapter,
    adapterVersion,

    status:
      'ready',

    rule,

    blockingReasons:
      [],

    derived: {
      phraseType,
      headRef,
      pos,
      commonCanonicalFeatures,
    },

    governance: {
      frozenGrammarReadOnly:
        true,

      manifestReadOnly:
        true,

      grammarRuleMaterialized:
        false,

      productionActivated:
        false,
    },
  };
}