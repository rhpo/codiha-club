<script>
	// @ts-nocheck
	import { fade } from 'svelte/transition';

	export let active = false;
	export let label = 'Loading';
</script>

{#if active}
	<div class="loading" transition:fade={{ duration: 160 }} role="status" aria-live="polite">
		<div class="mark">
			<span class="ring" />
			<img src="/logo.png" alt="" width="64" height="64" />
		</div>
		<span class="label">{label}</span>
	</div>
{/if}

<style>
	.loading {
		position: fixed;
		inset: 0;
		z-index: 99999;

		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.1rem;

		backdrop-filter: blur(14px);
		background: rgba(var(--brand-dark-rgb), 0.45);
	}

	.mark {
		position: relative;
		width: 104px;
		height: 104px;
		display: grid;
		place-items: center;
	}

	.mark img {
		width: 64px;
		height: 64px;
		object-fit: contain;
		animation: spin 1.6s linear infinite;
	}

	/* The ring runs slightly slower and the other way, so the two never look
	   like one rigid object. */
	.ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 3px solid var(--glass-border);
		border-top-color: var(--accent);
		animation: spin 1.1s linear infinite reverse;
	}

	.label {
		font-family: Inter, sans-serif;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--muted);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* A spinning logo is exactly the thing that makes motion-sensitive people
	   ill, so leave a static mark and the pulsing ring instead. */
	@media (prefers-reduced-motion: reduce) {
		.mark img {
			animation: none;
		}
		.ring {
			animation: pulse 1.4s ease-in-out infinite;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
	}
</style>
