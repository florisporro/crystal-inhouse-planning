// DEV ONLY: fills the next 14 days with deterministic sample activities and
// gives sold apartments a spread of statuses, so the public views have data.
// Run: bun run db:seed-samples
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, sql } from 'drizzle-orm';
import { activities, apartments } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
const db = drizzle(createClient({ url: process.env.DATABASE_URL }));

const isoDate = (offsetDays: number) => {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	return d.toISOString().slice(0, 10);
};

await db.delete(activities);

const types = ['moving', 'delivery', 'other', 'other', 'moving'] as const;
const blocks = ['morning', 'afternoon', 'full_day'] as const;
const rows: (typeof activities.$inferInsert)[] = [];
let apt = 0;
for (let day = 0; day < 14; day++) {
	const perDay = day === 3 ? 8 : (day * 5) % 4; // day 3 deliberately overloaded
	for (let i = 0; i < perDay; i++) {
		apt = (apt + 13) % 179;
		rows.push({
			apartmentNumber: apt + 1,
			type: types[(day + i) % types.length],
			block: day === 3 ? 'morning' : blocks[(day + i) % blocks.length],
			date: isoDate(day),
			note: i === 0 ? 'Sample data' : null
		});
	}
}
await db.insert(activities).values(rows);

// spread of statuses (unsold left untouched); rest stays no_data
await db
	.update(apartments)
	.set({ status: 'moved_in' })
	.where(sql`${apartments.number} % 5 = 0 AND ${apartments.unsold} = 0`);
await db
	.update(apartments)
	.set({ status: 'planned', plannedMoveDate: isoDate(21) })
	.where(sql`${apartments.number} % 5 = 1 AND ${apartments.unsold} = 0`);
await db
	.update(apartments)
	.set({ status: 'no_move_planned' })
	.where(sql`${apartments.number} % 5 = 2 AND ${apartments.unsold} = 0`);

const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(activities);
console.log(`Inserted ${count} sample activities over 14 days.`);
