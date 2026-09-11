import { sqliteTable, text, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  startDate: text('start_date').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [index('idx_habits_owner').on(table.ownerId)]);
export const entries = sqliteTable('entries', {
  ownerId: text('owner_id').notNull(),
  habitId: text('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  day: text('day').notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.habitId, table.day] })]);
