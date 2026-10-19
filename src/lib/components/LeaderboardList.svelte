<script>
	// @ts-nocheck
	import Avatar from './Avatar.svelte';
	import Coin from '$lib/components/Coin.svelte';

	export let rows = [];
	export let highlightId = null;
</script>

<div class="list panel pad-0">
	{#each rows as row (row.id)}
		<div class="row-item" class:me={row.id === highlightId}>
			<span class="rank num">#{row.rank}</span>
			<Avatar src={row.avatar_url} name={row.full_name} size={34} />
			<span class="who-col">
				<span class="name">{row.full_name || 'Member'}{#if row.id === highlightId}&nbsp;<em>(you)</em>{/if}</span>
				<span class="sub">{[row.university, row.field].filter(Boolean).join(' · ') || '-'}</span>
			</span>
			{#if row.badge_count}<span class="badges tiny">🏅 {row.badge_count}</span>{/if}
			<span class="pts num">{row.points} <Coin size="0.9em" /></span>
		</div>
	{:else}
		<p class="empty-inline">No ranked members yet.</p>
	{/each}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		font-family: Inter, sans-serif;
	}

	.row-item {
		display: grid;
		grid-template-columns: 2.5rem 34px minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.row-item:last-child {
		border-bottom: none;
	}

	.row-item.me {
		background: var(--accent-soft);
	}

	.rank {
		font-family: Cubano, sans-serif;
		font-size: 0.95rem;
		color: var(--muted);
	}

	.who-col {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-weight: 600;
		font-size: 0.92rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name em {
		font-style: normal;
		color: var(--accent);
		font-size: 0.78rem;
	}

	.sub {
		font-size: 0.74rem;
		color: var(--muted-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badges {
		color: var(--muted);
		display: none;
	}

	.pts {
		font-family: Cubano, sans-serif;
		font-size: 1.1rem;
	}

	.empty-inline {
		margin: 0;
		padding: 1.5rem;
		text-align: center;
		color: var(--muted);
		font-size: 0.9rem;
	}

	@media (min-width: 560px) {
		.row-item {
			grid-template-columns: 2.5rem 34px minmax(0, 1fr) auto auto;
		}
		.badges {
			display: inline;
		}
	}
</style>
