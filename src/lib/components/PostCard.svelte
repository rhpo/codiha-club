<!--
	One post: author, body, up to four images, reactions and a comment count.
	The author and the comment count both link out - to the member's page, and
	to the post's own page where the comments live.
-->
<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faComment, faTrash } from '@fortawesome/free-solid-svg-icons';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Avatar from '$lib/components/Avatar.svelte';
	import { relative } from '$lib/utils.js';
	import { REACTIONS, totalReactions } from '$lib/reactions.js';

	export let post;
	/** Shown only to whoever may remove it. */
	export let canDelete = false;
	/** The detail page renders the body in full; the feed clamps it. */
	export let full = false;
	/**
	 * Shown somewhere without a `?/react` action - the landing page. The
	 * tally becomes a link to the post rather than a picker that would POST
	 * to a route that cannot handle it.
	 */
	export let readonly = false;

	/* Optimistic: the tally moves on click rather than after the round trip,
	   because a reaction that takes a second to appear feels broken. The
	   server is still the source of truth on the next load. */
	let mine = post.myReaction;
	let counts = {};
	$: mine = post.myReaction;
	$: counts = Object.fromEntries((post.reactions ?? []).map((r) => [r.key, r.n]));
	$: total = totalReactions(post.reactions);

	let picking = false;

	const react = (key) => {
		if (mine === key) {
			// Picking the same one again takes it back.
			counts[key] = Math.max(0, (counts[key] ?? 1) - 1);
			mine = null;
		} else {
			// One reaction per member, so a new pick replaces the old one.
			if (mine) counts[mine] = Math.max(0, (counts[mine] ?? 1) - 1);
			counts[key] = (counts[key] ?? 0) + 1;
			mine = key;
		}
		counts = counts;
		picking = false;
	};
</script>

<article class="post panel">
	<header>
		<a class="author" href="/members/{post.author_id}">
			<Avatar src={post.author_avatar} name={post.author_name} size={40} />
		</a>
		<div class="who">
			<a class="author" href="/members/{post.author_id}"><strong>{post.author_name}</strong></a>
			<span class="tiny muted">{relative(post.created_at)}</span>
		</div>

		{#if canDelete}
			<form method="POST" action="?/remove" use:enhance>
				<input type="hidden" name="post_id" value={post.id} />
				<button class="icon-btn" type="submit" title="Delete this post">
					<Fa icon={faTrash} />
				</button>
			</form>
		{/if}
	</header>

	<p class="body" class:clamp={!full}>{post.body}</p>

	{#if post.images?.length}
		<!-- One image fills the width; two or more tile, so a single screenshot
		     is not shrunk into a thumbnail for no reason. -->
		<div class="shots" class:one={post.images.length === 1}>
			{#each post.images as src}
				<img {src} alt="" loading="lazy" />
			{/each}
		</div>
	{/if}

	<footer>
		<div class="reactions">
			<!-- The tally doubles as the opener, so the bar stays one control
			     until somebody actually wants to react. -->
			<button
				class="act"
				class:on={!!mine}
				type="button"
				on:click={() => (readonly ? goto(`/posts/${post.id}`) : (picking = !picking))}
				title={readonly ? 'Open this post' : 'React to this post'}
			>
				{#if total}
					<span class="glyphs">
						{#each (post.reactions ?? []).slice(0, 3) as r}<span>{r.glyph}</span>{/each}
					</span>
					{total}
				{:else}
					<span class="glyphs"><span>🙂</span></span> React
				{/if}
			</button>

			{#if picking}
				<div class="picker">
					{#each REACTIONS as r}
						<form method="POST" action="?/react" use:enhance>
							<input type="hidden" name="post_id" value={post.id} />
							<input type="hidden" name="emoji" value={r.key} />
							<button
								class="pick"
								class:on={mine === r.key}
								type="submit"
								title={r.label}
								on:click={() => react(r.key)}
							>
								{r.glyph}
								{#if counts[r.key]}<span class="n">{counts[r.key]}</span>{/if}
							</button>
						</form>
					{/each}
				</div>
			{/if}
		</div>

		<a class="act" href="/posts/{post.id}">
			<Fa icon={faComment} />
			{post.comment_count ?? 0}
		</a>
	</footer>
</article>

<style>
	.post {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.author {
		text-decoration: none;
		color: inherit;
	}

	.author:hover strong {
		color: var(--accent);
	}

	.who {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		min-width: 0;
		flex: 1;
	}

	.body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.clamp {
		display: -webkit-box;
		-webkit-line-clamp: 8;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.shots {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}

	.shots.one {
		grid-template-columns: 1fr;
	}

	.shots img {
		width: 100%;
		max-height: 420px;
		object-fit: cover;
		border-radius: 10px;
		display: block;
		background: var(--glass);
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.act {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--glass-border);
		background: none;
		color: var(--muted);
		font-family: Inter, sans-serif;
		font-size: 0.82rem;
		cursor: var(--pointer, pointer);
		text-decoration: none;
	}

	.act:hover {
		color: var(--color-text);
		border-color: var(--glass-border-strong);
	}

	.act.on {
		color: var(--accent);
		border-color: var(--accent-line);
	}

	.reactions {
		position: relative;
	}

	.glyphs {
		display: inline-flex;
	}

	/* Overlapped slightly so three reactions read as one cluster rather than
	   a row of separate buttons. */
	.glyphs span + span {
		margin-left: -0.28rem;
	}

	.picker {
		position: absolute;
		bottom: calc(100% + 0.35rem);
		left: 0;
		z-index: 5;
		display: flex;
		gap: 0.15rem;
		padding: 0.3rem;
		border-radius: 999px;
		background: var(--surface-strong);
		border: 1px solid var(--glass-border);
		backdrop-filter: blur(10px);
	}

	.pick {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		background: none;
		border: 0;
		border-radius: 999px;
		padding: 0.2rem 0.4rem;
		font-size: 1rem;
		cursor: var(--pointer, pointer);
	}

	.pick:hover {
		background: var(--glass);
	}

	.pick.on {
		background: var(--accent-soft);
	}

	.pick .n {
		font-family: Inter, sans-serif;
		font-size: 0.72rem;
		color: var(--muted);
	}

	.icon-btn {
		background: none;
		border: 0;
		color: var(--muted-2);
		cursor: var(--pointer, pointer);
		padding: 0.2rem;
	}

	.icon-btn:hover {
		color: var(--accent);
	}
</style>
