/** R048B: in-memory evidence only; never expose this object through a public response. */
export type StructuralRpcPairedEvidenceV1<TInput, TOutput> = {
  contract: "canonical-structural-rpc-paired-evidence-v1";
  captureId: string;
  input: TInput;
  output: TOutput;
};

export function buildStructuralRpcPairedEvidenceV1<TInput, TOutput>(
  captureId: string,
  input: TInput,
  output: TOutput,
): StructuralRpcPairedEvidenceV1<TInput, TOutput> {
  if (typeof captureId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(captureId)) {
    throw new Error("paired_capture_id_invalid");
  }
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("paired_capture_input_invalid");
  }
  if (output === null || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("paired_capture_output_invalid");
  }
  return {
    contract: "canonical-structural-rpc-paired-evidence-v1",
    captureId,
    input,
    output,
  };
}