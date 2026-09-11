export type Priority = 0 | 1 | 2 | 3;
export type Repeat = { frequency: 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'; interval: number; anchorDay: number; until: string | null };
export type Task = { title: string; notes: string; project: string; date: string | null; time: string | null; duration: number; deadline: string | null; priority: Priority; starred: boolean; status: 'todo' | 'done'; completedAt: string | null; checklist: { id: string; text: string; done: boolean }[]; tags: string[]; repeat: Repeat; seriesId: string; repeatParent: string | null; source: 'self' | 'max' | 'import'; createdAt: string; updatedAt: string };
export type Project = { name: string; color: string };
export type Note = { date: string; text: string };
export type Focus = { date: string; taskId: string | null; minutes: number; completedAt: string };
export type Kind = 'task' | 'project' | 'note' | 'focus';
export type Body = Task | Project | Note | Focus;
export type Row = { id: string; kind: Kind; body: Body; revision: number; deleted: boolean; updated_at: string; updated_by: string };
export type TaskRow = Row & { kind: 'task'; body: Task };
export type Change = { id: string; kind: Kind; body: Body; deleted?: boolean };
export const PROJECT_COLORS = ['#969dff', '#ffbc7d', '#80d4b0', '#ff9aba', '#8fcaff'];
export const PROJECTS = [{ id: 'business', name: 'Бизнес', color: PROJECT_COLORS[0] }, { id: 'personal', name: 'Личное', color: PROJECT_COLORS[1] }, { id: 'health', name: 'Здоровье', color: PROJECT_COLORS[2] }];
export const REPEATS = { none: 'Не повторять', daily: 'Каждый день', weekdays: 'По будням', weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год' };
export const PRIORITIES = ['Без приоритета', 'Низкий', 'Средний', 'Высокий'];
export const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export function dayKey(value = new Date()) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
export function parseDay(value: string) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export function validDay(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '2000-01-01' && value <= '2199-12-31' && dayKey(parseDay(value)) === value; }
export function shiftDay(value: string, count: number) { const date = parseDay(value); date.setDate(date.getDate() + count); return dayKey(date); }
export function monthStart(value: string) { return value.slice(0, 7) + '-01'; }
export function shiftMonth(value: string, count: number) { const date = parseDay(monthStart(value)); date.setMonth(date.getMonth() + count); return dayKey(date); }
export function weekDays(value: string) { const day = parseDay(value).getDay(); const monday = shiftDay(value, -((day + 6) % 7)); return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)); }
export function monthGrid(value: string) { const start = weekDays(monthStart(value))[0]; return Array.from({ length: 42 }, (_, i) => shiftDay(start, i)); }
export const formatDay = (value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('ru-RU', options).format(parseDay(value));
export function dateLabel(value: string | null, today = dayKey()) { return !value ? 'Без даты' : value === today ? 'Сегодня' : value === shiftDay(today, 1) ? 'Завтра' : formatDay(value, { day: 'numeric', month: 'short', ...(value.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) }); }
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,100}$/.test(value);
export const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const timeMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export function durationLabel(minutes: number) { return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ' ' + minutes % 60 + ' мин' : ''}`; }
export function blankTask(date: string | null = null): Task { const now = new Date().toISOString(); return { title: '', notes: '', project: 'inbox', date, time: null, duration: 30, deadline: null, priority: 0, starred: false, status: 'todo', completedAt: null, checklist: [], tags: [], repeat: { frequency: 'none', interval: 1, anchorDay: date ? parseDay(date).getDate() : 1, until: null }, seriesId: crypto.randomUUID(), repeatParent: null, source: 'self', createdAt: now, updatedAt: now }; }
const fail = (message: string): never => { throw new Error(message); };
const iso = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
export function validateBody(kind: Kind, value: unknown): Body {
  if (!value || typeof value !== 'object') return fail('Не удалось прочитать запись.');
  if (kind === 'project') { const p = value as Project; if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 60 || !/^#[0-9a-f]{6}$/i.test(p.color)) return fail('Проверь название и цвет проекта.'); return { name: p.name.trim(), color: p.color }; }
  if (kind === 'note') { const n = value as Note; if (!validDay(n.date) || typeof n.text !== 'string' || n.text.length > 20000) return fail('Проверь дату и текст заметки.'); return { date: n.date, text: n.text }; }
  if (kind === 'focus') { const f = value as Focus; if (!validDay(f.date) || (f.taskId !== null && !validId(f.taskId)) || !Number.isInteger(f.minutes) || f.minutes < 1 || f.minutes > 180 || !iso(f.completedAt)) return fail('Некорректная запись фокуса.'); return { date: f.date, taskId: f.taskId, minutes: f.minutes, completedAt: f.completedAt }; }
  if (kind !== 'task') return fail('Неизвестный тип записи.');
  const t = value as Task;
  if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 300 || typeof t.notes !== 'string' || t.notes.length > 20000 || !validId(t.project)) return fail('Введи название задачи (до 300 символов).');
  if ((t.date !== null && !validDay(t.date)) || (t.deadline !== null && !validDay(t.deadline)) || (t.time !== null && (!validTime(t.time) || !t.date))) return fail('Проверь дату и время задачи.');
  if (!Number.isInteger(t.duration) || t.duration < 5 || t.duration > 720 || (t.time && timeMinutes(t.time) + t.duration > 1440)) return fail('Длительность — от 5 минут до 12 часов, в пределах выбранного дня.');
  if (![0,1,2,3].includes(t.priority) || typeof t.starred !== 'boolean' || !['todo','done'].includes(t.status) || (t.completedAt !== null && !iso(t.completedAt)) || (t.status === 'done' && !t.completedAt) || (t.status === 'todo' && t.completedAt !== null)) return fail('Некорректное состояние задачи.');
  if (!Array.isArray(t.checklist) || t.checklist.length > 100 || t.checklist.some(c => !c || !validId(c.id) || typeof c.text !== 'string' || !c.text.trim() || c.text.length > 300 || typeof c.done !== 'boolean') || new Set(t.checklist.map(c => c.id)).size !== t.checklist.length) return fail('Проверь список шагов задачи.');
  if (!Array.isArray(t.tags) || t.tags.length > 20 || t.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 40)) return fail('Проверь метки задачи.');
  const r = t.repeat;
  if (!r || !Object.keys(REPEATS).includes(r.frequency) || !Number.isInteger(r.interval) || r.interval < 1 || r.interval > 365 || !Number.isInteger(r.anchorDay) || r.anchorDay < 1 || r.anchorDay > 31 || (r.until !== null && !validDay(r.until)) || (r.frequency !== 'none' && !t.date)) return fail('Для повторения выбери дату и период.');
  if (!validId(t.seriesId) || (t.repeatParent !== null && !validId(t.repeatParent)) || !['self','max','import'].includes(t.source) || !iso(t.createdAt) || !iso(t.updatedAt)) return fail('Не удалось прочитать данные задачи.');
  return { title: t.title.trim(), notes: t.notes, project: t.project, date: t.date, time: t.time, duration: t.duration, deadline: t.deadline, priority: t.priority, starred: t.starred, status: t.status, completedAt: t.completedAt, checklist: t.checklist.map(c => ({ id: c.id, text: c.text.trim(), done: c.done })), tags: [...new Set(t.tags.map(s => s.trim()))], repeat: { frequency: r.frequency, interval: r.interval, anchorDay: r.anchorDay, until: r.until }, seriesId: t.seriesId, repeatParent: t.repeatParent, source: t.source, createdAt: t.createdAt, updatedAt: t.updatedAt };
}
export function validateRow(row: Row): Row { if (!row || !validId(row.id) || !Number.isInteger(row.revision) || row.revision < 0 || typeof row.deleted !== 'boolean') return fail('Повреждённая запись. Восстанови резервную копию.'); return { id: row.id, kind: row.kind, body: validateBody(row.kind, row.body), revision: row.revision, deleted: row.deleted, updated_at: row.updated_at, updated_by: typeof row.updated_by === 'string' ? row.updated_by : 'device' }; }
export function tasksOf(rows: Row[]) { return rows.filter(r => !r.deleted && r.kind === 'task') as TaskRow[]; }
export function nextRepeat(task: Task, after = dayKey()): string | null {
  if (!task.date || task.repeat.frequency === 'none') return null;
  const { frequency, interval, anchorDay, until } = task.repeat;
  let candidate = task.date;
  for (let i = 0; i < 74000; i++) {
    if (frequency === 'monthly' || frequency === 'yearly') { const target = parseDay(shiftMonth(candidate, interval * (frequency === 'yearly' ? 12 : 1))); const month = target.getMonth(); const end = new Date(target.getFullYear(), month + 1, 0, 12).getDate(); target.setDate(Math.min(anchorDay, end)); candidate = dayKey(target); }
    else if (frequency === 'weekdays') { for (let n = 0; n < interval; n++) { do { candidate = shiftDay(candidate, 1); } while ([0,6].includes(parseDay(candidate).getDay())); } }
    else candidate = shiftDay(candidate, interval * (frequency === 'weekly' ? 7 : 1));
    if (!validDay(candidate) || (until && candidate > until)) return null;
    if (candidate > after) return candidate;
  }
  return null;
}
export function completionChanges(row: TaskRow, rows: Row[], done: boolean, today = dayKey(), now = new Date().toISOString()): Change[] {
  const t = row.body;
  if ((t.status === 'done') === done) return [];
  const changes: Change[] = [{ id: row.id, kind: 'task', body: { ...t, status: done ? 'done' : 'todo', completedAt: done ? now : null, updatedAt: now } }];
  if (done) { const nextDate = nextRepeat(t, today > (t.date || '') ? today : t.date!); if (nextDate) { const id = `${t.seriesId}:${nextDate}`; if (!rows.some(r => r.id === id && !r.deleted)) { const gap = t.deadline && t.date ? Math.round((parseDay(t.deadline).getTime() - parseDay(t.date).getTime()) / 86400000) : null; changes.push({ id, kind: 'task', body: { ...t, date: nextDate, deadline: gap === null ? null : shiftDay(nextDate, gap), status: 'todo', completedAt: null, starred: false, checklist: t.checklist.map(c => ({ ...c, done: false })), repeatParent: row.id, createdAt: now, updatedAt: now } }); } } }
  else { const child = tasksOf(rows).find(r => r.body.repeatParent === row.id); if (child) { if (child.body.status === 'done' || child.body.updatedAt !== child.body.createdAt) return fail('Следующее повторение уже изменено. Сначала проверь его, чтобы не потерять изменения.'); changes.push({ id: child.id, kind: 'task', body: child.body, deleted: true }); } }
  return changes;
}
export function taskOrder(a: TaskRow, b: TaskRow) { return Number(a.body.status === 'done') - Number(b.body.status === 'done') || Number(b.body.starred) - Number(a.body.starred) || b.body.priority - a.body.priority || (a.body.time || '99:99').localeCompare(b.body.time || '99:99') || a.body.createdAt.localeCompare(b.body.createdAt); }
export function isOverdue(t: Task, today = dayKey()) { return t.status === 'todo' && !!((t.date && t.date < today) || (t.deadline && t.deadline < today)); }
export function quadrant(t: Task, today = dayKey()) { const important = t.starred || t.priority >= 2; const urgent = !!(t.deadline && t.deadline <= today) || isOverdue(t, today); return important ? urgent ? 0 : 1 : urgent ? 2 : 3; }
export function parseQuick(text: string, defaultDate: string | null = null, today = dayKey(), projects = PROJECTS): { task: Task; detected: string[] } {
  const task = blankTask(defaultDate), detected: string[] = [];
  let title = text.trim();
  const consume = (pattern: RegExp, apply: (match: RegExpMatchArray) => void) => { const m = title.match(pattern); if (m) { apply(m); title = title.replace(m[0], ' '); } };
  consume(/(?:^|\s)(послезавтра|завтра|сегодня)(?=\s|$)/iu, m => { task.date = shiftDay(today, m[1].toLowerCase() === 'послезавтра' ? 2 : m[1].toLowerCase() === 'завтра' ? 1 : 0); detected.push(dateLabel(task.date, today)); });
  consume(/(?:^|\s)(\d{2})\.(\d{2})(?:\.(\d{4}))?(?=\s|$)/u, m => { const date = `${m[3] || today.slice(0,4)}-${m[2]}-${m[1]}`; if (!validDay(date)) return fail('Такой даты нет. Проверь число и месяц.'); task.date = date; detected.push(dateLabel(date, today)); });
  consume(/(?:^|\s)(?:в\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/iu, m => { task.time = m[1].padStart(2,'0') + ':' + m[2]; task.date ||= today; detected.push(task.time); });
  consume(/(?:^|\s)(каждый день|по будням|каждую неделю|каждый месяц)(?=\s|$)/iu, m => { task.repeat.frequency = ({ 'каждый день':'daily', 'по будням':'weekdays', 'каждую неделю':'weekly', 'каждый месяц':'monthly' } as Record<string, Repeat['frequency']>)[m[1].toLowerCase()]; task.date ||= today; detected.push(REPEATS[task.repeat.frequency]); });
  consume(/(?:^|\s)(?:!(1|2|3)|p([1-4])|срочно)(?=\s|$)/iu, m => { task.priority = m[1] ? Number(m[1]) as Priority : m[2] ? (4 - Number(m[2])) as Priority : 3; detected.push(PRIORITIES[task.priority]); });
  const matches = [...title.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)];
  for (const m of matches) { const project = projects.find(p => p.name.toLocaleLowerCase('ru') === m[1].toLocaleLowerCase('ru') || p.id === m[1]); if (project) { task.project = project.id; detected.push(project.name); } else { task.tags.push(m[1]); detected.push('#' + m[1]); } title = title.replace(m[0], ' '); }
  task.title = title.replace(/\s+/g, ' ').trim(); task.repeat.anchorDay = task.date ? parseDay(task.date).getDate() : 1;
  if (task.time) task.duration = Math.min(task.duration, 1440 - timeMinutes(task.time));
  return { task, detected };
}
