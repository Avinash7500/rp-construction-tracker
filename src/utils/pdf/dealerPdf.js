import {
  formatCurrencyForPdf,
  formatDateForPdf,
  generatePdfReport,
  safeCellValue,
} from "./commonPdfGenerator";

export async function generateDealerPdf({
  dealerName,
  dealerPhone,
  rows = [],
}) {
  const mapped = rows.map((row) => ({
    date: formatDateForPdf(row.date),
    site: row.site || "-",
    details: row.details || "-",
    bill: Number(row.bill || 0),
    paid: Number(row.paid || 0),
    pending: Number(row.pending || 0),
  }));

  const totalPurchase = mapped.reduce((sum, row) => sum + row.bill, 0);
  const totalPaid = mapped.reduce((sum, row) => sum + row.paid, 0);
  const pendingAmount = totalPurchase - totalPaid;

  generatePdfReport({
    title: "Ledger Report",
    subtitle: `Dealer: ${safeCellValue(dealerName)} | Phone: ${safeCellValue(dealerPhone)} | Purchase: ${formatCurrencyForPdf(totalPurchase)} | Paid: ${formatCurrencyForPdf(totalPaid)} | Balance: ${formatCurrencyForPdf(pendingAmount)}`,
    reportType: "ledger_report",
    headerMetaLeft: `Dealer: ${safeCellValue(dealerName)} | Phone: ${safeCellValue(dealerPhone)}`,
    headerMetaRight: "Ledger Statement",
    summaryCards: [
      { label: "TOTAL PURCHASE", value: formatCurrencyForPdf(totalPurchase) },
      { label: "TOTAL PAID", value: formatCurrencyForPdf(totalPaid) },
      { label: "PENDING AMOUNT", value: formatCurrencyForPdf(pendingAmount) },
      { label: "REPORT STATUS", value: "Verified / Internal" },
    ],
    columns: [
      "Date",
      "Description",
      "Debit",
      "Credit",
      "Balance",
    ],
    rows: mapped.map((row) => [
      row.date,
      `${row.site} | ${row.details}`,
      formatCurrencyForPdf(row.bill),
      formatCurrencyForPdf(row.paid),
      formatCurrencyForPdf(row.pending),
    ]),
    numberColumns: [2, 3, 4],
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 320 },
      2: { cellWidth: 85 },
      3: { cellWidth: 85 },
      4: { cellWidth: 85 },
    },
  });
}
