import jsPDF from "jspdf";
import { FONT_BASE64 } from "./font";

const FONT_FILE_NAME = "NotoSans.ttf";
const FONT_FACE_NAME = "NotoSans";

async function loadFont(doc) {
  if (!doc) throw new Error("PDF doc is required");
  if (!FONT_BASE64) {
    throw new Error("FONT_BASE64 is missing");
  }

  const existingFonts = doc.getFontList();
  if (!existingFonts?.[FONT_FACE_NAME]) {
    doc.addFileToVFS(FONT_FILE_NAME, FONT_BASE64);
    doc.addFont(FONT_FILE_NAME, FONT_FACE_NAME, "normal");
  }
  doc.setFont(FONT_FACE_NAME);

  const fontList = doc.getFontList();
  // eslint-disable-next-line no-console
  console.log("PDF Font List:", fontList);
  if (!fontList?.[FONT_FACE_NAME]) {
    throw new Error("NotoSans font registration failed");
  }
}

export function formatDate(value) {
  if (!value) return "-";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
  } catch {
    return "-";
  }
}

export function formatCurrency(value) {
  return `\u20b9 ${Number(value || 0).toLocaleString("en-IN")}`;
}

export function buildPdfFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function createPdfDoc(options = {}) {
  const doc = new jsPDF(
    options.orientation || "p",
    options.unit || "mm",
    options.format || "a4",
  );

  await loadFont(doc);
  doc.setFont(FONT_FACE_NAME);

  const text = (value) => (value ?? "-").toString();
  return { doc, text, hasMarathiFont: true };
}
