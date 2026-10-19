import { error, fail, redirect } from '@sveltejs/kit';
import { requireContentManager } from '$lib/server/guards';
import { localToUtcIso, tzOffsetFrom } from '$lib/server/datetime';
import { uploadCover } from '$lib/server/upload';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { sendMail, wrapHtml } from '$lib/server/brevo';
import { loadTheme } from '$lib/server/settings';
import { dateRange } from '$lib/utils.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireContentManager(event);
	const sb = event.locals.supabase;

	const { data: clubEvent } = await sb
		.from('events')
		.select('*')
		.eq('id', event.params.id)
		.maybeSingle();
	if (!clubEvent) throw error(404, 'Event not found');

	const [regs, atts, allMembers] = await Promise.all([
		sb
			.from('event_registrations')
			.select('id,status,created_at,member_id,profiles:member_id(full_name,email,avatar_url,university,year)')
			.eq('event_id', clubEvent.id)
			.order('created_at', { ascending: true }),
		sb
			.from('event_attendance')
			.select('member_id,checked_in_at,profiles:member_id(full_name,avatar_url,university)')
			.eq('event_id', clubEvent.id)
			.order('checked_in_at', { ascending: true }),
		sb
			.from('profiles')
			.select('id,full_name,university')
			.eq('status', 'approved')
			.order('full_name', { ascending: true })
	]);

	const attendanceBy = new Map(
		(atts.data ?? []).map((a: any) => [a.member_id, a.checked_in_at as string])
	);

	return {
		event: clubEvent,
		registrations: (regs.data ?? []).map((r: any) => ({
			...r,
			checked_in_at: attendanceBy.get(r.member_id) ?? null
		})),
		attendance: atts.data ?? [],
		members: allMembers.data ?? []
	};
};

export const actions: Actions = {
	update: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const tz = tzOffsetFrom(form);
		const str = (k: string) => String(form.get(k) ?? '').trim();

		const starts_at = localToUtcIso(form.get('starts_at'), tz);
		const ends_at = localToUtcIso(form.get('ends_at'), tz);
		if (!starts_at || !ends_at) return fail(400, { error: 'Start and end dates are required.' });
		if (new Date(ends_at) <= new Date(starts_at)) {
			return fail(400, { error: 'The end date must be after the start date.' });
		}

		const patch: Record<string, unknown> = {
			title: str('title'),
			slug: str('slug'),
			summary: str('summary') || null,
			description: str('description') || null,
			location: str('location') || null,
			capacity: str('capacity') ? Number(str('capacity')) : null,
			checkin_points: Number(str('checkin_points') || 10),
			status: str('status'),
			starts_at,
			ends_at
		};

		if (form.get('remove_cover') === '1') patch.cover_url = null;
		try {
			const uploaded = await uploadCover(form.get('cover'), 'events');
			if (uploaded) patch.cover_url = uploaded;
		} catch (e) {
			return fail(400, { error: e instanceof Error ? e.message : 'Cover upload failed' });
		}

		const { error: updateError } = await event.locals.supabase
			.from('events')
			.update(patch)
			.eq('id', event.params.id);

		if (updateError) return fail(400, { error: updateError.message });
		return { success: 'Event saved.' };
	},

	remove: async (event) => {
		await requireContentManager(event);
		const { error: deleteError } = await event.locals.supabase
			.from('events')
			.delete()
			.eq('id', event.params.id);
		if (deleteError) return fail(400, { error: deleteError.message });
		throw redirect(303, '/admin/events');
	},

	checkIn: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const memberId = String(form.get('member_id') ?? '');
		if (!memberId) return fail(400, { error: 'Pick a member first.' });

		// service role: the attendance table is write-locked for everyone else,
		// and the insert trigger awards the points + certificate.
		const { error: insertError } = await supabaseAdmin()
			.from('event_attendance')
			.insert({ event_id: event.params.id, member_id: memberId });

		if (insertError) {
			return fail(400, {
				error:
					insertError.code === '23505'
						? 'That member is already checked in.'
						: insertError.message
			});
		}
		return { success: 'Checked in manually.' };
	},

	undoCheckIn: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const memberId = String(form.get('member_id') ?? '');
		const admin = supabaseAdmin();

		const { error: deleteError } = await admin
			.from('event_attendance')
			.delete()
			.eq('event_id', event.params.id)
			.eq('member_id', memberId);
		if (deleteError) return fail(400, { error: deleteError.message });

		// pull back the points and the auto-issued certificate
		await admin
			.from('points_ledger')
			.delete()
			.eq('member_id', memberId)
			.eq('source', 'event_checkin')
			.eq('source_id', event.params.id);
		await admin
			.from('certificates')
			.delete()
			.eq('member_id', memberId)
			.eq('event_id', event.params.id)
			.eq('kind', 'participation');

		return { success: 'Check-in reverted (points and certificate removed).' };
	},

	notify: async (event) => {
		await requireContentManager(event);
		const form = await event.request.formData();
		const message = String(form.get('message') ?? '').trim();
		if (message.length < 5) return fail(400, { error: 'Write a message first.' });

		const sb = event.locals.supabase;
		const { data: clubEvent } = await sb
			.from('events')
			.select('title,slug,starts_at,ends_at,location')
			.eq('id', event.params.id)
			.maybeSingle();
		if (!clubEvent) return fail(404, { error: 'Event not found' });

		const { data: regs } = await sb
			.from('event_registrations')
			.select('profiles:member_id(full_name,email)')
			.eq('event_id', event.params.id)
			.neq('status', 'cancelled');

		const recipients = (regs ?? [])
			.map((r: any) => r.profiles)
			.filter((p: any) => p?.email)
			.map((p: any) => ({ email: p.email, name: p.full_name }));

		if (!recipients.length) return fail(400, { error: 'Nobody is registered yet.' });

		const theme = await loadTheme(sb);
		const result = await sendMail({
			recipients,
			subject: `${clubEvent.title}: update from CODIHA Club`,
			html: wrapHtml(
				`<p><strong>${clubEvent.title}</strong><br/>
				 ${dateRange(clubEvent.starts_at, clubEvent.ends_at)}${
						clubEvent.location ? ` · ${clubEvent.location}` : ''
					}</p>
				 <p>${message.replace(/\n/g, '<br/>')}</p>
				 <p><a href="${event.url.origin}/events/${clubEvent.slug}" style="color:${theme.accent};">Event page →</a></p>`,
				event.url.origin,
				theme
			)
		});

		if (result.error && !result.sent) return fail(400, { error: result.error });
		return { success: `Email sent to ${result.sent} registrant(s).` };
	}
};
