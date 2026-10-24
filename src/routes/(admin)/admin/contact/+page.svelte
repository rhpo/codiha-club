<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faCheck,
		faEnvelope,
		faEnvelopeOpen,
		faReply,
		faRotateLeft
	} from '@fortawesome/free-solid-svg-icons';
	import { enhance } from '$app/forms';
	import { relative } from '$lib/utils.js';

	export let data;

	/** Unanswered first, because that is the whole job of this page. */
	let filter = 'open';
	$: shown = data.messages.filter((m) =>
		filter === 'open' ? m.status !== 'handled' : filter === 'all' ? true : m.status === 'handled'
	);

	const tone = { new: 'bad', read: 'warn', handled: 'ok' };

	const mailto = (m) =>
		`mailto:${m.email}?subject=${encodeURIComponent(
			m.subject ? `Re: ${m.subject}` : 'Your message to CODIHA Club'
		)}`;
</script>

<svelte:head><title>Messages | CODIHA Club admin</title></svelte:head>

<div class="head">
	<h1><Fa icon={faEnvelope} /> Messages</h1>
	<div class="filters">
		{#each [['open', 'Needs a reply'], ['handled', 'Handled'], ['all', 'All']] as [key, label]}
			<button class="btn sm" class:ghost={filter !== key} type="button" on:click={() => (filter = key)}>
				{label}
			</button>
		{/each}
	</div>
</div>

{#each shown as m (m.id)}
	<article class="panel msg" class:unread={m.status === 'new'}>
		<header>
			<div>
				<strong>{m.name}</strong>
				<a class="tiny" href="mailto:{m.email}">{m.email}</a>
				{#if m.member_id}
					<a class="tiny muted" href="/members/{m.member_id}">member profile</a>
				{/if}
			</div>
			<div class="meta">
				<span class="pill {tone[m.status]}">{m.status}</span>
				<span class="tiny muted">{relative(m.created_at)}</span>
			</div>
		</header>

		{#if m.subject}<p class="subject">{m.subject}</p>{/if}
		<p class="body">{m.body}</p>

		{#if m.status === 'handled' && m.handler?.full_name}
			<p class="tiny muted">Handled by {m.handler.full_name}</p>
		{/if}

		<footer>
			<a class="btn sm" href={mailto(m)}><Fa icon={faReply} /> Reply by email</a>

			{#if m.status === 'new'}
				<form method="POST" action="?/read" use:enhance>
					<input type="hidden" name="id" value={m.id} />
					<button class="btn sm ghost" type="submit"><Fa icon={faEnvelopeOpen} /> Mark read</button>
				</form>
			{/if}

			{#if m.status !== 'handled'}
				<form method="POST" action="?/handled" use:enhance>
					<input type="hidden" name="id" value={m.id} />
					<button class="btn sm ok" type="submit"><Fa icon={faCheck} /> Mark handled</button>
				</form>
			{:else}
				<form method="POST" action="?/reopen" use:enhance>
					<input type="hidden" name="id" value={m.id} />
					<button class="btn sm ghost" type="submit"><Fa icon={faRotateLeft} /> Reopen</button>
				</form>
			{/if}
		</footer>
	</article>
{:else}
	<p class="empty">
		{filter === 'handled' ? 'Nothing handled yet.' : 'No messages waiting. Nice.'}
	</p>
{/each}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		margin-bottom: 1rem;
	}

	.filters {
		display: flex;
		gap: 0.4rem;
	}

	.msg {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.9rem;
	}

	/* Unanswered should be obvious at a glance down the page. */
	.unread {
		border-color: var(--accent-line);
	}

	.msg header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.msg header div {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.meta {
		align-items: flex-end;
	}

	.subject {
		margin: 0;
		font-weight: 700;
	}

	.body {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.msg footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
</style>
