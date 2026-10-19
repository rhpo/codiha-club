<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faCheckToSlot, faLock, faChartSimple } from '@fortawesome/free-solid-svg-icons';
	import Avatar from '$lib/components/Avatar.svelte';
	import { formatDateTime, relative } from '$lib/utils.js';

	export let data;
	export let form;

	const pct = (votes, results) => {
		const total = results.reduce((s, r) => s + Number(r.votes), 0);
		return total ? Math.round((Number(votes) / total) * 100) : 0;
	};
</script>

<svelte:head><title>Club votes | CODIHA Club</title></svelte:head>

<div class="page narrow">
	<div class="page-head">
		<span class="eyebrow">Members only</span>
		<h1><Fa icon={faCheckToSlot} /> Club votes</h1>
		<p>
			One vote per member, fully anonymous: we store that you voted separately from what you voted
			for, so nobody (admins included) can link a ballot back to you.
		</p>
	</div>

	{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
	{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

	{#each data.open as poll (poll.id)}
		<div class="panel stack">
			<div>
				<h3>{poll.title}</h3>
				{#if poll.description}<p class="tiny muted">{poll.description}</p>{/if}
				<p class="tiny muted">Closes {relative(poll.closes_at)} · {formatDateTime(poll.closes_at)}</p>
			</div>

			{#if poll.votedAt}
				<div class="notice ok">
					<Fa icon={faLock} /> You voted {relative(poll.votedAt)}. Results are published when the
					poll closes.
				</div>
			{:else}
				<form method="POST" action="?/vote" class="options">
					<input type="hidden" name="poll_id" value={poll.id} />
					{#each poll.poll_options as opt (opt.id)}
						<label class="option">
							<input type="radio" name="option_id" value={opt.id} required />
							{#if opt.member_id}
								<Avatar name={opt.label} size={30} />
							{/if}
							<span>{opt.label}</span>
						</label>
					{/each}
					<button class="btn block" type="submit">Submit my vote</button>
					<p class="tiny muted">You can't change your vote once submitted.</p>
				</form>
			{/if}
		</div>
	{/each}

	{#each data.upcoming as poll (poll.id)}
		<div class="panel">
			<h3>{poll.title}</h3>
			<p class="tiny muted">Opens {relative(poll.opens_at)} · {formatDateTime(poll.opens_at)}</p>
		</div>
	{/each}

	{#each data.closed as poll (poll.id)}
		<div class="panel stack">
			<div>
				<div class="row"><span class="pill">Closed</span></div>
				<h3>{poll.title}</h3>
				<p class="tiny muted">Closed {relative(poll.closes_at)}</p>
			</div>

			{#if poll.results}
				<div class="results">
					{#each poll.results as r (r.option_id)}
						<div class="bar-row">
							<div class="bar-top">
								<span>{r.label}</span><strong>{r.votes}</strong>
							</div>
							<div class="bar"><div style="width: {pct(r.votes, poll.results)}%" /></div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="tiny muted"><Fa icon={faChartSimple} /> Results are not public for this poll.</p>
			{/if}
		</div>
	{/each}

	{#if !data.open.length && !data.closed.length && !data.upcoming.length}
		<p class="empty">No club votes right now. Admins open them for elections and awards.</p>
	{/if}
</div>

<style>
	h3 {
		font-family: Cubano, sans-serif;
		margin: 0 0 0.2rem;
		font-size: 1.2rem;
	}
	p {
		margin: 0;
	}
	.options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--glass-border);
		background: rgba(0, 0, 0, 0.2);
		cursor: pointer;
		font-family: Inter, sans-serif;
		font-size: 0.95rem;
		transition: border-color 0.15s, background 0.15s;
	}
	.option:hover {
		border-color: var(--accent);
	}
	.option input {
		width: 18px;
		height: 18px;
		accent-color: var(--accent);
		flex: 0 0 auto;
	}
	.option:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.bar-top {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.88rem;
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
		border-radius: 999px;
	}
</style>
