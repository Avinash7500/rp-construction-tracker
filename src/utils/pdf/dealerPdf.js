import autoTable from "jspdf-autotable";
import {
  buildPdfFileStamp,
  createPdfDoc,
  formatCurrency,
  formatDate,
} from "./pdfHelper";

export async function generateDealerPdf({
  dealerName,
  dealerPhone,
  rows = [],
}) {
  const { doc, text } = await createPdfDoc();

  const mapped = rows.map((row) => ({
    date: formatDate(row.date),
    site: row.site || "-",
    details: row.details || "-",
    bill: Number(row.bill || 0),
    paid: Number(row.paid || 0),
    pending: Number(row.pending || 0),
  }));

  const totalPurchase = mapped.reduce((sum, row) => sum + row.bill, 0);
  const totalPaid = mapped.reduce((sum, row) => sum + row.paid, 0);
  const pendingAmount = totalPurchase - totalPaid;

  doc.setFontSize(16);
  doc.text(text("R.P Construction"), 14, 15);
  doc.setFontSize(12);
  doc.text(text("\u0921\u0940\u0932\u0930 \u0932\u0947\u091c\u0930 \u0905\u0939\u0935\u093e\u0932"), 14, 22);
  doc.setFontSize(10);
  doc.text(text(`Dealer: ${dealerName || "-"}`), 14, 29);
  doc.text(text(`Phone: ${dealerPhone || "-"}`), 14, 34);
  doc.text(text(`Generated: ${new Date().toLocaleString("en-GB")}`), 14, 39);

  autoTable(doc, {
    startY: 45,
    head: [[
      text("\u0924\u093e\u0930\u0940\u0916"),
      text("\u0938\u093e\u0907\u091f"),
      text("\u0924\u092a\u0936\u0940\u0932"),
      text("\u092c\u093f\u0932"),
      text("\u092a\u0947\u0921"),
      text("\u092c\u093e\u0915\u0940"),
    ]],
    body: mapped.map((row) => [
      text(row.date),
      text(row.site),
      text(row.details),
      text(formatCurrency(row.bill)),
      text(formatCurrency(row.paid)),
      text(formatCurrency(row.pending)),
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
      1: { cellWidth: 30 },
      2: { cellWidth: 48 },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
    },
    margin: { left: 8, right: 8 },
  });

  const y = (doc.lastAutoTable?.finalY || 45) + 8;
  doc.setFontSize(11);
  doc.text(text(`Total Purchase: ${formatCurrency(totalPurchase)}`), 14, y);
  doc.text(text(`Total Paid: ${formatCurrency(totalPaid)}`), 14, y + 6);
  doc.text(text(`Pending: ${formatCurrency(pendingAmount)}`), 14, y + 12);

  doc.save(`dealer_ledger_${dealerName || "dealer"}_${buildPdfFileStamp()}.pdf`);
}
