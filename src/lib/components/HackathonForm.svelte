<script>
	// @ts-nocheck
	import TzOffset from './TzOffset.svelte';
	import { toDateTimeLocal } from '$lib/utils.js';
	import FileDrop from '$lib/components/FileDrop.svelte';

	export let hackathon = null;
	export let action = '?/create';
	export let submitLabel = 'Create hackathon';

	$: h = hackathon ?? {};
</script>

<form class="form" method="POST" {action} enctype="multipart/form-data">
	<TzOffset />
	{#if hackathon}<input type="hidden" name="id" value={hackathon.id} />{/if}

	<div class="form-row two">
		<label class="field">
			<span>Title *</span>
			<input name="title" value={h.title ?? ''} required placeholder="HACKIHA 2026" />
		</label>
		<label class="field">
			<span>Slug</span>
			<input name="slug" value={h.slug ?? ''} placeholder="auto from title" />
		</label>
	</div>

	<div class="form-row two">
		<label class="field">
			<span>Theme</span>
			<input name="theme" value={h.theme ?? ''} placeholder="AI for Algerian cities" />
		</label>
		<label class="field">
			<span>Prize pool</span>
			<input name="prize_pool" value={h.prize_pool ?? ''} placeholder="200 000 DA + goodies" />
		</label>
	</div>

	<label class="field">
		<span>Short summary</span>
		<input name="summary" value={h.summary ?? ''} placeholder="One line shown on cards" />
	</label>

	<label class="field">
		<span>Description (Markdown)</span>
		<textarea name="description" placeholder="## Tracks&#10;## Judging criteria&#10;…"
			>{h.description ?? ''}</textarea
		>
	</label>

	<div class="form-row two">
		<label class="field">
			<span>Starts *</span>
			<input type="datetime-local" name="starts_at" value={toDateTimeLocal(h.starts_at)} required />
		</label>
		<label class="field">
			<span>Ends *</span>
			<input type="datetime-local" name="ends_at" value={toDateTimeLocal(h.ends_at)} required />
		</label>
	</div>

	<div class="form-row two">
		<label class="field">
			<span>Applications open</span>
			<input type="datetime-local" name="apply_opens_at" value={toDateTimeLocal(h.apply_opens_at)} />
		</label>
		<label class="field">
			<span>Application deadline</span>
			<input type="datetime-local" name="apply_deadline" value={toDateTimeLocal(h.apply_deadline)} />
		</label>
	</div>

	<div class="form-row three">
		<label class="field">
			<span>Location</span>
			<input name="location" value={h.location ?? ''} placeholder="ESST Algiers" />
		</label>
		<label class="field">
			<span>Capacity (accepted)</span>
			<input type="number" name="capacity" value={h.capacity ?? ''} min="1" placeholder="unlimited" />
		</label>
		<label class="field">
			<span>Status</span>
			<select name="status">
				{#each ['draft', 'published', 'closed', 'cancelled', 'archived'] as s}
					<option value={s} selected={(h.status ?? 'draft') === s}>{s}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="form-row two">
		<label class="field">
			<span>Team size min</span>
			<input type="number" name="team_size_min" value={h.team_size_min ?? 1} min="1" required />
		</label>
		<label class="field">
			<span>Team size max</span>
			<input type="number" name="team_size_max" value={h.team_size_max ?? 4} min="1" required />
		</label>
	</div>

	<fieldset class="points">
		<legend>Points awarded</legend>
		<div class="form-row three">
			<label class="field">
				<span>Participation</span>
				<input type="number" name="points_participation" value={h.points_participation ?? 25} min="0" />
			</label>
			<label class="field">
				<span>1st place</span>
				<input type="number" name="points_first" value={h.points_first ?? 150} min="0" />
			</label>
			<label class="field">
				<span>2nd / 3rd</span>
				<div class="duo">
					<input type="number" name="points_second" value={h.points_second ?? 100} min="0" />
					<input type="number" name="points_third" value={h.points_third ?? 60} min="0" />
				</div>
			</label>
		</div>
	</fieldset>

	<FileDrop
		name="cover"
		accept="image/*"
		label="Drop a cover image"
		hint="PNG, JPEG or WebP, max 5 MB"
		existing={h.cover_url}
		existingLabel="Current cover"
	>
		Cover image
	</FileDrop>

	{#if h.cover_url}
		<label class="check">
			<input type="checkbox" name="remove_cover" value="1" /> Remove the current cover
		</label>
	{/if}

	<button class="btn" type="submit">{submitLabel}</button>
</form>

<style>
	fieldset.points {
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		padding: 0.75rem;
		margin: 0;
	}
	legend {
		font-family: Inter, sans-serif;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
		padding: 0 0.4rem;
	}
	.duo {
		display: flex;
		gap: 0.4rem;
	}
</style>
