<script>
	// @ts-nocheck
	import { onMount, onDestroy } from 'svelte';
	import Fa from 'svelte-fa';
	import { faCamera, faCircleCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
	import Avatar from '$lib/components/Avatar.svelte';
	import FileDrop from '$lib/components/FileDrop.svelte';
	// NOT a static import: $lib/face.js pulls in @vladmandic/face-api, which is
	// browser-only. A static import puts that module in the SSR bundle, and a
	// module that throws while the serverless function loads 502s every route on
	// the site, not just this page. Imported lazily, it never reaches the server.
	let face = null;

	export let data;
	export let form;

	let preview = null;
	let checking = false;
	/** null = nothing chosen yet, true/false = detector verdict */
	let faceOk = null;
	let message = '';

	// Fetch the detector while the member is still reading the page, so the
	// check feels instant when they drop a photo.
	onMount(async () => {
		face = await import('$lib/face.js');
		face.warmUp();
	});

	async function onPick(files) {
		const file = files?.[0];
		if (preview) URL.revokeObjectURL(preview);
		preview = file ? URL.createObjectURL(file) : null;
		faceOk = null;
		message = '';
		if (!file) return;

		checking = true;
		// onMount may not have resolved yet if a file is dropped immediately.
		face ??= await import('$lib/face.js');
		const result = await face.detectFace(file);
		checking = false;
		faceOk = result.ok;
		message = result.ok
			? ''
			: (face.FACE_MESSAGES[result.reason] ?? 'That photo could not be used.');
	}

	onDestroy(() => {
		if (preview) URL.revokeObjectURL(preview);
	});
</script>

<svelte:head><title>Add your photo | CODIHA Club</title></svelte:head>

<div class="page narrow">
	<div class="page-head center-head">
		<span class="eyebrow">One last thing</span>
		<h1>Add your photo</h1>
		<p>
			CODIHA runs on people knowing each other. Upload a clear photo of your face so members
			and the board can recognise you at events.
		</p>
	</div>

	{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
	{#if form?.success}<div class="notice warn">{form.success}</div>{/if}

	<form class="panel form" method="POST" enctype="multipart/form-data">
		<input type="hidden" name="next" value={data.next} />
		<!-- Read by the server only to set a flag an admin can review. -->
		<input type="hidden" name="face_detected" value={faceOk ? '1' : '0'} />

		<div class="shot">
			<Avatar src={preview ?? data.profile.avatar_url} name={data.profile.full_name} size={120} />
			{#if checking}
				<span class="badge checking"><Fa icon={faSpinner} spin /> Checking…</span>
			{:else if faceOk === true}
				<span class="badge ok"><Fa icon={faCircleCheck} /> Face detected</span>
			{/if}
		</div>

		<FileDrop
			name="avatar"
			accept="image/*"
			label="Drop a photo of your face"
			hint="PNG, JPEG or WebP, max 2 MB"
			{onPick}
		/>

		{#if message}
			<div class="notice bad">{message}</div>
		{/if}

		<button class="btn lg block" type="submit" disabled={checking || faceOk === null}>
			<Fa icon={faCamera} />
			{faceOk === false ? 'Save anyway for review' : 'Save and continue'}
		</button>

		<p class="tiny muted foot">
			The check runs in your browser; the photo is only uploaded when you press save.
		</p>
	</form>
</div>

<style>
	.center-head {
		align-items: center;
		text-align: center;
	}
	.center-head h1 {
		text-align: center;
	}

	.shot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: Inter, sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
	}

	.badge.ok {
		background: rgba(52, 211, 153, 0.18);
		border: 1px solid rgba(52, 211, 153, 0.5);
		color: #bbf7d0;
	}

	.badge.checking {
		background: var(--glass);
		border: 1px solid var(--glass-border);
		color: var(--muted);
	}

	.foot {
		margin: 0;
		text-align: center;
	}
</style>
