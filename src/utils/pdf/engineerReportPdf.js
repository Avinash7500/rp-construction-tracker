import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ensureMarathiPdfFont, pdfTextSafe } from "../pdfMarathiFont";
import {
  formatDate,
  formatDateTime,
  getDayLabel,
  getWeekLabel,
} from "../engineerReportFormatters";

function buildFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function getLatestReason(task) {
  if (!task) return "-";
  if (typeof task.latestPendingReason === "string" && task.latestPendingReason.trim()) {
    return task.latestPendingReason.trim();
  }
  if (
    task.latestPendingReason &&
    typeof task.latestPendingReason === "object" &&
    typeof task.latestPendingReason.reasonType === "string" &&
    task.latestPendingReason.reasonType.trim()
  ) {
    return task.latestPendingReason.reasonType.trim();
  }
  return "-";
}

function prepareRows(tasks = []) {
  return tasks.map((task) => ({
    title: task?.title || "-",
    site: task?.siteName || "-",
    week: getWeekLabel(
      task?.weekKey || task?.week || null,
      task?.expectedCompletionDate || task?.dueDate || null,
    ),
    status: task?.status || "-",
    priority: task?.priority || "-",
    day: getDayLabel(task?.day || task?.dayName || null),
    dueDate: formatDate(task?.dueDate || task?.expectedCompletionDate),
    updated: formatDateTime(task?.updatedAt),
    reason: getLatestReason(task),
  }));
}

export async function generateEngineerReportPDF({
  engineerName = "-",
  filters = {},
  tasks = [],
}) {
  const doc = new jsPDF("p", "mm", "a4");
  const hasMarathiFont = await ensureMarathiPdfFont(doc);
  if (!hasMarathiFont) doc.setFont("helvetica", "normal");
  const text = (value) => pdfTextSafe(value, hasMarathiFont);
  const rows = prepareRows(tasks);

  const statusFilter = filters.status || "ALL";
  const priorityFilter = filters.priority || "ALL";
  const generatedAt = formatDateTime(new Date());
  const fileName = "Engineer_Report.pdf";

  doc.setFontSize(20);
  doc.text(text("RP Construction"), 14, 16);
  doc.setFontSize(14);
  doc.text(text("Engineer Task Report"), 14, 25);
  doc.setFontSize(11);
  doc.text(text(`Engineer: ${engineerName || "-"}`), 14, 34);
  doc.text(text(`Generated: ${generatedAt}`), 14, 40);
  doc.text(
    text(`Filters: Status=${statusFilter} | Priority=${priorityFilter}`),
    14,
    46,
  );

  autoTable(doc, {
    startY: 50,
    head: [
      [
        "Task",
        "Site",
        "Week",
        "Status",
        "Priority",
        "Day",
        "Due Date",
        "Updated",
        "Reason",
      ],
    ],
    body: rows.map((row) => [
      text(row.title),
      text(row.site),
      text(row.week),
      text(row.status),
      text(row.priority),
      text(row.day),
      text(row.dueDate),
      text(row.updated),
      text(row.reason),
    ]),
    theme: "striped",
    styles: {
      font: hasMarathiFont ? "NotoSans" : "helvetica",
      fontStyle: "normal",
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      font: hasMarathiFont ? "NotoSans" : "helvetica",
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25 },
      7: { cellWidth: 30 },
      8: { cellWidth: 30 },
    },
    margin: { left: 8, right: 8 },
    tableWidth: "auto",
  });

  // Mandatory debug verification
  // eslint-disable-next-line no-console
  console.log(doc.getFontList());
  doc.save(fileName);
  return { fileName, rowCount: rows.length };
}
