/**
 * Turns a rendered certificate <svg> into a downloadable PDF, in the browser.
 *
 * It happens client-side because the alternative does not exist: rendering a
 * Svelte component to PDF on the server would need a headless browser, and
 * the site runs on Netlify Functions and Cloudflare workerd, neither of which
 * can host one. Converting the SVG here keeps the design in a .svelte file,
 * which is the whole point.
 *
 * jsPDF, svg2pdf and the font are imported lazily so that none of it is in
 * the bundle for a visitor who only looks at the certificate.
 */

const FONT_URL = "/fonts/cubano.ttf";
/** Must match the font-family the certificate components ask for. */
const FONT_NAME = "CubanoCert";

let fontBase64 = null;

async function loadFont() {
  if (fontBase64) return fontBase64;
  const res = await fetch(FONT_URL);
  if (!res.ok)
    throw new Error(`Could not load the certificate font (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  // Chunked: a spread over ~23k bytes is fine, but this stays safe if the
  // font is ever replaced with a larger one.
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  fontBase64 = btoa(binary);
  return fontBase64;
}

/**
 * @param {SVGSVGElement} svg the element rendered by a certificate component
 * @param {string} fileName
 */
export async function downloadCertificatePdf(svg, fileName) {
  const [{ jsPDF }, , base64] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
    loadFont(),
  ]);

  const width = Number(svg.getAttribute("width")) || 842;
  const height = Number(svg.getAttribute("height")) || 595;

  const doc = new jsPDF({
    orientation: width >= height ? "landscape" : "portrait",
    unit: "pt",
    format: [width, height],
  });

  // Registering the real font is what keeps the headings as Cubano instead
  // of silently falling back to Helvetica, and keeps the text selectable
  // rather than converting it to outlines.
  doc.addFileToVFS("cubano.ttf", base64);
  doc.addFont("cubano.ttf", FONT_NAME, "normal");

  await doc.svg(svg, { x: 0, y: 0, width, height });
  doc.save(fileName);
}
