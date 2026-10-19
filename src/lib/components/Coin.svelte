<script>
	// @ts-nocheck
	/**
	 * The CODIHA coin, used everywhere a points total is shown instead of
	 * writing "pts".
	 *
	 * It sits inline with the number, so the size follows the surrounding text
	 * by default rather than being fixed: a coin next to a 1.8rem stat should be
	 * bigger than one in a 0.72rem pill.
	 */

	/** Any CSS length. Defaults to the current font size. */
	export let size = '1em';
	/** Shown as the amount when rendering a bare coin with no number beside it. */
	export let alt = 'CODIHA coins';
</script>

<img
	class="coin"
	src="/codiha-coin.png"
	{alt}
	width="500"
	height="500"
	loading="lazy"
	decoding="async"
	style="--coin-size: {size}"
/>

<style>
	.coin {
		width: var(--coin-size);
		height: var(--coin-size);
		object-fit: contain;
		display: inline-block;
		/* Nudges the coin onto the text baseline; without it the image sits on
		   the baseline and looks like it is falling off the line. */
		vertical-align: -0.15em;
		flex: 0 0 auto;
	}
</style>
