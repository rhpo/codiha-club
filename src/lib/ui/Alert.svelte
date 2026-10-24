<script>
	// @ts-nocheck
	import { blur } from 'svelte/transition';
	import { browser } from '$app/environment';
	import Fa from 'svelte-fa';

	export let title = 'Alert';
	export let message = 'This is an alert message.';
	export let onClose = () => {};
	export let isOpen = false;
	export let icon = null;
	/** 'ok' | 'bad' | 'warn' | 'info' - drives the accent stripe and icon colour. */
	export let variant = 'info';

	let previouslyOpen = false;
	$: {
		if (previouslyOpen && !isOpen) onClose?.();
		previouslyOpen = isOpen;
	}

	const close = () => (isOpen = false);

	// Escape closes it, like every other dialog on the web.
	const onKeydown = (e) => {
		if (e.key === 'Escape' && isOpen) close();
	};

	$: if (browser) {
		document.body.style.overflow = isOpen ? 'hidden' : 'auto';
		document.body.style.overflowX = 'hidden';
	}
</script>

<svelte:window on:keydown={onKeydown} />

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay" transition:blur on:click|self={close}>
		<div class="alert {variant}" role="alertdialog" aria-modal="true" aria-label={title}>
			<div class="alert-header">
				<h3>
					{#if icon}<span class="ico"><Fa {icon} /></span>{/if}
					{title || 'Alert'}
				</h3>
				<button class="x" type="button" on:click={close} aria-label="Close">&times;</button>
			</div>

			<div class="alert-body">
				<p>{message || ''}</p>
			</div>

			<div class="alert-footer">
				<button class="ok-btn" type="button" on:click={close}>Got it</button>
				<slot />
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 1rem;
		background-color: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(5px);
		z-index: 999999;
	}

	.alert {
		max-width: 480px;
		width: 100%;
		background-color: #fff;
		/* A light card on a dark site: say so once here and every child
		   inherits it, instead of each one overriding the page's colour. */
		color: #111827;
		border-radius: 16px;
		border-top: 5px solid var(--accent);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.75rem;
		box-shadow: 0 20px 45px -12px rgba(0, 0, 0, 0.45);
		font-family: 'Inter', sans-serif;
	}

	.alert.ok {
		border-top-color: #16a34a;
	}
	.alert.bad {
		border-top-color: #dc2626;
	}
	.alert.warn {
		border-top-color: #d97706;
	}

	.alert-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	h3,
	p {
		margin: 0;
	}

	h3 {
		font-weight: 700;
		font-size: 1.1rem;
		color: #111827;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		line-height: 1.3;
	}

	.ico {
		display: inline-flex;
		color: var(--accent);
	}
	.ok .ico {
		color: #16a34a;
	}
	.bad .ico {
		color: #dc2626;
	}
	.warn .ico {
		color: #d97706;
	}

	p {
		color: #4b5563;
		font-size: 0.95rem;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}

	.x {
		background: none;
		border: 0;
		font-size: 1.6rem;
		line-height: 1;
		color: #9ca3af;
		padding: 0 0.25rem;
		cursor: pointer;
	}

	.x:hover {
		color: #111827;
	}

	.alert-footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		justify-content: flex-end;
	}

	.ok-btn {
		font-family: 'Inter', sans-serif;
		font-size: 0.95rem;
		font-weight: 700;
		padding: 0.7rem 1.4rem;
		min-height: 46px;
		border-radius: 10px;
		border: 0;
		background: var(--accent);
		color: var(--on-accent);
		cursor: pointer;
	}

	.ok-btn:hover {
		filter: brightness(1.07);
	}

	@media (max-width: 520px) {
		.alert {
			padding: 1.35rem;
		}
		.ok-btn {
			width: 100%;
		}
	}
</style>
