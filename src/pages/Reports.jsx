// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import PageTitle from "../components/PageTitle";
import Button from "../components/Button";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";

import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

// ✅ Excel/PDF libs
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function safeDate(d) {
  if (!d) return null;
  try {
    if (typeof d?.toDate === "function") return d.toDate();
    if (d instanceof Date) return d;
    return new Date(d);
  } catch {
    return null;
  }
}

function nowFileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}`;
}

function Badge({ text }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: "#f9f9f9",
      }}
    >
      {text}
    </span>
  );
}

function Reports() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("ALL"); // ALL | SITE
  const [loading, setLoading] = useState(true);

  const [sites, setSites] = useState([]);
  const [tasks, setTasks] = useState([]);

  // Site wise filters
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [weekFilter, setWeekFilter] = useState("ALL_WEEKS");
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);

        // ✅ Load sites
        const sitesRef = collection(db, "sites");
        const sitesQ = query(sitesRef, orderBy("createdAt", "desc"));
        const sitesSnap = await getDocs(sitesQ);

        const sitesData = sitesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setSites(sitesData);

        // ✅ Load tasks
        const tasksRef = collection(db, "tasks");
        const tasksQ = query(tasksRef, orderBy("createdAt", "desc"));
        const tasksSnap = await getDocs(tasksQ);

        const tasksData = tasksSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        setTasks(tasksData);

        if (!selectedSiteId && sitesData.length > 0) {
          setSelectedSiteId(sitesData[0].id);
        }
      } catch (e) {
        console.error(e);
        showError(e, "Failed to load Reports");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSite = useMemo(() => {
    return sites.find((s) => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  // ✅ Site map for fast lookup
  const siteMap = useMemo(() => {
    const m = new Map();
    sites.forEach((s) => m.set(s.id, s));
    return m;
  }, [sites]);

  // ✅ All Sites Summary
  const allSitesSummary = useMemo(() => {
    return sites.map((site) => {
      const siteTasks = tasks.filter((t) => t.siteId === site.id);

      const total = siteTasks.length;
      const pending = siteTasks.filter((t) => t.status === "PENDING").length;
      const done = siteTasks.filter((t) => t.status === "DONE").length;
      const cancelled = siteTasks.filter((t) => t.status === "CANCELLED").length;

      const currentWeekKey = site.currentWeekKey || "";

      // Overdue = weekKey < currentWeekKey and still pending
      const overdue = siteTasks.filter(
        (t) =>
          t.status === "PENDING" &&
          t.weekKey &&
          currentWeekKey &&
          t.weekKey < currentWeekKey
      ).length;

      // carried tasks (based on pendingWeeks)
      const carried = siteTasks.filter((t) => (t.pendingWeeks || 0) >= 1).length;

      return {
        siteId: site.id,
        name: site.name || "Unnamed Site",
        engineer: site.assignedEngineerName || "-",
        currentWeekKey: site.currentWeekKey || "-",
        total,
        pending,
        done,
        cancelled,
        overdue,
        carried,
      };
    });
  }, [sites, tasks]);

  // ✅ Phase 5.2: Most Overdue Tasks Ranking (Top 20)
  const overdueRanking = useMemo(() => {
    const list = tasks
      .filter((t) => t.status === "PENDING" && t.siteId && t.weekKey)
      .map((t) => {
        const site = siteMap.get(t.siteId);
        const currentWeekKey = site?.currentWeekKey || "";
        const isOverdue = currentWeekKey && t.weekKey < currentWeekKey;

        if (!isOverdue) return null;

        const pendingWeeks = t.pendingWeeks || 0;
        const createdAtMs = safeDate(t.createdAt)?.getTime?.() || 0;

        return {
          id: t.id,
          title: t.title || "Task",
          weekKey: t.weekKey || "-",
          pendingWeeks,
          createdAtMs,
          siteId: t.siteId,
          siteName: site?.name || "Unnamed Site",
          engineerName: site?.assignedEngineerName || "-",
          currentWeekKey: currentWeekKey || "-",
        };
      })
      .filter(Boolean);

    list.sort((a, b) => {
      if ((b.pendingWeeks || 0) !== (a.pendingWeeks || 0)) {
        return (b.pendingWeeks || 0) - (a.pendingWeeks || 0);
      }
      return (a.createdAtMs || 0) - (b.createdAtMs || 0);
    });

    return list.slice(0, 20);
  }, [tasks, siteMap]);

  // ✅ When site changes, prepare week list from site tasks
  useEffect(() => {
    if (!selectedSiteId) return;

    const siteTasks = tasks.filter((t) => t.siteId === selectedSiteId);
    const weeks = Array.from(new Set(siteTasks.map((t) => t.weekKey).filter(Boolean))).sort();

    setAvailableWeeks(weeks);

    if (weekFilter === "WEEK_KEY" && weeks.length === 0) {
      setWeekFilter("ALL_WEEKS");
    }
  }, [selectedSiteId, tasks]); // eslint-disable-line

  // ✅ Site wise filtered tasks
  const visibleTasks = useMemo(() => {
    if (!selectedSiteId) return [];

    let list = tasks.filter((t) => t.siteId === selectedSiteId);

    if (weekFilter === "CURRENT_WEEK") {
      list = list.filter((t) => t.weekKey === selectedSite?.currentWeekKey);
    }

    return list;
  }, [tasks, selectedSiteId, weekFilter, selectedSite]);

  const visibleTasksFinal = useMemo(() => {
    if (weekFilter !== "WEEK_KEY") return visibleTasks;
    if (!selectedWeekKey) return visibleTasks;
    return visibleTasks.filter((t) => t.weekKey === selectedWeekKey);
  }, [visibleTasks, weekFilter, selectedWeekKey]);

  // ✅ EXPORT: Excel
  const exportExcel = async () => {
    try {
      setExporting(true);

      const stamp = nowFileStamp();
      const fileName = `RP_Reports_${stamp}.xlsx`;

      const sheetOverdue = overdueRanking.map((t, idx) => ({
        Rank: idx + 1,
        Task: t.title,
        Site: t.siteName,
        Engineer: t.engineerName,
        TaskWeek: t.weekKey,
        CurrentWeek: t.currentWeekKey,
        PendingWeeks: t.pendingWeeks,
      }));

      const sheetSites = allSitesSummary.map((s) => ({
        Site: s.name,
        Engineer: s.engineer,
        CurrentWeek: s.currentWeekKey,
        Total: s.total,
        Pending: s.pending,
        Done: s.done,
        Cancelled: s.cancelled,
        Overdue: s.overdue,
        Carried: s.carried,
      }));

      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(sheetOverdue);
      XLSX.utils.book_append_sheet(wb, ws1, "Overdue Ranking");

      const ws2 = XLSX.utils.json_to_sheet(sheetSites);
      XLSX.utils.book_append_sheet(wb, ws2, "All Sites Summary");

      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, fileName);
      showSuccess("Excel exported ✅");
    } catch (e) {
      console.error(e);
      showError(e, "Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  // ✅ EXPORT: PDF
  const exportPDF = async () => {
    try {
      setExporting(true);

      const stamp = nowFileStamp();
      const fileName = `RP_Reports_${stamp}.pdf`;

      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text("RP Construction Tracker - Reports", 14, 15);

      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

      // ---- Overdue ranking table ----
      doc.setFontSize(12);
      doc.text("Top Overdue Tasks (Ranking)", 14, 32);

      autoTable(doc, {
        startY: 35,
        head: [["Rank", "Task", "Site", "Engineer", "TaskWeek", "CurrWeek", "PendingWeeks"]],
        body: overdueRanking.map((t, idx) => [
          idx + 1,
          t.title,
          t.siteName,
          t.engineerName,
          t.weekKey,
          t.currentWeekKey,
          String(t.pendingWeeks || 0),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 0, 0] },
      });

      // ---- All sites summary table ----
      let y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text("All Sites Summary", 14, y);

      autoTable(doc, {
        startY: y + 3,
        head: [["Site", "Engineer", "CurrWeek", "Total", "Pending", "Done", "Cancel", "Overdue", "Carried"]],
        body: allSitesSummary.map((s) => [
          s.name,
          s.engineer,
          s.currentWeekKey,
          String(s.total),
          String(s.pending),
          String(s.done),
          String(s.cancelled),
          String(s.overdue),
          String(s.carried),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 0, 0] },
      });

      doc.save(fileName);
      showSuccess("PDF exported ✅");
    } catch (e) {
      console.error(e);
      showError(e, "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <PageTitle title="Reports" role="Admin" showBack />

      {/* Top Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={() => navigate("/admin")}>← Back</Button>

          <Button
            onClick={() => setTab("ALL")}
            style={{
              background: tab === "ALL" ? "#000" : "#fff",
              color: tab === "ALL" ? "#fff" : "#000",
            }}
          >
            All Sites Report
          </Button>

          <Button
            onClick={() => setTab("SITE")}
            style={{
              background: tab === "SITE" ? "#000" : "#fff",
              color: tab === "SITE" ? "#fff" : "#000",
            }}
          >
            Site Wise Report
          </Button>
        </div>

        {/* ✅ Export buttons only on ALL tab */}
        {tab === "ALL" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button loading={exporting} onClick={exportExcel}>
              ⬇ Export Excel
            </Button>
            <Button loading={exporting} onClick={exportPDF}>
              ⬇ Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <>
          <SkeletonBox />
          <SkeletonBox />
        </>
      )}

      {/* ✅ TAB: ALL */}
      {!loading && tab === "ALL" && (
        <div style={{ marginTop: 12 }}>
          {/* Overdue Ranking */}
          <div
            style={{
              border: "2px solid #000",
              padding: 12,
              borderRadius: 10,
              background: "#fff",
              marginBottom: 12,
            }}
          >
            <h4 style={{ marginTop: 0 }}>🔥 Top Overdue Tasks (Ranking)</h4>

            {overdueRanking.length === 0 ? (
              <div style={{ fontSize: 13 }}>✅ No overdue pending tasks found.</div>
            ) : (
              overdueRanking.map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 8,
                    background: "#fff6f6",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <strong>
                        #{idx + 1}. {t.title}
                      </strong>

                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Site: <b>{t.siteName}</b> | Engineer: <b>{t.engineerName}</b>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <Badge text={`Task Week: ${t.weekKey}`} />
                        <Badge text={`Current Week: ${t.currentWeekKey}`} />
                        <Badge text={`↪ PendingWeeks: ${t.pendingWeeks}`} />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center" }}>
                      <Button
                        onClick={() => {
                          setSelectedSiteId(t.siteId);
                          setWeekFilter("ALL_WEEKS");
                          setSelectedWeekKey("");
                          setTab("SITE");
                        }}
                      >
                        Open Site →
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* All Sites Summary */}
          {allSitesSummary.length === 0 ? (
            <EmptyState title="No sites found" subtitle="Create a site first" />
          ) : (
            <>
              <h4>All Sites Summary</h4>

              {allSitesSummary.map((s) => (
                <div
                  key={s.siteId}
                  style={{
                    border: "1px solid #ddd",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 10,
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <strong>{s.name}</strong>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Engineer: <b>{s.engineer}</b>
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Current Week: <b>{s.currentWeekKey}</b>
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <Badge text={`Total: ${s.total}`} />
                        <Badge text={`Pending: ${s.pending}`} />
                        <Badge text={`Done: ${s.done}`} />
                        <Badge text={`Cancelled: ${s.cancelled}`} />
                        <Badge text={`🔥 Overdue: ${s.overdue}`} />
                        <Badge text={`↪ Carried: ${s.carried}`} />
                      </div>
                    </div>

                    <div>
                      <Button
                        onClick={() => {
                          setSelectedSiteId(s.siteId);
                          setTab("SITE");
                          setWeekFilter("ALL_WEEKS");
                          setSelectedWeekKey("");
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ✅ TAB: SITE */}
      {!loading && tab === "SITE" && (
        <div style={{ marginTop: 12 }}>
          <h4>Site Wise Report</h4>

          <div
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                style={{ minWidth: 200 }}
                value={selectedSiteId}
                onChange={(e) => {
                  setSelectedSiteId(e.target.value);
                  setWeekFilter("ALL_WEEKS");
                  setSelectedWeekKey("");
                }}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || "Unnamed Site"}
                  </option>
                ))}
              </select>

              <select
                value={weekFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setWeekFilter(v);
                  if (v !== "WEEK_KEY") setSelectedWeekKey("");
                }}
              >
                <option value="ALL_WEEKS">All Weeks</option>
                <option value="CURRENT_WEEK">Current Week Only</option>
                <option value="WEEK_KEY">Select Week...</option>
              </select>

              {weekFilter === "WEEK_KEY" && (
                <select value={selectedWeekKey} onChange={(e) => setSelectedWeekKey(e.target.value)}>
                  <option value="">Select weekKey</option>
                  {availableWeeks.map((wk) => (
                    <option key={wk} value={wk}>
                      {wk}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ fontSize: 12, marginTop: 8 }}>
              Current Week: <b>{selectedSite?.currentWeekKey || "-"}</b> | Engineer:{" "}
              <b>{selectedSite?.assignedEngineerName || "-"}</b>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {visibleTasksFinal.length === 0 ? (
              <EmptyState title="No tasks found" subtitle="No tasks for this filter" />
            ) : (
              visibleTasksFinal.map((t) => {
                const isOverdue =
                  t.status === "PENDING" &&
                  t.weekKey &&
                  selectedSite?.currentWeekKey &&
                  t.weekKey < selectedSite.currentWeekKey;

                return (
                  <div
                    key={t.id}
                    style={{
                      border: isOverdue ? "2px solid #000" : "1px solid #ddd",
                      padding: 10,
                      marginBottom: 8,
                      borderRadius: 6,
                      background: isOverdue ? "#fff6f6" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <strong>{t.title || "Task"}</strong>

                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Status: <b>{t.status || "PENDING"}</b> | Week: <b>{t.weekKey || "-"}</b>
                        </div>

                        {(t.pendingWeeks || 0) >= 1 && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            ↪ Carried: <b>{t.pendingWeeks} week(s)</b>
                          </div>
                        )}

                        {isOverdue && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            🔥 <b>Overdue Task</b>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: "#666" }}>
                        {safeDate(t.createdAt) ? safeDate(t.createdAt).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Reports;
