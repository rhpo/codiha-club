import { fail } from '@sveltejs/kit';
import { requireStaff } from '$lib/server/guards';
import { uploadGalleryFiles } from '$lib/server/upload';
import { groupGallery } from '$lib/gallery.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireStaff(event);

	const { data } = await event.locals.supabase
		.from('gallery_items')
		.select('id,url,caption,section,position,kind,created_at')
		.order('position');

	const items = data ?? [];
	return {
		sections: groupGallery(items),
		// Offered as suggestions in the upload form, so a photo lands in an
		// existing section instead of creating "Our members " with a space.
		knownSections: [...new Set(items.map((i) => i.section).filter(Boolean))].sort()
	};
};

export const actions: Actions = {
	upload: async (event) => {
		const staff = await requireStaff(event);
		const form = await event.request.formData();
		const section = String(form.get('section') ?? '').trim();
		const caption = String(form.get('caption') ?? '').trim() || null;
		const files = form.getAll('files');

		if (!files.some((f) => f instanceof File && f.size > 0)) {
			return fail(400, { error: 'Pick at least one photo.' });
		}

		let uploaded: { url: string; kind: 'image' | 'video' }[];
		try {
			uploaded = await uploadGalleryFiles(files);
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Upload failed.' });
		}

		// New photos go to the end of their section rather than the top, so an
		// upload never reshuffles what is already arranged.
		const { data: last } = await event.locals.supabase
			.from('gallery_items')
			.select('position')
			.eq('section', section)
			.order('position', { ascending: false })
			.limit(1)
			.maybeSingle();

		const start = (last?.position ?? -1) + 1;

		const { error } = await event.locals.supabase.from('gallery_items').insert(
			uploaded.map((u, i) => ({
				url: u.url,
				kind: u.kind,
				caption,
				section,
				position: start + i,
				uploaded_by: staff.id
			}))
		);
		if (error) return fail(400, { error: error.message });

		return { success: `${uploaded.length} added to the gallery.` };
	},

	update: async (event) => {
		await requireStaff(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing item' });

		const { error } = await event.locals.supabase
			.from('gallery_items')
			.update({
				caption: String(form.get('caption') ?? '').trim() || null,
				section: String(form.get('section') ?? '').trim()
			})
			.eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: 'Saved.' };
	},

	/**
	 * Moves one photo up or down by swapping positions with its neighbour.
	 *
	 * Swapping two rows keeps every other position untouched, so two people
	 * tidying different sections cannot renumber each other's work.
	 */
	move: async (event) => {
		await requireStaff(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const dir = String(form.get('dir') ?? '');
		if (!id || !['up', 'down'].includes(dir)) return fail(400, { error: 'Bad request' });

		const sb = event.locals.supabase;
		const { data: item } = await sb
			.from('gallery_items')
			.select('id,section,position')
			.eq('id', id)
			.maybeSingle();
		if (!item) return fail(404, { error: 'Item not found' });

		const { data: neighbour } = await sb
			.from('gallery_items')
			.select('id,position')
			.eq('section', item.section)
			[dir === 'up' ? 'lt' : 'gt']('position', item.position)
			.order('position', { ascending: dir !== 'up' })
			.limit(1)
			.maybeSingle();

		// Already at the end of its section: nothing to swap with.
		if (!neighbour) return { success: 'Already there.' };

		await sb.from('gallery_items').update({ position: neighbour.position }).eq('id', item.id);
		await sb.from('gallery_items').update({ position: item.position }).eq('id', neighbour.id);
		return { success: 'Moved.' };
	},

	remove: async (event) => {
		await requireStaff(event);
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing item' });

		// The row goes; the file stays in the bucket. Storage is cheap and an
		// accidental delete is recoverable by re-adding the same URL.
		const { error } = await event.locals.supabase.from('gallery_items').delete().eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: 'Removed from the gallery.' };
	}
};
