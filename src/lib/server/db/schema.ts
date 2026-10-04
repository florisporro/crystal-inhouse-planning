import {
	integer,
	primaryKey,
	sqliteTable,
	text,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';

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

// audit trail for gate openings; doubles as the per-apartment cooldown source
export const gateOpens = sqliteTable('gate_opens', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	apartmentNumber: integer('apartment_number')
		.notNull()
		.references(() => apartments.number),
	activityId: integer('activity_id').references(() => activities.id), // null for an admin open
	email: text('email').notNull(),
	callId: text('call_id'), // null if Bird rejected the request outright
	// last phase we saw: dialling | ringing | done | failed
	phase: text('phase', { enum: ['dialling', 'ringing', 'done', 'failed'] })
		.notNull()
		.default('dialling'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// wiki: Topic > Page. Page bodies live in revisions; pages point at the current one.
// Search is the wiki_search FTS5 table, created in a custom migration (drizzle can't model it).
export const wikiTopics = sqliteTable('wiki_topics', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	intro: text('intro').notNull().default(''), // markdown, public
	sort: integer('sort').notNull().default(0)
});

export const wikiPages = sqliteTable('wiki_pages', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	topicId: integer('topic_id')
		.notNull()
		.references(() => wikiTopics.id),
	slug: text('slug').notNull().unique(), // global and immutable: wiki:slug links depend on it
	title: text('title').notNull(),
	private: integer('private', { mode: 'boolean' }).notNull().default(false),
	sort: integer('sort').notNull().default(0),
	revisionId: integer('revision_id').references((): AnySQLiteColumn => wikiRevisions.id),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const wikiRevisions = sqliteTable('wiki_revisions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	pageId: integer('page_id')
		.notNull()
		.references((): AnySQLiteColumn => wikiPages.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	body: text('body').notNull(), // normalized markdown
	authorEmail: text('author_email').notNull(),
	authorName: text('author_name').notNull(),
	suggestionId: integer('suggestion_id'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const wikiSuggestions = sqliteTable('wiki_suggestions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	pageId: integer('page_id').references(() => wikiPages.id, { onDelete: 'cascade' }), // null = new page
	topicId: integer('topic_id').references(() => wikiTopics.id), // target topic for a new page
	baseRevisionId: integer('base_revision_id').references(() => wikiRevisions.id),
	title: text('title').notNull(),
	body: text('body').notNull(), // normalized markdown
	authorEmail: text('author_email').notNull(),
	authorName: text('author_name').notNull(),
	status: text('status', { enum: ['open', 'accepted', 'partial', 'declined'] })
		.notNull()
		.default('open'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
	reviewNote: text('review_note'), // optional message from the admin to the author
	// set once the daily admin digest / the author's outcome email included this row
	adminNotifiedAt: integer('admin_notified_at', { mode: 'timestamp' }),
	authorNotifiedAt: integer('author_notified_at', { mode: 'timestamp' })
});

export const wikiImages = sqliteTable('wiki_images', {
	id: text('id').primaryKey(), // random hex, also the file name
	mime: text('mime').notNull(),
	// private until a public part of a public page references it; recomputed on every save
	private: integer('private', { mode: 'boolean' }).notNull().default(true),
	uploadedBy: text('uploaded_by').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export * from './auth.schema';
