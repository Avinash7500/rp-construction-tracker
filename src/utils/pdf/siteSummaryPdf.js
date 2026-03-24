import autoTable from "jspdf-autotable";
import { formatMarathiWeekFromWeekKey } from "../marathiWeekFormat";
import {
  buildPdfFileStamp,
  createPdfDoc,
  formatCurrency,
} from "./pdfHelper";

export async function generateSiteSummaryPdf({
  siteName,
  engineerName,
  currentWeekKey,
  totals = { labour: 0, material: 0, grand: 0 },
  weekly = { labour: 0, material: 0, grand: 0 },
  labourHistory = [],
  materialHistory = [],
}) {
  const { doc, text } = await createPdfDoc();

  const weekLabel = formatMarathiWeekFromWeekKey(currentWeekKey);
  const totalRows = [
    [text("Overall Labour"), text(formatCurrency(totals.labour || 0))],
    [text("Overall Material"), text(formatCurrency(totals.material || 0))],
    [text("Project Grand Total"), text(formatCurrency(totals.grand || 0))],
  ];
  const weeklyRows = [
    [text("Labour Total"), text(formatCurrency(weekly.labour || 0))],
    [text("Material Total"), text(formatCurrency(weekly.material || 0))],
    [text("Grand Total (Weekly)"), text(formatCurrency(weekly.grand || 0))],
  ];

  doc.setFontSize(16);
  doc.text(text("R.P Construction"), 14, 15);
  doc.setFontSize(12);
  doc.text(text("\u0938\u093e\u0907\u091f \u0906\u0930\u094d\u0925\u093f\u0915 \u0938\u093e\u0930\u093e\u0902\u0936"), 14, 22);
  doc.setFontSize(10);
  doc.text(text(`Site: ${siteName || "-"}`), 14, 29);
  doc.text(text(`Engineer: ${engineerName || "-"}`), 14, 34);
  doc.text(text(`Week: ${weekLabel || currentWeekKey || "-"}`), 14, 39);

  autoTable(doc, {
    startY: 45,
    head: [[text("Total Financial Summary"), text("Amount")]],
    body: totalRows,
    styles: { font: "NotoSans", fontStyle: "normal", fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 85 }, 1: { halign: "right" } },
    margin: { left: 8, right: 8 },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 70) + 6,
    head: [[text("Weekly Financial Summary"), text("Amount")]],
    body: weeklyRows,
    styles: { font: "NotoSans", fontStyle: "normal", fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 85 }, 1: { halign: "right" } },
    margin: { left: 8, right: 8 },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 100) + 8,
    head: [[text("Labour Weekly History"), text("Entries"), text("Total Labour Spend")]],
    body: labourHistory.map((row) => [
      text(formatMarathiWeekFromWeekKey(row.weekKey) || row.weekKey || "-"),
      String(row.totalEntries || 0),
      text(formatCurrency(row.totalLabourSpend || 0)),
    ]),
    styles: { font: "NotoSans", fontStyle: "normal", fontSize: 8.5 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
    margin: { left: 8, right: 8 },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 140) + 6,
    head: [[text("Material Weekly History"), text("Deliveries"), text("Bill"), text("Paid"), text("Pending")]],
    body: materialHistory.map((row) => [
      text(formatMarathiWeekFromWeekKey(row.weekKey) || row.weekKey || "-"),
      String(row.deliveries || 0),
      text(formatCurrency(row.totalBill || 0)),
      text(formatCurrency(row.totalPaid || 0)),
      text(formatCurrency(row.pending || 0)),
    ]),
    styles: { font: "NotoSans", fontStyle: "normal", fontSize: 8.5 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
    margin: { left: 8, right: 8 },
  });

  doc.save(`site_summary_${siteName || "site"}_${buildPdfFileStamp()}.pdf`);
}
