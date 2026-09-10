import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  analytics,
  trainingSessions,
  sameSessionConditions,
  report,
  addFood,
  totals,
  normalizeState,
  clone,
} from "../app/model.mjs";
import { BANDS } from "../app/program.mjs";
import {
  MEALS,
  addMeal,
  recentFoods,
  defaultAmount,
  editFoodAmount,
  saveRecipe,
  makeProduct,
  portionTotals,
} from "../app/nutrition.mjs";
import {
  foodResults,
  amountForm,
  progress,
  sessionDescription,
} from "../app/view.mjs";
import { Store } from "../app/store.mjs";

const end = "2026-09-10";
const sets = (reps, load = 40) =>
  reps.map((n) => ({ reps: n, load, rir: 2, done: true }));
function stateWith(id, previous, current) {
  const s = freshState();
  s.train[`2026-09-03_${id}`] = previous;
  s.train[`${end}_${id}`] = current;
  return s;
}
const trend = (s) => analytics(s, 14, end).trends[0];

test("more reps in the first set never becomes a decline against a complete exercise", () => {
  const s = stateWith("row", sets([10, 10, 10]), [
    ...sets([12]),
    ...sets([12, 12]).map((r) => ({ ...r, done: false })),
  ]);
  const result = trend(s);
  assert.ok(
    result.current.volume < result.previous.volume,
    "old total-volume comparison produced a false decline",
  );
  assert.equal(result.status, "incomplete");
  assert.equal(result.pct, null);
  s.train[`${end}_row`].forEach((r) => (r.done = true));
  assert.equal(trend(s).status, "up");
  assert.equal(trend(s).pct, 20);
  assert.equal(trend(s).delta, 6);
});

test("comparison uses the previous complete exercise, including just outside the selected period", () => {
  const s = stateWith("row", sets([10, 10, 10]), sets([12, 12, 12]));
  s.train["2026-08-27_row"] = sets([15, 15, 15]);
  s.train["2026-09-05_row"] = [{ ...sets([11])[0] }];
  for (const days of [7, 14, 28]) {
    const t = analytics(s, days, end).trends[0];
    assert.equal(t.previous.date, "2026-09-03");
    assert.equal(t.current.date, end);
    assert.equal(t.pct, 20);
  }
});

test("changed resistance and different set counts remain neutral instead of inventing a strength percentage", () => {
  for (const [id, before, after] of [
    ["row", sets([12, 12, 12], 40), sets([10, 10, 10], 45)],
    ["curlband", sets([15, 15, 15], BANDS[0]), sets([10, 10, 10], BANDS[1])],
    ["pullup", sets([10, 10, 10, 10], 0), sets([10, 10, 10, 10], 5)],
    ["row", sets([10, 10, 10, 10], 40), sets([12, 12, 12], 40)],
  ]) {
    const t = trend(stateWith(id, before, after));
    assert.equal(t.pct, null);
    assert.ok(["load", "sets"].includes(t.status));
    assert.equal(sameSessionConditions(t.current, t.previous), false);
  }
});

test("real declines are retained and times, bands and bodyweight are compared in their own units", () => {
  const timed = trend(
    stateWith("plank", sets([30, 30], ""), sets([40, 40], "")),
  );
  assert.equal(timed.metric, "секунды");
  assert.equal(timed.pct, 33.33);
  const band = trend(
    stateWith(
      "curlband",
      sets([12, 12, 12], BANDS[1]),
      sets([10, 10, 10], BANDS[1]),
    ),
  );
  assert.equal(band.pct, -16.67);
  assert.equal(band.status, "down");
  const body = trend(
    stateWith("pullup", sets([10, 10, 10, 10], ""), sets([11, 11, 11, 11], 0)),
  );
  assert.equal(body.pct, 10);
  assert.match(sessionDescription(timed.current), /40 \+ 40 сек/);
  assert.doesNotMatch(sessionDescription(timed.current), /кг/);
});

test("numeric legacy strings, duplicate aliases, future rows and incomplete first entries cannot corrupt trends", () => {
  const s = stateWith(
    "row",
    sets(["10,0", "10,0", "10,0"], "10,5"),
    sets([12, 12, 12], 10.5),
  );
  s.train["2026-09-11_row"] = sets([1, 1, 1], 10.5);
  assert.equal(trend(s).pct, 20);
  s.train["2026-09-04_row"] = sets([90, 90, 90], 10.5);
  s.legacy.duplicateKeys.push("2026-09-04_row");
  assert.equal(trend(s).pct, 20);
  const aliases = freshState();
  aliases.train[`${end}_bandcurl`] = sets([15, 15, 15], BANDS[0]);
  aliases.train[`${end}_curlband`] = sets([12, 12, 12], BANDS[0]);
  const rows = trainingSessions(aliases, 7, end);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reps, 36);
  assert.equal(analytics(aliases, 7, end).trends[0].pct, null);
});

test("report and progress explain exact comparison dates and never print null percent", () => {
  const s = stateWith("row", sets([10, 10, 10]), sets([12, 12, 12]));
  assert.match(
    report(s, 7, end),
    /\+20% к предыдущей тренировке 2026-09-03: 30 → 36 повторы/,
  );
  s.train[`${end}_row`][2].done = false;
  const text = report(s, 7, end);
  assert.match(text, /Выполнено 2 из 3 подходов/);
  assert.doesNotMatch(text, /null%|NaN|Infinity/);
  const html = progress(s, { period: 28 }, { snapshots: () => [] });
  assert.doesNotMatch(html, /null%|NaN/);
});

test("recent products keep the last actual portion, deduplicate and exclude later dates", () => {
  const s = freshState();
  addFood(s, "oats", 50, "2026-09-08");
  addFood(s, "egg", 3, "2026-09-09");
  addFood(s, "oats", 60, end);
  addFood(s, "oats", 200, "2026-09-11");
  assert.deepEqual(
    recentFoods(s, end).map((r) => [r.food.id, r.amount]),
    [
      ["oats", 60],
      ["egg", 3],
    ],
  );
  assert.equal(
    defaultAmount(
      s,
      s.foods.find((f) => f.id === "egg"),
      end,
    ),
    3,
  );
  assert.equal(
    defaultAmount(
      s,
      s.foods.find((f) => f.id === "banana"),
      end,
    ),
    100,
  );
  assert.equal(
    defaultAmount(
      s,
      s.foods.find((f) => f.id === "oats"),
      "2026-09-09",
    ),
    50,
  );
});

test("intentional second meal and fractional portions remain separate without changing the recipe", () => {
  const s = freshState(),
    recipe = clone(MEALS[1]);
  addMeal(s, recipe, end, { portions: 0.5, allowRepeat: true });
  const first = clone(s[`food_${end}`]);
  addMeal(s, recipe, end, { portions: 2, allowRepeat: true });
  assert.deepEqual(s[`food_${end}`].slice(0, 2), first);
  assert.equal(totals(s, end).cal, 1150);
  assert.notEqual(first[0].mealEntryId, s[`food_${end}`][2].mealEntryId);
  assert.deepEqual(recipe, MEALS[1]);
  const before = clone(s);
  assert.throws(() =>
    addMeal(s, recipe, end, { portions: 0, allowRepeat: true }),
  );
  assert.deepEqual(s, before);
});

test("editing a diary portion preserves its original label values and meal group after recipe changes", () => {
  const s = freshState();
  addMeal(s, MEALS[3], end);
  const row = s[`food_${end}`].find((r) => r.foodId === "kefir"),
    original = clone(row);
  const drink = makeProduct({
    name: "Мой напиток",
    unit: "ml",
    cal: 60,
    p: 1,
    f: 2,
    c: 9,
  });
  s.foods.push(drink);
  saveRecipe(s, {
    ...MEALS[3],
    items: [
      ["whey", 40],
      [drink.id, 300],
    ],
  });
  s.foods.find((f) => f.id === "kefir").cal = 999;
  s.foodDays[end] = { complete: true };
  editFoodAmount(s, row.id, "125,5", end);
  assert.equal(row.g, 125.5);
  assert.equal(row.cal, 50.2);
  assert.equal(row.mealEntryId, original.mealEntryId);
  assert.equal(row.name, original.name);
  assert.equal(s.foodDays[end].complete, false);
  assert.equal(s.mealRecipes.shake.items[1][0], drink.id);
  const before = clone(s);
  assert.throws(() => editFoodAmount(s, row.id, -1, end));
  assert.deepEqual(s, before);
});

test("piece and legacy portion edits use recorded totals and survive normalization/export", () => {
  const s = freshState();
  addFood(s, "egg", 3, end);
  const row = s[`food_${end}`][0];
  editFoodAmount(s, row.id, 2, end);
  assert.equal(totals(s, end).cal, 160);
  const legacy = {
    id: "legacy",
    name: "Старый обед",
    unit: "portion",
    g: 1,
    cal: 600,
    p: 30,
    f: 20,
    c: 60,
  };
  s[`food_${end}`].push(legacy);
  editFoodAmount(s, legacy.id, 0.5, end);
  assert.equal(legacy.cal, 300);
  const restored = normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(totals(restored, end), totals(s, end));
});

test("quick buttons show the amount they log and all portion previews use the selected unit", () => {
  const s = freshState();
  addFood(s, "egg", 3, end);
  const picker = { date: end, tab: "recent", query: "" };
  const html = foodResults(s, picker);
  assert.match(html, /data-action="quick-food"[^>]+data-amount="3"/);
  assert.match(html, /3 шт\. · 240 ккал/);
  const form = amountForm({
    id: "egg",
    name: "Яйцо",
    amount: 3,
    unit: "шт.",
    date: end,
  });
  assert.match(form, /name="amount"[^>]+value="3"/);
  assert.match(form, /data-action="food-back"/);
  const malicious = makeProduct({
    name: '<img src=x onerror="alert(1)">',
    unit: "ml",
    cal: 60,
    p: 1,
    f: 2,
    c: 9,
  });
  s.foods.push(malicious);
  assert.doesNotMatch(foodResults(s, { ...picker, tab: "foods" }), /<img/);
  assert.equal(portionTotals(malicious, "250,5").cal, 150.3);
});

test("consecutive food entries and amount edits persist, and a failed save leaves the diary intact", () => {
  const values = new Map();
  let fail = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (fail && key === "max_time_v3") throw new Error("quota");
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
  const store = new Store(storage);
  store.load();
  store.commit((s) => addFood(s, "egg", 3, end));
  store.commit((s) =>
    addMeal(s, MEALS[3], end, { portions: 0.5, allowRepeat: true }),
  );
  const id = store.state[`food_${end}`][0].id;
  store.commit((s) => editFoodAmount(s, id, 2, end));
  const reloaded = new Store(storage);
  reloaded.load();
  assert.deepEqual(reloaded.state[`food_${end}`], store.state[`food_${end}`]);
  const before = clone(store.state),
    saved = storage.getItem("max_time_v3");
  fail = true;
  assert.throws(() => store.commit((s) => editFoodAmount(s, id, 4, end)));
  assert.deepEqual(store.state, before);
  assert.equal(storage.getItem("max_time_v3"), saved);
});
