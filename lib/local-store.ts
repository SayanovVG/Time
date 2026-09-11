import type { TrackerData } from './habits.ts';
import { applyLocalAction, EMPTY_DATA, validateData } from './local-data.ts';

const DATABASE = 'ritm-habits-device-v1';
const STORE = 'tracker';
const CHANNEL = 'ritm-habits-changes-v1';
type RecordData = { version: 1; revision: number; savedAt: string; data: TrackerData };
let opening: Promise<IDBDatabase> | null = null;
function storageError() { return new Error('Не удалось сохранить данные на устройстве. Проверь свободное место и разрешение браузера на хранение данных.'); }
function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Браузер не разрешает сохранять данные. Открой трекер в обычной вкладке Chrome или Safari.')); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onerror = () => { opening = null; reject(storageError()); };
    request.onblocked = () => { opening = null; reject(new Error('Закрой другие вкладки «Ритма» и открой снова.')); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = null; }; resolve(db); };
  });
  return opening;
}
function unpack(record: unknown): RecordData {
  if (record === undefined) return { version: 1, revision: 0, savedAt: '', data: structuredClone(EMPTY_DATA) };
  const row = record as RecordData;
  if (!row || row.version !== 1 || !Number.isInteger(row.revision) || row.revision < 0) throw new Error('Не удалось прочитать сохранённые данные. Восстанови свою резервную копию.');
  return { ...row, data: validateData(row.data) };
}
export async function readLocalTracker(): Promise<TrackerData> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get('current');
    request.onsuccess = () => { try { resolve(unpack(request.result).data); } catch (e) { reject(e); } };
    request.onerror = () => reject(storageError());
    tx.onabort = () => reject(storageError());
  });
}
export async function writeLocalTracker(action: Record<string, unknown>): Promise<TrackerData> {
  const db = await openDatabase();
  const data = await new Promise<TrackerData>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const read = store.get('current');
    let result: TrackerData | undefined, validationError: unknown;
    read.onsuccess = () => {
      try {
        let previous: RecordData;
        try { previous = unpack(read.result); }
        catch (error) {
          if (action.action !== 'restore') throw error;
          store.put(read.result, 'damaged-before-restore');
          previous = unpack(undefined);
        }
        result = applyLocalAction(previous.data, action);
        if (previous.revision > 0) store.put(previous, 'previous');
        store.put({ version: 1, revision: previous.revision + 1, savedAt: new Date().toISOString(), data: result } satisfies RecordData, 'current');
      } catch (e) { validationError = e; tx.abort(); }
    };
    tx.oncomplete = () => result ? resolve(result) : reject(storageError());
    tx.onabort = () => reject(validationError || storageError());
    tx.onerror = () => reject(validationError || storageError());
  });
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage('saved'); channel.close(); } catch {}
  try { void navigator.storage?.persist?.().catch(() => {}); } catch {}
  return data;
}
export function subscribeLocalTracker(onChange: () => void) {
  try { const channel = new BroadcastChannel(CHANNEL); channel.onmessage = onChange; return () => channel.close(); } catch { return () => {}; }
}
