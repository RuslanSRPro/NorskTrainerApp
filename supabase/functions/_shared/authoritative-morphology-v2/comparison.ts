import { normalizeNorwegian } from "./parser.ts";
import type { FormDisplayGroup } from "./types.ts";

export type LegacyMorphologyRow = {
  form_key: string | null;
  form_type: string;
  value: string;
};

export type IntentionalLegacyExclusion = {
  formKey: string;
  value: string;
  normalizedValue: string;
  reason: "derived_compound_tense" | "legacy_pseudo_form";
};

const LEGACY_KEY_ALIASES: Record<string, string> = {
  infinitiv: "infinitive",
  presens: "present",
  preteritum: "preterite",
  past: "preterite",
  perfektum: "past_participle",
  singular_indefinite: "noun_singular_indefinite",
  singular_definite: "noun_singular_definite",
  plural_indefinite: "noun_plural_indefinite",
  plural_definite: "noun_plural_definite",
  positive_common: "positive_singular_indefinite_common",
  positive_neuter: "positive_singular_indefinite_neuter",
  positive_plural: "positive_plural_indefinite",
  positive_definite: "positive_singular_definite",
  positive_feminine: "positive_singular_indefinite_feminine",
  adjectival_past_participle_common:
    "past_participle_adjectival_singular_indefinite_common",
  adjectival_past_participle_neuter:
    "past_participle_adjectival_singular_indefinite_neuter",
  adjectival_past_participle_definite:
    "past_participle_adjectival_singular_definite",
  adjectival_past_participle_plural: "past_participle_adjectival_plural",
};

const DERIVED_COMPOUND_KEYS = new Set(["present_perfect", "past_perfect"]);

/**
 * Compares source forms, not legacy presentation labels or derived phrases.
 *
 * V1 used shorter noun/participle keys and also stored `har/hadde + participle`
 * as if those phrases were source forms. D10 deliberately does neither. The
 * excluded rows remain visible in the audit result instead of being hidden or
 * counted as authoritative coverage differences.
 */
export function compareAuthoritativeAndLegacyForms(
  groups: readonly FormDisplayGroup[],
  legacyRows: readonly LegacyMorphologyRow[],
) {
  const v2 = new Set(
    groups.flatMap((group) => [...group.primary, ...group.alternatives])
      .map((form) => `${form.formKey}|${form.normalizedValue}`),
  );
  const rawLegacy = new Set<string>();
  const comparableLegacy = new Set<string>();
  const intentionalLegacyExclusions: IntentionalLegacyExclusion[] = [];

  for (const row of legacyRows) {
    const formKey = (row.form_key || row.form_type || "").trim();
    const value = row.value?.trim();
    if (!formKey || !value) continue;

    const normalizedValue = normalizeNorwegian(value);
    rawLegacy.add(`${formKey}|${normalizedValue}`);

    if (DERIVED_COMPOUND_KEYS.has(formKey)) {
      intentionalLegacyExclusions.push({
        formKey,
        value,
        normalizedValue,
        reason: "derived_compound_tense",
      });
      continue;
    }
    if (normalizedValue === "needs_review") {
      intentionalLegacyExclusions.push({
        formKey,
        value,
        normalizedValue,
        reason: "legacy_pseudo_form",
      });
      continue;
    }

    comparableLegacy.add(
      `${canonicalLegacyKey(formKey)}|${normalizedValue}`,
    );
  }

  return {
    matches: setEquals(v2, comparableLegacy),
    v2Count: v2.size,
    legacyCount: rawLegacy.size,
    comparableLegacyCount: comparableLegacy.size,
    intentionalLegacyExclusions: intentionalLegacyExclusions.sort((
      left,
      right,
    ) =>
      [left.formKey, left.normalizedValue].join("|").localeCompare(
        [right.formKey, right.normalizedValue].join("|"),
      )
    ),
    onlyV2: [...v2].filter((value) => !comparableLegacy.has(value)).sort()
      .slice(0, 20),
    onlyLegacy: [...comparableLegacy].filter((value) => !v2.has(value)).sort()
      .slice(0, 20),
  };
}

export function canonicalLegacyKey(value: string): string {
  return LEGACY_KEY_ALIASES[value] ?? value;
}

function setEquals<T>(left: Set<T>, right: Set<T>): boolean {
  return left.size === right.size &&
    [...left].every((value) => right.has(value));
}
