<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faPlus, faChartSimple } from '@fortawesome/free-solid-svg-icons';
	import TzOffset from '$lib/components/TzOffset.svelte';
	import { formatDateTime, relative } from '$lib/utils.js';
	import { page } from '$app/stores';

	export let data;
	export let form;

	let showNew = $page.url.searchParams.get('new') === '1';
	let addMembers = false;
	let memberFilter = '';

	$: filteredMembers = data.members.filter((m) =>
		m.full_name?.toLowerCase().includes(memberFilter.toLowerCase())
	);
	const tone = { draft: 'warn', published: 'ok', archived: '' };
</script>

<svelte:head><title>Votes | CODIHA Admin</title></svelte:head>

<div class="spread">
	<div class="page-head">
		<h1>Votes</h1>
		<p>Anonymous, one ballot per approved member ({data.memberCount} eligible).</p>
	</div>
	<button class="btn" on:click={() => (showNew = !showNew)}>
		<Fa icon={faPlus} /> {showNew ? 'Close' : 'New vote'}
	</button>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}

{#if showNew}
	<div class="panel">
		<h3>Create a vote</h3>
		<form class="form" method="POST" action="?/create">
			<TzOffset />

			<label class="field">
				<span>Question / title *</span>
				<input name="title" required placeholder="Best member of the year" />
			</label>

			<label class="field">
				<span>Description</span>
				<textarea name="description" placeholder="How the vote works, who is eligible…" />
			</label>

			<div class="form-row two">
				<label class="field">
					<span>Opens</span>
					<input type="datetime-local" name="opens_at" />
					<span class="hint">Leave empty to open immediately.</span>
				</label>
				<label class="field">
					<span>Closes *</span>
					<input type="datetime-local" name="closes_at" required />
				</label>
			</div>

			<label class="field">
				<span>Options (one per line)</span>
				<textarea name="options" placeholder={'Yes\nNo\nAbstain'} />
			</label>

			<label class="check">
				<input type="checkbox" bind:checked={addMembers} />
				Add members as options (for elections like "Club president")
			</label>

			{#if addMembers}
				<label class="field">
					<span>Filter members</span>
					<input bind:value={memberFilter} placeholder="Type a name…" />
				</label>
				<div class="member-picker">
					{#each filteredMembers as m (m.id)}
						<label class="check">
							<input type="checkbox" name="member_options" value={m.id} />
							{m.full_name} <span class="tiny muted">{m.university ?? ''}</span>
						</label>
					{/each}
					{#if !filteredMembers.length}<p class="tiny muted">No member matches.</p>{/if}
				</div>
			{/if}

			<div class="form-row two">
				<label class="field">
					<span>Status</span>
					<select name="status">
						<option value="draft">draft</option>
						<option value="published">published</option>
					</select>
				</label>
				<label class="check">
					<input type="checkbox" name="results_public" value="1" checked /> Publish results when the
					vote closes
				</label>
			</div>

			<button class="btn" type="submit">Create vote</button>
		</form>
	</div>
{/if}

<div class="table-wrap">
	<table class="data">
		<thead>
			<tr>
				<th>Vote</th>
				<th>Window</th>
				<th>Status</th>
				<th class="num">Options</th>
				<th class="num">Ballots</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each data.polls as p (p.id)}
				<tr>
					<td>
						<span class="name">{p.title}</span>
						{#if p.description}<br /><span class="sub tiny muted">{p.description}</span>{/if}
					</td>
					<td class="tiny muted">
						{formatDateTime(p.opens_at)}<br />→ {formatDateTime(p.closes_at)}
						<br /><em>{relative(p.closes_at)}</em>
					</td>
					<td><span class="pill {tone[p.status]}">{p.status}</span></td>
					<td class="num">{p.poll_options?.length ?? 0}</td>
					<td class="num">
						{data.ballotCount[p.id] ?? 0}
						<span class="tiny muted">/{data.memberCount}</span>
					</td>
					<td>
						<a class="btn sm ghost" href="/admin/polls/{p.id}">
							<Fa icon={faChartSimple} /> Manage
						</a>
					</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="center muted">No votes created yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.75rem;
	}
	table.data {
		min-width: 860px;
	}
	.member-picker {
		max-height: 260px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.6rem;
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.2);
	}
</style>
