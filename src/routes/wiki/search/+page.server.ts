import { search } from '$lib/server/wiki';

export const load = async ({ locals, url }) => {
	const q = url.searchParams.get('q')?.slice(0, 200) ?? '';
	return { q, hits: await search(q, !!locals.user) };
};
