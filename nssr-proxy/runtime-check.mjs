import assert from "node:assert/strict";
import { Miniflare, Response, convertV4MiniflareOptions } from "miniflare";

// Run the actual entrypoint in workerd; Node's fetch accepts redirect modes
// that Workers rejects. All outbound traffic is intercepted with a fake key.
let redirect = false;
let calls = 0;
const runtime = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  scriptPath: new URL("./index.mjs", import.meta.url).pathname,
  compatibilityDate: "2026-11-09",
  bindings: { TEAMUP_API_KEY: "synthetic-runtime-key" },
  outboundService(request) {
    calls++;
    assert.equal(new URL(request.url).hostname, "api.teamupgg.com");
    assert.equal(request.headers.get("X-API-Key"), "synthetic-runtime-key");
    return redirect
      ? new Response(null, { status: 302, headers: { Location: "https://other.example" } })
      : Response.json({ entries: [{ player_id: "1" }] });
  }
}));
try {
  const path = "http://localhost/v1/client/DISCORD%7C1550493522451234847/rankings?leaderboard=season-1&limit=";
  const response = await runtime.dispatchFetch(`${path}250`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-API-Key"), null);
  assert.equal((await response.json()).entries.length, 1);
  redirect = true;
  const rejected = await runtime.dispatchFetch(`${path}249`);
  assert.equal(rejected.status, 502);
  await rejected.text();
  assert.equal(calls, 2, "The proxy must not follow an upstream redirect");
  console.log("Worker runtime check passed: authenticated reads succeed; redirects are rejected.");
} finally {
  await runtime.dispose();
}
