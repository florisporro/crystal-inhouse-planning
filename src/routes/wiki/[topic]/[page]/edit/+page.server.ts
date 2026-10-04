import { redirect } from '@sveltejs/kit';
import { getPageRow, linkTargets, submitEdit, wikiUser } from '$lib/server/wiki';
import { requireUser } from '$lib/server/access';

export const load = async ({ locals, params, url }) => {
	const user = requireUser(locals, url);
	const page = await getPageRow(params.page, true);
	return {
		page: {
			title: page.title,
			body: page.body,
			private: page.private,
			url: `/wiki/${page.topicSlug}/${page.slug}`
		},
		pages: await linkTargets(),
		user: wikiUser(user)
	};
};

export const actions = {
	default: async ({ locals, params, request, url }) => {
		const user = requireUser(locals, url);
		const page = await getPageRow(params.page, true);
		const result = await submitEdit(wikiUser(user), await request.formData(), { page });
		if ('url' in result) redirect(303, result.url);
		return result;
	}
};
