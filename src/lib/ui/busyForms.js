// @ts-nocheck
import { startBusy, resetBusy } from '$lib/store.js';

/**
 * Shows the loading screen while a form is being submitted.
 *
 * A plain form submit is a real browser navigation: the request goes off, the
 * page sits there, then the whole document is replaced. `$navigating` never
 * fires for that, which is why the screen needs its own hook. One listener on
 * the document covers every form.
 *
 * A form using `use:enhance` is the opposite: it handles itself and the
 * document never unloads, so nothing would ever take the screen back down.
 * Those are skipped - see the phase note below.
 *
 * Call once, from a layout's onMount. Returns a teardown function.
 */
export function trackFormSubmissions() {
	const onSubmit = (event) => {
		const form = event.target;
		if (!(form instanceof HTMLFormElement)) return;
		// A form the page handles itself never unloads the document, so the
		// screen would be left up with nothing to dismiss it.
		if (event.defaultPrevented) return;
		if (form.hasAttribute('data-no-loader')) return;
		startBusy();
	};

	// Coming back via the bfcache shows a page that was mid-submit with the
	// screen still up, so clear it on restore.
	const onPageShow = () => resetBusy();

	// Bubble, not capture. use:enhance calls preventDefault in its own
	// listener on the form, which the bubble phase reaches first - so by the
	// time this runs, defaultPrevented tells the truth. In the capture phase
	// it is still false for every form, and an enhanced submit raised a
	// loading screen that nothing would ever clear.
	document.addEventListener('submit', onSubmit);
	window.addEventListener('pageshow', onPageShow);

	return () => {
		document.removeEventListener('submit', onSubmit);
		window.removeEventListener('pageshow', onPageShow);
	};
}
