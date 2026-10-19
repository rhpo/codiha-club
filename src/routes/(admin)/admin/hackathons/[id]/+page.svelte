<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faCheck,
		faXmark,
		faTrophy,
		faTrash,
		faUpRightFromSquare,
		faRotateLeft
	} from '@fortawesome/free-solid-svg-icons';
	import HackathonForm from '$lib/components/HackathonForm.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { dateRange, formatDateTime, PLACE_LABEL } from '$lib/utils.js';

	export let data;
	export let form;

	$: h = data.hackathon;
	$: pending = data.applications.filter((a) => a.status === 'pending');

	let selected = new Set();
	const toggle = (id) => {
		selected.has(id) ? selected.delete(id) : selected.add(id);
		selected = new Set(selected);
	};

	const tone = { pending: 'warn', accepted: 'ok', rejected: 'bad', withdrawn: '' };
	$: winnerOf = (memberId) => data.winners.find((w) => w.member_id === memberId);
</script>

<svelte:head><title>{h.title} | CODIHA Admin</title></svelte:head>

<a class="tiny muted" href="/admin/hackathons">← All hackathons</a>

<div class="spread">
	<div class="page-head">
		<h1>{h.title}</h1>
		<p>{h.theme ? `${h.theme} · ` : ''}{dateRange(h.starts_at, h.ends_at)}</p>
	</div>
	<a class="btn ghost" href="/hackathons/{h.slug}" target="_blank" rel="noopener">
		<Fa icon={faUpRightFromSquare} /> Public page
	</a>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

<div class="stats">
	<div class="stat"><span class="value">{data.applications.length}</span><span class="label">Applications</span></div>
	<div class="stat"><span class="value">{pending.length}</span><span class="label">Pending</span></div>
	<div class="stat">
		<span class="value">{data.accepted.length}{#if h.capacity}<small>/{h.capacity}</small>{/if}</span>
		<span class="label">Accepted</span>
	</div>
	<div class="stat"><span class="value">{data.certificateCount}</span><span class="label">Certificates</span></div>
</div>

<!-- Winners -->
<div class="panel">
	<h3><Fa icon={faTrophy} /> Podium</h3>
	<p class="tiny muted">
		Selecting a winner awards the configured points and unlocks their winner certificate
		automatically.
	</p>

	{#if data.accepted.length}
		<form method="POST" action="?/setWinner" class="inline-form">
			<label class="field">
				<span>Participant</span>
				<select name="member_id" required>
					<option value="" disabled selected>Select an accepted participant…</option>
					{#each data.accepted as a (a.id)}
						<option value={a.member_id}>
							{a.profiles?.full_name}{a.team_name ? ` · ${a.team_name}` : ''}
						</option>
					{/each}
				</select>
			</label>
			<label class="field" style="flex:0 0 120px">
				<span>Place</span>
				<select name="place" required>
					<option value="1">1st</option>
					<option value="2">2nd</option>
					<option value="3">3rd</option>
				</select>
			</label>
			<label class="field" style="flex:0 0 160px">
				<span>Team name</span>
				<input name="team_name" placeholder="optional" />
			</label>
			<button class="btn sm" type="submit">Save winner</button>
		</form>
	{:else}
		<p class="tiny muted">Accept participants first, then you can pick the podium.</p>
	{/if}

	{#if data.winners.length}
		<ul class="plain" style="margin-top:0.9rem">
			{#each data.winners as w (w.member_id)}
				<li>
					<span class="pill accent">{PLACE_LABEL[w.place]}</span>
					<span class="grow">
						{data.applications.find((a) => a.member_id === w.member_id)?.profiles?.full_name ??
							w.member_id}
						{#if w.team_name}<span class="tiny muted"> · {w.team_name}</span>{/if}
					</span>
					<form method="POST" action="?/removeWinner">
						<input type="hidden" name="member_id" value={w.member_id} />
						<button class="btn sm ghost" type="submit" title="Remove winner">
							<Fa icon={faRotateLeft} />
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- Applications -->
<div class="panel">
	<div class="spread">
		<h3>Applications</h3>
		{#if pending.length}
			<form method="POST" action="?/bulkAcceptPending">
				<button class="btn sm ok" type="submit">
					<Fa icon={faCheck} /> Accept all {pending.length} pending
				</button>
			</form>
		{/if}
	</div>

	{#if selected.size}
		<div class="bulkbar">
			<span class="tiny">{selected.size} selected</span>
			<form method="POST" action="?/decide">
				{#each [...selected] as id}<input type="hidden" name="ids" value={id} />{/each}
				<input type="hidden" name="status" value="accepted" />
				<button class="btn sm ok" type="submit"><Fa icon={faCheck} /> Accept</button>
			</form>
			<form method="POST" action="?/decide">
				{#each [...selected] as id}<input type="hidden" name="ids" value={id} />{/each}
				<input type="hidden" name="status" value="rejected" />
				<button class="btn sm danger" type="submit"><Fa icon={faXmark} /> Reject</button>
			</form>
			<button class="btn sm ghost" type="button" on:click={() => (selected = new Set())}>Clear</button>
		</div>
	{/if}

	<div class="table-wrap">
		<table class="data">
			<thead>
				<tr>
					<th />
					<th>Applicant</th>
					<th>Team</th>
					<th>Motivation</th>
					<th>Status</th>
					<th>Applied</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.applications as a (a.id)}
					<tr>
						<td>
							<input
								type="checkbox"
								checked={selected.has(a.id)}
								on:change={() => toggle(a.id)}
								aria-label="Select application"
							/>
						</td>
						<td>
							<div class="who">
								<Avatar src={a.profiles?.avatar_url} name={a.profiles?.full_name} size={30} />
								<span class="who-col">
									<span class="name">
										{a.profiles?.full_name ?? '-'}
										{#if winnerOf(a.member_id)}
											<span class="pill accent tiny">{PLACE_LABEL[winnerOf(a.member_id).place]}</span>
										{/if}
									</span>
									<span class="sub">
										{[a.profiles?.university, a.profiles?.year].filter(Boolean).join(' · ')}
									</span>
								</span>
							</div>
						</td>
						<td class="tiny">
							{a.team_name ?? '-'}
							{#if a.teammates}<br /><span class="muted">{a.teammates}</span>{/if}
						</td>
						<td class="tiny motivation">
							{a.motivation ?? '-'}
							{#if a.skills}<br /><span class="muted">Skills: {a.skills}</span>{/if}
						</td>
						<td><span class="pill {tone[a.status]}">{a.status}</span></td>
						<td class="tiny muted">{formatDateTime(a.created_at)}</td>
						<td>
							<div class="row">
								{#if a.status !== 'accepted'}
									<form method="POST" action="?/decide">
										<input type="hidden" name="id" value={a.id} />
										<input type="hidden" name="status" value="accepted" />
										<button class="btn sm ok" type="submit" title="Accept"><Fa icon={faCheck} /></button>
									</form>
								{/if}
								{#if a.status !== 'rejected'}
									<form method="POST" action="?/decide">
										<input type="hidden" name="id" value={a.id} />
										<input type="hidden" name="status" value="rejected" />
										<button class="btn sm danger" type="submit" title="Reject"><Fa icon={faXmark} /></button>
									</form>
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					<tr><td colspan="7" class="center muted">No applications yet.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<div class="panel">
	<h3>Edit hackathon</h3>
	<HackathonForm hackathon={h} action="?/update" submitLabel="Save changes" />
</div>

<div class="panel danger-zone">
	<h3>Danger zone</h3>
	<p class="tiny muted">
		Deleting a hackathon removes its applications, winners, points entries and certificates.
	</p>
	<form
		method="POST"
		action="?/remove"
		on:submit={(ev) => {
			if (!confirm('Delete this hackathon and everything attached to it? This cannot be undone.'))
				ev.preventDefault();
		}}
	>
		<button class="btn sm danger" type="submit"><Fa icon={faTrash} /> Delete hackathon</button>
	</form>
</div>

<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}
	.who-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	table.data {
		min-width: 1000px;
	}
	.motivation {
		max-width: 320px;
		white-space: normal;
		line-height: 1.45;
	}
	td form,
	.bulkbar form {
		margin: 0;
	}
	.bulkbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0.6rem 0.75rem;
		margin-bottom: 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--accent-soft);
		border: 1px solid var(--accent-line);
	}
	ul.plain {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	ul.plain li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
	}
	.grow {
		flex: 1;
	}
	input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
	}
	.danger-zone {
		border-color: rgba(248, 113, 113, 0.4);
	}
	.stat small {
		font-size: 0.5em;
		opacity: 0.6;
	}
</style>
