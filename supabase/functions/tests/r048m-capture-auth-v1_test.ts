import { authorizeR048MCaptureV1 } from "../_shared/nlp/r048m-capture-auth-v1.ts";

const secret = "R048M-test-secret-with-at-least-32-characters";

Deno.test("R048M: capture disabled by default", async () => {
  const allowed = await authorizeR048MCaptureV1(false, secret, secret);
  if (allowed !== false) throw new Error("Disabled capture was authorized");
});

Deno.test("R048M: missing secret is rejected", async () => {
  const allowed = await authorizeR048MCaptureV1(true, null, secret);
  if (allowed !== false) throw new Error("Missing secret was authorized");
});

Deno.test("R048M: incorrect secret is rejected", async () => {
  const allowed = await authorizeR048MCaptureV1(
    true,
    "incorrect-secret-with-at-least-32-characters",
    secret,
  );
  if (allowed !== false) throw new Error("Incorrect secret was authorized");
});

Deno.test("R048M: valid secret is accepted", async () => {
  const allowed = await authorizeR048MCaptureV1(true, secret, secret);
  if (allowed !== true) throw new Error("Valid secret was rejected");
});

Deno.test("R048M: missing server configuration is rejected", async () => {
  const allowed = await authorizeR048MCaptureV1(true, secret, undefined);
  if (allowed !== false) throw new Error("Missing configuration was authorized");
});
