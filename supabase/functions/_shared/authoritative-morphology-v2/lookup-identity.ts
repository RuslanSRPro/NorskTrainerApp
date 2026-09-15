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
