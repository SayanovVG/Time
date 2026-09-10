import { PROGRAM, BANDS, DEFAULT_FOODS } from "./program.mjs";

export const VERSION = "3.2.0";
export const SCHEMA = 3;
export const TARGET = { cal: 2450, p: 180, f: 75, c: 264 };
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const number = (value) => {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  const text = String(value).trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};
export const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const bounded = (value, min, max, label) => {
  const n = number(value);
  if (n === null || n < min || n > max)
    throw new Error(`${label}: допустимо от ${min} до ${max}.`);
  return n;
};
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  const [y, m, d] = s.split("-").map(Number),
    out = new Date(y, m - 1, d, 12);
  return dateKey(out) === s ? out : null;
}
export function shiftDate(s, n) {
  const d = parseDate(s);
  if (!d) throw new Error("Некорректная дата.");
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function selectedDate(day, today = dateKey()) {
  const d = parseDate(today);
  return shiftDate(today, -((d.getDay() || 7) - 1) + day - 1);
}
export function inPeriod(date, days, end = dateKey()) {
  return !!parseDate(date) && date >= shiftDate(end, 1 - days) && date <= end;
}
export const exerciseById = (id) =>
  Object.values(PROGRAM)
    .flatMap((d) => d.ex)
    .find((ex) => ex.id === (id === "bandcurl" ? "curlband" : id));
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function freshState() {
  return {
    schemaVersion: SCHEMA,
    profile: {},
    train: {},
    foods: clone(DEFAULT_FOODS),
    mealRecipes: {},
    measurements: [],
    dailySummary: {},
    foodDays: {},
    cp: {},
    exerciseDurations: {},
    workoutMeta: {},
    legacy: { duplicateKeys: [], warnings: [] },
  };
}
const object = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const safeText = (value, label, limit = 300) => {
  if (typeof value !== "string" || value.length > limit)
    throw new Error(`Некорректное поле: ${label}.`);
  return value;
};
function noDangerousKeys(x, depth = 0) {
  if (depth > 30) throw new Error("Слишком сложная структура файла.");
  if (!x || typeof x !== "object") return;
  for (const k of Object.keys(x)) {
    if (["__proto__", "constructor", "prototype"].includes(k))
      throw new Error("Недопустимый ключ в файле.");
    noDangerousKeys(x[k], depth + 1);
  }
}
const requireObject = (x, key) => {
  if (!object(x)) throw new Error(`Повреждён раздел «${key}».`);
};
const optionalNumber = (value, min, max, label) =>
  value === "" || value === null || value === undefined
    ? ""
    : bounded(value, min, max, label);

/** Validate before writes. Preserve unknown legacy fields and IDs, never discard the raw source. */
export function normalizeState(input, { source = "import" } = {}) {
  requireObject(input, "файл");
  noDangerousKeys(input);
  const raw = input.format === "max-time-backup" ? input.state : input;
  requireObject(raw, "данные");
  if (
    raw.schemaVersion !== undefined &&
    (!Number.isInteger(raw.schemaVersion) || raw.schemaVersion > SCHEMA)
  )
    throw new Error("Эта версия резервной копии пока не поддерживается.");
  if (!object(raw.train) || !object(raw.profile))
    throw new Error("В файле нет корректного журнала тренировок и профиля.");
  const s = { ...freshState(), ...clone(raw) };
  for (const key of [
    "train",
    "profile",
    "dailySummary",
    "cp",
    "workoutMeta",
    "foodDays",
    "exerciseDurations",
    "mealRecipes",
  ])
    requireObject(s[key], key);
  for (const key of ["foods", "measurements"])
    if (!Array.isArray(s[key])) throw new Error(`Повреждён раздел «${key}».`);
  if (
    s.foods.length > 10000 ||
    s.measurements.length > 20000 ||
    Object.keys(s.train).length > 100000
  )
    throw new Error("Файл превышает допустимый размер журнала.");
  for (const [field, range] of Object.entries({
    weight: [20, 400],
    waist: [30, 300],
    height: [80, 250],
    age: [10, 120],
  })) {
    if (s.profile[field] !== undefined && s.profile[field] !== "")
      s.profile[field] = bounded(s.profile[field], ...range, field);
  }
  const warnings = [];
  for (const [key, sets] of Object.entries(s.train)) {
    if (
      !parseDate(key.slice(0, 10)) ||
      key[10] !== "_" ||
      !/^[\w-]+$/.test(key.slice(11)) ||
      !Array.isArray(sets) ||
      sets.length > 100
    )
      throw new Error(`Повреждена тренировка: ${key}.`);
    const ex = exerciseById(key.slice(11));
    for (const set of sets) {
      requireObject(set, "подход");
      if (typeof set.done !== "boolean")
        throw new Error("Некорректная отметка подхода.");
      if (set.load !== "" && set.load !== undefined && set.load !== null) {
        if (!BANDS.includes(set.load))
          optionalNumber(set.load, 0, 2000, "Нагрузка");
      }
      optionalNumber(set.reps, 0, ex?.time ? 7200 : 1000, "Повторения");
      const rir = set.rir === "3+" ? 3 : optionalNumber(set.rir, 0, 3, "RIR");
      set.rir = rir === "" ? (ex?.r ?? 2) : rir;
      set.load = set.load ?? "";
      set.reps = set.reps ?? "";
      // Older versions allowed empty completed rows. Preserve them for correction, exclude from totals.
      if (set.done && !validSet(ex, set))
        warnings.push(
          "В старой истории есть отмеченные подходы без повторений или нагрузки. Они сохранены, но не учитываются до исправления.",
        );
    }
  }
  const seenFoodIds = new Set();
  for (const f of s.foods) {
    requireObject(f, "продукт");
    safeText(f.id, "ID продукта", 120);
    safeText(f.name, "название продукта");
    if (!f.id || !f.name.trim() || seenFoodIds.has(f.id))
      throw new Error("Пустой или повторяющийся продукт.");
    seenFoodIds.add(f.id);
    for (const k of ["cal", "p", "f", "c"])
      f[k] = bounded(f[k], 0, k === "cal" ? 2000 : 200, `Продукт: ${k}`);
    if (f.unit && !["g", "ml", "piece", "portion"].includes(f.unit))
      throw new Error("Некорректная единица продукта.");
  }
  for (const m of s.measurements) {
    requireObject(m, "замер");
    if (!parseDate(m.date)) throw new Error("Некорректная дата замера.");
    if (m.weight !== undefined && m.weight !== null && m.weight !== "")
      m.weight = bounded(m.weight, 20, 400, "Вес");
    if (m.waist !== undefined && m.waist !== null && m.waist !== "")
      m.waist = bounded(m.waist, 30, 300, "Талия");
  }
  for (const [key, value] of Object.entries(s)) {
    if (/^food_\d/.test(key)) {
      if (
        !parseDate(key.slice(5)) ||
        !Array.isArray(value) ||
        value.length > 5000
      )
        throw new Error("Некорректный дневник еды.");
      const foodIds = new Set();
      for (const row of value) {
        requireObject(row, "запись еды");
        safeText(row.name, "название записи");
        if (!["string", "number"].includes(typeof row.id))
          throw new Error("Некорректный ID записи.");
        if (foodIds.has(String(row.id))) {
          row.legacyId = row.id;
          row.id = uid();
        }
        foodIds.add(String(row.id));
        row.g = bounded(row.g, 0.01, 20000, "Количество еды");
        for (const k of ["cal", "p", "f", "c"])
          row[k] = bounded(row[k], 0, 100000, `Запись еды: ${k}`);
        if (row.planId) {
          safeText(row.planId, "приём пищи");
          row.unit = "portion";
          const meal = row.planId.match(
            /_(pre|breakfast|lunch|shake|dinner|carbs)$/,
          );
          if (meal) row.mealId = meal[1];
        } else if (!row.unit)
          row.unit =
            row.name === "Яйцо куриное C0" &&
            Number.isInteger(row.g) &&
            row.g < 20
              ? "piece"
              : "g";
        if (!["g", "ml", "piece", "portion"].includes(row.unit))
          throw new Error("Некорректная единица записи еды.");
        if (row.mealId !== undefined) safeText(row.mealId, "шаблон еды", 50);
      }
    }
    if (/^supplements_/.test(key)) {
      if (!parseDate(key.slice(12)))
        throw new Error("Некорректная дата добавок.");
      requireObject(value, "добавки");
      for (const v of Object.values(value))
        if (typeof v !== "boolean")
          throw new Error("Некорректная отметка добавки.");
    }
  }
  if (Object.keys(s.mealRecipes).length > 500)
    throw new Error("Слишком много рецептов.");
  for (const [id, recipe] of Object.entries(s.mealRecipes)) {
    requireObject(recipe, "рецепт");
    if (!/^[\w-]{1,50}$/.test(id) || recipe.id !== id)
      throw new Error("Некорректный ID рецепта.");
    safeText(recipe.title, "название рецепта", 150);
    if (!recipe.title.trim()) throw new Error("Укажите название рецепта.");
    if (recipe.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(recipe.time))
      throw new Error("Некорректное время приёма пищи.");
    if (
      !Array.isArray(recipe.items) ||
      !recipe.items.length ||
      recipe.items.length > 50
    )
      throw new Error("В рецепте должно быть от 1 до 50 ингредиентов.");
    const ingredients = new Set();
    for (const item of recipe.items) {
      if (!Array.isArray(item) || item.length !== 2)
        throw new Error("Повреждён ингредиент рецепта.");
      const food = s.foods.find((f) => f.id === item[0]);
      if (!food) throw new Error("Продукт рецепта отсутствует в справочнике.");
      if (ingredients.has(food.id))
        throw new Error(
          "Продукт повторяется в рецепте. Объедините его количество.",
        );
      ingredients.add(food.id);
      item[1] = bounded(
        item[1],
        0.01,
        food.unit === "piece" ? 100 : 20000,
        "Количество ингредиента",
      );
    }
  }
  for (const [d, summary] of Object.entries(s.dailySummary)) {
    if (!parseDate(d)) throw new Error("Некорректная дата питания.");
    requireObject(summary, "сводка");
    for (const k of ["cal", "p", "f", "c"])
      if (summary[k] !== undefined)
        bounded(summary[k], 0, 100000, `Сводка: ${k}`);
  }
  for (const [d, meta] of Object.entries(s.foodDays)) {
    if (!parseDate(d)) throw new Error("Некорректная дата питания.");
    requireObject(meta, "состояние дня");
    if (meta.complete !== undefined && typeof meta.complete !== "boolean")
      throw new Error("Некорректное завершение дня.");
  }
  for (const [id, v] of Object.entries(s.cp))
    s.cp[id] = bounded(v, 5, 3600, "Отдых");
  for (const [id, v] of Object.entries(s.exerciseDurations))
    s.exerciseDurations[id] = bounded(v, 5, 7200, "Время упражнения");
  if (s.mealPortions !== undefined) {
    requireObject(s.mealPortions, "порции");
    for (const portions of Object.values(s.mealPortions)) {
      requireObject(portions, "порции");
      for (const [id, value] of Object.entries(portions))
        portions[id] = bounded(
          value,
          0.01,
          s.foods.find((f) => f.id === id)?.unit === "piece" ? 100 : 20000,
          "Порция",
        );
    }
  }
  for (const [date, meta] of Object.entries(s.workoutMeta)) {
    if (!parseDate(date)) throw new Error("Некорректная дата тренировки.");
    requireObject(meta, "время тренировки");
    for (const key of ["startedAt", "completedAt"])
      if (meta[key] !== undefined)
        meta[key] = bounded(meta[key], 0, 8640000000000000, "Время тренировки");
  }
  s.legacy = object(s.legacy) ? s.legacy : {};
  s.legacy.warnings = [
    ...new Set([
      ...(Array.isArray(s.legacy.warnings)
        ? s.legacy.warnings.filter((x) => typeof x === "string")
        : []),
      ...warnings,
    ]),
  ];
  s.legacy.duplicateKeys = Array.isArray(s.legacy.duplicateKeys)
    ? s.legacy.duplicateKeys.filter(
        (k) => typeof k === "string" && k in s.train,
      )
    : [];
  if (raw.schemaVersion !== SCHEMA) {
    const map = new Map(
      Object.entries(PROGRAM).flatMap(([d, p]) =>
        p.ex.map((ex) => [ex.id, +d]),
      ),
    );
    for (const [key, sets] of Object.entries(s.train)) {
      const id = key.slice(11) === "bandcurl" ? "curlband" : key.slice(11),
        day = map.get(id);
      if (!day) continue;
      const target = `${selectedDate(day, key.slice(0, 10))}_${id}`;
      // Only identical legacy copies from the old recovery routine are hidden from analytics.
      if (
        target !== key &&
        s.train[target] &&
        JSON.stringify(sets.map(comparableSet)) ===
          JSON.stringify(s.train[target].map(comparableSet))
      )
        s.legacy.duplicateKeys.push(key);
    }
    // Earlier first-run code inserted this exact default pair as an unsolicited measurement.
    const suspicious = s.measurements.find(
      (m) => +m.weight === 84 && +m.waist === 100,
    );
    if (suspicious) {
      suspicious.needsConfirmation = true;
      s.legacy.warnings.push(
        "Начальный замер 84 кг / 100 см требует подтверждения: старая версия могла создать его автоматически.",
      );
    }
  }
  s.legacy.duplicateKeys = [...new Set(s.legacy.duplicateKeys)];
  s.schemaVersion = SCHEMA;
  delete s.timer;
  delete s.workoutMode;
  delete s.focusIndex;
  delete s.foodForm;
  return s;
}
const comparableSet = (s) => ({
  load: s.load,
  reps: s.reps,
  rir: s.rir,
  done: s.done,
});
export function validSet(ex, s) {
  const reps = number(s?.reps),
    rir = number(s?.rir);
  if (
    !s ||
    reps === null ||
    !Number.isInteger(reps) ||
    reps <= 0 ||
    rir === null ||
    !Number.isInteger(rir) ||
    rir < 0 ||
    rir > 3
  )
    return false;
  if (ex?.band) return BANDS.includes(s.load);
  if (ex?.time || ["pullup", "dips", "legraise"].includes(ex?.id)) return true;
  return number(s.load) !== null && number(s.load) >= 0;
}
export function setInput(ex, row, field, value) {
  if (!["load", "reps", "rir"].includes(field))
    throw new Error("Неизвестное поле подхода.");
  let v = value;
  if (v !== "" && field === "load") {
    if (ex.band) {
      if (!BANDS.includes(v)) throw new Error("Выберите резинку из списка.");
    } else v = bounded(v, 0, 2000, "Вес");
  }
  if (v !== "" && field === "reps") {
    v = bounded(
      v,
      1,
      ex.time ? 7200 : 1000,
      ex.time ? "Секунды" : "Повторения",
    );
    if (!Number.isInteger(v))
      throw new Error("Введите целое число повторений или секунд.");
  }
  if (field === "rir") v = bounded(v, 0, 3, "RIR");
  const next = { ...row, [field]: v };
  if (next.done && !validSet(ex, next))
    throw new Error(
      "Завершённый подход должен оставаться заполненным. Сначала снимите отметку.",
    );
  Object.assign(row, next);
}
export function rowsFor(s, date, ex) {
  const source =
    s.train[`${date}_${ex.id}`] ||
    (ex.id === "curlband" ? s.train[`${date}_bandcurl`] : null) ||
    [];
  return Array.from({ length: ex.s }, (_, i) => ({
    load: "",
    reps: "",
    rir: ex.r,
    done: false,
    ...source[i],
  }));
}
export function previousRows(s, date, ex) {
  const keys = Object.keys(s.train)
    .filter(
      (k) =>
        k.endsWith(`_${ex.id}`) &&
        k.slice(0, 10) < date &&
        !s.legacy.duplicateKeys.includes(k) &&
        s.train[k].some((row) => row.done && validSet(ex, row)),
    )
    .sort();
  return keys.length ? s.train[keys.at(-1)] : [];
}
export function totals(s, date = dateKey()) {
  return (s[`food_${date}`] || []).reduce(
    (a, r) =>
      Object.fromEntries(
        ["cal", "p", "f", "c"].map((k) => [k, round(a[k] + r[k])]),
      ),
    { cal: 0, p: 0, f: 0, c: 0 },
  );
}
export function nutritionDays(s, days, end = dateKey()) {
  const dates = new Set([
    ...Object.keys(s)
      .filter((k) => /^food_\d/.test(k))
      .map((k) => k.slice(5)),
    ...Object.keys(s.dailySummary),
    ...Object.keys(s.foodDays),
  ]);
  return [...dates]
    .filter((d) => inPeriod(d, days, end))
    .sort()
    .flatMap((date) => {
      const entries = s[`food_${date}`],
        old = s.dailySummary[date],
        complete = !!s.foodDays[date]?.complete;
      const t = entries
        ? totals(s, date)
        : old && +old.cal > 0
          ? { cal: +old.cal, p: +old.p || 0, f: +old.f || 0, c: +old.c || 0 }
          : null;
      if (!entries?.length && !t?.cal && !complete) return [];
      return [
        {
          date,
          ...(t || { cal: 0, p: 0, f: 0, c: 0 }),
          complete,
          legacyOnly: !entries && !!old,
          target: old?.targetCal
            ? {
                cal: old.targetCal,
                p: old.targetP,
                f: old.targetF,
                c: old.targetC,
              }
            : TARGET,
        },
      ];
    });
}
export function addFood(s, id, amount, date = dateKey()) {
  const f = s.foods.find((f) => f.id === id);
  if (!f) throw new Error("Продукт не найден.");
  const g = bounded(
    amount,
    0.01,
    f.unit === "piece" ? 100 : 20000,
    "Количество",
  );
  const ratio = f.unit === "piece" ? g : g / 100;
  (s[`food_${date}`] ||= []).push({
    id: uid(),
    name: f.name,
    foodId: f.id,
    g,
    unit: f.unit || "g",
    ...Object.fromEntries(
      ["cal", "p", "f", "c"].map((k) => [k, round(f[k] * ratio)]),
    ),
  });
  s.foodDays[date] = { ...s.foodDays[date], complete: false };
}
export function setMetric(s, field, value, date = dateKey()) {
  const n = bounded(
    value,
    field === "weight" ? 20 : 30,
    field === "weight" ? 400 : 300,
    field === "weight" ? "Вес" : "Талия",
  );
  let row = s.measurements.find((m) => m.date === date);
  if (!row) {
    row = { date };
    s.measurements.push(row);
  }
  row[field] = n;
  row.needsConfirmation = false;
  s.profile[field] = n;
}
export function trainingSessions(s, days, end = dateKey()) {
  const by = new Map();
  for (const [key, rows] of Object.entries(s.train)) {
    if (s.legacy.duplicateKeys.includes(key)) continue;
    const date = key.slice(0, 10),
      ex = exerciseById(key.slice(11));
    if (!inPeriod(date, days, end)) continue;
    const done = rows.filter((r) => r.done && validSet(ex, r));
    if (!done.length) continue;
    const reps = done.reduce((n, r) => n + number(r.reps), 0),
      numericLoad = done.every(
        (r) => number(r.load) !== null && !BANDS.includes(r.load),
      );
    const volume =
      numericLoad && !ex?.time
        ? round(done.reduce((n, r) => n + number(r.reps) * number(r.load), 0))
        : null;
    const id = ex?.id || key.slice(11),
      canonical = `${date}_${id}`,
      expectedSets = Math.max(ex?.s || 0, rows.length);
    if (!by.has(canonical) || key === canonical)
      by.set(canonical, {
        date,
        id,
        name: ex?.n || id,
        sets: done.length,
        reps,
        volume,
        expectedSets,
        complete: done.length === expectedSets,
        kind: ex?.time
          ? "time"
          : ex?.band || done.some((r) => BANDS.includes(r.load))
            ? "band"
            : "weight",
        loads: done.map((r) =>
          ex?.time
            ? null
            : BANDS.includes(r.load)
              ? r.load
              : (number(r.load) ?? 0),
        ),
        repetitions: done.map((r) => number(r.reps)),
        rir: round(done.reduce((n, r) => n + number(r.rir), 0) / done.length),
      });
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function sameSessionConditions(a, b) {
  return (
    !!a &&
    !!b &&
    a.id === b.id &&
    a.kind === b.kind &&
    a.sets === b.sets &&
    a.loads.every((load, i) => load === b.loads[i])
  );
}
export function exerciseTrend(current, previous, count) {
  const trend = {
    id: current.id,
    name: current.name,
    count,
    current,
    previous,
    metric: current.kind === "time" ? "секунды" : "повторы",
    rir: current.rir,
    pct: null,
    delta: null,
  };
  if (!current.complete)
    return {
      ...trend,
      status: "incomplete",
      label: "Не все подходы",
      reason: `Выполнено ${current.sets} из ${current.expectedSets} подходов. Сравнение появится после завершения упражнения.`,
    };
  if (!previous?.complete)
    return {
      ...trend,
      status: "first",
      label: "Первая запись",
      reason:
        "Для сравнения нужна предыдущая полностью записанная тренировка этого упражнения.",
    };
  if (current.sets !== previous.sets)
    return {
      ...trend,
      status: "sets",
      label: "Разное число подходов",
      reason:
        "Общий результат не сравнивается, когда число подходов различается.",
    };
  if (!sameSessionConditions(current, previous))
    return {
      ...trend,
      status: "load",
      label: current.kind === "band" ? "Другая резинка" : "Другой вес",
      reason:
        "Нагрузка изменилась. Процент повторов здесь не показывает рост или падение силы.",
    };
  const delta = current.reps - previous.reps;
  return {
    ...trend,
    delta,
    pct: round((delta / previous.reps) * 100),
    status: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    label: delta > 0 ? "Больше" : delta < 0 ? "Меньше" : "Без изменений",
    reason:
      current.kind === "time"
        ? "При одинаковом числе подходов"
        : "При одинаковой нагрузке и числе подходов",
  };
}
export function measureSeries(s, field, days, end = dateKey()) {
  return s.measurements
    .filter(
      (m) =>
        !m.needsConfirmation &&
        number(m[field]) !== null &&
        inPeriod(m.date, days, end),
    )
    .map((m) => ({ date: m.date, value: +m[field] }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function movingAverage(rows, days = 7) {
  return rows.map((row) => {
    const group = rows.filter((r) => inPeriod(r.date, days, row.date));
    return {
      ...row,
      value: round(group.reduce((n, r) => n + r.value, 0) / group.length),
    };
  });
}
export function analytics(s, days, end = dateKey()) {
  const nutrition = nutritionDays(s, days, end),
    completed = nutrition.filter((d) => d.complete),
    history = trainingSessions(s, 36500, end),
    sessions = history.filter((r) => inPeriod(r.date, days, end));
  const by = new Map();
  for (const x of sessions) {
    const a = by.get(x.id) || [];
    a.push(x);
    by.set(x.id, a);
  }
  const trends = [...by.values()].map((a) => {
    const current = a.at(-1);
    const previous = history.findLast(
      (r) => r.id === current.id && r.date < current.date && r.complete,
    );
    return exerciseTrend(current, previous, a.length);
  });
  return {
    nutrition,
    completed,
    sessions,
    trends,
    trainingDays: new Set(sessions.map((r) => r.date)).size,
    sets: sessions.reduce((n, r) => n + r.sets, 0),
    weight: measureSeries(s, "weight", days, end),
    waist: measureSeries(s, "waist", days, end),
  };
}
export function report(s, days, end = dateKey()) {
  const a = analytics(s, days, end),
    avg = (rows, k) =>
      rows.length
        ? round(rows.reduce((n, r) => n + r[k], 0) / rows.length)
        : null;
  const describe = (rows, unit) =>
    rows.length
      ? `${rows.at(-1).value} ${unit}; изменение ${round(rows.at(-1).value - rows[0].value)} ${unit}`
      : "нет подтверждённых замеров";
  const meanWeight = avg(measureSeries(s, "weight", 7, end), "value");
  const lines = [
    `MAX TIME — отчёт за ${days} дней`,
    `${shiftDate(end, 1 - days)} — ${end}`,
    `Режим: рекомпозиция. MMA временно отложено.`,
    ``,
    `ЗАМЕРЫ`,
    `Вес: ${describe(a.weight, "кг")}.`,
    `Средний вес за последние 7 календарных дней: ${meanWeight === null ? "нет данных" : meanWeight + " кг"}.`,
    `Талия: ${describe(a.waist, "см")}.`,
    ``,
    `ПИТАНИЕ`,
    `Дней с записями: ${a.nutrition.length}/${days}; подтверждённо завершено: ${a.completed.length}.`,
    `Цель сейчас: ${TARGET.cal} ккал · Б ${TARGET.p} · Ж ${TARGET.f} · У ${TARGET.c}.`,
  ];
  if (a.completed.length)
    lines.push(
      `Среднее по завершённым дням: ${avg(a.completed, "cal")} ккал; Б ${avg(a.completed, "p")}; Ж ${avg(a.completed, "f")}; У ${avg(a.completed, "c")}.`,
    );
  else lines.push("Среднее по полным дням пока не рассчитывается.");
  for (const d of a.nutrition)
    lines.push(
      `- ${d.date}: ${d.cal} ккал; Б ${d.p}; Ж ${d.f}; У ${d.c} — ${d.complete ? "день завершён" : d.legacyOnly ? "старая сводка без записей" : "неполный день"}.`,
    );
  lines.push(
    "",
    "ТРЕНИРОВКИ",
    `Тренировочных дней: ${a.trainingDays}. Выполненных корректно заполненных подходов: ${a.sets}.`,
  );
  for (const t of a.trends)
    lines.push(
      `- ${t.name}: ${t.current.date}, ${t.current.sets}/${t.current.expectedSets} подходов, ${t.current.reps} ${t.metric}; RIR ${t.rir}. ${t.pct === null ? t.label + ". " + t.reason : `${t.pct > 0 ? "+" : ""}${t.pct}% к предыдущей тренировке ${t.previous.date}: ${t.previous.reps} → ${t.current.reps} ${t.metric}. ${t.reason}.`}`,
      `  Подходы сейчас: ${t.current.repetitions.map((reps, i) => `${t.current.kind === "time" ? "" : t.current.loads[i] + (t.current.kind === "band" ? "" : " кг") + " × "}${reps}${t.current.kind === "time" ? " сек" : ""}`).join("; ")}.${t.previous ? ` Ранее (${t.previous.date}): ${t.previous.repetitions.map((reps, i) => `${t.previous.kind === "time" ? "" : t.previous.loads[i] + (t.previous.kind === "band" ? "" : " кг") + " × "}${reps}${t.previous.kind === "time" ? " сек" : ""}`).join("; ")}.` : ""}`,
    );
  if (!a.trends.length)
    lines.push("Для сравнения упражнений нужно минимум две тренировки.");
  lines.push("", "ПОСЛЕДНИЕ ЗАМЕРЫ");
  for (const m of s.measurements
    .filter((m) => !m.needsConfirmation && inPeriod(m.date, days, end))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10))
    lines.push(
      `- ${m.date}: вес ${m.weight ?? "—"} кг; талия ${m.waist ?? "—"} см.`,
    );
  lines.push(
    "",
    "Проанализируй рекомпозицию, силовой прогресс и восстановление без MMA. Учитывай неполные дни питания и пропуски замеров.",
  );
  return lines.join("\n");
}
