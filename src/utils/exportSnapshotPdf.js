import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function nowFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}`;
}

// 🔥 Existing Weekly Snapshot Export
export async function exportSnapshotToPDF(snapshot) {
  if (!snapshot) throw new Error("Snapshot missing");
  const weekKey = snapshot.weekKey || snapshot.id || "UNKNOWN_WEEK";
  const stamp = nowFileStamp();
  const fileName = `RP_Snapshot_${weekKey}_${stamp}.pdf`;
  const doc = new jsPDF();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 220, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("RP Construction Tracker - Snapshot Report", 14, 12);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  doc.text(`WeekKey: ${weekKey}`, 14, 30);
  doc.text(
    `Range: ${snapshot.range?.from || "-"} → ${snapshot.range?.to || "-"}`,
    14,
    35,
  );

  const summary = snapshot.summary || {};
  doc.setFontSize(11);
  doc.text("Weekly Summary", 14, 45);

  autoTable(doc, {
    startY: 48,
    head: [["Field", "Value"]],
    body: [
      ["Total Sites", String(summary.totalSites ?? 0)],
      ["Total Tasks", String(summary.totalTasks ?? 0)],
      ["Done", String(summary.done ?? 0)],
      ["Pending", String(summary.pending ?? 0)],
      ["Cancelled", String(summary.cancelled ?? 0)],
      ["Overdue", String(summary.overdue ?? 0)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  let y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text("Engineer Breakdown", 14, y);
  const engineers = snapshot.engineerBreakdown || [];

  autoTable(doc, {
    startY: y + 3,
    head: [["Engineer", "Pending", "Done", "Cancelled", "Total", "Done %"]],
    body: engineers.map((e) => {
      const total = (e.pending || 0) + (e.done || 0) + (e.cancelled || 0);
      const donePct = total > 0 ? Math.round(((e.done || 0) / total) * 100) : 0;
      return [
        e.name || "Unknown",
        String(e.pending),
        String(e.done),
        String(e.cancelled),
        String(total),
        `${donePct}%`,
      ];
    }),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(fileName);
}

// 🔥 NEW: Professional Dealer Ledger Export
export function exportSnapshotPdf(reportData) {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 220, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("R.P. CONSTRUCTION", 105, 12, { align: "center" });
  doc.setFontSize(10);
  doc.text("DEALER PAYMENT STATEMENT", 105, 18, { align: "center" });

  // Meta Data
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`Dealer Name: ${reportData.dealerName}`, 14, 35);
  doc.text(`Contact: ${reportData.dealerPhone}`, 14, 42);
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 196, 35, {
    align: "right",
  });

  // Summary Table
  autoTable(doc, {
    startY: 50,
    head: [["Total Billed", "Total Paid", "Outstanding Balance"]],
    body: [
      [
        `Rs. ${reportData.summary.billed.toLocaleString("en-IN")}`,
        `Rs. ${reportData.summary.paid.toLocaleString("en-IN")}`,
        `Rs. ${(reportData.summary.billed - reportData.summary.paid).toLocaleString("en-IN")}`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], halign: "center" },
    styles: { halign: "center", fontSize: 11, fontStyle: "bold" },
  });

  // History Table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [
      [
        "Date",
        "Site Name",
        "Material Details",
        "Bill Amt",
        "Paid Amt",
        "Balance",
      ],
    ],
    body: reportData.history.map((t) => [
      t.date,
      t.site,
      t.details,
      t.bill.toLocaleString("en-IN"),
      t.paid.toLocaleString("en-IN"),
      t.balance.toLocaleString("en-IN"),
    ]),
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    didParseCell: (data) => {
      // Highlight fully paid rows in light green in PDF
      if (data.section === "body" && data.row.raw[5] === "0") {
        data.cell.styles.fillColor = [240, 253, 244];
      }
    },
  });

  doc.save(`${reportData.dealerName}_Statement.pdf`);
}
