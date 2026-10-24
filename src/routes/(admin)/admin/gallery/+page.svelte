<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faUpload,
		faTrash,
		faArrowUp,
		faArrowDown,
		faImages
	} from '@fortawesome/free-solid-svg-icons';
	import { enhance } from '$app/forms';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { isVideo } from '$lib/gallery.js';

	export let data;
	export let form;
</script>

<svelte:head><title>Gallery | CODIHA admin</title></svelte:head>

<div class="page-head">
	<h1>Gallery</h1>
	<p class="tiny muted">
		What visitors see at <a href="/gallery">/gallery</a>. Photos are grouped under a section
		heading; leave it empty for the run at the top.
	</p>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

<section class="panel upload">
	<form method="POST" action="?/upload" enctype="multipart/form-data">
		<div class="row-fields">
			<label class="field">
				<span>Section</span>
				<input
					name="section"
					list="known-sections"
					placeholder="e.g. Cybersecurity workshop"
					autocomplete="off"
				/>
				<datalist id="known-sections">
					{#each data.knownSections as s}<option value={s}></option>{/each}
				</datalist>
			</label>

			<label class="field">
				<span>Caption (optional)</span>
				<input name="caption" placeholder="Applies to everything in this upload" />
			</label>
		</div>

		<FileDrop
			name="files"
			accept="image/*,video/mp4,video/webm"
			multiple
			label="Drop photos or a clip"
			hint="Images up to 10 MB, videos up to 50 MB"
		/>

		<button class="btn" type="submit"><Fa icon={faUpload} /> Add to gallery</button>
	</form>
</section>

{#each data.sections as section (section.title)}
	<section class="stack">
		<div class="section-head">
			<h2>{section.title || 'Untitled section'}</h2>
			<span class="tiny muted">{section.items.length} items</span>
		</div>

		<div class="grid-admin">
			{#each section.items as item (item.id)}
				<div class="tile panel">
					{#if isVideo(item)}
						<!-- svelte-ignore a11y-media-has-caption -->
						<video src={item.url} preload="metadata" muted />
					{:else}
						<img src={item.url} alt={item.caption ?? ''} loading="lazy" />
					{/if}

					<form method="POST" action="?/update" class="tile-form" use:enhance>
						<input type="hidden" name="id" value={item.id} />
						<input name="caption" value={item.caption ?? ''} placeholder="Caption" />
						<input name="section" value={item.section} placeholder="Section" />
						<button class="btn sm ghost" type="submit">Save</button>
					</form>

					<div class="tile-acts">
						<form method="POST" action="?/move" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<input type="hidden" name="dir" value="up" />
							<button class="icon-btn" type="submit" title="Move earlier">
								<Fa icon={faArrowUp} />
							</button>
						</form>
						<form method="POST" action="?/move" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<input type="hidden" name="dir" value="down" />
							<button class="icon-btn" type="submit" title="Move later">
								<Fa icon={faArrowDown} />
							</button>
						</form>
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<button class="icon-btn danger" type="submit" title="Remove from gallery">
								<Fa icon={faTrash} />
							</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	</section>
{:else}
	<p class="empty"><Fa icon={faImages} /> The gallery is empty. Add the first photos above.</p>
{/each}

<style>
	.upload {
		margin-bottom: 1.4rem;
	}

	.upload form {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.row-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.row-fields .field {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.grid-admin {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
		gap: 0.7rem;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.5rem;
	}

	.tile img,
	.tile video {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 8px;
		background: var(--glass);
	}

	.tile-form {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.tile-acts {
		display: flex;
		gap: 0.3rem;
		justify-content: flex-end;
	}

	.icon-btn {
		background: none;
		border: 1px solid var(--glass-border);
		border-radius: 8px;
		padding: 0.25rem 0.45rem;
		color: var(--muted);
		cursor: var(--pointer, pointer);
	}

	.icon-btn:hover {
		color: var(--color-text);
	}

	.icon-btn.danger:hover {
		color: #e06c60;
		border-color: #e06c60;
	}
</style>
