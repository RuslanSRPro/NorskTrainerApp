import {
  resolveAuthoritativeMorphology,
  type ResolveResult,
} from "../../_shared/authoritative-morphology-v2/mod.ts";

const fa = await resolveAuthoritativeMorphology({
  request: { query: "få", dictionaries: ["bm", "nn"] },
});
assertResolved(fa, "få");
assertHas(fa, "bm", "verb");
assertHas(fa, "bm", "determiner");
assertHas(fa, "nn", "verb");
assertHas(fa, "nn", "adjective");

const gape = await resolveAuthoritativeMorphology({
  request: { query: "gape", pos: "verb", dictionaries: ["bm"] },
});
assertResolved(gape, "gape");
assertValues(gape, "preterite", ["gapa", "gapte"]);

const hope = await resolveAuthoritativeMorphology({
  request: { query: "håpe", pos: "verb", dictionaries: ["bm"] },
});
assertResolved(hope, "håpe");
assertValues(hope, "preterite", ["håpa", "håpet", "håpte"]);

console.log(JSON.stringify(
  {
    ok: true,
    checkedAt: new Date().toISOString(),
    corpus: {
      fa: summarize(fa),
      gape: summarize(gape),
      hope: summarize(hope),
    },
  },
  null,
  2,
));

function assertResolved(result: ResolveResult, lemma: string): void {
  if (result.status !== "resolved") {
    throw new Error(`${lemma}: expected resolved, received ${result.status}`);
  }
}

function assertHas(
  result: ResolveResult,
  dictionaryCode: "bm" | "nn",
  pos: "verb" | "noun" | "adjective" | "determiner",
): void {
  if (
    !result.paradigms.some((item) =>
      item.dictionaryCode === dictionaryCode && item.pos === pos
    )
  ) {
    throw new Error(`Missing ${dictionaryCode}:${pos}`);
  }
}

function assertValues(
  result: ResolveResult,
  formKey: string,
  expected: string[],
): void {
  const values = new Set(
    result.paradigms.flatMap((paradigm) => paradigm.forms)
      .filter((form) => form.formKey === formKey)
      .map((form) => form.value),
  );
  for (const value of expected) {
    if (!values.has(value)) throw new Error(`Missing ${formKey}: ${value}`);
  }
}

function summarize(result: ResolveResult): unknown {
  return {
    scope: result.lookup.scopeUsed,
    articles: result.lookup.articleReferences,
    paradigms: result.paradigms.map((item) => ({
      identity: item.identity,
      forms: item.forms.length,
    })),
  };
}
