import { emptyState, validateState, type State } from './sync-state.ts';
const DB = 'den-planner-v1', CHANNEL = 'den-planner-changes-v1';
let opening: Promise<IDBDatabase> | null = null;
function storageError() { return new Error('Браузер не смог сохранить ежедневник. Проверь свободное место. Не закрывай страницу, пока не сохранишь копию.'); }
function open() {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Открой ежедневник в обычной вкладке Chrome или Safari: здесь недоступно хранение данных.')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('scopes');
    r.onerror = () => { opening = null; reject(storageError()); };
    r.onblocked = () => { opening = null; reject(new Error('Закрой другие вкладки ежедневника и попробуй снова.')); };
    r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); opening = null; }; resolve(r.result); };
  }); return opening;
}
export async function readState(scope: string): Promise<State> {
  const db = await open();
  return new Promise((resolve, reject) => { const tx = db.transaction('scopes','readonly'); const r = tx.objectStore('scopes').get(scope); r.onsuccess = () => { try { resolve(r.result ? validateState(r.result) : emptyState()); } catch (e) { reject(e); } }; r.onerror = () => reject(storageError()); tx.onabort = () => reject(storageError()); });
}
export async function changeState(scope: string, mutate: (state: State) => State): Promise<State> {
  const db = await open();
  const result = await new Promise<State>((resolve, reject) => {
    const tx = db.transaction('scopes','readwrite'), store = tx.objectStore('scopes'), r = store.get(scope); let next: State | null = null, error: unknown;
    r.onsuccess = () => { try { const before = r.result ? validateState(r.result) : emptyState(); next = mutate(before); store.put(next,scope); } catch (e) { error = e; tx.abort(); } };
    tx.oncomplete = () => next ? resolve(next) : reject(storageError()); tx.onabort = () => reject(error || storageError()); tx.onerror = () => reject(error || storageError());
  });
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage(scope); channel.close(); } catch {}
  try { void navigator.storage?.persist?.().catch(() => {}); } catch {}
  return result;
}
export function subscribe(scope: string, callback: () => void) { try { const c = new BroadcastChannel(CHANNEL); c.onmessage = e => { if (e.data === scope) callback(); }; return () => c.close(); } catch { return () => {}; } }
