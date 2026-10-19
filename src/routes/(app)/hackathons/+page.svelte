<script>
	// @ts-nocheck
	import HackathonCard from '$lib/components/HackathonCard.svelte';

	export let data;
</script>

<svelte:head>
	<title>Hackathons | CODIHA Club</title>
	<meta
		name="description"
		content="Apply to CODIHA Club hackathons: build in teams, win prizes and get a verifiable certificate."
	/>
</svelte:head>

<div class="page">
	<div class="page-head" data-aos="fade-down">
		<span class="eyebrow">Build · Ship · Win</span>
		<h1>Hackathons</h1>
		<p>
			A theme, a deadline and a team. Accepted participants get a participation certificate;
			podium teams get a winner certificate.
		</p>
	</div>

	<section class="stack">
		<div class="section-head"><h2>Open & upcoming</h2></div>
		{#if data.current.length}
			<div class="grid cols-2">
				{#each data.current as hackathon, i (hackathon.id)}
					<div class="cell" data-aos="fade-up" data-aos-delay={i * 100}>
						<HackathonCard {hackathon} applied={data.applied[hackathon.id] ?? null} />
					</div>
				{/each}
			</div>
		{:else}
			<p class="empty" data-aos="fade-up">No hackathon running right now.</p>
		{/if}
	</section>

	{#if data.past.length}
		<section class="stack">
			<div class="section-head"><h2>Past editions</h2></div>
			<div class="grid cols-2">
				{#each data.past as hackathon, i (hackathon.id)}
					<div class="cell" data-aos="fade-up" data-aos-delay={i * 100}>
						<HackathonCard {hackathon} applied={data.applied[hackathon.id] ?? null} />
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>
