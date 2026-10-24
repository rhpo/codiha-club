<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faArrowLeft, faReply, faTrash } from '@fortawesome/free-solid-svg-icons';
	import { enhance } from '$app/forms';
	import PostCard from '$lib/components/PostCard.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { relative } from '$lib/utils.js';
	import { COMMENT_BODY_MAX } from '$lib/posts.js';

	export let data;
	export let form;

	/** Which comment the reply box is currently open under. */
	let replyTo = null;

	const canRemove = (c) => c.author_id === data.me || data.post.author_id === data.me;
</script>

<svelte:head>
	<title>{data.post.author_name}'s post | CODIHA Club</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page narrow">
	<a class="back tiny muted" href="/posts"><Fa icon={faArrowLeft} /> Back to the feed</a>

	{#if form?.error}<div class="notice bad">{form.error}</div>{/if}

	<PostCard post={data.post} canDelete={false} full />

	<section class="comments">
		<h2 class="tiny-head">
			{data.post.comment_count}
			{Number(data.post.comment_count) === 1 ? 'comment' : 'comments'}
		</h2>

		{#if data.canComment}
			<form class="panel comment-form" method="POST" action="?/comment" use:enhance>
				<input type="hidden" name="parent_id" value="" />
				<textarea
					name="body"
					rows="2"
					maxlength={COMMENT_BODY_MAX}
					placeholder="Add a comment…"
					required
				/>
				<button class="btn sm" type="submit">Comment</button>
			</form>
		{:else}
			<p class="notice warn tiny">
				Add a verified photo of yourself before commenting.
				<a href="/photo?change=1&next=/posts/{data.post.id}">Take one</a>.
			</p>
		{/if}

		{#each data.comments as c (c.id)}
			<div class="thread">
				<div class="comment">
					<Avatar src={c.profiles?.avatar_url} name={c.profiles?.full_name} size={32} />
					<div class="c-body">
						<div class="c-head">
							<strong>{c.profiles?.full_name}</strong>
							<span class="tiny muted">{relative(c.created_at)}</span>
						</div>
						<p>{c.body}</p>
						<div class="c-acts">
							{#if data.canComment}
								<button
									class="link-btn tiny"
									type="button"
									on:click={() => (replyTo = replyTo === c.id ? null : c.id)}
								>
									<Fa icon={faReply} /> Reply
								</button>
							{/if}
							{#if canRemove(c)}
								<form method="POST" action="?/removeComment" use:enhance>
									<input type="hidden" name="comment_id" value={c.id} />
									<button class="link-btn tiny" type="submit"><Fa icon={faTrash} /> Delete</button>
								</form>
							{/if}
						</div>
					</div>
				</div>

				<!-- One indent only. A reply to a reply is stored against this same
				     comment by the database, so it lands here rather than nesting. -->
				{#each c.replies as r (r.id)}
					<div class="comment reply">
						<Avatar src={r.profiles?.avatar_url} name={r.profiles?.full_name} size={28} />
						<div class="c-body">
							<div class="c-head">
								<strong>{r.profiles?.full_name}</strong>
								<span class="tiny muted">{relative(r.created_at)}</span>
							</div>
							<p>{r.body}</p>
							{#if canRemove(r)}
								<div class="c-acts">
									<form method="POST" action="?/removeComment" use:enhance>
										<input type="hidden" name="comment_id" value={r.id} />
										<button class="link-btn tiny" type="submit">
											<Fa icon={faTrash} /> Delete
										</button>
									</form>
								</div>
							{/if}
						</div>
					</div>
				{/each}

				{#if replyTo === c.id}
					<form class="comment-form reply-form" method="POST" action="?/comment" use:enhance>
						<input type="hidden" name="parent_id" value={c.id} />
						<textarea
							name="body"
							rows="2"
							maxlength={COMMENT_BODY_MAX}
							placeholder="Reply to {c.profiles?.full_name}…"
							required
						/>
						<button class="btn sm" type="submit">Reply</button>
					</form>
				{/if}
			</div>
		{:else}
			<p class="empty">No comments yet.</p>
		{/each}
	</section>
</div>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.8rem;
		text-decoration: none;
	}

	.comments {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-top: 1.2rem;
	}

	.tiny-head {
		font-size: 0.95rem;
		margin: 0;
	}

	.comment-form {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.comment-form textarea {
		flex: 1;
		min-width: 0;
	}

	.thread {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.comment {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
	}

	/* The single indent. Nothing nests further than this. */
	.reply {
		margin-left: 2.2rem;
		padding-left: 0.7rem;
		border-left: 2px solid var(--glass-border);
	}

	.reply-form {
		margin-left: 2.2rem;
	}

	.c-body {
		flex: 1;
		min-width: 0;
	}

	.c-head {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
	}

	.c-body p {
		margin: 0.15rem 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.c-acts {
		display: flex;
		gap: 0.7rem;
		margin-top: 0.25rem;
	}

	.link-btn {
		background: none;
		border: 0;
		padding: 0;
		color: var(--muted);
		cursor: var(--pointer, pointer);
		font-family: Inter, sans-serif;
	}

	.link-btn:hover {
		color: var(--accent);
	}
</style>
