<script>
	// @ts-nocheck
	import Fa from 'svelte-fa';
	import {
		faCircleCheck,
		faCircleXmark,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import { formatDate, PLACE_LABEL } from '$lib/utils.js';

	export let data;
	$: c = data.certificate;
	$: valid = !!c && !c.revoked;
</script>

<svelte:head>
	<title>{c ? `Certificate ${c.code}` : 'Certificate not found'} | CODIHA Club</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page narrow">
	<div class="panel verify" class:good={valid} class:bad={!valid}>
		<div class="icon">
			{#if valid}
				<Fa icon={faCircleCheck} />
			{:else if c?.revoked}
				<Fa icon={faTriangleExclamation} />
			{:else}
				<Fa icon={faCircleXmark} />
			{/if}
		</div>

		{#if valid}
			<span class="eyebrow">Verified by CODIHA Club</span>
			<h1>This certificate is authentic</h1>
		{:else if c?.revoked}
			<span class="eyebrow">Revoked</span>
			<h1>This certificate has been revoked</h1>
		{:else}
			<span class="eyebrow">Not found</span>
			<h1>No certificate with this ID</h1>
			<p class="muted">
				Double-check the link or scan the QR code again. ID checked:
				<code>{data.id}</code>
			</p>
		{/if}

		{#if c}
			<dl class="facts">
				<div><dt>Awarded to</dt><dd>{c.member_name}</dd></div>
				{#if c.member_university}
					<div><dt>University</dt><dd>{c.member_university}</dd></div>
				{/if}
				<div><dt>Type</dt>
					<dd>
						{c.kind === 'winner' ? 'Winner certificate' : 'Certificate of participation'}
						{#if c.place}&nbsp;· {PLACE_LABEL[c.place]}{/if}
					</dd>
				</div>
				<div><dt>For</dt><dd>{c.context_title}</dd></div>
				{#if c.context_date}
					<div><dt>Event date</dt><dd>{formatDate(c.context_date)}</dd></div>
				{/if}
				<div><dt>Issued</dt><dd>{formatDate(c.issued_at)}</dd></div>
				<div><dt>Certificate ID</dt><dd><code>{c.code}</code></dd></div>
			</dl>
		{/if}

		<div class="btn-row">
			<a class="btn ghost" href="/">CODIHA Club home</a>
			<a class="btn ghost" href="/articles/about">About the club</a>
		</div>
	</div>
</div>

<style>
	.verify {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.6rem;
		padding: 2rem 1.25rem;
	}
	.icon {
		font-size: 2.8rem;
	}
	.good .icon {
		color: var(--ok);
	}
	.bad .icon {
		color: var(--bad);
	}
	.good {
		border-color: rgba(52, 211, 153, 0.5);
	}
	h1 {
		margin: 0;
		font-size: 1.5rem;
	}
	p {
		margin: 0;
		max-width: 48ch;
	}
	code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		background: rgba(0, 0, 0, 0.3);
		padding: 2px 6px;
		border-radius: 5px;
		word-break: break-all;
	}
	.facts {
		width: 100%;
		margin: 1rem 0 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.facts > div {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: var(--radius-sm);
		padding: 0.55rem 0.75rem;
		text-align: left;
	}
	dt {
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted-2);
	}
	dd {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}
	@media (min-width: 560px) {
		.facts > div {
			flex-direction: row;
			justify-content: space-between;
			align-items: baseline;
			gap: 1rem;
		}
		dd {
			text-align: right;
		}
	}
</style>
