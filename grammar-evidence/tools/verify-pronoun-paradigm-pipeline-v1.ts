import {
  generatePronounCaseFormV1,
  producePronounCaseCandidatesV1,
  pronounParadigmManifestV1,
  pronounCaseSelectionManifestV1,
  withPronounCaseCandidatesV1,
} from "../../supabase/functions/_shared/nlp/pronoun-paradigm-operator-v1.ts";

let checks = 0;
function check(condition: boolean, message: string) {
  checks++;
  if (!condition) throw new Error(message);
}

const corpus = [
  { text: "Jeg ser meg", expected: ["Nom", "Acc"] },
  { text: "Meg ser han", expected: ["Acc", "Nom"] },
  { text: "Det har jeg", expected: ["Nom,Acc", "Nom"] },
  { text: "Den ser det", expected: ["Nom,Acc", "Nom,Acc"] },
  { text: "Hunden ser meg", expected: ["", "Acc"] },
];

check(pronounParadigmManifestV1.operator === "morphological_paradigm", "operator code");
check(pronounParadigmManifestV1.sourceCandidateId === "d99c8781-1212-45ed-a490-df7cfa105ede", "source identity");
check(pronounCaseSelectionManifestV1.ruleStrength === "default_with_exceptions", "case selection is not a hard filter");
check(String(pronounCaseSelectionManifestV1.sourceCandidateId) !== String(pronounParadigmManifestV1.sourceCandidateId), "separate source contracts");
for (const item of corpus) {
  const tokens = withPronounCaseCandidatesV1(item.text.split(" ").filter((_, index) => index !== 1).map((surface, index) => ({ surface, token_index: index ? 3 : 1 })));
  check(tokens.map((token) => token.pronoun_case_candidates_v1.map((reading) => reading.Case).join(",")).join("|") === item.expected.join("|"), `case readings: ${item.text}`);
  check(tokens.every((token) => token.pronoun_case_candidates_v1.every((reading) => reading.status === "candidate" && reading.exhaustive === false)), `candidate only: ${item.text}`);
  check(tokens[0].token_index === 1 && tokens[1].token_index === 3, `identity: ${item.text}`);
}
for (const [lemma, acc] of pronounParadigmManifestV1.pairs) {
  check(generatePronounCaseFormV1(lemma, "Nom") === lemma, `generate nom: ${lemma}`);
  check(generatePronounCaseFormV1(lemma, "Acc") === acc, `generate acc: ${lemma}`);
  check(producePronounCaseCandidatesV1(acc).some((reading) => reading.lemma === lemma && reading.Case === "Acc"), `recognize acc: ${lemma}`);
}
check(generatePronounCaseFormV1("unknown", "Nom") === null, "unknown lemma must not fabricate form");
console.log(JSON.stringify({ status: "PASS", cases: corpus.length, checks }));
