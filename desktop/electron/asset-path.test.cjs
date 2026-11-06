const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { resolveUiAsset } = require("../electron/asset-path.cjs");

const root = path.resolve("example-ui");

test("should resolve application index", () => {
  const result = resolveUiAsset(root, "jarvis://app/");

  assert.equal(result, path.join(root, "index.html"));
});

test("should resolve Polish translations", () => {
  const result = resolveUiAsset(root, "jarvis://app/i18n/pl.json");

  assert.equal(result, path.join(root, "i18n", "pl.json"));
});

test("should reject unknown hosts", () => {
  const result = resolveUiAsset(root, "jarvis://unknown/index.html");

  assert.equal(result, null);
});

test("should reject directory traversal", () => {
  const result = resolveUiAsset(root, "jarvis://app/%2F..%2Fsecret.txt");

  assert.equal(result, null);
});

test("should reject other protocols", () => {
  const result = resolveUiAsset(root, "file:///C:/Windows/system.ini");

  assert.equal(result, null);
});
