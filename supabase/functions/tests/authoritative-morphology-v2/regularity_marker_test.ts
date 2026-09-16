import { assertEquals } from "jsr:@std/assert@1";

import {
  BokmalWrittenFormSelectionPolicy,
  normalizeNorwegian,
} from "../../_shared/authoritative-morphology-v2/mod.ts";
import type {
  AuthoritativeParadigm,
  SourceForm,
} from "../../_shared/authoritative-morphology-v2/types.ts";

function sourceForm(
  formKey: string,
  value: string,
  sourceOrdinal: number,
): SourceForm {
  return {
    formKey,
    value,
    normalizedValue: normalizeNorwegian(value),
    tags: [],
    sourceOrdinal,
  };
}

function paradigm(
  lemma: string,
  preterites: string[],
): AuthoritativeParadigm {
  return {
    identity: `bm|1|${lemma}|verb|1`,
    source: "Ordbokene",
    dictionaryCode: "bm",
    dictionaryName: "Bokmålsordboka",
    articleId: "1",
    articleUrl: "https://ord.uib.no/perl/ordbok.cgi",
    articleVersion: null,
    pos: "verb",
    paradigmId: "1",
    lemma,
    paradigmTags: ["VERB"],
    inflectionGroup: null,
    standardisation: null,
    forms: [
      sourceForm("infinitive", lemma, 0),
      ...preterites.map((value, index) =>
        sourceForm("preterite", value, index + 1)
      ),
    ],
    preference: null,
  };
}

function marker(lemma: string, preterites: string[]) {
  const groups = new BokmalWrittenFormSelectionPolicy().select(
    [paradigm(lemma, preterites)],
    { normalizedQuery: normalizeNorwegian(lemma) },
  );

  return groups.find((group) => group.formKey === "preterite")
    ?.regularityMarker;
}

Deno.test("weak Bokmål verbs are structurally regular", () => {
  assertEquals(marker("håpe", ["håpet", "håpte", "håpa"]), "regular");
  assertEquals(marker("snakke", ["snakket", "snakka"]), "regular");
  assertEquals(marker("kjøpe", ["kjøpte"]), "regular");
  assertEquals(marker("bygge", ["bygde"]), "regular");
});

Deno.test("stem-changing Bokmål verbs are structurally irregular", () => {
  assertEquals(marker("gå", ["gikk"]), "irregular");
  assertEquals(marker("skrive", ["skrev"]), "irregular");
  assertEquals(marker("vite", ["visste"]), "irregular");
  assertEquals(marker("selge", ["solgte"]), "irregular");
  assertEquals(marker("være", ["var"]), "irregular");
});
