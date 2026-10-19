// @ts-nocheck
import { notify } from '$lib/store.js';

/**
 * A few actions return a short token instead of a sentence, because the page
 * branches on it (`{#if form?.success === 'waitlist'}`). The token stays the
 * return value; this is only how it reads in the modal.
 */
const TOKENS = {
	registered: "You're registered. See you there.",
	waitlist: "That event is full, so you've been put on the waitlist.",
	cancelled: 'Your registration has been cancelled.',
	applied: 'Application sent. You will get an email once the board decides.',
	withdrawn: 'Your application has been withdrawn.'
};

/**
 * Pops the shared modal for a SvelteKit action result. Wired once per layout
 * against `$page.form`, so every form in the app reports back the same way
 * without each page having to do anything.
 *
 * Returns the result it handled so the caller can track what it already showed.
 */
export function reportFormResult(result) {
	if (!result) return result;

	if (result.error) {
		notify(result.error, 'bad');
	} else if (result.success) {
		const text = TOKENS[result.success] ?? result.success;
		notify(text, 'ok');
	}

	return result;
}
