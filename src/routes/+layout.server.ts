import { isAdmin } from '$lib/server/access';

export const load = ({ locals }) => ({
	email: locals.user?.email ?? null,
	admin: !!locals.user && isAdmin(locals.user.email)
});
