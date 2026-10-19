<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faCalendar, faTrophy, faUsers, faHourglassHalf } from '@fortawesome/free-solid-svg-icons';
	import { dateRange, formatDate, isPast } from '$lib/utils.js';

	export let hackathon;
	export let applied = null;

	$: applicationsOpen =
		hackathon.status === 'published' &&
		(!hackathon.apply_deadline || !isPast(hackathon.apply_deadline)) &&
		(!hackathon.apply_opens_at || isPast(hackathon.apply_opens_at));
</script>

<a class="card panel pad-0" href="/hackathons/{hackathon.slug}">
	{#if hackathon.cover_url}
		<img class="cover" src={hackathon.cover_url} alt={hackathon.title} loading="lazy" />
	{:else}
		<div class="cover placeholder"><span>HACKATHON</span></div>
	{/if}

	<div class="body">
		<div class="row">
			{#if applicationsOpen}
				<span class="pill ok">Applications open</span>
			{:else if isPast(hackathon.ends_at)}
				<span class="pill">Finished</span>
			{:else}
				<span class="pill warn">Applications closed</span>
			{/if}
			{#if applied}<span class="pill accent">Applied · {applied}</span>{/if}
		</div>

		<h3>{hackathon.title}</h3>
		{#if hackathon.theme}<span class="theme">Theme: {hackathon.theme}</span>{/if}
		{#if hackathon.summary}<p class="clamp-2 muted">{hackathon.summary}</p>{/if}

		<div class="meta">
			<span><Fa icon={faCalendar} /> {dateRange(hackathon.starts_at, hackathon.ends_at)}</span>
			<span
				><Fa icon={faUsers} /> Teams of {hackathon.team_size_min}–{hackathon.team_size_max}
				{#if hackathon.capacity}&nbsp;· {hackathon.capacity} seats{/if}</span
			>
			{#if hackathon.prize_pool}<span><Fa icon={faTrophy} /> {hackathon.prize_pool}</span>{/if}
			{#if hackathon.apply_deadline && applicationsOpen}
				<span><Fa icon={faHourglassHalf} /> Apply before {formatDate(hackathon.apply_deadline)}</span>
			{/if}
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
		background: linear-gradient(135deg, rgba(96, 165, 250, 0.25), rgba(var(--accent-rgb), 0.2));
	}
	.placeholder span {
		font-family: Cubano, sans-serif;
		font-size: 1.3rem;
		opacity: 0.55;
		letter-spacing: 0.12em;
	}
	.body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		flex: 1;
	}
	h3 {
		margin: 0;
		font-family: Cubano, sans-serif;
		font-size: 1.15rem;
		line-height: 1.2;
	}
	.theme {
		font-size: 0.78rem;
		color: var(--accent);
		font-weight: 600;
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
