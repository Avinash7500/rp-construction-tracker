import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatCurrency(value) {
  return `Rs ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportProjectEstimatePdf(estimate) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("RP Construction Tracker", 14, 14);
  pdf.setFontSize(12);
  pdf.text("Project Estimate", 14, 21);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Client: ${estimate.clientName || "-"}`, 14, 30);
  pdf.text(`Project: ${estimate.projectName || "-"}`, 14, 35);
  pdf.text(`Location: ${estimate.location || "-"}`, 14, 40);
  pdf.text(`Generated: ${new Date().toLocaleString("en-GB")}`, pageWidth - 74, 30);
  pdf.text(`Timeline: ${estimate.estimatedTimeline || "-"}`, pageWidth - 74, 35);
  pdf.text(`Status: ${estimate.status || "DRAFT"}`, pageWidth - 74, 40);

  autoTable(pdf, {
    startY: 48,
    head: [["Executive Summary", "Value"]],
    body: [
      ["Total Estimate", formatCurrency(estimate.totalEstimate)],
      ["Cost per Sq Ft", formatCurrency(estimate.costPerSqFt)],
      ["Floors", String(estimate.floorRows?.length || 0)],
      ["Built-up Area", `${Math.round(estimate.totalArea || 0).toLocaleString("en-IN")} sq ft`],
      ["Extras", formatCurrency(estimate.extrasTotal)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 55 } },
    tableWidth: 125,
  });

  autoTable(pdf, {
    startY: (pdf.lastAutoTable?.finalY || 80) + 6,
    head: [["Floor", "Area (sq ft)", "Rate", "Multiplier", "Amount"]],
    body: (estimate.floorRows || []).map((floor) => [
      floor.name || "-",
      Math.round(floor.area || 0).toLocaleString("en-IN"),
      formatCurrency(floor.rate || 0),
      Number(floor.labourMultiplier || 1).toFixed(2),
      formatCurrency(floor.floorCost || 0),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  const extrasRows = [
    ...(estimate.predefinedExtras || [])
      .filter((x) => x.enabled)
      .map((x) => [x.label || "-", "1", formatCurrency(x.cost), formatCurrency(x.cost)]),
    ...(estimate.customAddons || []).map((x) => [
      x.name || "-",
      String(Number(x.quantity) || 0),
      formatCurrency(x.unitCost),
      formatCurrency(x.total),
    ]),
  ];
  autoTable(pdf, {
    startY: (pdf.lastAutoTable?.finalY || 120) + 6,
    head: [["Extra Item", "Qty", "Unit Cost", "Total"]],
    body: extrasRows.length > 0 ? extrasRows : [["No extras selected", "-", "-", "-"]],
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85] },
  });

  autoTable(pdf, {
    startY: (pdf.lastAutoTable?.finalY || 170) + 6,
    head: [["Category", "Percent", "Amount"]],
    body: (estimate.categorySplit || []).map((row) => [
      row.label || "-",
      `${Number(row.percent || 0).toFixed(2)}%`,
      formatCurrency(row.amount || 0),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [22, 101, 52] },
  });

  autoTable(pdf, {
    startY: (pdf.lastAutoTable?.finalY || 220) + 6,
    head: [["Stage", "Trigger", "Percent", "Amount"]],
    body: (estimate.paymentStages || []).map((stage) => [
      stage.stage || "-",
      stage.trigger || "-",
      `${Number(stage.percent || 0).toFixed(2)}%`,
      formatCurrency(stage.amount || 0),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [124, 45, 18] },
  });

  const finalY = (pdf.lastAutoTable?.finalY || 260) + 8;
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    "Disclaimer: This is an approximate estimate. Actual costs may vary depending on market conditions.",
    14,
    Math.min(finalY, 286),
  );

  const filePart = (estimate.projectName || "project").replace(/\s+/g, "_");
  pdf.save(`rp_project_estimate_${filePart}_${nowStamp()}.pdf`);
}
