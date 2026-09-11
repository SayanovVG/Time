import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { acknowledge, prepareBatch, mergeRemote } from './sync-state.ts';
import { readState, changeState } from './store.ts';
import type { Row } from './model.ts';
export type CloudSetup = { client: SupabaseClient | null; enabled: boolean; loading?: boolean; error?: string };
export type { Session };
let loading: Promise<CloudSetup> | null = null;
export function loadCloud(): Promise<CloudSetup> {
  if (loading) return loading;
  loading = (async () => {
    try {
      let config: {enabled?: boolean; url?: unknown; publishableKey?: unknown};
      try {
        const response = await fetch('./sync-config.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Не удалось проверить подключение.');
        config = await response.json() as typeof config;
      } catch {
        try { config = JSON.parse(localStorage.getItem('den-planner-public-config') || 'null'); } catch { throw new Error('Не удалось проверить подключение.'); }
        if (!config) throw new Error('Первое подключение требует интернета.');
      }
      if (!config.enabled) return { client: null, enabled: false };
      if (typeof config.url !== 'string' || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url) || typeof config.publishableKey !== 'string' || !/^sb_publishable_[a-zA-Z0-9_-]{20,}$/.test(config.publishableKey)) throw new Error('Настройки синхронизации требуют проверки.');
      try { localStorage.setItem('den-planner-public-config', JSON.stringify(config)); } catch {}
      return { enabled: true, client: createClient(config.url, config.publishableKey, { auth: { storageKey: 'den-planner-auth-v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }, global: { headers: { 'X-Client-Info': 'den-planner/1.0' } } }) };
    } catch (e) { loading = null; return { client: null, enabled: false, error: e instanceof Error ? e.message : 'Сеть недоступна.' }; }
  })(); return loading;
}
const running = new Map<string, Promise<void>>();
export async function synchronize(client: SupabaseClient, scope: string, userId: string, changed: () => void) {
  if (running.has(scope)) return running.get(scope);
  const work = async () => {
    for (let i = 0; i < 200; i++) {
      const state = await changeState(scope, prepareBatch), batch = state.inFlight;
      if (!batch) break;
      const { data, error } = await client.rpc('planner_commit', { p_operation_id: batch.operationId, p_changes: batch.changes.map(c => ({ id: c.id, kind: c.kind, body: c.body, deleted: c.deleted, base_revision: c.baseRevision })) });
      if (error) throw new Error(error.message.includes('does not exist') ? 'Общая база ещё не настроена. Локальные изменения сохранены.' : 'Не удалось отправить изменения. Они сохранены на устройстве; повторим при подключении.');
      await changeState(scope, state => acknowledge(state, batch.operationId, data)); changed();
    }
    const remote: Row[] = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const { data, error } = await client.from('planner_records').select('id,kind,body,revision,deleted,updated_at,updated_by').eq('owner_id', userId).order('id').range(offset,offset + 499);
      if (error) throw new Error('Не удалось получить свежие задачи. Сохранённая версия остаётся на устройстве.');
      remote.push(...data as Row[]); if (data.length < 500) break;
    }
    await changeState(scope, state => mergeRemote(state,remote)); changed();
  };
  const promise: Promise<void> = (async () => { if (navigator.locks) await navigator.locks.request('den-sync-' + scope, work); else await work(); })();
  running.set(scope,promise);
  try { await promise; } finally { running.delete(scope); }
}
