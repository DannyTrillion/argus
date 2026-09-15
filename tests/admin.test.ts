import { test } from "node:test";
import assert from "node:assert/strict";
import { adminAllowed } from "../src/services/admin.js";

test("no token configured allows everything (local development)", () => {
  assert.equal(adminAllowed(undefined, null), true);
});

test("a configured token must match exactly", () => {
  const token = "s3cret-token";
  assert.equal(adminAllowed(undefined, token), false);
  assert.equal(adminAllowed("wrong-token!", token), false);
  assert.equal(adminAllowed("short", token), false);
  assert.equal(adminAllowed("s3cret-token", token), true);
});
