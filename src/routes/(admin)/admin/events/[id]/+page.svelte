<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faQrcode,
		faTrash,
		faUserCheck,
		faRotateLeft,
		faPaperPlane,
		faUpRightFromSquare
	} from '@fortawesome/free-solid-svg-icons';
	import EventForm from '$lib/components/EventForm.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { dateRange, formatDateTime } from '$lib/utils.js';

	export let data;
	export let form;

	$: e = data.event;
	$: notCheckedIn = data.members.filter(
		(m) => !data.attendance.some((a) => a.member_id === m.id)
	);
</script>

<svelte:head><title>{e.title} | CODIHA Admin</title></svelte:head>

<a class="tiny muted" href="/admin/events">← All events</a>

<div class="spread">
	<div class="page-head">
		<h1>{e.title}</h1>
		<p>{dateRange(e.starts_at, e.ends_at)}{e.location ? ` · ${e.location}` : ''}</p>
	</div>
	<div class="btn-row">
		<a class="btn" href="/admin/events/{e.id}/present" target="_blank" rel="noopener">
			<Fa icon={faQrcode} /> Presentation mode
		</a>
		<a class="btn ghost" href="/events/{e.slug}" target="_blank" rel="noopener">
			<Fa icon={faUpRightFromSquare} /> Public page
		</a>
	</div>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

<div class="stats">
	<div class="stat"><span class="value">{data.registrations.length}</span><span class="label">Registered</span></div>
	<div class="stat"><span class="value">{data.attendance.length}</span><span class="label">Checked in</span></div>
	<div class="stat">
		<span class="value">
			{data.registrations.length
				? Math.round((data.attendance.length / data.registrations.length) * 100)
				: 0}%
		</span>
		<span class="label">Show-up rate</span>
	</div>
	<div class="stat"><span class="value">{e.checkin_points}</span><span class="label">Points each</span></div>
</div>

<div class="panel">
	<h3>Attendance</h3>

	<form method="POST" action="?/checkIn" class="inline-form">
		<label class="field">
			<span><Fa icon={faUserCheck} /> Manual check-in</span>
			<select name="member_id" required>
				<option value="" disabled selected>Select a member…</option>
				{#each notCheckedIn as m (m.id)}
					<option value={m.id}>{m.full_name} {m.university ? `· ${m.university}` : ''}</option>
				{/each}
			</select>
		</label>
		<button class="btn sm" type="submit">Check in</button>
	</form>

	<div class="table-wrap" style="margin-top: 0.75rem">
		<table class="data">
			<thead>
				<tr><th>Member</th><th>Registered</th><th>Checked in</th><th>Actions</th></tr>
			</thead>
			<tbody>
				{#each data.registrations as r (r.id)}
					<tr>
						<td>
							<div class="who">
								<Avatar src={r.profiles?.avatar_url} name={r.profiles?.full_name} size={30} />
								<span class="who-col">
									<span class="name">{r.profiles?.full_name ?? '-'}</span>
									<span class="sub">{r.profiles?.email ?? ''}</span>
								</span>
							</div>
						</td>
						<td class="tiny muted">
							{formatDateTime(r.created_at)}
							{#if r.status === 'waitlist'}<span class="pill warn">waitlist</span>{/if}
						</td>
						<td>
							{#if r.checked_in_at}
								<span class="pill ok">{formatDateTime(r.checked_in_at)}</span>
							{:else}
								<span class="pill">-</span>
							{/if}
						</td>
						<td>
							{#if r.checked_in_at}
								<form method="POST" action="?/undoCheckIn">
									<input type="hidden" name="member_id" value={r.member_id} />
									<button class="btn sm ghost" type="submit" title="Undo check-in">
										<Fa icon={faRotateLeft} />
									</button>
								</form>
							{:else}
								<form method="POST" action="?/checkIn">
									<input type="hidden" name="member_id" value={r.member_id} />
									<button class="btn sm ok" type="submit" title="Check in">
										<Fa icon={faUserCheck} />
									</button>
								</form>
							{/if}
						</td>
					</tr>
				{:else}
					<tr><td colspan="4" class="center muted">Nobody registered yet.</td></tr>
				{/each}

				{#each data.attendance.filter((a) => !data.registrations.some((r) => r.member_id === a.member_id)) as a (a.member_id)}
					<tr>
						<td>
							<div class="who">
								<Avatar src={a.profiles?.avatar_url} name={a.profiles?.full_name} size={30} />
								<span class="who-col">
									<span class="name">{a.profiles?.full_name ?? '-'}</span>
									<span class="sub">walk-in</span>
								</span>
							</div>
						</td>
						<td class="tiny muted">-</td>
						<td><span class="pill ok">{formatDateTime(a.checked_in_at)}</span></td>
						<td>
							<form method="POST" action="?/undoCheckIn">
								<input type="hidden" name="member_id" value={a.member_id} />
								<button class="btn sm ghost" type="submit"><Fa icon={faRotateLeft} /></button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<div class="panel">
	<h3><Fa icon={faPaperPlane} /> Email the registrants</h3>
	<form method="POST" action="?/notify" class="form">
		<label class="field">
			<span>Message</span>
			<textarea
				name="message"
				required
				placeholder="Reminder: we start at 14:00 sharp in Amphi B. Bring your laptop!"
			/>
		</label>
		<button class="btn sm" type="submit">Send to {data.registrations.length} registrant(s)</button>
	</form>
</div>

<div class="panel">
	<h3>Edit event</h3>
	<EventForm event={e} action="?/update" submitLabel="Save changes" />
</div>

<div class="panel danger-zone">
	<h3>Danger zone</h3>
	<p class="tiny muted">
		Deleting an event also removes its registrations, attendance, points entries and certificates.
	</p>
	<form method="POST" action="?/remove" on:submit={(ev) => { if (!confirm('Delete this event, its attendance, points and certificates? This cannot be undone.')) ev.preventDefault(); }}>
		<button class="btn sm danger" type="submit"><Fa icon={faTrash} /> Delete event</button>
	</form>
</div>

<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}
	.who-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	td form {
		margin: 0;
	}
	table.data {
		min-width: 700px;
	}
	.danger-zone {
		border-color: rgba(248, 113, 113, 0.4);
	}
	.danger-zone p {
		margin: 0 0 0.75rem;
	}
</style>
