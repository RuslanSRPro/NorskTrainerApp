import {
  formatDisplayLemma,
  formatInfinitive,
  formatNounIndefinite,
  getFormTierValues,
} from "../../../../services/formPresentation.ts";
import {
  buildV2Bundles,
  type V2FormRow,
} from "../../../../services/formReadModelCore.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("noun articles come only from materialized source metadata", () => {
  const rows: V2FormRow[] = [{
    lexeme_id: "bok",
    form_key: "noun_singular_indefinite",
    primary_values: ["bok"],
    alternative_values: [],
    accepted_articles: ["ei", "en"],
    regularity_marker: "unknown",
  }];
  const bundle = buildV2Bundles(rows).get("bok")!;

  assertEquals(bundle.accepted_articles, ["en", "ei"]);
  assertEquals(formatNounIndefinite("bok", bundle), "en/ei bok");
  assertEquals(
    formatDisplayLemma("ei bok", { ...bundle, pos: "noun" }),
    "en/ei bok",
  );
  assertEquals(formatNounIndefinite("bil", { pos: "noun" }), "bil");
});

Deno.test("verb presentation adds exactly one infinitive marker", () => {
  assertEquals(formatInfinitive("klage"), "å klage");
  assertEquals(formatInfinitive("å klage"), "å klage");
  assertEquals(formatDisplayLemma("selge", { pos: "verb" }), "å selge");
});

Deno.test("adjective degree alternatives remain available to +N UI", () => {
  const word = {
    forms_read_model: "v2",
    form_primary: { komparativ: ["feitere"] },
    form_alternatives: { komparativ: ["fetere"] },
  };
  assertEquals(getFormTierValues(word, "komparativ"), {
    primaryValues: ["feitere"],
    alternativeValues: ["fetere"],
  });
});
