import type {
  AuthoritativeParadigm,
  FormDisplayGroup,
  FormSelectionContext,
  FormSelectionPolicy,
  RegularityMarker,
  SelectedSourceForm,
  SourceForm,
} from "./types.ts";
import { normalizeNorwegian } from "./parser.ts";

export const BM_WRITTEN_FORM_EVIDENCE = {
  officialSource: "ordbokene:official-form",
  aEndingGuidance: "sprakradet:a-endelser-i-bokmal:2025-05-07",
  verbAEndingProductPolicy: "product-policy:bm-written-verb-a-alternative-v1",
  queryLemmaProductPolicy: "product-policy:bm-query-lemma-default-v1",
  nounGenderProductPolicy: "product-policy:bm-masculine-card-default-v1",
} as const;

type Candidate = {
  form: SourceForm;
  paradigm: AuthoritativeParadigm;
};

type TieredCandidate = Candidate & {
  evidenceIds: string[];
  isAlternative: boolean;
};

type MutableGroup =
  & Omit<
    FormDisplayGroup,
    "primary" | "alternatives" | "evidenceIds" | "regularityMarker"
  >
  & {
    candidates: Candidate[];
    regularityMarkers: Set<RegularityMarker>;
  };

/**
 * Display-only policy for Bokmål written learning cards.
 *
 * The policy never creates or removes an Ordbøkene form. It only assigns
 * official source forms to primary/alternative display tiers. Competing
 * -et/-te written variants remain co-primary; an official -a preterite or
 * past participle becomes an alternative only when a non--a variant exists
 * for the same source lemma. When an article contains official co-headwords,
 * the exact lookup lemma remains the compact card default and the other
 * source-backed forms remain available as alternatives.
 */
export class BokmalWrittenFormSelectionPolicy implements FormSelectionPolicy {
  readonly policyVersion = "bokmal-written-display/v2";

  select(
    paradigms: readonly AuthoritativeParadigm[],
    context: FormSelectionContext = {},
  ): FormDisplayGroup[] {
    const groups = new Map<string, MutableGroup>();
    const normalizedQuery = normalizeNorwegian(context.normalizedQuery ?? "");

    for (const paradigm of paradigms) {
      for (const form of paradigm.forms) {
        const key = [
          paradigm.dictionaryCode,
          paradigm.articleId,
          paradigm.pos,
          form.formKey,
        ].join("|");
        const group = groups.get(key) ?? {
          dictionaryCode: paradigm.dictionaryCode,
          articleId: paradigm.articleId,
          pos: paradigm.pos,
          lemma: paradigm.lemma,
          formKey: form.formKey,
          policyVersion: this.policyVersion,
          candidates: [],
          regularityMarkers: new Set<RegularityMarker>(),
        };

        group.candidates.push({ form, paradigm });
        group.regularityMarkers.add(
          paradigm.preference?.regularity ?? "unknown",
        );
        groups.set(key, group);
      }
    }

    return [...groups.values()].map((group) =>
      this.#finalize(group, normalizedQuery)
    ).sort((left, right) =>
      [left.dictionaryCode, left.articleId, left.pos, left.formKey].join("|")
        .localeCompare(
          [right.dictionaryCode, right.articleId, right.pos, right.formKey]
            .join("|"),
        )
    );
  }

  #finalize(
    group: MutableGroup,
    normalizedQuery: string,
  ): FormDisplayGroup {
    const hasQueryLemma = normalizedQuery.length > 0 &&
      group.candidates.some(({ paradigm }) =>
        normalizeNorwegian(paradigm.lemma) === normalizedQuery
      );
    const tiered = group.candidates.map(({ form, paradigm }) => {
      const normalizedLemma = normalizeNorwegian(paradigm.lemma);
      const isQueryLemma = hasQueryLemma && normalizedLemma === normalizedQuery;
      const isOfficialCoHeadword = hasQueryLemma && !isQueryLemma;
      const isWrittenVerbVariantGroup = paradigm.dictionaryCode === "bm" &&
        paradigm.pos === "verb" &&
        (form.formKey === "preterite" || form.formKey === "past_participle");
      const hasNonAForSameLemma = group.candidates.some((candidate) =>
        normalizeNorwegian(candidate.paradigm.lemma) === normalizedLemma &&
        !isRegularAEnding(candidate.form.value)
      );
      const isVerbAEndingAlternative = isWrittenVerbVariantGroup &&
        hasNonAForSameLemma && isRegularAEnding(form.value);
      const isNounFeminineVariant = paradigm.dictionaryCode === "bm" &&
        paradigm.pos === "noun" &&
        hasParadigmTag(paradigm, "FEM") &&
        group.candidates.some((candidate) =>
          normalizeNorwegian(candidate.paradigm.lemma) === normalizedLemma &&
          hasParadigmTag(candidate.paradigm, "MASC")
        );
      const evidenceIds: string[] = [BM_WRITTEN_FORM_EVIDENCE.officialSource];

      if (isVerbAEndingAlternative) {
        evidenceIds.push(
          BM_WRITTEN_FORM_EVIDENCE.aEndingGuidance,
          BM_WRITTEN_FORM_EVIDENCE.verbAEndingProductPolicy,
        );
      }
      if (isOfficialCoHeadword) {
        evidenceIds.push(BM_WRITTEN_FORM_EVIDENCE.queryLemmaProductPolicy);
      }
      if (isNounFeminineVariant) {
        evidenceIds.push(BM_WRITTEN_FORM_EVIDENCE.nounGenderProductPolicy);
      }

      return {
        form,
        paradigm,
        evidenceIds,
        isAlternative: isVerbAEndingAlternative || isOfficialCoHeadword ||
          (isQueryLemma && isNounFeminineVariant),
      };
    });
    const unique = deduplicateCandidates(tiered);
    const evidenceIds: string[] = [BM_WRITTEN_FORM_EVIDENCE.officialSource];
    const primary: SelectedSourceForm[] = [];
    const alternatives: SelectedSourceForm[] = [];

    for (
      const { form, paradigm, isAlternative, evidenceIds: formEvidence }
        of unique
    ) {
      const selected: SelectedSourceForm = {
        ...form,
        tier: isAlternative ? "alternative" : "primary",
        paradigmIdentity: paradigm.identity,
        paradigmId: paradigm.paradigmId,
        evidenceIds: formEvidence,
      };

      if (isAlternative) {
        alternatives.push(selected);
        evidenceIds.push(...formEvidence.slice(1));
      } else {
        primary.push(selected);
      }
    }

    primary.sort((left, right) =>
      writtenVariantOrder(left.value) - writtenVariantOrder(right.value) ||
      left.sourceOrdinal - right.sourceOrdinal ||
      left.normalizedValue.localeCompare(right.normalizedValue)
    );
    alternatives.sort((left, right) =>
      alternativeVariantOrder(left) - alternativeVariantOrder(right) ||
      left.sourceOrdinal - right.sourceOrdinal ||
      left.normalizedValue.localeCompare(right.normalizedValue)
    );

    return {
      dictionaryCode: group.dictionaryCode,
      articleId: group.articleId,
      pos: group.pos,
      lemma: hasQueryLemma
        ? group.candidates.find(({ paradigm }) =>
          normalizeNorwegian(paradigm.lemma) === normalizedQuery
        )!.paradigm.lemma
        : group.lemma,
      formKey: group.formKey,
      primary,
      alternatives,
      regularityMarker: combineRegularity(group.regularityMarkers),
      evidenceIds: [...new Set(evidenceIds)],
      policyVersion: group.policyVersion,
    };
  }
}

function deduplicateCandidates(
  candidates: TieredCandidate[],
): TieredCandidate[] {
  const seen = new Set<string>();
  return [...candidates]
    .sort((left, right) =>
      Number(left.isAlternative) - Number(right.isAlternative) ||
      left.form.sourceOrdinal - right.form.sourceOrdinal ||
      left.paradigm.identity.localeCompare(right.paradigm.identity) ||
      left.form.normalizedValue.localeCompare(right.form.normalizedValue)
    )
    .filter(({ form }) => {
      if (seen.has(form.normalizedValue)) return false;
      seen.add(form.normalizedValue);
      return true;
    });
}

function hasParadigmTag(
  paradigm: AuthoritativeParadigm,
  expected: string,
): boolean {
  const normalizedExpected = expected.toUpperCase();
  return paradigm.paradigmTags.some((tag) =>
    tag.trim().toUpperCase() === normalizedExpected
  );
}

function isRegularAEnding(value: string): boolean {
  const normalized = value.normalize("NFC").toLocaleLowerCase("nb-NO").trim();
  // sa/la are short irregular verbs, not regular -a variants.
  return normalized.length > 2 && normalized.endsWith("a");
}

function writtenVariantOrder(value: string): number {
  const normalized = value.normalize("NFC").toLocaleLowerCase("nb-NO").trim();
  if (normalized.endsWith("et")) return 0;
  if (normalized.endsWith("te")) return 1;
  return 2;
}

function alternativeVariantOrder(form: SelectedSourceForm): number {
  const isCoHeadword = form.evidenceIds.includes(
    BM_WRITTEN_FORM_EVIDENCE.queryLemmaProductPolicy,
  );
  const isFeminine = form.evidenceIds.includes(
    BM_WRITTEN_FORM_EVIDENCE.nounGenderProductPolicy,
  );
  if (isFeminine && !isCoHeadword) return 0;
  if (isCoHeadword && !isFeminine) return 1;
  if (isCoHeadword && isFeminine) return 2;
  return 0;
}

function combineRegularity(
  markers: ReadonlySet<RegularityMarker>,
): RegularityMarker {
  if (markers.size === 1) return [...markers][0];
  if (markers.has("suppletive")) return "suppletive";
  if (markers.has("irregular")) return "irregular";
  if (markers.has("regular")) return "regular";
  return "unknown";
}
