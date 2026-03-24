import autoTable from "jspdf-autotable";
import { formatMarathiWeekFromWeekKey } from "../marathiWeekFormat";
import {
  buildPdfFileStamp,
  createPdfDoc,
  formatCurrency,
} from "./pdfHelper";

function rowTotal(row) {
  return (row.mistriCount || 0) * (row.mistriRate || 0)
    + (row.labourCount || 0) * (row.labourRate || 0);
}

export async function generateLabourPdf({
  siteName,
  weekKey,
  engineerName,
  rows = [],
}) {
  const { doc, text } = await createPdfDoc();

  const weekLabel = formatMarathiWeekFromWeekKey(weekKey);
  const total = rows.reduce((sum, row) => sum + rowTotal(row), 0);

  doc.setFontSize(16);
  doc.text(text("R.P Construction"), 14, 15);
  doc.setFontSize(12);
  doc.text(text("\u092e\u091c\u0942\u0930 \u0938\u093e\u092a\u094d\u0924\u093e\u0939\u093f\u0915 \u0905\u0939\u0935\u093e\u0932"), 14, 22);
  doc.setFontSize(10);
  doc.text(text(`Site: ${siteName || "-"}`), 14, 29);
  doc.text(text(`Week: ${weekLabel || weekKey || "-"}`), 14, 34);
  doc.text(text(`Engineer: ${engineerName || "-"}`), 14, 39);

  autoTable(doc, {
    startY: 45,
    head: [[
      text("\u0935\u093e\u0930"),
      text("\u0924\u092a\u0936\u0940\u0932"),
      text("\u092e\u093f\u0938\u094d\u0924\u094d\u0930\u0940"),
      text("\u0926\u0930"),
      text("\u092e\u091c\u0942\u0930"),
      text("\u0926\u0930"),
      text("\u090f\u0915\u0942\u0923"),
    ]],
    body: rows.map((row) => [
      text(row.dayName || "-"),
      text(row.details || "-"),
      String(row.mistriCount || 0),
      String(row.mistriRate || 0),
      String(row.labourCount || 0),
      String(row.labourRate || 0),
      text(formatCurrency(rowTotal(row))),
    ]),
    styles: {
      font: "NotoSans",
      fontStyle: "normal",
      fontSize: 9,
      overflow: "linebreak",
      cellPadding: 2,
    },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 48 },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
    },
    margin: { left: 8, right: 8 },
  });

  const finalY = (doc.lastAutoTable?.finalY || 45) + 8;
  doc.setFontSize(11);
  doc.text(text(`Weekly Total: ${formatCurrency(total)}`), 14, finalY);
  doc.save(`labour_weekly_${siteName || "site"}_${weekKey || "week"}_${buildPdfFileStamp()}.pdf`);
}
