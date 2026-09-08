import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { freshState, normalizeState, totals, clone } from "../app/model.mjs";
import { Store } from "../app/store.mjs";
import {
  MEALS,
  allMeals,
  mealTotals,
  addMeal,
  makeProduct,
  saveRecipe,
} from "../app/nutrition.mjs";
import { createBell } from "../app/audio.mjs";

const date = "2026-09-08";
const drink = {
  id: "drink",
  name: "Test oat drink",
  unit: "ml",
  cal: 60,
  p: 1,
  f: 2,
  c: 10,
};
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
};

test("replacing kefir with a labelled drink changes future meals while preserving logged ingredients", () => {
  const s = freshState(),
    original = MEALS.find((m) => m.id === "shake");
  addMeal(s, original, "2026-09-07");
  const old = clone(s["food_2026-09-07"]);
  s.foods.push(drink);
  saveRecipe(s, {
    id: "shake",
    title: "New shake",
    time: "15:00",
    items: [
      ["whey", "30"],
      ["drink", "250,5"],
    ],
  });
  const meal = allMeals(s).find((m) => m.id === "shake");
  assert.equal(mealTotals(s, meal).cal, 264.3);
  addMeal(s, meal, date);
  assert.equal(totals(s, date).cal, 264.3);
  assert.equal(s["food_" + date][1].unit, "ml");
  assert.deepEqual(s["food_2026-09-07"], old);
  assert.equal(
    s["food_" + date][0].mealEntryId,
    s["food_" + date][1].mealEntryId,
  );
  assert.throws(() => addMeal(s, meal, date), /уже записан/);
});

test("custom recipes survive export, reload and restore; each repeat portion keeps a separate diary group", () => {
  const memory = storage(),
    store = new Store(memory);
  store.load();
  store.commit((s) => {
    s.foods.push(drink);
    saveRecipe(s, {
      id: "my-shake",
      title: "My shake",
      items: [
        ["whey", 30],
        ["drink", 250],
      ],
    });
  });
  const recipe = allMeals(store.state).find((m) => m.id === "my-shake");
  store.commit((s) => {
    addMeal(s, recipe, date);
    addMeal(s, recipe, date);
  });
  const loaded = new Store(memory);
  loaded.load();
  assert.equal(allMeals(loaded.state).length, MEALS.length + 1);
  assert.equal(totals(loaded.state, date).cal, 528);
  assert.notEqual(
    loaded.state["food_" + date][0].mealEntryId,
    loaded.state["food_" + date][2].mealEntryId,
  );
  const imported = new Store(storage());
  imported.load();
  imported.import(loaded.export());
  assert.deepEqual(imported.state.mealRecipes, loaded.state.mealRecipes);
});

test("invalid recipe imports cannot replace the user's existing journal", () => {
  const store = new Store(storage());
  store.load();
  store.commit((s) => (s.profile.height = 178));
  const before = store.raw;
  for (const items of [
    [["missing", 100]],
    [["whey", -5]],
    [
      ["whey", 30],
      ["whey", 10],
    ],
    [],
  ]) {
    const bad = clone(store.state);
    bad.mealRecipes = {
      bad: { id: "bad", title: "Invalid", time: "15:00", items },
    };
    assert.throws(() => store.import(JSON.stringify(bad)));
    assert.equal(store.raw, before);
  }
});

test("3.0 journals gain an empty recipe collection without altering old portion choices", () => {
  const s = freshState();
  delete s.mealRecipes;
  s.mealPortions = { shake: { whey: 45, kefir: 300 } };
  const next = normalizeState(s);
  assert.deepEqual(next.mealRecipes, {});
  assert.equal(
    mealTotals(
      next,
      MEALS.find((m) => m.id === "shake"),
    ).cal,
    291,
  );
  assert.equal(
    makeProduct({
      name: "Drink",
      unit: "ml",
      cal: "60",
      p: "1",
      f: "2",
      c: "10",
    }).unit,
    "ml",
  );
});

function soundHarness(fetchSample = async () => new ArrayBuffer(1)) {
  let time = 0;
  const nodes = [],
    gains = [],
    sample = { original: true };
  const context = {
    currentTime: 0,
    state: "running",
    destination: {},
    decodeAudioData: async () => sample,
    createGain() {
      const events = [],
        gain = {
          value: 0,
          setValueAtTime: (...v) => events.push(["set", ...v]),
          linearRampToValueAtTime: (...v) => events.push(["linear", ...v]),
          exponentialRampToValueAtTime: (...v) => events.push(["exp", ...v]),
        };
      const node = { gain, events, connect() {} };
      gains.push(node);
      return node;
    },
    createOscillator() {
      return createNode("tone");
    },
    createBufferSource() {
      return createNode("gong");
    },
  };
  function createNode(type) {
    const node = {
      type,
      frequency: { value: 0 },
      buffer: null,
      starts: [],
      stops: [],
      connect(target) {
        this.target = target;
      },
      start(at) {
        this.starts.push(at);
      },
      stop(at) {
        this.stops.push(at);
      },
    };
    nodes.push(node);
    return node;
  }
  const bell = createBell({
    makeContext: () => context,
    fetchSample,
    now: () => time,
    vibrate: () => {},
    onError: (e) => {
      throw e;
    },
  });
  return {
    bell,
    nodes,
    gains,
    sample,
    advance(t) {
      time = t;
      context.currentTime = t / 1000;
    },
  };
}
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test("the final gong is byte-for-byte the original recording", async () => {
  const bytes = await readFile(
    new URL("../app/audio/original-gong.mp3", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "25b83293cc1c7f2e7f6d771f8f2a0a866384d54e68ddf529b2ebe9135b77245e",
  );
});

test("timer plays the old rising ten-second countdown then the original gong exactly once", async () => {
  const h = soundHarness(),
    snapshot = { deadline: 20000, left: 20, seconds: 20 };
  h.bell.sync(snapshot);
  await settle();
  const tones = h.nodes.filter((n) => n.type === "tone"),
    gongs = h.nodes.filter((n) => n.type === "gong");
  assert.equal(tones.length, 40);
  assert.deepEqual(
    tones.slice(0, 4).map((n) => n.frequency.value),
    [1050, 2100, 3150, 525],
  );
  for (let i = 0; i < 10; i++) {
    assert.equal(tones[i * 4].starts[0], 10 + i);
    assert.deepEqual(tones[i * 4].target.events[1], [
      "linear",
      0.35 * (0.25 + (i / 9) * 0.75),
      10 + i + 0.003,
    ]);
  }
  assert.equal(gongs.length, 1);
  assert.deepEqual(gongs[0].starts, [20]);
  assert.equal(gongs[0].buffer, h.sample);
  assert.equal(gongs[0].target.gain.value, 0.8);
  h.advance(19000);
  h.bell.sync({ ...snapshot, left: 1 });
  await settle();
  h.advance(20000);
  h.bell.ring();
  await settle();
  assert.equal(h.nodes.length, 41);
});

test("adjusting or stopping a timer cancels scheduled sounds; pending audio loading cannot ring after stop", async () => {
  const h = soundHarness();
  h.bell.sync({ deadline: 20000 });
  await settle();
  const first = [...h.nodes];
  h.advance(5000);
  h.bell.sync({ deadline: 35000 });
  await settle();
  assert.ok(first.every((n) => n.stops.includes(undefined)));
  assert.equal(h.nodes.filter((n) => n.type === "gong").at(-1).starts[0], 35);
  h.bell.stop();
  assert.ok(h.nodes.every((n) => n.stops.includes(undefined)));
  let release;
  const pending = soundHarness(() => new Promise((r) => (release = r)));
  pending.bell.sync({ deadline: 20000 });
  pending.bell.stop();
  release(new ArrayBuffer(1));
  await settle();
  assert.equal(pending.nodes.length, 0);
});
