// @ts-nocheck
import { startBusy, resetBusy } from '$lib/store.js';

/**
 * Shows the loading screen while a form is being submitted.
 *
 * None of the forms in this app use `use:enhance`, so a submit is a real
 * browser navigation: the request goes off, the page sits there, then the whole
 * document is replaced. `$navigating` never fires for that, which is why the
 * screen needs its own hook. One listener on the document covers every form.
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

	document.addEventListener('submit', onSubmit, true);
	window.addEventListener('pageshow', onPageShow);

	return () => {
		document.removeEventListener('submit', onSubmit, true);
		window.removeEventListener('pageshow', onPageShow);
	};
}
