/**
 * Regenerates src/lib/assets/logo-mark.{png,ts} from static/logo.png.
 *
 * The certificate PDF is built inside the Netlify function, which has no
 * access to static/, and Vite only inlines `?inline` imports at build time -
 * in dev it hands back a URL instead, so an asset import would work in
 * production and 500 locally. Committing the bytes as source sidesteps both.
 *
 * Run with: npm run logo:mark
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SIZE = 256;
const SRC = "static/logo.png";
const PNG = "src/lib/assets/logo-mark.png";
const TS = "src/lib/assets/logo-mark.ts";

execFileSync(
  "npx",
  [
    "--yes",
    "sharp-cli@5",
    "--input",
    SRC,
    "--output",
    PNG,
    "resize",
    String(SIZE),
    String(SIZE),
    "--fit",
    "contain",
    "--background",
    "#00000000",
  ],
  { stdio: "inherit" }
);

const b64 = readFileSync(PNG).toString("base64");

writeFileSync(
  TS,
  [
    "// GENERATED FILE - do not edit by hand.",
    "//",
    `// The CODIHA mark (${SRC}) at ${SIZE}px, base64 so it can be embedded in`,
    "// certificate PDFs. It lives in source rather than being imported as an asset",
    "// because the PDF is rendered inside the Netlify function, which cannot read",
    "// static/, and Vite only honours ?inline at build time - so an asset import",
    "// works in production and breaks in dev.",
    "//",
    "// Regenerate with: npm run logo:mark",
    "",
    `export default ${JSON.stringify(b64)};`,
    "",
  ].join("\n")
);

console.log(`Wrote ${PNG} and ${TS} (${b64.length} base64 chars).`);
