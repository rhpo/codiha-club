<script>
	// @ts-nocheck
	import Podium from '$lib/components/Podium.svelte';
	import LeaderboardList from '$lib/components/LeaderboardList.svelte';
	import { formatDate } from '$lib/utils.js';

	export let data;

	$: me = data.profile ? data.rows.find((r) => r.id === data.profile.id) : null;

	const stats = (d, mine) => [
		{ value: d.memberCount, label: 'Members' },
		{ value: d.totalPoints, label: 'Points this year' },
		{ value: d.rows[0]?.points ?? 0, label: 'Top score' },
		{ value: mine ? '#' + mine.rank : '-', label: 'Your rank' }
	];
</script>

<svelte:head>
	<title>Leaderboard | CODIHA Club</title>
	<meta
		name="description"
		content="The CODIHA Club leaderboard: points earned by attending events, joining hackathons and contributing to the club."
	/>
</svelte:head>

<div class="page">
	<div class="page-head" data-aos="fade-down">
		<span class="eyebrow">{data.semester?.name ?? 'Standings'}</span>
		<h1>Leaderboard</h1>
		<p>
			Points come from event check-ins, hackathon participation and podium finishes. Every point is
			a ledger entry with a reason, and the board runs for the whole academic year.
		</p>
	</div>

	<div class="stats">
		{#each stats(data, me) as s, i}
			<div class="stat" data-aos="zoom-in" data-aos-delay={i * 80}>
				<span class="value">{s.value}</span><span class="label">{s.label}</span>
			</div>
		{/each}
	</div>

	{#if data.semester?.starts_on}
		<p class="tiny muted center">
			Counting points from {formatDate(data.semester.starts_on)} to {formatDate(data.semester.ends_on)}
		</p>
	{/if}

	{#if data.rows.length}
		<div data-aos="zoom-in">
			<Podium top={data.rows.slice(0, 3)} />
		</div>
		{#if data.rows.length > 3}
			<div data-aos="fade-up" data-aos-delay="100">
				<LeaderboardList rows={data.rows.slice(3)} highlightId={data.profile?.id} />
			</div>
		{/if}
	{:else}
		<p class="empty" data-aos="fade-up">No ranked members yet.</p>
	{/if}

	{#if !data.profile}
		<div class="panel center join-cta" data-aos="fade-up">
			<p>Want to be on this board?</p>
			<a class="btn lg" href="/login">Join the club</a>
		</div>
	{/if}
</div>

<style>
	.join-cta {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem 1.25rem;
	}
	.join-cta p {
		margin: 0;
		font-size: 1.05rem;
	}
</style>
