import adapter from '@sveltejs/adapter-netlify';
import preprocess from 'svelte-preprocess';
import { importAssets } from 'svelte-preprocess-import-assets';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Netlify Functions (not edge) — the member platform needs node:crypto
		// for the HMAC check-in tokens and pdf-lib for certificates.
		adapter: adapter(),
		appDir: 'build',
		prerender: {
			handleHttpError: ({ path, message }) => {
				// Don't fail the build on dead links in prerendered marketing pages.
				console.warn(`Prerender HTTP error: ${message} (${path})`);
			}
		}
	},

	preprocess: [preprocess([importAssets()])]
};

export default config;
