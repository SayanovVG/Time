import { validateBody, validateRow, validId, type Row, type Change } from './model.ts';
export type Pending = Change & { baseRevision: number; token: string; deleted: boolean };
export type Batch = { operationId: string; changes: Pending[] };
export type Conflict = { id: string; local: Pending; remote: Row | null };
export type State = { version: 1; rows: Row[]; pending: Record<string, Pending>; inFlight: Batch | null; conflicts: Record<string, Conflict>; lastSync: string | null };
export function emptyState(): State { return { version: 1, rows: [], pending: {}, inFlight: null, conflicts: {}, lastSync: null }; }
export function validateState(value: unknown): State {
  const s = value as State;
  if (!s || s.version !== 1 || !Array.isArray(s.rows) || s.rows.length > 20000 || !s.pending || !s.conflicts) throw new Error('Не удалось прочитать ежедневник. Восстанови резервную копию.');
  const rows = s.rows.map(validateRow);
  if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('В копии есть повторяющиеся записи.');
  return { ...s, rows };
}
export function stage(state: State, changes: Change[], queue: boolean, now = new Date().toISOString()): State {
  if (!changes.length || changes.length > 100) throw new Error('Сохраняй от 1 до 100 записей за раз.');
  const next = structuredClone(state);
  for (const c of changes) {
    if (!validId(c.id)) throw new Error('Некорректный номер записи.');
    if (next.conflicts[c.id]) throw new Error('Сначала выбери версию этой записи в окне синхронизации.');
    const body = validateBody(c.kind, c.body), old = next.rows.find(r => r.id === c.id);
    if (old && old.kind !== c.kind) throw new Error('Нельзя изменить тип существующей записи.');
    const row: Row = { id: c.id, kind: c.kind, body, revision: old?.revision || 0, deleted: !!c.deleted, updated_at: now, updated_by: 'device' };
    next.rows = old ? next.rows.map(r => r.id === c.id ? row : r) : [...next.rows, row];
    if (queue) next.pending[c.id] = { id: c.id, kind: c.kind, body, deleted: !!c.deleted, baseRevision: next.pending[c.id]?.baseRevision ?? old?.revision ?? 0, token: crypto.randomUUID() };
  }
  if (next.rows.length > 20000) throw new Error('Достигнут предел в 20 000 записей. Сохрани резервную копию.');
  return next;
}
export function prepareBatch(state: State): State {
  if (state.inFlight) return state;
  const changes = Object.values(state.pending).filter(c => !state.conflicts[c.id]).slice(0,100);
  return changes.length ? { ...state, inFlight: { operationId: crypto.randomUUID(), changes: structuredClone(changes) } } : state;
}
export function acknowledge(state: State, operationId: string, result: { status: 'ok' | 'conflict'; rows: Row[] }): State {
  if (!state.inFlight || state.inFlight.operationId !== operationId) return state;
  const next = structuredClone(state), batch = next.inFlight!;
  const remote = result.rows.map(validateRow);
  if (!['ok','conflict'].includes(result.status)) throw new Error('Неизвестный ответ синхронизации.');
  if (result.status === 'ok' && batch.changes.some(c => !remote.some(r => r.id === c.id))) throw new Error('Сервер подтвердил не все записи. Повторяем безопасно.');
  for (const c of batch.changes) {
    const server = remote.find(r => r.id === c.id) || null, current = next.pending[c.id];
    if (result.status === 'conflict') { if (current) next.conflicts[c.id] = { id: c.id, local: current, remote: server }; continue; }
    if (!server) continue;
    if (current?.token === c.token) { delete next.pending[c.id]; next.rows = next.rows.map(r => r.id === c.id ? server : r); }
    else if (current) { current.baseRevision = server.revision; next.rows = next.rows.map(r => r.id === c.id ? { ...r, revision: server.revision } : r); }
    else next.rows = next.rows.map(r => r.id === c.id ? server : r);
  }
  next.inFlight = null;
  if (result.status === 'ok') next.lastSync = new Date().toISOString();
  return next;
}
export function mergeRemote(state: State, remote: Row[]): State {
  const next = structuredClone(state);
  for (const value of remote) {
    const row = validateRow(value), index = next.rows.findIndex(r => r.id === row.id), old = next.rows[index];
    if (next.conflicts[row.id]) next.conflicts[row.id].remote = row;
    if (next.pending[row.id] || (old && old.revision > row.revision)) continue;
    if (index < 0) next.rows.push(row); else next.rows[index] = row;
  }
  next.lastSync = new Date().toISOString(); return next;
}
export function resolveConflict(state: State, id: string, keep: 'local' | 'remote'): State {
  const conflict = state.conflicts[id]; if (!conflict) return state;
  const next = structuredClone(state); delete next.conflicts[id]; delete next.pending[id];
  if (keep === 'remote') { next.rows = next.rows.filter(r => r.id !== id); if (conflict.remote) next.rows.push(conflict.remote); }
  else { next.pending[id] = { ...conflict.local, baseRevision: conflict.remote?.revision || 0, token: crypto.randomUUID() }; next.rows = next.rows.map(r => r.id === id ? { ...r, revision: conflict.remote?.revision || 0 } : r); }
  return next;
}
export function backup(state: State) { return JSON.stringify({ app: 'den-planner', version: 1, exportedAt: new Date().toISOString(), records: state.rows.filter(r => !r.deleted).map(r => ({ id: r.id, kind: r.kind, body: r.body })) }, null, 2); }
export function readBackup(text: string): Change[] {
  if (text.length > 15000000) throw new Error('Максимальный размер копии — 15 МБ.');
  let value; try { value = JSON.parse(text); } catch { throw new Error('Выбери корректный JSON-файл резервной копии.'); }
  if (value?.app !== 'den-planner' || value.version !== 1 || !Array.isArray(value.records) || value.records.length > 20000) throw new Error('Это не поддерживаемая копия ежедневника «День».');
  const seen = new Set();
  return value.records.map((r: Change) => { if (!r || !validId(r.id) || seen.has(r.id)) throw new Error('В копии есть повреждённые или повторяющиеся записи.'); seen.add(r.id); return { id: r.id, kind: r.kind, body: validateBody(r.kind, r.body), deleted: false }; });
}
