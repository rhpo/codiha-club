<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faPalette, faRotateLeft, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
	import { derive, normalizeHex } from '$lib/theme';
	import { formatDateTime } from '$lib/utils.js';

	export let data;
	export let form;

	// Seeded from the saved palette, then edited locally so the preview is live.
	let primary = data.theme.primary;
	let accent = data.theme.accent;
	let text = data.theme.text;

	const PRESETS = [
		{ name: 'CODIHA green', primary: '#294230', accent: '#fa9200', text: '#ffffff' },
		{ name: 'Midnight', primary: '#1e293b', accent: '#38bdf8', text: '#f8fafc' },
		{ name: 'Plum', primary: '#3b2140', accent: '#f472b6', text: '#fdf4ff' },
		{ name: 'Terracotta', primary: '#3b2a24', accent: '#f59e0b', text: '#fffbeb' },
		{ name: 'Deep sea', primary: '#13343b', accent: '#2dd4bf', text: '#ecfeff' },
		{ name: 'Ink & lime', primary: '#22262b', accent: '#a3e635', text: '#f7fee7' }
	];

	// normalizeHex guards against a browser handing back something odd; derive()
	// then produces exactly the shades the live site will use.
	$: safePrimary = normalizeHex(primary) ?? data.theme.primary;
	$: safeAccent = normalizeHex(accent) ?? data.theme.accent;
	$: safeText = normalizeHex(text) ?? data.theme.text;
	$: shades = derive({ primary: safePrimary, accent: safeAccent, text: safeText });

	// WCAG wants 4.5 for body text. Warn rather than block: a club might want a
	// look that a checker dislikes, but they should know before they ship it.
	$: lowContrast = shades.textContrast < 4.5;

	$: dirty =
		safePrimary !== data.theme.primary ||
		safeAccent !== data.theme.accent ||
		safeText !== data.theme.text;

	const apply = (preset) => {
		primary = preset.primary;
		accent = preset.accent;
		text = preset.text;
	};

	const swatches = (s) => [
		{ label: 'Gradient top', value: s.light },
		{ label: 'Primary', value: s.primary },
		{ label: 'Gradient bottom', value: s.dark },
		{ label: 'Deepest', value: s.deeper },
		{ label: 'Accent', value: s.accent },
		{ label: 'Text', value: s.text },
		{ label: 'On accent', value: s.onAccent }
	];
</script>

<svelte:head><title>Appearance | CODIHA Admin</title></svelte:head>

<div class="head">
	<div>
		<h1><Fa icon={faPalette} /> Appearance</h1>
		<p class="tiny muted">
			Three colours drive the whole site. Every other shade, the background gradient, the
			translucent nav, the glass panels, the muted copy, is derived from them.
			{#if data.updatedAt}<br />Last changed {formatDateTime(data.updatedAt)}.{/if}
		</p>
	</div>
</div>

{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
{#if form?.success}<div class="notice ok">{form.success}</div>{/if}

<div class="split">
	<form class="panel form" method="POST" action="?/save">
		<div class="form-row two">
			<label class="field color-field">
				<span>Primary (brand)</span>
				<div class="color-input">
					<input type="color" bind:value={primary} aria-label="Primary colour picker" />
					<input type="text" name="primary" bind:value={primary} spellcheck="false" />
				</div>
				<span class="hint">Background gradient, nav, menus, footer.</span>
			</label>

			<label class="field color-field">
				<span>Accent (call to action)</span>
				<div class="color-input">
					<input type="color" bind:value={accent} aria-label="Accent colour picker" />
					<input type="text" name="accent" bind:value={accent} spellcheck="false" />
				</div>
				<span class="hint">Buttons, links, active tabs, highlights.</span>
			</label>
		</div>

		<label class="field color-field">
			<span>Text</span>
			<div class="color-input">
				<input type="color" bind:value={text} aria-label="Text colour picker" />
				<input type="text" name="text" bind:value={text} spellcheck="false" />
			</div>
			<span class="hint">
				Body copy, headings, and the tint behind every glass panel and border.
			</span>
		</label>

		{#if lowContrast}
			<div class="notice warn">
				Text on the background scores {shades.textContrast}:1. WCAG asks for 4.5:1 or better for
				body copy, so this will be hard to read. You can still save it.
			</div>
		{/if}

		<div class="field">
			<span>Derived shades</span>
			<div class="swatches">
				{#each swatches(shades) as sw}
					<div class="swatch">
						<i style="background:{sw.value}" />
						<b class="tiny">{sw.label}</b>
						<code class="tiny muted">{sw.value}</code>
					</div>
				{/each}
			</div>
		</div>

		<div class="field">
			<span>Presets</span>
			<div class="presets">
				{#each PRESETS as preset}
					<button type="button" class="preset" on:click={() => apply(preset)}>
						<i style="background:linear-gradient(135deg,{preset.primary} 40%,{preset.accent})" />
						{preset.name}
					</button>
				{/each}
			</div>
		</div>

		<div class="btn-row">
			<button class="btn" type="submit" disabled={!dirty}>
				<Fa icon={faFloppyDisk} /> Save palette
			</button>
			<button class="btn ghost" type="submit" formaction="?/reset">
				<Fa icon={faRotateLeft} /> Reset to default
			</button>
		</div>
	</form>

	<div class="panel preview" style="--p-light:{shades.light};--p-dark:{shades.dark};--p-accent:{shades.accent};--p-on-accent:{shades.onAccent};--p-text:{shades.text};--p-text-rgb:{shades.textRgb};">
		<h3>Live preview</h3>
		<div class="frame">
			<div class="frame-nav">
				<strong>CODIHA</strong>
				<span class="frame-link">Events</span>
				<span class="frame-link on">Leaderboard</span>
				<span class="frame-cta">Join the club</span>
			</div>
			<div class="frame-body">
				<span class="frame-eyebrow">Live standings</span>
				<h4>Leaderboard</h4>
				<div class="frame-card">
					<span class="frame-rank">1</span>
					<div>
						<b>Amina B.</b>
						<small>ESST Algiers</small>
					</div>
					<span class="frame-pts">420 <img class="frame-coin" src="/codiha-coin.png" alt="" /></span>
				</div>
				<span class="frame-btn">Register for the event</span>
			</div>
		</div>
		<p class="tiny muted">
			Saving applies the palette for every visitor on their next page load.
		</p>
	</div>
</div>

<style>
	.head h1 {
		font-size: 1.5rem;
		text-align: left;
		margin: 0 0 0.3rem;
	}
	.head p {
		margin: 0;
		font-family: Inter, sans-serif;
		line-height: 1.5;
	}

	.split {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		align-items: start;
	}

	@media (min-width: 1000px) {
		.split {
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		}
	}

	.color-input {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.color-input input[type='color'] {
		width: 56px;
		min-width: 56px;
		height: 44px;
		padding: 2px;
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--glass-border);
		cursor: pointer;
	}

	.color-input input[type='text'] {
		font-family: var(--font-mono);
		text-transform: lowercase;
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
		gap: 0.5rem;
	}

	.swatch {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-family: Inter, sans-serif;
	}

	.swatch i {
		display: block;
		height: 38px;
		border-radius: 8px;
		border: 1px solid var(--glass-border);
	}

	.swatch code {
		font-family: var(--font-mono);
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.preset {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.75rem;
		min-height: 40px;
		border-radius: 999px;
		border: 1px solid var(--glass-border);
		background: var(--glass);
		color: #fff;
		font-family: Inter, sans-serif;
		font-size: 0.82rem;
		cursor: pointer;
	}

	.preset:hover {
		border-color: var(--glass-border-strong);
	}

	.preset i {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: block;
	}

	/* ---- preview ------------------------------------------------------- */

	.preview h3 {
		margin: 0 0 0.75rem;
		font-family: Cubano, sans-serif;
	}

	.frame {
		color: var(--p-text);
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid var(--glass-border);
		background: linear-gradient(176deg, var(--p-light) 45%, var(--p-dark) 100%);
		margin-bottom: 0.6rem;
	}

	.frame-nav {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.75rem;
		background: rgba(0, 0, 0, 0.22);
		border-bottom: 1px solid rgba(var(--p-text-rgb), 0.22);
		font-family: Inter, sans-serif;
		font-size: 0.72rem;
		flex-wrap: wrap;
	}

	.frame-nav strong {
		font-family: Cubano, sans-serif;
		font-size: 0.95rem;
	}

	.frame-link {
		opacity: 0.8;
	}
	.frame-link.on {
		color: var(--p-accent);
		opacity: 1;
		font-weight: 700;
	}

	.frame-cta {
		margin-left: auto;
		background: var(--p-accent);
		color: var(--p-on-accent);
		border-radius: 8px;
		padding: 0.35rem 0.7rem;
		font-weight: 700;
	}

	.frame-body {
		padding: 1rem 0.9rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		font-family: Inter, sans-serif;
	}

	.frame-eyebrow {
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--p-accent);
		font-weight: 700;
	}

	.frame-body h4 {
		margin: 0;
		font-family: Cubano, sans-serif;
		font-size: 1.4rem;
	}

	.frame-card {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.7rem;
		border-radius: 10px;
		background: rgba(var(--p-text-rgb), 0.1);
		border: 1px solid rgba(var(--p-text-rgb), 0.22);
		font-size: 0.78rem;
	}

	.frame-card small {
		display: block;
		opacity: 0.7;
		font-size: 0.68rem;
	}

	.frame-rank {
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--p-accent);
		color: var(--p-on-accent);
		font-weight: 800;
		font-size: 0.72rem;
		flex: 0 0 auto;
	}

	.frame-coin {
		width: 0.9em;
		height: 0.9em;
		object-fit: contain;
		vertical-align: -0.15em;
	}

	.frame-pts {
		margin-left: auto;
		font-weight: 700;
		color: var(--p-accent);
	}

	.frame-btn {
		align-self: flex-start;
		background: var(--p-accent);
		color: var(--p-on-accent);
		border-radius: 10px;
		padding: 0.7rem 1.2rem;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.preview > p {
		margin: 0;
	}
</style>
