<!--
	The shared chrome every certificate sits in: page, border, header band,
	logo, recipient block, signature, ID and verification QR.

	A design file supplies the heading and whatever belongs in the middle via
	the default slot, so adding a new certificate means writing ~25 lines
	rather than re-deriving the whole layout. See ./README.md.

	It renders an <svg> rather than HTML on purpose: the downloadable PDF is
	produced by converting this exact element, so what is on screen is what
	downloads. All coordinates are top-down, as SVG means them.
-->
<script>
  // @ts-nocheck
  import QrBlock from "./QrBlock.svelte";
  import logoBase64 from "$lib/assets/logo-mark";

  /** Big line under the wordmark, e.g. "CERTIFICATE OF MEMBERSHIP". */
  export let heading;
  /** Italic lead-in above the name. */
  export let intro = "This certificate is proudly awarded to";
  export let name;
  export let university = null;
  export let code;
  export let issuedAt;
  export let verifyUrl;
  /** The winner design overrides this to colour the frame by podium place. */
  export let accent = "#fa9200";
  /** Small line directly under the heading, e.g. "FIRST PLACE". */
  export let eyebrow = null;

  const W = 842;
  const H = 595;

  /* The two lines of wordmark, and the mark that has to line up with them. */
  const TITLE_SIZE = 30;
  const TITLE_BASELINE = 72;
  const SUB_SIZE = 10;
  const SUB_BASELINE = 96;
  const LOGO_SIZE = 62;
  /* One left edge shared by the mark, the signature block and the ID lines,
     so the certificate reads as a single vertical rule rather than three. */
  const CONTENT_X = 90;

  /*
   * Centred on the wordmark beside it, not on the band: the band has more
   * clearance above the type than below, so centring on the band leaves the
   * mark sitting visibly high.
   *
   * These are cap height and descender depth, not the full em box, because
   * the eye centres on ink rather than on line boxes. Measured against the
   * rasterised header: 0.72 em puts the top at 50.4 against 50.3 of real
   * Cubano ink, and 0.21 em puts the bottom at 98.1 against 97.7. Using the
   * em box instead includes the leading and sits the mark ~4pt high.
   */
  const WORDMARK_TOP = TITLE_BASELINE - TITLE_SIZE * 0.72;
  const WORDMARK_BOTTOM = SUB_BASELINE + SUB_SIZE * 0.21;
  const LOGO_Y = (WORDMARK_TOP + WORDMARK_BOTTOM) / 2 - LOGO_SIZE / 2;

  const DARK = "#1b2e1f";
  const MID = "#3d6448";
  const FAINT = "#d1dbd4";

  /* Cubano is caps-only, so a name set in it would lose its real casing.
	   Headings are Cubano; everything that carries information is not. */
  const BODY = "Helvetica, Arial, sans-serif";
  const DISPLAY = "CubanoCert, Helvetica, Arial, sans-serif";

  /* Inlined rather than referenced by URL: svg2pdf has to have the bytes to
	   embed, and a <image href="/logo.png"> would be an unresolved fetch at
	   conversion time. */
  const LOGO = `data:image/png;base64,${logoBase64}`;

  const fmtDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

  /* Shrink-to-fit, approximated from the average glyph width of a bold sans.
	   Exact measurement needs the font metrics; being a little generous is
	   cheaper than the name overrunning the rule beneath it. */
  $: nameSize = Math.max(
    16,
    Math.min(
      40,
      Math.floor((W - 200) / (0.58 * Math.max(1, (name || " ").length)))
    )
  );
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 {W} {H}"
  width={W}
  height={H}
  class="cert"
  role="img"
  aria-label="{heading} for {name}"
>
  <rect x="0" y="0" width={W} height={H} fill={DARK} />
  <rect x="0" y="0" width={W} height="120" fill={MID} />
  <rect
    x="24"
    y="24"
    width={W - 48}
    height={H - 48}
    fill="none"
    stroke={accent}
    stroke-width="2"
  />
  <rect x="24" y="24" width="8" height={H - 48} fill={accent} />

  <image
    href={LOGO}
    x={CONTENT_X}
    y={LOGO_Y}
    width={LOGO_SIZE}
    height={LOGO_SIZE}
  />

  <text
    x={W / 2}
    y={TITLE_BASELINE}
    class="display"
    text-anchor="middle"
    font-family={DISPLAY}
    font-size={TITLE_SIZE}
    fill="#ffffff">CODIHA CLUB</text
  >
  <text
    x={W / 2}
    y={SUB_BASELINE}
    text-anchor="middle"
    font-family={BODY}
    font-size={SUB_SIZE}
    fill="#d9e6dd">Inter-university IT Club · ESST Algiers</text
  >

  <text
    x={W / 2}
    y="175"
    class="display"
    text-anchor="middle"
    font-family={DISPLAY}
    font-size="24"
    fill={accent}>{heading}</text
  >

  {#if eyebrow}
    <text
      x={W / 2}
      y="202"
      class="display"
      text-anchor="middle"
      font-family={DISPLAY}
      font-size="13"
      fill="#ffffff">{eyebrow}</text
    >
  {/if}

  <text
    x={W / 2}
    y="245"
    text-anchor="middle"
    font-family={BODY}
    font-style="italic"
    font-size="11"
    fill="#d1e0d6">{intro}</text
  >

  <text
    x={W / 2}
    y="296"
    text-anchor="middle"
    font-family={BODY}
    font-weight="bold"
    font-size={nameSize}
    fill="#ffffff">{name || "CODIHA Member"}</text
  >
  <rect x="150" y="312" width={W - 300} height="1" fill={accent} />

  {#if university}
    <text
      x={W / 2}
      y="330"
      text-anchor="middle"
      font-family={BODY}
      font-size="10"
      fill={FAINT}>{university}</text
    >
  {/if}

  <!-- Whatever makes this certificate the kind of certificate it is. -->
  <slot {W} body={BODY} display={DISPLAY} faint={FAINT} />

  <rect x={CONTENT_X} y="485" width="190" height="1" fill="#b3c7b9" />
  <text
    x={CONTENT_X}
    y="503"
    font-family={BODY}
    font-weight="bold"
    font-size="10"
    fill="#ffffff">CODIHA Club Board</text
  >
  <text x={CONTENT_X} y="517" font-family={BODY} font-size="8" fill="#bfcfc4"
    >ESST Algiers</text
  >
  <text x={CONTENT_X} y="541" font-family={BODY} font-size="8" fill="#b3c0b6"
    >Certificate ID: {code}</text
  >
  <text x={CONTENT_X} y="553" font-family={BODY} font-size="8" fill="#b3c0b6"
    >Issued: {fmtDate(issuedAt)}</text
  >

  <QrBlock value={verifyUrl} x={W - 202} y={429} size={104} font={BODY} />
</svg>

<style>
  /*
	 * Self-hosted rather than pulled from Typekit: svg2pdf needs the same font
	 * file the screen uses, so both come from one place and cannot drift.
	 */
  @font-face {
    font-family: "CubanoCert";
    src: url("/fonts/cubano.ttf") format("truetype");
    font-display: block;
  }

  /*
	 * base.css sets font-family with a universal selector, and CSS beats an
	 * SVG presentation attribute - so without these rules every <text> here
	 * silently renders in Inter however the font-family attribute is set.
	 * The attributes are kept as documentation and as a fallback for anything
	 * that reads the markup rather than the cascade.
	 */
  svg.cert :global(text) {
    font-family: Helvetica, Arial, sans-serif;
  }
  svg.cert :global(text.display) {
    font-family: "CubanoCert", Helvetica, Arial, sans-serif;
  }
</style>
