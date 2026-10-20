<script>
	// @ts-nocheck
	import Podium from '$lib/components/Podium.svelte';
	import LeaderboardList from '$lib/components/LeaderboardList.svelte';
	import Fa from 'svelte-fa';
	import { faRankingStar } from '@fortawesome/free-solid-svg-icons';

	export let rows = [];
	export let semester = null;
	export let meId = null;
	/** Fewer than this and the board is hidden rather than shown half-empty. */
	const MIN_RANKED = 3;

	$: top3 = rows.slice(0, 3);
	$: rest = rows.slice(3);

	// A podium needs three people to mean anything, and a board of one reads as
	// a mistake. Below that the section is not rendered at all.
	$: enoughToRank = rows.length >= MIN_RANKED;
</script>

{#if enoughToRank}
<section class="wrap" id="leaderboard">
	<div class="section-head" data-aos="fade-right">
		<div>
			<span class="eyebrow">Live standings</span>
			<h2><Fa icon={faRankingStar} /> Leaderboard</h2>
		</div>
		<a href="/leaderboard">Full leaderboard →</a>
	</div>

	{#if semester?.starts_on}
		<p class="semester tiny muted">
			{semester.name ?? 'This year'} · counting {new Date(semester.starts_on).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			})} → {new Date(semester.ends_on).toLocaleDateString('en-GB', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			})}
		</p>
	{/if}

	<div data-aos="zoom-in" class="full">
		<Podium top={top3} />
	</div>
	{#if rest.length}
		<div data-aos="fade-up" class="full">
			<LeaderboardList rows={rest} highlightId={meId} />
		</div>
	{/if}
</section>
{/if}

<style>
	.wrap {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.full {
		width: 100%;
	}
	h2 {
		font-size: 1.8rem;
	}
	.semester {
		margin: -0.5rem 0 0;
		font-family: Inter, sans-serif;
	}
</style>
