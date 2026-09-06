import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, access } from "node:fs/promises";
async function worker() {
  const handlers = {},
    deleted = [],
    assets = [],
    cache = new Map(),
    keys = [
      "mt-v60",
      "mt-v61",
      "max-time-v3-old",
      "two-cats-v4",
      "two-cats-online-v1",
      "unrelated-app",
    ];
  let claimed = false,
    skipped = false;
  const context = {
    URL,
    Promise,
    fetch: async () => {
      throw new Error("offline");
    },
    self: {
      registration: { scope: "https://example.test/Time/" },
      addEventListener: (n, fn) => (handlers[n] = fn),
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
      skipWaiting: () => {
        skipped = true;
      },
    },
    caches: {
      keys: async () => keys,
      delete: async (k) => deleted.push(k),
      open: async () => ({
        addAll: async (paths) => {
          for (const path of paths) {
            await access(new URL("../" + path, import.meta.url));
            assets.push(path);
            cache.set(new URL(path, context.self.registration.scope).href, {
              asset: path,
            });
          }
        },
        match: async (request) =>
          cache.get(
            typeof request === "string"
              ? new URL(request, context.self.registration.scope).href
              : request.url.split("?")[0],
          ),
      }),
    },
  };
  vm.runInNewContext(
    await readFile(new URL("../sw.js", import.meta.url), "utf8"),
    context,
  );
  return {
    handlers,
    deleted,
    assets,
    claimed: () => claimed,
    skipped: () => skipped,
  };
}
test("offline installation caches every native module, entry and local font without a network font dependency", async () => {
  const w = await worker();
  let pending;
  w.handlers.install({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.ok(w.assets.includes("./app/main.mjs"));
  assert.ok(
    w.assets.includes("./app/fonts/manrope-cyrillic-wght-normal.woff2"),
  );
  assert.equal(w.skipped(), false);
  let response;
  w.handlers.fetch({
    request: {
      url: "https://example.test/Time/index-v2.html?installed=1",
      method: "GET",
      mode: "navigate",
    },
    respondWith: (p) => (response = p),
  });
  assert.equal((await response).asset, "./index-v2.html");
  w.handlers.message({ data: { type: "SKIP_WAITING" } });
  assert.equal(w.skipped(), true);
});
test("activation deletes only MAX TIME caches and bypasses the adjacent game", async () => {
  const w = await worker();
  let pending;
  w.handlers.activate({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.deepEqual(w.deleted, ["mt-v60", "mt-v61", "max-time-v3-old"]);
  assert.equal(w.claimed(), true);
  let intercepted = false;
  w.handlers.fetch({
    request: {
      url: "https://example.test/Time/dva-kota/index.html",
      method: "GET",
      mode: "navigate",
    },
    respondWith: () => (intercepted = true),
  });
  assert.equal(intercepted, false);
});
