import { redirect } from '@sveltejs/kit';
import { getPage } from '$lib/server/wiki';

export const load = async ({ locals, params, url }) => {
	const page = await getPage(
		params.page,
		!!locals.user,
		`/login?next=${encodeURIComponent(url.pathname)}`
	);
	// page moved to another topic: keep old URLs working
	if (page.topicSlug !== params.topic) redirect(301, `/wiki/${page.topicSlug}/${page.slug}`);
	return { page, loginUrl: `/login?next=${encodeURIComponent(url.pathname)}` };
};
