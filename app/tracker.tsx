'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Activity, ArrowUpRight, BookOpen, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, CloudCheck, Droplets, Ellipsis, Flame, Heart, Loader2, Moon, Pencil, Plus, RefreshCw, Sparkles, Sun, Target, Trash2, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { COLORS, ICONS, MIN_DAY, dayKey, parseDay, validDay, shiftDay, shiftMonth, monthStart, monthDays, weekDays, entriesSet, entryKey, dayProgress, currentStreak, monthStats, russianDays, type Habit, type TrackerData } from '@/lib/habits';

const iconMap = { target: Target, move: Activity, book: BookOpen, briefcase: BriefcaseBusiness, water: Droplets, moon: Moon, heart: Heart, sun: Sun };
const iconNames = { target: 'Цель', move: 'Движение', book: 'Чтение', briefcase: 'Работа', water: 'Вода', moon: 'Сон', heart: 'Здоровье', sun: 'Утро' };
const colorNames = { lime: 'Лайм', blue: 'Голубой', violet: 'Фиолетовый', orange: 'Оранжевый', pink: 'Розовый' };
const weekLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const emptyData: TrackerData = { habits: [], entries: [] };
const format = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ru-RU', options).format(parseDay(day));
const monthTitle = (day: string) => format(day, { month: 'long', year: 'numeric' }).replace(' г.', '');
type Draft = { id: string; name: string; icon: string; color: string; startDate: string };
type Change = { habitId: string; day: string; done: boolean };
function HabitIcon({ name, size = 23 }: { name: string; size?: number }) { const Icon = iconMap[name as keyof typeof iconMap] || Target; return <Icon size={size} aria-hidden />; }
function CloseButton() { return <DialogClose asChild><button className="icon-button modal-close" aria-label="Закрыть"><X size={20} /></button></DialogClose>; }

export default function Tracker() {
  const [today, setToday] = useState('');
  const [selected, setSelected] = useState('');
  const [month, setMonth] = useState('');
  const [data, setData] = useState<TrackerData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [signIn, setSignIn] = useState(false);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [editor, setEditor] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [history, setHistory] = useState<Habit | null>(null);
  const [historyMonth, setHistoryMonth] = useState('');
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [dateOpen, setDateOpen] = useState(false);
  const [jumpDate, setJumpDate] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const busy = useRef(false), generation = useRef(0), dataRef = useRef(data), todayRef = useRef(today);
  dataRef.current = data; todayRef.current = today;
  const completed = useMemo(() => entriesSet(data.entries), [data.entries]);
  const progress = useMemo(() => selected ? dayProgress(data.habits, completed, selected) : { total: 0, done: 0, percent: 0 }, [selected, data.habits, completed]);
  const stats = useMemo(() => month && today ? monthStats(data.habits, completed, month, today) : { total: 0, done: 0, perfect: 0, percent: 0 }, [month, today, data.habits, completed]);

  const request = useCallback(async (body?: Record<string, unknown>) => {
    const response = await fetch('/api/tracker', { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'x-time-zone': Intl.DateTimeFormat().resolvedOptions().timeZone }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== 'object') throw new Error('Не удалось прочитать ответ. Обнови страницу.');
    const result = raw as { signIn?: boolean; error?: string; habits?: Habit[]; entries?: TrackerData['entries'] };
    if (!response.ok) { if (result.signIn) { setSignIn(true); setLoadError(result.error || 'Войди в ChatGPT.'); } throw new Error(result.error || 'Не удалось получить данные.'); }
    if (!Array.isArray(result.habits) || !Array.isArray(result.entries)) throw new Error('Не удалось прочитать ответ. Обнови страницу.');
    return result as TrackerData;
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    const version = ++generation.current;
    try {
      const next = await request();
      if (generation.current === version && !busy.current) { setData(next); setLoadError(''); setSaveError(false); setSignIn(false); }
    } catch (error) { if (generation.current === version) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить данные.'); }
    finally { if (generation.current === version) setLoading(false); }
  }, [request]);

  useEffect(() => {
    const now = dayKey(); setToday(now); setSelected(now); setMonth(monthStart(now)); void refresh();
    const tick = () => { const current = dayKey(); setToday(previous => { if (previous !== current) setSelected(d => d === previous ? current : d); return current; }); };
    const focus = () => { if (document.visibilityState === 'visible') { tick(); void refresh(); } };
    const timer = setInterval(tick, 30000); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);
  useEffect(() => { if (!celebrating) return; const timer = setTimeout(() => setCelebrating(false), 1300); return () => clearTimeout(timer); }, [celebrating]);

  const mutate = useCallback(async (body: Record<string, unknown>, optimistic?: (current: TrackerData) => TrackerData) => {
    if (busy.current) throw new Error('Дождись сохранения предыдущей отметки.');
    busy.current = true; generation.current++; setPending(true); setSaveError(false);
    const before = dataRef.current;
    if (optimistic) setData(optimistic(before));
    try { const next = await request(body); setData(next); setLoadError(''); setLoading(false); return next; }
    catch (error) { setData(before); setSaveError(true); const message = error instanceof Error ? error.message : 'Не удалось подтвердить сохранение. Обнови данные и проверь отметку.'; toast.error(message, { duration: 7000 }); throw error; }
    finally { busy.current = false; setPending(false); }
  }, [request]);

  const setEntries = useCallback(async (items: Change[]) => {
    if (!items.length || items.some(e => !validDay(e.day) || e.day > todayRef.current || !dataRef.current.habits.some(h => h.id === e.habitId))) throw new Error('Выбери привычку и прошедшую дату.');
    return mutate({ action: 'setEntries', entries: items }, current => {
      let entries = [...current.entries], habits = [...current.habits];
      for (const e of items) {
        entries = entries.filter(x => !(x.habitId === e.habitId && x.day === e.day));
        if (e.done) { entries.push({ habitId: e.habitId, day: e.day }); habits = habits.map(h => h.id === e.habitId && h.startDate > e.day ? { ...h, startDate: e.day } : h); }
      }
      return { habits, entries };
    });
  }, [mutate]);

  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      { name: 'read_habits', title: 'Прочитать привычки', description: 'Read the currently loaded habits and completed dates. Does not change data.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ ...dataRef.current, today: todayRef.current }) },
      { name: 'set_habit_entries', title: 'Сохранить отметки привычек', description: 'Set or remove explicit habit completions for today or past dates. Persists the changes and refreshes the visible tracker.', inputSchema: { type: 'object', properties: { entries: { type: 'array', minItems: 1, maxItems: 62, items: { type: 'object', properties: { habitId: { type: 'string' }, day: { type: 'string' }, done: { type: 'boolean' } }, required: ['habitId', 'day', 'done'], additionalProperties: false } } }, required: ['entries'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input: unknown) => {
        const items = (input as { entries?: unknown })?.entries;
        if (!Array.isArray(items) || !items.length || items.length > 62 || items.some(e => !e || typeof e.habitId !== 'string' || !validDay(e.day) || typeof e.done !== 'boolean')) throw new Error('Некорректные отметки.');
        const next = await setEntries(items); return { saved: items.length, entries: next.entries };
      } },
    ];
    for (const tool of tools) { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} }
    return () => lifecycle.abort();
  }, [setEntries]);

  function chooseDay(day: string) { if (!validDay(day) || day > today) return; setSelected(day); setMonth(monthStart(day)); }
  function newHabit(name = '', icon = 'target', color = 'lime') { setEditing(false); setEditor({ id: crypto.randomUUID(), name, icon, color, startDate: selected || dayKey() }); }
  function editHabit(habit: Habit) { setEditing(true); setEditor({ ...habit }); }
  function showHistory(habit: Habit) { setHistory(habit); setHistoryMonth(monthStart(selected)); setChanges({}); }
  async function toggle(habit: Habit, done: boolean) {
    try {
      const next = await setEntries([{ habitId: habit.id, day: selected, done }]);
      if (done) { const p = dayProgress(next.habits, entriesSet(next.entries), selected); if (p.total && p.done === p.total) { setCelebrating(true); toast.success(selected === today ? 'Все привычки на сегодня выполнены!' : 'Все привычки за этот день выполнены!'); } }
    } catch {}
  }
  async function saveHabit(event: FormEvent) {
    event.preventDefault(); if (!editor) return;
    try { await mutate({ action: editing ? 'update' : 'create', ...editor }); setEditor(null); toast.success(editing ? 'Привычка обновлена' : 'Привычка добавлена'); } catch {}
  }
  async function saveHistory() {
    if (!history) return;
    try { await setEntries(Object.entries(changes).map(([day, done]) => ({ habitId: history.id, day, done }))); setHistory(null); toast.success('Отметки сохранены. Статистика обновлена.'); } catch {}
  }
  async function deleteHabit() {
    if (!deleting) return;
    try { await mutate({ action: 'delete', id: deleting.id }); setDeleting(null); toast.success('Привычка удалена'); } catch {}
  }
  const isPast = selected && selected !== today;
  const allowed = !loading && !loadError && !signIn;

  return <div className="app-shell">
    <header className="topbar"><a href="/" className="brand" aria-label="Ритм — главная"><span className="brand-mark" aria-hidden><i /><i /><i /></span><span>ритм<span className="brand-period">.</span></span></a><span className="brand-caption">ТРЕКЕР ПРИВЫЧЕК</span><div className="cloud-status"><CloudCheck size={17} /><span>Личный трекер</span></div></header>
    <main className="workspace">
      <div className="page-heading"><div><div className="eyebrow">МАЛЕНЬКИЕ ШАГИ. КАЖДЫЙ ДЕНЬ.</div><h1>Мои привычки<span className="heading-dot">.</span></h1></div><button className="primary-button" onClick={() => newHabit()} disabled={!allowed || pending}><Plus size={20} /><span>Новая привычка</span></button></div>
      {loadError && <div className="error-banner" role="alert"><span>{loadError}</span>{signIn ? <a href="/signin-with-chatgpt?return_to=%2F" target="_top" className="small-button">Войти в ChatGPT</a> : <button className="small-button" onClick={() => void refresh()}><RefreshCw size={16} />Повторить</button>}</div>}
      <div className="dashboard-grid">
        <section className="main-column" aria-label="Привычки по дням">
          <div className="day-toolbar"><div className="day-label"><h2>{isPast ? format(selected, { day: 'numeric', month: 'long' }) : 'Сегодня'}</h2>{selected && <span>{format(selected, isPast ? { year: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long' })}</span>}</div><div className="day-controls">{isPast && <button className="text-button" onClick={() => chooseDay(today)}>К сегодня</button>}<button className="icon-button" aria-label="Выбрать любую дату" onClick={() => { setJumpDate(selected); setDateOpen(true); }} disabled={!today}><CalendarDays size={20} /></button></div></div>
          <div className="week-navigation"><button className="icon-button" aria-label="Предыдущая неделя" disabled={!selected || shiftDay(selected, -7) < MIN_DAY} onClick={() => chooseDay(shiftDay(selected, -7))}><ChevronLeft size={19} /></button><span>{selected ? `${format(weekDays(selected)[0], { day: 'numeric', month: 'short' })} — ${format(weekDays(selected)[6], { day: 'numeric', month: 'short' })}` : 'Загружаем календарь'}</span><button className="icon-button" aria-label="Следующая неделя" disabled={!selected || weekDays(selected)[6] >= today} onClick={() => chooseDay(shiftDay(selected, 7) > today ? today : shiftDay(selected, 7))}><ChevronRight size={19} /></button></div>
          <div className="week-strip">{selected && weekDays(selected).map((day, i) => { const p = dayProgress(data.habits, completed, day); return <button key={day} className={`week-day ${day === selected ? 'selected' : ''} ${day === today ? 'is-today' : ''}`} disabled={day > today || day < MIN_DAY} onClick={() => chooseDay(day)} aria-pressed={day === selected} aria-label={`${format(day, { day: 'numeric', month: 'long', weekday: 'long' })}, выполнено ${p.done} из ${p.total}`}><span>{weekLabels[i]}</span><strong>{parseDay(day).getDate()}</strong><span className={`day-marker ${p.done > 0 ? 'has-progress' : ''} ${p.total && p.done === p.total ? 'is-complete' : ''}`}>{p.total && p.done === p.total ? <Check size={12} /> : null}</span></button>; })}</div>
          {isPast && <div className="past-note"><CalendarDays size={17} /><span>Прошлая дата. Отмечай и исправляй как обычно.</span></div>}
          <div className="list-caption"><span>ПРИВЫЧКИ НА ДЕНЬ</span><span>{progress.done} / {progress.total}</span></div>
          <div className="habit-list" aria-busy={pending || loading}>
            {loading ? <div className="loading-state" role="status"><Loader2 className="spin" size={26} />Загружаем твой ритм…</div> : !data.habits.length ? <Empty className="empty-state"><EmptyHeader><span className="empty-icon"><Sparkles size={28} /></span><EmptyTitle>Начни с одной привычки</EmptyTitle><EmptyDescription>Выбери то, чему хочешь уделять время каждый день.</EmptyDescription></EmptyHeader><button className="primary-button" disabled={!allowed} onClick={() => newHabit()}><Plus size={19} />Добавить свою</button><div className="suggestions"><button disabled={!allowed} onClick={() => newHabit('Двигаться 30 минут', 'move', 'lime')}><Activity size={16} />Движение</button><button disabled={!allowed} onClick={() => newHabit('Читать 10 страниц', 'book', 'violet')}><BookOpen size={16} />Чтение</button><button disabled={!allowed} onClick={() => newHabit('Час на своё дело', 'briefcase', 'blue')}><BriefcaseBusiness size={16} />Своё дело</button></div></Empty> : data.habits.map((habit, i) => {
              const done = completed.has(entryKey(habit.id, selected)), streak = currentStreak(habit, completed, today), beforeStart = selected < habit.startDate;
              return <article key={habit.id} className={`habit-card color-${habit.color} ${done ? 'completed' : ''}`} style={{ '--order': i } as CSSProperties}>
                <div className="habit-main"><span className="habit-icon"><HabitIcon name={habit.icon} /></span><div className="habit-copy"><label htmlFor={`habit-${habit.id}`}>{habit.name}</label><span>{done ? <><Check size={14} />Выполнено</> : beforeStart ? 'Отметка перенесёт начало на этот день' : 'Каждый день'}</span></div><Checkbox id={`habit-${habit.id}`} className="habit-checkbox" checked={done} disabled={pending || !allowed} onCheckedChange={value => void toggle(habit, value === true)} aria-label={`${done ? 'Снять отметку' : 'Выполнить'}: ${habit.name}, ${selected}`} /></div>
                <div className="habit-bottom"><span className={`streak ${streak ? 'active-streak' : ''}`} title="Серия до сегодня. Пока сегодняшний день не закончился, отсутствие отметки её не обрывает."><Flame size={15} />{streak ? `${streak} ${russianDays(streak)} подряд` : 'Новый ритм'}</span><div className="habit-actions"><button className="history-button" disabled={pending || !allowed} onClick={() => showHistory(habit)}><CalendarDays size={15} /><span>Заполнить дни</span></button><DropdownMenu><DropdownMenuTrigger asChild><button className="icon-button more-button" disabled={pending || !allowed} aria-label={`Действия: ${habit.name}`}><Ellipsis size={19} /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="app-menu"><DropdownMenuItem onSelect={() => editHabit(habit)}><Pencil />Изменить</DropdownMenuItem><DropdownMenuItem onSelect={() => showHistory(habit)}><CalendarDays />Заполнить прошлые дни</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setDeleting(habit)}><Trash2 />Удалить</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>
              </article>;
            })}
          </div>
          {!!data.habits.length && <button className="add-row" disabled={pending || !allowed} onClick={() => newHabit()}><Plus size={18} />Добавить привычку</button>}
          <div className="save-status" role="status">{pending ? <><Loader2 size={14} className="spin" />Сохраняем…</> : saveError ? <><RefreshCw size={14} /><button onClick={() => void refresh()}>Сохранение не подтверждено · обновить</button></> : allowed ? <><CloudCheck size={15} />Все изменения сохранены</> : null}</div>
        </section>
        <aside className="side-column" aria-label="Прогресс и календарь">
          <section className={`progress-card ${celebrating ? 'celebrate' : ''}`}><div className="progress-copy"><span className="eyebrow">{isPast ? 'ВЫБРАННЫЙ ДЕНЬ' : 'ТВОЙ ДЕНЬ'}</span><h2>{progress.total && progress.done === progress.total ? 'Всё получилось' : progress.done ? 'Ритм набирается' : 'Всё впереди'}</h2><p>{progress.total ? `${progress.done} из ${progress.total} выполнено` : 'Здесь будет твой прогресс'}</p></div><div className="progress-ring" role="img" aria-label={`Выполнено ${progress.percent}%`}><svg viewBox="0 0 116 116" aria-hidden><circle className="ring-track" cx="58" cy="58" r="48" /><circle className="ring-value" cx="58" cy="58" r="48" style={{ strokeDasharray: 302, strokeDashoffset: 302 * (1 - progress.percent / 100) }} /></svg><span>{progress.percent}<small>%</small></span></div>{celebrating && <div className="confetti" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>}</section>
          <section className="calendar-card"><div className="calendar-heading"><h2>{month ? monthTitle(month) : 'Календарь'}</h2><div><button className="icon-button" aria-label="Предыдущий месяц" disabled={!month || month <= MIN_DAY} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></button><button className="icon-button" aria-label="Следующий месяц" disabled={!month || month >= monthStart(today)} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></button></div></div><div className="month-grid">{weekLabels.map(d => <span className="weekday-label" key={d}>{d}</span>)}{month && Array.from({ length: (parseDay(month).getDay() + 6) % 7 }, (_, i) => <span key={`pad${i}`} />)}{month && monthDays(month).map(day => { const p = dayProgress(data.habits, completed, day); return <button className={`month-day ${day === selected ? 'selected' : ''} ${day === today ? 'today' : ''} ${p.done ? p.done === p.total ? 'full' : 'partial' : ''}`} key={day} disabled={day > today} onClick={() => chooseDay(day)} aria-pressed={day === selected} aria-label={`${format(day, { day: 'numeric', month: 'long', year: 'numeric' })}: ${p.done} из ${p.total}`}><span>{parseDay(day).getDate()}</span>{p.done > 0 && <i />}</button>; })}</div><div className="calendar-legend"><span><i className="partial" />Часть</span><span><i className="full" />Всё сделано</span></div><button className="calendar-jump" onClick={() => { setJumpDate(selected); setDateOpen(true); }}><CalendarDays size={16} />Перейти к дате<ArrowUpRight size={15} /></button></section>
          <section className="stats-card"><div className="section-label"><span>ИТОГИ МЕСЯЦА</span><Activity size={16} /></div><div className="stats-numbers"><div><strong>{stats.done}</strong><span>выполнено</span></div><div><strong>{stats.perfect}</strong><span>идеальных дней</span></div></div><div className="stats-percent"><span>Выполнено от плана</span><strong>{stats.percent}%</strong></div><Progress className="month-progress" value={stats.percent} aria-label="Выполнено от плана за месяц" /><p>С даты начала каждой привычки. Будущие дни не учитываются.</p></section>
          <div className="quiet-tip"><CalendarDays size={19} /><p>Забыл поставить галочку?<br /><span>«Заполнить дни» — и история в порядке.</span></p></div>
        </aside>
      </div>
      <footer className="page-footer"><span>ритм<span>.</span></span><p>Твой темп. Твой прогресс.</p></footer>
    </main>

    <Dialog open={!!editor} onOpenChange={open => { if (!open && !pending) setEditor(null); }}><DialogContent className="app-dialog" showCloseButton={false}><CloseButton /><DialogHeader><DialogTitle>{editing ? 'Изменить привычку' : 'Новая привычка'}</DialogTitle><DialogDescription>Одно понятное действие на каждый день.</DialogDescription></DialogHeader>{editor && <form onSubmit={saveHabit} className="habit-form"><label className="field-label" htmlFor="habit-name">Что будешь делать?</label><input id="habit-name" className="text-input" value={editor.name} autoFocus maxLength={80} required placeholder="Например, читать 10 страниц" onChange={e => setEditor({ ...editor, name: e.target.value })} /><div className="form-two-columns"><div><label className="field-label" htmlFor="icon-select">Значок</label><Select value={editor.icon} onValueChange={icon => setEditor({ ...editor, icon })}><SelectTrigger id="icon-select" className="form-select"><SelectValue /></SelectTrigger><SelectContent>{ICONS.map(icon => <SelectItem key={icon} value={icon}><HabitIcon name={icon} size={17} />{iconNames[icon]}</SelectItem>)}</SelectContent></Select></div><div><label className="field-label" htmlFor="color-select">Цвет</label><Select value={editor.color} onValueChange={color => setEditor({ ...editor, color })}><SelectTrigger id="color-select" className="form-select"><SelectValue /></SelectTrigger><SelectContent>{COLORS.map(color => <SelectItem key={color} value={color}><span className={`color-chip color-${color}`} />{colorNames[color]}</SelectItem>)}</SelectContent></Select></div></div><label className="field-label" htmlFor="start-date">Учитывать с</label><input className="text-input" id="start-date" type="date" min={MIN_DAY} max={today} required value={editor.startDate} onChange={e => setEditor({ ...editor, startDate: e.target.value })} /><p className="field-help">Можно начать с прошлой даты. Если отметишь более ранний день, начало сдвинется автоматически. Существующие отметки сохранятся.</p><button type="submit" className="primary-button full-width" disabled={pending || !editor.name.trim() || !validDay(editor.startDate) || editor.startDate > today}>{pending ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}{editing ? 'Сохранить изменения' : 'Добавить привычку'}</button></form>}</DialogContent></Dialog>

    <Dialog open={!!history} onOpenChange={open => { if (!open && !pending) setHistory(null); }}><DialogContent className={`app-dialog history-dialog color-${history?.color || 'lime'}`} showCloseButton={false}><CloseButton /><DialogHeader><DialogTitle>Заполнить дни</DialogTitle><DialogDescription>{history?.name}. Отметь выполненные дни и сохрани.</DialogDescription></DialogHeader>{history && <><div className="calendar-heading"><h3>{monthTitle(historyMonth)}</h3><div><button className="icon-button" aria-label="Ранее: месяц отметок" disabled={pending || historyMonth <= MIN_DAY} onClick={() => setHistoryMonth(shiftMonth(historyMonth, -1))}><ChevronLeft size={20} /></button><button className="icon-button" aria-label="Позже: месяц отметок" disabled={pending || historyMonth >= monthStart(today)} onClick={() => setHistoryMonth(shiftMonth(historyMonth, 1))}><ChevronRight size={20} /></button></div></div><div className="month-grid history-grid">{weekLabels.map(d => <span key={d} className="weekday-label">{d}</span>)}{Array.from({ length: (parseDay(historyMonth).getDay() + 6) % 7 }, (_, i) => <span key={`blank${i}`} />)}{monthDays(historyMonth).map(day => { const saved = completed.has(entryKey(history.id, day)), done = changes[day] ?? saved; return <div key={day} className={`history-day ${done ? 'checked' : ''} ${day === today ? 'today' : ''} ${day > today ? 'future' : ''}`}><label htmlFor={`history-${day}`}>{parseDay(day).getDate()}</label><Checkbox id={`history-${day}`} checked={done} disabled={day > today || pending} aria-label={`${format(day, { day: 'numeric', month: 'long', year: 'numeric' })}, ${history.name}`} onCheckedChange={value => setChanges(current => { const next = { ...current }; if ((value === true) === saved) delete next[day]; else next[day] = value === true; return next; })} /></div>; })}</div><p className="field-help">Можно заполнить несколько дней и даже разные месяцы за один раз. Повторное нажатие снимает галочку.</p><button className="primary-button full-width" disabled={pending || !Object.keys(changes).length} onClick={() => void saveHistory()}>{pending ? <Loader2 size={18} className="spin" /> : <Check size={18} />}Сохранить{Object.keys(changes).length ? ` · ${Object.keys(changes).length}` : ''}</button></>}</DialogContent></Dialog>

    <Dialog open={dateOpen} onOpenChange={setDateOpen}><DialogContent className="app-dialog" showCloseButton={false}><CloseButton /><DialogHeader><DialogTitle>К какому дню вернуться?</DialogTitle><DialogDescription>Выбирай любую прошлую дату.</DialogDescription></DialogHeader><form onSubmit={e => { e.preventDefault(); if (validDay(jumpDate) && jumpDate <= today) { chooseDay(jumpDate); setDateOpen(false); } }}><label className="field-label" htmlFor="jump-date">Дата</label><input id="jump-date" className="text-input" type="date" min={MIN_DAY} max={today} required value={jumpDate} onChange={e => setJumpDate(e.target.value)} /><button className="primary-button full-width date-submit" disabled={!validDay(jumpDate) || jumpDate > today}>Перейти к дню</button></form></DialogContent></Dialog>

    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !pending) setDeleting(null); }}><AlertDialogContent className="app-dialog"><AlertDialogHeader><AlertDialogTitle>Удалить привычку?</AlertDialogTitle><AlertDialogDescription>«{deleting?.name}» и все её отметки будут удалены. Восстановить их не получится.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Оставить</AlertDialogCancel><AlertDialogAction className="delete-button" disabled={pending} onClick={e => { e.preventDefault(); void deleteHabit(); }}>{pending ? 'Удаляем…' : 'Удалить'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Toaster theme="dark" position="bottom-center" closeButton richColors />
  </div>;
}
