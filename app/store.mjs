import {
  freshState,
  normalizeState,
  clone,
  SCHEMA,
  VERSION,
} from "./model.mjs";

export const MAIN = "max_time_v3";
export const LEGACY = "max_time_v2";
export const BACKUPS = "max_time_backups_v3";
export const MAX_IMPORT_BYTES = 12 * 1024 * 1024;
export class Store {
  constructor(storage, { now = () => Date.now() } = {}) {
    this.storage = storage;
    this.now = now;
    this.state = freshState();
    this.raw = null;
    this.revision = 0;
    this.warning = "";
    this.recoveryRaw = null;
  }
  load() {
    const current = this.storage.getItem(MAIN),
      legacy = this.storage.getItem(LEGACY);
    this.raw = current;
    if (!current && !legacy) return this.state;
    try {
      const record = JSON.parse(current || legacy);
      this.state = normalizeState(current ? record.state : record, {
        source: "load",
      });
      this.revision = current ? record.revision || 0 : 0;
      return this.state;
    } catch (error) {
      this.recoveryRaw = current || legacy;
      throw new Error(
        `Не удалось открыть журнал. Исходные данные сохранены. ${error.message}`,
      );
    }
  }
  snapshots() {
    try {
      const r = JSON.parse(this.storage.getItem(BACKUPS) || "[]");
      return Array.isArray(r)
        ? r.filter(
            (x) =>
              x &&
              typeof x.id === "string" &&
              Number.isFinite(x.at) &&
              x.state &&
              typeof x.state === "object",
          )
        : [];
    } catch {
      return [];
    }
  }
  backup(state, reason = "auto", required = false) {
    const encoded = JSON.stringify(state);
    let ring = this.snapshots();
    if (ring.length && JSON.stringify(ring.at(-1).state) === encoded) return;
    ring.push({
      id: `${this.now()}-${Math.random().toString(36).slice(2)}`,
      at: this.now(),
      reason,
      state: clone(state),
    });
    ring = ring.slice(-6);
    while (ring.length) {
      try {
        this.storage.setItem(BACKUPS, JSON.stringify(ring));
        this.warning = "";
        return;
      } catch {
        if (ring.length === 1) break;
        ring.shift();
      }
    }
    this.warning =
      "Журнал сохранён, но для новой автокопии не хватает места. Сохраните экспорт.";
    if (required)
      throw new Error(
        "Для безопасного восстановления нужна резервная копия. Сначала сохраните экспорт и освободите место в браузере.",
      );
  }
  commit(
    change,
    { reason = "auto", validated = false, requiredBackup = false } = {},
  ) {
    if (this.recoveryRaw)
      throw new Error(
        "Сначала восстановите журнал или сохраните исходный файл.",
      );
    if (this.storage.getItem(MAIN) !== this.raw)
      throw new Error(
        "Журнал изменён в другой вкладке. Обновите страницу перед редактированием.",
      );
    const next =
      typeof change === "function" ? clone(this.state) : clone(change);
    if (typeof change === "function") change(next);
    const state = validated ? next : normalizeState(next);
    if (JSON.stringify(state) === JSON.stringify(this.state)) return this.state;
    const previous = clone(this.state),
      raw = JSON.stringify({
        schemaVersion: SCHEMA,
        revision: this.revision + 1,
        savedAt: this.now(),
        state,
      });
    if (requiredBackup) this.backup(previous, reason, true);
    try {
      this.storage.setItem(MAIN, raw);
    } catch {
      throw new Error(
        "Не удалось сохранить: хранилище браузера заполнено или недоступно. Изменение отменено. Сохраните экспорт журнала.",
      );
    }
    this.state = state;
    this.raw = raw;
    this.revision++;
    if (!requiredBackup) this.backup(previous, reason);
    return this.state;
  }
  import(text) {
    if (
      typeof text !== "string" ||
      new TextEncoder().encode(text).length > MAX_IMPORT_BYTES
    )
      throw new Error("Файл слишком большой. Максимум 12 МБ.");
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("Файл не содержит корректный JSON.");
    }
    const next = normalizeState(raw);
    // Recovery is explicitly selected by the user, while the damaged raw source stays under LEGACY or in its own backup.
    const damaged = this.recoveryRaw;
    if (damaged) {
      try {
        this.storage.setItem("max_time_recovery_source_v3", damaged);
      } catch {
        throw new Error(
          "Сначала скачайте исходные данные: не удалось сохранить защитную копию.",
        );
      }
      this.recoveryRaw = null;
    }
    try {
      return this.commit(next, {
        reason: "before-import",
        validated: true,
        requiredBackup: true,
      });
    } catch (error) {
      this.recoveryRaw = damaged;
      throw error;
    }
  }
  restore(id) {
    const copy = this.snapshots().find((x) => x.id === id);
    if (!copy) throw new Error("Копия не найдена.");
    return this.import(
      JSON.stringify({ format: "max-time-backup", state: copy.state }),
    );
  }
  export() {
    return JSON.stringify(
      {
        format: "max-time-backup",
        schemaVersion: SCHEMA,
        appVersion: VERSION,
        exportedAt: new Date(this.now()).toISOString(),
        state: this.state,
      },
      null,
      2,
    );
  }
}
