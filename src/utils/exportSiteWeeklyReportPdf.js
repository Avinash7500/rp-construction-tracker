import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDate(value) {
  const d = safeToDate(value);
  if (!d) return "-";
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
}

function nowStamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

function parseIsoWeekKey(weekKey) {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey || "");
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (Number.isNaN(year) || Number.isNaN(week)) return null;

  // ISO Monday of week 1 is the week containing Jan 4.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);
  return monday;
}

function getSunSatRangeLabel(weekKey) {
  const mondayUtc = parseIsoWeekKey(weekKey);
  if (!mondayUtc) return weekKey || "-";

  const sunday = new Date(mondayUtc);
  sunday.setUTCDate(mondayUtc.getUTCDate() - 1);
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);

  const start = sunday.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const end = saturday.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${start} - ${end}`;
}

function diffDaysFromNow(value) {
  const d = safeToDate(value);
  if (!d) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function exportSiteWeeklyReportPdf({
  siteName,
  weekKey,
  tasks,
}) {
  // Centralized soft color palette for clean, printable contrast.
  const COLOR = {
    header: [15, 23, 42],
    textDark: [17, 24, 39],
    textMuted: [100, 116, 139],
    doneText: [21, 128, 61],
    doneBg: [240, 253, 244],
    pendingText: [146, 64, 14],
    pendingBg: [255, 251, 235],
    carryText: [154, 52, 18],
    carryBg: [255, 237, 213],
    highPendingText: [255, 255, 255],
    highPendingBg: [185, 28, 28],
    completionRiskText: [153, 27, 27],
    completionRiskBg: [254, 226, 226],
  };

  const rows = (tasks || []).map((task, idx) => {
    const isCarryForward = task.isCarryForward === true || (task.pendingWeeks || 0) > 0;
    const overdueDays = isCarryForward
      ? diffDaysFromNow(task.originalExpectedCompletionDate || task.expectedCompletionDate)
      : 0;
    const status = (task.status || "PENDING").toUpperCase();
    const isHighPriorityPending = status === "PENDING" && (task.priority || "NORMAL") === "HIGH";

    return {
      sr: idx + 1,
      title: task.title || "-",
      type:
        isCarryForward && overdueDays > 0
          ? `Carry Forward (${overdueDays} days overdue)`
          : isCarryForward
            ? "Carry Forward"
            : "New",
      status,
      expectedDate: formatDate(task.expectedCompletionDate),
      overdueDays: overdueDays > 0 ? String(overdueDays) : "-",
      isCarryForward,
      isHighPriorityPending,
    };
  });

  const total = rows.length;
  const completed = rows.filter((r) => r.status === "DONE").length;
  const pending = rows.filter((r) => r.status === "PENDING").length;
  const carryForward = rows.filter((r) => r.isCarryForward).length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pendingRatio = total > 0 ? pending / total : 0;

  const pdf = new jsPDF("p", "mm", "a4");
  pdf.setTextColor(...COLOR.textDark);
  pdf.setFontSize(16);
  pdf.text("RP Construction Tracker", 14, 14);
  pdf.setFontSize(12);
  pdf.text("Weekly Site Report", 14, 21);

  pdf.setFontSize(10);
  pdf.text(`Site Name: ${siteName || "-"}`, 14, 29);
  pdf.text(`Week: ${weekKey || "-"}`, 14, 34);
  pdf.text(`Week Range: ${getSunSatRangeLabel(weekKey)}`, 14, 39);
  pdf.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 44);

  autoTable(pdf, {
    startY: 50,
    head: [["Metric", "Value"]],
    body: [
      ["Total Tasks", String(total)],
      ["Completed", String(completed)],
      ["Pending", String(pending)],
      ["Carry Forward", String(carryForward)],
      ["Completion Rate", `${completionPct}%`],
    ],
    headStyles: { fillColor: COLOR.header },
    styles: { fontSize: 9, cellPadding: 2.5 },
    tableWidth: 90,
    // Summary color logic:
    // - Metric values are color-coded for fast executive scanning.
    // - Completion rate turns red when pending ratio exceeds 50%.
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const metric = data.row.raw?.[0];
      const isValueCell = data.column.index === 1;
      if (!isValueCell) return;

      if (metric === "Completed") {
        data.cell.styles.textColor = COLOR.doneText;
        data.cell.styles.fillColor = COLOR.doneBg;
      } else if (metric === "Pending") {
        data.cell.styles.textColor = COLOR.pendingText;
        data.cell.styles.fillColor = COLOR.pendingBg;
      } else if (metric === "Carry Forward") {
        data.cell.styles.textColor = COLOR.carryText;
        data.cell.styles.fillColor = COLOR.carryBg;
      } else if (metric === "Completion Rate" && pendingRatio > 0.5) {
        data.cell.styles.textColor = COLOR.completionRiskText;
        data.cell.styles.fillColor = COLOR.completionRiskBg;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const tableStartY = (pdf.lastAutoTable?.finalY || 82) + 6;
  if (rows.length === 0) {
    pdf.setFontSize(11);
    pdf.text("No tasks recorded for this week.", 14, tableStartY);
  } else {
    autoTable(pdf, {
      startY: tableStartY,
      head: [["Sr", "Task Name", "Type", "Status", "Expected Date", "Overdue Days"]],
      body: rows.map((r) => [r.sr, r.title, r.type, r.status, r.expectedDate, r.overdueDays]),
      headStyles: { fillColor: COLOR.header },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 55 },
        2: { cellWidth: 45 },
        3: { cellWidth: 22 },
        4: { cellWidth: 28 },
        5: { cellWidth: 24, halign: "center" },
      },
      // Conditional row styling:
      // - Detect per-row state using the original `rows` model via row index.
      // - Apply soft status fills for readability and print-safe contrast.
      // - High-priority pending gets white text + red fill to stand out.
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const rowModel = rows[data.row.index];
        if (!rowModel) return;

        const isDone = rowModel.status === "DONE";
        const isPending = rowModel.status === "PENDING";
        const isHighPending = rowModel.isHighPriorityPending;
        const isCarryForward = rowModel.isCarryForward;
        const isStatusCol = data.column.index === 3;
        const isTypeCol = data.column.index === 2;

        // Priority detection: only HIGH + PENDING uses red emphasis.
        if (isStatusCol && isHighPending) {
          data.cell.styles.fillColor = COLOR.highPendingBg;
          data.cell.styles.textColor = COLOR.highPendingText;
          data.cell.styles.fontStyle = "bold";
          return;
        }

        if (isStatusCol && isDone) {
          data.cell.styles.fillColor = COLOR.doneBg;
          data.cell.styles.textColor = COLOR.doneText;
          data.cell.styles.fontStyle = "bold";
        } else if (isStatusCol && isPending) {
          data.cell.styles.fillColor = COLOR.pendingBg;
          data.cell.styles.textColor = COLOR.pendingText;
          data.cell.styles.fontStyle = "bold";
        }

        if (isTypeCol && isCarryForward) {
          data.cell.styles.fillColor = COLOR.carryBg;
          data.cell.styles.textColor = COLOR.carryText;
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => {
        pdf.setFontSize(8);
        pdf.setTextColor(...COLOR.textMuted);
        pdf.text("RP Construction Tracker - Weekly Site Report", 14, 287);
      },
    });
  }

  pdf.save(`rp_weekly_site_report_${(siteName || "site").replace(/\s+/g, "_")}_${weekKey || "week"}_${nowStamp()}.pdf`);
}
