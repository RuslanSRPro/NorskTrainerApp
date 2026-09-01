import type {
  AuthoritativeParadigm,
  DictionaryCode,
  MorphologyPos,
  OrdbokeneArticle,
  SourceForm,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;

type MutableParadigm = Omit<AuthoritativeParadigm, "forms"> & {
  forms: SourceForm[];
};

export function normalizeNorwegian(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("nb-NO").trim().replace(
    /\s+/g,
    " ",
  );
}

export function buildParadigmIdentity(args: {
  dictionaryCode: DictionaryCode;
  articleId: string;
  pos: MorphologyPos;
  paradigmId: string;
}): string {
  return [
    args.dictionaryCode,
    args.articleId,
    args.pos,
    args.paradigmId,
  ].map((part) => encodeURIComponent(part)).join("|");
}

export function parseOrdbokeneArticles(
  articles: readonly OrdbokeneArticle[],
): AuthoritativeParadigm[] {
  const paradigms = new Map<string, MutableParadigm>();

  for (const article of articles) {
    const lemmas = asRecords(article.payload.lemmas);

    for (const lemma of lemmas) {
      const lemmaValue = firstString(lemma.final_lexeme, lemma.lemma) ?? "";
      const paradigmInfo = asRecords(lemma.paradigm_info);

      for (const paradigm of paradigmInfo) {
        const paradigmTags = stringArray(paradigm.tags);
        const pos = detectPos(paradigmTags);
        if (!pos) continue;

        const paradigmId = scalarString(paradigm.paradigm_id);
        if (!paradigmId) continue;
        const identity = buildParadigmIdentity({
          dictionaryCode: article.dictionaryCode,
          articleId: article.articleId,
          pos,
          paradigmId,
        });

        const target = paradigms.get(identity) ?? makeParadigm({
          article,
          identity,
          lemma: lemmaValue,
          paradigm,
          paradigmId,
          paradigmTags,
          pos,
        });

        let sourceOrdinal = target.forms.length;
        for (const inflection of asRecords(paradigm.inflection)) {
          const value = firstString(inflection.word_form);
          if (!value) continue;

          const tags = stringArray(inflection.tags);
          const normalizedValue = normalizeNorwegian(value);
          const formKey = classifyFormKey(pos, tags);

          target.forms.push({
            formKey,
            value,
            normalizedValue,
            tags,
            sourceOrdinal,
          });
          sourceOrdinal += 1;
        }

        paradigms.set(identity, target);
      }
    }
  }

  return [...paradigms.values()]
    .filter((paradigm) => paradigm.forms.length > 0)
    .sort((left, right) => left.identity.localeCompare(right.identity));
}

function makeParadigm(args: {
  article: OrdbokeneArticle;
  identity: string;
  lemma: string;
  paradigm: UnknownRecord;
  paradigmId: string;
  paradigmTags: string[];
  pos: MorphologyPos;
}): MutableParadigm {
  return {
    identity: args.identity,
    source: "Ordbokene",
    dictionaryCode: args.article.dictionaryCode,
    dictionaryName: args.article.dictionaryCode === "bm"
      ? "Bokmålsordboka"
      : "Nynorskordboka",
    articleId: args.article.articleId,
    articleUrl: args.article.sourceUrl,
    articleVersion: scalarString(args.article.payload.version) ??
      scalarString(args.article.payload.v),
    pos: args.pos,
    paradigmId: args.paradigmId,
    lemma: args.lemma,
    paradigmTags: args.paradigmTags,
    inflectionGroup: firstString(args.paradigm.inflection_group),
    standardisation: firstString(args.paradigm.standardisation),
    forms: [],
    preference: null,
  };
}

function detectPos(tags: readonly string[]): MorphologyPos | null {
  const normalized = new Set(tags.map((tag) => tag.toUpperCase()));
  if (normalized.has("VERB")) return "verb";
  if (normalized.has("NOUN") || normalized.has("SUBST")) return "noun";
  if (normalized.has("ADJ")) return "adjective";
  if (normalized.has("DET")) return "determiner";
  return null;
}

function classifyFormKey(pos: MorphologyPos, tags: readonly string[]): string {
  const normalized = new Set(tags.map(normalizeTag));

  if (pos === "verb") {
    if (normalized.has("inf") && normalized.has("pass")) {
      return "infinitive_passive";
    }
    if (normalized.has("pres") && normalized.has("pass")) {
      return "present_passive";
    }
    if (normalized.has("inf")) return "infinitive";
    if (normalized.has("pres")) return "present";
    if (normalized.has("past")) return "preterite";
    if (normalized.has("<perfpart>") && normalized.has("adj")) {
      return `past_participle_adjectival_${nominalFeatureKey(normalized)}`;
    }
    if (normalized.has("<perfpart>")) return "past_participle";
    if (normalized.has("<prespart>")) return "present_participle";
    if (normalized.has("imp")) return "imperative";
  }

  if (pos === "noun") {
    return `noun_${nominalFeatureKey(normalized)}`;
  }

  if (pos === "adjective") {
    if (normalized.has("cmp")) return "comparative";
    if (normalized.has("sup")) {
      return normalized.has("def") ? "superlative_definite" : "superlative";
    }
    if (normalized.has("pos")) {
      return `positive_${nominalFeatureKey(normalized)}`;
    }
  }

  if (pos === "determiner") {
    return normalized.size === 0
      ? "determiner"
      : `determiner_${featureSlug(normalized)}`;
  }

  return `source_${
    normalized.size === 0 ? "unmarked" : featureSlug(normalized)
  }`;
}

function nominalFeatureKey(tags: ReadonlySet<string>): string {
  const number = tags.has("plur")
    ? "plural"
    : tags.has("sing")
    ? "singular"
    : "";
  const definiteness = tags.has("def")
    ? "definite"
    : tags.has("ind")
    ? "indefinite"
    : "";
  const gender = tags.has("neuter")
    ? "neuter"
    : tags.has("masc/fem")
    ? "common"
    : tags.has("masc")
    ? "masculine"
    : tags.has("fem")
    ? "feminine"
    : "";

  return [number, definiteness, gender].filter(Boolean).join("_") ||
    featureSlug(tags) || "unmarked";
}

function featureSlug(tags: ReadonlySet<string>): string {
  return [...tags].sort().map((tag) =>
    tag.replace(/[<>]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
  ).filter(Boolean).join("_");
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function asRecords(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function scalarString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
