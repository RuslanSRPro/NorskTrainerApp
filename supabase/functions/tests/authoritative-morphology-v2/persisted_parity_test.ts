import { assertEquals } from "jsr:@std/assert@1";
import {
  comparePersistedProjection,
  type PersistedFormDisplayRow,
} from "../../_shared/authoritative-morphology-v2/persisted-parity.ts";
import type { FormDisplayGroup } from "../../_shared/authoritative-morphology-v2/types.ts";

function group(
  primary: string[],
  alternatives: string[] = [],
): FormDisplayGroup {
  const selected = (value: string, tier: "primary" | "alternative") => ({
    formKey: "noun_singular_definite",
    value,
    normalizedValue: value,
    tags: [],
    sourceOrdinal: 0,
    tier,
    paradigmIdentity: "bm|1|bok|noun|1",
    paradigmId: "1",
    evidenceIds: ["ordbokene:official-form"],
  });
  return {
    dictionaryCode: "bm",
    articleId: "1",
    pos: "noun",
    lemma: "bok",
    formKey: "noun_singular_definite",
    primary: primary.map((value) => selected(value, "primary")),
    alternatives: alternatives.map((value) => selected(value, "alternative")),
    regularityMarker: "unknown",
    evidenceIds: ["ordbokene:official-form"],
    policyVersion: "bokmal-written-display/v3",
  };
}

function row(
  primary: string[],
  alternatives: string[] = [],
): PersistedFormDisplayRow {
  return {
    lexeme_id: "lexeme-a",
    dictionary_code: "bm",
    article_id: 1,
    article_ids: [1],
    pos: "noun",
    lemma: "bok",
    form_key: "noun_singular_definite",
    primary_values: primary,
    alternative_values: alternatives,
    regularity_marker: "unknown",
    policy_version: "bokmal-written-display/v2",
  };
}

Deno.test("persisted parity accepts exact values across policy versions", () => {
  const result = comparePersistedProjection(
    [group(["boken"])],
    [row(["boken"])],
    "resolved",
    true,
    [1],
  );
  assertEquals(result.status, "exact_match");
  assertEquals(result.persistedPolicyVersions, ["bokmal-written-display/v2"]);
  assertEquals(result.livePolicyVersions, ["bokmal-written-display/v3"]);
});

Deno.test("persisted parity isolates tier-only policy differences", () => {
  const result = comparePersistedProjection(
    [group(["boken"], ["boka"])],
    [row(["boken", "boka"])],
    "resolved",
    true,
    [1],
  );
  assertEquals(result.status, "policy_only_difference");
  assertEquals(result.valuesMatch, true);
  assertEquals(result.tiersMatch, false);
});

Deno.test("persisted parity reports source value changes", () => {
  const result = comparePersistedProjection(
    [group(["boken"])],
    [row(["boka"])],
    "resolved",
    true,
    [1],
  );
  assertEquals(result.status, "source_changed");
  assertEquals(result.onlyLive, ["noun_singular_definite|boken"]);
  assertEquals(result.onlyPersisted, ["noun_singular_definite|boka"]);
});

Deno.test("persisted parity fails closed on article identity drift", () => {
  const result = comparePersistedProjection(
    [group(["boken"])],
    [row(["boken"])],
    "resolved",
    true,
    [2],
  );
  assertEquals(result.status, "identity_unresolved");
  assertEquals(result.identityMatches, false);
});
