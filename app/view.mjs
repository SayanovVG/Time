import { PROGRAM, BANDS } from "./program.mjs";
import {
  VERSION,
  TARGET,
  dateKey,
  parseDate,
  shiftDate,
  selectedDate,
  rowsFor,
  previousRows,
  validSet,
  totals,
  nutritionDays,
  analytics,
  measureSeries,
  movingAverage,
  round,
  number,
} from "./model.mjs";
import {
  MEALS,
  SUPPLEMENTS,
  mealParts,
  mealTotals,
  allMeals,
  unitLabel,
} from "./nutrition.mjs";

export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  timer: "M9 2h6M12 8v5l3 2M19 5l1 1M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  back: "m15 6-6 6 6 6",
  next: "m9 6 6 6-6 6",
  train: "m4 7 13 13M2 9l7-7M15 22l7-7M1 6l5-5M18 23l5-5",
  food: "M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3c-4 4-4 9 0 9V3m0 9v9",
  chart: "M4 20V4m0 16h16M8 16v-4m5 4V8m5 8V4",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v6l3 2",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  info: "M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  play: "m9 5 11 7-11 7V5",
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.info}"/></svg>`;
const btn = (action, text, cls = "", attrs = "") =>
  `<button type="button" data-action="${action}" class="button ${cls}" ${attrs}>${text}</button>`;
export const formatDate = (d) =>
  parseDate(d)?.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  }) || d;
export const formatTime = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const plural = (n, one, few, many) => {
  const v = Math.abs(n) % 100,
    last = v % 10;
  return v >= 11 && v <= 14
    ? many
    : last === 1
      ? one
      : last >= 2 && last <= 4
        ? few
        : many;
};
const macros = (t) =>
  `${Math.round(t.cal)} ккал · Б ${round(t.p)} · Ж ${round(t.f)} · У ${round(t.c)}`;
const section = (name, content, cls = "") =>
  `<section class="panel ${cls}"><h2>${name}</h2>${content}</section>`;
const empty = (title, text) =>
  `<div class="empty-state">${icon("chart")}<strong>${title}</strong><p>${text}</p></div>`;
export function header(ui) {
  return `<a class="skip-link" href="#main">К содержимому</a><header class="app-header"><a href="./index-v2.html" class="brand" aria-label="MAX TIME — начало"><span class="brand-mark">M<span>／</span></span><span>MAX TIME<small>Сила и рекомпозиция</small></span></a><span class="version">${VERSION}</span></header><nav class="main-nav" aria-label="Разделы">${[
    ["training", "train", "Тренировки"],
    ["nutrition", "food", "Питание"],
    ["analytics", "chart", "Прогресс"],
  ]
    .map(
      ([id, img, text]) =>
        `<button type="button" class="nav-button ${ui.tab === id ? "selected" : ""}" data-action="tab" data-tab="${id}" aria-current="${ui.tab === id ? "page" : "false"}">${icon(img)}<span>${text}</span></button>`,
    )
    .join("")}</nav>`;
}
export function training(s, ui) {
  const day = PROGRAM[ui.day],
    today = dateKey(),
    past = ui.date < today,
    future = ui.date > today,
    locked = future || (past && !ui.editPast),
    exs = day.ex,
    done = exs.reduce(
      (n, ex) =>
        n +
        rowsFor(s, ui.date, ex).filter((r) => r.done && validSet(ex, r)).length,
      0,
    ),
    all = exs.reduce((n, ex) => n + ex.s, 0);
  return `${ui.focus ? `<header class="focus-header">${btn("focus-exit", icon("back") + "Обзор", "quiet")}<div><span>${formatDate(ui.date)}</span><strong>${ui.focusIndex + 1} / ${exs.length}</strong></div><span class="focus-count">${done}/${all}</span></header>` : `<div class="page-title"><div><span class="eyebrow">Твой план на неделю</span><h1>Тренировки</h1></div><label class="date-control"><span class="sr-only">Дата тренировки</span><input type="date" data-field="training-date" value="${ui.date}"></label></div><div class="week-tabs" aria-label="Программа по дням">${["Пн", "Вт", "Ср", "Чт", "Пт"].map((n, i) => `<button class="week-day ${ui.day === i + 1 ? "selected" : ""}" data-action="day" data-day="${i + 1}" aria-pressed="${ui.day === i + 1}"><span>${n}</span><strong>${parseDate(selectedDate(i + 1, ui.date)).getDate()}</strong></button>`).join("")}</div><section class="workout-heading"><div><span class="eyebrow">${formatDate(ui.date)}${past ? " · История" : future ? " · План" : " · Сегодня"}</span><h2>${esc(day.n)}</h2><p>${esc(day.note)}</p></div>${btn("focus-start", icon("play") + (done ? "Продолжить" : "Начать"), "primary", future ? "disabled" : "")}</section><div class="workout-progress"><span>${done} из ${all} подходов</span><span>${Math.round((done / all) * 100)}%</span><progress value="${done}" max="${all}" aria-label="Прогресс тренировки"></progress></div><div class="training-meta"><span>Тренажёры и резинки</span>${past ? btn("edit-past", ui.editPast ? "Закончить редактирование" : "Изменить запись", "text-button") : ""}</div>${past ? `<p class="notice">${ui.editPast ? "Редактирование истории включено." : "История сохранена. Для изменения нажмите «Изменить запись»."}</p>` : ""}${future ? '<p class="notice">Это будущая дата. Выполнение можно отмечать в день тренировки.</p>' : ""}`}
  <div class="exercise-list">${(ui.focus ? [exs[ui.focusIndex]] : exs).map((ex) => exercise(s, ui, ex, locked)).join("")}</div>${done === all ? `<section class="completion"><span>${icon("check")}</span><div><h2>Тренировка завершена</h2><p>${done} подходов сохранены. Теперь восстановление.</p></div></section>` : ""}${ui.focus ? `<nav class="focus-navigation" aria-label="Упражнения">${btn("focus-prev", icon("back") + "Назад", "secondary", ui.focusIndex === 0 ? "disabled" : "")}${btn("focus-next", "Следующее" + icon("next"), "primary", ui.focusIndex === exs.length - 1 ? "disabled" : "")}</nav>` : ""}`;
}
function exercise(s, ui, ex, locked) {
  const rows = rowsFor(s, ui.date, ex),
    prev = previousRows(s, ui.date, ex),
    done = rows.filter((r) => r.done && validSet(ex, r)).length,
    rest = s.cp[ex.id] || ex.rest,
    ready =
      done === ex.s && rows.every((r) => +r.reps >= ex.max && +r.rir >= ex.r);
  return `<article class="exercise-card ${done === ex.s ? "is-complete" : ""}" data-exercise="${ex.id}"><header class="exercise-header"><div><span class="exercise-type">${ex.time ? "На время" : ex.band ? "Резинка" : ex.machine ? "Тренажёр" : "Собственный вес"}</span><h3>${esc(ex.n)}</h3><p>${ex.s} × ${ex.min}–${ex.max}${ex.time ? " сек" : ""}<span>·</span> RIR ${ex.r}<span>·</span> отдых ${formatTime(rest)}</p></div><span class="exercise-count" aria-label="Выполнено ${done} из ${ex.s}">${done}<small>/${ex.s}</small></span></header><div class="exercise-help"><details><summary>${icon("info")}Техника и RIR</summary><p>${esc(ex.h)}</p><p>RIR — сколько повторений осталось в запасе. 0 — до отказа, 2 — ещё два повтора, 3+ — три или больше.</p>${ex.v ? `<a href="${esc(ex.v)}" target="_blank" rel="noopener noreferrer">Видео с техникой ↗</a>` : ""}</details>${btn("history", icon("history") + "История", "text-button", `data-ex="${ex.id}"`)}</div>
  <div class="sets-table ${ex.time ? "timed" : ""}"><div class="sets-labels" aria-hidden="true"><span>№</span><span>${ex.time ? "Секунды" : ex.band ? "Резинка" : "Вес, кг"}</span>${ex.time ? "" : "<span>Повторы</span>"}<span>RIR</span><span>Готово</span></div>${rows
    .map((r, i) => {
      const base = `data-ex="${ex.id}" data-index="${i}"`,
        ref = prev[i],
        previous = ref?.done
          ? `${ex.band ? ref.load : ref.load !== "" ? ref.load + " кг" : "Свой вес"} · ${ref.reps}${ex.time ? " сек" : " повт."} · RIR ${ref.rir}`
          : "";
      return `<div class="set-group ${r.done ? "done" : ""}"><div class="set-row"><span class="set-number">${i + 1}</span>${ex.time ? "" : ex.band ? `<select ${base} data-field="set-load" aria-label="${esc(ex.n)}, подход ${i + 1}: резинка" ${locked ? "disabled" : ""}><option value="">Выбрать</option>${BANDS.map((v, j) => `<option value="${esc(v)}" ${r.load === v ? "selected" : ""}>${["Красная", "Чёрная", "Фиолетовая", "Зелёная"][j]} · ${v.split(" ").slice(1).join(" ")}</option>`).join("")}</select>` : `<input ${base} data-field="set-load" inputmode="decimal" aria-label="${esc(ex.n)}, подход ${i + 1}: дополнительный вес в килограммах" placeholder="${["pullup", "dips", "legraise"].includes(ex.id) ? "0" : "кг"}" value="${esc(r.load)}" ${locked ? "readonly" : ""}>`}<input ${base} data-field="set-reps" inputmode="${ex.time ? "numeric" : "numeric"}" aria-label="${esc(ex.n)}, подход ${i + 1}: ${ex.time ? "секунды" : "повторения"}" placeholder="${ex.time ? ex.min : ex.min + "–" + ex.max}" value="${esc(r.reps)}" ${locked ? "readonly" : ""}><select ${base} data-field="set-rir" aria-label="${esc(ex.n)}, подход ${i + 1}: RIR" ${locked ? "disabled" : ""}>${[0, 1, 2, 3].map((v) => `<option value="${v}" ${+r.rir === v ? "selected" : ""}>${v === 3 ? "3+" : v}</option>`).join("")}</select><button class="set-check ${r.done ? "checked" : ""}" data-action="check-set" ${base} aria-label="${r.done ? "Снять отметку" : "Завершить"}: ${esc(ex.n)}, подход ${i + 1}" aria-pressed="${r.done}" ${locked ? "disabled" : ""}>${icon("check")}</button></div>${previous ? `<div class="previous">Было: ${esc(previous)}</div>` : ""}${ex.time ? `<div class="timed-row">${btn("duration-down", "−10", "quiet", `${base} ${locked ? "disabled" : ""} aria-label="Уменьшить время подхода ${i + 1} на 10 секунд"`)}<span>${r.reps || s.exerciseDurations[ex.id] || ex.min} сек</span>${btn("duration-up", "+10", "quiet", `${base} ${locked ? "disabled" : ""} aria-label="Увеличить время подхода ${i + 1} на 10 секунд"`)}${btn("exercise-timer", icon("play") + "Старт", "secondary", `${base} ${locked ? "disabled" : ""}`)}</div>` : ""}</div>`;
    })
    .join(
      "",
    )}</div>${ready ? '<p class="progression-note">Можно увеличить нагрузку на следующей тренировке.</p>' : ""}<footer class="exercise-footer"><span>Отдых между подходами</span>${btn("rest", icon("timer") + formatTime(rest), "rest-button", `data-ex="${ex.id}"`)}</footer></article>`;
}
const fold = (id, title, hint, content) =>
  `<details class="panel fold-panel" data-fold="${id}"><summary><span><strong>${title}</strong>${hint ? `<small>${hint}</small>` : ""}</span>${icon("next", "fold-chevron")}</summary><div class="fold-content">${content}</div></details>`;
function diary(s, entries) {
  const groups = new Map();
  for (const row of entries) {
    const key = row.mealEntryId || row.mealId || String(row.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const single = (r) =>
    `<div class="diary-row"><div><strong>${esc(r.name)}</strong><span>${r.g} ${unitLabel(r)} · ${Math.round(r.cal)} ккал</span></div>${btn("delete-food", icon("close"), "icon-button", `data-id="${esc(r.id)}" aria-label="Удалить ${esc(r.name)}"`)}</div>`;
  return [...groups.values()]
    .map((rows) => {
      const first = rows[0];
      if (!first.mealId) return single(first);
      const title =
        first.mealTitle ||
        allMeals(s).find((m) => m.id === first.mealId)?.title ||
        first.name;
      const total = rows.reduce((t, r) => t + r.cal, 0);
      return `<details class="diary-meal" data-fold="diary-${esc(first.mealEntryId || first.mealId)}"><summary><span class="diary-symbol">${icon("food")}</span><span><strong>${esc(title)}</strong><small>${rows.length} ${rows.length === 1 ? "продукт" : rows.length < 5 ? "продукта" : "продуктов"} · ${Math.round(total)} ккал</small></span>${icon("next", "fold-chevron")}</summary><div class="fold-content">${rows.map(single).join("")}</div></details>`;
    })
    .join("");
}
export function nutrition(s, ui) {
  const date = ui.foodDate,
    t = totals(s, date),
    today = dateKey(),
    future = date > today;
  const entries = s[`food_${date}`] || [],
    complete = !!s.foodDays[date]?.complete;
  const measured = s.measurements.find((m) => m.date === date),
    ratio = Math.min(1, t.cal / TARGET.cal);
  const meals = allMeals(s);
  return `<div class="page-title"><div><span class="eyebrow">Каждый день в зачёт</span><h1>Питание</h1></div><label class="date-control"><span class="sr-only">Дата питания</span><input type="date" data-field="food-date" max="${today}" value="${date}"></label></div>
    <section class="measure-quick" aria-labelledby="measure-title"><div class="compact-heading"><h2 id="measure-title">Замеры</h2>${btn("save-measures", "Сохранить", "text-button", future ? "disabled" : "")}</div><div class="measure-pair">${[
      ["weight", "Вес", "кг"],
      ["waist", "Талия", "см"],
    ]
      .map(
        ([key, label, unit]) =>
          `<label><span>${label}</span><div><input inputmode="decimal" data-field="metric" data-key="${key}" aria-label="${label}, ${unit}" placeholder="—" value="${esc(measured?.[key] ?? "")}"><span>${unit}</span></div></label>`,
      )
      .join(
        "",
      )}</div>${measured?.needsConfirmation ? '<p class="helper">Проверь старый замер: он мог быть создан автоматически.</p>' : ""}</section>
    <section class="nutrition-summary compact-nutrition" aria-label="Питание за день"><div class="calorie-overview"><div><span class="eyebrow">${complete ? "День завершён" : date === today ? "За сегодня" : "За день"}${date !== today ? " · " + formatDate(date) : ""}</span><div class="calorie-value">${Math.round(t.cal)}<span>ккал</span></div><p>${t.cal > TARGET.cal ? "Выше ориентира на " + Math.round(t.cal - TARGET.cal) : "Осталось " + Math.round(TARGET.cal - t.cal)} ккал</p></div><div class="calorie-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" class="ring-track"/><circle cx="50" cy="50" r="43" class="ring-value" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - ratio * 100}"/></svg><span>${Math.round(ratio * 100)}<small>% цели</small></span></div></div><div class="macro-inline">${[
      ["p", "Белки"],
      ["f", "Жиры"],
      ["c", "Углеводы"],
    ]
      .map(
        ([k, label]) =>
          `<div><span>${label}</span><strong>${Math.round(t[k])}<small> / ${TARGET[k]} г</small></strong><progress value="${Math.min(t[k], TARGET[k])}" max="${TARGET[k]}" aria-label="${label}"></progress></div>`,
      )
      .join("")}</div></section>
    <div class="food-primary-actions">${btn("add-product", icon("plus") + "Добавить еду", "primary", future ? "disabled" : "")}${btn("recipe-new", "Своё блюдо", "secondary")}</div>
    <section class="panel diary-panel"><div class="compact-heading"><h2>Дневник</h2>${entries.length ? btn("complete-food-day", complete ? "Открыть день" : "Завершить день", "text-button", future ? "disabled" : "") : ""}</div>${entries.length ? diary(s, entries) : '<div class="diary-empty"><span>' + icon("food") + "</span><p>Что сегодня на тарелке?</p><small>Добавь продукт или выбери своё блюдо.</small></div>"}</section>
    ${fold(
      "meals",
      "Мои блюда",
      `${meals.length} рецептов · редактировать состав и порции`,
      `<div class="recipe-list">${meals
        .map((m) => {
          const parts = mealParts(s, m),
            total = mealTotals(s, m),
            added =
              MEALS.some((base) => base.id === m.id) &&
              entries.some((r) => r.mealId === m.id);
          return `<article class="recipe-card"><div class="recipe-card-heading"><div>${m.time ? `<time>${esc(m.time)}</time>` : ""}<h3>${esc(m.title)}</h3></div><span>${Math.round(total.cal)}<small>ккал</small></span></div><p>${parts.map(({ food }) => esc(food?.name || "Продукт отсутствует")).join(" · ")}</p><div class="meal-actions">${btn("meal-edit", "Изменить состав", "quiet", `data-id="${esc(m.id)}"`)}${btn("meal-add", added ? icon("check") + "Записано" : icon("plus") + "Добавить", "secondary", `data-id="${esc(m.id)}" ${added || future ? "disabled" : ""}`)}</div></article>`;
        })
        .join(
          "",
        )}</div>${btn("recipe-new", icon("plus") + "Новое блюдо или коктейль", "quiet wide")}`,
    )}
    ${fold("supplements", "Добавки", "Отметить приём", SUPPLEMENTS.map((supp) => `<div class="supplement-row"><strong>${supp.name}</strong><p>${supp.text}</p><div>${supp.intakes.map((x) => `<button class="supplement-check ${s[`supplements_${date}`]?.[x.id] ? "checked" : ""}" data-action="supplement" data-id="${x.id}" aria-pressed="${!!s[`supplements_${date}`]?.[x.id]}">${icon("check")}${x.time}</button>`).join("")}</div></div>`).join(""))}`;
}
export function chart(rows, { moving = false, label = "" } = {}) {
  if (rows.length < 2)
    return empty("Пока мало замеров", "Для графика нужны хотя бы две записи.");
  const lo = Math.min(...rows.map((x) => x.value)),
    hi = Math.max(...rows.map((x) => x.value)),
    span = hi - lo || 1,
    start = +parseDate(rows[0].date),
    end = +parseDate(rows.at(-1).date),
    xy = (r) =>
      `${36 + ((+parseDate(r.date) - start) / (end - start || 1)) * 316},${132 - ((r.value - lo) / span) * 95}`,
    avg = moving ? movingAverage(rows) : [];
  return `<div class="chart"><svg viewBox="0 0 380 166" role="img" aria-label="${esc(label)}: от ${rows[0].value} до ${rows.at(-1).value}"><path d="M36 36H353M36 84H353M36 132H353" class="chart-grid"/><text x="0" y="40">${round(hi)}</text><text x="0" y="136">${round(lo)}</text><polyline pathLength="1" points="${rows.map(xy).join(" ")}" class="chart-line ${moving ? "subtle" : ""}"/>${moving ? `<polyline pathLength="1" points="${avg.map(xy).join(" ")}" class="chart-line"/>` : ""}${rows.map((r) => `<circle cx="${xy(r).split(",")[0]}" cy="${xy(r).split(",")[1]}" r="3" class="chart-point"><title>${r.date}: ${r.value}</title></circle>`).join("")}<text x="36" y="159">${formatDate(rows[0].date)}</text><text x="353" y="159" text-anchor="end">${formatDate(rows.at(-1).date)}</text></svg></div>`;
}
export function progress(s, ui, store) {
  const a = analytics(s, ui.period),
    copies = store.snapshots();
  const metric = ui.metric || "weight",
    series = metric === "weight" ? a.weight : a.waist;
  const unit = metric === "weight" ? "кг" : "см",
    last = series.at(-1)?.value;
  const delta = series.length > 1 ? round(last - series[0].value) : null;
  const avg = a.completed.length
    ? Math.round(
        a.completed.reduce((n, r) => n + r.cal, 0) / a.completed.length,
      )
    : null;
  return `<div class="page-title"><div><span class="eyebrow">Твой путь к результату</span><h1>Прогресс</h1></div>${btn("preview-report", icon("download"), "icon-button", 'aria-label="Отчёт для Макса"')}</div>
    <div class="period-selector" aria-label="Период">${[7, 14, 28].map((n) => btn("period", n + " дней", ui.period === n ? "selected" : "", `data-days="${n}" aria-pressed="${ui.period === n}"`)).join("")}</div>
    <section class="panel progress-feature"><div class="metric-tabs" aria-label="График замеров">${[
      ["weight", "Вес"],
      ["waist", "Талия"],
    ]
      .map(([id, label]) =>
        btn(
          "chart-metric",
          label,
          metric === id ? "selected" : "",
          `data-metric="${id}" aria-pressed="${metric === id}"`,
        ),
      )
      .join(
        "",
      )}</div><div class="progress-reading"><strong>${last ?? "—"}<small>${unit}</small></strong><span>${delta === null ? "Добавляй замеры в питании" : `${delta > 0 ? "+" : ""}${delta} ${unit} за ${ui.period} дней`}</span></div>${chart(series, { moving: metric === "weight", label: metric === "weight" ? "Вес" : "Талия" })}${series.length >= 2 && metric === "weight" ? '<p class="chart-caption">Яркая линия — среднее за 7 дней</p>' : ""}</section>
    <section class="overview-lines" aria-label="Итоги периода"><div><span class="overview-icon">${icon("train")}</span><div><strong>${a.trainingDays} ${plural(a.trainingDays, "тренировочный день", "тренировочных дня", "тренировочных дней")}</strong><span>${a.sets} ${plural(a.sets, "выполненный подход", "выполненных подхода", "выполненных подходов")}</span></div></div><div><span class="overview-icon food-tone">${icon("food")}</span><div><strong>${avg === null ? "Питание пока без среднего" : `${avg} ккал в среднем`}</strong><span>${a.completed.length} ${plural(a.completed.length, "завершённый день", "завершённых дня", "завершённых дней")} из ${ui.period}</span></div></div></section>
    <div class="report-action">${btn("preview-report", "Отчёт для Макса" + icon("next"), "secondary wide")}</div>
    ${fold("strength", "Силовые показатели", "Динамика по упражнениям", a.trends.length ? a.trends.map((t) => `<div class="trend-row"><div><strong>${esc(t.name)}</strong><span>${t.count} тренировок · ${t.metric} · RIR ${t.rir}</span></div><b class="${t.pct > 0 ? "positive" : ""}">${t.pct > 0 ? "+" : ""}${t.pct}%</b></div>`).join("") : empty("Сравнение появится позже", "Нужны две тренировки одного упражнения."))}
    ${fold(
      "measurements",
      "История замеров",
      `${s.measurements.length} ${plural(s.measurements.length, "запись", "записи", "записей")}`,
      `<label class="height-field">Рост, см<input inputmode="numeric" data-field="height" placeholder="см" value="${esc(s.profile.height ?? "")}"></label>${
        s.measurements.length
          ? `<div class="measurement-table">${s.measurements
              .slice()
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(
                (m) =>
                  `<div><span>${formatDate(m.date)}</span><strong>${m.weight ?? "—"} кг · ${m.waist ?? "—"} см</strong>${m.needsConfirmation ? btn("confirm-measure", "Подтвердить", "quiet", `data-date="${m.date}"`) : ""}${btn("edit-measure", "Изменить", "text-button", `data-date="${m.date}"`)}</div>`,
              )
              .join("")}</div>`
          : '<p class="helper">Пока нет замеров.</p>'
      }`,
    )}
    ${fold(
      "nutrition-history",
      "История питания",
      "Завершённые и неполные дни",
      a.nutrition.length
        ? a.nutrition
            .slice()
            .reverse()
            .map(
              (d) =>
                `<div class="nutrition-history-row"><div><strong>${formatDate(d.date)}</strong><span>${d.complete ? "День завершён" : "Неполная запись"}</span></div><b>${Math.round(d.cal)} ккал</b></div>`,
            )
            .join("") +
            '<p class="helper">В среднем учитываются только завершённые дни.</p>'
        : '<p class="helper">Пока нет записей питания.</p>',
    )}
    ${fold(
      "backups",
      "Данные и резервные копии",
      "Экспорт, импорт и восстановление",
      `<p class="helper">Экспорт сохрани отдельно: он защитит журнал при потере телефона.</p><div class="section-actions">${btn("export", icon("download") + "Экспорт", "primary")}${btn("import", "Импорт", "secondary")}</div><h3 class="subheading">Автокопии</h3>${
        copies.length
          ? copies
              .slice()
              .reverse()
              .map(
                (b) =>
                  `<div class="backup-row"><div><strong>${new Date(b.at).toLocaleString("ru-RU")}</strong><span>Полный журнал</span></div>${btn("restore", "Восстановить", "quiet", `data-id="${esc(b.id)}"`)}</div>`,
              )
              .join("")
          : '<p class="helper">Копия появится после изменения журнала.</p>'
      }${s.legacy.duplicateKeys.length ? `<p class="notice">${s.legacy.duplicateKeys.length} старых записей похожи на копии. Оригиналы сохранены.</p>${btn("include-duplicates", "Учитывать все старые записи", "quiet")}` : ""}${s.legacy.warnings?.length ? `<details class="migration-notes"><summary>Примечания к старым данным</summary>${s.legacy.warnings.map((w) => `<p>${esc(w)}</p>`).join("")}</details>` : ""}`,
    )}`;
}
export function shell(s, ui, store) {
  return `${ui.focus ? "" : header(ui)}<main id="main" data-view="${ui.tab}" class="app-main ${ui.focus ? "focus-main" : ""}">${ui.tab === "training" ? training(s, ui) : ui.tab === "nutrition" ? nutrition(s, ui) : progress(s, ui, store)}</main><footer class="app-footer">MAX TIME <span>${VERSION}</span><span id="save-status" role="status">${store.warning ? "Нужен экспорт" : "Сохранено на устройстве"}</span></footer>`;
}
