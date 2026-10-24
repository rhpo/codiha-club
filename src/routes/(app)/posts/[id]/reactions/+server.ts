import { error, json } from '@sveltejs/kit';
import { requireMember } from '$lib/server/guards';
import type { RequestHandler } from './$types';

/**
 * Who reacted to one post.
 *
 * Fetched when somebody asks for it rather than loaded with the feed: a page
 * of posts would otherwise carry every reactor of every post just in case one
 * of them is clicked.
 */
export const GET: RequestHandler = async (event) => {
	await requireMember(event);

	const { data, error: rpcError } = await event.locals.supabase.rpc('post_reactors', {
		p_post: event.params.id
	});
	if (rpcError) throw error(400, rpcError.message);

	return json({ reactors: data ?? [] });
};
