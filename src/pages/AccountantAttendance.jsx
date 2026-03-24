import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AccountantShell from "../components/AccountantShell";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import { formatMarathiWeekFromWeekKey } from "../utils/marathiWeekFormat";
import { FONT_BASE64 } from "../utils/pdf/font";

const STATUS_OPTIONS = ["Present", "Absent", "Leave", "Half Day"];
const PAGE_SIZE = 15;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromDateKey(dateKey) {
  const [y, m, d] = (dateKey || "").split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function getIsoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}

function getPreviousDateKey(dateKey) {
  const d = fromDateKey(dateKey);
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function compareDateDesc(a, b) {
  const ad = String(a?.date || "");
  const bd = String(b?.date || "");
  if (ad !== bd) return bd.localeCompare(ad);
  return toMillis(b?.updatedAt) - toMillis(a?.updatedAt);
}

function statusClass(status) {
  if (status === "Present") return "present";
  if (status === "Absent") return "absent";
  if (status === "Half Day") return "halfday";
  return "leave";
}

function getPageItems(rows, page) {
  const start = (page - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

function Pagination({ page, totalItems, onChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (totalItems <= PAGE_SIZE) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) pages.push(i);
  return (
    <div className="attendance-pagination">
      <button className="btn-muted-action" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}>
        Previous
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={`btn-muted-action ${p === page ? "active-page" : ""}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button className="btn-muted-action" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        Next
      </button>
    </div>
  );
}

async function exportAttendancePdf(title, subtitle, attendanceData = []) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const text = (value) => (value ?? "-").toString();
  if (!pdf.getFontList()?.NotoSans) {
    pdf.addFileToVFS("NotoSans.ttf", FONT_BASE64);
    pdf.addFont("NotoSans.ttf", "NotoSans", "normal");
  }
  pdf.setFont("NotoSans");

  // Mandatory debugging log
  // eslint-disable-next-line no-console
  console.log("Attendance Data for PDF:", attendanceData);

  const tableData = attendanceData.map((item) => [
    item?.date || "-",
    item?.name || "-",
    item?.role || "-",
    item?.status || "-",
    item?.note || "-",
  ]);

  const generatedAt = new Date().toLocaleString("en-GB");

  autoTable(pdf, {
    startY: 92,
    head: [["Date", "Name", "Role", "Status", "Note"].map((h) => text(h))],
    body: tableData.map((row) => row.map((cell) => text(cell))),
    styles: {
      font: "NotoSans",
      fontStyle: "normal",
      fontSize: 9.5,
      cellPadding: 4,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      font: "NotoSans",
      fontStyle: "bold",
      fontSize: 10,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 88 },
      2: { cellWidth: 70 },
      3: { cellWidth: 56 },
      4: { cellWidth: "auto" },
    },
    margin: { left: 26, right: 26, top: 92, bottom: 40 },
    didDrawPage: (data) => {
      const pageWidth = pdf.internal.pageSize.getWidth();
      pdf.setFillColor(219, 234, 254);
      pdf.rect(0, 0, pageWidth, 64, "F");
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("NotoSans", "normal");
      pdf.setFontSize(16);
      pdf.text(text("RP Construction"), 26, 26);
      pdf.setFontSize(12);
      pdf.text(text(title || "Attendance Report"), 26, 42);
      pdf.setFontSize(9.5);
      pdf.text(text(subtitle || "-"), 26, 55);

      if (data.pageNumber === 1) {
        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(8.5);
        pdf.text(text(`Generated: ${generatedAt}`), pageWidth - 180, 26);
      }
    },
  });

  const totalPages = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("NotoSans", "normal");
    pdf.setFontSize(8.5);
    pdf.text(text("Generated by RP Construction Tracker"), 26, pageHeight - 14);
    pdf.text(text(`Page ${page} of ${totalPages}`), pageWidth - 90, pageHeight - 14);
  }

  pdf.save(`attendance_${Date.now()}.pdf`);
}

export default function AccountantAttendance() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [staff, setStaff] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState("");
  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "ENGINEER",
    mobileNumber: "",
    isActive: true,
  });
  const [staffFormError, setStaffFormError] = useState("");
  const [historyFrom, setHistoryFrom] = useState(toDateKey(new Date(Date.now() - 6 * 86400000)));
  const [historyTo, setHistoryTo] = useState(toDateKey(new Date()));
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyRole, setHistoryRole] = useState("");
  const [historyPersonId, setHistoryPersonId] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [staffPage, setStaffPage] = useState(1);

  const currentWeekLabel = useMemo(() => {
    const weekKey = getIsoWeekKey(fromDateKey(selectedDate));
    return formatMarathiWeekFromWeekKey(weekKey);
  }, [selectedDate]);

  const activeStaff = useMemo(
    () => staff.filter((p) => p.isActive !== false),
    [staff],
  );
  const staffById = useMemo(() => {
    const map = {};
    staff.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [staff]);

  const pagedHistoryRows = useMemo(() => getPageItems(historyRows, historyPage), [historyRows, historyPage]);
  const pagedStaffRows = useMemo(() => getPageItems(staff, staffPage), [staff, staffPage]);

  const loadStaff = async () => {
    const snap = await getDocs(query(collection(db, "attendance_staff"), orderBy("name", "asc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };

  const loadDayAttendance = async (dateKey, staffList) => {
    const daySnap = await getDocs(
      query(collection(db, "attendance_records"), where("date", "==", dateKey)),
    );
    const recMap = {};
    daySnap.docs.forEach((d) => {
      recMap[d.data().personId] = d.data();
    });
    const rows = staffList
      .filter((p) => p.isActive !== false)
      .map((p) => ({
        personId: p.id,
        name: p.name || "-",
        role: p.role || "STAFF",
        status: recMap[p.id]?.status || "Present",
        note: recMap[p.id]?.note || "",
      }));
    setDailyRows(rows);
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const from = historyFrom || selectedDate;
      const to = historyTo || selectedDate;
      const qRef = query(
        collection(db, "attendance_records"),
        where("date", ">=", from),
        where("date", "<=", to),
        orderBy("date", "desc"),
      );
      const snap = await getDocs(qRef);
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => !historyStatus || r.status === historyStatus)
        .filter((r) => !historyRole || (r.personRole || r.role || staffById[r.personId]?.role) === historyRole)
        .filter((r) => !historyPersonId || r.personId === historyPersonId)
        .sort(compareDateDesc);
      setHistoryRows(rows);
      setHistoryPage(1);
    } catch (e) {
      showError(e, "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const bootstrap = async () => {
    try {
      setLoading(true);
      const staffList = await loadStaff();
      setStaff(staffList);
      await loadDayAttendance(selectedDate, staffList);
      await loadHistory();
    } catch (e) {
      showError(e, "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (staff.length === 0) {
      setDailyRows([]);
      return;
    }
    loadDayAttendance(selectedDate, staff).catch((e) => {
      showError(e, "Failed to load attendance for date");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (!loading) {
      loadHistory().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFrom, historyTo, historyStatus, historyRole, historyPersonId]);

  const refreshAttendanceData = async () => {
    try {
      setLoading(true);
      const staffList = await loadStaff();
      setStaff(staffList);
      setStaffPage(1);
      await loadDayAttendance(selectedDate, staffList);
      await loadHistory();
      showSuccess("Attendance refreshed");
    } catch (e) {
      showError(e, "Refresh failed");
    } finally {
      setLoading(false);
    }
  };

  const setRowStatus = (personId, status) => {
    setDailyRows((prev) =>
      prev.map((r) => (r.personId === personId ? { ...r, status } : r)),
    );
  };

  const setRowNote = (personId, note) => {
    setDailyRows((prev) =>
      prev.map((r) => (r.personId === personId ? { ...r, note } : r)),
    );
  };

  const markAllPresent = () => {
    setDailyRows((prev) => prev.map((r) => ({ ...r, status: "Present" })));
  };

  const copyYesterday = async () => {
    try {
      const yDate = getPreviousDateKey(selectedDate);
      const ySnap = await getDocs(
        query(collection(db, "attendance_records"), where("date", "==", yDate)),
      );
      const map = {};
      ySnap.docs.forEach((d) => {
        const row = d.data();
        map[row.personId] = row;
      });
      setDailyRows((prev) =>
        prev.map((r) => ({
          ...r,
          status: map[r.personId]?.status || "Present",
          note: map[r.personId]?.note || "",
        })),
      );
      showSuccess("Copied yesterday attendance");
    } catch (e) {
      showError(e, "Failed to copy yesterday attendance");
    }
  };

  const saveAttendance = async () => {
    try {
      setSaving(true);
      const batch = writeBatch(db);
      const weekKey = getIsoWeekKey(fromDateKey(selectedDate));

      dailyRows.forEach((row) => {
        const ref = doc(db, "attendance_records", `${selectedDate}_${row.personId}`);
        batch.set(
          ref,
          {
            personId: row.personId,
            personName: row.name || "-",
            personRole: row.role || "STAFF",
            date: selectedDate,
            weekKey,
            status: STATUS_OPTIONS.includes(row.status) ? row.status : "Present",
            note: (row.note || "").trim(),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await batch.commit();
      showSuccess("Attendance saved");
      await loadDayAttendance(selectedDate, staff);
      await loadHistory();
    } catch (e) {
      showError(e, "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const openAddStaff = () => {
    setEditingStaffId("");
    setStaffFormError("");
    setStaffForm({
      name: "",
      role: "ENGINEER",
      mobileNumber: "",
      isActive: true,
    });
    setStaffModalOpen(true);
  };

  const openEditStaff = (person) => {
    setEditingStaffId(person.id);
    setStaffFormError("");
    setStaffForm({
      name: person.name || "",
      role: person.role || "ENGINEER",
      mobileNumber: person.mobileNumber || "",
      isActive: person.isActive !== false,
    });
    setStaffModalOpen(true);
  };

  const saveStaff = async () => {
    if (!staffForm.name.trim()) {
      setStaffFormError("Name is required.");
      return;
    }
    if (!/^\d{10}$/.test((staffForm.mobileNumber || "").trim())) {
      setStaffFormError("Mobile number must be exactly 10 digits.");
      return;
    }
    try {
      const id = editingStaffId || doc(collection(db, "attendance_staff")).id;
      await setDoc(
        doc(db, "attendance_staff", id),
        {
          name: staffForm.name.trim(),
          role: staffForm.role === "STAFF" ? "STAFF" : "ENGINEER",
          mobileNumber: (staffForm.mobileNumber || "").trim(),
          isActive: !!staffForm.isActive,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
      showSuccess(editingStaffId ? "Person updated" : "Person added");
      setStaffModalOpen(false);
      const next = await loadStaff();
      setStaff(next);
      setStaffPage(1);
      await loadDayAttendance(selectedDate, next);
    } catch (e) {
      showError(e, "Failed to save person");
    }
  };

  const disableStaff = async (person) => {
    try {
      await updateDoc(doc(db, "attendance_staff", person.id), {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
      showSuccess("Person disabled");
      const next = await loadStaff();
      setStaff(next);
      setStaffPage(1);
      await loadDayAttendance(selectedDate, next);
    } catch (e) {
      showError(e, "Failed to disable person");
    }
  };

  const exportHistoryPdf = async () => {
    const attendanceData = [...historyRows]
      .sort(compareDateDesc)
      .map((r) => {
        const staffMeta = staffById[r.personId] || {};
        return {
          date: r.date || "-",
          name: r.personName || r.name || staffMeta.name || "-",
          role: r.personRole || r.role || staffMeta.role || "-",
          status: r.status || "-",
          note: r.note || "-",
        };
      });

    await exportAttendancePdf(
      "Attendance Report",
      `Range: ${historyFrom || "-"} to ${historyTo || "-"}`,
      attendanceData,
    );
  };

  const exportDailyPdf = async () => {
    const attendanceData = [...dailyRows].map((r) => {
      const staffMeta = staffById[r.personId] || {};
      return {
        date: selectedDate,
        name: r.name || staffMeta.name || "-",
        role: r.role || staffMeta.role || "-",
        status: r.status || "-",
        note: r.note || "-",
      };
    });

    await exportAttendancePdf(
      "Attendance Report",
      `Date: ${selectedDate} | Week: ${currentWeekLabel}`,
      attendanceData,
    );
  };

  return (
    <AccountantShell
      title="Attendance"
      subtitle="Daily attendance management for engineers and office staff"
      actions={(
        <>
          <button className="btn-primary-v5" onClick={saveAttendance} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </>
      )}
    >
      <div className="attendance-module">
        <section className="acc-card">
          <div className="acc-card-header">
            <h3 style={{ margin: 0 }}>Attendance Entry</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                className="stage-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button className="btn-muted-action" onClick={markAllPresent}>Mark All Present</button>
              <button className="btn-muted-action" onClick={copyYesterday}>Copy Yesterday</button>
              <button className="btn-muted-action" onClick={exportDailyPdf}>Export PDF</button>
            </div>
          </div>
          <div className="acc-card-body">
            <div className="attendance-week-chip">
              Current Week: {currentWeekLabel}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>Loading...</td>
                    </tr>
                  ) : dailyRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>
                        No active staff available. Add person first.
                      </td>
                    </tr>
                  ) : (
                    dailyRows.map((row) => (
                      <tr key={row.personId}>
                        <td>{row.name}</td>
                        <td>{row.role === "ENGINEER" ? "Engineer" : "Staff"}</td>
                        <td style={{ minWidth: 160 }}>
                          <select
                            className={`stage-select attendance-status-${statusClass(row.status)}`}
                            value={row.status}
                            onChange={(e) => setRowStatus(row.personId, e.target.value)}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="sheet-input-text"
                            value={row.note}
                            onChange={(e) => setRowNote(row.personId, e.target.value)}
                            placeholder="Note"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="acc-card">
          <div className="acc-card-header">
            <h3 style={{ margin: 0 }}>Attendance History</h3>
            <div className="attendance-action-row">
              <button className="btn-muted-action" onClick={loadHistory} disabled={historyLoading}>Apply Filter</button>
              <button className="btn-muted-action" onClick={refreshAttendanceData} disabled={loading}>Refresh</button>
              <button className="btn-muted-action" onClick={exportHistoryPdf}>Export PDF</button>
            </div>
          </div>
          <div className="acc-card-body">
            <div className="attendance-filter-grid">
              <div>
                <label className="attendance-label">From</label>
                <input type="date" className="stage-select" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
              </div>
              <div>
                <label className="attendance-label">To</label>
                <input type="date" className="stage-select" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
              </div>
              <div>
                <label className="attendance-label">Status</label>
                <select className="stage-select" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}>
                  <option value="">All</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="attendance-label">Role</label>
                <select className="stage-select" value={historyRole} onChange={(e) => setHistoryRole(e.target.value)}>
                  <option value="">All</option>
                  <option value="ENGINEER">Engineer</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
              <div>
                <label className="attendance-label">Person</label>
                <select className="stage-select" value={historyPersonId} onChange={(e) => setHistoryPersonId(e.target.value)}>
                  <option value="">All</option>
                  {activeStaff.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>Loading...</td>
                    </tr>
                  ) : historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No records found for selected filters.</td>
                    </tr>
                  ) : (
                    pagedHistoryRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.date || "-"}</td>
                        <td>{row.personName || row.name || staffById[row.personId]?.name || "-"}</td>
                        <td>{row.personRole || row.role || staffById[row.personId]?.role || "-"}</td>
                        <td>{row.status || "-"}</td>
                        <td>{row.note || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={historyPage} totalItems={historyRows.length} onChange={setHistoryPage} />
          </div>
        </section>

        <section className="acc-card">
          <div className="acc-card-header">
            <h3 style={{ margin: 0 }}>Staff Master</h3>
            <button className="btn-muted-action" onClick={openAddStaff}>Add New Person</button>
          </div>
          <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                      No staff added yet.
                    </td>
                  </tr>
                ) : (
                  pagedStaffRows.map((person) => (
                    <tr key={person.id}>
                      <td>{person.name || "-"}</td>
                      <td>{person.role === "ENGINEER" ? "Engineer" : "Staff"}</td>
                      <td>{person.mobileNumber || "-"}</td>
                      <td>
                        <span className={`acc-tag ${person.isActive === false ? "inactive" : ""}`}>
                          {person.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-muted-action" onClick={() => openEditStaff(person)}>Edit</button>
                          {person.isActive !== false ? (
                            <button className="btn-muted-action" onClick={() => disableStaff(person)}>Disable</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <Pagination page={staffPage} totalItems={staff.length} onChange={setStaffPage} />
          </div>
        </section>
      </div>

      {staffModalOpen ? (
        <div className="acc-modal-backdrop">
          <div className="acc-modal">
            <h3 style={{ marginTop: 0 }}>{editingStaffId ? "Edit Person" : "Add Person"}</h3>
            <div className="attendance-form-grid">
              <div>
                <label className="attendance-label">Name *</label>
                <input
                  className="sheet-input-text"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="attendance-label">Role</label>
                <select
                  className="stage-select"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm((p) => ({ ...p, role: e.target.value }))}
                >
                  <option value="ENGINEER">Engineer</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
              <div>
                <label className="attendance-label">Mobile Number *</label>
                <input
                  className="sheet-input-text"
                  value={staffForm.mobileNumber}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, "");
                    setStaffForm((p) => ({ ...p, mobileNumber: onlyDigits }));
                    if (staffFormError) setStaffFormError("");
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "end" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={staffForm.isActive}
                    onChange={(e) => setStaffForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>
            {staffFormError ? (
              <div style={{ marginTop: 10, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                {staffFormError}
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="btn-muted-action" onClick={() => setStaffModalOpen(false)}>Cancel</button>
              <button className="btn-primary-v5" onClick={saveStaff}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </AccountantShell>
  );
}
