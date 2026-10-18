/** R048M: request opt-in is never sufficient authorization. */
export async function authorizeR048MCaptureV1(
  requested: boolean,
  provided: string | null,
  configured: string | undefined,
): Promise<boolean> {
  if (!requested) return false;
  if (!configured || configured.length < 32 || !provided || provided.length !== configured.length) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(configured)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
