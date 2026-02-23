import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMarathiWeekFromWeekKey } from "./marathiWeekFormat";

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

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function isSupportedTtfBuffer(buffer) {
  const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  if (bytes.length < 4) return false;

  // TrueType signatures supported by jsPDF TTF parser.
  const isTtf =
    bytes[0] === 0x00 &&
    bytes[1] === 0x01 &&
    bytes[2] === 0x00 &&
    bytes[3] === 0x00;
  const isOtf =
    bytes[0] === 0x4f && // O
    bytes[1] === 0x54 && // T
    bytes[2] === 0x54 && // T
    bytes[3] === 0x4f; // O

  // Explicitly reject TTC (font collections), which caused parse errors.
  const isTtc =
    bytes[0] === 0x74 && // t
    bytes[1] === 0x74 && // t
    bytes[2] === 0x63 && // c
    bytes[3] === 0x66; // f

  return (isTtf || isOtf) && !isTtc;
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

function getEnglishWeekLabel(weekKey) {
  const m = /^(\d{4})-W(\d{1,2})$/i.exec((weekKey || "").toString().trim());
  if (!m) return weekKey || "-";
  return `${m[1]} - Week ${Number(m[2])}`;
}

let marathiFontRegistered = false;
const ENABLE_MARATHI_PDF_FONT = false;

async function ensureMarathiPdfFont(pdf) {
  if (!ENABLE_MARATHI_PDF_FONT) return false;
  if (marathiFontRegistered) {
    try {
      pdf.setFont("NotoSansDevanagari", "normal");
      // Ensure usable width metrics exist; otherwise jsPDF autoTable will crash.
      pdf.getStringUnitWidth("test");
      pdf.getStringUnitWidth("अ");
      return true;
    } catch {
      marathiFontRegistered = false;
      return false;
    }
  }

  try {
    const base = import.meta.env.BASE_URL || "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    // jsPDF custom font path must be a Unicode-capable .ttf with cmap table.
    // .ttc font collections (e.g. Nirmala.ttc) are not reliably supported and
    // trigger "No unicode cmap for font" + widths errors.
    const response = await fetch(`${normalizedBase}fonts/NotoSansDevanagari-Regular.ttf`);
    if (!response.ok) return false;

    const buffer = await response.arrayBuffer();
    if (!isSupportedTtfBuffer(buffer)) {
      return false;
    }
    const base64 = arrayBufferToBase64(buffer);

    const fontFile = "NotoSansDevanagari-Regular.ttf";
    const fontName = "NotoSansDevanagari";
    pdf.addFileToVFS(fontFile, base64);
    pdf.addFont(fontFile, fontName, "normal");

    const fontList = pdf.getFontList?.() || {};
    const hasNormal = Array.isArray(fontList[fontName]) && fontList[fontName].includes("normal");
    if (!hasNormal) return false;

    pdf.setFont(fontName, "normal");
    // Validate parsed font metrics before enabling this font globally.
    pdf.getStringUnitWidth("test");
    pdf.getStringUnitWidth("अ");
    marathiFontRegistered = true;
    return true;
  } catch {
    marathiFontRegistered = false;
    try {
      pdf.setFont("helvetica", "normal");
    } catch {
      // no-op
    }
    return false;
  }
}

export async function exportSiteWeeklyReportPdf({
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
  const hasMarathiFont = await ensureMarathiPdfFont(pdf);
  if (!hasMarathiFont) {
    // Fallback prevents malformed glyphs if the custom font fails to load.
    pdf.setFont("helvetica", "normal");
  }

  // If Unicode font is unavailable, sanitize strings so jsPDF width calculation
  // never receives unsupported glyphs (prevents "reading 'widths'" crash).
  const pdfText = (value) => {
    const text = (value ?? "-").toString();
    if (hasMarathiFont) return text;
    // ASCII fallback for environments without Marathi PDF font support.
    // Cleanly collapse unsupported glyphs so table cells don't show noise.
    const cleaned = text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "-";
    // If only punctuation/symbols remain, show a clean placeholder.
    if (!/[A-Za-z0-9]/.test(cleaned)) return "-";
    return cleaned;
  };

  // Display Marathi week text only when Unicode font is active in PDF output.
  const marathiWeekLabel = formatMarathiWeekFromWeekKey(weekKey);
  const weekDisplay = hasMarathiFont && marathiWeekLabel !== "-"
    ? marathiWeekLabel
    : getEnglishWeekLabel(weekKey);

  pdf.setTextColor(...COLOR.textDark);
  pdf.setFontSize(16);
  pdf.text("RP Construction Tracker", 14, 14);
  pdf.setFontSize(12);
  pdf.text("Weekly Site Report", 14, 21);

  pdf.setFontSize(10);
  pdf.text(pdfText(`Site Name: ${siteName || "-"}`), 14, 29);
  pdf.text(pdfText(`Week: ${weekDisplay}`), 14, 34);
  pdf.text(pdfText(`Week Range: ${getSunSatRangeLabel(weekKey)}`), 14, 39);
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
    headStyles: {
      fillColor: COLOR.header,
      font: hasMarathiFont ? "NotoSansDevanagari" : "helvetica",
      fontStyle: hasMarathiFont ? "normal" : "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      font: hasMarathiFont ? "NotoSansDevanagari" : "helvetica",
      fontStyle: "normal",
      overflow: "linebreak",
      valign: "middle",
    },
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
        data.cell.styles.fontStyle = hasMarathiFont ? "normal" : "bold";
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
      body: rows.map((r) => [
        r.sr,
        pdfText(r.title),
        pdfText(r.type),
        pdfText(r.status),
        pdfText(r.expectedDate),
        pdfText(r.overdueDays),
      ]),
      headStyles: {
        fillColor: COLOR.header,
        font: hasMarathiFont ? "NotoSansDevanagari" : "helvetica",
        fontStyle: hasMarathiFont ? "normal" : "bold",
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        font: hasMarathiFont ? "NotoSansDevanagari" : "helvetica",
        fontStyle: "normal",
        overflow: "linebreak",
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 56 },
        2: { cellWidth: 38 },
        3: { cellWidth: 20 },
        4: { cellWidth: 26 },
        5: { cellWidth: 20, halign: "center" },
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
          data.cell.styles.fontStyle = hasMarathiFont ? "normal" : "bold";
          return;
        }

        if (isStatusCol && isDone) {
          data.cell.styles.fillColor = COLOR.doneBg;
          data.cell.styles.textColor = COLOR.doneText;
          data.cell.styles.fontStyle = hasMarathiFont ? "normal" : "bold";
        } else if (isStatusCol && isPending) {
          data.cell.styles.fillColor = COLOR.pendingBg;
          data.cell.styles.textColor = COLOR.pendingText;
          data.cell.styles.fontStyle = hasMarathiFont ? "normal" : "bold";
        }

        if (isTypeCol && isCarryForward) {
          data.cell.styles.fillColor = COLOR.carryBg;
          data.cell.styles.textColor = COLOR.carryText;
          data.cell.styles.fontStyle = hasMarathiFont ? "normal" : "bold";
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
