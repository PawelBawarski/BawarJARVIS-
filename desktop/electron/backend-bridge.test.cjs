const test = require("node:test");
const assert = require("node:assert/strict");
const { checkPrivateHealth, PRIVATE_HEALTH_URL } =
  require("./backend-bridge.cjs");

const token = "a".repeat(64);

test("does not call backend without a valid token", async () => {
  let called = false;
  const result = await checkPrivateHealth("short", async () => {
    called = true;
    throw new Error("Must not be called");
  });
  assert.equal(result.status, "unavailable");
  assert.equal(called, false);
});

test("sends token only to fixed localhost endpoint", async () => {
  const result = await checkPrivateHealth(token, async (url, options) => {
    assert.equal(url, PRIVATE_HEALTH_URL);
    assert.equal(options.headers["X-Jarvis-Session"], token);
    assert.equal(options.redirect, "error");
    return {
      status: 200,
      json: async () => ({ status: "AUTHENTICATED" }),
    };
  });
  assert.equal(result.status, "authenticated");
});

test("rejects unauthenticated responses", async () => {
  const result = await checkPrivateHealth(token, async () => ({
    status: 401,
  }));
  assert.equal(result.status, "unavailable");
});
