import {
  type AuthoritativeParadigm,
  BokmalWrittenFormSelectionPolicy,
  buildParadigmIdentity,
  type FormPreferenceProvider,
  hasInternalServiceAuthorization,
  isD10FormsV2CanaryEnabled,
  isD10PersistenceEnabled,
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

Deno.test("01 exact lookup defaults to scope=e and Bokmål only", async () => {
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
  assertEquals(first.searchParams.get("dict"), "bm");
});

Deno.test("01b Nynorsk is available only when explicitly requested", async () => {
  const seen: string[] = [];
  const client = new OrdbokeneClient({
    fetchImpl: (input) => {
      seen.push(String(input));
      return Promise.resolve(json({ articles: { nn: [] } }));
    },
  });

  await client.lookup("få", ["nn"]);
  assertEquals(new URL(seen[0]).searchParams.get("dict"), "nn");
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

Deno.test("13 written policy keeps håpet/håpte primary and håpa alternative", () => {
  const groups = new BokmalWrittenFormSelectionPolicy().select(
    parseOrdbokeneArticles([HOPE_BM]),
  );
  const preterite = groups.find((group) => group.formKey === "preterite");
  assert(preterite);
  assertEquals(preterite.primary.map((form) => form.value), ["håpet", "håpte"]);
  assertEquals(preterite.alternatives.map((form) => form.value), ["håpa"]);
  assert(preterite.alternatives[0].evidenceIds.length === 3);
});

Deno.test("14 same-POS articles never merge into one display group", () => {
  const secondArticle = { ...HOPE_BM, articleId: "99999" };
  const groups = new BokmalWrittenFormSelectionPolicy().select(
    parseOrdbokeneArticles([HOPE_BM, secondArticle]),
  ).filter((group) => group.formKey === "preterite");

  assertEquals(groups.length, 2);
  assertEquals(new Set(groups.map((group) => group.articleId)).size, 2);
});

Deno.test("15 sa/la are not classified as regular -a alternatives", () => {
  const paradigms = parseOrdbokeneArticles([FA_BM_VERB]).map((paradigm) => ({
    ...paradigm,
    forms: [
      {
        formKey: "preterite",
        value: "sa",
        normalizedValue: "sa",
        tags: ["Past"],
        sourceOrdinal: 0,
      },
      {
        formKey: "preterite",
        value: "sagde",
        normalizedValue: "sagde",
        tags: ["Past"],
        sourceOrdinal: 1,
      },
      {
        formKey: "past_participle",
        value: "la",
        normalizedValue: "la",
        tags: ["<PerfPart>"],
        sourceOrdinal: 2,
      },
      {
        formKey: "past_participle",
        value: "lagt",
        normalizedValue: "lagt",
        tags: ["<PerfPart>"],
        sourceOrdinal: 3,
      },
    ],
  }));
  const groups = new BokmalWrittenFormSelectionPolicy().select(paradigms);

  assert(groups.every((group) => group.alternatives.length === 0));
});

Deno.test("16 policy never creates values absent from Ordbøkene paradigms", () => {
  const paradigms = parseOrdbokeneArticles([GAPE_BM, HOPE_BM]);
  const sourceValues = new Set(
    paradigms.flatMap((paradigm) => paradigm.forms.map((form) => form.value)),
  );
  const selectedValues = new BokmalWrittenFormSelectionPolicy().select(
    paradigms,
  )
    .flatMap((group) => [...group.primary, ...group.alternatives])
    .map((form) => form.value);

  assert(selectedValues.every((value) => sourceValues.has(value)));
});

Deno.test("17 worker authorization accepts only the exact internal credential", () => {
  const secret = "service-role-test-secret";
  assertEquals(hasInternalServiceAuthorization(null, secret), false);
  assertEquals(
    hasInternalServiceAuthorization("Bearer user-jwt", secret),
    false,
  );
  assertEquals(
    hasInternalServiceAuthorization(`Bearer ${secret}`, secret),
    true,
  );
  assertEquals(
    hasInternalServiceAuthorization(`Bearer ${secret}-suffix`, secret),
    false,
  );
});

Deno.test("18 persistence requires the explicit exact rollout flag", () => {
  assertEquals(isD10PersistenceEnabled(undefined), false);
  assertEquals(isD10PersistenceEnabled("false"), false);
  assertEquals(isD10PersistenceEnabled("TRUE"), false);
  assertEquals(isD10PersistenceEnabled("true"), true);
});

Deno.test("19 D10 shadow is restricted to an explicit job UUID allowlist", () => {
  const jobId = "123e4567-e89b-42d3-a456-426614174000";
  const otherJobId = "123e4567-e89b-42d3-a456-426614174001";

  assertEquals(isD10FormsV2CanaryEnabled(jobId, undefined, jobId), false);
  assertEquals(isD10FormsV2CanaryEnabled(jobId, "true", undefined), false);
  assertEquals(isD10FormsV2CanaryEnabled(jobId, "true", "not-a-uuid"), false);
  assertEquals(isD10FormsV2CanaryEnabled(jobId, "true", otherJobId), false);
  assertEquals(
    isD10FormsV2CanaryEnabled(jobId, "true", ` ${otherJobId}, ${jobId} `),
    true,
  );
});

Deno.test("20 D10 canary fails closed above the 500-job rollout ceiling", () => {
  const jobId = "123e4567-e89b-42d3-a456-426614174000";
  const ids = Array.from(
    { length: 501 },
    (_, index) => `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`,
  );
  ids[0] = jobId;

  assertEquals(isD10FormsV2CanaryEnabled(jobId, "true", ids.join(",")), false);
});
