import {
  formatCurrencyForPdf,
  formatDateForPdf,
  generatePdfReport,
  safeCellValue,
} from "./commonPdfGenerator";

export async function generateMaterialPdf({
  siteName,
  weekKey,
  engineerName,
  rows = [],
}) {
  const mapped = rows.map((row) => {
    const bill =
      typeof row.billAmount === "number"
        ? row.billAmount
        : (row.qty || 0) * (row.rate || 0);
    const paid = Number(row.paid || row.paidAmount || 0);
    const pending = bill - paid;
    return {
      date: formatDateForPdf(row.date),
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
  const subtitle = `Site: ${safeCellValue(siteName)} | Week: ${safeCellValue(weekKey)} | Engineer: ${safeCellValue(engineerName)} | Bill: ${formatCurrencyForPdf(totalBill)} | Paid: ${formatCurrencyForPdf(totalPaid)} | Balance: ${formatCurrencyForPdf(pending)}`;
  generatePdfReport({
    title: "Material Report",
    subtitle,
    reportType: "material_report",
    headerMetaLeft: `Site: ${safeCellValue(siteName)} | Engineer: ${safeCellValue(engineerName)}`,
    headerMetaRight: `Week: ${safeCellValue(weekKey)}`,
    summaryCards: [
      { label: "TOTAL MATERIAL BILL", value: formatCurrencyForPdf(totalBill) },
      { label: "TOTAL PAID", value: formatCurrencyForPdf(totalPaid) },
      { label: "PENDING BALANCE", value: formatCurrencyForPdf(pending) },
      { label: "REPORT STATUS", value: "Verified / Internal" },
    ],
    columns: [
      "Date",
      "Site",
      "Material",
      "Qty",
      "Rate",
      "Amount",
      "Paid",
      "Balance",
    ],
    rows: mapped.map((row) => [
      row.date,
      safeCellValue(siteName),
      row.details,
      Number(row.qty || 0),
      formatCurrencyForPdf(row.rate),
      formatCurrencyForPdf(row.bill),
      formatCurrencyForPdf(row.paid),
      formatCurrencyForPdf(row.pending),
    ]),
    numberColumns: [3, 4, 5, 6, 7],
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 110 },
      2: { cellWidth: 180 },
      3: { cellWidth: 50 },
      4: { cellWidth: 70 },
      5: { cellWidth: 80 },
      6: { cellWidth: 70 },
      7: { cellWidth: 80 },
    },
  });
}
