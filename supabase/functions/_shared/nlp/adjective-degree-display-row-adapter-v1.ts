import { attestedAdjectiveEndingStressV1 } from "./adjective-stress-evidence-v1.ts";
import { composeElEnErComparativeV1, type AdjectiveComparativeCompositionV1 } from "./adjective-degree-composition-v1.ts";

export type PositiveDisplayRowV1 = {
  lexeme_id: string;
  snapshot_id: string;
  dictionary_code: string;
  article_id: number;
  pos: string;
  lemma: string;
  form_key: string;
  primary_values: string[];
  article_ids: Array<string | number>;
  evidence_ids: string[];
};

export type DisplayRowDerivationV1 = {
  status: "derived_candidate" | "pending" | "not_applicable";
  reason: string;
  sourceSnapshotId?: string;
  sourceArticleId?: string;
  composition?: AdjectiveComparativeCompositionV1;
};

// Adapts one positive row from lexeme_form_display_v2. Comparative rows are
// rejected before the rule operator is called.
export function deriveComparativeFromPositiveDisplayRowV1(row: PositiveDisplayRowV1): DisplayRowDerivationV1 {
  if (!row || !Array.isArray(row.primary_values) || !Array.isArray(row.article_ids) ||
      !Array.isArray(row.evidence_ids) || row.dictionary_code !== "bm" || row.pos !== "adjective" ||
      row.form_key !== "positive_singular_indefinite_common" || !row.lexeme_id ||
      !row.snapshot_id || !Number.isInteger(row.article_id) ||
      row.primary_values.length !== 1 || row.primary_values[0] !== row.lemma ||
      !row.article_ids.some((articleId) => String(articleId) === String(row.article_id)) ||
      !row.evidence_ids.includes("ordbokene:official-form")) {
    return { status: "not_applicable", reason: "positive_source_identity_not_verified" };
  }
  const sourceArticleId = String(row.article_id);
  const endingStress = attestedAdjectiveEndingStressV1({
    lexemeId: row.lexeme_id, lemma: row.lemma, pos: row.pos,
    ordbokeneArticleId: sourceArticleId,
  });
  const composition = composeElEnErComparativeV1({
    lexemeId: row.lexeme_id, pos: row.pos, positiveCommon: row.primary_values[0],
    positiveSourceId: `ordbokene:official-form:${row.snapshot_id}:${sourceArticleId}`,
    articleIds: row.article_ids.map(String), endingStress,
  });
  return {
    status: composition.status,
    reason: composition.reason,
    sourceSnapshotId: row.snapshot_id,
    sourceArticleId,
    composition,
  };
}
