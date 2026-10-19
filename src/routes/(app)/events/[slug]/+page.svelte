<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import Coin from '$lib/components/Coin.svelte';
	import {
		faCalendar,
		faLocationDot,
		faUsers,
		faQrcode,
		faCircleCheck
	} from '@fortawesome/free-solid-svg-icons';
	import { dateRange, isLive, isPast, relative } from '$lib/utils.js';
	import { page } from '$app/stores';

	export let data;
	export let form;

	$: profile = $page.data?.profile ?? null;
	$: approved = profile?.status === 'approved';
	$: ev = data.event;
	$: live = isLive(ev.starts_at, ev.ends_at);
	$: finished = isPast(ev.ends_at);
	$: reg = data.myRegistration;
	$: seatsLeft = ev.capacity ? Math.max(0, ev.capacity - data.registeredCount) : null;
</script>

<svelte:head>
	<title>{ev.title} | CODIHA Club</title>
	<meta name="description" content={ev.summary ?? `${ev.title}: a CODIHA Club event.`} />
	{#if ev.cover_url}<meta property="og:image" content={ev.cover_url} />{/if}
</svelte:head>

<div class="page">
	<a class="back tiny muted" href="/events">← All events</a>

	{#if ev.cover_url}
		<img class="hero" src={ev.cover_url} alt={ev.title} />
	{/if}

	<div class="layout">
		<div class="main stack">
			<div class="page-head">
				<div class="row">
					{#if live}<span class="pill ok">● Live now</span>
					{:else if finished}<span class="pill">Finished</span>
					{:else}<span class="pill accent">{relative(ev.starts_at)}</span>{/if}
					<span class="pill"><Coin /> {ev.checkin_points} on check-in</span>
					{#if ev.status !== 'published'}<span class="pill warn">{ev.status}</span>{/if}
				</div>
				<h1>{ev.title}</h1>
				{#if ev.summary}<p>{ev.summary}</p>{/if}
			</div>

			{#if data.descriptionHtml}
				<div class="panel prose">{@html data.descriptionHtml}</div>
			{/if}
		</div>

		<aside class="side stack">
			<div class="panel">
				<h3>Details</h3>
				<ul class="facts">
					<li><Fa icon={faCalendar} /> <span>{dateRange(ev.starts_at, ev.ends_at)}</span></li>
					{#if ev.location}
						<li><Fa icon={faLocationDot} /> <span>{ev.location}</span></li>
					{/if}
					<li>
						<Fa icon={faUsers} />
						<span>
							{data.registeredCount} registered
							{#if ev.capacity}&nbsp;· {seatsLeft} of {ev.capacity} seats left{/if}
						</span>
					</li>
				</ul>
			</div>

			<div class="panel stack">
				{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
				{#if form?.success === 'registered'}<div class="notice ok">You're registered. See you there!</div>{/if}
				{#if form?.success === 'waitlist'}<div class="notice warn">Event is full, so you're on the waitlist.</div>{/if}
				{#if form?.success === 'cancelled'}<div class="notice">Registration cancelled.</div>{/if}

				{#if data.myAttendance}
					<div class="attended">
						<Fa icon={faCircleCheck} />
						<div>
							<strong>Checked in</strong>
							<span class="tiny muted">{relative(data.myAttendance.checked_in_at)} · +{ev.checkin_points} <Coin /></span>
						</div>
					</div>
					<a class="btn ghost block" href="/dashboard">See my points</a>
				{:else if !profile}
					<p class="tiny muted">Sign in to register and earn points for showing up.</p>
					<a class="btn block" href="/login?next=/events/{ev.slug}">Sign in to register</a>
				{:else if !approved}
					<p class="tiny muted">
						Your membership is still pending approval, so registration is locked for now.
					</p>
					<a class="btn ghost block" href="/pending">Membership status</a>
				{:else if finished}
					<p class="tiny muted">This event has finished.</p>
				{:else if reg}
					<div class="row">
						<span class="pill ok">
							{reg.status === 'waitlist' ? 'On the waitlist' : "You're registered"}
						</span>
					</div>
					{#if live}
						<div class="notice ok">
							<Fa icon={faQrcode} /> Check-in is open. Scan the QR code on the room screen.
						</div>
					{:else}
						<p class="tiny muted">
							<Fa icon={faQrcode} /> On the day, scan the QR shown on screen to check in and collect
							your {ev.checkin_points} points.
						</p>
					{/if}
					<form method="POST" action="?/cancel">
						<button class="btn ghost block sm" type="submit">Cancel my registration</button>
					</form>
				{:else}
					<form method="POST" action="?/register">
						<button class="btn block" type="submit">
							{seatsLeft === 0 ? 'Join the waitlist' : 'Register for this event'}
						</button>
					</form>
					<p class="tiny muted">Free for all CODIHA members.</p>
				{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	.back {
		text-decoration: none;
		width: fit-content;
	}
	.hero {
		width: 100%;
		max-height: 340px;
		object-fit: cover;
		border-radius: var(--radius);
		border: 1px solid var(--glass-border);
	}
	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}
	.page-head h1 {
		font-size: 1.7rem;
	}
	.facts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		font-size: 0.88rem;
	}
	.facts li {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		color: var(--muted);
	}
	.facts li :global(svg) {
		color: var(--accent);
		margin-top: 3px;
		flex: 0 0 auto;
	}
	.attended {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		color: var(--ok);
		font-size: 1.3rem;
	}
	.attended div {
		display: flex;
		flex-direction: column;
		font-size: 0.9rem;
		color: #fff;
	}
	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3) {
		font-family: Cubano, sans-serif;
		text-align: left;
		margin: 1.2rem 0 0.5rem;
		font-size: 1.2rem;
	}
	.prose :global(p),
	.prose :global(li) {
		font-family: Inter, sans-serif;
		line-height: 1.65;
		font-size: 0.95rem;
	}
	.prose :global(img) {
		max-width: 100%;
		border-radius: var(--radius-sm);
	}
	.prose :global(a) {
		color: var(--accent);
	}

	@media (min-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
		.side {
			position: sticky;
			top: calc(var(--nav-body) + 1rem);
		}
	}
</style>
