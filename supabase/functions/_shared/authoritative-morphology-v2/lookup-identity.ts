export type LexemeDictionaryIdentity = {
  lemma: string;
  display_form?: string | null;
};

/**
 * Returns the canonical dictionary identity used for persisted morphology.
 * display_form is presentation-only and must never affect Ordbøkene lookup.
 */
export function lexemeDictionaryLookupQuery(
  lexeme: LexemeDictionaryIdentity,
): string {
  const lemma = lexeme.lemma.trim();
  if (!lemma) throw new Error("LEXEME_LEMMA_REQUIRED");
  return lemma;
}
export type AuthoritativeLookupParadigm = {
  lemma: string;
  forms: readonly {
    value: string;
    normalizedValue?: string;
  }[];
};

/** Accept a canonical lemma or an official form from that same paradigm. */
export function isAuthoritativeLookupForm(
  query: string,
  paradigms: readonly AuthoritativeLookupParadigm[],
  normalize: (value: string) => string,
): boolean {
  const normalizedQuery = normalize(query);
  return paradigms.some((paradigm) =>
    normalize(paradigm.lemma) === normalizedQuery ||
    paradigm.forms.some((form) =>
      (form.normalizedValue || normalize(form.value)) === normalizedQuery
    )
  );
}