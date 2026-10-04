import { error, redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/access';
import { diffView, getSuggestion, getTree, resolver, reviewSuggestion } from '$lib/server/wiki';
import { render } from '$lib/wiki/markdown';

const requireAdmin = (locals: App.Locals) => {
	if (!locals.user) redirect(302, '/login');
	if (!isAdmin(locals.user.email)) error(403, 'Admins only');
};

export const load = async ({ locals, params }) => {
	requireAdmin(locals);
	const {
		suggestion: s,
		page,
		base,
		baseTitle,
		current,
		stale
	} = await getSuggestion(Number(params.id));
	return {
		suggestion: {
			id: s.id,
			title: s.title,
			authorName: s.authorName,
			authorEmail: s.authorEmail,
			status: s.status,
			createdAt: s.createdAt,
			topicId: s.topicId
		},
		page: page && { title: page.title, slug: page.slug },
		titleChanged: !!page && s.title !== baseTitle,
		stale,
		parts: page ? await diffView(base, s.body, current) : [],
		html: page ? '' : render(s.body, { loggedIn: true, resolve: await resolver() }),
		topics: (await getTree(true)).map((t) => ({ id: t.id, title: t.title }))
	};
};

export const actions = {
	default: async ({ locals, params, request }) => {
		requireAdmin(locals);
		const result = await reviewSuggestion(Number(params.id), await request.formData());
		if ('url' in result) redirect(303, result.url);
		return result;
	}
};
