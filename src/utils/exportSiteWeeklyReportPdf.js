import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMarathiWeekFromWeekKey } from "./marathiWeekFormat";
import { ensureMarathiPdfFont, pdfTextSafe } from "./pdfMarathiFont";

function safeToDate(value) {
  if (!value) return null;
  try {
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatDate(value) {
  const d = safeToDate(value);
  if (!d) return "-";
  return d.toLocaleDateString("en-GB");
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function exportSiteWeeklyReportPdf({
  siteName,
  weekKey,
  tasks,
}) {
  const pdf = new jsPDF("p", "mm", "a4");
  const hasMarathiFont = await ensureMarathiPdfFont(pdf);
  if (!hasMarathiFont) pdf.setFont("helvetica", "normal");

  const text = (v) => pdfTextSafe(v, hasMarathiFont);
  const rows = (tasks || []).map((task, idx) => ({
    sr: idx + 1,
    title: text(task.title || "-"),
    status: text((task.status || "PENDING").toUpperCase()),
    type: text(task.isCarryForward ? "Carry Forward" : "New"),
    expected: text(formatDate(task.expectedCompletionDate)),
  }));

  const total = rows.length;
  const done = rows.filter((r) => r.status === "DONE").length;
  const pending = rows.filter((r) => r.status === "PENDING").length;
  const cancelled = rows.filter((r) => r.status === "CANCELLED").length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  pdf.setFontSize(15);
  pdf.text("RP Construction Tracker", 14, 14);
  pdf.setFontSize(11);
  pdf.text(text("Weekly Site Report"), 14, 20);

  pdf.setFontSize(10);
  pdf.text(text(`Site: ${siteName || "-"}`), 14, 28);
  pdf.text(text(`Week: ${formatMarathiWeekFromWeekKey(weekKey)}`), 14, 33);
  pdf.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 38);

  autoTable(pdf, {
    startY: 44,
    head: [[text("Metric"), text("Value")]],
    body: [
      [text("Total Tasks"), String(total)],
      [text("Done"), String(done)],
      [text("Pending"), String(pending)],
      [text("Cancelled"), String(cancelled)],
      [text("Completion Rate"), `${completionRate}%`],
    ],
    styles: {
      font: hasMarathiFont ? "NotoSansDevanagari" : "helvetica",
      fontStyle: "normal",
      fontSize: 9,
    },
    headStyles: { fillColor: [15, 23, 42] },
    tableWidth: 90,
  });

  autoTable(pdf, {
    startY: (pdf.lastAutoTable?.finalY || 80) + 8,
    head: [[text("Sr"), text("Task"), text("Type"), text("Status"), text("Expected Date")]],
    body: rows.map((r) => [r.sr, r.title, r.type, r.status, r.expected]),
    styles: {
      font: hasMarathiFont ? "NotoSansDevanagari" : "helvetica",
      fontStyle: "normal",
      fontSize: 8,
    },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 74 },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 34 },
    },
  });

  pdf.save(`rp_weekly_site_report_${(siteName || "site").replace(/\s+/g, "_")}_${weekKey || "week"}_${nowStamp()}.pdf`);
}
