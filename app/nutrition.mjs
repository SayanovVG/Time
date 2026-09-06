import { addFood, bounded, totals, uid, round } from "./model.mjs";

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
export function mealTotals(s, meal) {
  return mealParts(s, meal).reduce(
    (t, { food, amount }) => {
      if (!food) return t;
      const ratio = food.unit === "piece" ? amount : amount / 100;
      for (const k of ["cal", "p", "f", "c"])
        t[k] = round(t[k] + food[k] * ratio);
      return t;
    },
    { cal: 0, p: 0, f: 0, c: 0 },
  );
}
export function addMeal(s, meal, date) {
  const rows = s[`food_${date}`] || [];
  if (rows.some((r) => r.mealId === meal.id))
    throw new Error(
      "Этот приём пищи уже записан. Изменить его можно в дневнике.",
    );
  for (const { food, amount } of mealParts(s, meal)) {
    if (!food) throw new Error("В шаблоне отсутствует продукт.");
    addFood(s, food.id, amount, date);
    s[`food_${date}`].at(-1).mealId = meal.id;
  }
}
export function makeProduct(form) {
  const name = String(form.name || "").trim();
  if (!name || name.length > 150)
    throw new Error("Укажите название до 150 символов.");
  return {
    id: uid(),
    name,
    unit: form.unit === "piece" ? "piece" : "g",
    cal: bounded(form.cal, 0, 2000, "Калории"),
    p: bounded(form.p, 0, 200, "Белок"),
    f: bounded(form.f, 0, 200, "Жиры"),
    c: bounded(form.c, 0, 200, "Углеводы"),
  };
}
