import type { CanonicalSurfaceDocumentV1 } from "./canonical-surface-boundary-v1.ts";
import type { SqlStructuralCompatibilityMapV1 } from "./sql-structural-compatibility-map-v1.ts";
import {
  assertSqlStructuralCompatibilityMapV1,
  toSqlStructuralRpcTokensV1,
} from "./sql-structural-compatibility-map-v1.ts";

export type CanonicalStructuralRpcCaptureEnvelopeV1 = {
  contract: "canonical-structural-rpc-capture-envelope-v1";
  requestText: string;
  sentenceIndex: number;
  structuralReleaseCode: string;
  surface: CanonicalSurfaceDocumentV1;
  sqlMap: SqlStructuralCompatibilityMapV1;
  rpcTokens: ReturnType<typeof toSqlStructuralRpcTokensV1>;
};

export function buildCanonicalStructuralRpcCaptureEnvelopeV1(
  requestText: string,
  sentenceIndex: number,
  structuralReleaseCode: string,
  surface: CanonicalSurfaceDocumentV1,
  sqlMap: SqlStructuralCompatibilityMapV1,
): CanonicalStructuralRpcCaptureEnvelopeV1 {
  if (typeof requestText !== "string") {
    throw new Error("capture_request_text_invalid");
  }
  if (!Number.isInteger(sentenceIndex) || sentenceIndex < 0) {
    throw new Error("capture_sentence_index_invalid");
  }
  if (typeof structuralReleaseCode !== "string" || structuralReleaseCode.length === 0) {
    throw new Error("capture_structural_release_code_invalid");
  }

  assertSqlStructuralCompatibilityMapV1(surface, sqlMap);
  const rpcTokens = toSqlStructuralRpcTokensV1(sqlMap);

  return {
    contract: "canonical-structural-rpc-capture-envelope-v1",
    requestText,
    sentenceIndex,
    structuralReleaseCode,
    surface,
    sqlMap,
    rpcTokens,
  };
}
