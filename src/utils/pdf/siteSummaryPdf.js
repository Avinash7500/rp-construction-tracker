import {
  formatCurrencyForPdf,
  generatePdfReport,
  safeCellValue,
} from "./commonPdfGenerator";

export async function generateSiteSummaryPdf({
  siteName,
  engineerName,
  currentWeekKey,
  totals = { labour: 0, material: 0, grand: 0 },
  weekly = { labour: 0, material: 0, grand: 0 },
  labourHistory = [],
  materialHistory = [],
}) {
  const labourWeekMap = labourHistory.reduce((acc, row) => {
    acc[row.weekKey] = row;
    return acc;
  }, {});
  const materialWeekMap = materialHistory.reduce((acc, row) => {
    acc[row.weekKey] = row;
    return acc;
  }, {});
  const combinedWeekKeys = Array.from(
    new Set([
      ...Object.keys(labourWeekMap),
      ...Object.keys(materialWeekMap),
    ]),
  ).sort((a, b) => String(b).localeCompare(String(a)));

  const subtitle = `Site: ${safeCellValue(siteName)} | Engineer: ${safeCellValue(engineerName)} | Current Week: ${safeCellValue(currentWeekKey)} | Total Labour: ${formatCurrencyForPdf(totals.labour)} | Total Material: ${formatCurrencyForPdf(totals.material)} | Grand Total: ${formatCurrencyForPdf(totals.grand)}`;
  generatePdfReport({
    title: "Weekly Financial Report",
    subtitle,
    reportType: "weekly_report",
    headerMetaLeft: `Site: ${safeCellValue(siteName)} | Engineer: ${safeCellValue(engineerName)}`,
    headerMetaRight: `Week: ${safeCellValue(currentWeekKey)}`,
    summaryCards: [
      { label: "TOTAL LABOUR SPEND", value: formatCurrencyForPdf(totals.labour || 0) },
      { label: "TOTAL MATERIAL BILL", value: formatCurrencyForPdf(totals.material || 0) },
      { label: "GRAND TOTAL", value: formatCurrencyForPdf(totals.grand || 0) },
      { label: "REPORT STATUS", value: "Verified / Internal" },
    ],
    columns: [
      "Week",
      "Labour Entries",
      "Labour Spend",
      "Material Deliveries",
      "Material Bill",
      "Material Paid",
      "Material Pending",
    ],
    rows: combinedWeekKeys.map((weekKey) => {
      const labourRow = labourWeekMap[weekKey] || {};
      const materialRow = materialWeekMap[weekKey] || {};
      return [
        weekKey || "-",
        Number(labourRow.totalEntries || 0),
        formatCurrencyForPdf(labourRow.totalLabourSpend || 0),
        Number(materialRow.deliveries || 0),
        formatCurrencyForPdf(materialRow.totalBill || 0),
        formatCurrencyForPdf(materialRow.totalPaid || 0),
        formatCurrencyForPdf(materialRow.pending || 0),
      ];
    }),
    numberColumns: [1, 2, 3, 4, 5, 6],
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 75 },
      2: { cellWidth: 110 },
      3: { cellWidth: 95 },
      4: { cellWidth: 110 },
      5: { cellWidth: 100 },
      6: { cellWidth: 110 },
    },
  });
}
