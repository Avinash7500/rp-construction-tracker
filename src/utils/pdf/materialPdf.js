import autoTable from "jspdf-autotable";
import { formatMarathiWeekFromWeekKey } from "../marathiWeekFormat";
import {
  buildPdfFileStamp,
  createPdfDoc,
  formatCurrency,
  formatDate,
} from "./pdfHelper";

export async function generateMaterialPdf({
  siteName,
  weekKey,
  engineerName,
  rows = [],
}) {
  const { doc, text } = await createPdfDoc();

  const mapped = rows.map((row) => {
    const bill =
      typeof row.billAmount === "number"
        ? row.billAmount
        : (row.qty || 0) * (row.rate || 0);
    const paid = Number(row.paid || row.paidAmount || 0);
    const pending = bill - paid;
    return {
      date: formatDate(row.date),
      details: row.details || "-",
      dealerName: row.dealerName || "-",
      qty: row.qty || 0,
      rate: row.rate || 0,
      bill,
      paid,
      pending,
    };
  });

  const totalBill = mapped.reduce((sum, row) => sum + row.bill, 0);
  const totalPaid = mapped.reduce((sum, row) => sum + row.paid, 0);
  const pending = totalBill - totalPaid;
  const weekLabel = formatMarathiWeekFromWeekKey(weekKey);

  doc.setFontSize(16);
  doc.text(text("R.P Construction"), 14, 15);
  doc.setFontSize(12);
  doc.text(text("\u0938\u093e\u092e\u0917\u094d\u0930\u0940 \u0938\u093e\u092a\u094d\u0924\u093e\u0939\u093f\u0915 \u0905\u0939\u0935\u093e\u0932"), 14, 22);
  doc.setFontSize(10);
  doc.text(text(`Site: ${siteName || "-"}`), 14, 29);
  doc.text(text(`Week: ${weekLabel || weekKey || "-"}`), 14, 34);
  doc.text(text(`Engineer: ${engineerName || "-"}`), 14, 39);

  autoTable(doc, {
    startY: 45,
    head: [[
      text("\u0924\u093e\u0930\u0940\u0916"),
      text("\u0924\u092a\u0936\u0940\u0932"),
      text("\u0921\u0940\u0932\u0930"),
      text("\u092a\u094d\u0930\u092e\u093e\u0923"),
      text("\u0926\u0930"),
      text("\u090f\u0915\u0942\u0923"),
      text("\u092a\u0947\u0921"),
    ]],
    body: mapped.map((row) => [
      text(row.date),
      text(row.details),
      text(row.dealerName),
      String(row.qty),
      text(formatCurrency(row.rate)),
      text(formatCurrency(row.bill)),
      text(formatCurrency(row.paid)),
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
      0: { cellWidth: 22 },
      1: { cellWidth: 42 },
      2: { cellWidth: 28 },
      3: { cellWidth: 16, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
    },
    margin: { left: 8, right: 8 },
  });

  const y = (doc.lastAutoTable?.finalY || 45) + 8;
  doc.setFontSize(11);
  doc.text(text(`Total Bill: ${formatCurrency(totalBill)}`), 14, y);
  doc.text(text(`Total Paid: ${formatCurrency(totalPaid)}`), 14, y + 6);
  doc.text(text(`Pending: ${formatCurrency(pending)}`), 14, y + 12);

  doc.save(`material_weekly_${siteName || "site"}_${weekKey || "week"}_${buildPdfFileStamp()}.pdf`);
}
