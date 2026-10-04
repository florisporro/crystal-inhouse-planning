import { diffView, getHistory, getPageRow } from '$lib/server/wiki';
import { requireUser } from '$lib/server/access';

export const load = async ({ locals, params, url }) => {
	requireUser(locals, url);
	const page = await getPageRow(params.page, true);
	const revisions = await getHistory(page.id);
	const rev = Number(url.searchParams.get('rev')) || revisions[0]?.id;
	const i = revisions.findIndex((r) => r.id === rev);
	return {
		page: { title: page.title, url: `/wiki/${page.topicSlug}/${page.slug}` },
		revisions: revisions.map(({ body: _, ...r }) => r),
		selected: rev,
		// against the revision before it; the first revision diffs against nothing
		parts: i < 0 ? [] : await diffView(revisions[i + 1]?.body ?? '', revisions[i].body)
	};
};
