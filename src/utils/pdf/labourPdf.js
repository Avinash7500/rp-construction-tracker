import {
  formatCurrencyForPdf,
  generatePdfReport,
  safeCellValue,
} from "./commonPdfGenerator";

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
  const total = rows.reduce((sum, row) => sum + rowTotal(row), 0);
  const subtitle = `Site: ${safeCellValue(siteName)} | Week: ${safeCellValue(weekKey)} | Engineer: ${safeCellValue(engineerName)} | Weekly Total: ${formatCurrencyForPdf(total)}`;
  generatePdfReport({
    title: "Labour Weekly Report",
    subtitle,
    reportType: "labour_report",
    headerMetaLeft: `Site: ${safeCellValue(siteName)} | Engineer: ${safeCellValue(engineerName)}`,
    headerMetaRight: `Week: ${safeCellValue(weekKey)}`,
    summaryCards: [
      { label: "TOTAL LABOUR SPEND", value: formatCurrencyForPdf(total) },
      { label: "TOTAL ENTRIES", value: String(rows.length) },
      { label: "REPORT STATUS", value: "Verified / Internal" },
    ],
    columns: [
      "Day",
      "Details",
      "Mistri Count",
      "Mistri Rate",
      "Labour Count",
      "Labour Rate",
      "Amount",
    ],
    rows: rows.map((row) => [
      row.dayName || "-",
      row.details || "-",
      Number(row.mistriCount || 0),
      Number(row.mistriRate || 0),
      Number(row.labourCount || 0),
      Number(row.labourRate || 0),
      formatCurrencyForPdf(rowTotal(row)),
    ]),
    numberColumns: [2, 3, 4, 5, 6],
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 220 },
      2: { cellWidth: 70 },
      3: { cellWidth: 70 },
      4: { cellWidth: 70 },
      5: { cellWidth: 70 },
      6: { cellWidth: 100 },
    },
  });
}
