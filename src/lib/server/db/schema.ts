import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const apartments = sqliteTable('apartments', {
	number: integer('number').primaryKey(),
	floor: integer('floor').notNull(),
	// derived at seed time: apartment email matches the UNSOLD_EMAIL env var
	unsold: integer('unsold', { mode: 'boolean' }).notNull().default(false),
	status: text('status', { enum: ['no_data', 'no_move_planned', 'planned', 'moved_in'] })
		.notNull()
		.default('no_data'),
	plannedMoveDate: text('planned_move_date') // ISO date, set by owner
});

export const activities = sqliteTable('activities', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	apartmentNumber: integer('apartment_number')
		.notNull()
		.references(() => apartments.number),
	type: text('type', { enum: ['moving', 'delivery', 'other'] }).notNull(),
	date: text('date').notNull(), // ISO yyyy-mm-dd
	block: text('block', { enum: ['morning', 'afternoon', 'full_day'] }).notNull(),
	note: text('note'),
	status: text('status', { enum: ['active', 'cancelled'] })
		.notNull()
		.default('active'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

// who may manage which apartment; emails stored lowercase
export const apartmentEmails = sqliteTable(
	'apartment_emails',
	{
		apartmentNumber: integer('apartment_number')
			.notNull()
			.references(() => apartments.number),
		email: text('email').notNull()
	},
	(t) => [primaryKey({ columns: [t.apartmentNumber, t.email] })]
);

export * from './auth.schema';
