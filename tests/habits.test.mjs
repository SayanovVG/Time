import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, validDay, shiftDay, monthDays, weekDays, entriesSet, entryKey, dayProgress, currentStreak, monthStats } from '../lib/habits.ts';

const habit = { id: 'a', name: 'Читать', icon: 'book', color: 'lime', startDate: '2026-09-07', createdAt: '' };
const completions = (...days) => entriesSet(days.map(day => ({ habitId: 'a', day })));

test('calendar rejects impossible days and accepts leap days', () => {
  assert.equal(validDay('2026-02-29'), false);
  assert.equal(validDay('2024-02-29'), true);
  assert.equal(validDay('2026-02-31'), false);
  assert.equal(validDay('2026-13-01'), false);
  assert.equal(validDay('2026-9-01'), false);
  assert.equal(validDay('2026-09-01'), true);
  assert.equal(validDay('1899-12-31'), false);
});
test('date keys stay in the device calendar, including DST and year boundaries', () => {
  assert.equal(dayKey(new Date(2026, 8, 11, 0, 1)), '2026-09-11');
  assert.equal(shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDay('2026-03-29', 1), '2026-03-30');
  assert.equal(shiftDay('2026-11-01', 1), '2026-11-02');
  assert.equal(monthDays('2024-02-01').length, 29);
  assert.equal(weekDays('2026-01-01')[0], '2025-12-29');
});
test('incomplete today does not prematurely break yesterday’s streak', () => {
  assert.equal(currentStreak(habit, completions('2026-09-07','2026-09-08','2026-09-09','2026-09-10'), '2026-09-11'), 4);
  assert.equal(currentStreak(habit, completions('2026-09-07','2026-09-08'), '2026-09-11'), 0);
});
test('backfilling a gap restores a streak and removing it breaks the streak', () => {
  const completed = completions('2026-09-07','2026-09-09','2026-09-10');
  assert.equal(currentStreak(habit, completed, '2026-09-11'), 2);
  completed.add(entryKey('a', '2026-09-08'));
  assert.equal(currentStreak(habit, completed, '2026-09-11'), 4);
  completed.delete(entryKey('a', '2026-09-09'));
  assert.equal(currentStreak(habit, completed, '2026-09-11'), 1);
});
test('month percentage counts only started habits and no future dates', () => {
  const other = { ...habit, id: 'b', startDate: '2026-09-10' };
  const completed = completions('2026-09-07', '2026-09-08');
  completed.add(entryKey('b', '2026-09-10'));
  assert.deepEqual(monthStats([habit, other], completed, '2026-09-01', '2026-09-11'), { done: 3, total: 7, perfect: 2, percent: 43 });
  assert.deepEqual(dayProgress([habit, other], completed, '2026-09-06'), { total: 0, done: 0, percent: 0 });
});
test('backdated start includes earlier completion in month totals', () => {
  const earlier = { ...habit, startDate: '2026-09-01' };
  const stats = monthStats([earlier], completions('2026-09-01','2026-09-07'), '2026-09-01', '2026-09-11');
  assert.deepEqual(stats, { done: 2, total: 11, perfect: 2, percent: 18 });
});
test('empty tracker never divides by zero or invents perfect days', () => {
  assert.deepEqual(monthStats([], new Set(), '2026-09-01', '2026-09-11'), { done: 0, total: 0, perfect: 0, percent: 0 });
});
