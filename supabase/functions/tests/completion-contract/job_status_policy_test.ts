import assert from "node:assert/strict";
import { test } from "node:test";

import { ownsJob } from "../../_shared/job-status-policy.ts";

test("job status is readable only by its authenticated owner", () => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const foreignUser = "22222222-2222-4222-8222-222222222222";

  assert.equal(ownsJob(owner, owner), true);
  assert.equal(ownsJob(owner, foreignUser), false);
  assert.equal(ownsJob(null, owner), false);
  assert.equal(ownsJob(undefined, owner), false);
  assert.equal(ownsJob(owner, ""), false);
});
