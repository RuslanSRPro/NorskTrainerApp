export type CanonicalStructuralRpcCaptureResponseV1<T> = {
  structural_rpc_input_capture: T[];
};

export function isCanonicalStructuralRpcInputCaptureEnabledV1(
  body: unknown,
): boolean {
  return !!body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).captureStructuralRpcInput === true;
}

export function projectCanonicalStructuralRpcInputCaptureResponseV1<T>(
  enabled: boolean,
  captures: T[],
): {} | CanonicalStructuralRpcCaptureResponseV1<T> {
  return enabled ? { structural_rpc_input_capture: captures } : {};
}
