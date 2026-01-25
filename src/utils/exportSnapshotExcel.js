// src/utils/exportSnapshotExcel.js
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

function nowFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}`;
}

function setAutoWidth(worksheet) {
  worksheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      const len = v ? String(v).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 12), 55);
  });
}

function styleHeaderRow(worksheet) {
  const header = worksheet.getRow(1);
  header.height = 20;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addRowBorders(worksheet) {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    });
  });
}

export async function exportSnapshotToExcel(snapshot) {
  if (!snapshot) throw new Error("Snapshot missing");

  const weekKey = snapshot.weekKey || snapshot.id || "UNKNOWN_WEEK";
  const stamp = nowFileStamp();
  const fileName = `RP_Snapshot_${weekKey}_${stamp}.xlsx`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "RP Construction Tracker";
  wb.created = new Date();

  // ✅ Sheet 1: Summary
  const wsSummary = wb.addWorksheet("Summary");
  wsSummary.columns = [
    { header: "Field", key: "field" },
    { header: "Value", key: "value" },
  ];

  const summary = snapshot.summary || {};
  wsSummary.addRow({ field: "WeekKey", value: weekKey });
  wsSummary.addRow({ field: "Range From", value: snapshot.range?.from || "-" });
  wsSummary.addRow({ field: "Range To", value: snapshot.range?.to || "-" });

  wsSummary.addRow({ field: "Total Sites", value: summary.totalSites ?? 0 });
  wsSummary.addRow({ field: "Total Tasks", value: summary.totalTasks ?? 0 });
  wsSummary.addRow({ field: "Done", value: summary.done ?? 0 });
  wsSummary.addRow({ field: "Pending", value: summary.pending ?? 0 });
  wsSummary.addRow({ field: "Cancelled", value: summary.cancelled ?? 0 });
  wsSummary.addRow({ field: "Overdue", value: summary.overdue ?? 0 });

  styleHeaderRow(wsSummary);
  addRowBorders(wsSummary);
  setAutoWidth(wsSummary);

  // ✅ Sheet 2: Engineer Breakdown
  const wsEng = wb.addWorksheet("Engineer Breakdown");
  wsEng.columns = [
    { header: "Engineer", key: "name" },
    { header: "Engineer UID", key: "uid" },
    { header: "Pending", key: "pending" },
    { header: "Done", key: "done" },
    { header: "Cancelled", key: "cancelled" },
    { header: "Total", key: "total" },
    { header: "Completion %", key: "completion" },
  ];

  const engineers = snapshot.engineerBreakdown || [];
  engineers.forEach((e) => {
    const total = (e.pending || 0) + (e.done || 0) + (e.cancelled || 0);
    const completion = total > 0 ? Math.round(((e.done || 0) / total) * 100) : 0;

    wsEng.addRow({
      name: e.name || "Unknown Engineer",
      uid: e.engineerUid || "-",
      pending: e.pending || 0,
      done: e.done || 0,
      cancelled: e.cancelled || 0,
      total,
      completion,
    });
  });

  styleHeaderRow(wsEng);
  addRowBorders(wsEng);

  // highlight completion cells
  wsEng.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const completionCell = row.getCell(7);
    completionCell.numFmt = "0%";
    completionCell.value = Number(completionCell.value || 0) / 100;
  });

  setAutoWidth(wsEng);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, fileName);
}
