import type {
  AuthoritativeParadigm,
  FormDisplayGroup,
  FormSelectionPolicy,
  RegularityMarker,
  SelectedSourceForm,
  SourceForm,
} from "./types.ts";

export const BM_WRITTEN_FORM_EVIDENCE = {
  officialSource: "ordbokene:official-form",
  aEndingGuidance: "sprakradet:a-endelser-i-bokmal:2025-05-07",
  productPolicy: "product-policy:bm-written-verb-a-alternative-v1",
} as const;

type MutableGroup =
  & Omit<
    FormDisplayGroup,
    "primary" | "alternatives" | "evidenceIds" | "regularityMarker"
  >
  & {
    candidates: Array<{
      form: SourceForm;
      paradigm: AuthoritativeParadigm;
    }>;
    regularityMarkers: Set<RegularityMarker>;
  };

/**
 * Display-only policy for Bokmål written learning cards.
 *
 * The policy never creates or removes an Ordbøkene form. It only assigns
 * official source forms to primary/alternative display tiers. Competing
 * -et/-te written variants remain co-primary; an official -a preterite or
 * past participle becomes an alternative only when a non--a variant exists
 * in the same Ordbøkene article/POS/form group.
 */
export class BokmalWrittenFormSelectionPolicy implements FormSelectionPolicy {
  readonly policyVersion = "bokmal-written-display/v1";

  select(paradigms: readonly AuthoritativeParadigm[]): FormDisplayGroup[] {
    const groups = new Map<string, MutableGroup>();

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

    return [...groups.values()].map((group) => this.#finalize(group)).sort(
      (left, right) =>
        [left.dictionaryCode, left.articleId, left.pos, left.formKey].join("|")
          .localeCompare(
            [right.dictionaryCode, right.articleId, right.pos, right.formKey]
              .join("|"),
          ),
    );
  }

  #finalize(group: MutableGroup): FormDisplayGroup {
    const unique = deduplicateCandidates(group.candidates);
    const hasNonAAlternative = unique.some(({ form }) =>
      !isRegularAEnding(form.value)
    );
    const evidenceIds: string[] = [BM_WRITTEN_FORM_EVIDENCE.officialSource];
    const primary: SelectedSourceForm[] = [];
    const alternatives: SelectedSourceForm[] = [];

    for (const { form, paradigm } of unique) {
      const isWrittenVerbVariantGroup = paradigm.dictionaryCode === "bm" &&
        paradigm.pos === "verb" &&
        (form.formKey === "preterite" || form.formKey === "past_participle");
      const isAlternative = isWrittenVerbVariantGroup &&
        hasNonAAlternative && isRegularAEnding(form.value);
      const formEvidence = isAlternative
        ? [
          BM_WRITTEN_FORM_EVIDENCE.officialSource,
          BM_WRITTEN_FORM_EVIDENCE.aEndingGuidance,
          BM_WRITTEN_FORM_EVIDENCE.productPolicy,
        ]
        : [BM_WRITTEN_FORM_EVIDENCE.officialSource];
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
      left.sourceOrdinal - right.sourceOrdinal ||
      left.normalizedValue.localeCompare(right.normalizedValue)
    );

    return {
      dictionaryCode: group.dictionaryCode,
      articleId: group.articleId,
      pos: group.pos,
      lemma: group.lemma,
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
  candidates: MutableGroup["candidates"],
): MutableGroup["candidates"] {
  const seen = new Set<string>();
  return [...candidates]
    .sort((left, right) =>
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

function combineRegularity(
  markers: ReadonlySet<RegularityMarker>,
): RegularityMarker {
  if (markers.size === 1) return [...markers][0];
  if (markers.has("suppletive")) return "suppletive";
  if (markers.has("irregular")) return "irregular";
  if (markers.has("regular")) return "regular";
  return "unknown";
}
