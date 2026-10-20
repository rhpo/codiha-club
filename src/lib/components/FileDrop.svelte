<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faCloudArrowUp, faXmark, faFile, faImage } from '@fortawesome/free-solid-svg-icons';
	import { onDestroy } from 'svelte';

	/** Form field name. The real <input type="file"> keeps it, so plain form posts work. */
	export let name;
	export let accept = '';
	export let multiple = false;
	export let label = 'Drop a file here';
	export let hint = '';
	/**
	 * Something already stored on the server: a cover URL, an avatar, a filename.
	 * Shown dimmed so it is clearly the current value, not a pending upload.
	 */
	export let existing = null;
	export let existingLabel = 'Current file';
	/** Fires with the chosen File list whenever the selection changes. */
	export let onPick = null;
	/** Hard ceiling per file. Anything larger is refused without uploading. */
	export let maxBytes = 0;
	/**
	 * Applied to each file before it is stored, e.g. downscaling a photo. It
	 * runs inside the component so the transformed file is what the form posts.
	 * @type {null | ((file: File) => Promise<File> | File)}
	 */
	export let transform = null;

	let input;
	let over = false;
	let rejected = '';
	/** @type {{name: string, size: number, url: string|null}[]} */
	let picked = [];

	const isImage = (f) => f && typeof f.type === 'string' && f.type.startsWith('image/');
	const looksLikeImage = (s) =>
		typeof s === 'string' && /\.(png|jpe?g|webp|avif|gif)(\?|$)/i.test(s);

	const readable = (bytes) =>
		bytes >= 1024 * 1024
			? (bytes / 1024 / 1024).toFixed(1) + ' MB'
			: Math.ceil(bytes / 1024) + ' KB';

	/** Object URLs pin the whole file in memory until released. */
	const releasePreviews = () => {
		for (const p of picked) if (p.url) URL.revokeObjectURL(p.url);
	};

	/** Drops the selection and tells the parent nothing is chosen. */
	function reset() {
		releasePreviews();
		picked = [];
		if (input) input.value = '';
		onPick?.([]);
	}

	/** Renders the chosen files and notifies the parent. */
	function show(files) {
		releasePreviews();
		picked = [...files].map((f) => ({
			name: f.name,
			size: f.size,
			url: isImage(f) ? URL.createObjectURL(f) : null
		}));
		onPick?.(files);
	}

	async function accept_(files) {
		rejected = '';
		let list = [...files];
		if (!list.length) return reset();

		if (maxBytes) {
			const over = list.find((f) => f.size > maxBytes);
			if (over) {
				// Refused before any transform or upload: a huge file should not
				// cost the member a long wait just to be told no.
				rejected = over.name + ' is ' + readable(over.size) + '. The limit is ' + readable(maxBytes) + '.';
				reset();
				return;
			}
		}

		if (transform) {
			list = await Promise.all(list.map((f) => transform(f)));
			// Write them back, or the form would still post the originals.
			const dt = new DataTransfer();
			for (const f of list) dt.items.add(f);
			input.files = dt.files;
		}

		show(list);
	}

	const onChange = (e) => accept_(e.target.files ?? []);

	function onDrop(e) {
		e.preventDefault();
		over = false;
		const files = e.dataTransfer?.files;
		if (!files?.length) return;
		// Assigning to .files is what makes a dropped file part of the form
		// submission; without it the drop is purely cosmetic.
		const dt = new DataTransfer();
		for (const f of multiple ? files : [files[0]]) dt.items.add(f);
		input.files = dt.files;
		accept_(input.files);
	}

	/**
	 * Put a file into the real input from outside the component, so a photo
	 * taken with the camera submits through the same form as a dropped one.
	 * Reached with bind:this.
	 * @param {File[] | FileList} incoming
	 */
	export function setFiles(incoming) {
		const dt = new DataTransfer();
		for (const f of incoming) dt.items.add(f);
		input.files = dt.files;
		accept_(input.files);
	}
	function clear() {
		rejected = '';
		reset();
	}

	onDestroy(releasePreviews);
</script>

<div class="field">
	{#if $$slots.default}<span><slot /></span>{/if}

	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="drop"
		class:over
		on:dragover|preventDefault={() => (over = true)}
		on:dragleave={() => (over = false)}
		on:drop={onDrop}
	>
		<!-- The real input stays in the DOM and keeps the name, so the form posts
		     normally with no JavaScript involved in the submit path. It is hidden
		     visually but still reachable by keyboard through the label. -->
		<input
			bind:this={input}
			class="native"
			type="file"
			{name}
			{accept}
			{multiple}
			on:change={onChange}
		/>

		<button class="face" type="button" on:click={() => input.click()}>
			<Fa icon={faCloudArrowUp} />
			<span class="face-text">
				<strong>{label}</strong>
				<span class="tiny muted">or click to browse{hint ? ` · ${hint}` : ''}</span>
			</span>
		</button>

		{#if rejected}
			<p class="rejected">{rejected}</p>
		{/if}

		{#if picked.length}
			<ul class="files">
				{#each picked as f (f.name + f.size)}
					<li>
						{#if f.url}
							<img src={f.url} alt="" />
						{:else}
							<span class="ico"><Fa icon={faFile} /></span>
						{/if}
						<span class="meta">
							<span class="fname">{f.name}</span>
							<span class="tiny muted">{readable(f.size)}</span>
						</span>
					</li>
				{/each}
			</ul>
			<button class="clear" type="button" on:click={clear}>
				<Fa icon={faXmark} /> Remove
			</button>
		{:else if existing}
			<!-- Dimmed: this is what is stored now, and it stays unless a new file
			     is chosen. -->
			<div class="existing">
				{#if looksLikeImage(existing)}
					<img src={existing} alt="" />
				{:else}
					<span class="ico"><Fa icon={faImage} /></span>
				{/if}
				<span class="meta">
					<span class="tiny muted">{existingLabel}</span>
					<span class="tiny muted">Choosing a file replaces it.</span>
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.drop {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.9rem;
		border: 1px dashed var(--glass-border);
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.18);
		transition: border-color 0.15s, background 0.15s;
	}

	.drop.over {
		border-color: var(--accent);
		border-style: solid;
		background: var(--accent-soft);
	}

	/* Kept in the layout for keyboard focus, but never visible. display:none
	   would drop it from the form in some browsers. */
	.native {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.face {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		padding: 0.5rem;
		background: none;
		border: 0;
		color: var(--color-text);
		text-align: left;
		cursor: pointer;
		font-family: Inter, sans-serif;
		min-height: 52px;
	}

	.face :global(svg) {
		font-size: 1.4rem;
		color: var(--accent);
		flex: 0 0 auto;
	}

	.face-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.face-text strong {
		font-size: 0.92rem;
		font-weight: 700;
	}

	.files {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.files li,
	.existing {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem;
		border-radius: var(--radius-sm);
		background: var(--glass);
		border: 1px solid var(--glass-border);
		font-family: Inter, sans-serif;
		min-width: 0;
	}

	.existing {
		opacity: 0.55;
	}

	.files img,
	.existing img {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		object-fit: cover;
		flex: 0 0 auto;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: var(--glass-strong);
		flex: 0 0 auto;
	}

	.meta {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.fname {
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.clear {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: 0;
		color: var(--muted);
		font-family: Inter, sans-serif;
		font-size: 0.8rem;
		cursor: pointer;
		padding: 0.25rem;
		min-height: 36px;
	}

	.clear:hover {
		color: var(--bad);
	}

	.rejected {
		margin: 0;
		font-family: Inter, sans-serif;
		font-size: 0.82rem;
		color: var(--bad);
	}
</style>
