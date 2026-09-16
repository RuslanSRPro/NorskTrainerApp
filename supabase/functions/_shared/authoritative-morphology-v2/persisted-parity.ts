import { normalizeNorwegian } from "./parser.ts";
import type { FormDisplayGroup, MorphologyPos } from "./types.ts";

export type PersistedFormDisplayRow = {
  lexeme_id: string;
  dictionary_code: string;
  article_id: number | string | null;
  article_ids: Array<number | string>;
  pos: MorphologyPos;
  lemma: string;
  form_key: string;
  primary_values: string[];
  alternative_values: string[];
  regularity_marker: string;
  policy_version: string;
};

export type PersistedParityStatus =
  | "exact_match"
  | "policy_only_difference"
  | "source_changed"
  | "identity_unresolved";

export type PersistedParityResult = {
  status: PersistedParityStatus;
  identityMatches: boolean;
  valuesMatch: boolean;
  tiersMatch: boolean;
  persistedPolicyVersions: string[];
  livePolicyVersions: string[];
  persistedArticleIds: string[];
  liveArticleIds: string[];
  onlyLive: string[];
  onlyPersisted: string[];
  tierDifferences: string[];
};

export function comparePersistedProjection(
  groups: readonly FormDisplayGroup[],
  rows: readonly PersistedFormDisplayRow[],
  sourceStatus: string,
  publishable: boolean,
  liveArticleIds: readonly (number | string)[],
): PersistedParityResult {
  const persistedArticles = sortedUnique(
    rows.flatMap((row) =>
      row.article_ids.length > 0
        ? row.article_ids.map(String)
        : row.article_id === null
        ? []
        : [String(row.article_id)]
    ),
  );
  const liveArticles = sortedUnique(liveArticleIds.map(String));
  const persistedPolicies = sortedUnique(rows.map((row) => row.policy_version));
  const livePolicies = sortedUnique(groups.map((group) => group.policyVersion));

  const sourceResolved = sourceStatus === "resolved" ||
    sourceStatus === "resolved_equivalent_source_articles" ||
    sourceStatus === "resolved_bound_source_article";
  const identityMatches = sourceResolved && publishable && rows.length > 0 &&
    setEquals(new Set(persistedArticles), new Set(liveArticles)) &&
    rows.every((row) => row.dictionary_code === "bm") &&
    groups.every((group) => group.dictionaryCode === "bm") &&
    setEquals(
      new Set(rows.map((row) => row.pos)),
      new Set(groups.map((group) => group.pos)),
    ) &&
    setEquals(
      new Set(rows.map((row) => normalizeNorwegian(row.lemma))),
      new Set(groups.map((group) => normalizeNorwegian(group.lemma))),
    );

  const livePrimary = new Set(
    groups.flatMap((group) =>
      group.primary.map((form) => key(group.formKey, form.value))
    ),
  );
  const liveAlternative = new Set(
    groups.flatMap((group) =>
      group.alternatives.map((form) => key(group.formKey, form.value))
    ),
  );
  const persistedPrimary = new Set(
    rows.flatMap((row) =>
      row.primary_values.map((value) => key(row.form_key, value))
    ),
  );
  const persistedAlternative = new Set(
    rows.flatMap((row) =>
      row.alternative_values.map((value) => key(row.form_key, value))
    ),
  );
  const liveAll = union(livePrimary, liveAlternative);
  const persistedAll = union(persistedPrimary, persistedAlternative);
  const valuesMatch = setEquals(liveAll, persistedAll);
  const tiersMatch = setEquals(livePrimary, persistedPrimary) &&
    setEquals(liveAlternative, persistedAlternative);
  const onlyLive = difference(liveAll, persistedAll);
  const onlyPersisted = difference(persistedAll, liveAll);
  const tierDifferences = valuesMatch
    ? sortedUnique([
      ...difference(livePrimary, persistedPrimary).map((value) =>
        `live-primary:${value}`
      ),
      ...difference(persistedPrimary, livePrimary).map((value) =>
        `persisted-primary:${value}`
      ),
      ...difference(liveAlternative, persistedAlternative).map((value) =>
        `live-alternative:${value}`
      ),
      ...difference(persistedAlternative, liveAlternative).map((value) =>
        `persisted-alternative:${value}`
      ),
    ])
    : [];

  const status: PersistedParityStatus = !identityMatches
    ? "identity_unresolved"
    : !valuesMatch
    ? "source_changed"
    : !tiersMatch
    ? "policy_only_difference"
    : "exact_match";

  return {
    status,
    identityMatches,
    valuesMatch,
    tiersMatch,
    persistedPolicyVersions: persistedPolicies,
    livePolicyVersions: livePolicies,
    persistedArticleIds: persistedArticles,
    liveArticleIds: liveArticles,
    onlyLive: onlyLive.slice(0, 50),
    onlyPersisted: onlyPersisted.slice(0, 50),
    tierDifferences: tierDifferences.slice(0, 50),
  };
}

function key(formKey: string, value: string): string {
  return `${formKey}|${normalizeNorwegian(value)}`;
}

function union(left: Set<string>, right: Set<string>): Set<string> {
  return new Set([...left, ...right]);
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => !right.has(value)).sort();
}

function setEquals<T>(left: Set<T>, right: Set<T>): boolean {
  return left.size === right.size &&
    [...left].every((value) => right.has(value));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
