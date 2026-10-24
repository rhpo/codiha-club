<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
	import { faRankingStar, faUserPen } from '@fortawesome/free-solid-svg-icons';
	import Avatar from '$lib/components/Avatar.svelte';
	import Coin from '$lib/components/Coin.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import { formatDate } from '$lib/utils.js';
	import { externalUrl } from '$lib/profile.js';

	export let data;

	$: m = data.member;
	$: details = [m.university, m.field, m.year].filter(Boolean).join(' · ');
	// Older rows were saved before the links were normalised, so fix them on
	// the way out as well as on the way in.
	$: github = externalUrl(m.github);
	$: linkedin = externalUrl(m.linkedin);
</script>

<svelte:head>
	<title>{m.full_name} | CODIHA Club</title>
	<meta name="description" content="{m.full_name} at CODIHA Club{details ? ` — ${details}` : ''}." />
</svelte:head>

<div class="page narrow">
	<div class="panel hero">
		<Avatar src={m.avatar_url} name={m.full_name} size={88} />

		<div class="who">
			<h1>{m.full_name}</h1>
			{#if details}<p class="tiny muted">{details}</p>{/if}
			<p class="tiny muted">Member since {formatDate(m.created_at)}</p>

			<div class="links">
				{#if github}
					<a class="btn ghost sm" href={github} rel="noopener noreferrer" target="_blank">
						<Fa icon={faGithub} /> GitHub
					</a>
				{/if}
				{#if linkedin}
					<a class="btn ghost sm" href={linkedin} rel="noopener noreferrer" target="_blank">
						<Fa icon={faLinkedin} /> LinkedIn
					</a>
				{/if}
				{#if data.isMe}
					<a class="btn ghost sm" href="/onboarding?edit=1"><Fa icon={faUserPen} /> Edit</a>
				{/if}
			</div>
		</div>

		<div class="score">
			<strong><Coin /> {data.points}</strong>
			{#if data.rank}
				<span class="tiny muted"><Fa icon={faRankingStar} /> #{data.rank}</span>
			{/if}
		</div>
	</div>

	{#if m.bio}
		<section class="panel bio">
			<h2 class="tiny-head">About</h2>
			<p>{m.bio}</p>
		</section>
	{/if}

	{#if data.badges.length}
		<section class="stack">
			<div class="section-head"><h2>Badges</h2></div>
			<div class="badges">
				{#each data.badges as b}
					<span class="badge-pill" style="--c:{b.color ?? 'var(--accent)'}" title={b.description}>
						{b.name}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.isMember}
		<section class="stack">
			<div class="section-head"><h2>Posts</h2></div>
			{#if data.posts.length}
				<div class="feed">
					{#each data.posts as post (post.id)}
						<PostCard {post} canDelete={false} />
					{/each}
				</div>
			{:else}
				<p class="empty">Nothing posted yet.</p>
			{/if}
		</section>
	{:else}
		<p class="tiny muted">
			<a href="/login">Sign in</a> to see what {m.full_name.split(' ')[0]} has been posting.
		</p>
	{/if}
</div>

<style>
	.hero {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.who {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.who h1 {
		margin: 0 0 0.15rem;
		font-size: 1.5rem;
		text-align: left;
	}

	.who p {
		margin: 0;
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}

	.score {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.2rem;
	}

	.score strong {
		font-family: Cubano, sans-serif;
		font-size: 1.4rem;
	}

	.bio {
		margin-top: 1rem;
	}

	.bio p {
		margin: 0.3rem 0 0;
		white-space: pre-wrap;
	}

	.tiny-head {
		margin: 0;
		font-size: 0.95rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.badge-pill {
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--c);
		color: var(--c);
		font-family: Inter, sans-serif;
		font-size: 0.78rem;
	}

	.feed {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
