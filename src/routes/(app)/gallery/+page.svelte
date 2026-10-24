<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faImages, faXmark } from '@fortawesome/free-solid-svg-icons';
	import { isVideo } from '$lib/gallery.js';

	export let data;

	/** The item shown full size, or null. */
	let viewing = null;
</script>

<svelte:head>
	<title>Gallery | CODIHA Club</title>
	<meta
		name="description"
		content="Photos and highlights from CODIHA Club events, workshops and projects."
	/>
</svelte:head>

<div class="page">
	<div class="page-head" data-aos="fade-down">
		<span class="eyebrow">Moments</span>
		<h1>Gallery</h1>
		<p>Photos and highlights from our events, workshops and collaborative projects.</p>
	</div>

	{#each data.sections as section (section.title)}
		<section class="stack">
			{#if section.title}
				<div class="section-head"><h2>{section.title}</h2></div>
			{/if}

			<div class="grid-shots">
				{#each section.items as item (item.id)}
					{#if isVideo(item)}
						<!-- svelte-ignore a11y-media-has-caption -->
						<video class="shot" src={item.url} controls preload="metadata" />
					{:else}
						<button class="shot-btn" type="button" on:click={() => (viewing = item)}>
							<img class="shot" src={item.url} alt={item.caption ?? ''} loading="lazy" />
							{#if item.caption}<span class="cap tiny">{item.caption}</span>{/if}
						</button>
					{/if}
				{/each}
			</div>
		</section>
	{:else}
		<p class="empty"><Fa icon={faImages} /> No photos yet.</p>
	{/each}
</div>

{#if viewing}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="lightbox" on:click={() => (viewing = null)}>
		<button class="close" type="button" aria-label="Close"><Fa icon={faXmark} /></button>
		<img src={viewing.url} alt={viewing.caption ?? ''} />
		{#if viewing.caption}<p class="tiny">{viewing.caption}</p>{/if}
	</div>
{/if}

<style>
	.grid-shots {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.7rem;
	}

	.shot {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 12px;
		display: block;
		background: var(--glass);
	}

	.shot-btn {
		position: relative;
		padding: 0;
		border: 0;
		background: none;
		cursor: var(--pointer, pointer);
		display: block;
	}

	.cap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.4rem 0.6rem;
		text-align: left;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
		border-radius: 0 0 12px 12px;
		color: #fff;
	}

	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 2rem 1rem;
		background: rgba(0, 0, 0, 0.82);
		backdrop-filter: blur(4px);
		cursor: var(--pointer, pointer);
	}

	.lightbox img {
		max-width: min(1100px, 100%);
		max-height: 80vh;
		object-fit: contain;
		border-radius: 10px;
	}

	.close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		background: none;
		border: 0;
		color: #fff;
		font-size: 1.3rem;
		cursor: var(--pointer, pointer);
	}
</style>
