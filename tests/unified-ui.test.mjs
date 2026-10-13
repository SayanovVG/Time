import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshState, VERSION } from "../app/model.mjs";
import { foodPicker, foodResults, header } from "../app/view.mjs";

const text = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("nutrition picker uses one consistent search and grouped results", () => {
  const s = freshState(), picker = { date: "2026-10-13", query: "", added: 0, lastIds: [] };
  const flow = foodPicker(s, picker);
  assert.match(flow, /id="food-search"/);
  assert.match(flow, /data-action="custom-product"/);
  assert.match(flow, /data-action="online-search"/);
  assert.match(flow, /class="picker-footer"/);
  assert.match(flow, /data-action="close-dialog"/);
  assert.doesNotMatch(flow, /data-action="food-tab"/);
  const results = foodResults(s, picker);
  assert.match(results, /Сохранённые блюда/);
  assert.match(results, /Все продукты/);
  assert.match(results, /picker-more/);
  assert.match(results, /data-action="choose-food"/);
  const filtered = foodResults(s, { ...picker, query: "овсянка" });
  assert.match(filtered, /Продукты/);
  assert.match(filtered, /Овсянка/);
  assert.doesNotMatch(filtered, /Все продукты/);
});

test("visual design is loaded identically in both PWA entries", () => {
  const a = text("index.html"), b = text("index-v2.html");
  assert.equal(a, b);
  assert.match(a, /\.\/app\/design\.css/);
  assert.match(a, /id="mt-intro"/);
  assert.match(a, /<strong>MAX TIME<\/strong>/);
  assert.match(a, /<img src="\.\/icon\.svg"/);
  assert.doesNotMatch(a, /id="iibrain-intro"|class="ii-mark"/);
  const styles = text("app/design.css");
  assert.match(styles, /font-family: Manrope/);
  assert.match(styles, /\.picker-section/);
  assert.match(styles, /\.picker-footer/);
  assert.match(styles, /\.strength-comparison/);
  assert.match(header({tab:"nutrition"}), /<img src="\.\/icon\.svg"/);
});

test("PWA icon replacements preserve storage identity and audio assets", () => {
  const manifest = JSON.parse(text("manifest.json")), sw = text("sw.js");
  assert.equal(VERSION, "3.3.0");
  assert.equal(manifest.id, "./index.html");
  assert.equal(manifest.start_url, "./index.html");
  assert.ok(manifest.icons.some((x) => x.src === "./icons/max-time-192-20261013.png"));
  assert.ok(manifest.icons.some((x) => x.src === "./icons/max-time-512-20261013.png"));
  assert.match(sw, /app\/design\.css/);
  assert.match(sw, /max-time-192-20261013\.png/);
  assert.match(sw, /max-time-512-20261013\.png/);
  assert.match(sw, /app\/audio\/original-gong\.mp3/);
  assert.match(sw, /app\/audio\.mjs/);
});
