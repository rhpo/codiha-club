import netlify from "@sveltejs/adapter-netlify";
import cloudflare from "@sveltejs/adapter-cloudflare";
import preprocess from "svelte-preprocess";
import { importAssets } from "svelte-preprocess-import-assets";

/*
 * The site is deployed to Netlify (club.codiha.com) and to Cloudflare Pages.
 * Each platform wants a different build output, so the adapter is chosen from
 * the environment rather than hard-coded: hard-coding one means the other
 * platform's next auto-deploy ships a build it cannot serve.
 *
 * CF_PAGES is set by Cloudflare Pages' build image. Picking it up here rather
 * than using adapter-auto keeps the adapter versions pinned in package.json
 * and avoids a network install partway through the build.
 *
 * Both run on serverless functions rather than the edge, because certificates
 * are rendered with pdf-lib on the server. Cloudflare additionally needs the
 * nodejs_compat flag for Buffer - see wrangler.toml. Check-in tokens use Web
 * Crypto rather than node:crypto so they work on both runtimes unchanged.
 */
const adapter = process.env.CF_PAGES ? cloudflare : netlify;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    appDir: "build",
    prerender: {
      handleHttpError: ({ path, message }) => {
        // Don't fail the build on dead links in prerendered marketing pages.
        console.warn(`Prerender HTTP error: ${message} (${path})`);
      },
    },
  },

  preprocess: [preprocess([importAssets()])],
};

export default config;
