<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faTrash, faPlus, faLock, faChartSimple } from '@fortawesome/free-solid-svg-icons';
	import TzOffset from '$lib/components/TzOffset.svelte';
	import { formatDateTime, relative, toDateTimeLocal } from '$lib/utils.js';

	export let data;
	export let form;

	$: p = data.poll;
	$: totalVotes = data.results.reduce((s, r) => s + Number(r.votes), 0);
	$: turnout = data.eligible ? Math.round((data.ballots / data.eligible) * 100) : 0;
	const pct = (v) => (totalVotes ? Math.round((Number(v) / totalVotes) * 100) : 0);
</script>

<svelte:head><title>{p.title} | CODIHA Admin</title></svelte:head>

<a class="tiny muted" href="/admin/polls">← All votes</a>

<div class="page-head">
	<h1>{p.title}</h1>
	<p>{formatDateTime(p.opens_at)} → {formatDateTime(p.closes_at)} · {relative(p.closes_at)}</p>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

<div class="stats">
	<div class="stat"><span class="value">{data.ballots}</span><span class="label">Ballots cast</span></div>
	<div class="stat"><span class="value">{data.eligible}</span><span class="label">Eligible members</span></div>
	<div class="stat"><span class="value">{turnout}%</span><span class="label">Turnout</span></div>
	<div class="stat"><span class="value">{data.options.length}</span><span class="label">Options</span></div>
</div>

<div class="panel">
	<div class="spread">
		<h3><Fa icon={faChartSimple} /> Results</h3>
		<form method="POST" action="?/closeNow">
			<button class="btn sm ghost" type="submit"><Fa icon={faLock} /> Close voting now</button>
		</form>
	</div>
	<p class="tiny muted">
		Ballots are anonymous by design: who voted and what was voted for live in separate tables with
		no link between them.
	</p>

	{#if data.results.length}
		<div class="results">
			{#each data.results as r (r.option_id)}
				<div>
					<div class="bar-top">
						<span>{r.label}</span>
						<strong>{r.votes} <span class="tiny muted">({pct(r.votes)}%)</span></strong>
					</div>
					<div class="bar"><div style="width: {pct(r.votes)}%" /></div>
				</div>
			{/each}
		</div>
	{:else}
		<p class="tiny muted">No votes recorded yet.</p>
	{/if}
</div>

<div class="panel">
	<h3>Options</h3>
	<ul class="plain">
		{#each data.options as o (o.id)}
			<li>
				<span class="grow">{o.label}{#if o.member_id}<span class="pill tiny">member</span>{/if}</span>
				<form method="POST" action="?/removeOption">
					<input type="hidden" name="option_id" value={o.id} />
					<button class="btn sm ghost" type="submit" title="Remove option">
						<Fa icon={faTrash} />
					</button>
				</form>
			</li>
		{/each}
	</ul>

	<form method="POST" action="?/addOption" class="inline-form" style="margin-top:0.75rem">
		<label class="field">
			<span>Add an option</span>
			<input name="label" required placeholder="Option label" />
		</label>
		<button class="btn sm" type="submit"><Fa icon={faPlus} /> Add</button>
	</form>
</div>

<div class="panel">
	<h3>Edit vote</h3>
	<form class="form" method="POST" action="?/update">
		<TzOffset />
		<label class="field">
			<span>Title *</span>
			<input name="title" value={p.title} required />
		</label>
		<label class="field">
			<span>Description</span>
			<textarea name="description">{p.description ?? ''}</textarea>
		</label>
		<div class="form-row two">
			<label class="field">
				<span>Opens</span>
				<input type="datetime-local" name="opens_at" value={toDateTimeLocal(p.opens_at)} required />
			</label>
			<label class="field">
				<span>Closes</span>
				<input type="datetime-local" name="closes_at" value={toDateTimeLocal(p.closes_at)} required />
			</label>
		</div>
		<div class="form-row two">
			<label class="field">
				<span>Status</span>
				<select name="status">
					{#each ['draft', 'published', 'archived'] as s}
						<option value={s} selected={p.status === s}>{s}</option>
					{/each}
				</select>
			</label>
			<label class="check">
				<input type="checkbox" name="results_public" value="1" checked={p.results_public} />
				Publish results to members when closed
			</label>
		</div>
		<button class="btn" type="submit">Save changes</button>
	</form>
</div>

<div class="panel danger-zone">
	<h3>Danger zone</h3>
	<form
		method="POST"
		action="?/remove"
		on:submit={(ev) => {
			if (!confirm('Delete this vote and all its ballots?')) ev.preventDefault();
		}}
	>
		<button class="btn sm danger" type="submit"><Fa icon={faTrash} /> Delete vote</button>
	</form>
</div>

<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	.bar-top {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-family: Inter, sans-serif;
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
	}
	.bar {
		height: 10px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}
	.bar div {
		height: 100%;
		background: linear-gradient(90deg, var(--accent), var(--gold));
	}
	ul.plain {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	ul.plain li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-family: Inter, sans-serif;
		font-size: 0.9rem;
	}
	.grow {
		flex: 1;
	}
	form {
		margin: 0;
	}
	.danger-zone {
		border-color: rgba(248, 113, 113, 0.4);
	}
</style>
