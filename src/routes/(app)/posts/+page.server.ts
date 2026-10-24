import { fail } from '@sveltejs/kit';
import { requireMember } from '$lib/server/guards';
import { POST_IMAGE_LIMIT, uploadPostImages } from '$lib/server/upload';
import { atLeast, needsFacePhoto } from '$lib/roles.js';
import { REACTION_KEYS, tallyReactions } from '$lib/reactions.js';
import type { Actions, PageServerLoad } from './$types';

/** Feed page size. Older posts load by bumping ?take=. */
const PAGE = 20;

export const load: PageServerLoad = async (event) => {
	const profile = await requireMember(event);
	const sb = event.locals.supabase;

	const take = Math.min(100, Number(event.url.searchParams.get('take') ?? PAGE) || PAGE);

	const { data: posts } = await sb
		.from('post_feed')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(take);

	const ids = (posts ?? []).map((p: { id: string }) => p.id);

	// Images and "did I like this" are fetched for the whole page in two
	// queries rather than two per post.
	const [{ data: images }, { data: mine }] = await Promise.all([
		ids.length
			? sb.from('post_images').select('post_id,url,position').in('post_id', ids).order('position')
			: Promise.resolve({ data: [] as { post_id: string; url: string; position: number }[] }),
		ids.length
			? sb
					.from('post_reactions')
					.select('post_id,emoji')
					.eq('member_id', profile.id)
					.in('post_id', ids)
			: Promise.resolve({ data: [] as { post_id: string; emoji: string }[] })
	]);

	// One grouped query for the whole page rather than a count per post.
	const { data: tallies } = ids.length
		? await sb.rpc('post_reaction_counts', { p_posts: ids })
		: { data: [] };
	const reactionsBy = tallyReactions(tallies ?? []);

	const imagesBy = new Map<string, string[]>();
	for (const img of images ?? []) {
		const list = imagesBy.get(img.post_id) ?? [];
		list.push(img.url);
		imagesBy.set(img.post_id, list);
	}
	// What this member picked, so their own choice can be highlighted.
	const myReaction = new Map(
		(mine ?? []).map((r: { post_id: string; emoji: string }) => [r.post_id, r.emoji])
	);

	return {
		posts: (posts ?? []).map((p: Record<string, unknown>) => ({
			...p,
			images: imagesBy.get(p.id as string) ?? [],
			reactions: reactionsBy.get(p.id as string) ?? [],
			myReaction: myReaction.get(p.id as string) ?? null
		})),
		// Posting needs a verified face photo, so the form explains itself
		// rather than failing on submit.
		canPost: !needsFacePhoto(profile),
		me: profile.id,
		isAdmin: atLeast(profile.role, 'admin'),
		imageLimit: POST_IMAGE_LIMIT,
		take
	};
};

export const actions: Actions = {
	create: async (event) => {
		const profile = await requireMember(event);
		if (needsFacePhoto(profile)) {
			return fail(403, { error: 'Add a verified photo of yourself before posting.' });
		}

		const form = await event.request.formData();
		const body = String(form.get('body') ?? '').trim();
		if (body.length < 1) return fail(400, { error: 'Write something first.' });
		if (body.length > 4000) return fail(400, { error: 'That post is too long (4000 characters max).' });

		const files = form.getAll('images');
		if (files.filter((f) => f instanceof File && f.size > 0).length > POST_IMAGE_LIMIT) {
			return fail(400, { error: `A post can have at most ${POST_IMAGE_LIMIT} images.` });
		}

		const { data: post, error } = await event.locals.supabase
			.from('posts')
			.insert({ author_id: profile.id, body })
			.select('id')
			.single();

		if (error) return fail(400, { error: error.message });

		// Images go up after the row exists, so a failed upload leaves a post
		// with no pictures rather than orphaned files with no post.
		try {
			const urls = await uploadPostImages(files, post.id);
			if (urls.length) {
				await event.locals.supabase
					.from('post_images')
					.insert(urls.map((url, position) => ({ post_id: post.id, url, position })));
			}
		} catch (e) {
			return fail(400, {
				error: e instanceof Error ? e.message : 'The images could not be uploaded.'
			});
		}

		return { success: 'Posted.' };
	},

	react: async (event) => {
		const profile = await requireMember(event);
		const form = await event.request.formData();
		const postId = String(form.get('post_id') ?? '');
		const emoji = String(form.get('emoji') ?? '');
		if (!postId) return fail(400, { error: 'Missing post' });
		if (!REACTION_KEYS.includes(emoji)) return fail(400, { error: 'Unknown reaction' });

		const sb = event.locals.supabase;
		const { data: existing } = await sb
			.from('post_reactions')
			.select('emoji')
			.eq('post_id', postId)
			.eq('member_id', profile.id)
			.maybeSingle();

		// Picking the one you already chose takes it back; picking a
		// different one changes your mind rather than adding a second.
		if (existing?.emoji === emoji) {
			await sb
				.from('post_reactions')
				.delete()
				.eq('post_id', postId)
				.eq('member_id', profile.id);
			return { reaction: null };
		}

		const { error } = await sb
			.from('post_reactions')
			.upsert(
				{ post_id: postId, member_id: profile.id, emoji },
				{ onConflict: 'post_id,member_id' }
			);
		if (error) return fail(400, { error: error.message });
		return { reaction: emoji };
	},

	remove: async (event) => {
		await requireMember(event);
		const form = await event.request.formData();
		const postId = String(form.get('post_id') ?? '');
		if (!postId) return fail(400, { error: 'Missing post' });

		// RLS decides whether this is allowed: the author or an admin.
		const { error } = await event.locals.supabase.from('posts').delete().eq('id', postId);
		if (error) return fail(400, { error: error.message });
		return { success: 'Post deleted.' };
	}
};
