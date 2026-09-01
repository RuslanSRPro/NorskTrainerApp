import {
  type AuthoritativeParadigm,
  buildParadigmIdentity,
  type FormPreferenceProvider,
  OrdbokeneClient,
  parseOrdbokeneArticles,
  resolveAuthoritativeMorphology,
} from "../../_shared/authoritative-morphology-v2/mod.ts";
import {
  FA_BM_DETERMINER,
  FA_BM_VERB,
  FA_CORPUS,
  GAPE_BM,
  HOPE_BM,
} from "./golden-fixtures.ts";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message?: string,
): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(message ?? `Expected ${right}, received ${left}`);
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("01 exact lookup requests scope=e for Bokmål and Nynorsk", async () => {
  const seen: string[] = [];
  const client = new OrdbokeneClient({
    fetchImpl: (input) => {
      const url = String(input);
      seen.push(url);
      return Promise.resolve(json({ articles: { bm: [], nn: [] } }));
    },
  });

  await client.lookup("få");
  const first = new URL(seen[0]);
  assertEquals(first.searchParams.get("scope"), "e");
  assertEquals(first.searchParams.get("dict"), "bm,nn");
});

Deno.test("02 empty exact lookup falls back to scope=i", async () => {
  const scopes: string[] = [];
  const client = new OrdbokeneClient({
    fetchImpl: (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/articles") {
        const scope = url.searchParams.get("scope") ?? "";
        scopes.push(scope);
        return Promise.resolve(json({
          articles: scope === "i"
            ? { bm: [21740], nn: [] }
            : { bm: [], nn: [] },
        }));
      }
      return Promise.resolve(json(FA_BM_VERB.payload));
    },
  });

  const lookup = await client.lookup("gikk");
  assertEquals(scopes, ["e", "i"]);
  assertEquals(lookup.scopeUsed, "i");
  assertEquals(lookup.articleReferences.length, 1);
});

Deno.test("03 resolver fetches every article and has no first-five cap", async () => {
  let articleFetches = 0;
  const client = new OrdbokeneClient({
    fetchImpl: (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/articles") {
        return Promise.resolve(
          json({ articles: { bm: [1, 2, 3, 4, 5, 6, 7] } }),
        );
      }
      articleFetches += 1;
      return Promise.resolve(json(FA_BM_VERB.payload));
    },
  });

  const lookup = await client.lookup("få", ["bm"]);
  assertEquals(articleFetches, 7);
  assertEquals(lookup.articles.length, 7);
});

Deno.test("04 identity is dictionary + article + POS + paradigm", () => {
  assertEquals(
    buildParadigmIdentity({
      dictionaryCode: "nn",
      articleId: "23679",
      pos: "adjective",
      paradigmId: "2130",
    }),
    "nn|23679|adjective|2130",
  );
});

Deno.test("05 Bokmål få homonyms stay verb and determiner identities", () => {
  const paradigms = parseOrdbokeneArticles([FA_BM_VERB, FA_BM_DETERMINER]);
  assertEquals(new Set(paradigms.map((item) => item.pos)).size, 2);
  assert(paradigms.some((item) => item.identity === "bm|18820|verb|195"));
  assert(paradigms.some((item) => item.identity === "bm|18819|determiner|427"));
});

Deno.test("06 Nynorsk få keeps adjective degrees separate from verbs", () => {
  const paradigms = parseOrdbokeneArticles(FA_CORPUS);
  const adjectives = paradigms.filter((item) => item.pos === "adjective");
  assertEquals(adjectives.length, 2);
  assert(
    adjectives.every((item) =>
      item.forms.some((form) =>
        form.formKey === "comparative" && form.value === "færre"
      )
    ),
  );
});

Deno.test("07 resolver POS filter returns only the requested homonym", async () => {
  const client = {
    lookup: () =>
      Promise.resolve({
        query: "få",
        normalizedQuery: "få",
        requestedDictionaries: ["bm" as const],
        scopeUsed: "e" as const,
        articleReferences: [
          { dictionaryCode: "bm" as const, articleId: "18820" },
          { dictionaryCode: "bm" as const, articleId: "18819" },
        ],
        articles: [FA_BM_VERB, FA_BM_DETERMINER],
        errors: [],
        checkedAt: "2026-09-01T00:00:00.000Z",
      }),
  } as unknown as OrdbokeneClient;

  const result = await resolveAuthoritativeMorphology({
    request: { query: "få", pos: "determiner", dictionaries: ["bm"] },
    client,
  });
  assertEquals(result.paradigms.map((item) => item.pos), ["determiner"]);
});

Deno.test("08 gape article 19072 preserves gapa and gapte paradigms", () => {
  const paradigms = parseOrdbokeneArticles([GAPE_BM]);
  assertEquals(paradigms.length, 2);
  assertEquals(
    paradigms.map((item) => item.paradigmId).sort(),
    ["1", "16"],
  );
  const preterites = paradigms.flatMap((item) => item.forms)
    .filter((form) => form.formKey === "preterite")
    .map((form) => form.value)
    .sort();
  assertEquals(preterites, ["gapa", "gapte"]);
});

Deno.test("09 håpe article 25496 preserves -a, -et and -te forms", () => {
  const paradigms = parseOrdbokeneArticles([HOPE_BM]);
  const preterites = new Set(
    paradigms.flatMap((item) => item.forms)
      .filter((form) => form.formKey === "preterite")
      .map((form) => form.value),
  );
  assert(preterites.has("håpa"));
  assert(preterites.has("håpet"));
  assert(preterites.has("håpte"));
});

Deno.test("10 source-only parser never derives har/hadde or pseudo-forms", () => {
  const values = parseOrdbokeneArticles([FA_BM_VERB, HOPE_BM])
    .flatMap((item) => item.forms)
    .map((form) => form.value);
  assert(
    values.every((value) =>
      !value.startsWith("har ") && !value.startsWith("hadde ")
    ),
  );
  assert(values.every((value) => value !== "needs_review"));
});

Deno.test("11 nouns preserve source rows and invalid paradigms fail closed", () => {
  const nounArticle = {
    ...FA_BM_VERB,
    articleId: "noun-fixture",
    payload: {
      lemmas: [{
        final_lexeme: "hus",
        paradigm_info: [{
          tags: ["NOUN", "Neuter"],
          paradigm_id: 101,
          inflection_group: "NOUN_regular",
          inflection: [
            { word_form: "hus", tags: ["Ind", "Sing"] },
            { word_form: "hus", tags: ["Ind", "Sing"] },
            { word_form: "huset", tags: ["Def", "Sing"] },
            { word_form: "hus", tags: ["Ind", "Plur"] },
            { word_form: "husene", tags: ["Def", "Plur"] },
          ],
        }],
      }],
    },
  };
  const nounParadigms = parseOrdbokeneArticles([nounArticle]);
  assertEquals(nounParadigms[0].pos, "noun");
  assertEquals(
    nounParadigms[0].forms.map((form) => form.formKey),
    [
      "noun_singular_indefinite",
      "noun_singular_indefinite",
      "noun_singular_definite",
      "noun_plural_indefinite",
      "noun_plural_definite",
    ],
  );

  const emptyArticle = {
    ...FA_BM_VERB,
    articleId: "empty",
    payload: { lemmas: [] },
  };
  assertEquals(parseOrdbokeneArticles([emptyArticle]), []);

  const unidentifiedArticle = {
    ...nounArticle,
    articleId: "missing-paradigm-id",
    payload: {
      lemmas: [{
        final_lexeme: "hus",
        paradigm_info: [{
          tags: ["NOUN", "Neuter"],
          inflection: [{ word_form: "hus", tags: ["Ind", "Sing"] }],
        }],
      }],
    },
  };
  assertEquals(parseOrdbokeneArticles([unidentifiedArticle]), []);
});

Deno.test("12 preference provider annotates but cannot create source forms", async () => {
  const provider: FormPreferenceProvider = {
    providerVersion: "test-grammar-kb/v1",
    getPreference: (paradigm: Readonly<AuthoritativeParadigm>) =>
      Promise.resolve({
        regularity: paradigm.lemma === "få" ? "suppletive" : "unknown",
        evidenceIds: ["test-rule"],
        providerVersion: "test-grammar-kb/v1",
      }),
  };
  const lookup = {
    query: "få",
    normalizedQuery: "få",
    requestedDictionaries: ["bm" as const],
    scopeUsed: "e" as const,
    articleReferences: [{ dictionaryCode: "bm" as const, articleId: "18820" }],
    articles: [FA_BM_VERB],
    errors: [],
    checkedAt: "2026-09-01T00:00:00.000Z",
  };
  const client = {
    lookup: () => Promise.resolve(lookup),
  } as unknown as OrdbokeneClient;
  const before = parseOrdbokeneArticles([FA_BM_VERB])[0].forms;
  const result = await resolveAuthoritativeMorphology({
    request: { query: "få", pos: "verb", dictionaries: ["bm"] },
    client,
    preferenceProvider: provider,
  });
  assertEquals(result.paradigms[0].forms, before);
  assertEquals(result.paradigms[0].preference?.regularity, "suppletive");
});
