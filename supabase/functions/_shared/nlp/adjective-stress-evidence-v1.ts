// Curated source attestations only. This producer never reads a degree form.
// NAOB's acute/grave mark follows the stressed vowel (https://naob.no/uttale-veiledning).
export type AdjectiveStressInputV1 = {
  lexemeId: string;
  lemma: string;
  pos: string;
  sourceUrl: string;
  pronunciation: string;
};

const attestations = [
  { lexemeId: "81a6cba3-26d1-4bf1-9cb3-41997911dd50", lemma: "åpen", pos: "adjective",
    sourceUrl: "https://naob.no/ordbok/%C3%A5pen", pronunciation: "[å:`p(ə)n]" },
  { lexemeId: "41a02dd7-544a-43cf-b186-61275a4d39d9", lemma: "sikker", pos: "adjective",
    sourceUrl: "https://naob.no/ordbok/sikker", pronunciation: "[si´k:ər]" },
] as const;

export function produceAdjectiveEndingStressV1(input: AdjectiveStressInputV1):
  { value: "unstressed"; evidenceId: string } | undefined {
  const exact = attestations.find((entry) => entry.lexemeId === input.lexemeId &&
    entry.lemma === input.lemma && entry.pos === input.pos &&
    entry.sourceUrl === input.sourceUrl && entry.pronunciation === input.pronunciation);
  if (!exact) return undefined;
  const notation = input.pronunciation.slice(1, -1);
  const accents = [...notation.matchAll(/[´`]/gu)];
  if (accents.length !== 1) return undefined;
  // All curated words have two syllables. The sole main-stress marker must
  // precede the reduced vowel of the final syllable.
  const unstressedTail = notation.slice((accents[0].index ?? 0) + 1);
  if (!/ə/u.test(unstressedTail)) return undefined;
  return { value: "unstressed", evidenceId: `naob:pronunciation:${input.lexemeId}:${input.sourceUrl}` };
}
