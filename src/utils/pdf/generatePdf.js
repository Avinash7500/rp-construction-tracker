import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FONT_BASE64 } from "./font";

async function loadFont(doc) {
  if (!FONT_BASE64) {
    throw new Error("FONT_BASE64 is missing");
  }
  doc.addFileToVFS("NotoSans.ttf", FONT_BASE64);
  doc.addFont("NotoSans.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans");
}

export async function generatePdf() {
  const jsPDFCtor = window?.jspdf?.jsPDF || jsPDF;
  const doc = new jsPDFCtor();

  await loadFont(doc);
  // eslint-disable-next-line no-console
  console.log(doc.getFontList());
  if (!doc.getFontList()?.NotoSans) {
    throw new Error("NotoSans font not found after registration");
  }

  doc.setFont("NotoSans");
  doc.text("\u092e\u093e\u0930\u094d\u091a - \u092a\u0939\u093f\u0932\u093e \u0906\u0920\u0935\u0921\u093e", 14, 20);
  doc.text("\u0930\u093e\u092e \u092a\u093e\u091f\u0940\u0932", 14, 30);

  autoTable(doc, {
    startY: 38,
    head: [["\u0928\u093e\u0935", "\u0936\u0939\u0930"]],
    body: [
      ["\u0930\u093e\u092e \u092a\u093e\u091f\u0940\u0932", "\u0915\u094b\u0932\u094d\u0939\u093e\u092a\u0942\u0930"],
      ["\u0905\u092e\u093f\u0924 \u0936\u093f\u0902\u0926\u0947", "\u092a\u0941\u0923\u0947"],
    ],
    styles: {
      font: "NotoSans",
      fontStyle: "normal",
    },
  });

  doc.save("marathi-report.pdf");
}
