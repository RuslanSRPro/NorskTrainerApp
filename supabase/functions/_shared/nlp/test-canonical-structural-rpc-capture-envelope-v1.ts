import { assertEquals, assertStrictEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCanonicalSurfaceDocumentV1 } from "./canonical-surface-boundary-v1.ts";
import {
  buildSqlStructuralCompatibilityMapV1,
  toSqlStructuralRpcTokensV1,
} from "./sql-structural-compatibility-map-v1.ts";
import { buildCanonicalStructuralRpcCaptureEnvelopeV1 } from "./canonical-structural-rpc-capture-envelope-v1.ts";

Deno.test("capture envelope preserves canonical surface/sql map identity and exact rpc payload", () => {
  const requestText = "aa bb";
  const surface = buildCanonicalSurfaceDocumentV1(requestText);
  const sqlMap = buildSqlStructuralCompatibilityMapV1(surface, 0);
  const expectedRpcTokens = toSqlStructuralRpcTokensV1(sqlMap);
  const envelope = buildCanonicalStructuralRpcCaptureEnvelopeV1(
    requestText, 0, "runtime-structural-v1.37", surface, sqlMap,
  );
  assertEquals(envelope.contract, "canonical-structural-rpc-capture-envelope-v1");
  assertStrictEquals(envelope.surface, surface);
  assertStrictEquals(envelope.sqlMap, sqlMap);
  assertEquals(envelope.rpcTokens, expectedRpcTokens);
  assertEquals(envelope.requestText, requestText);
  assertEquals(envelope.sentenceIndex, 0);
});

Deno.test("capture envelope fails closed for invalid sentence index", () => {
  const surface = buildCanonicalSurfaceDocumentV1("aa bb");
  const sqlMap = buildSqlStructuralCompatibilityMapV1(surface, 0);
  assertThrows(() => buildCanonicalStructuralRpcCaptureEnvelopeV1(
    "aa bb", -1, "runtime-structural-v1.37", surface, sqlMap,
  ));
});
