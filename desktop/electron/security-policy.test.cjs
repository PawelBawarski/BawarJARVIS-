const test = require("node:test");
const assert = require("node:assert/strict");

const { UI_CSP, withUiSecurityHeaders } = require("./security-policy.cjs");

test("CSP should block external scripts", () => {
  assert.match(UI_CSP, /script-src 'self'/);
  assert.match(UI_CSP, /object-src 'none'/);
  assert.match(UI_CSP, /frame-src 'none'/);
});

test("CSP should restrict outgoing connections", () => {
  assert.match(UI_CSP, /connect-src 'self'/);
});

test("should add security headers to UI response", async () => {
  const original = new Response("<html></html>", {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });

  const secured = withUiSecurityHeaders(original);

  assert.equal(secured.status, 200);

  assert.equal(secured.headers.get("Content-Security-Policy"), UI_CSP);

  assert.equal(secured.headers.get("X-Content-Type-Options"), "nosniff");

  assert.equal(secured.headers.get("Content-Type"), "text/html");

  assert.equal(await secured.text(), "<html></html>");
});
