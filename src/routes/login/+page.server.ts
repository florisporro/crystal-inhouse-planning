import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { canEdit } from '$lib/server/access';

export const load = ({ locals }) => {
	if (locals.user) redirect(302, '/my');
};

export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const apartment = Number(form.get('apartment'));
		const email = form.get('email')?.toString().trim().toLowerCase() ?? '';

		if (!Number.isInteger(apartment) || apartment < 1 || apartment > 179 || !email.includes('@')) {
			return fail(400, { error: 'Enter a valid apartment number and email address.' });
		}

		// Only request a link when the pair matches; respond identically either way
		// so the form doesn't reveal which emails are registered.
		if (await canEdit(email, apartment)) {
			try {
				await auth.api.signInMagicLink({
					headers: request.headers,
					body: { email, callbackURL: '/my' }
				});
			} catch (e) {
				// a send failure (e.g. Postmark down) must not 500 here: that would
				// reveal which addresses are registered, since unknown ones return
				// { sent: true } below
				console.error('magic link send failed:', e);
			}
		}
		return { sent: true };
	}
};
