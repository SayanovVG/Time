import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database } from '@/db/raw';
import { COLORS, ICONS, validDay, type Habit, type Entry } from '@/lib/habits';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
class InputError extends Error {}
function fail(message: string): never { throw new InputError(message); }
function todayAt(request: Request) {
  const zone = request.headers.get('x-time-zone') || 'Europe/Moscow';
  if (zone.length > 100) fail('Некорректный часовой пояс.');
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return fail('Некорректный часовой пояс.'); }
}
function idValue(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(value)) fail('Не удалось определить привычку.');
  return value;
}
async function snapshot(owner: string) {
  const db = database();
  const result = await db.batch([
    db.prepare('SELECT id, name, icon, color, start_date AS startDate, created_at AS createdAt FROM habits WHERE owner_id = ? ORDER BY created_at, id').bind(owner),
    db.prepare('SELECT habit_id AS habitId, day FROM entries WHERE owner_id = ? ORDER BY day').bind(owner),
  ]);
  return { habits: result[0].results as Habit[], entries: result[1].results as Entry[] };
}
export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ error: 'Войди в ChatGPT, чтобы открыть свои привычки.', signIn: true }, 401);
    return json(await snapshot(user.userId));
  } catch (error) { console.error('Tracker load failed', error); return json({ error: 'Не удалось загрузить привычки. Попробуй ещё раз.' }, 503); }
}
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ error: 'Войди в ChatGPT, чтобы сохранить привычки.', signIn: true }, 401);
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Запрос с другого сайта отклонён.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Ожидался JSON.' }, 415);
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: 'Слишком большой запрос.' }, 413);
    let input: Record<string, unknown>;
    try { input = JSON.parse(raw); } catch { return json({ error: 'Некорректный запрос.' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Некорректный запрос.');
    const db = database(), owner = user.userId, today = todayAt(request);
    if (input.action === 'create' || input.action === 'update') {
      const id = idValue(input.id), name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!name || name.length > 80) fail('Название должно содержать от 1 до 80 символов.');
      if (!(ICONS as readonly unknown[]).includes(input.icon) || !(COLORS as readonly unknown[]).includes(input.color)) fail('Выбери значок и цвет.');
      if (!validDay(input.startDate) || input.startDate > today) fail('Выбери сегодняшнюю или прошлую дату начала.');
      if (input.action === 'create') {
        await db.prepare('INSERT INTO habits (id, owner_id, name, icon, color, start_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
          .bind(id, owner, name, input.icon, input.color, input.startDate, new Date().toISOString()).run();
      } else {
        const result = await db.prepare('UPDATE habits SET name = ?, icon = ?, color = ?, start_date = MIN(?, COALESCE((SELECT MIN(day) FROM entries WHERE owner_id = ? AND habit_id = ?), ?)) WHERE id = ? AND owner_id = ?')
          .bind(name, input.icon, input.color, input.startDate, owner, id, input.startDate, id, owner).run();
        if (!result.meta.changes) return json({ error: 'Привычка уже удалена. Обнови страницу.' }, 404);
      }
    } else if (input.action === 'delete') {
      const id = idValue(input.id);
      await db.batch([
        db.prepare('DELETE FROM entries WHERE habit_id = ? AND owner_id = ?').bind(id, owner),
        db.prepare('DELETE FROM habits WHERE id = ? AND owner_id = ?').bind(id, owner),
      ]);
    } else if (input.action === 'setEntries') {
      if (!Array.isArray(input.entries) || !input.entries.length || input.entries.length > 62) fail('Выбери от 1 до 62 отметок.');
      const changes = input.entries.map((item: unknown) => {
        if (!item || typeof item !== 'object') return fail('Некорректная отметка.');
        const e = item as Record<string, unknown>, habitId = idValue(e.habitId);
        if (!validDay(e.day) || e.day > today || typeof e.done !== 'boolean') fail('Отмечать можно только сегодняшний и прошлые дни.');
        return { habitId, day: e.day, done: e.done };
      });
      const ids = [...new Set(changes.map(e => e.habitId))];
      const owned = await db.prepare('SELECT id FROM habits WHERE owner_id = ?').bind(owner).all<{ id: string }>();
      if (ids.some(id => !owned.results.some(h => h.id === id))) return json({ error: 'Привычка не найдена. Обнови страницу.' }, 404);
      const statements = changes.flatMap(e => e.done ? [
        db.prepare('UPDATE habits SET start_date = MIN(start_date, ?) WHERE id = ? AND owner_id = ?').bind(e.day, e.habitId, owner),
        db.prepare('INSERT INTO entries (owner_id, habit_id, day) SELECT ?, id, ? FROM habits WHERE owner_id = ? AND id = ? ON CONFLICT(owner_id, habit_id, day) DO NOTHING').bind(owner, e.day, owner, e.habitId),
      ] : [db.prepare('DELETE FROM entries WHERE owner_id = ? AND habit_id = ? AND day = ?').bind(owner, e.habitId, e.day)]);
      await db.batch(statements);
    } else fail('Неизвестное действие.');
    return json(await snapshot(owner));
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    console.error('Tracker save failed', error);
    return json({ error: 'Не удалось подтвердить сохранение. Обнови данные и проверь отметку.' }, 503);
  }
}
