<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faArrowLeft,
		faPaperPlane,
		faBoxArchive,
		faPaperclip,
		faEye
	} from '@fortawesome/free-solid-svg-icons';
	import { formatDateTime } from '$lib/utils.js';
	import { page } from '$app/stores';
	import FileDrop from '$lib/components/FileDrop.svelte';

	export let data;

	const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

	$: backHref = $page.url.searchParams.get('as')
		? `/mail?as=${$page.url.searchParams.get('as')}`
		: '/mail';

	// Reply goes to whoever sent the last inbound message, falling back to the
	// last recipient when the conversation only has outbound mail so far.
	$: last = data.messages[data.messages.length - 1];
	$: replyTo =
		last?.direction === 'in' ? last.from_email : (last?.to_emails ?? []).join(', ');
</script>

<svelte:head><title>{data.thread.subject || 'Conversation'} | CODIHA Club</title></svelte:head>

<div class="page narrow">
	<a class="back" href={backHref}><Fa icon={faArrowLeft} /> Back to mail</a>

	<div class="page-head">
		<h1>{data.thread.subject || '(no subject)'}</h1>
		<p>{data.messages.length} message{data.messages.length === 1 ? '' : 's'}</p>
	</div>

	{#if data.impersonating}
		<div class="notice warn">
			<Fa icon={faEye} /> Viewing
			<strong>{data.account.label ?? data.account.address}</strong>'s mailbox. Read only: you
			cannot reply or archive from here, and nothing is marked as read on their side.
		</div>
	{/if}

	<div class="stack">
		{#each data.messages as m (m.id)}
			<article class="panel msg" class:out={m.direction === 'out'}>
				<header>
					<div class="from">
						<strong>{m.from_name || m.from_email || 'Unknown'}</strong>
						{#if m.direction === 'out'}<span class="pill accent tiny">Sent</span>{/if}
						{#if m.is_spam}<span class="pill bad tiny">Spam</span>{/if}
					</div>
					<time class="tiny muted">{formatDateTime(m.sent_at)}</time>
				</header>

				<p class="tiny muted recipients">To {(m.to_emails ?? []).join(', ') || '-'}</p>

				<div class="body">
					{#if m.text_body}
						{m.text_body}
					{:else if m.html_body}
						<!-- Inbound HTML is arbitrary remote content, so it is never
						     injected into the page. The sandboxed frame keeps any script
						     or tracker inside it away from the member's session. -->
						<iframe
							title="Message content"
							sandbox=""
							srcdoc={m.html_body}
							class="html-body"
						/>
					{:else}
						<span class="muted">(empty message)</span>
					{/if}
				</div>

				{#if m.mail_attachments?.length}
					<div class="attachments">
						{#each m.mail_attachments as a (a.id)}
							<a class="attachment" href="/mail/attachment/{a.id}">
								<Fa icon={faPaperclip} />
								<span class="name">{a.name}</span>
								<span class="tiny muted">{kb(a.size_bytes)}</span>
							</a>
						{/each}
					</div>
				{/if}
			</article>
		{/each}
	</div>

	{#if !data.impersonating}
		<form class="panel form" method="POST" action="?/reply" enctype="multipart/form-data">
			<h3>Reply</h3>
			<label class="field">
				<span>To</span>
				<input name="to" value={replyTo} required />
			</label>
			<label class="field">
				<span>Message</span>
				<textarea name="body" rows="6" required />
			</label>
			<FileDrop name="files" multiple label="Drop attachments" hint="10 MB in total">
				Attachments
			</FileDrop>
			<div class="btn-row">
				<button class="btn" type="submit" disabled={data.quota?.exceeded}>
					<Fa icon={faPaperPlane} /> Send reply
				</button>
				<button class="btn ghost" type="submit" formaction="?/archive">
					<Fa icon={faBoxArchive} />
					{data.thread.archived_at ? 'Move to inbox' : 'Archive'}
				</button>
			</div>
			{#if data.quota?.exceeded}
				<p class="tiny muted">
					Daily limit of {data.quota.limit} reached. It resets at midnight UTC.
				</p>
			{/if}
		</form>
	{/if}
</div>

<style>
	.back {
		font-family: Inter, sans-serif;
		font-size: 0.85rem;
		color: var(--accent);
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		align-self: flex-start;
		min-height: 44px;
	}

	.msg {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.msg.out {
		border-color: var(--accent-line);
		background: var(--accent-soft);
	}

	.msg header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.from {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		min-width: 0;
	}
	.from strong {
		overflow-wrap: anywhere;
	}

	.recipients {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.body {
		font-family: Inter, sans-serif;
		font-size: 0.95rem;
		line-height: 1.6;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.html-body {
		width: 100%;
		min-height: 260px;
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		background: #fff;
	}

	.attachments {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.attachment {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.5rem 0.75rem;
		min-height: 44px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--glass-border);
		background: var(--glass);
		font-family: Inter, sans-serif;
		font-size: 0.82rem;
		text-decoration: none;
		max-width: 100%;
	}
	.attachment .name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 180px;
	}

	.form h3 {
		margin: 0;
		font-family: Cubano, sans-serif;
		font-size: 1.1rem;
	}
</style>
