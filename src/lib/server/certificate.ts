import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

export interface CertificateData {
	id: string;
	code: string;
	kind: 'participation' | 'winner';
	place: number | null;
	memberName: string;
	memberUniversity: string | null;
	contextTitle: string;
	contextDate: string | null;
	issuedAt: string;
}

const PLACE_LABEL: Record<number, string> = { 1: 'FIRST PLACE', 2: 'SECOND PLACE', 3: 'THIRD PLACE' };
const PLACE_COLOR: Record<number, [number, number, number]> = {
	1: [0.98, 0.75, 0.14],
	2: [0.78, 0.8, 0.84],
	3: [0.8, 0.5, 0.26]
};

function fmtDate(iso: string | null): string {
	if (!iso) return '';
	return new Date(iso).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/** A4 landscape certificate with a verification QR in the bottom-right. */
export async function buildCertificatePdf(
	data: CertificateData,
	verifyUrl: string
): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	pdf.setTitle(`CODIHA Club certificate ${data.code}`);
	pdf.setAuthor('CODIHA Club');
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
	const accentArr = data.kind === 'winner' ? PLACE_COLOR[data.place ?? 1] : [0.98, 0.573, 0];
	const accent = rgb(accentArr[0], accentArr[1], accentArr[2]);

	// background + frame
	page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: dark });
	page.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: mid });
	page.drawRectangle({
		x: 24,
		y: 24,
		width: W - 48,
		height: H - 48,
		borderColor: accent,
		borderWidth: 2
	});
	page.drawRectangle({ x: 24, y: 24, width: 8, height: H - 48, color: accent });

	const center = (text: string, y: number, size: number, font = regular, color = white) => {
		const w = font.widthOfTextAtSize(text, size);
		page.drawText(text, { x: (W - w) / 2, y, size, font, color });
	};

	center('CODIHA CLUB', H - 72, 30, bold, white);
	center('Inter-university IT Club  ·  ESST Algiers', H - 96, 10, regular, rgb(0.85, 0.9, 0.87));

	const heading =
		data.kind === 'winner'
			? `CERTIFICATE OF ACHIEVEMENT`
			: 'CERTIFICATE OF PARTICIPATION';
	center(heading, H - 175, 24, bold, accent);

	if (data.kind === 'winner' && data.place) {
		center(PLACE_LABEL[data.place] ?? 'WINNER', H - 202, 13, bold, white);
	}

	center('This certificate is proudly awarded to', H - 245, 11, italic, rgb(0.82, 0.88, 0.84));

	// recipient name, shrink to fit
	let nameSize = 40;
	const maxNameWidth = W - 180;
	while (bold.widthOfTextAtSize(data.memberName, nameSize) > maxNameWidth && nameSize > 16) {
		nameSize -= 2;
	}
	center(data.memberName || 'CODIHA Member', H - 296, nameSize, bold, white);
	page.drawRectangle({ x: 150, y: H - 312, width: W - 300, height: 1, color: accent });

	if (data.memberUniversity) {
		center(data.memberUniversity, H - 330, 10, regular, rgb(0.8, 0.86, 0.82));
	}

	const forLine =
		data.kind === 'winner'
			? 'for an outstanding result at'
			: 'for actively taking part in';
	center(forLine, H - 362, 11, italic, rgb(0.82, 0.88, 0.84));

	let ctxSize = 20;
	while (bold.widthOfTextAtSize(data.contextTitle, ctxSize) > W - 220 && ctxSize > 11) ctxSize -= 1;
	center(data.contextTitle, H - 390, ctxSize, bold, white);

	if (data.contextDate) {
		center(fmtDate(data.contextDate), H - 412, 10, regular, rgb(0.8, 0.86, 0.82));
	}

	// signature block
	page.drawRectangle({ x: 90, y: 110, width: 190, height: 1, color: rgb(0.7, 0.78, 0.72) });
	page.drawText('CODIHA Club Board', { x: 90, y: 92, size: 10, font: bold, color: white });
	page.drawText('ESST Algiers', { x: 90, y: 78, size: 8, font: regular, color: rgb(0.75, 0.82, 0.77) });

	// meta
	page.drawText(`Certificate ID: ${data.code}`, {
		x: 90,
		y: 54,
		size: 8,
		font: regular,
		color: rgb(0.7, 0.78, 0.72)
	});
	page.drawText(`Issued: ${fmtDate(data.issuedAt)}`, {
		x: 90,
		y: 42,
		size: 8,
		font: regular,
		color: rgb(0.7, 0.78, 0.72)
	});

	// verification QR
	const qrPng = await QRCode.toBuffer(verifyUrl, {
		type: 'png',
		margin: 1,
		width: 320,
		color: { dark: '#1b2e1f', light: '#ffffff' }
	});
	const qr = await pdf.embedPng(qrPng);
	const qrSize = 104;
	page.drawRectangle({
		x: W - 90 - qrSize - 8,
		y: 54 - 8,
		width: qrSize + 16,
		height: qrSize + 16,
		color: white
	});
	page.drawImage(qr, { x: W - 90 - qrSize, y: 54, width: qrSize, height: qrSize });
	const vLabel = 'Scan to verify';
	page.drawText(vLabel, {
		x: W - 90 - qrSize - 8 + (qrSize + 16 - regular.widthOfTextAtSize(vLabel, 8)) / 2,
		y: 36,
		size: 8,
		font: regular,
		color: rgb(0.7, 0.78, 0.72)
	});

	return pdf.save();
}

export function certificateFileName(data: CertificateData): string {
	const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
	return `codiha-${data.kind}-${safe(data.contextTitle).slice(0, 40)}-${data.code}.pdf`;
}
