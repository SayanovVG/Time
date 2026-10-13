import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
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

test("both newly installed Android icons are valid PNGs with decoded pixel payloads", () => {
  for (const size of [192, 512]) {
    const png = readFileSync(new URL(`../icons/max-time-${size}-20261013.png`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    let off = 8, idat = [], width, height;
    while (off < png.length) {
      const len = png.readUInt32BE(off);
      const type = png.toString("ascii", off + 4, off + 8);
      const body = png.subarray(off + 8, off + 8 + len);
      if (type === "IHDR") {
        width = body.readUInt32BE(0);
        height = body.readUInt32BE(4);
        assert.equal(body[8], 8);
        assert.equal(body[9], 6);
      }
      if (type === "IDAT") idat.push(body);
      off += 12 + len;
      if (type === "IEND") break;
    }
    assert.equal(width, size);
    assert.equal(height, size);
    const pixels = inflateSync(Buffer.concat(idat));
    assert.equal(pixels.length, (size * 4 + 1) * size);
    for (let y = 0; y < size; y++) assert.equal(pixels[y * (size * 4 + 1)], 0);
  }
});
