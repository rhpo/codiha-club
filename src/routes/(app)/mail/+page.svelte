<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faInbox,
		faPaperPlane,
		faBoxArchive,
		faTriangleExclamation,
		faPenToSquare,
		faEye
	} from '@fortawesome/free-solid-svg-icons';
	import { relative } from '$lib/utils.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import FileDrop from '$lib/components/FileDrop.svelte';

	export let data;

	let composing = false;

	const FOLDERS = [
		{ key: 'inbox', label: 'Inbox', icon: faInbox },
		{ key: 'archive', label: 'Archive', icon: faBoxArchive },
		{ key: 'spam', label: 'Spam', icon: faTriangleExclamation }
	];

	const folderHref = (key) => {
		const p = new URLSearchParams($page.url.searchParams);
		p.set('folder', key);
		return `?${p.toString()}`;
	};

	const threadHref = (id) => {
		const as = $page.url.searchParams.get('as');
		return as ? `/mail/${id}?as=${as}` : `/mail/${id}`;
	};

	const switchMailbox = (e) => {
		const id = e.target.value;
		goto(id ? `/mail?as=${id}` : '/mail');
	};
</script>

<svelte:head><title>Mail | CODIHA Club</title></svelte:head>

<div class="page">
	{#if !data.account}
		<div class="page-head">
			<span class="eyebrow">Mailbox</span>
			<h1>Mail</h1>
		</div>
		<p class="empty">
			You do not have a club address yet. An admin sets these up from the admin panel.
		</p>
	{:else}
		<div class="page-head">
			<span class="eyebrow">Mailbox</span>
			<h1>Mail</h1>
			<p class="addresses">
				<span><strong>Receive at</strong> {data.account.address}</span>
				<span class="muted"><strong>Send as</strong> {data.sendingAddress}</span>
			</p>
		</div>

		{#if data.impersonating}
			<div class="notice warn">
				<Fa icon={faEye} /> Viewing
				<strong>{data.account.label ?? data.account.address}</strong>'s mailbox.
			</div>
		{/if}

		<div class="bar">
			<div class="folders">
				{#each FOLDERS as f}
					<a href={folderHref(f.key)} class:on={(data.folder ?? 'inbox') === f.key}>
						<Fa icon={f.icon} />
						{f.label}
					</a>
				{/each}
			</div>

			<div class="bar-right">
				{#if data.quota}
					<span class="pill {data.quota.exceeded ? 'bad' : 'ok'}">
						{#if data.quota.unlimited}
							Unlimited sending
						{:else}
							{data.quota.remaining} of {data.quota.limit} left today
						{/if}
					</span>
				{/if}

				{#if data.abilities.readAnyMailbox && data.mailboxes.length}
					<select on:change={switchMailbox} aria-label="Open another mailbox">
						<option value="">My mailbox</option>
						{#each data.mailboxes as m}
							<option value={m.id} selected={m.id === data.account.id}>
								{m.label ?? m.address}
							</option>
						{/each}
					</select>
				{/if}

				<button class="btn" type="button" on:click={() => (composing = !composing)}>
					<Fa icon={faPenToSquare} /> Compose
				</button>
			</div>
		</div>

		{#if composing}
			<form class="panel form" method="POST" action="?/send" enctype="multipart/form-data">
				<div class="form-row two">
					<label class="field">
						<span>To</span>
						<input name="to" required placeholder="someone@example.com" />
					</label>
					<label class="field">
						<span>Cc</span>
						<input name="cc" placeholder="Optional" />
					</label>
				</div>
				<label class="field">
					<span>Subject</span>
					<input name="subject" required />
				</label>
				<label class="field">
					<span>Message</span>
					<textarea name="body" required rows="8" />
				</label>
				<FileDrop name="files" multiple label="Drop attachments" hint="10 MB in total">
					Attachments
				</FileDrop>
				<div class="btn-row">
					<button class="btn" type="submit" disabled={data.quota?.exceeded}>
						<Fa icon={faPaperPlane} /> Send
					</button>
					<button class="btn ghost" type="button" on:click={() => (composing = false)}>
						Cancel
					</button>
				</div>
				{#if data.quota?.exceeded}
					<p class="tiny muted">
						You have used today's {data.quota.limit} messages. The count resets at midnight UTC.
					</p>
				{/if}
			</form>
		{/if}

		{#if data.threads.length}
			<div class="threads panel pad-0">
				{#each data.threads as t (t.id)}
					<a class="thread" class:unread={t.unread_count > 0} href={threadHref(t.id)}>
						<span class="dot" aria-hidden="true" />
						<span class="subject">{t.subject || '(no subject)'}</span>
						<span class="meta">
							{#if t.message_count > 1}<span class="count">{t.message_count}</span>{/if}
							<span class="when">{relative(t.last_message_at)}</span>
						</span>
					</a>
				{/each}
			</div>
		{:else}
			<p class="empty">Nothing here.</p>
		{/if}
	{/if}
</div>

<style>
	.addresses {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
		font-size: 0.88rem;
	}

	.addresses strong {
		font-weight: 700;
		opacity: 0.7;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-right: 0.2rem;
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
	}

	.folders {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.folders::-webkit-scrollbar {
		display: none;
	}
	.folders a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.9rem;
		min-height: 44px;
		border-radius: 999px;
		border: 1px solid var(--glass-border);
		background: var(--glass);
		font-family: Inter, sans-serif;
		font-size: 0.85rem;
		text-decoration: none;
		white-space: nowrap;
	}
	.folders a.on {
		background: var(--accent-soft);
		border-color: var(--accent-line);
		color: var(--accent);
	}

	.bar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bar-right select {
		font-family: Inter, sans-serif;
		font-size: 0.85rem;
		color: var(--color-text);
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		padding: 0.5rem 0.6rem;
		min-height: 44px;
		max-width: 200px;
	}
	.bar-right select option {
		background: var(--branding-primary-dark);
	}

	.threads {
		display: flex;
		flex-direction: column;
	}

	.thread {
		display: grid;
		grid-template-columns: 10px minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		min-height: 56px;
		text-decoration: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		font-family: Inter, sans-serif;
	}
	.thread:last-child {
		border-bottom: none;
	}
	.thread:hover {
		background: rgba(255, 255, 255, 0.04);
		text-decoration: none;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: transparent;
	}
	.thread.unread .dot {
		background: var(--accent);
	}

	.subject {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.95rem;
	}
	.thread.unread .subject {
		font-weight: 700;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted);
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.count {
		background: var(--glass-strong);
		border-radius: 999px;
		padding: 0.1rem 0.45rem;
		font-size: 0.7rem;
	}

	@media (max-width: 560px) {
		.bar-right {
			width: 100%;
		}
		.bar-right .btn {
			flex: 1;
		}
		.when {
			display: none;
		}
	}
</style>
