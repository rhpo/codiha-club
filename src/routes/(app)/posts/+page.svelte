<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faPenToSquare, faImages } from '@fortawesome/free-solid-svg-icons';
	import PostCard from '$lib/components/PostCard.svelte';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { downscaleImage } from '$lib/image.js';
	import { POST_IMAGE_MAX_BYTES } from '$lib/posts.js';

	export let data;
	export let form;

	let body = '';
	let picked = 0;

	$: tooMany = picked > data.imageLimit;

	const onPick = (files) => {
		picked = files?.length ?? 0;
	};
</script>

<svelte:head>
	<title>Member feed | CODIHA Club</title>
	<meta name="description" content="What CODIHA members are building." />
</svelte:head>

<div class="page narrow">
	<div class="page-head">
		<span class="eyebrow">The feed</span>
		<h1>What we're building</h1>
		<p>
			Share a project, a win, something you learned. Members only, so you are posting to people
			who will actually read it.
		</p>
	</div>

	{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
	{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

	{#if data.canPost}
		<form class="panel composer" method="POST" action="?/create" enctype="multipart/form-data">
			<label class="field">
				<span><Fa icon={faPenToSquare} /> Say something</span>
				<textarea
					name="body"
					bind:value={body}
					rows="4"
					maxlength="4000"
					placeholder="I finally shipped the thing. Here is what it does…"
					required
				/>
			</label>

			<FileDrop
				name="images"
				accept="image/*"
				multiple
				label="Add images"
				hint="Up to {data.imageLimit} images, {POST_IMAGE_MAX_BYTES / 1024 / 1024} MB each"
				maxBytes={POST_IMAGE_MAX_BYTES}
				transform={downscaleImage}
				{onPick}
			/>

			{#if tooMany}
				<p class="notice bad tiny">
					That is {picked} images. Please pick at most {data.imageLimit}.
				</p>
			{/if}

			<button class="btn block" type="submit" disabled={!body.trim() || tooMany}>
				Post it
			</button>
		</form>
	{:else}
		<div class="notice warn">
			<strong>Add a photo of yourself first.</strong>
			The feed shows who wrote what, so posting needs a verified profile picture.
			<a href="/photo?change=1&next=/posts">Take one now</a>.
		</div>
	{/if}

	{#if data.posts.length}
		<div class="feed">
			{#each data.posts as post (post.id)}
				<PostCard {post} canDelete={post.author_id === data.me || data.isAdmin} />
			{/each}
		</div>

		{#if data.posts.length >= data.take}
			<a class="btn ghost block" href="/posts?take={data.take + 20}">Show older posts</a>
		{/if}
	{:else}
		<p class="empty"><Fa icon={faImages} /> Nothing posted yet. Be the first.</p>
	{/if}
</div>

<style>
	.composer {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		margin-bottom: 1.2rem;
	}

	.feed {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
