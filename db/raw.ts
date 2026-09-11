import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw new Error('Habit database is unavailable');
  return env.DB;
}
