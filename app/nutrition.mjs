import {
  addFood,
  bounded,
  uid,
  round,
  number,
  dateKey,
  parseDate,
} from "./model.mjs";

// Exact portions from the existing detailed plan; no new targets or supplement doses.
export const MEALS = [
  {
    id: "pre",
    time: "05:20",
    title: "Перед силовой",
    items: [
      ["whey", 30],
      ["oats", 50],
    ],
    extra:
      "Напиток добавьте отдельно по этикетке. Креатин 5 г — без учёта КБЖУ.",
  },
  {
    id: "breakfast",
    time: "07:40",
    title: "Завтрак",
    items: [
      ["egg", 3],
      ["buck", 200],
    ],
    extra: "Кофе без добавок; молоко и сахар учитываются отдельно.",
  },
  {
    id: "lunch",
    time: "12:00",
    title: "Обед",
    items: [
      ["chicken", 200],
      ["pasta", 200],
    ],
    extra: "Вес готового продукта. Овощи и соусы добавьте отдельно.",
  },
  {
    id: "shake",
    time: "15:00",
    title: "Коктейль",
    items: [
      ["whey", 30],
      ["kefir", 250],
    ],
    extra: "Клетчатку добавьте по данным упаковки.",
  },
  {
    id: "dinner",
    time: "18:30",
    title: "Ужин",
    items: [
      ["cottage", 200],
      ["kefir", 200],
    ],
    extra: "Дополнительные продукты внесите в дневник.",
  },
];
export const SUPPLEMENTS = [
  {
    name: "Бета-аланин",
    text: "1 порция (5 г) утром",
    intakes: [{ id: "betaMorning5", time: "Утро", dose: "1 порция (5 г)" }],
  },
  {
    name: "Омега-3",
    text: "2 капсулы с завтраком · 2 с ужином",
    intakes: [
      { id: "omega", time: "Завтрак", dose: "2 капсулы" },
      { id: "omegaEvening", time: "Ужин", dose: "2 капсулы" },
    ],
  },
  {
    name: "Магний + B6",
    text: "2 капсулы с завтраком · 2 с ужином",
    intakes: [
      { id: "magnesiumMorning", time: "Завтрак", dose: "2 капсулы" },
      { id: "magnesium", time: "Ужин", dose: "2 капсулы" },
    ],
  },
  {
    name: "Кофеин",
    text: "1 таблетка (200 мг) утром по необходимости",
    intakes: [{ id: "caffeine", time: "Утро", dose: "1 таблетка (200 мг)" }],
  },
];
export function mealParts(s, meal) {
  return meal.items.map(([id, g]) => ({
    food: s.foods.find((f) => f.id === id),
    amount: s.mealPortions?.[meal.id]?.[id] ?? g,
  }));
}
export const unitLabel = (food) =>
  food?.unit === "piece"
    ? "шт."
    : food?.unit === "ml"
      ? "мл"
      : food?.unit === "portion"
        ? "порц."
        : "г";
export function allMeals(s) {
  const recipes = s.mealRecipes || {};
  return [
    ...MEALS.map((m) => recipes[m.id] || m),
    ...Object.values(recipes).filter(
      (m) => !MEALS.some((base) => base.id === m.id),
    ),
  ];
}
export function saveRecipe(s, draft) {
  const title = String(draft.title || "").trim();
  if (!title || title.length > 150)
    throw new Error("Укажите название до 150 символов.");
  if (!draft.items?.length)
    throw new Error("Добавьте хотя бы один ингредиент.");
  const id = draft.id || uid();
  const recipe = {
    id,
    title,
    time: draft.time || "",
    items: draft.items.map(([foodId, amount]) => {
      const food = s.foods.find((f) => f.id === foodId);
      if (!food) throw new Error("Выберите продукт для каждого ингредиента.");
      return [
        foodId,
        bounded(
          amount,
          0.01,
          food.unit === "piece" ? 100 : 20000,
          "Количество",
        ),
      ];
    }),
  };
  if (new Set(recipe.items.map(([id]) => id)).size !== recipe.items.length)
    throw new Error(
      "Продукт повторяется. Объедините его количество в одной строке.",
    );
  (s.mealRecipes ||= {})[id] = recipe;
  if (s.mealPortions) delete s.mealPortions[id];
  return recipe;
}
export function mealTotals(s, meal) {
  return mealParts(s, meal).reduce(
    (t, { food, amount }) => {
      if (!food) return t;
      const quantity = number(amount);
      if (quantity === null) throw new Error("Укажите количество ингредиента.");
      const ratio = food.unit === "piece" ? quantity : quantity / 100;
      for (const k of ["cal", "p", "f", "c"])
        t[k] = round(t[k] + food[k] * ratio);
      return t;
    },
    { cal: 0, p: 0, f: 0, c: 0 },
  );
}
export function addMeal(
  s,
  meal,
  date,
  { portions = 1, allowRepeat = false } = {},
) {
  if (!meal) throw new Error("Блюдо не найдено.");
  const factor = bounded(portions, 0.01, 100, "Порции");
  const rows = s[`food_${date}`] || [];
  if (
    !allowRepeat &&
    MEALS.some((m) => m.id === meal.id) &&
    rows.some((r) => r.mealId === meal.id)
  )
    throw new Error(
      "Этот приём пищи уже записан. Изменить его можно в дневнике.",
    );
  const entryId = uid();
  const parts = mealParts(s, meal).map(({ food, amount }) => {
    if (!food) throw new Error("В шаблоне отсутствует продукт.");
    return {
      food,
      amount: bounded(
        round(number(amount) * factor),
        0.01,
        food.unit === "piece" ? 100 : 20000,
        "Количество",
      ),
    };
  });
  for (const { food, amount } of parts) {
    addFood(s, food.id, amount, date);
    s[`food_${date}`].at(-1).mealId = meal.id;
    s[`food_${date}`].at(-1).mealEntryId = entryId;
    s[`food_${date}`].at(-1).mealTitle = meal.title;
  }
}
export function recentFoods(s, end = dateKey(), limit = 8) {
  const seen = new Set(),
    recent = [];
  const dates = Object.keys(s)
    .filter(
      (key) =>
        key.startsWith("food_") &&
        parseDate(key.slice(5)) &&
        key.slice(5) <= end,
    )
    .sort()
    .reverse();
  for (const key of dates)
    for (const row of [...s[key]].reverse()) {
      if (seen.has(row.foodId)) continue;
      const food = s.foods.find((f) => f.id === row.foodId);
      if (!food || (food.unit || "g") !== (row.unit || "g")) continue;
      seen.add(food.id);
      recent.push({ food, amount: row.g, date: key.slice(5) });
      if (recent.length >= limit) return recent;
    }
  return recent;
}
export function defaultAmount(s, food, end = dateKey()) {
  return (
    recentFoods(s, end, s.foods.length).find((r) => r.food.id === food.id)
      ?.amount ?? (food.unit === "piece" ? 1 : 100)
  );
}
export function portionTotals(food, amount) {
  const quantity = bounded(
    amount,
    0.01,
    food.unit === "piece" ? 100 : 20000,
    "Количество",
  );
  const factor =
    food.unit === "piece" || food.unit === "portion"
      ? quantity
      : quantity / 100;
  return Object.fromEntries(
    ["cal", "p", "f", "c"].map((k) => [k, round(food[k] * factor)]),
  );
}
export function editFoodAmount(s, id, amount, date) {
  const row = (s[`food_${date}`] || []).find(
    (r) => String(r.id) === String(id),
  );
  if (!row) throw new Error("Запись не найдена.");
  const quantity = bounded(
    amount,
    0.01,
    row.unit === "piece" ? 100 : 20000,
    "Количество",
  );
  if (!(row.g > 0))
    throw new Error("У старой записи нет количества. Добавь её заново.");
  // Preserve the diary's nutritional values, even if its recipe/product changed.
  const values = Object.fromEntries(
    ["cal", "p", "f", "c"].map((k) => [k, round((row[k] / row.g) * quantity)]),
  );
  Object.assign(row, values, { g: quantity });
  s.foodDays[date] = { ...s.foodDays[date], complete: false };
}
export function makeProduct(form) {
  const name = String(form.name || "").trim();
  if (!name || name.length > 150)
    throw new Error("Укажите название до 150 символов.");
  return {
    id: uid(),
    name,
    unit: ["piece", "ml"].includes(form.unit) ? form.unit : "g",
    cal: bounded(form.cal, 0, 2000, "Калории"),
    p: bounded(form.p, 0, 200, "Белок"),
    f: bounded(form.f, 0, 200, "Жиры"),
    c: bounded(form.c, 0, 200, "Углеводы"),
  };
}
