import { error, fail } from '@sveltejs/kit';
import { requireMember } from '$lib/server/guards';
import { needsFacePhoto } from '$lib/roles.js';
import { notifyPostComment } from '$lib/server/notify';
import { loadTheme } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async (event) => {
	const profile = await requireMember(event);
	if (!UUID.test(event.params.id)) throw error(404, 'Post not found');
	const sb = event.locals.supabase;

	const { data: post } = await sb
		.from('post_feed')
		.select('*')
		.eq('id', event.params.id)
		.maybeSingle();
	if (!post) throw error(404, 'Post not found');

	const [{ data: images }, { data: comments }, { data: mine }] = await Promise.all([
		sb.from('post_images').select('url').eq('post_id', post.id).order('position'),
		sb
			.from('post_comments')
			.select('id,parent_id,body,created_at,author_id,profiles:author_id(full_name,avatar_url)')
			.eq('post_id', post.id)
			.order('created_at'),
		sb
			.from('post_likes')
			.select('post_id')
			.eq('post_id', post.id)
			.eq('member_id', profile.id)
			.maybeSingle()
	]);

	// One indent, never two: the database flattens a reply-to-a-reply onto its
	// top-level ancestor, so grouping by parent_id is the whole tree.
	const roots = (comments ?? []).filter((c: { parent_id: string | null }) => !c.parent_id);
	const repliesBy = new Map<string, unknown[]>();
	for (const c of comments ?? []) {
		if (!c.parent_id) continue;
		const list = repliesBy.get(c.parent_id) ?? [];
		list.push(c);
		repliesBy.set(c.parent_id, list);
	}

	return {
		post: {
			...post,
			images: (images ?? []).map((i: { url: string }) => i.url),
			likedByMe: !!mine
		},
		comments: roots.map((c: { id: string }) => ({ ...c, replies: repliesBy.get(c.id) ?? [] })),
		canComment: !needsFacePhoto(profile),
		me: profile.id
	};
};

export const actions: Actions = {
	comment: async (event) => {
		const profile = await requireMember(event);
		if (needsFacePhoto(profile)) {
			return fail(403, { error: 'Add a verified photo of yourself before commenting.' });
		}

		const form = await event.request.formData();
		const body = String(form.get('body') ?? '').trim();
		const parentRaw = String(form.get('parent_id') ?? '').trim();
		const parent_id = UUID.test(parentRaw) ? parentRaw : null;

		if (!body) return fail(400, { error: 'Write something first.' });
		if (body.length > 2000) return fail(400, { error: 'That comment is too long.' });

		const { error: insertError } = await event.locals.supabase
			.from('post_comments')
			.insert({ post_id: event.params.id, author_id: profile.id, parent_id, body });
		if (insertError) return fail(400, { error: insertError.message });

		// Tell the post's author, unless they are the one commenting.
		const { data: post } = await event.locals.supabase
			.from('posts')
			.select('author_id,profiles:author_id(email,full_name)')
			.eq('id', event.params.id)
			.maybeSingle();

		// PostgREST hands an embedded row back as an object or a one-element
		// array depending on how it reads the relationship, so accept both.
		type Owner = { email: string | null; full_name: string | null };
		const embedded = post?.profiles as unknown;
		const owner: Owner | null = Array.isArray(embedded)
			? ((embedded[0] as Owner) ?? null)
			: ((embedded as Owner) ?? null);
		if (post && owner && post.author_id !== profile.id) {
			await notifyPostComment(owner, profile, body, event.params.id, {
				origin: event.url.origin,
				theme: await loadTheme(event.locals.supabase)
			});
		}

		return { success: 'Comment added.' };
	},

	removeComment: async (event) => {
		await requireMember(event);
		const form = await event.request.formData();
		const id = String(form.get('comment_id') ?? '');
		if (!id) return fail(400, { error: 'Missing comment' });

		// RLS decides: the comment's author, the post's author, or an admin.
		const { error: delError } = await event.locals.supabase
			.from('post_comments')
			.delete()
			.eq('id', id);
		if (delError) return fail(400, { error: delError.message });
		return { success: 'Comment deleted.' };
	},

	like: async (event) => {
		const profile = await requireMember(event);
		const sb = event.locals.supabase;

		const { data: existing } = await sb
			.from('post_likes')
			.select('post_id')
			.eq('post_id', event.params.id)
			.eq('member_id', profile.id)
			.maybeSingle();

		if (existing) {
			await sb
				.from('post_likes')
				.delete()
				.eq('post_id', event.params.id)
				.eq('member_id', profile.id);
			return { liked: false };
		}

		const { error: likeError } = await sb
			.from('post_likes')
			.insert({ post_id: event.params.id, member_id: profile.id });
		if (likeError) return fail(400, { error: likeError.message });
		return { liked: true };
	}
};
