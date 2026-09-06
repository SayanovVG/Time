import { readFile, access, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const active = (await readdir("app"))
  .filter((p) => p.endsWith(".mjs"))
  .map((p) => "app/" + p);
for (const file of [
  ...active,
  "sw.js",
  "dva-kota/sw.js",
  "dva-kota/v5/sw.js",
  "dva-kota/v6/sw.js",
])
  execFileSync(process.execPath, ["--check", file]);
const first = await readFile("index.html", "utf8"),
  second = await readFile("index-v2.html", "utf8");
assert.equal(
  first,
  second,
  "Both installed and direct links must load the same app",
);
assert.doesNotMatch(first, /maximum-scale|user-scalable=no|app-v2\.js/);
for (const file of [...active, "app/app.css", "sw.js", "manifest.json"]) {
  const text = await readFile(file, "utf8");
  const paths = [
    ...text.matchAll(/(?:from\s*['"]|url\(['"]?)(\.{1,2}\/[^'";)]+)/g),
  ].map((m) => m[1]);
  const { resolve, dirname } = await import("node:path");
  for (const path of paths) await access(resolve(dirname(file), path));
}
const sw = await readFile("sw.js", "utf8");
for (const m of sw.matchAll(/['"](\.\/[^'"]+)['"]/g)) {
  if (m[1] === "./") continue;
  await access(m[1]);
}
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
for (const icon of manifest.icons) await access(icon.src);
assert.equal(manifest.id, "./index.html");
assert.equal(manifest.start_url, "./index.html");
console.log(
  "Syntax, native module imports, both entries, offline assets and PWA identity: OK",
);
