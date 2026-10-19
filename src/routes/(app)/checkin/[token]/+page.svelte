<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faCircleCheck,
		faCircleInfo,
		faCircleXmark,
		faClock
	} from '@fortawesome/free-solid-svg-icons';
	import { formatDateTime } from '$lib/utils.js';

	export let data;

	const copy = {
		checked_in: {
			icon: faCircleCheck,
			tone: 'good',
			title: "You're checked in!",
			body: 'Your attendance is recorded and the points are already in your account.'
		},
		already: {
			icon: faCircleInfo,
			tone: 'info',
			title: 'Already checked in',
			body: 'You only earn points once per event, so no need to scan again.'
		},
		expired: {
			icon: faClock,
			tone: 'warn',
			title: 'That QR code expired',
			body: 'The code on screen changes every 30 seconds. Scan the one currently displayed.'
		},
		invalid: {
			icon: faCircleXmark,
			tone: 'bad',
			title: 'Invalid check-in code',
			body: "This link wasn't issued by CODIHA Club. Scan the QR shown on the room screen."
		},
		closed: {
			icon: faClock,
			tone: 'warn',
			title: 'Check-in is closed',
			body: 'Check-in opens one hour before the event and closes one hour after it ends.'
		},
		not_found: {
			icon: faCircleXmark,
			tone: 'bad',
			title: 'Event not found',
			body: 'This event no longer exists.'
		},
		error: {
			icon: faCircleXmark,
			tone: 'bad',
			title: "Check-in didn't go through",
			body: 'Something went wrong on our side. Ask an admin to check you in manually.'
		}
	};

	$: c = copy[data.outcome] ?? copy.error;
</script>

<svelte:head><title>Event check-in | CODIHA Club</title><meta name="robots" content="noindex" /></svelte:head>

<div class="page narrow">
	<div class="panel result {c.tone}">
		<div class="icon"><Fa icon={c.icon} /></div>
		<h1>{c.title}</h1>

		{#if data.event}
			<p class="event">{data.event.title}</p>
		{/if}

		<p class="muted">{c.body}</p>

		{#if data.outcome === 'already' && data.detail}
			<p class="tiny muted">Checked in at {formatDateTime(data.detail)}</p>
		{/if}
		{#if data.outcome === 'error' && data.detail}
			<p class="tiny muted">{data.detail}</p>
		{/if}

		{#if data.outcome === 'checked_in'}
			<div class="award">+{data.points} <span>points</span></div>
			<p class="tiny muted">{data.semesterPoints} points this year</p>
		{/if}

		<div class="btn-row">
			<a class="btn" href="/dashboard">My dashboard</a>
			{#if data.event}
				<a class="btn ghost" href="/events/{data.event.slug}">Event page</a>
			{:else}
				<a class="btn ghost" href="/events">All events</a>
			{/if}
			<a class="btn ghost" href="/leaderboard">Leaderboard</a>
		</div>
	</div>
</div>

<style>
	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.6rem;
		padding: 2.25rem 1.25rem;
	}
	.icon {
		font-size: 3rem;
	}
	.good .icon {
		color: var(--ok);
	}
	.good {
		border-color: rgba(52, 211, 153, 0.5);
	}
	.warn .icon {
		color: var(--warn);
	}
	.bad .icon {
		color: var(--bad);
	}
	.info .icon {
		color: #93c5fd;
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
	}
	p {
		margin: 0;
		max-width: 44ch;
		line-height: 1.6;
	}
	.event {
		font-family: Cubano, sans-serif;
		font-size: 1.1rem;
		color: var(--accent);
	}
	.award {
		font-family: Cubano, sans-serif;
		font-size: 2.6rem;
		line-height: 1;
		color: var(--ok);
		margin-top: 0.4rem;
	}
	.award span {
		font-family: Inter, sans-serif;
		font-size: 0.8rem;
		opacity: 0.8;
	}
</style>
