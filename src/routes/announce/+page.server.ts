import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { activities } from '$lib/server/db/schema';
import { apartmentNumbersForEmail, canEdit, isAdmin } from '$lib/server/access';
import { ISO_DATE, activityFields } from '$lib/server/activityForm';

export const load = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	const numbers = await apartmentNumbersForEmail(locals.user.email);
	const admin = isAdmin(locals.user.email);
	if (numbers.length === 0 && !admin) redirect(302, '/my');

	const dateParam = url.searchParams.get('date') ?? '';
	const aptParam = Number(url.searchParams.get('apartment'));
	return {
		numbers,
		admin,
		prefillDate: ISO_DATE.test(dateParam) ? dateParam : '',
		prefillApartment: Number.isInteger(aptParam) && aptParam > 0 ? aptParam : (numbers[0] ?? null)
	};
};

export const actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) redirect(302, '/login');
		const form = await request.formData();
		const apartment = Number(form.get('apartment'));
		if (!(await canEdit(locals.user.email, apartment))) error(403, 'Not your apartment');
		const fields = activityFields(form);
		if (!fields) return fail(400, { error: 'Please pick an activity type, date and time.' });
		await db.insert(activities).values({ apartmentNumber: apartment, ...fields });
		redirect(303, '/my');
	}
};
