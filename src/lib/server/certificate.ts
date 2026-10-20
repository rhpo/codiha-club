import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
// Deliberately the pure-JS core rather than the package root. The root
// re-exports qrcode/lib/server, which pulls in `fs` to write PNG files -
// unavailable on Cloudflare's workerd runtime, where this function also runs.
// The core only computes the module matrix, which is all a vector QR needs.
import { create as createQr } from "qrcode/lib/core/qrcode.js";
// A 256px base64 copy of the navbar mark. The full static/logo.png is
// 2301x2281 and 785 KB, which would land in every generated PDF for a mark
// drawn at 62pt. Regenerate with `npm run logo:mark`.
import logoMarkBase64 from "$lib/assets/logo-mark";

export interface CertificateData {
  id: string;
  code: string;
  kind: "participation" | "winner" | "membership";
  place: number | null;
  memberName: string;
  memberUniversity: string | null;
  /** Event/hackathon title, or the role label on a membership certificate. */
  contextTitle: string;
  contextDate: string | null;
  issuedAt: string;
  /** Membership only: when the member took the role, and when they left it. */
  periodStart?: string | null;
  /** null means they still hold it, which prints as "to present". */
  periodEnd?: string | null;
}

const PLACE_LABEL: Record<number, string> = {
  1: "FIRST PLACE",
  2: "SECOND PLACE",
  3: "THIRD PLACE",
};
const PLACE_COLOR: Record<number, [number, number, number]> = {
  1: [0.98, 0.75, 0.14],
  2: [0.78, 0.8, 0.84],
  3: [0.8, 0.5, 0.26],
};

/** Decoded once per cold start rather than per certificate. */
const LOGO_BYTES = new Uint8Array(Buffer.from(logoMarkBase64, "base64"));

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** A4 landscape certificate with a verification QR in the bottom-right. */
export async function buildCertificatePdf(
  data: CertificateData,
  verifyUrl: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`CODIHA Club certificate ${data.code}`);
  pdf.setAuthor("CODIHA Club");
  pdf.setSubject(data.contextTitle);

  const W = 842;
  const H = 595;
  const page = pdf.addPage([W, H]);

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const dark = rgb(0.105, 0.184, 0.125);
  const mid = rgb(0.239, 0.392, 0.282);
  const white = rgb(1, 1, 1);
  const accentArr =
    data.kind === "winner" ? PLACE_COLOR[data.place ?? 1] : [0.98, 0.573, 0];
  const accent = rgb(accentArr[0], accentArr[1], accentArr[2]);

  const membership = data.kind === "membership";

  // background + frame
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: dark });
  page.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: mid });
  page.drawRectangle({
    x: 24,
    y: 24,
    width: W - 48,
    height: H - 48,
    borderColor: accent,
    borderWidth: 2,
  });
  page.drawRectangle({ x: 24, y: 24, width: 8, height: H - 48, color: accent });

  const center = (
    text: string,
    y: number,
    size: number,
    font = regular,
    color = white
  ) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (W - w) / 2, y, size, font, color });
  };

  // The mark is white on transparent, which is why it sits on the green band
  // rather than on the page body.
  const logo = await pdf.embedPng(LOGO_BYTES);
  const logoSize = 62;
  page.drawImage(logo, {
    x: 58,
    y: H - 60 - logoSize / 2,
    width: logoSize,
    height: logoSize,
  });

  center("CODIHA CLUB", H - 72, 30, bold, white);
  center(
    "Inter-university IT Club  ·  ESST Algiers",
    H - 96,
    10,
    regular,
    rgb(0.85, 0.9, 0.87)
  );

  const heading = membership
    ? "CERTIFICATE OF MEMBERSHIP"
    : data.kind === "winner"
    ? "CERTIFICATE OF ACHIEVEMENT"
    : "CERTIFICATE OF PARTICIPATION";
  center(heading, H - 175, 24, bold, accent);

  if (data.kind === "winner" && data.place) {
    center(PLACE_LABEL[data.place] ?? "WINNER", H - 202, 13, bold, white);
  }

  const introLine = membership
    ? "CODIHA Club proudly certifies that"
    : "This certificate is proudly awarded to";
  center(introLine, H - 245, 11, italic, rgb(0.82, 0.88, 0.84));

  // recipient name, shrink to fit
  let nameSize = 40;
  const maxNameWidth = W - 180;
  while (
    bold.widthOfTextAtSize(data.memberName, nameSize) > maxNameWidth &&
    nameSize > 16
  ) {
    nameSize -= 2;
  }
  center(data.memberName || "CODIHA Member", H - 296, nameSize, bold, white);
  page.drawRectangle({
    x: 150,
    y: H - 312,
    width: W - 300,
    height: 1,
    color: accent,
  });

  if (data.memberUniversity) {
    center(data.memberUniversity, H - 330, 10, regular, rgb(0.8, 0.86, 0.82));
  }

  const forLine = membership
    ? "served the club as"
    : data.kind === "winner"
    ? "for an outstanding result at"
    : "for actively taking part in";
  center(forLine, H - 362, 11, italic, rgb(0.82, 0.88, 0.84));

  let ctxSize = 20;
  while (
    bold.widthOfTextAtSize(data.contextTitle, ctxSize) > W - 220 &&
    ctxSize > 11
  )
    ctxSize -= 1;
  center(data.contextTitle, H - 390, ctxSize, bold, white);

  // "from 18 October 2026 to present" for a role still held, otherwise the
  // closing date. Events keep their single date line.
  const subLine = membership
    ? data.periodStart
      ? `from ${fmtDate(data.periodStart)} to ${
          data.periodEnd ? fmtDate(data.periodEnd) : "present"
        }`
      : ""
    : data.contextDate
    ? fmtDate(data.contextDate)
    : "";
  if (subLine) center(subLine, H - 412, 10, regular, rgb(0.8, 0.86, 0.82));

  // signature block
  page.drawRectangle({
    x: 90,
    y: 110,
    width: 190,
    height: 1,
    color: rgb(0.7, 0.78, 0.72),
  });
  page.drawText("CODIHA Club Board", {
    x: 90,
    y: 92,
    size: 10,
    font: bold,
    color: white,
  });
  page.drawText("ESST Algiers", {
    x: 90,
    y: 78,
    size: 8,
    font: regular,
    color: rgb(0.75, 0.82, 0.77),
  });

  // meta
  page.drawText(`Certificate ID: ${data.code}`, {
    x: 90,
    y: 54,
    size: 8,
    font: regular,
    color: rgb(0.7, 0.78, 0.72),
  });
  page.drawText(`Issued: ${fmtDate(data.issuedAt)}`, {
    x: 90,
    y: 42,
    size: 8,
    font: regular,
    color: rgb(0.7, 0.78, 0.72),
  });

  // Verification QR, drawn as vector squares rather than an embedded bitmap:
  // it stays sharp at any zoom or print size, and costs ~1 kB instead of ~4 kB.
  const qrSize = 104;
  const qrX = W - 90 - qrSize;
  const qrY = 54;
  const quiet = 8;
  page.drawRectangle({
    x: qrX - quiet,
    y: qrY - quiet,
    width: qrSize + quiet * 2,
    height: qrSize + quiet * 2,
    color: white,
  });

  const matrix = createQr(verifyUrl, { errorCorrectionLevel: "M" }).modules;
  const cell = qrSize / matrix.size;
  const qrDark = rgb(0.105, 0.184, 0.125);
  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.get(row, col)) continue;
      page.drawRectangle({
        x: qrX + col * cell,
        // Row 0 of the matrix is the top one; PDF y grows upwards.
        y: qrY + (matrix.size - 1 - row) * cell,
        // A hair of bleed, so neighbouring modules do not show seams in
        // viewers that antialias each rectangle edge independently.
        width: cell + 0.15,
        height: cell + 0.15,
        color: qrDark,
      });
    }
  }
  const vLabel = "Scan to verify";
  page.drawText(vLabel, {
    x:
      W -
      90 -
      qrSize -
      8 +
      (qrSize + 16 - regular.widthOfTextAtSize(vLabel, 8)) / 2,
    y: 36,
    size: 8,
    font: regular,
    color: rgb(0.7, 0.78, 0.72),
  });

  return pdf.save();
}

export function certificateFileName(data: CertificateData): string {
  const safe = (s: string) =>
    s
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  const what = data.kind === "membership" ? "membership" : data.kind;
  return `codiha-${what}-${safe(data.contextTitle).slice(0, 40)}-${
    data.code
  }.pdf`;
}
