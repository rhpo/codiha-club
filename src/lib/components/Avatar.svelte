<script>
	// @ts-nocheck
	import { initials } from '$lib/utils.js';

	export let src = null;
	export let name = '';
	export let size = 36;
</script>

{#if src}
	<img class="avatar" {src} alt={name} style="width:{size}px;height:{size}px" />
{:else}
	<span
		class="avatar avatar-fallback"
		style="width:{size}px;height:{size}px;font-size:{Math.round(size * 0.36)}px"
		aria-hidden="true">{initials(name)}</span
	>
{/if}
