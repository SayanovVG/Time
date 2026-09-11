import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLocalAction, EMPTY_DATA, makeBackup, readBackup } from '../lib/local-data.ts';
const today = '2026-09-11';
const create = { action: 'create', id: 'habit-a', name: 'Читать', icon: 'book', color: 'lime', startDate: today };
const mark = (day, done = true) => ({ action: 'setEntries', entries: [{ habitId: 'habit-a', day, done }] });

test('device records preserve backfilled dates through export and restore', () => {
  let data = applyLocalAction(EMPTY_DATA, create, today);
  data = applyLocalAction(data, mark('2026-08-28'), today);
  data = applyLocalAction(data, mark('2026-09-08'), today);
  assert.equal(data.habits[0].startDate, '2026-08-28');
  assert.deepEqual(readBackup(makeBackup(data)), data);
  assert.deepEqual(applyLocalAction(EMPTY_DATA, { action: 'restore', data }, today), data);
});
test('repeated creates and marks do not duplicate records', () => {
  let data = applyLocalAction(EMPTY_DATA, create, today);
  data = applyLocalAction(data, create, today);
  data = applyLocalAction(applyLocalAction(data, mark(today), today), mark(today), today);
  assert.equal(data.habits.length, 1); assert.equal(data.entries.length, 1);
  data = applyLocalAction(data, mark(today, false), today);
  assert.equal(data.entries.length, 0);
});
test('invalid batch is rejected without changing the original state', () => {
  const original = applyLocalAction(EMPTY_DATA, create, today);
  const before = structuredClone(original);
  assert.throws(() => applyLocalAction(original, { action: 'setEntries', entries: [{ habitId: 'habit-a', day: today, done: true }, { habitId: 'habit-a', day: '2026-09-12', done: true }] }, today));
  assert.deepEqual(original, before);
});
test('update preserves earliest historical mark; delete removes only its records', () => {
  let data = applyLocalAction(EMPTY_DATA, create, today);
  data = applyLocalAction(data, { ...create, id: 'habit-b' }, today);
  data = applyLocalAction(data, mark('2026-09-01'), today);
  data = applyLocalAction(data, { ...create, action: 'update', name: 'Книга', startDate: today }, today);
  assert.equal(data.habits[0].startDate, '2026-09-01');
  data = applyLocalAction(data, { action: 'delete', id: 'habit-a' }, today);
  assert.equal(data.habits.length, 1); assert.equal(data.habits[0].id, 'habit-b'); assert.equal(data.entries.length, 0);
});
test('damaged backups, unknown formats and orphan marks are rejected', () => {
  assert.throws(() => readBackup('{oops'));
  assert.throws(() => readBackup(JSON.stringify({ app: 'max-time', version: 1, data: EMPTY_DATA })));
  assert.throws(() => readBackup(JSON.stringify({ app: 'ritm-habits', version: 1, data: { habits: [], entries: [{ habitId: 'unknown', day: today }] } })));
  assert.throws(() => applyLocalAction(EMPTY_DATA, { ...create, startDate: '2026-02-31' }, today));
});
