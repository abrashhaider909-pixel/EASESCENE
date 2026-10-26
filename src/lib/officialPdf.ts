/**
 * Official document PDF renderer (vector, jsPDF)
 * ---------------------------------------------------------------------------
 * Draws the stamped, print-ready A4 document: letterhead, title, body with
 * bold runs, one signature block per signature actually applied (student
 * first when the template includes it), department seals, and a footer with a
 * real verification QR, document ID and SHA-256 fingerprint.
 *
 * For a student's own uploaded PDF, the original pages are kept and this
 * approval sheet is appended (see buildIssuedPackage).
 */

import { Application, OfficialDocumentTemplate } from '../types';
import { boldSegments, dataUrlToBytes, formatDate, renderDocumentText } from './pdfGenerator';
import { UNIVERSITY_NAME, verificationUrl } from '../config';

interface RenderOptions {
  preview?: boolean;
  verificationUrl?: string;
}

/** Bump when the layout changes so stored PDFs are regenerated. */
export const PDF_RENDER_VERSION = 5;
const MARGIN = 22;

function toDataUrl(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

interface RasterImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** SVG data URLs are stored URI-encoded with characters that break <img>; normalise them. */
function normaliseImageSource(src: string): string {
  if (!src.startsWith('data:image/svg+xml')) return src;
  const comma = src.indexOf(',');
  if (comma < 0) return src;
  const meta = src.slice(0, comma);
  if (meta.includes('base64')) return src;
  try {
    let svg = decodeURIComponent(src.slice(comma + 1));
    if (svg.includes('\\"')) svg = svg.replace(/\\"/g, '"');
    svg = svg.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return src;
  }
}

export async function rasterise(src: string | undefined, targetWidth = 600): Promise<RasterImage | null> {
  if (!src) return null;
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('image load failed'));
      image.src = normaliseImageSource(src);
    });
    const naturalW = image.naturalWidth || image.width || targetWidth;
    const naturalH = image.naturalHeight || image.height || targetWidth * 0.4;
    const width = Math.min(targetWidth, Math.max(naturalW, 200));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(20, Math.round((width * naturalH) / naturalW));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

function drawFitted(pdf: any, image: RasterImage, x: number, yTop: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  try {
    pdf.addImage(image.dataUrl, 'PNG', x, yTop + (maxHeight - height), width, height);
  } catch {
    /* keep the document readable even if an asset cannot be embedded */
  }
  return { width, height };
}

/** Write a paragraph with **bold** runs, wrapping words to the content width. */
function writeRich(pdf: any, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const words: { word: string; bold: boolean }[] = [];
  boldSegments(text).forEach(seg => {
    seg.text.split(/(\s+)/).forEach(w => {
      if (w === '') return;
      words.push({ word: w, bold: seg.bold });
    });
  });
  let cursorX = x;
  let cursorY = y;
  for (const { word, bold } of words) {
    pdf.setFont('times', bold ? 'bold' : 'normal');
    const isSpace = /^\s+$/.test(word);
    const w = pdf.getTextWidth(isSpace ? ' ' : word);
    if (!isSpace && cursorX + w > x + width && cursorX > x) {
      cursorX = x;
      cursorY += lineHeight;
    }
    if (isSpace) {
      if (cursorX > x) cursorX += w;
      continue;
    }
    pdf.text(word, cursorX, cursorY);
    cursorX += w;
  }
  pdf.setFont('times', 'normal');
  return cursorY + lineHeight;
}

export interface Signatory {
  name: string;
  role: string;
  date: string;
  imageUrl?: string;
}

export function signatoriesFor(application: Application): Signatory[] {
  const issued = application.issuedDocument;
  const fmt = (ts: string) => {
    const d = new Date(ts);
    return `${formatDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return (issued?.appliedSignatures || []).map(s => ({
    name: s.staffName,
    role: s.roleTitle,
    date: fmt(s.timestamp),
    imageUrl: s.signatureUrl
  }));
}

export async function buildOfficialDocumentPdf(
  application: Application,
  template?: OfficialDocumentTemplate,
  options: RenderOptions = {}
): Promise<string | null> {
  try {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN * 2;
    const issued = application.issuedDocument;
    const docId = issued?.verificationCode || application.referenceNumber;
    let y = 26;

    /* letterhead */
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(17, 17, 17);
    pdf.setCharSpace(0.6);
    pdf.text(UNIVERSITY_NAME.toUpperCase(), MARGIN, y);
    pdf.setCharSpace(0);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(91, 74, 82);
    pdf.text(`Ref. ${application.referenceNumber}`, pageWidth - MARGIN, y, { align: 'right' });
    y += 5;
    pdf.setDrawColor(17, 17, 17);
    pdf.setLineWidth(0.6);
    pdf.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 14;

    /* title */
    const title = template ? renderDocumentText(template.title, application) : application.applicationTypeTitle.toUpperCase();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(13);
    pdf.setTextColor(17, 17, 17);
    pdf.setCharSpace(1.2);
    pdf.text(title.replace(/\*\*/g, ''), pageWidth / 2, y, { align: 'center' });
    pdf.setCharSpace(0);
    y += 14;

    /* body */
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11.5);
    pdf.setTextColor(30, 30, 30);
    const paragraphs = template?.bodyParagraphs?.length
      ? template.bodyParagraphs
      : [`This is to certify that **${application.studentSnapshot.name}** has been granted the ${application.applicationTypeTitle.toLowerCase()} recorded under ${application.referenceNumber}.`];
    for (const paragraph of paragraphs) {
      const text = renderDocumentText(paragraph, application);
      y = writeRich(pdf, text, MARGIN, y, contentWidth, 6.2) + 2.5;
      if (y > pageHeight - 110) {
        pdf.addPage();
        y = 26;
      }
    }

    /* signatures */
    const signatories = signatoriesFor(application);
    const stamps = issued?.appliedStamps || [];
    const perRow = Math.min(3, Math.max(1, signatories.length));
    const blockWidth = contentWidth / perRow;
    const rows = Math.ceil(signatories.length / 3);
    let sigTop = Math.max(y + 10, 160);
    if (sigTop + rows * 34 > pageHeight - 48) {
      pdf.addPage();
      sigTop = 30;
    }
    for (let i = 0; i < signatories.length; i += 1) {
      const s = signatories[i];
      const x = MARGIN + (i % 3) * blockWidth;
      const top = sigTop + Math.floor(i / 3) * 34;
      const lineW = blockWidth - 8;
      if (s.imageUrl) {
        const image = await rasterise(s.imageUrl, 480);
        if (image) drawFitted(pdf, image, x, top, Math.min(lineW, 44), 14);
      }
      pdf.setDrawColor(17, 17, 17);
      pdf.setLineWidth(0.35);
      pdf.line(x, top + 16, x + lineW, top + 16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(17, 17, 17);
      pdf.text(s.name, x, top + 20.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(91, 74, 82);
      pdf.text(s.role, x, top + 24.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(23, 100, 63);
      pdf.text(s.date, x, top + 28.5);
    }

    /* seals, beside the last row */
    let sealX = pageWidth - MARGIN - 22;
    const sealTop = sigTop + rows * 34 + 2;
    for (const stamp of stamps.slice(0, 4)) {
      const image = await rasterise(stamp.stampUrl, 300);
      if (image) drawFitted(pdf, image, sealX, sealTop, 22, 22);
      sealX -= 26;
    }

    /* footer: QR + ID + fingerprint */
    const footerTop = pageHeight - 40;
    pdf.setDrawColor(200, 190, 195);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, footerTop, pageWidth - MARGIN, footerTop);
    const url = options.verificationUrl || verificationUrl(docId);
    try {
      const QRCode = (await import('qrcode')).default;
      const qr = await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' });
      pdf.addImage(qr, 'PNG', MARGIN, footerTop + 4, 22, 22);
    } catch {
      /* QR is optional */
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(17, 17, 17);
    pdf.text(options.preview ? `Preview · ${docId}` : `Digitally signed via EzScene · ID ${docId}`, MARGIN + 27, footerTop + 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(91, 74, 82);
    const hash = issued?.documentHash || '';
    const shortHash = hash ? `${hash.slice(0, 4)} ${hash.slice(4, 8)} ${hash.slice(8, 12)} … ${hash.slice(-8, -4)} ${hash.slice(-4)}` : '';
    pdf.text(`Verify at ${url.length > 70 ? url.slice(0, 67) + '…' : url}`, MARGIN + 27, footerTop + 15.5);
    if (shortHash) pdf.text(`SHA-256 ${shortHash}`, MARGIN + 27, footerTop + 19.5);
    pdf.text('Any edit after signing breaks this fingerprint.', MARGIN + 27, footerTop + 23.5);

    return toDataUrl(pdf.output('arraybuffer'));
  } catch (error) {
    console.warn('[EzScene] PDF render failed:', error);
    return null;
  }
}

/**
 * Final package for an application: the approval document, or — for a
 * student's own PDF — the original pages (each footed with the document ID)
 * followed by the signed approval sheet.
 */
export async function buildIssuedPackage(
  application: Application,
  template?: OfficialDocumentTemplate
): Promise<{ dataUrl: string; pageCount: number } | null> {
  const sheet = await buildOfficialDocumentPdf(application, template);
  if (!sheet) return null;
  const original = application.source === 'upload' ? application.uploadedDocuments.find(d => d.fileType === 'application/pdf') : undefined;
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  try {
    const sheetDoc = await PDFDocument.load(dataUrlToBytes(sheet));
    if (!original) return { dataUrl: sheet, pageCount: sheetDoc.getPageCount() };
    const out = await PDFDocument.load(dataUrlToBytes(original.fileDataUrl), { ignoreEncryption: true });
    const font = await out.embedFont(StandardFonts.Helvetica);
    const id = application.issuedDocument?.verificationCode || application.referenceNumber;
    out.getPages().forEach(page => {
      const { width } = page.getSize();
      page.drawText(`EzScene ID ${id} · approved — signatures on the final page`, {
        x: 36,
        y: 18,
        size: 7,
        font,
        color: rgb(0.04, 0.44, 0.5),
        maxWidth: width - 72
      });
    });
    const copied = await out.copyPages(sheetDoc, sheetDoc.getPageIndices());
    copied.forEach(p => out.addPage(p));
    const bytes = await out.save();
    return { dataUrl: toDataUrl(bytes), pageCount: out.getPageCount() };
  } catch (error) {
    console.warn('[EzScene] Could not merge the original PDF; issuing the approval sheet only.', error);
    return { dataUrl: sheet, pageCount: 1 };
  }
}

export const buildIssuedDocumentPdf = buildOfficialDocumentPdf;
