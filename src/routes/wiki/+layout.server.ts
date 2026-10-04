import { isAdmin } from '$lib/server/access';
import { getTree, openSuggestions } from '$lib/server/wiki';

export const load = async ({ locals }) => ({
	tree: await getTree(!!locals.user),
	openSuggestions:
		locals.user && isAdmin(locals.user.email) ? (await openSuggestions()).length : null
});
