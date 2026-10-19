<script>
	// @ts-nocheck
	import TzOffset from './TzOffset.svelte';
	import { toDateTimeLocal } from '$lib/utils.js';
	import FileDrop from '$lib/components/FileDrop.svelte';

	export let event = null;
	export let action = '?/create';
	export let submitLabel = 'Create event';

	$: e = event ?? {};
</script>

<form class="form" method="POST" {action} enctype="multipart/form-data">
	<TzOffset />
	{#if event}<input type="hidden" name="id" value={event.id} />{/if}

	<div class="form-row two">
		<label class="field">
			<span>Title *</span>
			<input name="title" value={e.title ?? ''} required placeholder="Git & GitHub workshop" />
		</label>
		<label class="field">
			<span>Slug</span>
			<input name="slug" value={e.slug ?? ''} placeholder="auto from title" />
			<span class="hint">URL: /events/<em>slug</em></span>
		</label>
	</div>

	<label class="field">
		<span>Short summary</span>
		<input name="summary" value={e.summary ?? ''} placeholder="One line shown on cards" />
	</label>

	<label class="field">
		<span>Description (Markdown)</span>
		<textarea name="description" placeholder="## What you'll learn&#10;- …">{e.description ?? ''}</textarea>
	</label>

	<div class="form-row two">
		<label class="field">
			<span>Starts *</span>
			<input type="datetime-local" name="starts_at" value={toDateTimeLocal(e.starts_at)} required />
		</label>
		<label class="field">
			<span>Ends *</span>
			<input type="datetime-local" name="ends_at" value={toDateTimeLocal(e.ends_at)} required />
		</label>
	</div>

	<div class="form-row three">
		<label class="field">
			<span>Location</span>
			<input name="location" value={e.location ?? ''} placeholder="ESST Amphi B" />
		</label>
		<label class="field">
			<span>Capacity</span>
			<input type="number" name="capacity" value={e.capacity ?? ''} min="1" placeholder="unlimited" />
		</label>
		<label class="field">
			<span>Check-in points</span>
			<input type="number" name="checkin_points" value={e.checkin_points ?? 10} min="1" required />
		</label>
	</div>

	<div class="form-row two">
		<label class="field">
			<span>Status</span>
			<select name="status">
				{#each ['draft', 'published', 'cancelled', 'archived'] as s}
					<option value={s} selected={(e.status ?? 'draft') === s}>{s}</option>
				{/each}
			</select>
			<span class="hint">Only <em>published</em> events are visible to members.</span>
		</label>
		<FileDrop
			name="cover"
			accept="image/*"
			label="Drop a cover image"
			hint="PNG, JPEG or WebP, max 5 MB"
			existing={e.cover_url}
			existingLabel="Current cover"
		>
			Cover image
		</FileDrop>
	</div>

	{#if e.cover_url}
		<label class="check">
			<input type="checkbox" name="remove_cover" value="1" /> Remove the current cover
		</label>
	{/if}

	<button class="btn" type="submit">{submitLabel}</button>
</form>

<style>
</style>
