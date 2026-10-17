import {
  isCanonicalStructuralRpcInputCaptureEnabledV1,
  projectCanonicalStructuralRpcInputCaptureResponseV1,
} from "./canonical-structural-rpc-capture-control-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("structural RPC capture control is strict opt-in", () => {
  assert(!isCanonicalStructuralRpcInputCaptureEnabledV1(undefined), "undefined must be disabled");
  assert(!isCanonicalStructuralRpcInputCaptureEnabledV1({}), "absent must be disabled");
  assert(!isCanonicalStructuralRpcInputCaptureEnabledV1({ captureStructuralRpcInput: false }), "false must be disabled");
  assert(!isCanonicalStructuralRpcInputCaptureEnabledV1({ captureStructuralRpcInput: 1 }), "truthy non-boolean must be disabled");
  assert(!isCanonicalStructuralRpcInputCaptureEnabledV1({ captureStructuralRpcInput: "true" }), "string true must be disabled");
  assert(isCanonicalStructuralRpcInputCaptureEnabledV1({ captureStructuralRpcInput: true }), "literal true must be enabled");
});

Deno.test("disabled capture response projection is empty", () => {
  const captures = [{ sentenceIndex: 0 }];
  const projection = projectCanonicalStructuralRpcInputCaptureResponseV1(false, captures);
  assert(Object.keys(projection).length === 0, "disabled projection must add no response field");
  assert(!("structural_rpc_input_capture" in projection), "disabled projection must omit capture field");
});

Deno.test("enabled capture response projection preserves capture array identity", () => {
  const captures = [{ sentenceIndex: 0 }];
  const projection = projectCanonicalStructuralRpcInputCaptureResponseV1(true, captures);
  assert("structural_rpc_input_capture" in projection, "enabled projection must expose capture field");
  assert(projection.structural_rpc_input_capture === captures, "capture array identity must be preserved");
});
