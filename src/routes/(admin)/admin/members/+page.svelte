<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import Coin from '$lib/components/Coin.svelte';
	import { faCheck, faXmark, faUserShield } from '@fortawesome/free-solid-svg-icons';
	import Avatar from '$lib/components/Avatar.svelte';
	import { formatDate } from '$lib/utils.js';
	import { ROLE_LABELS, canAssignTo } from '$lib/roles.js';

	export let data;
	export let form;

	let selected = new Set();
	let openRow = null;

	const toggle = (id) => {
		selected.has(id) ? selected.delete(id) : selected.add(id);
		selected = new Set(selected);
	};

	$: pendingIds = data.members.filter((m) => m.status === 'pending').map((m) => m.id);
	const statusTone = { pending: 'warn', approved: 'ok', rejected: 'bad' };
</script>

<svelte:head><title>Members | CODIHA Admin</title></svelte:head>

<div class="page-head">
	<h1>Members</h1>
	<p>{data.tally.all} accounts · {data.tally.pending ?? 0} pending · {data.tally.approved ?? 0} approved</p>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

<form class="toolbar" method="GET">
	<input type="search" name="q" value={data.filter.q} placeholder="Search name, email, university…" />
	<select name="status">
		{#each ['all', 'pending', 'approved', 'rejected'] as s}
			<option value={s} selected={data.filter.status === s}>
				{s} {s !== 'all' ? `(${data.tally[s] ?? 0})` : `(${data.tally.all})`}
			</option>
		{/each}
	</select>
	<button class="btn sm" type="submit">Filter</button>
	<a class="btn sm ghost" href="/admin/members">Reset</a>
</form>

{#if pendingIds.length}
	<form method="POST" action="?/bulkApprove" class="panel bulk">
		<div class="row">
			<button
				class="btn sm ghost"
				type="button"
				on:click={() => (selected = new Set(selected.size === pendingIds.length ? [] : pendingIds))}
			>
				{selected.size === pendingIds.length ? 'Clear selection' : `Select all pending (${pendingIds.length})`}
			</button>
			<span class="tiny muted">{selected.size} selected</span>
		</div>
		{#each [...selected] as id}
			<input type="hidden" name="ids" value={id} />
		{/each}
		<button class="btn sm ok" type="submit" disabled={!selected.size}>
			<Fa icon={faCheck} /> Approve selected
		</button>
	</form>
{/if}

<div class="table-wrap">
	<table class="data">
		<thead>
			<tr>
				<th />
				<th>Member</th>
				<th>University</th>
				<th>Year</th>
				<th class="num">This year</th>
				<th>Status</th>
				<th>Joined</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each data.members as m (m.id)}
				<tr>
					<td>
						{#if m.status === 'pending'}
							<input
								type="checkbox"
								checked={selected.has(m.id)}
								on:change={() => toggle(m.id)}
								aria-label="Select {m.full_name}"
							/>
						{/if}
					</td>
					<td>
						<div class="who">
							<Avatar src={m.avatar_url} name={m.full_name} size={32} />
							<span class="who-col">
								<span class="name">
									{m.full_name || '-'}
									{#if m.role !== 'member'}<span class="pill accent tiny">{ROLE_LABELS[m.role]}</span>{/if}
								</span>
								<span class="sub">{m.email ?? '-'}</span>
							</span>
						</div>
					</td>
					<td class="tiny">{m.university ?? '-'}<br /><span class="muted">{m.field ?? ''}</span></td>
					<td class="tiny">{m.year ?? '-'}</td>
					<td class="num"><strong>{data.pointsBy[m.id]?.semester ?? 0}</strong></td>
					<td><span class="pill {statusTone[m.status]}">{m.status}</span></td>
					<td class="tiny muted">{formatDate(m.created_at)}</td>
					<td>
						<div class="row">
							{#if m.status !== 'approved'}
								<form method="POST" action="?/approve">
									<input type="hidden" name="id" value={m.id} />
									<button class="btn sm ok" type="submit" title="Approve"><Fa icon={faCheck} /></button>
								</form>
							{/if}
							<button
								class="btn sm ghost"
								type="button"
								on:click={() => (openRow = openRow === m.id ? null : m.id)}
							>
								⋯
							</button>
						</div>
					</td>
				</tr>

				{#if openRow === m.id}
					<tr class="expand">
						<td colspan="8">
							<div class="panels">
								<form method="POST" action="?/points" class="inline-form">
									<input type="hidden" name="id" value={m.id} />
									<label class="field" style="flex:0 0 110px">
										<span><Coin /> Coins</span>
										<input type="number" name="amount" placeholder="e.g. 20 or -10" required />
									</label>
									<label class="field">
										<span>Reason (required)</span>
										<input name="reason" placeholder="Ran the Git workshop" required minlength="3" />
									</label>
									<button class="btn sm" type="submit">Add to ledger</button>
								</form>

								{#if m.status !== 'rejected'}
									<form method="POST" action="?/reject" class="inline-form">
										<input type="hidden" name="id" value={m.id} />
										<label class="field">
											<span><Fa icon={faXmark} /> Reject reason (required)</span>
											<input name="reason" placeholder="Not a student at a partner university" required />
										</label>
										<button class="btn sm danger" type="submit">Reject member</button>
									</form>
								{/if}

								{#if data.assignable?.length && canAssignTo(data.actorRole, m.role) && m.id !== data.actorId}
									<form method="POST" action="?/setRole" class="inline-form">
										<input type="hidden" name="id" value={m.id} />
										<label class="field" style="flex:0 0 180px">
											<span><Fa icon={faUserShield} /> Role</span>
											<select name="role">
												<option value="member" selected={m.role === 'member'}>
													{ROLE_LABELS.member}
												</option>
												{#each data.assignable as r}
													{#if r !== 'member'}
														<option value={r} selected={m.role === r}>{ROLE_LABELS[r]}</option>
													{/if}
												{/each}
											</select>
										</label>
										<button class="btn sm ghost" type="submit">Save role</button>
									</form>
								{/if}

								<div class="meta tiny muted">
									{#if m.discord}<span>Discord: {m.discord}</span>{/if}
									{#if m.phone}<span>Phone: {m.phone}</span>{/if}
									{#if m.github}<span>GitHub: {m.github}</span>{/if}
									{#if m.linkedin}<span>LinkedIn: {m.linkedin}</span>{/if}
									<span>All-time points: {data.pointsBy[m.id]?.total ?? 0}</span>
									{#if m.reject_reason}<span>Rejected: {m.reject_reason}</span>{/if}
									{#if m.bio}<span>Bio: {m.bio}</span>{/if}
								</div>
							</div>
						</td>
					</tr>
				{/if}
			{:else}
				<tr><td colspan="8" class="center muted">No members match this filter.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.who-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	table.data {
		min-width: 900px;
	}
	.expand td {
		background: rgba(0, 0, 0, 0.25);
	}
	.panels {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}
	.panels form {
		margin: 0;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
	}
	input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
	}
	td form {
		margin: 0;
	}
</style>
