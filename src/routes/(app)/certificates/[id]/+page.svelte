<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import { faDownload, faCircleCheck } from '@fortawesome/free-solid-svg-icons';
	import { designFor, certificateFileName } from '$lib/certificates/index.js';

	export let data;

	$: cert = data.certificate;
	$: Design = designFor(cert.kind);

	/** The <svg> the design renders, handed to the PDF converter as-is. */
	let holder;
	let busy = false;
	let failure = null;

	const download = async () => {
		const svg = holder?.querySelector('svg');
		if (!svg) return;
		busy = true;
		failure = null;
		try {
			const { downloadCertificatePdf } = await import('$lib/certificates/pdf.js');
			await downloadCertificatePdf(svg, certificateFileName(cert));
		} catch (e) {
			failure = e?.message ?? 'The PDF could not be generated.';
		} finally {
			busy = false;
		}
	};
</script>

<svelte:head>
	<title>{cert.memberName} · CODIHA Club certificate</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page narrow">
	<div class="page-head">
		<span class="eyebrow"><Fa icon={faCircleCheck} /> Verified certificate</span>
		<h1>{cert.memberName}</h1>
		<p>Certificate {cert.code}. Anyone can confirm it is genuine by scanning the code on it.</p>
	</div>

	{#if failure}<div class="notice bad">{failure}</div>{/if}

	<div class="sheet" bind:this={holder}>
		<svelte:component this={Design} data={cert} />
	</div>

	<div class="btn-row">
		<button class="btn" on:click={download} disabled={busy}>
			<Fa icon={faDownload} />
			{busy ? 'Preparing…' : 'Download PDF'}
		</button>
		<a class="btn ghost" href="/verify/{cert.id}">Verification page</a>
	</div>
</div>

<style>
	.sheet {
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--glass-border);
		line-height: 0;
	}

	/* The component renders at its true A4-landscape point size; this scales
	   it to whatever width is going, without touching the PDF geometry. */
	.sheet :global(svg) {
		width: 100%;
		height: auto;
		display: block;
	}

	.btn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1rem;
	}
</style>
