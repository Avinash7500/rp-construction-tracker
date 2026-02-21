
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import Layout from "../components/Layout";
import { logout } from "../utils/logout";
import Button from "../components/Button";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { carryForwardToNextWeek } from "../services/carryForward";
import { formatMarathiWeekFromDate } from "../utils/marathiWeekFormat";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

import "./Admin.css";
import "./Engineer.css";

const DAY_OPTIONS = [
  "सोमवार",
  "मंगळवार",
  "बुधवार",
  "गुरुवार",
  "शुक्रवार",
  "शनिवार",
  "रविवार",
];
const REPORT_PAGE_SIZE = 12;
const SNAPSHOT_FILTERS = {
  ALL: "ALL",
  DUE_TODAY: "DUE_TODAY",
  OVERDUE: "OVERDUE",
  HIGH_PENDING: "HIGH_PENDING",
  DUE_TOMORROW: "DUE_TOMORROW",
};

function safeToDate(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function fmtDate(v) {
  const d = safeToDate(v);
  if (!d) return "-";
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
}

function fmtDateTime(v) {
  const d = safeToDate(v);
  if (!d) return "-";
  return d.toLocaleString("en-GB");
}

function fileStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function Engineer() {
  const navigate = useNavigate();
  const { user, userDoc } = useAuth();

  const engineerUid = user?.uid || "";
  const engineerName = userDoc?.name || user?.email || "";

  const [pageLoading, setPageLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFilter, setTaskFilter] = useState("ALL");
  const [snapshotFilter, setSnapshotFilter] = useState(SNAPSHOT_FILTERS.ALL);
  const [siteTaskSearch, setSiteTaskSearch] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [expandedTimeline, setExpandedTimeline] = useState({});
  const [loggingOut, setLoggingOut] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [nextWeekLoading, setNextWeekLoading] = useState(false);
  const [showWeekCloseModal, setShowWeekCloseModal] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDayName, setNewTaskDayName] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const [showReports, setShowReports] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [allEngineerTasks, setAllEngineerTasks] = useState([]);
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatus, setReportStatus] = useState("ALL");
  const [reportPriority, setReportPriority] = useState("ALL");
  const [reportSiteId, setReportSiteId] = useState("ALL");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportSort, setReportSort] = useState("UPDATED_DESC");
  const [reportPage, setReportPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const loadEngineerSites = async () => {
    try {
      setSitesLoading(true);
      if (!engineerUid) return;
      const ref = collection(db, "sites");
      const q = query(ref, where("assignedEngineerId", "==", engineerUid), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setSites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load assigned sites");
    } finally {
      setSitesLoading(false);
    }
  };

  const loadTasksBySite = async (site) => {
    try {
      setTasksLoading(true);
      const ref = collection(db, "tasks");
      const weekKey = site?.currentWeekKey;
      const q = query(
        ref,
        where("siteId", "==", site.id),
        where("weekKey", "==", weekKey),
        where("assignedEngineerId", "==", engineerUid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  };

  const loadEngineerTaskReport = async () => {
    try {
      setReportLoading(true);
      if (!engineerUid) return;
      const ref = collection(db, "tasks");
      const q = query(ref, where("assignedEngineerId", "==", engineerUid), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAllEngineerTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load engineer report");
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    loadEngineerSites();
  }, [engineerUid]);

  useEffect(() => {
    if (!showReports) return;
    loadEngineerTaskReport();
  }, [showReports, engineerUid]);

  useEffect(() => {
    if (!selectedSite) return;
    setTaskFilter("ALL");
    setSnapshotFilter(SNAPSHOT_FILTERS.ALL);
    setSiteTaskSearch("");
    setSelectedTaskIds([]);
    setExpandedTimeline({});
  }, [selectedSite?.id]);

  useEffect(() => {
    setReportPage(1);
  }, [
    reportSearch,
    reportStatus,
    reportPriority,
    reportSiteId,
    reportDateFrom,
    reportDateTo,
    reportSort,
    showReports,
  ]);

  useEffect(() => {
    const validIds = new Set(tasks.map((t) => t.id));
    setSelectedTaskIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [tasks]);

  useEffect(() => {
    const checkAutoCarryForward = async () => {
      if (!selectedSite || tasks.length === 0 || nextWeekLoading) return;

      const hasVeryOldTask = tasks.some((task) => {
        if (task.status !== "PENDING" || !task.statusUpdatedAt) return false;
        const diffDays = (Date.now() - task.statusUpdatedAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 7;
      });

      if (hasVeryOldTask) onNextWeek(true);
    };

    checkAutoCarryForward();
  }, [tasks, selectedSite]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate("/login", { replace: true });
    } catch (e) {
      showError(e, "Logout failed");
      setLoggingOut(false);
    }
  };

  const addTask = async () => {
    if (!selectedSite?.id || !newTaskTitle.trim() || !expectedCompletionDate) {
      return showError(null, "Description and completion date are required");
    }

    try {
      setAddingTask(true);
      const ref = collection(db, "tasks");
      await addDoc(ref, {
        siteId: selectedSite.id,
        siteName: selectedSite.name || "",
        assignedEngineerId: engineerUid,
        assignedEngineerName: engineerName,
        title: newTaskTitle.trim(),
        status: "PENDING",
        priority: newTaskPriority,
        dayName: newTaskDayName || null,
        expectedCompletionDate: Timestamp.fromDate(new Date(expectedCompletionDate)),
        createdBy: "ENGINEER",
        createdByUid: engineerUid,
        createdByName: engineerName,
        weekKey: selectedSite.currentWeekKey,
        statusUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess("Task added");
      setNewTaskTitle("");
      setNewTaskDayName("");
      setExpectedCompletionDate("");
      await loadTasksBySite(selectedSite);
      if (showReports) await loadEngineerTaskReport();
    } catch (e) {
      showError(e, "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };
  const updateTaskStatus = async (taskId, status) => {
    try {
      setUpdatingTaskId(taskId);
      const ref = doc(db, "tasks", taskId);
      await updateDoc(ref, {
        status,
        statusUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess(`Task updated: ${status}`);
      await loadTasksBySite(selectedSite);
      if (showReports) await loadEngineerTaskReport();
    } catch (e) {
      showError(e, "Failed to update task");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const onNextWeek = async (isAuto = false) => {
    const pendingCount = tasks.filter((t) => t.status === "PENDING").length;
    if (pendingCount === 0) return !isAuto && showError(null, "No pending tasks");
    if (!isAuto) {
      setShowWeekCloseModal(true);
      return;
    }

    try {
      setNextWeekLoading(true);
      const res = await carryForwardToNextWeek(selectedSite.id);
      showSuccess(isAuto ? "Auto-transition: next week started" : "Next week started");
      const updatedSite = { ...selectedSite, currentWeekKey: res.to };
      setSelectedSite(updatedSite);
      await loadTasksBySite(updatedSite);
      if (showReports) await loadEngineerTaskReport();
    } catch (e) {
      showError(e, "Failed to start next week");
    } finally {
      setNextWeekLoading(false);
    }
  };

  const confirmStartNextWeek = async () => {
    try {
      setShowWeekCloseModal(false);
      setNextWeekLoading(true);
      const res = await carryForwardToNextWeek(selectedSite.id);
      showSuccess("Next week started");
      const updatedSite = { ...selectedSite, currentWeekKey: res.to };
      setSelectedSite(updatedSite);
      await loadTasksBySite(updatedSite);
      if (showReports) await loadEngineerTaskReport();
    } catch (e) {
      showError(e, "Failed to start next week");
    } finally {
      setNextWeekLoading(false);
    }
  };

  const getPendingSinceDays = (task) => {
    if (task.status !== "PENDING" || !task.statusUpdatedAt) return null;
    const updatedAt = safeToDate(task.statusUpdatedAt);
    if (!updatedAt) return null;
    const diff = Date.now() - updatedAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getTaskAgingSeverity = (task) => {
    const days = getPendingSinceDays(task);
    if (days === null || days <= 0) return null;
    if (days <= 3) return "warning";
    if (days <= 7) return "alert";
    return "critical";
  };

  const getTaskStatusBadge = (task, pendingDays, isOverdue) => {
    if (task.status === "DONE") return "Done";
    if (task.status === "CANCELLED") return "Cancelled";
    const days = pendingDays ?? 0;
    if (isOverdue) return `Overdue: ${days} दिवस`;
    return `Pending: ${days} दिवस`;
  };

  const siteAnalytics = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const dayAfterTomorrowStart = new Date(todayStart);
    dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);

    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === "PENDING").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
    const overdue = tasks.filter((t) => {
      if (t.status !== "PENDING") return false;
      const due = safeToDate(t.expectedCompletionDate);
      return !!due && due.getTime() < todayStart.getTime();
    }).length;
    const dueToday = tasks.filter((t) => {
      if (t.status !== "PENDING") return false;
      const due = safeToDate(t.expectedCompletionDate);
      return !!due && due.getTime() >= todayStart.getTime() && due.getTime() < tomorrowStart.getTime();
    }).length;
    const dueTomorrow = tasks.filter((t) => {
      if (t.status !== "PENDING") return false;
      const due = safeToDate(t.expectedCompletionDate);
      return !!due && due.getTime() >= tomorrowStart.getTime() && due.getTime() < dayAfterTomorrowStart.getTime();
    }).length;
    const highPriorityPending = tasks.filter(
      (t) => t.status === "PENDING" && (t.priority || "NORMAL") === "HIGH",
    ).length;
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      total,
      pending,
      done,
      cancelled,
      overdue,
      dueToday,
      dueTomorrow,
      highPriorityPending,
      completionPct,
    };
  }, [tasks]);

  const summary = siteAnalytics;

  const performanceThisWeek = useMemo(() => {
    const done = tasks.filter((t) => t.status === "DONE").length;
    const total = tasks.length;
    const overdue = tasks.filter((t) => {
      if (t.status !== "PENDING") return false;
      const due = safeToDate(t.expectedCompletionDate);
      return !!due && due.getTime() < startOfDay(new Date()).getTime();
    }).length;
    const highPriorityPending = tasks.filter(
      (t) => t.status === "PENDING" && (t.priority || "NORMAL") === "HIGH",
    ).length;
    return {
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
      completed: done,
      overdue,
      highPriorityPending,
    };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const dayAfterTomorrowStart = new Date(todayStart);
    dayAfterTomorrowStart.setDate(todayStart.getDate() + 2);
    const q = siteTaskSearch.trim().toLowerCase();

    return tasks.filter((t) => {
      if (taskFilter !== "ALL" && t.status !== taskFilter) return false;

      const due = safeToDate(t.expectedCompletionDate);
      const isOverdue =
        t.status === "PENDING" && !!due && due.getTime() < todayStart.getTime();
      const isDueToday =
        t.status === "PENDING" &&
        !!due &&
        due.getTime() >= todayStart.getTime() &&
        due.getTime() < tomorrowStart.getTime();
      const isDueTomorrow =
        t.status === "PENDING" &&
        !!due &&
        due.getTime() >= tomorrowStart.getTime() &&
        due.getTime() < dayAfterTomorrowStart.getTime();

      if (snapshotFilter === SNAPSHOT_FILTERS.DUE_TODAY && !isDueToday) return false;
      if (snapshotFilter === SNAPSHOT_FILTERS.OVERDUE && !isOverdue) return false;
      if (
        snapshotFilter === SNAPSHOT_FILTERS.HIGH_PENDING &&
        !(t.status === "PENDING" && (t.priority || "NORMAL") === "HIGH")
      ) {
        return false;
      }
      if (snapshotFilter === SNAPSHOT_FILTERS.DUE_TOMORROW && !isDueTomorrow) return false;

      if (!q) return true;
      const haystack = [t.title || "", t.dayName || "", t.weekKey || ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tasks, taskFilter, snapshotFilter, siteTaskSearch]);

  const allVisibleSelected =
    visibleTasks.length > 0 &&
    visibleTasks.every((t) => selectedTaskIds.includes(t.id));

  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleTasks.map((t) => t.id));
      setSelectedTaskIds((prev) => prev.filter((id) => !visibleIds.has(id)));
      return;
    }
    const visibleIds = visibleTasks.map((t) => t.id);
    setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const toggleTimeline = (taskId) => {
    setExpandedTimeline((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const bulkMarkDone = async () => {
    const targetIds = selectedTaskIds.filter((id) =>
      tasks.some((t) => t.id === id && t.status !== "DONE"),
    );
    if (targetIds.length === 0) {
      showError(null, "Select pending tasks first");
      return;
    }
    try {
      setBulkUpdating(true);
      const batch = writeBatch(db);
      const now = Timestamp.now();

      targetIds.forEach((id) => {
        batch.update(doc(db, "tasks", id), {
          status: "DONE",
          statusUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setTasks((prev) =>
        prev.map((t) =>
          targetIds.includes(t.id)
            ? { ...t, status: "DONE", statusUpdatedAt: now, updatedAt: now }
            : t,
        ),
      );

      await batch.commit();
      setSelectedTaskIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      showSuccess(`Marked done: ${targetIds.length}`);
      await loadTasksBySite(selectedSite);
      if (showReports) await loadEngineerTaskReport();
    } catch (e) {
      showError(e, "Failed bulk update");
      await loadTasksBySite(selectedSite);
    } finally {
      setBulkUpdating(false);
    }
  };

  const siteMap = useMemo(() => {
    const m = new Map();
    sites.forEach((s) => m.set(s.id, s));
    return m;
  }, [sites]);

  const reportTasks = useMemo(() => {
    const fromDate = reportDateFrom ? new Date(`${reportDateFrom}T00:00:00`) : null;
    const toDate = reportDateTo ? new Date(`${reportDateTo}T23:59:59`) : null;
    const q = reportSearch.trim().toLowerCase();

    let list = allEngineerTasks.filter((t) => {
      if (reportStatus !== "ALL" && (t.status || "PENDING") !== reportStatus) return false;
      if (reportPriority !== "ALL" && (t.priority || "NORMAL") !== reportPriority) return false;
      if (reportSiteId !== "ALL" && t.siteId !== reportSiteId) return false;

      const due = safeToDate(t.expectedCompletionDate);
      if (fromDate && (!due || due.getTime() < fromDate.getTime())) return false;
      if (toDate && (!due || due.getTime() > toDate.getTime())) return false;

      if (!q) return true;
      const siteName = t.siteName || siteMap.get(t.siteId)?.name || "";
      const haystack = [t.title || "", t.status || "", t.priority || "", t.dayName || "", t.weekKey || "", siteName]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    list.sort((a, b) => {
      const aDue = safeToDate(a.expectedCompletionDate)?.getTime() || 0;
      const bDue = safeToDate(b.expectedCompletionDate)?.getTime() || 0;
      const aCreated = safeToDate(a.createdAt)?.getTime() || 0;
      const bCreated = safeToDate(b.createdAt)?.getTime() || 0;
      const aUpdated = safeToDate(a.updatedAt)?.getTime() || 0;
      const bUpdated = safeToDate(b.updatedAt)?.getTime() || 0;
      const aPriority = (a.priority || "NORMAL") === "HIGH" ? 1 : 0;
      const bPriority = (b.priority || "NORMAL") === "HIGH" ? 1 : 0;

      if (reportSort === "DUE_ASC") return aDue - bDue;
      if (reportSort === "DUE_DESC") return bDue - aDue;
      if (reportSort === "PRIORITY_HIGH") {
        if (bPriority !== aPriority) return bPriority - aPriority;
        return bUpdated - aUpdated;
      }
      if (reportSort === "CREATED_DESC") return bCreated - aCreated;
      return bUpdated - aUpdated;
    });

    return list;
  }, [
    allEngineerTasks,
    reportStatus,
    reportPriority,
    reportSiteId,
    reportDateFrom,
    reportDateTo,
    reportSearch,
    reportSort,
    siteMap,
  ]);

  const reportSummary = useMemo(() => {
    const total = reportTasks.length;
    const pending = reportTasks.filter((t) => t.status === "PENDING").length;
    const done = reportTasks.filter((t) => t.status === "DONE").length;
    const cancelled = reportTasks.filter((t) => t.status === "CANCELLED").length;
    const high = reportTasks.filter((t) => (t.priority || "NORMAL") === "HIGH").length;
    return { total, pending, done, cancelled, high };
  }, [reportTasks]);

  const reportPageModel = useMemo(() => {
    const total = reportTasks.length;
    const totalPages = Math.max(1, Math.ceil(total / REPORT_PAGE_SIZE));
    const safePage = Math.min(Math.max(reportPage, 1), totalPages);
    const start = (safePage - 1) * REPORT_PAGE_SIZE;
    return {
      total,
      totalPages,
      page: safePage,
      items: reportTasks.slice(start, start + REPORT_PAGE_SIZE),
      start: total === 0 ? 0 : start + 1,
      end: Math.min(start + REPORT_PAGE_SIZE, total),
    };
  }, [reportTasks, reportPage]);

  const exportReportPdf = async () => {
    try {
      setReportExporting(true);

      const pdf = new jsPDF("p", "mm", "a4");
      pdf.setFontSize(18);
      pdf.text("RP Construction", 14, 16);
      pdf.setFontSize(11);
      pdf.text("Engineer Task Report", 14, 23);
      pdf.setFontSize(9);
      pdf.text(`Engineer: ${engineerName}`, 14, 29);
      pdf.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 34);
      pdf.text(`Filters: Status=${reportStatus}, Priority=${reportPriority}, Sort=${reportSort}`, 14, 39);

      autoTable(pdf, {
        startY: 45,
        head: [["Title", "Site", "Week", "Status", "Priority", "Day", "Due Date", "Updated"]],
        body: reportTasks.map((t) => [
          t.title || "-",
          t.siteName || siteMap.get(t.siteId)?.name || "-",
          formatMarathiWeekFromDate(t.expectedCompletionDate),
          t.status || "PENDING",
          t.priority || "NORMAL",
          t.dayName || "-",
          fmtDate(t.expectedCompletionDate),
          fmtDateTime(t.updatedAt),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42] },
      });

      pdf.save(`rp-construction_engineer_report_${fileStamp()}.pdf`);
      showSuccess("PDF report exported");
    } catch (e) {
      showError(e, "Failed to export PDF");
    } finally {
      setReportExporting(false);
    }
  };

  if (pageLoading) {
    return (
      <Layout>
        <SkeletonBox />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-dashboard">
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">RP Construction Tracker</h1>
            <span className="header-badge">Engineer: {engineerName}</span>
          </div>
          <div className="header-actions" style={{ gap: 8 }}>
            <Button className="btn-muted-action" onClick={() => setShowReports((v) => !v)}>
              {showReports ? "Back to Dashboard" : "Engineer Reports"}
            </Button>
            <Button className="btn-danger-header" loading={loggingOut} onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>
        {showReports && (
          <section className="engineer-report-section">
            <div className="engineer-report-header">
              <h2 className="section-heading">Engineer Task Reports</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <Button className="btn-muted-action" loading={reportLoading} onClick={loadEngineerTaskReport}>
                  Refresh
                </Button>
                <Button className="btn-add-task-pro" loading={reportExporting} onClick={exportReportPdf}>
                  Export PDF
                </Button>
              </div>
            </div>

            <div className="engineer-report-filters">
              <input
                className="task-input-pro-v2"
                placeholder="Search title/site/week/day..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
              />

              <select className="task-select-pro-v2" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select className="task-select-pro-v2" value={reportPriority} onChange={(e) => setReportPriority(e.target.value)}>
                <option value="ALL">All Priority</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
              </select>

              <select className="task-select-pro-v2" value={reportSiteId} onChange={(e) => setReportSiteId(e.target.value)}>
                <option value="ALL">All Sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || "Unnamed Site"}
                  </option>
                ))}
              </select>

              <input type="date" className="task-input-pro-v2" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} />
              <input type="date" className="task-input-pro-v2" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} />

              <select className="task-select-pro-v2" value={reportSort} onChange={(e) => setReportSort(e.target.value)}>
                <option value="UPDATED_DESC">Latest Updated</option>
                <option value="CREATED_DESC">Latest Created</option>
                <option value="DUE_ASC">Due Date Asc</option>
                <option value="DUE_DESC">Due Date Desc</option>
                <option value="PRIORITY_HIGH">Priority (High First)</option>
              </select>
            </div>

            <div className="engineer-report-summary">
              <span className="ui-badge">Total: {reportSummary.total}</span>
              <span className="ui-badge">Pending: {reportSummary.pending}</span>
              <span className="ui-badge">Done: {reportSummary.done}</span>
              <span className="ui-badge">Cancelled: {reportSummary.cancelled}</span>
              <span className="ui-badge">High Priority: {reportSummary.high}</span>
            </div>

            {reportLoading ? (
              <SkeletonBox />
            ) : reportPageModel.total === 0 ? (
              <EmptyState title="No tasks found" subtitle="Try clearing filters." />
            ) : (
              <div>
                <div className="engineer-report-table-wrap">
                  <table className="engineer-report-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Site</th>
                        <th>Week</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Day</th>
                        <th>Due Date</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportPageModel.items.map((t) => (
                        <tr key={t.id}>
                          <td>{t.title || "-"}</td>
                          <td>{t.siteName || siteMap.get(t.siteId)?.name || "-"}</td>
                          <td>{formatMarathiWeekFromDate(t.expectedCompletionDate)}</td>
                          <td>{t.status || "PENDING"}</td>
                          <td>{t.priority || "NORMAL"}</td>
                          <td>{t.dayName || "-"}</td>
                          <td>{fmtDate(t.expectedCompletionDate)}</td>
                          <td>{fmtDateTime(t.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="engineer-report-pagination">
                  <div className="engineer-report-page-info">
                    Showing {reportPageModel.start}-{reportPageModel.end} of {reportPageModel.total}
                  </div>
                  <div className="engineer-report-page-actions">
                    <button
                      className="btn-muted-action"
                      onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                      disabled={reportPageModel.page <= 1}
                    >
                      Prev
                    </button>
                    <span className="engineer-report-page-label">
                      Page {reportPageModel.page} / {reportPageModel.totalPages}
                    </span>
                    <button
                      className="btn-muted-action"
                      onClick={() =>
                        setReportPage((p) =>
                          Math.min(reportPageModel.totalPages, p + 1),
                        )
                      }
                      disabled={reportPageModel.page >= reportPageModel.totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {!showReports && !selectedSite && (
          <section className="sites-section">
            <div className="sites-section-header">
              <div className="highlight-pill">
                <h2 className="section-heading">Assigned Projects</h2>
              </div>
            </div>
            {sitesLoading ? (
              <SkeletonBox />
            ) : (
              <div className="sites-grid">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className="site-card-compact"
                    onClick={() => {
                      setSelectedSite(site);
                      loadTasksBySite(site);
                    }}
                  >
                    <div className="card-top">
                      <h3 className="site-name-bold">{site.name}</h3>
                    </div>
                    <div className="card-footer">
                      <div className="meta-item">
                        Week: <strong>{site.currentWeekKey}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!showReports && selectedSite && (
          <>
            <div className="detail-view">
              {summary.overdue > 0 && (
                <div className="site-reminder-banner">
                  You have {summary.overdue} overdue task{summary.overdue > 1 ? "s" : ""}
                </div>
              )}
              {summary.highPriorityPending > 0 && (
                <div className="site-priority-banner">
                  You have high priority pending tasks: {summary.highPriorityPending}
                </div>
              )}
              <div className="sticky-back-header-v5">
              <button className="btn-back-pro" onClick={() => setSelectedSite(null)}>
                <span className="back-icon">{"<-"}</span>
                <div className="back-text">
                  <span className="back-label">Back to Projects</span>
                  <span className="back-sub">Dashboard View</span>
                </div>
              </button>
              <div className="engineer-badge-pill">
                <div className="badge-content-v5">
                  <span className="eng-label-v5">Active Site</span>
                  <h2 className="eng-name-v5">{selectedSite.name}</h2>
                </div>
              </div>
            </div>

            <div className="system-alerts-bar">
              <div className="alert-content">
                <span className="pulse-dot"></span>
                <p>
                  <strong>Site Health:</strong> Pending: <b>{summary.pending}</b> | Done: <b>{summary.done}</b> | Overdue: <b>{summary.overdue}</b> | Week: <b>{formatMarathiWeekFromDate(new Date())}</b>
                </p>
              </div>
              <div className="alert-btns">
                <button className="btn-muted-action" onClick={() => loadTasksBySite(selectedSite)}>
                  Refresh
                </button>
              </div>
            </div>

            <div className="today-snapshot-grid">
              <button
                className={`today-snapshot-card ${snapshotFilter === SNAPSHOT_FILTERS.DUE_TODAY ? "active" : ""}`}
                onClick={() =>
                  setSnapshotFilter((prev) =>
                    prev === SNAPSHOT_FILTERS.DUE_TODAY ? SNAPSHOT_FILTERS.ALL : SNAPSHOT_FILTERS.DUE_TODAY,
                  )
                }
              >
                <span className="snapshot-label">Tasks Due Today</span>
                <span className="snapshot-value">{summary.dueToday}</span>
              </button>
              <button
                className={`today-snapshot-card danger ${snapshotFilter === SNAPSHOT_FILTERS.OVERDUE ? "active" : ""}`}
                onClick={() =>
                  setSnapshotFilter((prev) =>
                    prev === SNAPSHOT_FILTERS.OVERDUE ? SNAPSHOT_FILTERS.ALL : SNAPSHOT_FILTERS.OVERDUE,
                  )
                }
              >
                <span className="snapshot-label">Overdue Tasks</span>
                <span className="snapshot-value">{summary.overdue}</span>
              </button>
              <button
                className={`today-snapshot-card warning ${snapshotFilter === SNAPSHOT_FILTERS.HIGH_PENDING ? "active" : ""}`}
                onClick={() =>
                  setSnapshotFilter((prev) =>
                    prev === SNAPSHOT_FILTERS.HIGH_PENDING ? SNAPSHOT_FILTERS.ALL : SNAPSHOT_FILTERS.HIGH_PENDING,
                  )
                }
              >
                <span className="snapshot-label">High Priority Pending</span>
                <span className="snapshot-value">{summary.highPriorityPending}</span>
              </button>
              <button
                className={`today-snapshot-card ${snapshotFilter === SNAPSHOT_FILTERS.DUE_TOMORROW ? "active" : ""}`}
                onClick={() =>
                  setSnapshotFilter((prev) =>
                    prev === SNAPSHOT_FILTERS.DUE_TOMORROW ? SNAPSHOT_FILTERS.ALL : SNAPSHOT_FILTERS.DUE_TOMORROW,
                  )
                }
              >
                <span className="snapshot-label">Due Tomorrow</span>
                <span className="snapshot-value">{summary.dueTomorrow}</span>
              </button>
            </div>
              <div className="detail-grid">
              <aside className="detail-config">
                <div className="config-card-pro summary-card-v3">
                  <div className="card-header-v3"><h3 className="card-heading-v3">Visual Progress</h3></div>
                  <div className="summary-body-v3">
                    {summary.total > 0 ? (
                      <>
                        <div className="visual-meter-v3">
                          <div className="meter-segment segment-done" style={{ width: `${(summary.done / summary.total) * 100}%` }}></div>
                          <div className="meter-segment segment-pending" style={{ width: `${(summary.pending / summary.total) * 100}%` }}></div>
                          <div className="meter-segment segment-overdue" style={{ width: `${(summary.overdue / summary.total) * 100}%` }}></div>
                        </div>
                        <div className="meter-legend">
                          <span className="legend-item"><span className="legend-dot done"></span>Done</span>
                          <span className="legend-item"><span className="legend-dot pending"></span>Pending</span>
                          <span className="legend-item"><span className="legend-dot overdue"></span>Overdue</span>
                        </div>
                        <div className="stats-list-v3">
                          <div className="stat-item-v3"><span className="stat-label">Done</span><span className="stat-value">{summary.done}</span></div>
                          <div className="stat-item-v3"><span className="stat-label">Pending</span><span className="stat-value">{summary.pending}</span></div>
                          <div className="stat-item-v3"><span className="stat-label">Overdue</span><span className="stat-value">{summary.overdue}</span></div>
                        </div>
                        <div className="completion-v3">
                          <span className="completion-pct">{summary.completionPct}%</span>
                          <span className="completion-label">Progress</span>
                        </div>
                      </>
                    ) : <EmptyState title="No tasks" />}
                  </div>
                </div>

                <div className="config-card-pro summary-card-v3" style={{ marginTop: "10px" }}>
                  <div className="card-header-v3"><h3 className="card-heading-v3">This Week Performance</h3></div>
                  <div className="summary-body-v3">
                    <div className="stats-list-v3">
                      <div className="stat-item-v3"><span className="stat-label">Completion</span><span className="stat-value">{performanceThisWeek.completionPct}%</span></div>
                      <div className="stat-item-v3"><span className="stat-label">Completed</span><span className="stat-value">{performanceThisWeek.completed}</span></div>
                      <div className="stat-item-v3"><span className="stat-label">Overdue</span><span className="stat-value">{performanceThisWeek.overdue}</span></div>
                      <div className="stat-item-v3"><span className="stat-label">High Pending</span><span className="stat-value">{performanceThisWeek.highPriorityPending}</span></div>
                    </div>
                  </div>
                </div>

                <Button
                  className="btn-add-task-pro"
                  style={{ width: "100%", marginTop: "10px" }}
                  loading={nextWeekLoading}
                  disabled={summary.pending === 0}
                  onClick={() => onNextWeek(false)}
                >
                  Start Next Week
                </Button>
              </aside>

              <main className="detail-main">
                <section className="task-creation-panel">
                  <div className="panel-header-pro"><h3 className="panel-title-pro">Create Site Task</h3></div>
                  <div className="task-form-grid">
                    <div className="form-item-pro title-span">
                      <label className="input-label-pro">Description</label>
                      <input className="task-input-pro-v2" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g. Slab Reinforcement" />
                    </div>
                    <div className="form-item-pro">
                      <label className="input-label-pro">Day</label>
                      <select className="task-select-pro-v2" value={newTaskDayName} onChange={(e) => setNewTaskDayName(e.target.value)}>
                        <option value="">Any Day</option>
                        {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="form-item-pro">
                      <label className="input-label-pro">Due Date</label>
                      <input type="date" className="task-input-pro-v2" value={expectedCompletionDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setExpectedCompletionDate(e.target.value)} />
                    </div>
                    <div className="form-item-pro">
                      <label className="input-label-pro">Priority</label>
                      <div className="priority-segmented-control">
                        <button type="button" className={`segment-btn ${newTaskPriority === "NORMAL" ? "active" : ""}`} onClick={() => setNewTaskPriority("NORMAL")}>Normal</button>
                        <button type="button" className={`segment-btn high ${newTaskPriority === "HIGH" ? "active" : ""}`} onClick={() => setNewTaskPriority("HIGH")}>High</button>
                      </div>
                    </div>
                    <div className="form-item-pro action-span">
                      <label className="input-label-pro">&nbsp;</label>
                      <Button className="btn-add-task-pro" loading={addingTask} onClick={addTask}>+ Add Task</Button>
                    </div>
                  </div>
                </section>

                <div className="task-manager-card">
                  <div className="task-controls-sticky">
                    <div className="tab-group-v2">
                      {["ALL", "PENDING", "DONE", "CANCELLED"].map((val) => (
                        <button key={val} className={`tab-btn-v2 ${taskFilter === val ? "active" : ""}`} onClick={() => setTaskFilter(val)}>
                          {val} <span className="tab-count">{val === "ALL" ? summary.total : val === "PENDING" ? summary.pending : val === "DONE" ? summary.done : summary.cancelled}</span>
                        </button>
                      ))}
                    </div>
                    <div className="site-task-toolbar">
                      <input
                        className="task-input-pro-v2"
                        placeholder="Search title / day / week"
                        value={siteTaskSearch}
                        onChange={(e) => setSiteTaskSearch(e.target.value)}
                      />
                      <label className="task-select-all">
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                        Select All
                      </label>
                      <Button
                        className="btn-add-task-pro"
                        loading={bulkUpdating}
                        onClick={bulkMarkDone}
                        disabled={selectedTaskIds.length === 0}
                      >
                        Bulk Mark Done
                      </Button>
                    </div>
                  </div>

                  <div className="task-list-v2">
                    {tasksLoading ? <SkeletonBox /> : visibleTasks.map((task) => {
                        const pendingDays = getPendingSinceDays(task);
                        const dueDate = safeToDate(task.expectedCompletionDate);
                        const createdAt = safeToDate(task.createdAt);
                        const todayStart = startOfDay(new Date());
                        const tomorrowStart = new Date(todayStart);
                        tomorrowStart.setDate(todayStart.getDate() + 1);
                        const isOverdue =
                          task.status === "PENDING" &&
                          !!dueDate &&
                          dueDate.getTime() < todayStart.getTime();
                        const isHighPending =
                          task.status === "PENDING" && (task.priority || "NORMAL") === "HIGH";
                        const isNewToday =
                          !!createdAt &&
                          createdAt.getTime() >= todayStart.getTime() &&
                          createdAt.getTime() < tomorrowStart.getTime();
                        const agingSeverity = getTaskAgingSeverity(task);
                        const statusBadgeTone =
                          task.status === "DONE"
                            ? "done"
                            : task.status === "CANCELLED"
                              ? "cancelled"
                              : isOverdue
                                ? "overdue"
                                : "pending";
                        const statusAgeClass =
                          task.status === "PENDING" && !isOverdue ? agingSeverity || "" : "";
                        const highlightClass =
                          task.status === "DONE"
                            ? "task-highlight-done"
                            : isOverdue
                              ? "task-highlight-overdue"
                              : isHighPending
                                ? "task-highlight-high"
                                : isNewToday
                                  ? "task-highlight-new"
                                  : "";
                        return (
                          <div
                            key={task.id}
                            className={`task-card-v2 ${task.status === "DONE" ? "is-completed" : ""} ${highlightClass}`}
                          >
                            <div className="task-checkbox-wrap">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.includes(task.id)}
                                onChange={() => toggleTaskSelection(task.id)}
                              />
                            </div>
                            <div className={`task-priority-indicator ${task.priority === "HIGH" ? "high-priority" : "normal-priority"}`}></div>
                            <div className="task-content-main">
                              <div className="task-title-row">
                                <h5 className="task-title-v2">{task.title}</h5>
                                <span className={`task-status-badge ${statusBadgeTone} ${statusAgeClass}`}>
                                  {getTaskStatusBadge(task, pendingDays, isOverdue)}
                                </span>
                              </div>
                              <div className="task-meta-row">
                                <span className="task-meta-item">
                                  <span className="task-meta-label">DUE:</span>
                                  <span className="task-meta-value">{fmtDate(task.expectedCompletionDate)}</span>
                                </span>
                                <span className="task-meta-item">
                                  <span className="task-meta-label">WEEK:</span>
                                  <span className="task-meta-value">{formatMarathiWeekFromDate(task.expectedCompletionDate)}</span>
                                </span>
                                <span className="task-meta-item">
                                  <span className="task-meta-label">DAY:</span>
                                  <span className="task-meta-value">{task.dayName || "Any"}</span>
                                </span>
                              </div>
                              <button className="timeline-toggle-btn" onClick={() => toggleTimeline(task.id)}>
                                {expandedTimeline[task.id] ? "Hide Activity" : "Show Activity"}
                              </button>
                              {expandedTimeline[task.id] && (
                                <div className="task-timeline">
                                  <div><span>Created:</span> <b>{fmtDateTime(task.createdAt)}</b></div>
                                  <div><span>Updated:</span> <b>{fmtDateTime(task.updatedAt)}</b></div>
                                  <div><span>Status Updated:</span> <b>{fmtDateTime(task.statusUpdatedAt)}</b></div>
                                </div>
                              )}
                            </div>
                            <div className="task-actions-refined">
                              {task.status !== "DONE" ? (
                                <button className="btn-pro-action btn-done" disabled={updatingTaskId === task.id} onClick={() => updateTaskStatus(task.id, "DONE")}>Done</button>
                              ) : (
                                <button className="btn-pro-action btn-reopen" disabled={updatingTaskId === task.id} onClick={() => updateTaskStatus(task.id, "PENDING")}>Reopen</button>
                              )}
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              </main>
              </div>
            </div>
            {showWeekCloseModal && (
              <div className="week-close-modal-overlay">
                <div className="week-close-modal">
                  <h3>Week Closing Summary</h3>
                  <div className="week-close-grid">
                    <div><span>Total Tasks</span><b>{summary.total}</b></div>
                    <div><span>Done</span><b>{summary.done}</b></div>
                    <div><span>Pending</span><b>{summary.pending}</b></div>
                    <div><span>Overdue</span><b>{summary.overdue}</b></div>
                    <div><span>Completion</span><b>{summary.completionPct}%</b></div>
                    <div><span>Carry Forward</span><b>{summary.pending}</b></div>
                  </div>
                  <div className="week-close-actions">
                    <button
                      className="btn-muted-action"
                      onClick={() => setShowWeekCloseModal(false)}
                      disabled={nextWeekLoading}
                    >
                      Cancel
                    </button>
                    <Button
                      className="btn-add-task-pro"
                      loading={nextWeekLoading}
                      onClick={confirmStartNextWeek}
                    >
                      Confirm Start Next Week
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default Engineer;
