import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function buildTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function sanitize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateForPdf(value) {
  const d = toDate(value);
  if (!d) return "-";
  const day = pad2(d.getDate());
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatCurrencyForPdf(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

export function safeCellValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  return String(value);
}

function normalizeRows(rows, columnCount) {
  return (rows || []).map((row) => {
    if (Array.isArray(row)) {
      const next = [];
      for (let i = 0; i < columnCount; i += 1) {
        next.push(safeCellValue(row[i]));
      }
      return next;
    }
    return [];
  });
}

export function buildPdfFileName(reportType = "report", overrideFileName = "") {
  if (overrideFileName) {
    const base = sanitize(overrideFileName.replace(/\.pdf$/i, "")) || "report";
    return `${base}.pdf`;
  }
  return `rp-construction_${sanitize(reportType) || "report"}_${buildTimestamp()}.pdf`;
}

export function generatePdfReport({
  title,
  subtitle,
  columns = [],
  rows = [],
  fileName = "",
  reportType = "report",
  logoText = "RP Construction",
  numberColumns = [],
  columnStyles = {},
  orientation = "landscape",
  unit = "pt",
  format = "a4",
  headerMetaLeft = "",
  headerMetaRight = "",
  summaryCards = [],
}) {
  const doc = new jsPDF({ orientation, unit, format });
  const PAGE_MARGIN = 14;
  const PAGE_WIDTH = doc.internal.pageSize.getWidth();
  const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
  const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);
  const CONTENT_TOP = 8;
  const theme = {
    headerBg: [30, 41, 59],
    headerAccent: [50, 231, 251],
    tableHeadBg: [186, 230, 253],
    tableHeadText: [15, 23, 42],
    tableAltRow: [248, 250, 252],
    tableLine: [203, 213, 225],
    bodyText: [15, 23, 42],
    mutedText: [71, 85, 105],
    cardFill: [241, 245, 249],
    cardBorder: [226, 232, 240],
    cardAccents: [
      [59, 130, 246], // blue
      [16, 185, 129], // emerald
      [245, 158, 11], // amber
      [168, 85, 247], // violet
    ],
  };
  const generatedAt = formatDateForPdf(new Date());
  const headerHeight = 44;
  const headerY = CONTENT_TOP;
  const summaryStartY = headerY + headerHeight + 10;
  const hasSummaryCards = Array.isArray(summaryCards) && summaryCards.length > 0;
  const tableStartY = hasSummaryCards ? summaryStartY + 40 : summaryStartY + 10;

  const renderHeader = () => {
    doc.setDrawColor(...theme.tableLine);
    doc.setLineWidth(0.4);
    doc.roundedRect(PAGE_MARGIN, CONTENT_TOP, CONTENT_WIDTH, PAGE_HEIGHT - CONTENT_TOP - 42, 4, 4, "S");

    doc.setFillColor(...theme.headerBg);
    doc.rect(PAGE_MARGIN, headerY, CONTENT_WIDTH, headerHeight, "F");
    doc.setFillColor(...theme.headerAccent);
    doc.rect(PAGE_MARGIN, headerY + headerHeight - 4, CONTENT_WIDTH, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(logoText, PAGE_MARGIN + 10, headerY + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(safeCellValue(headerMetaLeft || subtitle || "-"), PAGE_MARGIN + 10, headerY + 33);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(safeCellValue(title).toUpperCase(), PAGE_MARGIN + CONTENT_WIDTH - 10, headerY + 20, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(safeCellValue(headerMetaRight || `Generated: ${generatedAt}`), PAGE_MARGIN + CONTENT_WIDTH - 10, headerY + 33, { align: "right" });
  };

  const renderFooter = (pageNumber, totalPages) => {
    doc.setDrawColor(...theme.tableLine);
    doc.line(PAGE_MARGIN, PAGE_HEIGHT - 32, PAGE_MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("RP Construction | Internal Report", PAGE_MARGIN, PAGE_HEIGHT - 18);
    doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE_MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - 18, { align: "right" });
  };

  const renderSummaryCards = () => {
    if (!hasSummaryCards) return;
    const cards = summaryCards.slice(0, 4);
    const CARD_GAP = 6;
    const CARD_COUNT = cards.length;
    const CARD_WIDTH = (CONTENT_WIDTH - (CARD_GAP * (CARD_COUNT - 1))) / CARD_COUNT;
    cards.forEach((card, index) => {
      const x = PAGE_MARGIN + index * (CARD_WIDTH + CARD_GAP);
      const accent = card?.accentColor || theme.cardAccents[index % theme.cardAccents.length];
      doc.setDrawColor(...theme.cardBorder);
      doc.setFillColor(...theme.cardFill);
      doc.roundedRect(x, summaryStartY, CARD_WIDTH, 28, 4, 4, "FD");
      doc.setFillColor(...accent);
      doc.roundedRect(x, summaryStartY, 5, 28, 2, 2, "F");
      doc.setTextColor(...theme.mutedText);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(safeCellValue(card?.label), x + 12, summaryStartY + 11);
      doc.setTextColor(...theme.bodyText);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(safeCellValue(card?.value), x + 12, summaryStartY + 22);
    });
  };

  const finalColumnStyles = { ...columnStyles };
  numberColumns.forEach((index) => {
    finalColumnStyles[index] = {
      ...(finalColumnStyles[index] || {}),
      halign: "right",
    };
  });

  const head = [columns.map((column) => safeCellValue(column))];
  const body = normalizeRows(rows, columns.length);

  renderHeader();
  renderSummaryCards();

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    styles: {
      font: "helvetica",
      fontSize: 10.5,
      textColor: theme.bodyText,
      cellPadding: 6,
      overflow: "linebreak",
      valign: "middle",
      halign: "left",
      lineWidth: 0.35,
      lineColor: theme.tableLine,
    },
    headStyles: {
      fillColor: theme.tableHeadBg,
      textColor: theme.tableHeadText,
      fontStyle: "bold",
      lineColor: theme.tableLine,
      fontSize: 13,
      halign: "left",
      lineWidth: 0.45,
    },
    alternateRowStyles: {
      fillColor: theme.tableAltRow,
    },
    bodyStyles: {
      lineColor: theme.cardBorder,
      lineWidth: 0.35,
    },
    columnStyles: finalColumnStyles,
    margin: { top: tableStartY, left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 40 },
    tableWidth: CONTENT_WIDTH,
    didParseCell: (hookData) => {
      if (numberColumns.includes(hookData.column.index)) {
        hookData.cell.styles.halign = "right";
      }
    },
    didDrawPage: () => {
      renderHeader();
      renderSummaryCards();
    },
  });

  const pages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    renderFooter(page, pages);
  }

  doc.save(buildPdfFileName(reportType, fileName));
}
