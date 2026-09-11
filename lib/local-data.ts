import { COLORS, ICONS, dayKey, validDay, type Habit, type Entry, type TrackerData } from './habits.ts';

export const EMPTY_DATA: TrackerData = { habits: [], entries: [] };
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(id);
const reject = (message: string): never => { throw new Error(message); };

export function validateData(raw: unknown): TrackerData {
  if (!raw || typeof raw !== 'object') return reject('В файле нет данных трекера.');
  const data = raw as Partial<TrackerData>;
  if (!Array.isArray(data.habits) || !Array.isArray(data.entries) || data.habits.length > 500 || data.entries.length > 100000) return reject('Некорректный или слишком большой файл привычек.');
  const ids = new Set<string>();
  const habits: Habit[] = data.habits.map(h => {
    if (!h || !validId(h.id) || ids.has(h.id) || typeof h.name !== 'string' || !h.name.trim() || h.name.trim().length > 80 || !(ICONS as readonly string[]).includes(h.icon) || !(COLORS as readonly string[]).includes(h.color) || !validDay(h.startDate) || typeof h.createdAt !== 'string' || !Number.isFinite(Date.parse(h.createdAt))) return reject('В файле есть некорректная привычка. Текущие данные сохранены.');
    ids.add(h.id);
    return { id: h.id, name: h.name.trim(), icon: h.icon, color: h.color, startDate: h.startDate, createdAt: h.createdAt };
  });
  const seen = new Set<string>();
  const entries: Entry[] = [];
  for (const e of data.entries) {
    if (!e || !ids.has(e.habitId) || !validDay(e.day)) return reject('В файле есть некорректная отметка. Текущие данные сохранены.');
    const key = e.habitId + ':' + e.day;
    if (!seen.has(key)) { seen.add(key); entries.push({ habitId: e.habitId, day: e.day }); }
  }
  const earliest = new Map<string, string>();
  for (const e of entries) if (!earliest.has(e.habitId) || e.day < earliest.get(e.habitId)!) earliest.set(e.habitId, e.day);
  for (const h of habits) if (earliest.has(h.id) && earliest.get(h.id)! < h.startDate) h.startDate = earliest.get(h.id)!;
  return { habits, entries };
}

export function readBackup(text: string): TrackerData {
  if (text.length > 12000000) return reject('Файл слишком большой. Максимум — 12 МБ.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return reject('Не удалось прочитать JSON. Выбери резервную копию «Ритма».'); }
  if (!raw || typeof raw !== 'object' || (raw as { app?: string }).app !== 'ritm-habits' || (raw as { version?: number }).version !== 1) return reject('Это не резервная копия «Ритма» или её версия пока не поддерживается.');
  return validateData((raw as { data: unknown }).data);
}
export function makeBackup(data: TrackerData) {
  return JSON.stringify({ app: 'ritm-habits', version: 1, exportedAt: new Date().toISOString(), data: validateData(data) }, null, 2);
}

export function applyLocalAction(current: TrackerData, input: Record<string, unknown>, today = dayKey()): TrackerData {
  const data = validateData(current);
  if (input.action === 'restore') return validateData(input.data);
  if (input.action === 'create' || input.action === 'update') {
    const id = input.id;
    if (!validId(id) || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) return reject('Введи название привычки от 1 до 80 символов.');
    if (!(ICONS as readonly unknown[]).includes(input.icon) || !(COLORS as readonly unknown[]).includes(input.color)) return reject('Выбери значок и цвет.');
    if (!validDay(input.startDate) || input.startDate > today) return reject('Выбери сегодняшнюю или прошлую дату начала.');
    const existing = data.habits.find(h => h.id === id);
    if (input.action === 'create' && existing) return data;
    if (input.action === 'update' && !existing) return reject('Привычка уже удалена. Обнови данные.');
    if (!existing && data.habits.length >= 500) return reject('Достигнут предел: 500 привычек.');
    const earliest = data.entries.filter(e => e.habitId === id).map(e => e.day).sort()[0];
    const next: Habit = { id, name: input.name.trim(), icon: input.icon as string, color: input.color as string, startDate: earliest && earliest < input.startDate ? earliest : input.startDate, createdAt: existing?.createdAt || new Date().toISOString() };
    data.habits = existing ? data.habits.map(h => h.id === id ? next : h) : [...data.habits, next];
  } else if (input.action === 'delete') {
    if (!validId(input.id)) return reject('Не удалось определить привычку.');
    data.habits = data.habits.filter(h => h.id !== input.id);
    data.entries = data.entries.filter(e => e.habitId !== input.id);
  } else if (input.action === 'setEntries') {
    if (!Array.isArray(input.entries) || !input.entries.length || input.entries.length > 366) return reject('Выбери от 1 до 366 отметок за один раз.');
    for (const value of input.entries) {
      const e = value as { habitId?: string; day?: string; done?: boolean };
      if (!e || !validId(e.habitId) || !validDay(e.day) || e.day > today || typeof e.done !== 'boolean' || !data.habits.some(h => h.id === e.habitId)) return reject('Отметка должна относиться к существующей привычке и сегодняшнему или прошлому дню.');
      data.entries = data.entries.filter(x => !(x.habitId === e.habitId && x.day === e.day));
      if (e.done) {
        data.entries.push({ habitId: e.habitId, day: e.day });
        data.habits = data.habits.map(h => h.id === e.habitId && h.startDate > e.day! ? { ...h, startDate: e.day! } : h);
      }
    }
  } else return reject('Неизвестное действие.');
  if (data.entries.length > 100000) return reject('Достигнут предел: 100 000 отметок. Сохрани резервную копию перед удалением старых привычек.');
  return data;
}
