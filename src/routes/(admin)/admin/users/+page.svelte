<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faUserShield, faUserPlus, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
	import Avatar from '$lib/components/Avatar.svelte';
	import { ROLE_LABELS, ROLE_DESCRIPTIONS, DOCUMENTED_ROLES, canAssignTo } from '$lib/roles.js';
	import { formatDate } from '$lib/utils.js';

	export let data;

	// Only roles this admin can hand out get a tab, so Developer never shows up
	// for anyone who is not one.
	$: TABS = [
		{ key: 'staff+', label: 'With a role' },
		...data.assignable
			.filter((r) => r !== 'member')
			.map((r) => ({ key: r, label: ROLE_LABELS[r] })),
		{ key: 'all', label: 'Everyone' }
	];

	$: countFor = (key) =>
		key === 'all'
			? data.tally.all
			: key === 'staff+'
				? data.tally.all - (data.tally.member ?? 0)
				: (data.tally[key] ?? 0);

	const href = (role) => {
		const p = new URLSearchParams();
		if (role !== 'staff+') p.set('role', role);
		if (data.filter.q) p.set('q', data.filter.q);
		const s = p.toString();
		return s ? `?${s}` : '?';
	};
</script>

<svelte:head><title>Users | CODIHA Admin</title></svelte:head>

<div class="head">
	<h1><Fa icon={faUserShield} /> Users &amp; roles</h1>
	<p class="tiny muted">
		Roles are a ladder: each one can do everything below it. You can only hand out a role at or
		below your own, so nobody can promote themselves past you.
	</p>
</div>

<div class="panel roles-key">
	{#each DOCUMENTED_ROLES as r}
		<div class="role-row">
			<span class="pill">{ROLE_LABELS[r]}</span>
			<span class="tiny muted">{ROLE_DESCRIPTIONS[r]}</span>
		</div>
	{/each}
</div>

<form class="panel form invite" method="POST" action="?/invite">
	<h3><Fa icon={faUserPlus} /> Add someone</h3>
	<div class="form-row three">
		<label class="field">
			<span>Email</span>
			<input name="email" type="email" required placeholder="name@example.com" />
		</label>
		<label class="field">
			<span>Full name</span>
			<input name="full_name" placeholder="Optional" />
		</label>
		<label class="field">
			<span>Role</span>
			<select name="role">
				<option value="member">{ROLE_LABELS.member}</option>
				{#each data.assignable as r}
					{#if r !== 'member'}<option value={r}>{ROLE_LABELS[r]}</option>{/if}
				{/each}
			</select>
		</label>
	</div>
	<div class="btn-row">
		<button class="btn" type="submit"><Fa icon={faUserPlus} /> Send invite</button>
		<span class="tiny muted self-center">
			They get an email and sign in with Google or Discord on that address. Invited people skip
			the approval queue.
		</span>
	</div>
</form>

<div class="toolbar">
	<div class="tabs">
		{#each TABS as t}
			<a href={href(t.key)} class:on={data.filter.role === t.key}>
				{t.label}
				<em>{countFor(t.key)}</em>
			</a>
		{/each}
	</div>

	<form class="search" method="GET">
		{#if data.filter.role !== 'staff+'}
			<input type="hidden" name="role" value={data.filter.role} />
		{/if}
		<label class="field">
			<input name="q" value={data.filter.q} placeholder="Search name or email..." />
		</label>
		<button class="btn sm ghost" type="submit"><Fa icon={faMagnifyingGlass} /></button>
	</form>
</div>

{#if data.people.length}
	<div class="table-wrap">
		<table class="data">
			<thead>
				<tr>
					<th>Person</th>
					<th>University</th>
					<th>Status</th>
					<th>Joined</th>
					<th>Role</th>
				</tr>
			</thead>
			<tbody>
				{#each data.people as p (p.id)}
					<tr>
						<td>
							<div class="who">
								<Avatar src={p.avatar_url} name={p.full_name} size={32} />
								<div class="min">
									<span class="name">{p.full_name || '-'}</span>
									<span class="sub">{p.email ?? '-'}</span>
								</div>
							</div>
						</td>
						<td class="tiny">{p.university ?? '-'}</td>
						<td>
							<span class="pill {p.status === 'approved' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad'}">
								{p.status}
							</span>
						</td>
						<td class="tiny muted">{formatDate(p.created_at)}</td>
						<td>
							{#if p.id === data.actorId}
								<span class="pill accent">{ROLE_LABELS[p.role]} (you)</span>
							{:else if canAssignTo(data.actorRole, p.role)}
								<form method="POST" action="?/setRole" class="role-form">
									<input type="hidden" name="id" value={p.id} />
									<select name="role" on:change={(e) => e.target.form.requestSubmit()}>
										<option value="member" selected={p.role === 'member'}>
											{ROLE_LABELS.member}
										</option>
										{#each data.assignable as r}
											{#if r !== 'member'}
												<option value={r} selected={p.role === r}>{ROLE_LABELS[r]}</option>
											{/if}
										{/each}
									</select>
								</form>
							{:else}
								<!-- Not assignable by this admin, so it renders as a plain label.
								     No tooltip: it would hint at a rank above their own. -->
								<span class="pill">{ROLE_LABELS[p.role]}</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="empty">Nobody matches that filter.</p>
{/if}

<style>
	.head h1 {
		font-size: 1.5rem;
		text-align: left;
		margin: 0 0 0.3rem;
	}
	.head p {
		margin: 0;
		line-height: 1.5;
	}

	.roles-key {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.role-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.role-row .pill {
		min-width: 120px;
		justify-content: center;
	}

	.invite h3 {
		margin: 0;
		font-family: Cubano, sans-serif;
		font-size: 1.1rem;
	}
	.self-center {
		align-self: center;
		line-height: 1.4;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
	}

	.tabs {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tabs a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--glass-border);
		background: var(--glass);
		font-size: 0.82rem;
		text-decoration: none;
		white-space: nowrap;
	}
	.tabs a.on {
		background: var(--accent-soft);
		border-color: var(--accent-line);
		color: var(--accent);
	}
	.tabs em {
		font-style: normal;
		opacity: 0.65;
		font-size: 0.75rem;
	}

	.search {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.search .field {
		min-width: 200px;
	}

	.min {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.role-form {
		margin: 0;
	}
	.role-form select {
		width: 100%;
		min-width: 150px;
		font-family: Inter, sans-serif;
		font-size: 0.85rem;
		color: var(--color-text);
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		padding: 0.45rem 0.5rem;
		min-height: 40px;
	}
	.role-form select option {
		background: var(--branding-primary-dark);
	}
</style>
