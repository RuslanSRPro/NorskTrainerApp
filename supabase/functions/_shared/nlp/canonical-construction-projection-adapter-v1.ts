// Norsk Trainer — Canonical Construction Projection Adapter V1 (v1.44)
//
// Read-only adapter from frozen Grammar Knowledge into canonical construction
// execution projections.
//
// This module:
// - does NOT edit source grammar;
// - does NOT define Norwegian grammar rules;
// - does NOT persist grammar_rules or manifests;
// - translates existing frozen form labels through canonical morphology data;
// - blocks rather than guesses when source/registry evidence is incomplete.

import type {
  CanonicalConstructionProjectionV1,
} from './canonical-construction-candidate-lattice-v1.ts';

export const CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_V1 =
  'canonical_construction_projection_adapter_v1';

export const CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_VERSION_V1 =
  '1';

type Json = Record<string, unknown>;

export type CanonicalFrozenGrammarFactV1 = {
  candidateId: string;
  candidateCode: string;

  sourceSection?: string;

  status: string;
  requiresHumanVerification?: boolean;

  extractedPayload: Record<string, unknown>;
  digitalModel?: Record<string, unknown>;
  executionContract?: Record<string, unknown>;
};

export type CanonicalConstructionMorphRegistryEntryV1 = {
  pos: string;
  form_key: string;
  form_scope: string;

  canonical_features: Record<string, unknown>;

  is_active?: boolean;
  provenance_policy?: string | null;
};

export type CanonicalConstructionProjectionAdapterInputV1 = {
  constructionSource: CanonicalFrozenGrammarFactV1;

  // Frozen reference facts. They remain read-only.
  finiteInventory: CanonicalFrozenGrammarFactV1;
  nonfiniteInventory?: CanonicalFrozenGrammarFactV1;

  morphRegistry:
    readonly CanonicalConstructionMorphRegistryEntryV1[];
};

export type CanonicalConstructionProjectionAdapterResultV1 = {
  adapter:
    typeof CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_V1;

  adapterVersion:
    typeof CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_VERSION_V1;

  status: 'ready' | 'blocked';

  projections: CanonicalConstructionProjectionV1[];

  blockingReasons: string[];

  sourceCandidateCodes: string[];
};

function asRecord(value: unknown): Json {
  return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ? value as Json
    : {};
}

function stringValue(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();

  return trimmed || undefined;
}

function normalizedLabel(
  value: unknown,
): string | undefined {
  const valueString = stringValue(value);

  return valueString
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
  if (!Array.isArray(value)) return [];

  return unique(
    value
      .map((item) => stringValue(item))
      .filter((item): item is string =>
        Boolean(item)
      ),
  );
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(value)
    .replaceAll('%', '_');
}

function stableScalarFeatureEntries(
  features: Record<string, unknown>,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];

  for (
    const [key, value] of
      Object.entries(features)
        .sort(([a], [b]) => a.localeCompare(b))
  ) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out.push([key, String(value)]);
    }
  }

  return out;
}

function commonFeatureIntersection(
  featureSets:
    readonly Record<string, unknown>[],
): Record<string, string> {
  if (!featureSets.length) return {};

  const first = new Map(
    stableScalarFeatureEntries(featureSets[0]),
  );

  for (
    const featureSet of featureSets.slice(1)
  ) {
    const current = new Map(
      stableScalarFeatureEntries(featureSet),
    );

    for (
      const [key, value] of [...first.entries()]
    ) {
      if (current.get(key) !== value) {
        first.delete(key);
      }
    }
  }

  return Object.fromEntries(
    [...first.entries()]
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function featureWhere(
  ref: string,
  features: Record<string, string>,
): unknown {
  const expressions =
    Object.entries(features)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        op: 'has_feature',
        left: {
          ref: `${ref}.morph`,
        },
        right: `${key}=${value}`,
      }));

  if (expressions.length === 1) {
    return expressions[0];
  }

  return {
    all: expressions,
  };
}

function frozenFactGate(
  fact: CanonicalFrozenGrammarFactV1,
  expectedRole?: string,
): string[] {
  const reasons: string[] = [];

  if (fact.status !== 'source_verified') {
    reasons.push(
      `${fact.candidateCode}:not_source_verified`,
    );
  }

  if (
    fact.requiresHumanVerification === true
  ) {
    reasons.push(
      `${fact.candidateCode}:human_verification_required`,
    );
  }

  const payloadCode =
    stringValue(
      fact.extractedPayload.candidate_code,
    );

  if (
    payloadCode &&
    payloadCode !== fact.candidateCode
  ) {
    reasons.push(
      `${fact.candidateCode}:payload_code_mismatch`,
    );
  }

  if (expectedRole) {
    const execution =
      asRecord(
        asRecord(
          fact.executionContract,
        ).execution,
      );

    const role =
      stringValue(execution.role);

    if (role !== expectedRole) {
      reasons.push(
        `${fact.candidateCode}:execution_role_${role ?? 'missing'}`,
      );
    }

    const audit =
      asRecord(
        asRecord(
          fact.executionContract,
        ).audit,
      );

    if (
      stringValue(audit.disposition) !==
        'KEEP_GRAMMAR_RUNTIME'
    ) {
      reasons.push(
        `${fact.candidateCode}:not_keep_grammar_runtime`,
      );
    }
  }

  return reasons;
}

function uniqueRegistryEntry(
  registry:
    readonly CanonicalConstructionMorphRegistryEntryV1[],
  formKey: string,
):
  | CanonicalConstructionMorphRegistryEntryV1
  | undefined {
  const normalizedKey =
    normalizedLabel(formKey);

  const matches = registry
    .filter((entry) =>
      entry.is_active !== false
    )
    .filter((entry) =>
      entry.form_scope === 'token'
    )
    .filter((entry) =>
      normalizedLabel(entry.form_key) ===
        normalizedKey
    )
    .sort((a, b) =>
      `${a.pos}|${a.form_key}`.localeCompare(
        `${b.pos}|${b.form_key}`,
      )
    );

  // Ambiguous registry ownership must be resolved by data,
  // never guessed by the adapter.
  if (matches.length !== 1) {
    return undefined;
  }

  return matches[0];
}

function projectionCode(
  sourceCode: string,
  formKey: string,
): string {
  return [
    'frozen_projection',
    idPart(sourceCode),
    idPart(formKey),
  ].join(':');
}

export function buildCanonicalConstructionProjectionsFromFrozenGrammarV1(
  input:
    CanonicalConstructionProjectionAdapterInputV1,
): CanonicalConstructionProjectionAdapterResultV1 {
  const adapter =
    CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_V1;

  const adapterVersion =
    CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_VERSION_V1;

  const blockingReasons: string[] = [];

  const source =
    input.constructionSource;

  blockingReasons.push(
    ...frozenFactGate(source, 'construction'),
  );

  blockingReasons.push(
    ...frozenFactGate(input.finiteInventory),
  );

  if (input.nonfiniteInventory) {
    blockingReasons.push(
      ...frozenFactGate(
        input.nonfiniteInventory,
      ),
    );
  }

  const model =
    asRecord(
      asRecord(source.digitalModel).model,
    );

  if (
    stringValue(model.type) !==
      'construction_compatibility'
  ) {
    blockingReasons.push(
      `${source.candidateCode}:model_not_construction_compatibility`,
    );
  }

  const sourcePayload =
    asRecord(source.extractedPayload);

  const constructionType =
    stringValue(
      sourcePayload.construction,
    );

  if (!constructionType) {
    blockingReasons.push(
      `${source.candidateCode}:construction_type_missing`,
    );
  }

  // This adapter executes only source schemas that explicitly expose
  // finite/non-finite member roles.
  //
  // Missing fields are a capability block, NOT an invitation to infer them
  // from prose or candidate-code spelling.
  const finiteRole =
    stringValue(sourcePayload.finite_role);

  const nonfiniteRole =
    stringValue(sourcePayload.nonfinite_role);

  if (!finiteRole) {
    blockingReasons.push(
      `${source.candidateCode}:finite_role_missing`,
    );
  }

  if (!nonfiniteRole) {
    blockingReasons.push(
      `${source.candidateCode}:nonfinite_role_missing`,
    );
  }

  const finiteFormTypes =
    stringArray(
      input.finiteInventory
        .extractedPayload.form_types,
    );

  if (!finiteFormTypes.length) {
    blockingReasons.push(
      `${input.finiteInventory.candidateCode}:form_types_missing`,
    );
  }

  let nonfiniteFormTypes =
    stringArray(
      sourcePayload.allowed_nonfinite_forms,
    );

  const usesNonfiniteInventory =
    nonfiniteFormTypes.length === 0;

  if (
    usesNonfiniteInventory &&
    input.nonfiniteInventory
  ) {
    nonfiniteFormTypes =
      stringArray(
        input.nonfiniteInventory
          .extractedPayload.form_types,
      );
  }

  if (!nonfiniteFormTypes.length) {
    blockingReasons.push(
      `${source.candidateCode}:allowed_nonfinite_forms_missing`,
    );
  }

  const finiteRegistryEntries:
    CanonicalConstructionMorphRegistryEntryV1[] = [];

  for (const formKey of finiteFormTypes) {
    const entry =
      uniqueRegistryEntry(
        input.morphRegistry,
        formKey,
      );

    if (!entry) {
      blockingReasons.push(
        `morph_registry:${formKey}:missing_or_ambiguous`,
      );

      continue;
    }

    finiteRegistryEntries.push(entry);
  }

  const finitePositions =
    unique(
      finiteRegistryEntries.map(
        (entry) =>
          normalizedLabel(entry.pos) ?? '',
      ),
    ).filter(Boolean);

  if (
    finiteRegistryEntries.length > 0 &&
    finitePositions.length !== 1
  ) {
    blockingReasons.push(
      'finite_inventory:registry_pos_not_unique',
    );
  }

  const finiteCommonFeatures =
    commonFeatureIntersection(
      finiteRegistryEntries.map(
        (entry) =>
          entry.canonical_features,
      ),
    );

  if (
    finiteRegistryEntries.length > 0 &&
    Object.keys(finiteCommonFeatures)
      .length === 0
  ) {
    blockingReasons.push(
      'finite_inventory:no_common_canonical_features',
    );
  }

  const nonfiniteRegistryEntries:
    CanonicalConstructionMorphRegistryEntryV1[] = [];

  for (const formKey of nonfiniteFormTypes) {
    const entry =
      uniqueRegistryEntry(
        input.morphRegistry,
        formKey,
      );

    if (!entry) {
      blockingReasons.push(
        `morph_registry:${formKey}:missing_or_ambiguous`,
      );

      continue;
    }

    nonfiniteRegistryEntries.push(entry);
  }

  const finitePos =
    finitePositions.length === 1
      ? finitePositions[0]
      : undefined;

  if (
    finitePos &&
    nonfiniteRegistryEntries.some(
      (entry) =>
        normalizedLabel(entry.pos) !==
          finitePos,
    )
  ) {
    blockingReasons.push(
      'construction_members:registry_pos_mismatch',
    );
  }

  if (blockingReasons.length > 0) {
    return {
      adapter,
      adapterVersion,
      status: 'blocked',
      projections: [],
      blockingReasons:
        unique(blockingReasons).sort(),
      sourceCandidateCodes:
        unique([
          source.candidateCode,
          input.finiteInventory.candidateCode,
          ...(input.nonfiniteInventory
            ? [
                input.nonfiniteInventory
                  .candidateCode,
              ]
            : []),
        ]).sort(),
    };
  }

  const supportFacts = [
    input.finiteInventory,
    ...(usesNonfiniteInventory &&
        input.nonfiniteInventory
      ? [input.nonfiniteInventory]
      : []),
  ];

  const sourceCandidateCodes =
    unique([
      source.candidateCode,
      ...supportFacts.map(
        (fact) => fact.candidateCode,
      ),
    ]).sort();

  const sourceSections =
    unique([
      source.sourceSection,
      ...supportFacts.map(
        (fact) => fact.sourceSection,
      ),
    ].filter(
      (section):
        section is string =>
        Boolean(section),
    )).sort();

  const sourceSnapshotId =
    [
      source.candidateId,
      ...supportFacts.map(
        (fact) => fact.candidateId,
      ),
    ].sort().join('+');

  const projections:
    CanonicalConstructionProjectionV1[] =
      nonfiniteRegistryEntries
        .sort((a, b) =>
          a.form_key.localeCompare(
            b.form_key,
          )
        )
        .map((nonfiniteEntry) => {
          const code =
            projectionCode(
              source.candidateCode,
              nonfiniteEntry.form_key,
            );

          return {
            projectionId: [
              'projection',
              adapter,
              idPart(source.candidateId),
              idPart(
                nonfiniteEntry.form_key,
              ),
            ].join(':'),

            projectionCode: code,

            constructionType:
              constructionType!,

            executionRole:
              'construction',

            bindings: {
              finite: {
                scope: 'sentence',
                entity: 'candidate',
                cardinality: 'one_or_more',

                required_pos:
                  finitePos,

                where:
                  featureWhere(
                    'finite',
                    finiteCommonFeatures,
                  ),
              },

              nonfinite: {
                scope: 'sentence',
                entity: 'candidate',
                cardinality: 'one_or_more',

                required_pos:
                  normalizedLabel(
                    nonfiniteEntry.pos,
                  ),

                where:
                  featureWhere(
                    'nonfinite',
                    Object.fromEntries(
                      stableScalarFeatureEntries(
                        nonfiniteEntry
                          .canonical_features,
                      ),
                    ),
                  ),
              },
            },

            memberRefs: [
              'finite',
              'nonfinite',
            ],

            anchorRef: 'finite',

            sourceCandidateCodes,
            sourceSections,

            sourceSnapshotId,
          };
        });

  return {
    adapter,
    adapterVersion,
    status: 'ready',
    projections,
    blockingReasons: [],
    sourceCandidateCodes,
  };
}


// ============================================================================
// A3.1 ? Read-only live snapshot normalization
// ============================================================================

export type CanonicalConstructionSnapshotAdapterConfigV1 = {
  finiteInventoryCode: string;
  nonfiniteInventoryCode: string;
};

export type CanonicalConstructionSnapshotCandidateResultV1 = {
  candidateCode: string;

  status: 'ready' | 'blocked';

  projections:
    CanonicalConstructionProjectionV1[];

  blockingReasons: string[];
};

export type CanonicalConstructionSnapshotBatchResultV1 = {
  adapter:
    typeof CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_V1;

  adapterVersion:
    typeof CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_VERSION_V1;

  snapshotVersion: string | null;

  projectionState:
    | 'fully_projectable'
    | 'partially_projectable'
    | 'blocked';

  candidateCount: number;
  readyCandidateCount: number;
  blockedCandidateCount: number;

  candidates:
    CanonicalConstructionSnapshotCandidateResultV1[];

  blockingReasons: string[];

  // Explicitly NOT a manifest/materialization decision.
  governance: {
    grammarMutationPerformed: false;
    manifestMaterializationPerformed: false;
    grammarRuleMaterializationPerformed: false;
  };
};

function snapshotFactV1(
  value: unknown,
): CanonicalFrozenGrammarFactV1 | undefined {
  const row = asRecord(value);

  const candidateId =
    stringValue(
      row.candidate_id ??
        row.candidateId,
    );

  const candidateCode =
    stringValue(
      row.candidate_code ??
        row.candidateCode,
    );

  const status =
    stringValue(row.status);

  if (
    !candidateId ||
    !candidateCode ||
    !status
  ) {
    return undefined;
  }

  return {
    candidateId,
    candidateCode,

    sourceSection:
      stringValue(
        row.source_section ??
          row.sourceSection,
      ),

    status,

    requiresHumanVerification:
      typeof row.requires_human_verification ===
          'boolean'
        ? row.requires_human_verification
        : typeof row.requiresHumanVerification ===
            'boolean'
        ? row.requiresHumanVerification
        : undefined,

    extractedPayload:
      asRecord(
        row.extracted_payload ??
          row.extractedPayload,
      ),

    digitalModel:
      asRecord(
        row.digital_model ??
          row.digitalModel,
      ),

    executionContract:
      asRecord(
        row.execution_contract ??
          row.executionContract,
      ),
  };
}

function snapshotRegistryEntryV1(
  value: unknown,
):
  | CanonicalConstructionMorphRegistryEntryV1
  | undefined {
  const row = asRecord(value);

  const pos =
    stringValue(row.pos);

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
    return undefined;
  }

  return {
    pos,
    form_key: formKey,
    form_scope: formScope,

    canonical_features:
      asRecord(
        row.canonical_features ??
          row.canonicalFeatures,
      ),

    provenance_policy:
      stringValue(
        row.provenance_policy ??
          row.provenancePolicy,
      ) ?? null,
  };
}

export function buildCanonicalConstructionProjectionBatchFromSnapshotV1(
  snapshot: unknown,
  config:
    CanonicalConstructionSnapshotAdapterConfigV1,
): CanonicalConstructionSnapshotBatchResultV1 {
  const root = asRecord(snapshot);

  const globalBlockingReasons: string[] = [];

  if (root.read_only !== true) {
    globalBlockingReasons.push(
      'snapshot:not_read_only',
    );
  }

  if (root.write_performed !== false) {
    globalBlockingReasons.push(
      'snapshot:write_performed_not_false',
    );
  }

  if (
    root.frozen_grammar_immutable !== true
  ) {
    globalBlockingReasons.push(
      'snapshot:frozen_grammar_not_immutable',
    );
  }

  const rawCandidates =
    Array.isArray(root.candidates)
      ? root.candidates
      : [];

  const rawReferences =
    Array.isArray(root.reference_facts)
      ? root.reference_facts
      : [];

  const rawRegistry =
    Array.isArray(root.morph_registry)
      ? root.morph_registry
      : [];

  const candidates =
    rawCandidates
      .map(snapshotFactV1)
      .filter(
        (
          item,
        ): item is CanonicalFrozenGrammarFactV1 =>
          Boolean(item),
      )
      .sort((a, b) =>
        a.candidateCode.localeCompare(
          b.candidateCode,
        )
      );

  if (
    candidates.length !==
      rawCandidates.length
  ) {
    globalBlockingReasons.push(
      'snapshot:invalid_candidate_row',
    );
  }

  const references =
    rawReferences
      .map(snapshotFactV1)
      .filter(
        (
          item,
        ): item is CanonicalFrozenGrammarFactV1 =>
          Boolean(item),
      );

  if (
    references.length !==
      rawReferences.length
  ) {
    globalBlockingReasons.push(
      'snapshot:invalid_reference_row',
    );
  }

  const registry =
    rawRegistry
      .map(snapshotRegistryEntryV1)
      .filter(
        (
          item,
        ): item is CanonicalConstructionMorphRegistryEntryV1 =>
          Boolean(item),
      );

  if (
    registry.length !==
      rawRegistry.length
  ) {
    globalBlockingReasons.push(
      'snapshot:invalid_registry_row',
    );
  }

  const finiteInventory =
    references.find(
      (fact) =>
        fact.candidateCode ===
          config.finiteInventoryCode,
    );

  const nonfiniteInventory =
    references.find(
      (fact) =>
        fact.candidateCode ===
          config.nonfiniteInventoryCode,
    );

  if (!finiteInventory) {
    globalBlockingReasons.push(
      `snapshot:missing_reference:${config.finiteInventoryCode}`,
    );
  }

  if (!nonfiniteInventory) {
    globalBlockingReasons.push(
      `snapshot:missing_reference:${config.nonfiniteInventoryCode}`,
    );
  }

  if (registry.length === 0) {
    globalBlockingReasons.push(
      'snapshot:morph_registry_empty',
    );
  }

  const candidateResults:
    CanonicalConstructionSnapshotCandidateResultV1[] =
      [];

  for (const candidate of candidates) {
    if (
      globalBlockingReasons.length > 0 ||
      !finiteInventory ||
      !nonfiniteInventory
    ) {
      candidateResults.push({
        candidateCode:
          candidate.candidateCode,

        status: 'blocked',

        projections: [],

        blockingReasons: [
          ...globalBlockingReasons,
        ].sort(),
      });

      continue;
    }

    const result =
      buildCanonicalConstructionProjectionsFromFrozenGrammarV1({
        constructionSource:
          candidate,

        finiteInventory,

        nonfiniteInventory,

        morphRegistry:
          registry,
      });

    candidateResults.push({
      candidateCode:
        candidate.candidateCode,

      status:
        result.status,

      projections:
        result.projections,

      blockingReasons: [
        ...result.blockingReasons,
      ].sort(),
    });
  }

  const readyCandidateCount =
    candidateResults.filter(
      (item) =>
        item.status === 'ready',
    ).length;

  const blockedCandidateCount =
    candidateResults.length -
    readyCandidateCount;

  const projectionState =
    candidateResults.length === 0 ||
      readyCandidateCount === 0
      ? 'blocked'
      : blockedCandidateCount === 0
      ? 'fully_projectable'
      : 'partially_projectable';

  return {
    adapter:
      CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_V1,

    adapterVersion:
      CANONICAL_CONSTRUCTION_PROJECTION_ADAPTER_VERSION_V1,

    snapshotVersion:
      stringValue(root.version) ?? null,

    projectionState,

    candidateCount:
      candidateResults.length,

    readyCandidateCount,

    blockedCandidateCount,

    candidates:
      candidateResults,

    blockingReasons:
      unique(
        globalBlockingReasons,
      ).sort(),

    governance: {
      grammarMutationPerformed:
        false,

      manifestMaterializationPerformed:
        false,

      grammarRuleMaterializationPerformed:
        false,
    },
  };
}
