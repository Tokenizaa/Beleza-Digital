import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverGoogleMapsWithBrowserless } from "../workers/prospecting-scheduler/src/browserless";

test("Browserless discovery refuses to run without a server token", async () => {
  await assert.rejects(
    () => discoverGoogleMapsWithBrowserless({
      token: "",
      searchQuery: "barbearia Porto Alegre - RS",
      limit: 5,
    }),
    /browserless_token_missing/,
  );
});

test("Browserless discovery calls the authenticated Function API and normalizes results", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      data: {
        results: [
          { name: "Barbearia Teste", phone: "+5551999999999" },
          null,
          "invalid",
        ],
        searchQuery: "barbearia Porto Alegre - RS",
        provider: "browserless",
      },
      type: "application/json",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await discoverGoogleMapsWithBrowserless({
      token: "browserless-test-token",
      baseUrl: "https://production-sfo.browserless.io/",
      searchQuery: "barbearia Porto Alegre - RS",
      limit: 5,
    });

    const url = new URL(requestUrl);
    assert.equal(url.pathname, "/function");
    assert.equal(url.searchParams.get("token"), "browserless-test-token");
    assert.equal(requestInit?.method, "POST");
    assert.equal(requestInit?.headers && (requestInit.headers as Record<string, string>)["content-type"], "application/json");

    const body = JSON.parse(String(requestInit?.body)) as {
      code: string;
      context: { searchQuery: string; limit: number };
    };
    assert.match(body.code, /google\.com\/maps\/search/);
    assert.equal(body.context.searchQuery, "barbearia Porto Alegre - RS");
    assert.equal(body.context.limit, 5);
    assert.deepEqual(result.results, [{ name: "Barbearia Teste", phone: "+5551999999999" }]);
    assert.equal(result.provider, "browserless");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Browserless endpoint must use HTTPS", async () => {
  await assert.rejects(
    () => discoverGoogleMapsWithBrowserless({
      token: "browserless-test-token",
      baseUrl: "http://localhost:3000",
      searchQuery: "barbearia Porto Alegre - RS",
      limit: 5,
    }),
    /browserless_endpoint_must_use_https/,
  );
});
