import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCloud, synchronize, type CloudSetup, type Session } from './lib/cloud';
import { readState, changeState, subscribe } from './lib/store';
import { emptyState, stage, resolveConflict, type State } from './lib/sync-state';
import type { Change, Row } from './lib/model';

export function usePlanner() {
  const [cloud, setCloud] = useState<CloudSetup>({ client: null, enabled: false, loading:true });
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State>(emptyState);
  const [loadedScope, setLoadedScope] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [syncError, setSyncError] = useState(''), [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const scope = session ? `user:${session.user.id}` : 'local';
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const refresh = useCallback(async () => {
    const target = scope;
    try { const data = await readState(target); if (scopeRef.current === target) { setState(data); setLoadedScope(target); setError(''); } }
    catch (e) { if (scopeRef.current === target) setError(e instanceof Error ? e.message : 'Не удалось загрузить ежедневник.'); }
    finally { if (scopeRef.current === target) setLoading(false); }
  }, [scope]);
  useEffect(() => { let active = true; let unsubscribe: (() => void) | undefined;
    void loadCloud().then(async setup => {
      if (!active) return; setCloud(setup);
      if (setup.client) {
        const { data } = await setup.client.auth.getSession(); if (!active) return; setSession(data.session);
        const { data: auth } = setup.client.auth.onAuthStateChange((_event,next) => { if (active) setSession(next); });
        unsubscribe = () => auth.subscription.unsubscribe();
      }
    }).catch(() => { if (active) setSyncError('Не удалось проверить синхронизацию.'); });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  useEffect(() => {
    if (!cloud.client || !session) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && session.user.user_metadata?.planner_timezone !== zone)
      void cloud.client.auth.updateUser({data:{planner_timezone:zone}}).catch(() => {});
  }, [cloud.client, session?.user.id]);
  useEffect(() => { setLoading(true); void refresh(); return subscribe(scope, () => void refresh()); }, [scope,refresh]);
  const sync = useCallback(async () => {
    if (!cloud.client || !session || !navigator.onLine) return;
    const target = scope; setSyncing(true);
    try { await synchronize(cloud.client,target,session.user.id,() => void refresh()); if (scopeRef.current === target) setSyncError(''); }
    catch (e) { if (scopeRef.current === target) setSyncError(e instanceof Error ? e.message : 'Синхронизация временно недоступна.'); }
    finally { if (scopeRef.current === target) setSyncing(false); }
  }, [cloud.client,session,scope,refresh]);
  useEffect(() => {
    const onFocus = () => { setOnline(navigator.onLine); if (document.visibilityState === 'visible') { void refresh(); void sync(); } };
    const onNetwork = () => { setOnline(navigator.onLine); if (navigator.onLine) void sync(); };
    window.addEventListener('online',onNetwork); window.addEventListener('offline',onNetwork); window.addEventListener('focus',onFocus); document.addEventListener('visibilitychange',onFocus);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void sync(); },15000);
    void sync();
    const channel = cloud.client && session ? cloud.client.channel(`planner-${session.user.id}`).on('postgres_changes',{ event:'*',schema:'public',table:'planner_records',filter:`owner_id=eq.${session.user.id}` },() => void sync()).subscribe() : null;
    return () => { clearInterval(timer); window.removeEventListener('online',onNetwork); window.removeEventListener('offline',onNetwork); window.removeEventListener('focus',onFocus); document.removeEventListener('visibilitychange',onFocus); if (channel && cloud.client) void cloud.client.removeChannel(channel); };
  }, [sync,refresh,cloud.client,session]);
  const save = useCallback(async (changes: Change[]) => {
    const target = scope;
    const result = await changeState(target,current => stage(current,changes,!!session));
    if (scopeRef.current === target) { setState(result); setLoadedScope(target); setError(''); }
    void sync(); return result;
  }, [scope,session,sync]);
  const apply = useCallback(async (operation: (rows: Row[]) => Change[]) => {
    const target = scope;
    const result = await changeState(target,current => { const changes = operation(current.rows); return changes.length ? stage(current,changes,!!session) : current; });
    if (scopeRef.current === target) { setState(result); setLoadedScope(target); setError(''); }
    void sync(); return result;
  }, [scope,session,sync]);
  const resolve = useCallback(async (id: string,keep: 'local'|'remote') => {
    const result = await changeState(scope,current => resolveConflict(current,id,keep)); setState(result); void sync();
  }, [scope,sync]);
  const migrateLocal = useCallback(async () => {
    if (!session) throw new Error('Сначала войди в аккаунт.');
    await sync();
    const local = await readState('local'), current = await readState(scope);
    const records = local.rows.filter(r => !r.deleted && !current.rows.some(c => c.id === r.id));
    for (let i = 0; i < records.length; i += 100) await save(records.slice(i,i+100));
    return records.length;
  }, [scope,session,save,sync]);
  return { cloud,session,scope,state: loadedScope === scope ? state : emptyState(),loading: loading || loadedScope !== scope,error,syncError,syncing,online,save,apply,sync,refresh,resolve,migrateLocal };
}
export type PlannerApi = ReturnType<typeof usePlanner>;
