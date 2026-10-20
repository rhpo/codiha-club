<script>
	// @ts-nocheck
	import { onMount, onDestroy, tick } from "svelte";
	import Fa from "svelte-fa";
	import {
		faCamera,
		faCircleCheck,
		faSpinner,
		faFaceSmile,
		faVideo,
		faXmark,
	} from "@fortawesome/free-solid-svg-icons";
	import Avatar from "$lib/components/Avatar.svelte";
	import FileDrop from "$lib/components/FileDrop.svelte";
	import { downscaleImage, MAX_UPLOAD_BYTES } from "$lib/image.js";
	// NOT a static import: $lib/face.js pulls in @vladmandic/face-api, which is
	// browser-only. A static import puts that module in the SSR bundle, and a
	// module that throws while the serverless function loads 502s every route on
	// the site, not just this page. Imported lazily, it never reaches the server.
	let face = null;

	export let data;
	export let form;

	let preview = null;
	let checking = false;

	/** bind:this on FileDrop, so a captured frame lands in the same input. */
	let dropper;
	let video;
	let stream = null;
	let cameraError = "";
	$: cameraOpen = !!stream;
	/** null = nothing chosen yet, true/false = detector verdict */
	let faceOk = null;
	let message = "";

	// Fetch the detector while the member is still reading the page, so the
	// check feels instant when they drop a photo.
	onMount(async () => {
		face = await import("$lib/face.js");
		face.warmUp();
	});

	async function onPick(files) {
		const file = files?.[0];
		if (preview) URL.revokeObjectURL(preview);
		preview = file ? URL.createObjectURL(file) : null;
		faceOk = null;
		message = "";
		if (!file) return;

		checking = true;
		// onMount may not have resolved yet if a file is dropped immediately.
		face ??= await import("$lib/face.js");
		const result = await face.detectFace(file);
		checking = false;
		faceOk = result.ok;
		message = result.ok
			? ""
			: face.FACE_MESSAGES[result.reason] ??
			  "That photo could not be used.";
	}

	async function openCamera() {
		cameraError = "";
		try {
			// facingMode is a hint, not a guarantee: a laptop has one camera and
			// the browser simply ignores it.
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "user",
					width: { ideal: 1280 },
					height: { ideal: 1280 },
				},
				audio: false,
			});
			// The <video> only exists once cameraOpen flips, so wait for it.
			await tick();
			if (video) {
				video.srcObject = stream;
				await video.play();
			}
		} catch (e) {
			stream = null;
			cameraError =
				e?.name === "NotAllowedError"
					? "Camera permission was refused. Allow it in your browser, or upload a file instead."
					: "No camera available here. Upload a photo instead.";
		}
	}

	function closeCamera() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
	}

	async function capture() {
		const w = video?.videoWidth;
		const h = video?.videoHeight;
		if (!w || !h) return;

		// Square crop from the centre: the avatar is round, so a 16:9 frame
		// would lose the top of the head and the chin anyway.
		const side = Math.min(w, h);
		const canvas = document.createElement("canvas");
		canvas.width = side;
		canvas.height = side;
		canvas
			.getContext("2d")
			.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);

		const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
		if (!blob) return;

		closeCamera();
		// Routed through FileDrop so the capture posts through the same input as
		// a chosen file, and onPick runs the face check on it either way.
		dropper?.setFiles([new File([blob], "camera.jpg", { type: "image/jpeg" })]);
	}

	onDestroy(() => {
		if (preview) URL.revokeObjectURL(preview);
		closeCamera();
	});
</script>

<svelte:head><title>Add your photo | CODIHA Club</title></svelte:head>

<div class="page narrow">
	<div class="page-head center-head">
		<span class="grin" aria-hidden="true"><Fa icon={faFaceSmile} /></span>
		<span class="eyebrow">Say cheese</span>
		<h1>Take a photo!</h1>
		<p>
			CODIHA runs on people knowing each other. A real photo means members
			recognise you at events instead of squinting at a username.
		</p>
	</div>

	{#if form?.error}<div class="notice bad">{form.error}</div>{/if}
	{#if form?.success}<div class="notice warn">{form.success}</div>{/if}

	<form class="panel form" method="POST" enctype="multipart/form-data">
		<input type="hidden" name="next" value={data.next} />
		<!-- Read by the server only to set a flag an admin can review. -->
		<input type="hidden" name="face_detected" value={faceOk ? "1" : "0"} />

		<div class="shot">
			<Avatar
				src={preview ?? data.profile.avatar_url}
				name={data.profile.full_name}
				size={120}
			/>
			{#if checking}
				<span class="badge checking"
					><Fa icon={faSpinner} spin /> Looking for a face…</span
				>
			{:else if faceOk === true}
				<span class="badge ok"
					><Fa icon={faCircleCheck} /> That's you. Nice one.</span
				>
			{:else if faceOk === null}
				<span class="badge idle"
					><Fa icon={faFaceSmile} /> Waiting for a photo</span
				>
			{/if}
		</div>

		{#if cameraOpen}
			<div class="cam">
				<!-- svelte-ignore a11y-media-has-caption -->
				<video bind:this={video} playsinline muted />
				<div class="btn-row">
					<button class="btn" type="button" on:click={capture}>
						<Fa icon={faCamera} /> Take the photo
					</button>
					<button class="btn ghost" type="button" on:click={closeCamera}>
						<Fa icon={faXmark} /> Cancel
					</button>
				</div>
			</div>
		{:else}
			<FileDrop
				bind:this={dropper}
				name="avatar"
				accept="image/*"
				label="Drop a photo of your face"
				hint="PNG, JPEG or WebP, up to 20 MB"
				maxBytes={MAX_UPLOAD_BYTES}
				transform={downscaleImage}
				{onPick}
			/>

			<button class="btn ghost block" type="button" on:click={openCamera}>
				<Fa icon={faVideo} /> Use my camera instead
			</button>
		{/if}

		{#if cameraError}
			<div class="notice warn">{cameraError}</div>
		{/if}

		{#if message}
			<div class="notice bad">{message}</div>
		{/if}

		<button
			class="btn lg block"
			type="submit"
			disabled={checking || faceOk === null}
		>
			<Fa icon={faCamera} />
			{faceOk === false ? "Save anyway for review" : "Save and continue"}
		</button>

		<p class="tiny muted foot">
			The check runs in your browser; the photo is only uploaded when you
			press save.
		</p>
	</form>
</div>

<style>
	.center-head {
		align-items: center;
		text-align: center;
	}

	/* A big friendly glyph: this is a gate, so it should not also look stern. */
	.grin {
		font-size: 3rem;
		line-height: 1;
		color: var(--accent);
		display: block;
		margin-bottom: 0.25rem;
		animation: peek 3.5s ease-in-out infinite;
	}

	@keyframes peek {
		0%,
		88%,
		100% {
			transform: rotate(0deg);
		}
		92% {
			transform: rotate(-9deg);
		}
		96% {
			transform: rotate(9deg);
		}
	}

	/* The wink is decoration, and a looping tilt is exactly the sort of motion
	   that makes some people queasy. */
	@media (prefers-reduced-motion: reduce) {
		.grin {
			animation: none;
		}
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

	.badge.checking,
	.badge.idle {
		background: var(--glass);
		border: 1px solid var(--glass-border);
		color: var(--muted);
	}

	.cam {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cam video {
		width: 100%;
		max-width: 420px;
		aspect-ratio: 1;
		object-fit: cover;
		align-self: center;
		border-radius: var(--radius);
		border: 1px solid var(--glass-border);
		background: #000;
		/* An unmirrored selfie view feels wrong to everybody. */
		transform: scaleX(-1);
	}

	.foot {
		margin: 0;
		text-align: center;
	}
</style>
