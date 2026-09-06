import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  normalizeState,
  clone,
  number,
  addFood,
  totals,
  nutritionDays,
  analytics,
  report,
  validSet,
  exerciseById,
  selectedDate,
  inPeriod,
  measureSeries,
  movingAverage,
  setMetric,
  rowsFor,
  trainingSessions,
} from "../app/model.mjs";
import { MEALS, mealTotals, addMeal, makeProduct } from "../app/nutrition.mjs";
import { Store, MAIN, LEGACY, BACKUPS } from "../app/store.mjs";
import { WorkoutTimer } from "../app/timer.mjs";
import { training, nutrition, progress, esc } from "../app/view.mjs";
import { setInput } from "../app/model.mjs";
import { readFile } from "node:fs/promises";

class MemoryStorage {
  map = new Map();
  fail = null;
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    if (this.fail?.(k, v)) throw new Error("QuotaExceeded");
    this.map.set(k, String(v));
  }
}
const date = "2026-09-04",
  row = (load = 20, reps = 10) => ({ load, reps, rir: 2, done: true });
const setup = () => {
  const storage = new MemoryStorage(),
    store = new Store(storage, { now: () => 1788600000000 });
  store.load();
  return { storage, store };
};
test("plain legacy export loads without overwriting its raw source or inventing measurements", () => {
  const { storage, store } = setup(),
    legacy = {
      profile: { height: 178 },
      train: { "2026-08-31_bench": [row()] },
      customFlag: "keep",
    };
  storage.setItem(LEGACY, JSON.stringify(legacy));
  store.load();
  store.commit((s) => (s.profile.height = 179));
  assert.equal(storage.getItem(LEGACY), JSON.stringify(legacy));
  assert.equal(store.state.customFlag, "keep");
  assert.deepEqual(store.state.measurements, []);
  assert.equal(new Store(storage).load().profile.height, 179);
});
test("malformed imports are rejected before any storage or state change", () => {
  const { storage, store } = setup();
  store.commit((s) => addFood(s, "egg", 2, date));
  const before = [store.export(), [...storage.map]];
  for (const raw of [
    "null",
    "[]",
    "{",
    JSON.stringify({ profile: {}, train: null }),
    JSON.stringify({
      ...freshState(),
      measurements: [{ date: "2026-02-30", weight: 82 }],
    }),
    JSON.stringify({
      ...freshState(),
      foods: [{ id: "x", name: "bad", cal: -1, p: 0, f: 0, c: 0 }],
    }),
    ' {"profile":{},"train":{},"__proto__":{}}',
  ]) {
    assert.throws(() => store.import(raw));
    assert.equal(store.export(), before[0]);
    assert.deepEqual([...storage.map], before[1]);
  }
});
test("import and restore keep complete prior states, including food, supplements and same-length edits", () => {
  const { storage, store } = setup();
  store.commit((s) => {
    s.train[date + "_bench"] = [row(20)];
    addFood(s, "egg", 2, date);
    s["supplements_" + date] = { omega: true };
  });
  const first = clone(store.state);
  store.commit((s) => (s.train[date + "_bench"][0].load = 30));
  assert.deepEqual(store.snapshots().at(-1).state, first);
  const before = clone(store.state);
  store.import(JSON.stringify({ ...freshState(), profile: { height: 180 } }));
  assert.deepEqual(store.snapshots().at(-1).state, before);
  store.restore(store.snapshots().at(-1).id);
  assert.deepEqual(store.state, before);
  assert.deepEqual(new Store(storage).load(), before);
});
test("a quota error on main write rolls back the entire mutation", () => {
  const { storage, store } = setup();
  store.commit((s) => (s.profile.height = 178));
  const before = store.export(),
    raw = storage.getItem(MAIN);
  storage.fail = (k) => k === MAIN;
  assert.throws(
    () => store.commit((s) => (s.profile.height = 179)),
    /Изменение отменено/,
  );
  assert.equal(store.export(), before);
  assert.equal(storage.getItem(MAIN), raw);
});
test("failed auto copy warns while preserving the successfully saved journal", () => {
  const { storage, store } = setup();
  storage.fail = (k) => k === BACKUPS;
  store.commit((s) => (s.profile.height = 179));
  assert.match(store.warning, /автокопии/);
  assert.equal(new Store(storage).load().profile.height, 179);
});
test("failed protective copy prevents replacement during import", () => {
  const { storage, store } = setup();
  store.commit((s) => (s.profile.height = 178));
  storage.fail = (k) => k === BACKUPS;
  const raw = storage.getItem(MAIN);
  assert.throws(
    () =>
      store.import(
        JSON.stringify({ ...freshState(), profile: { height: 190 } }),
      ),
    /безопасного/,
  );
  assert.equal(storage.getItem(MAIN), raw);
  assert.equal(store.state.profile.height, 178);
});
test("simultaneous tabs cannot overwrite each other silently", () => {
  const { storage, store } = setup(),
    second = new Store(storage);
  second.load();
  store.commit((s) => (s.profile.height = 178));
  assert.throws(
    () => second.commit((s) => (s.profile.height = 190)),
    /другой вкладке/,
  );
  assert.equal(new Store(storage).load().profile.height, 178);
});
test("damaged saved data remains recoverable after unsuccessful recovery", () => {
  const storage = new MemoryStorage();
  storage.setItem(MAIN, '{"broken":true}');
  const store = new Store(storage);
  assert.throws(() => store.load());
  storage.fail = (k) => k === BACKUPS;
  assert.throws(() =>
    store.import(JSON.stringify({ ...freshState(), profile: { height: 178 } })),
  );
  assert.equal(store.recoveryRaw, '{"broken":true}');
  assert.equal(storage.getItem(MAIN), '{"broken":true}');
  storage.fail = null;
  store.import(JSON.stringify({ ...freshState(), profile: { height: 178 } }));
  assert.equal(new Store(storage).load().profile.height, 178);
  assert.equal(
    storage.getItem("max_time_recovery_source_v3"),
    '{"broken":true}',
  );
});
test("numeric input accepts commas but rejects negative food amounts and partial parsing", () => {
  assert.equal(number("82,5"), 82.5);
  assert.equal(number("20kg"), null);
  assert.equal(number("1e3"), null);
  assert.equal(number(""), null);
  const s = freshState();
  addFood(s, "oats", "50,5", date);
  assert.equal(s["food_" + date][0].g, 50.5);
  for (const value of [-1, 0, "10junk"])
    assert.throws(() => addFood(s, "egg", value, date));
  assert.throws(() => makeProduct({ name: "a", cal: "-2", p: 0, f: 0, c: 0 }));
});
test("eggs are per piece and meal totals derive from editable quantities", () => {
  const s = freshState();
  addFood(s, "egg", 3, date);
  assert.equal(totals(s, date).cal, 240);
  assert.equal(s["food_" + date][0].unit, "piece");
  const meal = MEALS.find((m) => m.id === "breakfast");
  assert.equal(mealTotals(s, meal).cal, 460);
  s.mealPortions = { breakfast: { egg: 2, buck: 100 } };
  assert.equal(mealTotals(s, meal).cal, 270);
  addMeal(s, meal, date);
  assert.equal(totals(s, date).cal, 510);
  assert.throws(() => addMeal(s, meal, date), /уже записан/);
});
test("old planned meals retain their recorded totals and prevent duplicate new template additions", () => {
  const s = normalizeState({
    train: {},
    profile: {},
    ["food_" + date]: [
      {
        id: 1,
        name: "Завтрак",
        g: 1,
        cal: 450,
        p: 30,
        f: 15,
        c: 48.75,
        planId: "plan_v55_" + date + "_breakfast",
      },
    ],
  });
  assert.equal(totals(s, date).cal, 450);
  assert.equal(s["food_" + date][0].unit, "portion");
  assert.throws(() => addMeal(s, MEALS[1], date));
});
test("reports derive meals from diary, do not use stale summary or include future/empty days", () => {
  const s = freshState();
  addFood(s, "egg", 3, date);
  s.dailySummary[date] = { cal: 0 };
  s.dailySummary["2026-09-03"] = { cal: 0 };
  addFood(s, "egg", 10, "2026-09-07");
  assert.equal(nutritionDays(s, 7, date).length, 1);
  assert.equal(nutritionDays(s, 7, date)[0].cal, 240);
  assert.equal(analytics(s, 7, date).completed.length, 0);
  s.foodDays[date] = { complete: true };
  assert.equal(analytics(s, 7, date).completed[0].cal, 240);
  assert.match(report(s, 7, date), /Среднее по завершённым дням: 240/);
  assert.doesNotMatch(report(s, 7, date), /2026-09-07/);
});
test("correcting or adding food opens a completed day for review", () => {
  const s = freshState();
  s.foodDays[date] = { complete: true };
  addFood(s, "egg", 1, date);
  assert.equal(s.foodDays[date].complete, false);
});
test("period bounds are inclusive and follow calendar dates across month and year boundaries", () => {
  assert.equal(selectedDate(1, "2026-01-01"), "2025-12-29");
  assert.equal(selectedDate(5, "2026-09-07"), "2026-09-11");
  assert.equal(inPeriod("2026-08-29", 7, date), true);
  assert.equal(inPeriod("2026-08-28", 7, date), false);
  assert.equal(inPeriod("2026-09-05", 7, date), false);
});
test("RIR 3 and 3+ both render as 3+, never zero; empty and fractional completed rows do not count", () => {
  const ex = exerciseById("bench"),
    s = normalizeState({
      profile: {},
      train: {
        [date + "_bench"]: [
          { ...row(), rir: "3+" },
          { ...row(), rir: "3" },
          row("", ""),
          row(20, 2.5),
        ],
      },
    });
  assert.equal(s.train[date + "_bench"][0].rir, 3);
  assert.equal(validSet(ex, row("", "")), false);
  assert.equal(validSet(ex, row(20, 2.5)), false);
  assert.equal(trainingSessions(s, 7, date)[0].sets, 2);
  const html = training(s, { day: 1, date, focus: false, editPast: false });
  assert.match(html, /<option value="3" selected>3\+/);
  assert.match(html, /class="set-check checked"/);
  assert.match(html, /aria-pressed="true" disabled/);
});
test("suspected copied legacy sessions are counted once and originals remain stored", () => {
  const s = normalizeState({
    profile: {},
    train: { "2026-09-01_bench": [row()], "2026-08-31_bench": [row()] },
  });
  assert.equal(Object.keys(s.train).length, 2);
  assert.equal(trainingSessions(s, 7, date).length, 1);
  const changed = normalizeState({
    profile: {},
    train: { "2026-09-01_bench": [row(30)], "2026-08-31_bench": [row()] },
  });
  assert.equal(trainingSessions(changed, 7, date).length, 2);
});
test("automatic legacy 84/100 pair needs confirmation and moving average uses 7 calendar days", () => {
  const s = normalizeState({
    profile: {},
    train: {},
    measurements: [
      { date: "2026-08-01", weight: 84, waist: 100 },
      { date: "2026-09-01", weight: 82 },
      { date: "2026-09-04", weight: 80 },
    ],
  });
  assert.equal(s.measurements[0].needsConfirmation, true);
  assert.equal(measureSeries(s, "weight", 365, date).length, 2);
  assert.equal(
    movingAverage([
      { date: "2026-08-01", value: 90 },
      { date: "2026-09-01", value: 82 },
      { date: "2026-09-04", value: 80 },
    ]).at(-1).value,
    81,
  );
  setMetric(s, "weight", "81,5", date);
  assert.equal(s.measurements.length, 3);
  assert.equal(s.measurements.at(-1).weight, 81.5);
});
test("wall-clock timer ends once after suspended callbacks and preserves separate duration metadata", () => {
  let now = 0,
    ended = 0,
    last;
  const timer = new WorkoutTimer({
    now: () => now,
    onEnd: (r) => {
      ended++;
      last = r;
    },
  });
  timer.start(60, { mode: "exercise", exId: "plank", date, index: 1 });
  now = 18000;
  assert.equal(timer.snapshot().left, 42);
  timer.adjust(10);
  assert.equal(timer.snapshot().seconds, 70);
  now = 90000;
  timer.tick();
  timer.tick();
  assert.equal(ended, 1);
  assert.equal(last.mode, "exercise");
  assert.equal(last.date, date);
  assert.equal(last.index, 1);
  assert.equal(timer.current, null);
});
test("user food names and IDs cannot create executable markup in rendered views", () => {
  const s = freshState();
  s["food_" + date] = [
    {
      id: '"><img src=x onerror=alert(1)>',
      name: "<script>alert(1)</script>",
      g: 1,
      unit: "g",
      cal: 1,
      p: 0,
      f: 0,
      c: 0,
    },
  ];
  const html = nutrition(s, { foodDate: date });
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(esc("\"'"), "&quot;&#39;");
});
test("all current program days render and untouched states keep date-specific rows empty", () => {
  const s = freshState();
  for (const day of [1, 2, 3, 4, 5]) {
    assert.match(
      training(s, { day, date, focus: false, editPast: false }),
      /exercise-card/,
    );
    assert.match(
      training(s, { day, date, focus: true, focusIndex: 0, editPast: true }),
      /focus-navigation/,
    );
  }
  assert.deepEqual(s.train, {});
  assert.doesNotThrow(() =>
    progress(s, { period: 28 }, { snapshots: () => [] }),
  );
});
test("real first-run state generated by the previous script stack migrates and reloads", async () => {
  const raw = await readFile(
    new URL("./fixtures/legacy-clean.json", import.meta.url),
    "utf8",
  );
  const storage = new MemoryStorage();
  storage.setItem(LEGACY, raw);
  const store = new Store(storage);
  store.load();
  store.commit((s) => (s.profile.height = 179));
  assert.equal(storage.getItem(LEGACY), raw);
  assert.equal(new Store(storage).load().profile.height, 179);
  assert.equal(store.state.measurements.length, 1);
  assert.equal(store.state.measurements[0].needsConfirmation, true);
});
test("visible set values are parsed together before completing a set", () => {
  const ex = exerciseById("bench"),
    r = { load: "", reps: "", rir: 2, done: false };
  setInput(ex, r, "load", "20,5");
  setInput(ex, r, "reps", "10");
  setInput(ex, r, "rir", "3");
  assert.equal(validSet(ex, r), true);
  assert.equal(r.load, 20.5);
  assert.equal(r.reps, 10);
  assert.equal(r.rir, 3);
  const before = clone(r);
  assert.throws(() => setInput(ex, r, "reps", "10oops"));
  assert.deepEqual(r, before);
});
