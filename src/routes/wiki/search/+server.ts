import { json } from '@sveltejs/kit';
import { search } from '$lib/server/wiki';

// JSON for the search box; browsers navigating here get +page.svelte
export const GET = async ({ locals, url }) =>
	json(await search(url.searchParams.get('q')?.slice(0, 200) ?? '', !!locals.user, 8));
