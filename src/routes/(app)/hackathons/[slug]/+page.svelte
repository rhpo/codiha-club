<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import Coin from '$lib/components/Coin.svelte';
	import {
		faCalendar,
		faLocationDot,
		faTrophy,
		faUsers,
		faHourglassHalf
	} from '@fortawesome/free-solid-svg-icons';
	import Avatar from '$lib/components/Avatar.svelte';
	import { dateRange, formatDateTime, isPast, PLACE_LABEL } from '$lib/utils.js';
	import { page } from '$app/stores';

	export let data;
	export let form;

	$: profile = $page.data?.profile ?? null;
	$: approved = profile?.status === 'approved';
	$: h = data.hackathon;
	$: app = data.myApplication;
	$: open =
		h.status === 'published' &&
		(!h.apply_deadline || !isPast(h.apply_deadline)) &&
		(!h.apply_opens_at || isPast(h.apply_opens_at));
	$: full = h.capacity ? data.acceptedCount >= h.capacity : false;
	const v = (k) => form?.values?.[k] ?? '';
	const statusPill = { pending: 'warn', accepted: 'ok', rejected: 'bad', withdrawn: '' };
</script>

<svelte:head>
	<title>{h.title} | CODIHA Hackathon</title>
	<meta name="description" content={h.summary ?? `${h.title}: a CODIHA Club hackathon.`} />
	{#if h.cover_url}<meta property="og:image" content={h.cover_url} />{/if}
</svelte:head>

<div class="page">
	<a class="back tiny muted" href="/hackathons">← All hackathons</a>

	{#if h.cover_url}
		<img class="hero" src={h.cover_url} alt={h.title} />
	{/if}

	<div class="layout">
		<div class="main stack">
			<div class="page-head">
				<div class="row">
					{#if open}<span class="pill ok">Applications open</span>
					{:else if isPast(h.ends_at)}<span class="pill">Finished</span>
					{:else}<span class="pill warn">Applications closed</span>{/if}
					<span class="pill"><Coin /> {h.points_participation} for participants</span>
				</div>
				<h1>{h.title}</h1>
				{#if h.theme}<p class="theme">Theme: {h.theme}</p>{/if}
				{#if h.summary}<p>{h.summary}</p>{/if}
			</div>

			{#if data.winners.length}
				<div class="panel">
					<h3><Fa icon={faTrophy} /> Winners</h3>
					<div class="winners">
						{#each data.winners as w (w.member_id)}
							<div class="winner place-{w.place}">
								<span class="place">{PLACE_LABEL[w.place]}</span>
								<Avatar src={w.profiles?.avatar_url} name={w.profiles?.full_name} size={44} />
								<strong>{w.profiles?.full_name ?? 'Member'}</strong>
								{#if w.team_name}<span class="tiny muted">Team {w.team_name}</span>{/if}
								{#if w.profiles?.university}
									<span class="tiny muted">{w.profiles.university}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if data.descriptionHtml}
				<div class="panel prose">{@html data.descriptionHtml}</div>
			{/if}
		</div>

		<aside class="side stack">
			<div class="panel">
				<h3>Details</h3>
				<ul class="facts">
					<li><Fa icon={faCalendar} /> <span>{dateRange(h.starts_at, h.ends_at)}</span></li>
					{#if h.location}<li><Fa icon={faLocationDot} /> <span>{h.location}</span></li>{/if}
					<li>
						<Fa icon={faUsers} />
						<span>
							Teams of {h.team_size_min}–{h.team_size_max}
							{#if h.capacity}&nbsp;· {data.acceptedCount}/{h.capacity} accepted{/if}
						</span>
					</li>
					{#if h.prize_pool}<li><Fa icon={faTrophy} /> <span>{h.prize_pool}</span></li>{/if}
					{#if h.apply_deadline}
						<li>
							<Fa icon={faHourglassHalf} />
							<span>Apply before {formatDateTime(h.apply_deadline)}</span>
						</li>
					{/if}
				</ul>
			</div>

			<div class="panel stack">
				{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
				{#if form?.success === 'applied'}
					<div class="notice ok">Application sent! Admins review applications before the event.</div>
				{/if}
				{#if form?.success === 'withdrawn'}<div class="notice">Application withdrawn.</div>{/if}

				{#if app && app.status !== 'withdrawn'}
					<h3>Your application</h3>
					<div class="row">
						<span class="pill {statusPill[app.status]}">{app.status}</span>
						{#if app.team_name}<span class="pill">Team {app.team_name}</span>{/if}
					</div>
					{#if app.status === 'pending'}
						<p class="tiny muted">We'll email you once the jury has gone through the applications.</p>
						<form method="POST" action="?/withdraw">
							<button class="btn ghost block sm" type="submit">Withdraw application</button>
						</form>
					{:else if app.status === 'accepted'}
						<p class="tiny muted">
							You're in 🎉 Your participation certificate is already in your dashboard.
						</p>
						<a class="btn ghost block sm" href="/dashboard">Open my dashboard</a>
					{:else}
						<p class="tiny muted">
							This application wasn't accepted this time. There will be more editions.
						</p>
					{/if}
				{:else if !profile}
					<p class="tiny muted">Sign in as a CODIHA member to apply.</p>
					<a class="btn block" href="/login?next=/hackathons/{h.slug}">Sign in to apply</a>
				{:else if !approved}
					<p class="tiny muted">Applications unlock once an admin approves your membership.</p>
					<a class="btn ghost block" href="/pending">Membership status</a>
				{:else if !open}
					<p class="tiny muted">Applications are closed for this hackathon.</p>
				{:else}
					<h3>Apply</h3>
					{#if full}
						<div class="notice warn">
							All {h.capacity} seats are taken, but you can still apply and we'll contact you if a
							place frees up.
						</div>
					{/if}
					<form class="form" method="POST" action="?/apply">
						<label class="field">
							<span>Team name</span>
							<input name="team_name" value={v('team_name')} placeholder="Leave empty to go solo" />
						</label>
						<label class="field">
							<span>Teammates</span>
							<input
								name="teammates"
								value={v('teammates')}
								placeholder="Names or emails, comma separated"
							/>
							<span class="hint">Teams of {h.team_size_min} to {h.team_size_max} members.</span>
						</label>
						<label class="field">
							<span>Why do you want in? *</span>
							<textarea
								name="motivation"
								required
								placeholder="What do you want to build, and what are you hoping to learn?"
								>{v('motivation')}</textarea
							>
						</label>
						<label class="field">
							<span>Your stack / skills</span>
							<input name="skills" value={v('skills')} placeholder="React, Python, Figma…" />
						</label>
						<button class="btn block" type="submit">Submit application</button>
					</form>
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
	.theme {
		color: var(--accent);
		font-weight: 600;
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
	.winners {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	.winner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		text-align: center;
		padding: 0.9rem 0.6rem;
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--glass-border);
	}
	.winner .place {
		font-size: 0.8rem;
		font-weight: 700;
	}
	.place-1 {
		border-color: rgba(251, 191, 36, 0.6);
	}
	.place-2 {
		border-color: rgba(203, 213, 225, 0.5);
	}
	.place-3 {
		border-color: rgba(208, 138, 74, 0.5);
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

	@media (min-width: 560px) {
		.winners {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 360px;
			align-items: start;
		}
		.side {
			position: sticky;
			top: calc(var(--nav-body) + 1rem);
		}
	}
</style>
