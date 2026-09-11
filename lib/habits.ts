export type Habit = { id: string; name: string; icon: string; color: string; startDate: string; createdAt: string };
export type Entry = { habitId: string; day: string };
export type TrackerData = { habits: Habit[]; entries: Entry[] };
export const COLORS = ['lime', 'blue', 'violet', 'orange', 'pink'] as const;
export const ICONS = ['target', 'move', 'book', 'briefcase', 'water', 'moon', 'heart', 'sun'] as const;
export const MIN_DAY = '1900-01-01';
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseDay(day: string) { return new Date(`${day}T12:00:00`); }
export function validDay(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= MIN_DAY && day <= '9999-12-31' && dayKey(parseDay(day)) === day;
}
export function shiftDay(day: string, amount: number) { const d = parseDay(day); d.setDate(d.getDate() + amount); return dayKey(d); }
export function monthStart(day: string) { return `${day.slice(0, 7)}-01`; }
export function monthDays(day: string) {
  const d = parseDay(monthStart(day));
  return Array.from({ length: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }, (_, i) => shiftDay(dayKey(d), i));
}
export function shiftMonth(day: string, amount: number) { const d = parseDay(monthStart(day)); d.setMonth(d.getMonth() + amount); return dayKey(d); }
export function weekDays(day: string) { const d = parseDay(day); const monday = shiftDay(day, -((d.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)); }
export function entryKey(habitId: string, day: string) { return `${habitId}:${day}`; }
export function entriesSet(entries: Entry[]) { return new Set(entries.map(e => entryKey(e.habitId, e.day))); }
export function dayProgress(habits: Habit[], completed: Set<string>, day: string) {
  const due = habits.filter(h => h.startDate <= day);
  const done = due.filter(h => completed.has(entryKey(h.id, day))).length;
  return { total: due.length, done, percent: due.length ? Math.round(done / due.length * 100) : 0 };
}
export function currentStreak(habit: Habit, completed: Set<string>, today: string) {
  let day = completed.has(entryKey(habit.id, today)) ? today : shiftDay(today, -1), streak = 0;
  while (day >= habit.startDate && completed.has(entryKey(habit.id, day))) { streak++; day = shiftDay(day, -1); }
  return streak;
}
export function monthStats(habits: Habit[], completed: Set<string>, month: string, today: string) {
  let done = 0, total = 0, perfect = 0;
  for (const day of monthDays(month)) {
    if (day > today) continue;
    const p = dayProgress(habits, completed, day); done += p.done; total += p.total;
    if (p.total > 0 && p.done === p.total) perfect++;
  }
  return { done, total, perfect, percent: total ? Math.round(done / total * 100) : 0 };
}
export function russianDays(n: number) {
  const mod = n % 100;
  return mod >= 11 && mod <= 14 ? 'дней' : n % 10 === 1 ? 'день' : n % 10 >= 2 && n % 10 <= 4 ? 'дня' : 'дней';
}
