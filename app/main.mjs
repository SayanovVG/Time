import { PROGRAM } from "./program.mjs";
import { Store, MAX_IMPORT_BYTES } from "./store.mjs";
import {
  VERSION,
  TARGET,
  dateKey,
  parseDate,
  selectedDate,
  rowsFor,
  previousRows,
  validSet,
  setInput,
  number,
  bounded,
  uid,
  round,
  totals,
  addFood,
  setMetric,
  exerciseById,
  trainingSessions,
  report,
} from "./model.mjs";
import {
  MEALS,
  SUPPLEMENTS,
  mealParts,
  mealTotals,
  allMeals,
  saveRecipe,
  unitLabel,
  addMeal,
  makeProduct,
} from "./nutrition.mjs";
import { WorkoutTimer, createBell } from "./timer.mjs";
import { shell, esc, icon, formatTime, formatDate, chart } from "./view.mjs";

const root = document.getElementById("app"),
  dialog = document.getElementById("dialog"),
  toast = document.getElementById("toast"),
  errorBar = document.getElementById("error-bar");
const ui = {
  tab: "training",
  date: dateKey(),
  foodDate: dateKey(),
  day: Math.min(5, new Date().getDay() || 5),
  period: 28,
  focus: false,
  focusIndex: 0,
  editPast: false,
  metric: "weight",
  folds: {},
};
let storage;
try {
  storage = localStorage;
} catch {
  storage = {
    getItem() {
      throw new Error("Хранилище браузера недоступно.");
    },
    setItem() {
      throw new Error("Хранилище браузера недоступно.");
    },
  };
}
const store = new Store(storage),
  bell = createBell({
    onError: () =>
      notify(
        "Не удалось загрузить звуки. Подключись к сети и открой таймер снова.",
      ),
  });
let wakeLock = null,
  modalReturnFocus = null,
  searchController = null,
  searchTimeout = null,
  onlineFoods = [],
  toastTimeout,
  registration,
  sessionTimer,
  recipeDraft = null,
  recipeProductIndex = null;
const installed =
  ["standalone", "fullscreen", "minimal-ui"].some(
    (mode) => matchMedia(`(display-mode: ${mode})`).matches,
  ) || navigator.standalone === true;
function showError(message) {
  errorBar.hidden = false;
  errorBar.querySelector("span").textContent = message;
}
function notify(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => (toast.hidden = true), 2600);
}
function render({ top = false } = {}) {
  const y = window.scrollY;
  for (const detail of root.querySelectorAll("details[data-fold]"))
    ui.folds[detail.dataset.fold] = detail.open;
  const previousTab = root.querySelector('.main-nav [aria-current="page"]')
    ?.dataset.tab;
  root.innerHTML = shell(store.state, ui, store);
  for (const detail of root.querySelectorAll("details[data-fold]"))
    detail.open = !!ui.folds[detail.dataset.fold];
  if (top) root.querySelector("main")?.classList.add("view-enter");
  const nav = root.querySelector(".main-nav");
  if (nav && previousTab !== ui.tab) {
    nav.classList.add("nav-enter");
    nav.style.setProperty(
      "--from",
      ["training", "nutrition", "analytics"].indexOf(previousTab || ui.tab),
    );
    nav.style.setProperty(
      "--active",
      ["training", "nutrition", "analytics"].indexOf(ui.tab),
    );
  }
  document.body.classList.toggle("focus-mode", ui.focus);
  if (top)
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  else window.scrollTo(0, y);
  if (store.warning) showError(store.warning);
}
function commit(fn, options) {
  store.commit(fn, options);
  errorBar.hidden = true;
  if (store.warning) showError(store.warning);
  const status = document.getElementById("save-status");
  if (status)
    status.textContent = store.warning
      ? "Нужен экспорт"
      : "Сохранено на устройстве";
}
function openModal(title, body, kind = "generic") {
  modalReturnFocus = document.activeElement;
  dialog.dataset.kind = kind;
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Закрыть">${icon("close")}</button></div><div id="dialog-error" role="alert" hidden></div>${body}`;
  if (!dialog.open) dialog.showModal();
}
function closeModal() {
  if (dialog.dataset.kind === "recipe-product" && recipeDraft) {
    drawRecipe();
    return;
  }
  recipeDraft = null;
  if (dialog.dataset.kind === "timer") timer.stop();
  dialog.close();
  searchController?.abort();
  clearTimeout(searchTimeout);
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
}
function modalError(text) {
  const target = document.getElementById("dialog-error");
  if (dialog.open && target) {
    target.textContent = text;
    target.hidden = false;
  } else showError(text);
}
function download(text, name) {
  const blob = new Blob([text], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportData() {
  download(
    store.recoveryRaw || store.export(),
    `max-time-${store.recoveryRaw ? "исходные-данные-" : ""}${dateKey()}.json`,
  );
  notify("Полный экспорт подготовлен");
}
function writableWorkout() {
  if (ui.date > dateKey())
    throw new Error("Нельзя отмечать будущую тренировку.");
  if (ui.date < dateKey() && !ui.editPast)
    throw new Error("Сначала включите редактирование истории.");
}
function updateSet(s, ex, index, edit) {
  const key = `${ui.date}_${ex.id}`,
    rows = rowsFor(s, ui.date, ex);
  edit(rows[index], rows);
  s.train[key] = rows;
  s.legacy.duplicateKeys = s.legacy.duplicateKeys.filter((k) => k !== key);
}
function flushVisibleSets() {
  if (
    ui.tab !== "training" ||
    ui.date > dateKey() ||
    (ui.date < dateKey() && !ui.editPast) ||
    store.recoveryRaw
  )
    return;
  const changes = [...root.querySelectorAll('[data-field^="set-"]')].filter(
    (field) => {
      const ex = exerciseById(field.dataset.ex),
        row = rowsFor(store.state, ui.date, ex)[+field.dataset.index];
      return String(row[field.dataset.field.slice(4)]) !== field.value;
    },
  );
  if (!changes.length) return;
  commit((s) => {
    for (const field of changes) {
      const { ex: id, index, field: kind } = field.dataset;
      try {
        updateSet(s, exerciseById(id), +index, (r) =>
          setInput(exerciseById(id), r, kind.slice(4), field.value),
        );
        field.removeAttribute("aria-invalid");
      } catch (error) {
        field.setAttribute("aria-invalid", "true");
        throw error;
      }
    }
  });
}
function flushVisibleMetrics() {
  if (ui.tab !== "nutrition" || store.recoveryRaw) return;
  const saved = store.state.measurements.find((m) => m.date === ui.foodDate);
  const fields = [...root.querySelectorAll('[data-field="metric"]')].filter(
    (field) =>
      field.value.trim() !== "" &&
      number(field.value) !== saved?.[field.dataset.key],
  );
  if (!fields.length) return;
  commit((s) => {
    for (const field of fields) {
      try {
        setMetric(s, field.dataset.key, field.value, ui.foodDate);
        field.removeAttribute("aria-invalid");
      } catch (error) {
        field.setAttribute("aria-invalid", "true");
        throw error;
      }
    }
  });
}

const timer = new WorkoutTimer({
  onChange: timerChanged,
  onEnd: (done) => {
    try {
      sessionStorage.removeItem("max_time_active_timer_v3");
    } catch {}
    bell.ring();
    if (dialog.dataset.kind === "timer") {
      document.getElementById("timer-number").textContent = "0:00";
      document.getElementById("timer-arc").style.strokeDashoffset = "100";
      document.getElementById("timer-stage").textContent = "Готово";
      dialog.classList.remove("last-seconds");
      dialog.classList.add("timer-finished");
      setTimeout(() => {
        if (!timer.current && dialog.dataset.kind === "timer") dialog.close();
      }, 1600);
    }
    notify(
      done.mode === "exercise"
        ? "Время упражнения вышло. Отметь выполненный подход."
        : "Отдых закончен",
    );
  },
});
function timerChanged(snapshot) {
  bell.sync(snapshot);
  try {
    if (snapshot)
      sessionStorage.setItem(
        "max_time_active_timer_v3",
        JSON.stringify(timer.current),
      );
    else sessionStorage.removeItem("max_time_active_timer_v3");
  } catch {}
  if (!snapshot) {
    if (dialog.dataset.kind === "timer") dialog.close();
    return;
  }
  if (!dialog.open || dialog.dataset.kind !== "timer")
    openModal(
      snapshot.mode === "exercise" ? "Время упражнения" : "Отдых",
      `<p class="timer-name">${esc(snapshot.name)}</p><div class="timer-dial"><svg viewBox="0 0 280 280" aria-hidden="true"><circle class="timer-ticks" cx="140" cy="140" r="134" pathLength="120"/><circle class="timer-track" cx="140" cy="140" r="119"/><circle id="timer-arc" class="timer-arc" cx="140" cy="140" r="119" pathLength="100"/></svg><div class="timer-face"><span id="timer-stage">${snapshot.mode === "exercise" ? "Работа" : "Восстановление"}</span><div class="timer-number" id="timer-number" aria-live="off"></div><span class="timer-total" id="timer-total"></span></div></div><div class="timer-adjust">${[-1, 1].map((n) => `<button class="button secondary" data-action="timer-adjust" data-delta="${n * (snapshot.mode === "exercise" ? 10 : 15)}">${n < 0 ? "−" : "+"}${snapshot.mode === "exercise" ? 10 : 15} сек</button>`).join("")}</div><button id="timer-save" class="button primary wide" data-action="timer-save" hidden>Сохранить длительность</button><button class="button quiet wide" data-action="timer-stop">${snapshot.mode === "exercise" ? "Остановить" : "Завершить отдых"}</button>`,
      "timer",
    );
  dialog.classList.remove("timer-finished");
  dialog.classList.toggle("last-seconds", snapshot.left <= 10);
  const digits = document.getElementById("timer-number"),
    next = formatTime(snapshot.left);
  if (digits.textContent !== next) {
    digits.textContent = next;
    if (
      snapshot.left <= 10 &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      digits.animate(
        [
          { transform: "scale(1.065)", opacity: 0.65 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 380, easing: "ease-out" },
      );
  }
  document.getElementById("timer-arc").style.strokeDashoffset =
    100 - (snapshot.left / snapshot.seconds) * 100;
  document.getElementById("timer-total").textContent =
    "из " + formatTime(snapshot.seconds);
  document.getElementById("timer-stage").textContent =
    snapshot.left <= 10
      ? snapshot.mode === "exercise"
        ? "Финиш"
        : "Приготовься"
      : snapshot.mode === "exercise"
        ? "Работа"
        : "Восстановление";
  document.getElementById("timer-save").hidden = !snapshot.modified;
}
setInterval(() => timer.tick(), 250);
dialog.addEventListener("cancel", (event) => {
  if (dialog.dataset.kind === "timer") timer.stop();
  if (dialog.dataset.kind === "recipe-product" && recipeDraft) {
    event.preventDefault();
    drawRecipe();
  } else recipeDraft = null;
  searchController?.abort();
});
document.addEventListener("pointerdown", () => bell.unlock(), { once: true });
async function fullscreen(on) {
  try {
    if (on) {
      if (
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      )
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
      if (navigator.wakeLock)
        wakeLock = await navigator.wakeLock.request("screen");
    } else {
      await wakeLock?.release();
      wakeLock = null;
      if (!installed && document.fullscreenElement)
        await document.exitFullscreen();
    }
  } catch {}
}
function startTimer(ex, mode, index) {
  const rows = rowsFor(store.state, ui.date, ex),
    seconds =
      mode === "rest"
        ? store.state.cp[ex.id] || ex.rest
        : number(rows[index].reps) ||
          store.state.exerciseDurations[ex.id] ||
          ex.min;
  if (mode === "exercise") {
    writableWorkout();
    commit((s) => updateSet(s, ex, index, (r) => (r.reps = seconds)));
  }
  bell.unlock();
  timer.start(seconds, { mode, exId: ex.id, name: ex.n, index, date: ui.date });
}

function productDialog() {
  recipeDraft = null;
  onlineFoods = [];
  openModal(
    "Добавить еду",
    `<label class="search-label">Найти продукт<input type="search" id="food-search" placeholder="Название продукта" autocomplete="off"></label><div class="search-tools"><button class="button quiet" data-action="online-search">Поиск в интернете</button><button class="button secondary" data-action="custom-product">Свой продукт</button></div><div id="search-status" role="status"></div><div id="food-results"></div>`,
    "food-search",
  );
  drawFoods("");
  document.getElementById("food-search").focus();
}
function drawFoods(q) {
  const local = store.state.foods
      .filter((f) =>
        f.name.toLocaleLowerCase("ru").includes(q.toLocaleLowerCase("ru")),
      )
      .slice(0, 30),
    seen = new Set(local.map((f) => f.name.toLowerCase())),
    rows = [
      ...local,
      ...onlineFoods.filter((f) => !seen.has(f.name.toLowerCase())),
    ];
  const target = document.getElementById("food-results");
  if (!target) return;
  target.innerHTML = rows.length
    ? rows
        .map(
          (f) =>
            `<div class="food-result"><div><strong>${esc(f.name)}</strong><small>${Math.round(f.cal)} ккал · Б ${f.p} · Ж ${f.f} · У ${f.c} / ${f.unit === "piece" ? "1 шт." : "100 " + unitLabel(f)}</small></div><button class="icon-button" data-action="choose-food" data-id="${esc(f.id)}" aria-label="Добавить ${esc(f.name)}">${icon("plus")}</button></div>`,
        )
        .join("")
    : '<p class="empty-message">Продукт не найден. Можно добавить свой.</p>';
}
async function onlineSearch() {
  const field = document.getElementById("food-search"),
    q = field?.value.trim();
  if (!q || q.length < 2) {
    modalError("Введите минимум два символа.");
    return;
  }
  searchController?.abort();
  const controller = (searchController = new AbortController()),
    timeout = setTimeout(() => controller.abort(), 8000),
    status = document.getElementById("search-status");
  status.textContent = "Ищу продукты…";
  try {
    const response = await fetch(
      "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" +
        encodeURIComponent(q) +
        "&search_simple=1&action=process&json=1&page_size=10",
      { signal: controller.signal },
    );
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (
      controller !== searchController ||
      document.getElementById("food-search")?.value.trim() !== q
    )
      return;
    onlineFoods = (result.products || []).flatMap((p) => {
      const n = p.nutriments || {};
      try {
        return [
          makeProduct({
            name: p.product_name_ru || p.product_name,
            cal: n["energy-kcal_100g"],
            p: n.proteins_100g,
            f: n.fat_100g,
            c: n.carbohydrates_100g,
          }),
        ];
      } catch {
        return [];
      }
    });
    drawFoods(q);
    status.textContent = onlineFoods.length
      ? "Данные из Open Food Facts. Сверьте с этикеткой."
      : "Дополнительных результатов нет.";
  } catch {
    if (controller === searchController && status.isConnected)
      status.textContent =
        "Интернет-поиск недоступен. Локальные продукты и ручной ввод работают.";
  } finally {
    clearTimeout(timeout);
  }
}
function amountDialog(f) {
  openModal(
    "Количество",
    `<form id="food-amount-form" data-id="${esc(f.id)}"><h3>${esc(f.name)}</h3><label>${"Количество, " + unitLabel(f)}<input name="amount" inputmode="decimal" value="${f.unit === "piece" ? 1 : 100}" required></label><p class="helper">На ${f.unit === "piece" ? "1 шт." : "100 " + unitLabel(f)}: ${Math.round(f.cal)} ккал · Б ${f.p} · Ж ${f.f} · У ${f.c}</p><button class="button primary wide">Добавить в дневник</button></form>`,
    "food-amount",
  );
  dialog.querySelector("input").select();
}
function customProductDialog() {
  openModal(
    "Свой продукт",
    `<p class="helper">Перенеси КБЖУ с упаковки протеина, напитка или другого продукта.</p><form id="custom-product-form"><label>Название<input name="name" maxlength="150" required></label><label>Значения указаны<select name="unit"><option value="g">На 100 г</option><option value="ml">На 100 мл</option><option value="piece">На 1 штуку</option></select></label><div class="form-grid">${[
      ["cal", "Калории"],
      ["p", "Белок, г"],
      ["f", "Жиры, г"],
      ["c", "Углеводы, г"],
    ]
      .map(
        ([n, l]) =>
          `<label>${l}<input name="${n}" inputmode="decimal" required></label>`,
      )
      .join(
        "",
      )}</div><button class="button primary wide">Сохранить продукт</button></form>`,
    recipeDraft ? "recipe-product" : "custom-product",
  );
}
function readRecipeDraft() {
  const form = dialog.querySelector("#meal-form");
  if (!form || !recipeDraft) return;
  recipeDraft.title = form.elements.title.value;
  recipeDraft.time = form.elements.time.value;
  recipeDraft.items = [...form.querySelectorAll(".ingredient-row")].map(
    (row, i) => [
      row.querySelector("select").value || recipeDraft.items[i]?.[0] || "",
      row.querySelector("input").value,
    ],
  );
}
function recipeOptions(selected) {
  return `<option value="">Выбрать продукт</option>${store.state.foods.map((f) => `<option value="${esc(f.id)}" ${f.id === selected ? "selected" : ""}>${esc(f.name)}</option>`).join("")}`;
}
function drawRecipe() {
  openModal(
    recipeDraft.id ? "Изменить блюдо" : "Своё блюдо или коктейль",
    `<form id="meal-form"><label>Название<input name="title" maxlength="150" placeholder="Например, мой коктейль" value="${esc(recipeDraft.title)}" required></label><label class="recipe-time">Время приёма <span class="helper">необязательно</span><input name="time" type="time" value="${esc(recipeDraft.time)}"></label><div class="compact-heading"><h3>Состав</h3></div><div class="ingredient-list">${recipeDraft.items
      .map(([id, amount], i) => {
        const f = store.state.foods.find((f) => f.id === id);
        return `<div class="ingredient-row"><label class="ingredient-product">Продукт ${i + 1}<select data-field="recipe-food" aria-label="Ингредиент ${i + 1}" required>${recipeOptions(id)}</select></label><label class="ingredient-amount">Количество, ${unitLabel(f)}<input inputmode="decimal" value="${esc(amount)}" aria-label="Количество ингредиента ${i + 1}" required></label><button class="icon-button ingredient-remove" type="button" data-action="recipe-remove" data-index="${i}" aria-label="Убрать ингредиент ${i + 1}">${icon("close")}</button></div>`;
      })
      .join(
        "",
      )}</div><div class="recipe-tools"><button class="button secondary" type="button" data-action="recipe-ingredient">${icon("plus")}Ингредиент</button><button class="button quiet" type="button" data-action="recipe-product">Новый продукт по этикетке</button></div><div class="recipe-total" id="recipe-total" aria-live="polite"></div><button class="button primary wide">Сохранить рецепт</button><p class="helper">Сохраняется как одна порция. Записи прошлых дней не изменятся.</p></form>`,
    "recipe",
  );
  drawRecipeTotal();
}
function drawRecipeTotal() {
  const target = document.getElementById("recipe-total");
  if (!target) return;
  try {
    const valid = recipeDraft.items.every(
      ([id, value]) =>
        store.state.foods.some((f) => f.id === id) && number(value) > 0,
    );
    if (!valid || !recipeDraft.items.length) {
      target.textContent = "Укажи продукты и количество";
      return;
    }
    const t = mealTotals({ ...store.state, mealPortions: {} }, recipeDraft);
    target.innerHTML = `<span>Вся порция</span><strong>${Math.round(t.cal)} ккал</strong><small>Б ${round(t.p)} · Ж ${round(t.f)} · У ${round(t.c)}</small>`;
  } catch {
    target.textContent = "Проверь количество ингредиентов";
  }
}
function mealDialog(meal) {
  recipeProductIndex = null;
  recipeDraft = meal
    ? {
        id: meal.id,
        title: meal.title,
        time: meal.time || "",
        items: mealParts(store.state, meal).map(({ food, amount }) => [
          food?.id || "",
          amount,
        ]),
      }
    : { id: null, title: "", time: "", items: [["", 100]] };
  drawRecipe();
}
function importDialog() {
  openModal(
    "Восстановить журнал",
    `<p>Выберите полный экспорт MAX TIME. Перед восстановлением текущий журнал попадёт в автокопию.</p><input id="backup-file" type="file" accept=".json,application/json" aria-label="Файл резервной копии"><p class="helper">Максимум 12 МБ. Некорректный файл не изменит журнал.</p>`,
  );
}
async function copyReport() {
  const text = report(store.state, ui.period);
  try {
    await navigator.clipboard.writeText(text);
    notify("Отчёт скопирован");
  } catch {
    openModal(
      "Скопируйте отчёт",
      `<p>Автоматическое копирование недоступно. Выделите и скопируйте текст.</p><textarea class="report-text" readonly>${esc(text)}</textarea>`,
    );
    dialog.querySelector("textarea").select();
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const { action, ex: exId, index: indexValue, id } = button.dataset,
    index = +indexValue,
    ex = exerciseById(exId);
  try {
    if (
      root.contains(button) &&
      !["export", "import", "restore"].includes(action)
    ) {
      flushVisibleSets();
      flushVisibleMetrics();
    }
    switch (action) {
      case "save-measures":
        if (
          ![...root.querySelectorAll('[data-field="metric"]')].some((f) =>
            f.value.trim(),
          )
        )
          throw new Error("Введи вес или талию.");
        flushVisibleMetrics();
        notify("Замеры сохранены");
        break;
      case "tab":
        ui.tab = button.dataset.tab;
        ui.focus = false;
        await fullscreen(false);
        render({ top: true });
        break;
      case "day":
        ui.day = +button.dataset.day;
        ui.date = selectedDate(ui.day, ui.date);
        ui.editPast = false;
        render();
        break;
      case "edit-past":
        ui.editPast = !ui.editPast;
        render();
        break;
      case "focus-start":
        ui.focus = true;
        ui.focusIndex = Math.max(
          0,
          PROGRAM[ui.day].ex.findIndex((ex) =>
            rowsFor(store.state, ui.date, ex).some(
              (r) => !r.done || !validSet(ex, r),
            ),
          ),
        );
        await fullscreen(true);
        render({ top: true });
        break;
      case "focus-exit":
        ui.focus = false;
        await fullscreen(false);
        render({ top: true });
        break;
      case "focus-prev":
        ui.focusIndex = Math.max(0, ui.focusIndex - 1);
        render({ top: true });
        break;
      case "focus-next":
        ui.focusIndex = Math.min(
          PROGRAM[ui.day].ex.length - 1,
          ui.focusIndex + 1,
        );
        render({ top: true });
        break;
      case "check-set": {
        writableWorkout();
        if (
          button
            .closest(".exercise-card")
            .querySelector('[aria-invalid="true"]')
        )
          throw new Error("Сначала исправьте выделенное поле.");
        let completed = false;
        commit((s) => {
          updateSet(s, ex, index, (r, rows) => {
            if (!r.done) {
              const old = previousRows(s, ui.date, ex)[index];
              if (old?.done) {
                if (r.reps === "") r.reps = old.reps;
                if (r.load === "") r.load = old.load;
              }
              if (!validSet(ex, r))
                throw new Error(
                  ex.band
                    ? "Выберите резинку и введите повторения."
                    : ex.time
                      ? "Введите время подхода."
                      : "Введите повторения и нагрузку; для собственного веса допустимо 0 кг.",
                );
            }
            r.done = !r.done;
            completed = r.done;
            if (completed && index + 1 < rows.length) {
              const next = rows[index + 1];
              if (!next.done) {
                if (next.load === "") next.load = r.load;
                if (next.reps === "") next.reps = r.reps;
              }
            }
          });
          const meta = (s.workoutMeta[ui.date] ||= {});
          if (completed && !meta.startedAt) meta.startedAt = Date.now();
          const all = PROGRAM[ui.day].ex.every((x) =>
            rowsFor(s, ui.date, x).every((r) => r.done && validSet(x, r)),
          );
          if (all) meta.completedAt = Date.now();
          else delete meta.completedAt;
        });
        render();
        if (completed) {
          notify("Подход сохранён");
          if (index < ex.s - 1) startTimer(ex, "rest", index);
          else if (ui.focus && ui.focusIndex < PROGRAM[ui.day].ex.length - 1) {
            ui.focusIndex++;
            render({ top: true });
          }
        }
        break;
      }
      case "rest":
        startTimer(ex, "rest", 0);
        break;
      case "exercise-timer":
        startTimer(ex, "exercise", index);
        break;
      case "duration-up":
      case "duration-down":
        writableWorkout();
        commit((s) =>
          updateSet(
            s,
            ex,
            index,
            (r) =>
              (r.reps = Math.max(
                10,
                Math.min(
                  7200,
                  (number(r.reps) || s.exerciseDurations[ex.id] || ex.min) +
                    (action === "duration-up" ? 10 : -10),
                ),
              )),
          ),
        );
        render();
        break;
      case "timer-adjust":
        timer.adjust(+button.dataset.delta);
        break;
      case "timer-stop":
        timer.stop();
        break;
      case "timer-save": {
        const snap = timer.snapshot();
        if (!snap) break;
        commit((s) => {
          if (snap.mode === "rest") s.cp[snap.exId] = snap.seconds;
          else {
            const exercise = exerciseById(snap.exId),
              rows = rowsFor(s, snap.date, exercise);
            rows[snap.index].reps = snap.seconds;
            s.train[`${snap.date}_${snap.exId}`] = rows;
            s.exerciseDurations[snap.exId] = snap.seconds;
          }
        });
        timer.current.modified = false;
        timerChanged(timer.snapshot());
        render();
        notify("Длительность сохранена");
        break;
      }
      case "history": {
        const rows = trainingSessions(store.state, 36500)
          .filter((r) => r.id === exId)
          .slice(-10);
        openModal(
          esc(ex.n),
          chart(
            rows.map((r) => ({ date: r.date, value: r.volume ?? r.reps })),
            { label: "История упражнения" },
          ) +
            rows
              .map(
                (r) =>
                  `<p class="history-row"><strong>${formatDate(r.date)}</strong><span>${r.sets} подхода · ${r.volume !== null ? r.volume + " кг × повт." : r.reps + " повт. / сек"} · RIR ${r.rir}</span></p>`,
              )
              .join(""),
        );
        break;
      }
      case "recipe-new":
        mealDialog(null);
        break;
      case "recipe-ingredient":
        readRecipeDraft();
        if (recipeDraft.items.length >= 50)
          throw new Error("В рецепте максимум 50 ингредиентов.");
        recipeDraft.items.push(["", 100]);
        drawRecipe();
        dialog.querySelector(".ingredient-row:last-child select")?.focus();
        break;
      case "recipe-remove":
        readRecipeDraft();
        recipeDraft.items.splice(index, 1);
        drawRecipe();
        break;
      case "recipe-product":
        readRecipeDraft();
        recipeProductIndex = recipeDraft.items.findIndex(([id]) => !id);
        customProductDialog();
        break;
      case "chart-metric":
        ui.metric = button.dataset.metric;
        render();
        root.querySelector(".progress-feature")?.classList.add("chart-enter");
        break;
      case "add-product":
        productDialog();
        break;
      case "online-search":
        await onlineSearch();
        break;
      case "custom-product":
        customProductDialog();
        break;
      case "choose-food": {
        const f =
          store.state.foods.find((f) => f.id === id) ||
          onlineFoods.find((f) => f.id === id);
        if (f) amountDialog(f);
        break;
      }
      case "delete-food": {
        const row = store.state[`food_${ui.foodDate}`].find(
          (r) => String(r.id) === id,
        );
        openModal(
          "Удалить запись?",
          `<p>${esc(row?.name)} будет удалено из дневника за ${formatDate(ui.foodDate)}.</p><button class="button danger wide" data-action="confirm-delete-food" data-id="${esc(id)}">Удалить запись</button>`,
        );
        break;
      }
      case "confirm-delete-food":
        commit((s) => {
          s[`food_${ui.foodDate}`] = s[`food_${ui.foodDate}`].filter(
            (r) => String(r.id) !== id,
          );
          s.foodDays[ui.foodDate] = { complete: false };
        });
        closeModal();
        render();
        break;
      case "complete-food-day":
        commit((s) => {
          s.foodDays[ui.foodDate] = {
            complete: !s.foodDays[ui.foodDate]?.complete,
          };
        });
        render();
        break;
      case "meal-edit":
        mealDialog(allMeals(store.state).find((m) => m.id === id));
        break;
      case "meal-add":
        commit((s) =>
          addMeal(
            s,
            allMeals(s).find((m) => m.id === id),
            ui.foodDate,
          ),
        );
        render();
        notify("Приём пищи записан");
        break;
      case "supplement":
        if (!SUPPLEMENTS.some((s) => s.intakes.some((i) => i.id === id)))
          throw new Error("Добавка не найдена.");
        commit((s) => {
          const day = (s[`supplements_${ui.foodDate}`] ||= {});
          day[id] = !day[id];
        });
        render();
        break;
      case "period":
        ui.period = +button.dataset.days;
        render();
        break;
      case "preview-report":
        openModal(
          "Отчёт для Макса",
          `<pre class="report-text">${esc(report(store.state, ui.period))}</pre><button class="button primary wide" data-action="copy-report">Скопировать отчёт</button>`,
        );
        break;
      case "copy-report":
        await copyReport();
        break;
      case "export":
        exportData();
        break;
      case "import":
        importDialog();
        break;
      case "restore": {
        const snapshot = store.snapshots().find((b) => b.id === id);
        openModal(
          "Восстановить копию?",
          `<p>Вернуть полный журнал на ${new Date(snapshot.at).toLocaleString("ru-RU")}? Текущие данные также попадут в защитную копию.</p><button class="button primary wide" data-action="confirm-restore" data-id="${esc(id)}">Восстановить</button>`,
        );
        break;
      }
      case "confirm-restore":
        store.restore(id);
        closeModal();
        render();
        notify("Журнал восстановлен");
        break;
      case "include-duplicates":
        commit((s) => (s.legacy.duplicateKeys = []));
        render();
        notify("Все старые записи включены в статистику");
        break;
      case "confirm-measure":
        commit((s) => {
          const m = s.measurements.find((m) => m.date === button.dataset.date);
          if (m) m.needsConfirmation = false;
        });
        render();
        break;
      case "edit-measure":
        ui.foodDate = button.dataset.date;
        ui.tab = "nutrition";
        render({ top: true });
        break;
      case "close-dialog":
        closeModal();
        break;
      case "dismiss-error":
        errorBar.hidden = true;
        break;
      case "update-app":
        if (timer.current) {
          notify("Сначала завершите таймер");
          break;
        }
        registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
        break;
    }
  } catch (error) {
    modalError(error.message || "Не удалось выполнить действие.");
  }
});
document.addEventListener("input", (event) => {
  if (event.target.closest("#meal-form")) {
    readRecipeDraft();
    drawRecipeTotal();
  }
  if (event.target.id === "food-search") {
    searchController?.abort();
    onlineFoods = [];
    clearTimeout(searchTimeout);
    drawFoods(event.target.value);
    const status = document.getElementById("search-status");
    if (status) status.textContent = "";
  }
});
document.addEventListener("change", async (event) => {
  const field = event.target,
    { field: kind, ex: id, index, key } = field.dataset;
  try {
    if (kind === "recipe-food") {
      readRecipeDraft();
      const row = field.closest(".ingredient-row"),
        i = [...row.parentElement.children].indexOf(row);
      const f = store.state.foods.find((f) => f.id === field.value);
      if (f?.unit === "piece" && recipeDraft.items[i][1] === "100")
        recipeDraft.items[i][1] = 1;
      drawRecipe();
      dialog.querySelectorAll(".ingredient-amount input")[i]?.focus();
      return;
    }
    if (field.id === "backup-file") {
      const file = field.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES)
        throw new Error("Файл слишком большой. Максимум 12 МБ.");
      const text = await file.text();
      store.import(text);
      closeModal();
      render();
      notify("Журнал восстановлен");
      return;
    }
    if (kind === "training-date") {
      if (!parseDate(field.value)) throw new Error("Выберите корректную дату.");
      ui.date = field.value;
      const weekday = parseDate(ui.date).getDay();
      if (weekday >= 1 && weekday <= 5) ui.day = weekday;
      ui.editPast = false;
      render();
      return;
    }
    if (kind === "food-date") {
      if (!parseDate(field.value) || field.value > dateKey())
        throw new Error("Выберите сегодняшний или прошедший день.");
      flushVisibleMetrics();
      ui.foodDate = field.value;
      render();
      return;
    }
    if (kind === "metric") {
      commit((s) => setMetric(s, key, field.value, ui.foodDate));
      field.removeAttribute("aria-invalid");
      notify("Замер сохранён");
      return;
    }
    if (kind === "height") {
      commit((s) => (s.profile.height = bounded(field.value, 80, 250, "Рост")));
      field.removeAttribute("aria-invalid");
      notify("Рост сохранён");
      return;
    }
    if (kind?.startsWith("set-")) {
      writableWorkout();
      const ex = exerciseById(id);
      commit((s) =>
        updateSet(s, ex, +index, (r) =>
          setInput(ex, r, kind.slice(4), field.value),
        ),
      );
      field.removeAttribute("aria-invalid");
    }
  } catch (error) {
    field.setAttribute("aria-invalid", "true");
    modalError(error.message);
  }
});
document.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target,
    values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === "food-amount-form") {
      const f =
        store.state.foods.find((f) => f.id === form.dataset.id) ||
        onlineFoods.find((f) => f.id === form.dataset.id);
      commit((s) => {
        if (!s.foods.some((x) => x.id === f.id)) s.foods.push(f);
        addFood(s, f.id, values.amount, ui.foodDate);
      });
      closeModal();
      render();
      notify("Еда записана");
    }
    if (form.id === "custom-product-form") {
      const product = makeProduct(values),
        forRecipe = dialog.dataset.kind === "recipe-product" && recipeDraft;
      commit((s) => s.foods.push(product));
      if (forRecipe) {
        const item = [product.id, product.unit === "piece" ? 1 : 100];
        if (recipeProductIndex >= 0)
          recipeDraft.items[recipeProductIndex] = item;
        else recipeDraft.items.push(item);
        recipeProductIndex = null;
        drawRecipe();
      } else amountDialog(product);
    }
    if (form.id === "meal-form") {
      readRecipeDraft();
      commit((s) => saveRecipe(s, recipeDraft));
      recipeDraft = null;
      closeModal();
      const oldFold = root.querySelector('[data-fold="meals"]');
      if (oldFold) oldFold.open = true;
      render();
      notify("Рецепт сохранён в «Моих блюдах»");
    }
  } catch (error) {
    modalError(error.message);
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === "max_time_v3")
    showError(
      "Журнал изменён в другой вкладке. Обновите страницу, чтобы продолжить.",
    );
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    timer.tick();
    if (ui.focus) fullscreen(true);
    const newDate = dateKey();
    if (newDate !== sessionDay) {
      if (ui.date === sessionDay) {
        ui.date = newDate;
        ui.day = Math.min(5, new Date().getDay() || 5);
        ui.editPast = false;
      }
      if (ui.foodDate === sessionDay) ui.foodDate = newDate;
      render();
    }
    sessionDay = newDate;
  }
});
let sessionDay = dateKey();
window.addEventListener("error", (event) => {
  console.error("MAX TIME", event.message);
  showError("Возникла ошибка. Сохраните экспорт и обновите приложение.");
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("MAX TIME", event.reason);
  showError(
    "Не удалось завершить действие. Ваш сохранённый журнал остаётся на устройстве.",
  );
});
try {
  store.load();
  render();
  try {
    sessionTimer = JSON.parse(
      sessionStorage.getItem("max_time_active_timer_v3"),
    );
    if (
      sessionTimer &&
      sessionTimer.deadline > Date.now() &&
      sessionTimer.seconds >= 5 &&
      exerciseById(sessionTimer.exId)
    ) {
      timer.current = sessionTimer;
      timerChanged(timer.snapshot());
    } else sessionStorage.removeItem("max_time_active_timer_v3");
  } catch {}
} catch (error) {
  root.innerHTML = `<main class="app-main recovery-screen"><h1>Восстановление MAX TIME</h1><p>${esc(error.message)}</p><div class="section-actions"><button class="button primary" data-action="export">Скачать исходные данные</button><button class="button secondary" data-action="import">Загрузить резервную копию</button></div>${store
    .snapshots()
    .map(
      (b) =>
        `<p><button class="button quiet" data-action="restore" data-id="${esc(b.id)}">Копия ${new Date(b.at).toLocaleString("ru-RU")}</button></p>`,
    )
    .join("")}</main>`;
}

// Native Pages and direct index-v2 links both install the same scoped service worker.
if ("serviceWorker" in navigator && !import.meta.env?.DEV) {
  navigator.serviceWorker
    .register(new URL("../sw.js", import.meta.url), {
      scope: new URL("../", import.meta.url).pathname,
    })
    .then((r) => {
      registration = r;
      const showUpdate = () => {
        if (r.waiting) {
          const b = document.getElementById("update-app");
          b.hidden = false;
        }
      };
      showUpdate();
      r.addEventListener("updatefound", () => {
        r.installing?.addEventListener("statechange", showUpdate);
      });
    })
    .catch(() => notify("Офлайн-режим пока недоступен"));
  const wasControlled = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (wasControlled && !refreshing) {
      refreshing = true;
      location.reload();
    }
  });
}
