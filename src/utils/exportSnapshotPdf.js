// src/utils/exportSnapshotPdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function nowFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}`;
}

export async function exportSnapshotToPDF(snapshot) {
  if (!snapshot) throw new Error("Snapshot missing");

  const weekKey = snapshot.weekKey || snapshot.id || "UNKNOWN_WEEK";
  const stamp = nowFileStamp();
  const fileName = `RP_Snapshot_${weekKey}_${stamp}.pdf`;

  const doc = new jsPDF();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 220, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("RP Construction Tracker - Snapshot Report", 14, 12);

  // Meta
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  doc.text(`WeekKey: ${weekKey}`, 14, 30);
  doc.text(`Range: ${snapshot.range?.from || "-"} → ${snapshot.range?.to || "-"}`, 14, 35);

  const summary = snapshot.summary || {};

  // Summary Table
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

  // Engineer Breakdown Table
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
        e.name || "Unknown Engineer",
        String(e.pending || 0),
        String(e.done || 0),
        String(e.cancelled || 0),
        String(total),
        `${donePct}%`,
      ];
    }),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(fileName);
}
