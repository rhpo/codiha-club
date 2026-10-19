<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import Coin from '$lib/components/Coin.svelte';
	import { faCalendar, faLocationDot } from '@fortawesome/free-solid-svg-icons';
	import { dateRange, isLive, isPast } from '$lib/utils.js';

	export let event;
	export let registered = false;
</script>

<a class="card panel pad-0" href="/events/{event.slug}">
	{#if event.cover_url}
		<img class="cover" src={event.cover_url} alt={event.title} loading="lazy" />
	{:else}
		<div class="cover placeholder"><span>CODIHA</span></div>
	{/if}

	<div class="body">
		<div class="row">
			{#if isLive(event.starts_at, event.ends_at)}
				<span class="pill ok">● Live now</span>
			{:else if isPast(event.ends_at)}
				<span class="pill">Past</span>
			{:else}
				<span class="pill accent">Upcoming</span>
			{/if}
			{#if registered}<span class="pill ok">You're in</span>{/if}
			<span class="pill"><Coin /> {event.checkin_points}</span>
		</div>

		<h3>{event.title}</h3>
		{#if event.summary}<p class="clamp-2 muted">{event.summary}</p>{/if}

		<div class="meta">
			<span><Fa icon={faCalendar} /> {dateRange(event.starts_at, event.ends_at)}</span>
			{#if event.location}<span><Fa icon={faLocationDot} /> {event.location}</span>{/if}
		</div>
	</div>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;
		overflow: hidden;
		transition: transform 0.2s, border-color 0.2s;
		height: 100%;
	}
	.card:hover {
		transform: translateY(-3px);
		border-color: var(--glass-border-strong);
		text-decoration: none;
	}
	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.25), rgba(255, 255, 255, 0.05));
	}
	.placeholder span {
		font-family: Cubano, sans-serif;
		font-size: 1.6rem;
		opacity: 0.5;
		letter-spacing: 0.1em;
	}
	.body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}
	h3 {
		margin: 0;
		font-family: Cubano, sans-serif;
		font-size: 1.15rem;
		line-height: 1.2;
	}
	p {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.45;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.78rem;
		color: var(--muted);
		margin-top: auto;
		padding-top: 0.25rem;
	}
</style>
