<script>
	// @ts-nocheck
	import EventCard from '$lib/components/EventCard.svelte';

	export let data;
	$: regs = new Set(data.registeredIds);
</script>

<svelte:head>
	<title>Events | CODIHA Club</title>
	<meta
		name="description"
		content="Workshops, talks and meetups run by CODIHA Club at ESST Algiers. Register, check in with a QR scan and earn points."
	/>
</svelte:head>

<div class="page">
	<div class="page-head" data-aos="fade-down">
		<span class="eyebrow">Workshops · Talks · Meetups</span>
		<h1>Events</h1>
		<p>
			Register in one tap, show up, scan the QR on the screen and the points land in your account
			automatically.
		</p>
	</div>

	<section class="stack">
		<div class="section-head"><h2>Upcoming</h2></div>
		{#if data.upcoming.length}
			<div class="grid cols-3">
				{#each data.upcoming as event, i (event.id)}
					<div class="cell" data-aos="fade-up" data-aos-delay={i * 100}>
						<EventCard {event} registered={regs.has(event.id)} />
					</div>
				{/each}
			</div>
		{:else}
			<p class="empty" data-aos="fade-up">Nothing scheduled right now.</p>
		{/if}
	</section>

	{#if data.past.length}
		<section class="stack">
			<div class="section-head"><h2>Past events</h2></div>
			<div class="grid cols-3">
				{#each data.past as event, i (event.id)}
					<div class="cell" data-aos="fade-up" data-aos-delay={i * 100}>
						<EventCard {event} registered={regs.has(event.id)} />
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>
