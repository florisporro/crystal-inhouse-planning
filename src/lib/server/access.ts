import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { apartmentEmails } from '$lib/server/db/schema';

// comma-separated ADMIN_EMAILS env var; unset → no admins
const adminEmails = () =>
	(env.ADMIN_EMAILS ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);

export const isAdmin = (email: string) => adminEmails().includes(email.toLowerCase());

export async function apartmentNumbersForEmail(email: string): Promise<number[]> {
	const rows = await db
		.select({ apartmentNumber: apartmentEmails.apartmentNumber })
		.from(apartmentEmails)
		.where(eq(apartmentEmails.email, email.toLowerCase()));
	return rows.map((r) => r.apartmentNumber);
}

export async function isKnownEmail(email: string): Promise<boolean> {
	if (isAdmin(email)) return true;
	return (await apartmentNumbersForEmail(email)).length > 0;
}

export async function canEdit(email: string, apartmentNumber: number): Promise<boolean> {
	if (isAdmin(email)) return true;
	return (await apartmentNumbersForEmail(email)).includes(apartmentNumber);
}
