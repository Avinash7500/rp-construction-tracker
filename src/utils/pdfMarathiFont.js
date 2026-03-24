import { FONT_BASE64 } from "./pdf/font";

let marathiFontRegistered = false;

export async function ensureMarathiPdfFont(pdf) {
  if (!pdf) return false;

  if (marathiFontRegistered) {
    try {
      pdf.setFont("NotoSans", "normal");
      pdf.getStringUnitWidth("\u091f\u0947\u0938\u094d\u091f");
      return true;
    } catch {
      marathiFontRegistered = false;
    }
  }

  try {
    if (!FONT_BASE64) return false;

    const fontFile = "NotoSans.ttf";
    pdf.addFileToVFS(fontFile, FONT_BASE64);
    pdf.addFont(fontFile, "NotoSans", "normal");
    // Backward-compatible alias for modules still using this family name.
    pdf.addFont(fontFile, "NotoSansDevanagari", "normal");
    pdf.setFont("NotoSans", "normal");
    pdf.getStringUnitWidth("\u091f\u0947\u0938\u094d\u091f");

    marathiFontRegistered = true;
    return true;
  } catch {
    try {
      pdf.setFont("helvetica", "normal");
    } catch {
      // no-op
    }
    return false;
  }
}

export function pdfTextSafe(value, hasMarathiFont = true) {
  const text = (value ?? "-").toString();
  if (hasMarathiFont) return text;
  const cleaned = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "-";
}
