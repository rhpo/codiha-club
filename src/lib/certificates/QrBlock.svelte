<!--
	The verification QR, drawn as vector squares on a white card.

	Deliberately the pure-JS core of qrcode rather than the package root: the
	root re-exports qrcode/lib/server, which pulls in `fs`. The core only
	computes the module matrix, which is all a vector QR needs, and it runs
	in the browser as happily as on the server.
-->
<script>
  // @ts-nocheck
  import { create as createQr } from "qrcode/lib/core/qrcode.js";

  export let value;
  export let x;
  export let y;
  export let size = 104;
  export let font = "Helvetica, Arial, sans-serif";
  /** White margin around the code, which scanners need to find its edges. */
  export let quiet = 8;

  const DARK = "#1b2e1f";

  /* Coerced on the way in. An attribute written y="437" arrives as the
	   string "437", and `y + row * cell` would then concatenate rather than
	   add, scattering every module off the page. */
  $: left = Number(x);
  $: top = Number(y);
  $: box = Number(size);
  $: pad = Number(quiet);

  $: matrix = createQr(value || "https://club.codiha.com", {
    errorCorrectionLevel: "M",
  }).modules;
  $: cell = box / matrix.size;

  $: squares = (() => {
    const out = [];
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) {
        if (matrix.get(row, col))
          out.push({ x: left + col * cell, y: top + row * cell });
      }
    }
    return out;
  })();
</script>

<rect
  x={left - pad}
  y={top - pad}
  width={box + pad * 2}
  height={box + pad * 2}
  fill="#ffffff"
/>

{#each squares as s}
  <!-- A hair of bleed, so neighbouring modules do not show seams in viewers
	     that antialias each rectangle edge independently. -->
  <rect x={s.x} y={s.y} width={cell + 0.15} height={cell + 0.15} fill={DARK} />
{/each}

<text
  x={left + box / 2}
  y={top + box + pad + 12}
  text-anchor="middle"
  font-family={font}
  font-size="8"
  fill="#b3c0b6">Scan to verify</text
>
