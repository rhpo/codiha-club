import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],

  ssr: {
    /*
     * face-api is browser-only: $lib/face.js imports it dynamically, and the
     * photo page imports $lib/face.js dynamically in turn, so it never runs
     * on the server.
     *
     * Vite still walks that dynamic import when building for SSR, which drags
     * ~1.5 MB of model-runner into the server bundle for nothing. Worse, on
     * Netlify the bare specifier resolves to dist/face-api.node.js, which
     * requires @tensorflow/tfjs-node - a native module that is not installed.
     * Bundling that broke the function at load time, which is a 502 on EVERY
     * route, not just the page that uses it.
     *
     * Keeping it external means the server bundle just carries an import that
     * is never reached. netlify.toml lists it under external_node_modules for
     * the same reason.
     */
    external: ["@vladmandic/face-api", "@tensorflow/tfjs-node"],
  },
});
