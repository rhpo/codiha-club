<script>
	// @ts-nocheck
	import { UNIVERSITIES, FIELDS, YEARS } from '$lib/utils.js';
	import { onDestroy } from 'svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import FileDrop from '$lib/components/FileDrop.svelte';
	import { downscaleImage, MAX_UPLOAD_BYTES } from '$lib/image.js';

	export let data;
	export let form;

	const v = (key) => form?.values?.[key] ?? data.profile?.[key] ?? '';
	$: editing = !!data.profile?.onboarded_at;
	$: hasPicture = !!(data.profile?.avatar_url || preview);

	/** Object URL for the chosen file, so the member sees it before saving. */
	let preview = null;

	const pickPicture = (files) => {
		const file = files?.[0];
		// Revoking the old one matters: each createObjectURL pins the whole file
		// in memory until it is released.
		if (preview) URL.revokeObjectURL(preview);
		preview = file ? URL.createObjectURL(file) : null;
	};

	onDestroy(() => {
		if (preview) URL.revokeObjectURL(preview);
	});
</script>

<svelte:head><title>Complete your CODIHA profile</title></svelte:head>

<div class="page narrow">
	<div class="page-head">
		<span class="eyebrow">{editing ? 'Your profile' : 'Step 2 of 2'}</span>
		<h1>{editing ? 'Edit your profile' : 'Tell us about you'}</h1>
		<p>
			{#if editing}
				Keep your details up to date. Certificates are issued with the name below.
			{:else}
				Signed in as <strong>{data.email}</strong>. A club admin reviews new members before your
				dashboard unlocks.
			{/if}
		</p>
	</div>

	{#if data.missing?.length && !form?.error}
		<div class="notice warn">
			Before you can use the site we need a few details:
			<strong>{data.missing.map((m) => m.label).join(', ')}</strong>.
		</div>
	{/if}

	{#if form?.error}<div class="notice bad">{form.error}</div>{/if}

	<form class="panel form" method="POST" enctype="multipart/form-data">
		<input type="hidden" name="next" value={data.next} />
		<div class="pfp">
			<Avatar src={preview ?? data.profile?.avatar_url} name={v('full_name')} size={84} />
			<div class="pfp-copy">
				<span class="pfp-label">Profile picture</span>
				<p class="tiny muted">
					{#if hasPicture}
						Change it any time. PNG, JPEG or WebP, up to 2 MB.
					{:else}
						You do not have one yet. Add a photo so the board and other members can put a face
						to your name. PNG, JPEG or WebP, up to 2 MB.
					{/if}
				</p>
				<FileDrop
					name="avatar"
					accept="image/*"
					label="Drop a photo"
					hint="PNG, JPEG or WebP, up to 20 MB"
					maxBytes={MAX_UPLOAD_BYTES}
					transform={downscaleImage}
					onPick={pickPicture}
				/>
			</div>
		</div>

		<label class="field">
			<span>Full name *</span>
			<input name="full_name" value={v('full_name')} placeholder="Ramy Hadid" required
				autocomplete="name" />
		</label>

		<div class="form-row two">
			<label class="field">
				<span>University *</span>
				<select name="university" required>
					<option value="" disabled selected={!v('university')}>Select…</option>
					{#each UNIVERSITIES as u}
						<option value={u} selected={v('university') === u}>{u}</option>
					{/each}
				</select>
			</label>

			<label class="field">
				<span>Field of study *</span>
				<select name="field" required>
					<option value="" disabled selected={!v('field')}>Select…</option>
					{#each FIELDS as f}
						<option value={f} selected={v('field') === f}>{f}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="form-row two">
			<label class="field">
				<span>Year *</span>
				<select name="year" required>
					<option value="" disabled selected={!v('year')}>Select…</option>
					{#each YEARS as y}
						<option value={y} selected={v('year') === y}>{y}</option>
					{/each}
				</select>
			</label>

			<label class="field">
				<span>Discord username</span>
				<input name="discord" value={v('discord')} placeholder="ramy#0001" />
			</label>
		</div>

		<div class="form-row two">
			<label class="field">
				<span>Phone (optional)</span>
				<input name="phone" value={v('phone')} placeholder="+213 ..." inputmode="tel" />
			</label>
			<label class="field">
				<span>GitHub (optional)</span>
				<input name="github" value={v('github')} placeholder="github.com/you" />
			</label>
		</div>

		<label class="field">
			<span>LinkedIn (optional)</span>
			<input name="linkedin" value={v('linkedin')} placeholder="linkedin.com/in/you" />
		</label>

		<label class="field">
			<span>Why did you join? *</span>
			<textarea
				name="bio"
				required
				minlength="10"
				placeholder="What are you building? What do you want to learn?">{v('bio')}</textarea
			>
			<span class="hint">A sentence or two is plenty.</span>
		</label>

		<button class="btn block" type="submit">
			{editing ? 'Save changes' : 'Submit for approval'}
		</button>
	</form>
</div>

<style>
	.pfp {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid var(--glass-border);
	}

	.pfp-copy {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.pfp-label {
		font-family: Inter, sans-serif;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
		font-weight: 600;
	}

	.pfp-copy p {
		margin: 0;
		line-height: 1.45;
	}

	@media (max-width: 520px) {
		.pfp {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
