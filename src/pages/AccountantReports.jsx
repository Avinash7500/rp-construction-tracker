import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import autoTable from "jspdf-autotable";
import AccountantShell from "../components/AccountantShell";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { formatMarathiWeekFromWeekKey } from "../utils/marathiWeekFormat";
import { createPdfDoc } from "../utils/pdf/pdfHelper";
import { generatePdf } from "../utils/pdf/generatePdf";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(monthKey) {
  const [y, m] = (monthKey || "").split("-").map(Number);
  if (!y || !m) return toDateKey(new Date()).slice(0, 7);
  return `${y}-${pad2(m)}-01`;
}

function endOfMonth(monthKey) {
  const [y, m] = (monthKey || "").split("-").map(Number);
  if (!y || !m) return toDateKey(new Date());
  const d = new Date(y, m, 0);
  return toDateKey(d);
}

function labourAmount(row) {
  return (row.mistriCount || 0) * (row.mistriRate || 0)
    + (row.labourCount || 0) * (row.labourRate || 0);
}

function materialBill(row) {
  if (typeof row.billAmount === "number") return row.billAmount;
  return (row.qty || 0) * (row.rate || 0);
}

async function exportReportPdf(title, head, body) {
  const { doc, text } = await createPdfDoc({ unit: "pt" });
  doc.setFontSize(14);
  doc.text(text(title), 40, 36);
  autoTable(doc, {
    startY: 54,
    head: [head.map((h) => text(h))],
    body: body.map((row) => row.map((c) => text(c))),
    styles: {
      fontSize: 9,
      font: "NotoSans",
      fontStyle: "normal",
    },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${title.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export default function AccountantReports() {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [labour, setLabour] = useState([]);
  const [material, setMaterial] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [filterSite, setFilterSite] = useState("");
  const [filterDealer, setFilterDealer] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(toDateKey(new Date()));
  const [attendanceMonth, setAttendanceMonth] = useState(toDateKey(new Date()).slice(0, 7));
  const [attendancePersonId, setAttendancePersonId] = useState("");
  const [attendancePeople, setAttendancePeople] = useState([]);
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [monthlyAttendanceRows, setMonthlyAttendanceRows] = useState([]);
  const [personWiseRows, setPersonWiseRows] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [siteSnap, labourSnap, materialSnap, dealerSnap, paymentSnap, attendanceStaffSnap] = await Promise.all([
        getDocs(collection(db, "sites")),
        getDocs(collection(db, "labour_entries")),
        getDocs(collection(db, "material_entries")),
        getDocs(collection(db, "dealers")),
        getDocs(collection(db, "dealer_payments")),
        getDocs(query(collection(db, "attendance_staff"), orderBy("name", "asc"))),
      ]);
      setSites(siteSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLabour(labourSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMaterial(materialSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setDealers(dealerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPayments(paymentSnap.docs.map((d) => d.data()));
      setAttendancePeople(attendanceStaffSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loadAttendanceBlocks = async () => {
      try {
        const daySnap = await getDocs(
          query(collection(db, "attendance_records"), where("date", "==", attendanceDate)),
        );
        const dayRows = daySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDailyAttendance(dayRows);

        const monthFrom = startOfMonth(attendanceMonth);
        const monthTo = endOfMonth(attendanceMonth);
        const monthSnap = await getDocs(
          query(
            collection(db, "attendance_records"),
            where("date", ">=", monthFrom),
            where("date", "<=", monthTo),
            orderBy("date", "asc"),
          ),
        );
        const monthRows = monthSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const monthlyMap = {};
        monthRows.forEach((row) => {
          const key = row.personId || row.personName || "unknown";
          if (!monthlyMap[key]) {
            monthlyMap[key] = {
              personId: row.personId || "",
              name: row.personName || "-",
              present: 0,
              absent: 0,
              leave: 0,
              halfDay: 0,
            };
          }
          if (row.status === "Absent") monthlyMap[key].absent += 1;
          else if (row.status === "Leave") monthlyMap[key].leave += 1;
          else if (row.status === "Half Day") monthlyMap[key].halfDay += 1;
          else monthlyMap[key].present += 1;
        });
        setMonthlyAttendanceRows(Object.values(monthlyMap));

        if (attendancePersonId) {
          const personSnap = await getDocs(
            query(
              collection(db, "attendance_records"),
              where("personId", "==", attendancePersonId),
            ),
          );
          const personRows = personSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
          setPersonWiseRows(personRows);
        } else {
          setPersonWiseRows([]);
        }
      } catch (e) {
        showError(e, "Failed to load attendance reports");
      }
    };

    loadAttendanceBlocks();
  }, [attendanceDate, attendanceMonth, attendancePersonId]);

  const siteMap = useMemo(() => {
    return sites.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {});
  }, [sites]);

  const dealerMap = useMemo(() => {
    return dealers.reduce((acc, d) => {
      acc[d.id] = d;
      return acc;
    }, {});
  }, [dealers]);

  const paidByEntry = useMemo(() => {
    return payments.reduce((acc, p) => {
      const key = p.materialEntryId || "";
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + (p.paymentAmount || 0);
      return acc;
    }, {});
  }, [payments]);

  const siteFinancialSummary = useMemo(() => {
    return sites.map((site) => {
      const labourTotal = labour
        .filter((l) => l.siteId === site.id && !l.isPlaceholder)
        .reduce((sum, row) => sum + labourAmount(row), 0);
      const materialTotal = material
        .filter((m) => m.siteId === site.id && !m.isPlaceholder)
        .reduce((sum, row) => sum + materialBill(row), 0);
      return {
        siteName: site.name || site.id,
        engineer: site.assignedEngineerName || "-",
        labourTotal,
        materialTotal,
        grandTotal: labourTotal + materialTotal,
      };
    });
  }, [sites, labour, material]);

  const weeklyExpense = useMemo(() => {
    const map = {};
    labour.forEach((row) => {
      if (row.isPlaceholder) return;
      const key = `${row.weekKey}__${row.siteId}`;
      if (!map[key]) {
        map[key] = { weekKey: row.weekKey, siteId: row.siteId, labour: 0, material: 0 };
      }
      map[key].labour += labourAmount(row);
    });
    material.forEach((row) => {
      if (row.isPlaceholder) return;
      const key = `${row.weekKey}__${row.siteId}`;
      if (!map[key]) {
        map[key] = { weekKey: row.weekKey, siteId: row.siteId, labour: 0, material: 0 };
      }
      map[key].material += materialBill(row);
    });
    return Object.values(map)
      .map((row) => ({
        weekName: formatMarathiWeekFromWeekKey(row.weekKey),
        siteName: siteMap[row.siteId]?.name || row.siteId || "-",
        labourTotal: row.labour,
        materialTotal: row.material,
        grandTotal: row.labour + row.material,
      }))
      .sort((a, b) => b.weekName.localeCompare(a.weekName));
  }, [labour, material, siteMap]);

  const dealerOutstanding = useMemo(() => {
    return dealers.map((dealer) => {
      const rows = material.filter((m) => !m.isPlaceholder && (m.dealerId === dealer.id || m.dealerName === dealer.name));
      const totalPurchase = rows.reduce((sum, row) => sum + materialBill(row), 0);
      const totalPaid = rows.reduce((sum, row) => {
        if (typeof paidByEntry[row.id] === "number") return sum + paidByEntry[row.id];
        return sum + (row.paidAmount || 0);
      }, 0);
      return {
        dealerName: dealer.name || "-",
        totalPurchase,
        totalPaid,
        pendingAmount: totalPurchase - totalPaid,
      };
    });
  }, [dealers, material, paidByEntry]);

  const siteWiseMaterial = useMemo(() => {
    return material
      .filter((row) => !row.isPlaceholder)
      .map((row) => {
        const billAmount = materialBill(row);
        const paidAmount = typeof paidByEntry[row.id] === "number" ? paidByEntry[row.id] : (row.paidAmount || 0);
        return {
          siteId: row.siteId || "",
          dealerId: row.dealerId || "",
          siteName: siteMap[row.siteId]?.name || row.siteId || "-",
          dealerName: dealerMap[row.dealerId]?.name || row.dealerName || "-",
          details: row.details || "-",
          billAmount,
          paidAmount,
          remainingAmount: billAmount - paidAmount,
          date: row.date || "-",
        };
      })
      .filter((row) => (!filterSite || row.siteId === filterSite) && (!filterDealer || row.dealerId === filterDealer))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [material, paidByEntry, siteMap, dealerMap, filterSite, filterDealer]);

  return (
    <AccountantShell
      title="Reports (अहवाल)"
      subtitle="Financial summary, weekly expenses, dealer dues and material purchases"
      actions={(
        <>
          <button className="btn-muted-action" onClick={generatePdf}>Generate PDF</button>
          <button className="btn-primary-v5" onClick={loadData}>Refresh</button>
        </>
      )}
    >
      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Site Financial Summary Report</h3>
          <button
            className="btn-muted-action"
            onClick={() => exportReportPdf(
              "Site Financial Summary Report",
              ["Site Name", "Engineer", "Labour Total", "Material Total", "Grand Total"],
              siteFinancialSummary.map((r) => [
                r.siteName,
                r.engineer,
                `₹ ${r.labourTotal.toLocaleString("en-IN")}`,
                `₹ ${r.materialTotal.toLocaleString("en-IN")}`,
                `₹ ${r.grandTotal.toLocaleString("en-IN")}`,
              ]),
            )}
          >
            Export PDF
          </button>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Engineer</th>
                <th className="acc-right">Labour Total</th>
                <th className="acc-right">Material Total</th>
                <th className="acc-right">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {siteFinancialSummary.map((r) => (
                <tr key={r.siteName}>
                  <td>{r.siteName}</td>
                  <td>{r.engineer}</td>
                  <td className="acc-right">₹ {r.labourTotal.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {r.materialTotal.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {r.grandTotal.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Weekly Expense Report</h3>
          <button
            className="btn-muted-action"
            onClick={() => exportReportPdf(
              "Weekly Expense Report",
              ["Week Name", "Site Name", "Labour Total", "Material Total", "Weekly Grand Total"],
              weeklyExpense.map((r) => [
                r.weekName,
                r.siteName,
                `₹ ${r.labourTotal.toLocaleString("en-IN")}`,
                `₹ ${r.materialTotal.toLocaleString("en-IN")}`,
                `₹ ${r.grandTotal.toLocaleString("en-IN")}`,
              ]),
            )}
          >
            Export PDF
          </button>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Week Name</th>
                <th>Site Name</th>
                <th className="acc-right">Labour Total</th>
                <th className="acc-right">Material Total</th>
                <th className="acc-right">Weekly Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {weeklyExpense.map((r, idx) => (
                <tr key={`${r.weekName}-${r.siteName}-${idx}`}>
                  <td>{r.weekName}</td>
                  <td>{r.siteName}</td>
                  <td className="acc-right">₹ {r.labourTotal.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {r.materialTotal.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {r.grandTotal.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Dealer Outstanding Report</h3>
          <button
            className="btn-muted-action"
            onClick={() => exportReportPdf(
              "Dealer Outstanding Report",
              ["Dealer Name", "Total Purchase", "Total Paid", "Pending Amount"],
              dealerOutstanding.map((r) => [
                r.dealerName,
                `₹ ${r.totalPurchase.toLocaleString("en-IN")}`,
                `₹ ${r.totalPaid.toLocaleString("en-IN")}`,
                `₹ ${r.pendingAmount.toLocaleString("en-IN")}`,
              ]),
            )}
          >
            Export PDF
          </button>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Dealer Name</th>
                <th className="acc-right">Total Purchase</th>
                <th className="acc-right">Total Paid</th>
                <th className="acc-right">Pending Amount</th>
              </tr>
            </thead>
            <tbody>
              {dealerOutstanding.map((r) => (
                <tr key={r.dealerName}>
                  <td>{r.dealerName}</td>
                  <td className="acc-right">₹ {r.totalPurchase.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {r.totalPaid.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {r.pendingAmount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Site-wise Material Purchase Report</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="stage-select" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
              <option value="">All Sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
            </select>
            <select className="stage-select" value={filterDealer} onChange={(e) => setFilterDealer(e.target.value)}>
              <option value="">All Dealers</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
            </select>
            <button
              className="btn-muted-action"
              onClick={() => exportReportPdf(
                "Site-wise Material Purchase Report",
                ["Site", "Dealer", "Material Details", "Bill Amount", "Paid Amount", "Remaining Amount", "Date"],
                siteWiseMaterial.map((r) => [
                  r.siteName,
                  r.dealerName,
                  r.details,
                  `₹ ${r.billAmount.toLocaleString("en-IN")}`,
                  `₹ ${r.paidAmount.toLocaleString("en-IN")}`,
                  `₹ ${r.remainingAmount.toLocaleString("en-IN")}`,
                  r.date,
                ]),
              )}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Dealer</th>
                  <th>Material Details</th>
                  <th className="acc-right">Bill Amount</th>
                  <th className="acc-right">Paid Amount</th>
                  <th className="acc-right">Remaining Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {siteWiseMaterial.map((r, idx) => (
                  <tr key={`${r.siteName}-${r.dealerName}-${idx}`}>
                    <td>{r.siteName}</td>
                    <td>{r.dealerName}</td>
                    <td>{r.details}</td>
                    <td className="acc-right">₹ {r.billAmount.toLocaleString("en-IN")}</td>
                    <td className="acc-right">₹ {r.paidAmount.toLocaleString("en-IN")}</td>
                    <td className="acc-right">₹ {r.remainingAmount.toLocaleString("en-IN")}</td>
                    <td>{r.date}</td>
                  </tr>
                ))}
                {siteWiseMaterial.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      No rows for selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Daily Attendance Report</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="date" className="stage-select" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
            <button
              className="btn-muted-action"
              onClick={() => exportReportPdf(
                "Daily Attendance Report",
                ["Date", "Name", "Role", "Status", "Note"],
                dailyAttendance.map((r) => [
                  r.date || attendanceDate || "-",
                  r.personName || r.name || "-",
                  r.personRole || r.role || "-",
                  r.status || "-",
                  r.note || "-",
                ]),
              )}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
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
              {dailyAttendance.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No attendance rows for selected date.</td>
                </tr>
              ) : (
                dailyAttendance.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date || attendanceDate || "-"}</td>
                    <td>{r.personName || r.name || "-"}</td>
                    <td>{r.personRole || r.role || "-"}</td>
                    <td>{r.status || "-"}</td>
                    <td>{r.note || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Monthly Attendance Summary</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="month" className="stage-select" value={attendanceMonth} onChange={(e) => setAttendanceMonth(e.target.value)} />
            <button
              className="btn-muted-action"
              onClick={() => exportReportPdf(
                "Monthly Attendance Summary",
                ["Name", "Present Count", "Absent Count", "Leave Count", "Half Day Count"],
                monthlyAttendanceRows.map((r) => [
                  r.name,
                  String(r.present),
                  String(r.absent),
                  String(r.leave),
                  String(r.halfDay || 0),
                ]),
              )}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="acc-right">Present Count</th>
                <th className="acc-right">Absent Count</th>
                <th className="acc-right">Leave Count</th>
                <th className="acc-right">Half Day Count</th>
              </tr>
            </thead>
            <tbody>
              {monthlyAttendanceRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No monthly summary rows available.</td>
                </tr>
              ) : (
                monthlyAttendanceRows.map((r) => (
                  <tr key={r.personId || r.name}>
                    <td>{r.name}</td>
                    <td className="acc-right">{r.present}</td>
                    <td className="acc-right">{r.absent}</td>
                    <td className="acc-right">{r.leave}</td>
                    <td className="acc-right">{r.halfDay || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Person-wise Attendance Report</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="stage-select" value={attendancePersonId} onChange={(e) => setAttendancePersonId(e.target.value)}>
              <option value="">Select Person</option>
              {attendancePeople.map((p) => (
                <option key={p.id} value={p.id}>{p.name || p.id}</option>
              ))}
            </select>
            <button
              className="btn-muted-action"
              disabled={!attendancePersonId}
              onClick={() => exportReportPdf(
                "Person-wise Attendance Report",
                ["Date", "Status"],
                personWiseRows.map((r) => [r.date || "-", r.status || "-"]),
              )}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {attendancePersonId && personWiseRows.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b" }}>No rows found for selected person.</td>
                </tr>
              ) : !attendancePersonId ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b" }}>Select a person to view report.</td>
                </tr>
              ) : (
                personWiseRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date || "-"}</td>
                    <td>{r.status || "-"}</td>
                    <td>{r.note || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AccountantShell>
  );
}
