<script>
	// @ts-nocheck
	import Avatar from './Avatar.svelte';
	import Coin from '$lib/components/Coin.svelte';

	/** top: up to 3 leaderboard rows, already sorted by rank */
	export let top = [];

	// podium order on wide screens: 2nd, 1st, 3rd
	$: ordered = [top[1], top[0], top[2]].filter(Boolean);
	const tierOf = (row) => (row?.rank === 1 ? 'gold' : row?.rank === 2 ? 'silver' : 'bronze');
	const medal = { gold: '🥇', silver: '🥈', bronze: '🥉' };
</script>

{#if top.length}
	<div class="podium">
		{#each ordered as row (row.id)}
			<div class="slot {tierOf(row)}">
				<div class="crown">{medal[tierOf(row)]}</div>
				<Avatar src={row.avatar_url} name={row.full_name} size={tierOf(row) === 'gold' ? 76 : 60} />
				<div class="name">{row.full_name || 'Member'}</div>
				{#if row.university}<div class="uni">{row.university}</div>{/if}
				<div class="points">{row.points} <Coin size="0.85em" /></div>
				<div class="block">#{row.rank}</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.podium {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		width: 100%;
		font-family: Inter, sans-serif;
	}

	.slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 1rem 0.75rem 0;
		background: var(--glass);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius);
		overflow: hidden;
		position: relative;
	}

	.crown {
		font-size: 1.5rem;
		line-height: 1;
	}

	.name {
		font-family: Cubano, sans-serif;
		font-size: 1.05rem;
		text-align: center;
		line-height: 1.15;
	}

	.uni {
		font-size: 0.72rem;
		color: var(--muted-2);
		text-align: center;
	}

	.points {
		font-family: Cubano, sans-serif;
		font-size: 1.5rem;
		line-height: 1;
		margin-top: 0.2rem;
	}
	.points span {
		font-family: Inter, sans-serif;
		font-size: 0.7rem;
		opacity: 0.7;
		margin-left: 2px;
	}

	.block {
		margin-top: 0.75rem;
		width: 100%;
		text-align: center;
		font-family: Cubano, sans-serif;
		font-size: 1rem;
		padding: 0.35rem 0;
		color: var(--on-accent);
	}

	.gold {
		border-color: rgba(251, 191, 36, 0.6);
		box-shadow: 0 0 24px rgba(251, 191, 36, 0.18);
	}
	.gold .block {
		background: linear-gradient(180deg, #fde68a, #f59e0b);
	}
	.silver {
		border-color: rgba(203, 213, 225, 0.55);
	}
	.silver .block {
		background: linear-gradient(180deg, #f1f5f9, #94a3b8);
	}
	.bronze {
		border-color: rgba(208, 138, 74, 0.55);
	}
	.bronze .block {
		background: linear-gradient(180deg, #e8b98f, #b4713a);
	}

	@media (min-width: 680px) {
		.podium {
			grid-template-columns: repeat(3, 1fr);
			align-items: end;
		}
		.gold .block {
			height: 86px;
			line-height: 86px;
			padding: 0;
		}
		.silver .block {
			height: 62px;
			line-height: 62px;
			padding: 0;
		}
		.bronze .block {
			height: 44px;
			line-height: 44px;
			padding: 0;
		}
		.gold {
			padding-top: 1.5rem;
		}
	}
</style>
