// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";

import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

// ✅ ExcelJS for colorful excel
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// ✅ PDF libs
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ✅ Snapshot builder
import { buildWeeklySnapshot } from "../utils/reportSnapshotBuilder";

// ✅ Auth
import { useAuth } from "../context/AuthContext";

/* ----------------- Helpers ----------------- */
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
    d.getHours(),
  )}${pad(d.getMinutes())}`;
}

function percent(n) {
  if (!isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function getRangeStart(rangeKey) {
  const now = new Date();

  if (rangeKey === "ALL_TIME") return null;
  if (rangeKey === "LAST_7_DAYS")
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (rangeKey === "LAST_30_DAYS")
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (rangeKey === "THIS_MONTH") return startOfMonth(now);

  return null;
}

function textIncludes(hay, needle) {
  const h = (hay || "").toString().toLowerCase();
  const n = (needle || "").toString().toLowerCase().trim();
  if (!n) return true;
  return h.includes(n);
}

function paginate(list, page, pageSize) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
    pageSize,
  };
}

/* ----------------- UI (Phase 5.6) ----------------- */
const styles = {
  pageBg: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 500px at 0% 0%, #e0f2fe 0%, rgba(224,242,254,0) 60%), radial-gradient(1000px 500px at 100% 0%, #fae8ff 0%, rgba(250,232,255,0) 60%), #f8fafc",
    padding: 12,
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },
  hero: {
    borderRadius: 16,
    padding: 16,
    background:
      "linear-gradient(135deg, #0f172a 0%, #111827 60%, #0b1220 100%)",
    color: "#fff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: 800, margin: 0 },
  heroSub: { fontSize: 12, opacity: 0.85, marginTop: 6, marginBottom: 0 },

  stickyBar: {
    position: "sticky",
    top: 10,
    zIndex: 30,
    background: "rgba(248,250,252,0.85)",
    backdropFilter: "blur(10px)",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 10,
    boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  },

  pillsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  pill: (active) => ({
    border: "1px solid #e2e8f0",
    background: active ? "#0f172a" : "#fff",
    color: active ? "#fff" : "#0f172a",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  }),

  controlsWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },

  select: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    background: "#fff",
    outline: "none",
  },

  input: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    background: "#fff",
    outline: "none",
    minWidth: 220,
  },

  section: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
    marginTop: 12,
  },

  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" },
  sectionSub: { marginTop: 6, fontSize: 12, color: "#64748b" },

  card: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
    marginBottom: 10,
  },

  softCard: {
    border: "1px solid #fee2e2",
    background: "linear-gradient(180deg, #fff 0%, #fff5f5 100%)",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
    marginBottom: 10,
  },

  footer: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
  },
};

function MiniBadge({ text }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        color: "#0f172a",
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}

function StatRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 12,
      }}
    >
      <span style={{ color: "#475569" }}>{label}</span>
      <b style={{ color: "#0f172a" }}>{value}</b>
    </div>
  );
}

function Pager({ page, totalPages, total, onPrev, onNext }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
        marginTop: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>
        Showing page <b>{page}</b> / <b>{totalPages}</b> • Total: <b>{total}</b>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={styles.pill(false)}
          onClick={onPrev}
          disabled={page <= 1}
        >
          ← Prev
        </button>
        <button
          style={styles.pill(false)}
          onClick={onNext}
          disabled={page >= totalPages}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/* ----------------- ExcelJS Styling Helpers ----------------- */
function setAutoWidth(worksheet) {
  worksheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      const len = v ? String(v).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 12), 50);
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
      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };
    });
  });
}

/* ----------------- Reports Page ----------------- */
export default function Reports() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState("ALL"); // ALL | SITE | ENGINEERS
  const [loading, setLoading] = useState(true);

  const [sites, setSites] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [dateRange, setDateRange] = useState("ALL_TIME");

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [weekFilter, setWeekFilter] = useState("ALL_WEEKS");
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");

  const [exporting, setExporting] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const [engineerSort, setEngineerSort] = useState("MOST_PENDING");

  // ✅ Phase 5.8 drilldown focus
  const [engineerFocusId, setEngineerFocusId] = useState("");
  const [engineerFocusName, setEngineerFocusName] = useState("");

  // ✅ Phase 5.9 Search
  const [search, setSearch] = useState("");

  // ✅ Phase 5.9 Pagination per tab
  const [pageOverdue, setPageOverdue] = useState(1);
  const [pageSites, setPageSites] = useState(1);
  const [pageTasks, setPageTasks] = useState(1);
  const [pageEngineers, setPageEngineers] = useState(1);

  // reset pages when filters change
  useEffect(() => {
    setPageOverdue(1);
    setPageSites(1);
    setPageTasks(1);
    setPageEngineers(1);
  }, [
    tab,
    dateRange,
    search,
    engineerFocusId,
    selectedSiteId,
    weekFilter,
    selectedWeekKey,
  ]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);

        const sitesRef = collection(db, "sites");
        const sitesQ = query(sitesRef, orderBy("createdAt", "desc"));
        const sitesSnap = await getDocs(sitesQ);

        const sitesData = sitesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setSites(sitesData);

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

  // ✅ Save snapshot (Phase 6.2)
  const saveWeeklySnapshot = async () => {
    try {
      if (!user?.uid) return showError(null, "User session missing");
      if (sites.length === 0) return showError(null, "No sites found");
      if (tasks.length === 0) return showError(null, "No tasks found");

      setSavingSnapshot(true);

      const snapshot = buildWeeklySnapshot({ sites, tasks, user });

      const ref = doc(db, "reportSnapshots", snapshot.weekKey);

      await setDoc(
        ref,
        {
          ...snapshot,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      showSuccess(`Snapshot saved ✅ (${snapshot.weekKey})`);
    } catch (e) {
      console.error(e);
      showError(e, "Snapshot save failed");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const selectedSite = useMemo(() => {
    return sites.find((s) => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  const siteMap = useMemo(() => {
    const m = new Map();
    sites.forEach((s) => m.set(s.id, s));
    return m;
  }, [sites]);

  const filteredTasksByDate = useMemo(() => {
    const start = getRangeStart(dateRange);
    if (!start) return tasks;

    return tasks.filter((t) => {
      const d = safeDate(t.createdAt);
      if (!d) return false;
      return d.getTime() >= start.getTime();
    });
  }, [tasks, dateRange]);

  const allSitesSummary = useMemo(() => {
    return sites.map((site) => {
      const siteTasks = filteredTasksByDate.filter((t) => t.siteId === site.id);

      const total = siteTasks.length;
      const pending = siteTasks.filter((t) => t.status === "PENDING").length;
      const done = siteTasks.filter((t) => t.status === "DONE").length;
      const cancelled = siteTasks.filter(
        (t) => t.status === "CANCELLED",
      ).length;

      const currentWeekKey = site.currentWeekKey || "";

      const overdue = siteTasks.filter(
        (t) =>
          t.status === "PENDING" &&
          t.weekKey &&
          currentWeekKey &&
          t.weekKey < currentWeekKey,
      ).length;

      const carried = siteTasks.filter(
        (t) => (t.pendingWeeks || 0) >= 1,
      ).length;

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
  }, [sites, filteredTasksByDate]);

  const overdueRankingBase = useMemo(() => {
    const list = filteredTasksByDate
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

    return list;
  }, [filteredTasksByDate, siteMap]);

  const overdueRanking = useMemo(() => {
    const filteredByEngineer = engineerFocusId
      ? overdueRankingBase.filter((x) => {
          const site = siteMap.get(x.siteId);
          return (site?.assignedEngineerId || "") === engineerFocusId;
        })
      : overdueRankingBase;

    const filteredBySearch = filteredByEngineer.filter((x) => {
      return (
        textIncludes(x.title, search) ||
        textIncludes(x.siteName, search) ||
        textIncludes(x.engineerName, search) ||
        textIncludes(x.weekKey, search)
      );
    });

    return filteredBySearch;
  }, [overdueRankingBase, engineerFocusId, siteMap, search]);

  const engineerPerformanceBase = useMemo(() => {
    const map = new Map();

    sites.forEach((s) => {
      const engId = s.assignedEngineerId || "UNKNOWN";
      const engName = s.assignedEngineerName || "Unknown Engineer";

      if (!map.has(engId)) {
        map.set(engId, {
          engineerId: engId,
          engineerName: engName,
          sitesCount: 0,
          total: 0,
          pending: 0,
          done: 0,
          cancelled: 0,
          overdue: 0,
          carried: 0,
        });
      }
    });

    sites.forEach((s) => {
      const engId = s.assignedEngineerId || "UNKNOWN";
      const row = map.get(engId);
      if (row) row.sitesCount += 1;
    });

    filteredTasksByDate.forEach((t) => {
      if (!t.siteId) return;
      const site = siteMap.get(t.siteId);
      if (!site) return;

      const engId = site.assignedEngineerId || "UNKNOWN";
      const row = map.get(engId);
      if (!row) return;

      row.total += 1;

      const status = t.status || "PENDING";
      if (status === "PENDING") row.pending += 1;
      if (status === "DONE") row.done += 1;
      if (status === "CANCELLED") row.cancelled += 1;

      if ((t.pendingWeeks || 0) >= 1) row.carried += 1;

      const currentWeekKey = site.currentWeekKey || "";
      if (
        status === "PENDING" &&
        t.weekKey &&
        currentWeekKey &&
        t.weekKey < currentWeekKey
      ) {
        row.overdue += 1;
      }
    });

    const list = Array.from(map.values()).map((row) => {
      const completionRate = row.total > 0 ? (row.done / row.total) * 100 : 0;
      return { ...row, completionRate };
    });

    list.sort((a, b) => {
      if (engineerSort === "BEST_COMPLETION")
        return b.completionRate - a.completionRate;
      if (engineerSort === "MOST_OVERDUE")
        return (b.overdue || 0) - (a.overdue || 0);
      return (b.pending || 0) - (a.pending || 0);
    });

    return list;
  }, [filteredTasksByDate, sites, siteMap, engineerSort]);

  const engineerPerformance = useMemo(() => {
    return engineerPerformanceBase.filter((e) => {
      return (
        textIncludes(e.engineerName, search) ||
        textIncludes(e.engineerId, search)
      );
    });
  }, [engineerPerformanceBase, search]);

  const allSitesSummaryFiltered = useMemo(() => {
    return allSitesSummary.filter((s) => {
      return (
        textIncludes(s.name, search) ||
        textIncludes(s.engineer, search) ||
        textIncludes(s.currentWeekKey, search)
      );
    });
  }, [allSitesSummary, search]);

  // Week list from filtered tasks
  useEffect(() => {
    if (!selectedSiteId) return;
    const siteTasks = filteredTasksByDate.filter(
      (t) => t.siteId === selectedSiteId,
    );
    const weeks = Array.from(
      new Set(siteTasks.map((t) => t.weekKey).filter(Boolean)),
    ).sort();
    setAvailableWeeks(weeks);
  }, [selectedSiteId, filteredTasksByDate]);

  const visibleTasks = useMemo(() => {
    if (!selectedSiteId) return [];
    let list = filteredTasksByDate.filter((t) => t.siteId === selectedSiteId);

    if (weekFilter === "CURRENT_WEEK") {
      list = list.filter((t) => t.weekKey === selectedSite?.currentWeekKey);
    }
    return list;
  }, [filteredTasksByDate, selectedSiteId, weekFilter, selectedSite]);

  const visibleTasksFinal = useMemo(() => {
    let list = visibleTasks;

    if (weekFilter === "WEEK_KEY" && selectedWeekKey) {
      list = list.filter((t) => t.weekKey === selectedWeekKey);
    }

    list = list.filter((t) => {
      return (
        textIncludes(t.title, search) ||
        textIncludes(t.status, search) ||
        textIncludes(t.weekKey, search)
      );
    });

    return list;
  }, [visibleTasks, weekFilter, selectedWeekKey, search]);

  /* ----------------- Pagination models ----------------- */
  const overduePageModel = useMemo(
    () => paginate(overdueRanking, pageOverdue, 10),
    [overdueRanking, pageOverdue],
  );
  const sitesPageModel = useMemo(
    () => paginate(allSitesSummaryFiltered, pageSites, 8),
    [allSitesSummaryFiltered, pageSites],
  );
  const tasksPageModel = useMemo(
    () => paginate(visibleTasksFinal, pageTasks, 15),
    [visibleTasksFinal, pageTasks],
  );
  const engineersPageModel = useMemo(
    () => paginate(engineerPerformance, pageEngineers, 8),
    [engineerPerformance, pageEngineers],
  );

  /* ----------------- Export Excel (Phase 5.7) ----------------- */
  const exportExcel = async () => {
    try {
      setExporting(true);

      const stamp = nowFileStamp();
      const fileName = `RP_Reports_${dateRange}_${stamp}.xlsx`;

      const wb = new ExcelJS.Workbook();
      wb.creator = "RP Construction Tracker";
      wb.created = new Date();

      const wsOverdue = wb.addWorksheet("Overdue Ranking");
      wsOverdue.columns = [
        { header: "Rank", key: "rank" },
        { header: "Task", key: "task" },
        { header: "Site", key: "site" },
        { header: "Engineer", key: "engineer" },
        { header: "Task Week", key: "taskWeek" },
        { header: "Current Week", key: "currentWeek" },
        { header: "Pending Weeks", key: "pendingWeeks" },
      ];

      overdueRanking.slice(0, 200).forEach((t, idx) => {
        wsOverdue.addRow({
          rank: idx + 1,
          task: t.title,
          site: t.siteName,
          engineer: t.engineerName,
          taskWeek: t.weekKey,
          currentWeek: t.currentWeekKey,
          pendingWeeks: t.pendingWeeks || 0,
        });
      });

      styleHeaderRow(wsOverdue);
      addRowBorders(wsOverdue);
      wsOverdue.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF1F2" },
          };
        });
      });
      setAutoWidth(wsOverdue);

      const wsSites = wb.addWorksheet("All Sites Summary");
      wsSites.columns = [
        { header: "Site", key: "site" },
        { header: "Engineer", key: "engineer" },
        { header: "Current Week", key: "currentWeek" },
        { header: "Total", key: "total" },
        { header: "Pending", key: "pending" },
        { header: "Done", key: "done" },
        { header: "Cancelled", key: "cancelled" },
        { header: "Overdue", key: "overdue" },
        { header: "Carried", key: "carried" },
      ];

      allSitesSummaryFiltered.forEach((s) => {
        wsSites.addRow({
          site: s.name,
          engineer: s.engineer,
          currentWeek: s.currentWeekKey,
          total: s.total,
          pending: s.pending,
          done: s.done,
          cancelled: s.cancelled,
          overdue: s.overdue,
          carried: s.carried,
        });
      });

      styleHeaderRow(wsSites);
      addRowBorders(wsSites);
      wsSites.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const overdueValue = Number(row.getCell(8).value || 0);
        if (overdueValue > 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFF7ED" },
            };
          });
        }
      });
      setAutoWidth(wsSites);

      const wsEng = wb.addWorksheet("Engineer Performance");
      wsEng.columns = [
        { header: "Engineer", key: "engineer" },
        { header: "Sites", key: "sites" },
        { header: "Total", key: "total" },
        { header: "Pending", key: "pending" },
        { header: "Done", key: "done" },
        { header: "Cancelled", key: "cancelled" },
        { header: "Overdue", key: "overdue" },
        { header: "Carried", key: "carried" },
        { header: "Completion %", key: "completion" },
      ];

      engineerPerformance.forEach((e) => {
        wsEng.addRow({
          engineer: e.engineerName,
          sites: e.sitesCount,
          total: e.total,
          pending: e.pending,
          done: e.done,
          cancelled: e.cancelled,
          overdue: e.overdue,
          carried: e.carried,
          completion: Math.round(e.completionRate || 0),
        });
      });

      styleHeaderRow(wsEng);
      addRowBorders(wsEng);
      wsEng.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const overdue = Number(row.getCell(7).value || 0);
        const completion = Number(row.getCell(9).value || 0);

        if (overdue > 0) {
          row.getCell(7).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFE4E6" },
          };
        }

        row.getCell(9).numFmt = "0%";
        row.getCell(9).value = completion / 100;

        row.getCell(9).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: completion >= 70 ? "FFDCFCE7" : "FFFFF7ED" },
        };
      });
      setAutoWidth(wsEng);

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
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

  /* ----------------- Export PDF ----------------- */
  const exportPDF = async () => {
    try {
      setExporting(true);

      const stamp = nowFileStamp();
      const fileName = `RP_Reports_${dateRange}_${stamp}.pdf`;

      const doc = new jsPDF();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 220, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("RP Construction Tracker - Reports", 14, 12);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
      doc.text(`Range: ${dateRange}`, 14, 30);

      doc.setFontSize(11);
      doc.text("Top Overdue Tasks (Ranking)", 14, 38);

      autoTable(doc, {
        startY: 41,
        head: [
          [
            "Rank",
            "Task",
            "Site",
            "Engineer",
            "TaskWeek",
            "CurrWeek",
            "PendingWeeks",
          ],
        ],
        body: overdueRanking
          .slice(0, 50)
          .map((t, idx) => [
            idx + 1,
            t.title,
            t.siteName,
            t.engineerName,
            t.weekKey,
            t.currentWeekKey,
            String(t.pendingWeeks || 0),
          ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42] },
      });

      let y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.text("All Sites Summary", 14, y);

      autoTable(doc, {
        startY: y + 3,
        head: [
          [
            "Site",
            "Engineer",
            "CurrWeek",
            "Total",
            "Pending",
            "Done",
            "Cancel",
            "Overdue",
            "Carried",
          ],
        ],
        body: allSitesSummaryFiltered.map((s) => [
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
        headStyles: { fillColor: [15, 23, 42] },
      });

      y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(11);
      doc.text("Engineer Performance", 14, y);

      autoTable(doc, {
        startY: y + 3,
        head: [
          [
            "Engineer",
            "Sites",
            "Total",
            "Pending",
            "Done",
            "Cancel",
            "Overdue",
            "Carried",
            "Done%",
          ],
        ],
        body: engineerPerformance.map((e) => [
          e.engineerName,
          String(e.sitesCount),
          String(e.total),
          String(e.pending),
          String(e.done),
          String(e.cancelled),
          String(e.overdue),
          String(e.carried),
          `${Math.round(e.completionRate)}%`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42] },
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
      <div style={styles.pageBg}>
        <div style={styles.container}>
          {/* Hero */}
          <div style={styles.hero}>
            <h1 style={styles.heroTitle}>📊 Reports Dashboard</h1>
            <p style={styles.heroSub}>
              Track site progress, engineer performance, overdue tasks & export
              reports (Excel/PDF).
            </p>
          </div>

          {/* Sticky Bar */}
          <div style={styles.stickyBar}>
            <div style={styles.pillsWrap}>
              <button
                style={styles.pill(false)}
                onClick={() => navigate("/admin")}
              >
                ← Admin
              </button>
              <button
                style={styles.pill(false)}
                onClick={() => navigate("/admin/reports/advanced")}
              >
                ⚙ Advanced Reports
              </button>
              <button
                style={styles.pill(false)}
                onClick={() => navigate("/admin/reports/snapshots")}
              >
                📌 Snapshots
              </button>
              <button
                style={styles.pill(tab === "ALL")}
                onClick={() => setTab("ALL")}
              >
                📌 All Sites
              </button>

              <button
                style={styles.pill(tab === "SITE")}
                onClick={() => setTab("SITE")}
              >
                🧾 Site Wise
              </button>

              <button
                style={styles.pill(tab === "ENGINEERS")}
                onClick={() => setTab("ENGINEERS")}
              >
                👷 Engineers
              </button>
            </div>

            <div style={styles.controlsWrap}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}
                >
                  Date Filter:
                </span>
                <select
                  style={styles.select}
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <option value="ALL_TIME">All Time</option>
                  <option value="LAST_7_DAYS">Last 7 Days</option>
                  <option value="LAST_30_DAYS">Last 30 Days</option>
                  <option value="THIS_MONTH">This Month</option>
                </select>

                <input
                  style={styles.input}
                  placeholder="Search (site, engineer, task, weekKey...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={{
                    ...styles.pill(false),
                    background: "#0f172a",
                    color: "#fff",
                    borderColor: "#0f172a",
                    opacity: exporting ? 0.7 : 1,
                  }}
                  disabled={exporting}
                  onClick={exportExcel}
                >
                  ⬇ Excel
                </button>

                <button
                  style={{
                    ...styles.pill(false),
                    background: "#fff",
                    color: "#0f172a",
                    opacity: exporting ? 0.7 : 1,
                  }}
                  disabled={exporting}
                  onClick={exportPDF}
                >
                  ⬇ PDF
                </button>

                {/* ✅ Phase 6.2 Save Snapshot */}
                <button
                  style={{
                    ...styles.pill(false),
                    background: "#0ea5e9",
                    color: "#fff",
                    borderColor: "#0ea5e9",
                    opacity: savingSnapshot ? 0.7 : 1,
                  }}
                  disabled={savingSnapshot}
                  onClick={saveWeeklySnapshot}
                  title="Save this week's report snapshot to Firestore"
                >
                  📌 {savingSnapshot ? "Saving..." : "Save Snapshot"}
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ marginTop: 12 }}>
              <SkeletonBox />
              <SkeletonBox />
            </div>
          )}

          {/* ALL TAB */}
          {!loading && tab === "ALL" && (
            <>
              {engineerFocusId && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      borderRadius: 16,
                      padding: 12,
                      border: "1px solid #e2e8f0",
                      background: "#f1f5f9",
                      fontSize: 12,
                      color: "#0f172a",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      🔎 Overdue ranking filtered for engineer:{" "}
                      <b>{engineerFocusName || engineerFocusId}</b>
                    </div>

                    <button
                      style={styles.pill(false)}
                      onClick={() => {
                        setEngineerFocusId("");
                        setEngineerFocusName("");
                        showSuccess("Engineer filter cleared ✅");
                      }}
                    >
                      ✖ Clear Filter
                    </button>
                  </div>
                </div>
              )}

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🔥 Top Overdue Tasks</h3>
                <p style={styles.sectionSub}>
                  Search + paginated list (fast even with large data).
                </p>

                {overduePageModel.total === 0 ? (
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    ✅ No overdue tasks match your search/date filter.
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {overduePageModel.items.map((t, idx) => (
                      <div key={t.id} style={styles.softCard}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>
                              #
                              {(overduePageModel.page - 1) *
                                overduePageModel.pageSize +
                                idx +
                                1}
                              . {t.title}
                            </div>

                            <div
                              style={{
                                fontSize: 12,
                                marginTop: 4,
                                color: "#475569",
                              }}
                            >
                              Site:{" "}
                              <b style={{ color: "#0f172a" }}>{t.siteName}</b> •
                              Engineer:{" "}
                              <b style={{ color: "#0f172a" }}>
                                {t.engineerName}
                              </b>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                                marginTop: 8,
                              }}
                            >
                              <MiniBadge text={`Task Week: ${t.weekKey}`} />
                              <MiniBadge
                                text={`Current: ${t.currentWeekKey}`}
                              />
                              <MiniBadge
                                text={`↪ PendingWeeks: ${t.pendingWeeks}`}
                              />
                            </div>
                          </div>

                          <div
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            <button
                              style={styles.pill(false)}
                              onClick={() => {
                                setSelectedSiteId(t.siteId);
                                setWeekFilter("ALL_WEEKS");
                                setSelectedWeekKey("");
                                setTab("SITE");
                              }}
                            >
                              Open Site →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Pager
                      page={overduePageModel.page}
                      totalPages={overduePageModel.totalPages}
                      total={overduePageModel.total}
                      onPrev={() => setPageOverdue((p) => Math.max(1, p - 1))}
                      onNext={() =>
                        setPageOverdue((p) =>
                          Math.min(overduePageModel.totalPages, p + 1),
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📌 All Sites Summary</h3>
                <p style={styles.sectionSub}>Paginated for performance.</p>

                {sitesPageModel.total === 0 ? (
                  <EmptyState
                    title="No sites match"
                    subtitle="Try clearing search or changing date filter"
                  />
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {sitesPageModel.items.map((s) => (
                      <div key={s.siteId} style={styles.card}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: "#0f172a",
                              }}
                            >
                              {s.name}
                            </div>

                            <div
                              style={{
                                fontSize: 12,
                                marginTop: 4,
                                color: "#475569",
                              }}
                            >
                              Engineer:{" "}
                              <b style={{ color: "#0f172a" }}>{s.engineer}</b> •
                              Current Week:{" "}
                              <b style={{ color: "#0f172a" }}>
                                {s.currentWeekKey}
                              </b>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                                marginTop: 8,
                              }}
                            >
                              <MiniBadge text={`Total: ${s.total}`} />
                              <MiniBadge text={`Pending: ${s.pending}`} />
                              <MiniBadge text={`Done: ${s.done}`} />
                              <MiniBadge text={`Cancelled: ${s.cancelled}`} />
                              <MiniBadge text={`🔥 Overdue: ${s.overdue}`} />
                              <MiniBadge text={`↪ Carried: ${s.carried}`} />
                            </div>
                          </div>

                          <div
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            <button
                              style={styles.pill(false)}
                              onClick={() => {
                                setSelectedSiteId(s.siteId);
                                setTab("SITE");
                                setWeekFilter("ALL_WEEKS");
                                setSelectedWeekKey("");
                              }}
                            >
                              View →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Pager
                      page={sitesPageModel.page}
                      totalPages={sitesPageModel.totalPages}
                      total={sitesPageModel.total}
                      onPrev={() => setPageSites((p) => Math.max(1, p - 1))}
                      onNext={() =>
                        setPageSites((p) =>
                          Math.min(sitesPageModel.totalPages, p + 1),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* SITE TAB */}
          {!loading && tab === "SITE" && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>🧾 Site Wise Report</h3>
              <p style={styles.sectionSub}>Tasks paginated + searchable.</p>

              <div
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 12,
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select
                    style={styles.select}
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
                    style={styles.select}
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
                    <select
                      style={styles.select}
                      value={selectedWeekKey}
                      onChange={(e) => setSelectedWeekKey(e.target.value)}
                    >
                      <option value="">Select weekKey</option>
                      {availableWeeks.map((wk) => (
                        <option key={wk} value={wk}>
                          {wk}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ fontSize: 12, marginTop: 10, color: "#475569" }}>
                  Current Week:{" "}
                  <b style={{ color: "#0f172a" }}>
                    {selectedSite?.currentWeekKey || "-"}
                  </b>{" "}
                  • Engineer:{" "}
                  <b style={{ color: "#0f172a" }}>
                    {selectedSite?.assignedEngineerName || "-"}
                  </b>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {tasksPageModel.total === 0 ? (
                  <EmptyState
                    title="No tasks found"
                    subtitle="Try changing week filter or clearing search"
                  />
                ) : (
                  <>
                    {tasksPageModel.items.map((t) => {
                      const isOverdue =
                        t.status === "PENDING" &&
                        t.weekKey &&
                        selectedSite?.currentWeekKey &&
                        t.weekKey < selectedSite.currentWeekKey;

                      return (
                        <div
                          key={t.id}
                          style={{
                            ...styles.card,
                            border: isOverdue
                              ? "2px solid #0f172a"
                              : "1px solid #e2e8f0",
                            background: isOverdue
                              ? "linear-gradient(180deg,#fff,#fff6f6)"
                              : "#fff",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <div>
                              <div
                                style={{ fontWeight: 900, color: "#0f172a" }}
                              >
                                {t.title || "Task"}
                              </div>

                              <div
                                style={{
                                  fontSize: 12,
                                  marginTop: 4,
                                  color: "#475569",
                                }}
                              >
                                Status:{" "}
                                <b style={{ color: "#0f172a" }}>
                                  {t.status || "PENDING"}
                                </b>{" "}
                                • Week:{" "}
                                <b style={{ color: "#0f172a" }}>
                                  {t.weekKey || "-"}
                                </b>
                              </div>

                              {(t.pendingWeeks || 0) >= 1 && (
                                <div
                                  style={{
                                    fontSize: 12,
                                    marginTop: 4,
                                    color: "#475569",
                                  }}
                                >
                                  ↪ Carried:{" "}
                                  <b style={{ color: "#0f172a" }}>
                                    {t.pendingWeeks} week(s)
                                  </b>
                                </div>
                              )}

                              {isOverdue && (
                                <div
                                  style={{
                                    fontSize: 12,
                                    marginTop: 6,
                                    fontWeight: 800,
                                    color: "#991b1b",
                                  }}
                                >
                                  🔥 Overdue Task
                                </div>
                              )}
                            </div>

                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                              {safeDate(t.createdAt)
                                ? safeDate(t.createdAt).toLocaleString()
                                : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <Pager
                      page={tasksPageModel.page}
                      totalPages={tasksPageModel.totalPages}
                      total={tasksPageModel.total}
                      onPrev={() => setPageTasks((p) => Math.max(1, p - 1))}
                      onNext={() =>
                        setPageTasks((p) =>
                          Math.min(tasksPageModel.totalPages, p + 1),
                        )
                      }
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ENGINEERS TAB */}
          {!loading && tab === "ENGINEERS" && (
            <div style={styles.section}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h3 style={{ ...styles.sectionTitle, marginBottom: 6 }}>
                    👷 Engineer Performance
                  </h3>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Search + pagination + drilldown.
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}
                  >
                    Sort:
                  </span>
                  <select
                    style={styles.select}
                    value={engineerSort}
                    onChange={(e) => setEngineerSort(e.target.value)}
                  >
                    <option value="MOST_PENDING">Most Pending</option>
                    <option value="MOST_OVERDUE">Most Overdue</option>
                    <option value="BEST_COMPLETION">Best Completion</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {engineersPageModel.total === 0 ? (
                  <EmptyState
                    title="No engineers match"
                    subtitle="Try clearing search"
                  />
                ) : (
                  <>
                    {engineersPageModel.items.map((e) => (
                      <div key={e.engineerId} style={styles.card}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: 900,
                                color: "#0f172a",
                                fontSize: 14,
                              }}
                            >
                              {e.engineerName}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                marginTop: 4,
                                color: "#475569",
                              }}
                            >
                              Sites Assigned:{" "}
                              <b style={{ color: "#0f172a" }}>{e.sitesCount}</b>
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <MiniBadge
                              text={`✅ Completion: ${percent(e.completionRate)}`}
                            />
                            <div
                              style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                marginTop: 6,
                              }}
                            >
                              Total Tasks:{" "}
                              <b style={{ color: "#0f172a" }}>{e.total}</b>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                justifyContent: "flex-end",
                                marginTop: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                style={styles.pill(false)}
                                onClick={() => {
                                  setEngineerFocusId(e.engineerId);
                                  setEngineerFocusName(e.engineerName);
                                  setTab("ALL");
                                }}
                              >
                                🔥 Overdue
                              </button>

                              <button
                                style={styles.pill(false)}
                                onClick={() => {
                                  const firstSite = sites.find(
                                    (s) =>
                                      (s.assignedEngineerId || "") ===
                                      e.engineerId,
                                  );

                                  if (firstSite) {
                                    setSelectedSiteId(firstSite.id);
                                    setWeekFilter("ALL_WEEKS");
                                    setSelectedWeekKey("");
                                    setTab("SITE");
                                  } else {
                                    showError(
                                      null,
                                      "No site assigned to this engineer",
                                    );
                                  }
                                }}
                              >
                                🧾 View Site
                              </button>

                              <button
                                style={styles.pill(false)}
                                onClick={() => {
                                  setEngineerFocusId("");
                                  setEngineerFocusName("");
                                  showSuccess("Filter cleared ✅");
                                }}
                              >
                                ✖ Clear
                              </button>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 8,
                            padding: 12,
                            border: "1px solid #e2e8f0",
                            borderRadius: 14,
                            background: "#f8fafc",
                          }}
                        >
                          <StatRow label="⏳ Pending" value={e.pending} />
                          <StatRow label="✅ Done" value={e.done} />
                          <StatRow label="❌ Cancelled" value={e.cancelled} />
                          <StatRow label="🔥 Overdue" value={e.overdue} />
                          <StatRow label="↪ Carried" value={e.carried} />
                        </div>
                      </div>
                    ))}

                    <Pager
                      page={engineersPageModel.page}
                      totalPages={engineersPageModel.totalPages}
                      total={engineersPageModel.total}
                      onPrev={() => setPageEngineers((p) => Math.max(1, p - 1))}
                      onNext={() =>
                        setPageEngineers((p) =>
                          Math.min(engineersPageModel.totalPages, p + 1),
                        )
                      }
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <div style={styles.footer}>
            © {new Date().getFullYear()} RP Construction Tracker • Reports
            Snapshot (Phase 6.2)
          </div>
        </div>
      </div>
    </Layout>
  );
}
