<script>
	// @ts-nocheck
	import { onMount, onDestroy } from 'svelte';
	import '$lib/styles/base.css';
	import '$lib/styles/platform.css';
	import { dateRange } from '$lib/utils.js';

	export let data;

	let qrDataUrl = '';
	let checkinUrl = data.initialUrl;
	let attendance = data.attendance;
	let registered = data.registered;
	let open = data.open;
	let msLeft = data.expiresInMs;
	let errorMsg = '';
	let toDataURL = null;

	let refreshTimer;
	let tickTimer;

	async function render(url) {
		if (!url || !toDataURL) return;
		qrDataUrl = await toDataURL(url, {
			margin: 1,
			width: 1000,
			errorCorrectionLevel: 'M',
			color: { dark: '#1b2e1f', light: '#ffffff' }
		});
	}

	async function refresh() {
		try {
			const res = await fetch(`/api/checkin-token?event=${data.event.id}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = await res.json();
			open = json.open;
			attendance = json.attendance;
			registered = json.registered;
			msLeft = json.expiresInMs;
			errorMsg = '';
			if (json.url && json.url !== checkinUrl) {
				checkinUrl = json.url;
				await render(checkinUrl);
			}
			// land just after the next rotation boundary
			clearTimeout(refreshTimer);
			refreshTimer = setTimeout(refresh, Math.max(1000, json.expiresInMs + 400));
		} catch (e) {
			errorMsg = 'Lost connection, retrying…';
			clearTimeout(refreshTimer);
			refreshTimer = setTimeout(refresh, 3000);
		}
	}

	onMount(async () => {
		// qrcode ships a CJS browser build, so accept either interop shape
		const mod = await import('qrcode');
		toDataURL = mod.toDataURL ?? mod.default?.toDataURL;
		await render(checkinUrl);
		refresh();
		tickTimer = setInterval(() => {
			msLeft = Math.max(0, msLeft - 250);
		}, 250);
	});

	onDestroy(() => {
		clearTimeout(refreshTimer);
		clearInterval(tickTimer);
	});

	$: secondsLeft = Math.ceil(msLeft / 1000);
	$: progress = data.windowSeconds ? (msLeft / (data.windowSeconds * 1000)) * 100 : 0;
</script>

<svelte:head>
	<title>Check-in | {data.event.title}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="stage">
	<header>
		<div>
			<span class="eyebrow">CODIHA Club · live check-in</span>
			<h1>{data.event.title}</h1>
			<p class="tiny muted">{dateRange(data.event.starts_at, data.event.ends_at)}</p>
		</div>
		<div class="counters">
			<div><strong>{attendance}</strong><span>present</span></div>
			<div><strong>{registered}</strong><span>registered</span></div>
			<div><strong>+{data.event.checkin_points}</strong><span>points each</span></div>
		</div>
	</header>

	{#if open}
		<div class="qr-card">
			{#if qrDataUrl}
				<img src={qrDataUrl} alt="Check-in QR code" />
			{:else}
				<div class="qr-skeleton">Generating QR…</div>
			{/if}
			<div class="rotate">
				<div class="bar"><div style="width: {progress}%" /></div>
				<span>New code in {secondsLeft}s</span>
			</div>
		</div>

		<ol class="steps">
			<li>Open your phone camera and scan the code</li>
			<li>Sign in with Google or Discord if asked</li>
			<li>You're marked present and the points land instantly</li>
		</ol>

		{#if errorMsg}<p class="warn-line">{errorMsg}</p>{/if}
	{:else}
		<div class="closed">
			<h2>Check-in is closed</h2>
			<p class="muted">
				The QR code only works from one hour before the event until one hour after it ends.
			</p>
			<a class="btn ghost" href="/admin/events/{data.event.id}">Back to the event</a>
		</div>
	{/if}

	<footer class="tiny muted">
		club.codiha.com · each code is signed and expires every {data.windowSeconds} seconds
	</footer>
</div>

<style>
	.stage {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
		text-align: center;
	}

	header {
		width: 100%;
		max-width: 1100px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	h1 {
		margin: 0.15rem 0;
		font-size: 1.6rem;
		line-height: 1.1;
	}

	p {
		margin: 0;
	}

	.counters {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.counters div {
		background: var(--glass);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-sm);
		padding: 0.5rem 0.9rem;
		display: flex;
		flex-direction: column;
		min-width: 90px;
	}

	.counters strong {
		font-family: Cubano, sans-serif;
		font-size: 1.5rem;
		line-height: 1;
	}

	.counters span {
		font-family: Inter, sans-serif;
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.qr-card {
		background: #fff;
		border-radius: 20px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
	}

	.qr-card img,
	.qr-skeleton {
		width: min(78vw, 46vh, 520px);
		height: min(78vw, 46vh, 520px);
		display: block;
		border-radius: 10px;
	}

	.qr-skeleton {
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f1f5f9;
		color: #64748b;
		font-family: Inter, sans-serif;
		font-size: 0.9rem;
	}

	.rotate {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.rotate span {
		font-family: Inter, sans-serif;
		font-size: 0.72rem;
		color: #475569;
	}

	.bar {
		height: 6px;
		border-radius: 999px;
		background: #e2e8f0;
		overflow: hidden;
	}

	.bar div {
		height: 100%;
		background: linear-gradient(90deg, var(--accent), var(--gold));
		transition: width 0.25s linear;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding-left: 1.2rem;
		text-align: left;
		font-family: Inter, sans-serif;
		font-size: 0.9rem;
		opacity: 0.85;
		max-width: 520px;
	}

	.warn-line {
		font-family: Inter, sans-serif;
		font-size: 0.8rem;
		color: var(--warn);
	}

	.closed {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem;
		background: var(--glass);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius);
		max-width: 480px;
	}

	.closed h2 {
		font-family: Cubano, sans-serif;
		margin: 0;
		font-size: 1.4rem;
	}

	footer {
		font-family: Inter, sans-serif;
	}

	@media (min-width: 900px) {
		header {
			flex-direction: row;
			justify-content: space-between;
			text-align: left;
		}
		h1 {
			font-size: 2.4rem;
		}
		.steps {
			flex-direction: row;
			gap: 1.5rem;
			list-style-position: inside;
			padding: 0;
			max-width: none;
		}
	}
</style>
