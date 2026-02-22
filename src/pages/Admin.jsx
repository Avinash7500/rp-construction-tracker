// src/pages/Admin.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import { logout } from "../utils/logout";
import Button from "../components/Button";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import "./Admin.css";

import {
  collection,
  getDocs,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
  where,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getISOWeekKey } from "../utils/weekUtils";
import { formatMarathiWeekFromDate } from "../utils/marathiWeekFormat";
import { exportSiteWeeklyReportPdf } from "../utils/exportSiteWeeklyReportPdf";

function Admin() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [engineers, setEngineers] = useState([]);
  const [engineersLoading, setEngineersLoading] = useState(true);
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [selectedEngineerUid, setSelectedEngineerUid] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [adminStatsLoading, setAdminStatsLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");
  const [newTaskDayName, setNewTaskDayName] = useState("");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [showCompleteFlow, setShowCompleteFlow] = useState(false);
  const [appreciation, setAppreciation] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [taskFilter, setTaskFilter] = useState("ALL");
  const [loggingOut, setLoggingOut] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [completingSite, setCompletingSite] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [weekFilter, setWeekFilter] = useState("ALL_WEEKS");
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");
  const [reportWeekKey, setReportWeekKey] = useState("");
  const [downloadingWeeklyReport, setDownloadingWeeklyReport] = useState(false);
  const [reassignEngineerUid, setReassignEngineerUid] = useState("");
  const [reassigning, setReassigning] = useState(false);

  const [siteSearch, setSiteSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const loadSites = async () => {
    try {
      setSitesLoading(true);
      const ref = collection(db, "sites");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const sitesData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSites(sitesData);
    } catch (e) {
      showError(e, "Failed to load sites");
    } finally {
      setSitesLoading(false);
    }
  };

  const loadEngineers = async () => {
    try {
      setEngineersLoading(true);
      const ref = collection(db, "users");
      const q = query(ref, where("role", "==", "ENGINEER"));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      setEngineers(list);
    } catch (e) {
      showError(e, "Failed to load engineers");
    } finally {
      setEngineersLoading(false);
    }
  };

  const loadTasksBySite = async (siteId) => {
    try {
      setTasksLoading(true);
      setTasks([]);
      const ref = collection(db, "tasks");
      const q = query(ref, where("siteId", "==", siteId), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const tasksData = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          expectedCompletionDate: getExpectedDateWithFallback(data),
        };
      });

      setTasks(tasksData);
      const weeks = Array.from(new Set(tasksData.map((t) => t.weekKey).filter(Boolean))).sort();
      setAvailableWeeks(weeks);
    } catch (e) {
      showError(e, "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  };

  const loadAllTasksForAdminStats = async () => {
    try {
      setAdminStatsLoading(true);
      const ref = collection(db, "tasks");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllTasks(data);
    } catch (e) {
      showError(e, "Failed to load admin stats");
    } finally {
      setAdminStatsLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
    loadEngineers();
    loadAllTasksForAdminStats();
  }, []);

  useEffect(() => {
    if (!selectedSite) {
      setReportWeekKey("");
      return;
    }
    setReportWeekKey(selectedSite.currentWeekKey || "");
  }, [selectedSite?.id, selectedSite?.currentWeekKey]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      showSuccess("Logged out");
      navigate("/login", { replace: true });
    } catch (e) {
      showError(e, "Logout failed");
      setLoggingOut(false);
    }
  };

  const handleCreateSite = async () => {
    const name = newSiteName.trim();
    if (!name) return showError(null, "Site name required");
    if (!selectedEngineerUid) return showError(null, "Please select engineer");
    const selectedEngineer = engineers.find((e) => e.uid === selectedEngineerUid);
    try {
      setCreatingSite(true);
      const ref = collection(db, "sites");
      await addDoc(ref, {
        name,
        assignedEngineerId: selectedEngineerUid,
        assignedEngineerName: selectedEngineer?.name || "",
        currentWeekKey: getISOWeekKey(),
        isCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess("Site created ✅");
      setNewSiteName("");
      setSelectedEngineerUid("");
      setShowCreateSite(false);
      await loadSites();
    } catch (e) {
      showError(e, "Failed to create site");
    } finally {
      setCreatingSite(false);
    }
  };

  const addTask = async () => {
    if (!selectedSite?.id || !newTaskTitle.trim() || !expectedCompletionDate) {
      return showError(null, "Task description and completion date required");
    }

    try {
      setAddingTask(true);
      const ref = collection(db, "tasks");
      await addDoc(ref, {
        siteId: selectedSite.id,
        assignedEngineerId: selectedSite.assignedEngineerId || null,
        title: newTaskTitle.trim(),
        status: "PENDING",
        priority: newTaskPriority,
        pendingWeeks: 0,
        dayName: newTaskDayName || null,
        expectedCompletionDate: Timestamp.fromDate(new Date(expectedCompletionDate)),
        createdBy: "ADMIN",
        weekKey: selectedSite.currentWeekKey || getISOWeekKey(),
        statusUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess("Task added ✅");
      setNewTaskTitle("");
      setNewTaskPriority("NORMAL");
      setNewTaskDayName("");
      setExpectedCompletionDate("");
      await loadTasksBySite(selectedSite.id);
      await loadAllTasksForAdminStats();
    } catch (e) {
      showError(e, "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    if (!selectedSite?.id) return;
    try {
      setUpdatingTaskId(taskId);
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status,
        statusUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess(`Task updated: ${status} ✅`);
      await loadTasksBySite(selectedSite.id);
      await loadAllTasksForAdminStats();
    } catch (e) {
      showError(e, "Failed to update task status");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const deleteTask = async (taskId) => {
    if (!selectedSite?.id) return;
    if (!window.confirm("Delete this task permanently?")) return;
    try {
      setDeletingTaskId(taskId);
      const taskRef = doc(db, "tasks", taskId);
      await deleteDoc(taskRef);
      showSuccess("Task deleted ✅");
      await loadTasksBySite(selectedSite.id);
      await loadAllTasksForAdminStats();
    } catch (e) {
      showError(e, "Failed to delete task");
    } finally {
      setDeletingTaskId(null);
    }
  };

  const getPendingDays = (task) => {
    try {
      if (!task?.statusUpdatedAt || task.status !== "PENDING") return null;
      const d = task.statusUpdatedAt?.toDate?.();
      if (!d) return null;
      const diffMs = Date.now() - d.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  const adminAlertCounts = useMemo(() => {
    const pending = allTasks.filter((t) => t.status === "PENDING").length;
    const overdue = allTasks.filter((t) => {
      if (t.status !== "PENDING") return false;
      const pd = getPendingDays(t);
      return pd !== null && pd >= 3;
    }).length;
    return { pending, overdue };
  }, [allTasks]);

  const getBadges = (task) => {
    const badges = [];
    const pendingDays = getPendingDays(task);
    if (task.status === "PENDING" && pendingDays !== null && pendingDays >= 3) {
      badges.push({ type: "OVERDUE", text: `🔥 Overdue ${pendingDays}d` });
    }
    const pw = task?.pendingWeeks || 0;
    if (pw >= 1) badges.push({ type: "CARRY", text: `↪ Carried ${pw} week${pw > 1 ? "s" : ""}` });
    if (task.priority === "HIGH") badges.push({ type: "HIGH", text: "⚡ High Priority" });
    return badges;
  };

  const formatDueDate = (ts) => {
    if (!ts?.toDate) return "—";
    const d = ts.toDate();
    return d
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
  };

  const isOverdueByDate = (task) => {
    if (task.status !== "PENDING") return false;
    const due = task.expectedCompletionDate?.toDate?.();
    if (!due) return false;
    return new Date() > due;
  };

  const getExpectedDateWithFallback = (task) => {
    if (task.expectedCompletionDate) return task.expectedCompletionDate;
    if (!task.createdAt?.toDate) return null;
    const d = task.createdAt.toDate();
    d.setDate(d.getDate() + 3);
    return Timestamp.fromDate(d);
  };

  const isTaskOverdue = (task) => {
    const pendingDays = getPendingDays(task);
    return task.status === "PENDING" && pendingDays !== null && pendingDays >= 3;
  };

  const filteredSites = useMemo(() => {
    return sites.filter((s) => s.name.toLowerCase().includes(siteSearch.toLowerCase()));
  }, [sites, siteSearch]);

  const filteredByWeek = tasks.filter((t) => {
    if (!selectedSite) return true;
    if (weekFilter === "ALL_WEEKS") return true;
    if (weekFilter === "CURRENT_WEEK") return t.weekKey === selectedSite.currentWeekKey;
    if (weekFilter === "WEEK_KEY") return selectedWeekKey ? t.weekKey === selectedWeekKey : true;
    return true;
  });

  const summary = useMemo(() => {
    const total = filteredByWeek.length;
    const pending = filteredByWeek.filter((t) => t.status === "PENDING").length;
    const done = filteredByWeek.filter((t) => t.status === "DONE").length;
    const cancelled = filteredByWeek.filter((t) => t.status === "CANCELLED").length;
    return { total, pending, done, cancelled };
  }, [filteredByWeek]);

  const visibleTasks = filteredByWeek.filter((t) => (taskFilter === "ALL" ? true : t.status === taskFilter));

  const sortedVisibleTasks = [...visibleTasks].sort((a, b) => {
    const ao = isOverdueByDate(a);
    const bo = isOverdueByDate(b);
    if (ao && !bo) return -1;
    if (!ao && bo) return 1;
    if (ao && bo) {
      return b.expectedCompletionDate.toDate() - a.expectedCompletionDate.toDate();
    }
    return 0;
  });

  const reportWeekOptions = useMemo(() => {
    if (!selectedSite) return [];
    const allWeeks = new Set([
      ...(availableWeeks || []),
      selectedSite.currentWeekKey || "",
    ]);
    return Array.from(allWeeks).filter(Boolean).sort();
  }, [availableWeeks, selectedSite]);

  const downloadWeeklySiteReport = async () => {
    if (!selectedSite?.id) return;
    const targetWeek = reportWeekKey || selectedSite.currentWeekKey;
    if (!targetWeek) {
      showError(null, "No week available for this site");
      return;
    }

    try {
      setDownloadingWeeklyReport(true);

      // Week filtering: report includes only tasks mapped to the selected weekKey.
      const weeklyTasks = tasks.filter(
        (t) => t.siteId === selectedSite.id && t.weekKey === targetWeek,
      );

      // Carry-forward detection: respect explicit flag if present, and fallback
      // to carry-forward counter used by the existing weekly transition flow.
      const normalized = weeklyTasks.map((t) => ({
        ...t,
        isCarryForward: t.isCarryForward === true || (t.pendingWeeks || 0) > 0,
      }));

      // Summary calculations are produced in the export utility:
      // total/completed/pending/carry-forward/completion % from filtered tasks.
      exportSiteWeeklyReportPdf({
        siteName: selectedSite.name || "Unnamed Site",
        weekKey: targetWeek,
        tasks: normalized,
      });

      showSuccess(`Weekly report downloaded (${targetWeek})`);
    } catch (e) {
      showError(e, "Failed to download weekly report");
    } finally {
      setDownloadingWeeklyReport(false);
    }
  };

  const reassignEngineer = async () => {
    if (!selectedSite?.id || !reassignEngineerUid) return showError(null, "Select engineer first");
    if (reassignEngineerUid === selectedSite.assignedEngineerId) return showError(null, "Same engineer already assigned");
    const newEngineer = engineers.find((e) => e.uid === reassignEngineerUid);
    if (!newEngineer) return showError(null, "Engineer not found");
    if (!window.confirm(`Reassign this site?\n\nTo: ${newEngineer.name || newEngineer.email}`)) return;

    try {
      setReassigning(true);
      const batch = writeBatch(db);
      const siteRef = doc(db, "sites", selectedSite.id);
      batch.update(siteRef, { assignedEngineerId: newEngineer.uid, assignedEngineerName: newEngineer.name || "", updatedAt: serverTimestamp() });
      const currentWeekKey = selectedSite.currentWeekKey;
      const tasksRef = collection(db, "tasks");
      const q = query(tasksRef, where("siteId", "==", selectedSite.id), where("weekKey", "==", currentWeekKey));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => batch.update(doc(db, "tasks", d.id), { assignedEngineerId: newEngineer.uid, updatedAt: serverTimestamp() }));
      await batch.commit();
      showSuccess("Engineer reassigned ✅");
      setSelectedSite({ ...selectedSite, assignedEngineerId: newEngineer.uid, assignedEngineerName: newEngineer.name || "" });
      setReassignEngineerUid("");
      await loadSites();
      await loadTasksBySite(selectedSite.id);
      await loadAllTasksForAdminStats();
    } catch (e) {
      showError(e, "Failed to reassign engineer");
    } finally {
      setReassigning(false);
    }
  };

  const statusFilters = [
    { value: "ALL", label: "All Tasks" },
    { value: "PENDING", label: "Pending" },
    { value: "DONE", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <Layout>
      <div className="admin-dashboard">
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">RP Construction Tracker</h1>
            <span className="header-badge">{role === "admin" ? "Master Admin" : role}</span>
          </div>
          <div className="header-actions">
            {!selectedSite && (
              <>
                <Button className="btn-primary-header" onClick={() => setShowCreateSite(true)}>
                  + Create Site
                </Button>

                {/* Moved inside the conditional block to hide when a site is open */}
                <Button
                  className="btn-secondary-header"
                  onClick={() => navigate("/admin/master")}
                >
                  ⚙ Manage Engineers & Sites
                </Button>
              </>
            )}
            <Button className="btn-secondary-header" onClick={() => navigate("/admin/reports")}>Analytics</Button>
            <Button className="btn-danger-header" loading={loggingOut} onClick={handleLogout}>Logout</Button>
          </div>
        </header>

        {!selectedSite && (
          <div className={`system-alerts-bar ${adminAlertCounts.overdue > 0 ? "alert-critical" : ""}`}>
            <div className="alert-content">
              <span className="pulse-dot"></span>
              <p>
                <strong>System Health:</strong>{" "}
                {adminStatsLoading ? "Checking..." : (
                  <>Overdue: <b>{adminAlertCounts.overdue}</b> &nbsp;|&nbsp; Pending: <b>{adminAlertCounts.pending}</b></>
                )}
              </p>
            </div>
            <div className="alert-btns">
              <button className="btn-muted-action" onClick={() => navigate("/admin/reports")}>View Reports</button>
              <button className="btn-muted-action" onClick={() => loadAllTasksForAdminStats()}>Refresh</button>
            </div>
          </div>
        )}

        {!selectedSite && showCreateSite && (
          <div className="modal-overlay" onClick={() => setShowCreateSite(false)}>
            <div className="modal-content modal-create-site" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-pro">
                <h3 className="modal-title-main">Create New Construction Site</h3>
                <p className="modal-subtitle">Register a new project location and assign a lead engineer.</p>
              </div>
              <div className="form-container-pro">
                <div className="form-group-pro">
                  <label className="form-label-pro">Site / Project Name</label>
                  <div className="input-with-hint">
                    <input
                      className="form-input-pro"
                      placeholder="e.g. Kolhapur – Residential Project"
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="form-group-pro">
                  <label className="form-label-pro">Assign Site Engineer</label>
                  <div className="input-with-hint">
                    <select
                      className="form-select-pro"
                      value={selectedEngineerUid}
                      onChange={(e) => setSelectedEngineerUid(e.target.value)}
                      disabled={engineersLoading}
                    >
                      <option value="">{engineersLoading ? "⏳ Fetching Engineers..." : "Engineer Name"}</option>
                      {engineers.map((eng) => (
                        <option key={eng.uid} value={eng.uid}>👤 {eng.name || eng.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-actions-pro">
                <Button className="btn-ghost-pro" onClick={() => setShowCreateSite(false)} disabled={creatingSite}>Cancel</Button>
                <Button
                  className="btn-confirm-pro"
                  loading={creatingSite}
                  onClick={handleCreateSite}
                  disabled={!newSiteName.trim() || !selectedEngineerUid}
                >
                  Create Site
                </Button>
              </div>
            </div>
          </div>
        )}

        {!selectedSite && (
          <section className="sites-section">
            <div className="sites-section-header">
              <div className="highlight-pill">
                <h2 className="section-heading">Operational Sites</h2>
              </div>
              <div className="site-search-wrap">
                <input
                  type="text"
                  className="site-search-input"
                  placeholder="🔍 Search site name..."
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                />
              </div>
            </div>

            {sitesLoading ? (
              <div className="skeleton-grid"><SkeletonBox /><SkeletonBox /><SkeletonBox /></div>
            ) : filteredSites.length === 0 ? (
              <EmptyState title="No active sites" subtitle="No sites found matching your search." />
            ) : (
              <div className="sites-grid">
                {filteredSites.map((site) => (
                  <div key={site.id} className="site-card-compact" onClick={async () => {
                    setSelectedSite(site);
                    setTaskFilter("ALL");
                    setWeekFilter("ALL_WEEKS");
                    await loadTasksBySite(site.id);
                  }}>
                    <div className="card-top">
                      <h3 className="site-name-bold">{site.name}</h3>
                      <span className={`status-pill ${site.isCompleted ? "pill-completed" : "pill-active"}`}>
                        {site.isCompleted ? "Finished" : "Active"}
                      </span>
                    </div>
                    <div className="card-footer">
                      <div className="meta-item"><span>Eng:</span> <strong>{site.assignedEngineerName || "N/A"}</strong></div>
                      <div className="meta-item"><span>Week:</span> <strong>{site.currentWeekKey || "—"}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedSite && !showCompleteFlow && (
          <div className="detail-view">
            <div className="sticky-back-header-v5">
              <button className="btn-back-pro" onClick={() => setSelectedSite(null)}>
                <span className="back-icon">←</span>
                <div className="back-text">
                  <span className="back-label">Back to Project Dashboard</span>
                </div>
              </button>
              <div className="engineer-badge-pill">
                <div className="badge-content-v5">
                  <span className="eng-label-v5">Project Engineer</span>
                  <div className="eng-name-wrap-v5">
                    <span className="eng-icon-v5">👤</span>
                    <h2 className="eng-name-v5">
                      {selectedSite.assignedEngineerName || "Not Assigned"}
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            <div className="site-report-toolbar">
              <Button className="btn-muted-action" onClick={() => navigate("/admin/reports")}>
                Analytics
              </Button>

              <select
                className="form-select-pro-sm site-report-week-select"
                value={reportWeekKey}
                onChange={(e) => setReportWeekKey(e.target.value)}
              >
                {reportWeekOptions.length === 0 ? (
                  <option value="">No week available</option>
                ) : (
                  reportWeekOptions.map((wk) => (
                    <option key={wk} value={wk}>
                      {wk}
                    </option>
                  ))
                )}
              </select>

              <Button
                className="btn-add-task-pro site-report-download-btn"
                loading={downloadingWeeklyReport}
                onClick={downloadWeeklySiteReport}
              >
                Download Weekly Report
              </Button>
            </div>

            <div className="detail-grid">
              <aside className="detail-config">
                <div className="config-card-pro">
                  <div className="card-header-v3">
                    <h3 className="card-heading-v3">Site Configuration</h3>
                    <span className="card-dot-v3"></span>
                  </div>
                  <div className="config-body-v3">
                    <div className="config-group-v3">
                      <label className="config-label-v3">Assigned Site Engineer</label>
                      <p className="config-help-v3">Reassigning affects only current and future week tasks.</p>
                      <div className="config-action-row">
                        <select
                          className="form-select-pro-sm"
                          value={reassignEngineerUid}
                          onChange={(e) => setReassignEngineerUid(e.target.value)}
                          disabled={engineersLoading || reassigning}
                        >
                          <option value="">Choose Engineer...</option>
                          {engineers.map((eng) => (
                            <option key={eng.uid} value={eng.uid}>{eng.name || eng.email}</option>
                          ))}
                        </select>
                        <Button
                          className="btn-reassign-v3"
                          loading={reassigning}
                          onClick={reassignEngineer}
                          disabled={!reassignEngineerUid}
                        >
                          Update
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="config-card-pro summary-card-v3">
                  <div className="card-header-v3">
                    <h3 className="card-heading-v3">Completion Health</h3>
                  </div>
                  <div className="summary-body-v3">
                    {summary.total > 0 ? (
                      <>
                        <div className="visual-meter-v3">
                          <div
                            className="meter-segment segment-done"
                            style={{ width: `${(summary.done / summary.total) * 100}%` }}
                            title={`Done: ${summary.done}`}
                          ></div>
                          <div
                            className="meter-segment segment-pending"
                            style={{ width: `${(summary.pending / summary.total) * 100}%` }}
                            title={`Pending: ${summary.pending}`}
                          ></div>
                          <div
                            className="meter-segment segment-cancelled"
                            style={{ width: `${(summary.cancelled / summary.total) * 100}%` }}
                            title={`Cancelled: ${summary.cancelled}`}
                          ></div>
                        </div>

                        <div className="stats-list-v3">
                          <div className="stat-item-v3">
                            <span className="stat-indicator dot-done"></span>
                            <span className="stat-label">Done</span>
                            <span className="stat-value">{summary.done}</span>
                          </div>
                          <div className="stat-item-v3">
                            <span className="stat-indicator dot-pending"></span>
                            <span className="stat-label">Pending</span>
                            <span className="stat-value">{summary.pending}</span>
                          </div>
                          <div className="stat-item-v3">
                            <span className="stat-indicator dot-total"></span>
                            <span className="stat-label">Total Tasks</span>
                            <span className="stat-value">{summary.total}</span>
                          </div>
                        </div>

                        <div className="completion-v3">
                          <span className="completion-pct">
                            {Math.round((summary.done / summary.total) * 100)}%
                          </span>
                          <span className="completion-label">Site Progress</span>
                        </div>
                      </>
                    ) : (
                      <div className="empty-progress-v3">
                        <p>No task data available for visuals.</p>
                      </div>
                    )}
                  </div>
                </div>
              </aside>

              <main className="detail-main">
                <section className="task-creation-panel">
                  <div className="panel-header-pro">
                    <h3 className="panel-title-pro">Add New Task for {selectedSite.name}</h3>
                    <p className="panel-subtitle-pro">Define work requirements, priority levels, and scheduled days.</p>
                  </div>

                  <div className="task-form-grid">
                    <div className="form-item-pro title-span">
                      <label className="input-label-pro">Task Description</label>
                      <input
                        className="task-input-pro-v2"
                        placeholder="e.g. Pour concrete for slab"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && newTaskTitle.trim() && addTask()}
                      />
                    </div>
                    <div className="form-item-pro">
                      <label className="input-label-pro">Scheduled Day</label>
                      <select
                        className="task-select-pro-v2"
                        value={newTaskDayName}
                        onChange={(e) => setNewTaskDayName(e.target.value)}
                      >
                        <option value="">Any Day</option>
                        {["सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-item-pro">
                      <label className="input-label-pro">Completion Date</label>
                      <input
                        type="date"
                        className="task-input-pro-v2"
                        value={expectedCompletionDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setExpectedCompletionDate(e.target.value)}
                      />
                    </div>

                    <div className="form-item-pro">
                      <label className="input-label-pro">Priority</label>
                      <div className="priority-segmented-control">
                        <button
                          type="button"
                          className={`segment-btn ${newTaskPriority === 'NORMAL' ? 'active' : ''}`}
                          onClick={() => setNewTaskPriority('NORMAL')}
                        >Normal</button>
                        <button
                          type="button"
                          className={`segment-btn high ${newTaskPriority === 'HIGH' ? 'active' : ''}`}
                          onClick={() => setNewTaskPriority('HIGH')}
                        >⚡ High</button>
                      </div>
                    </div>
                    <div className="form-item-pro action-span">
                      <label className="input-label-pro">&nbsp;</label>
                      <Button
                        className="btn-add-task-pro"
                        loading={addingTask}
                        onClick={addTask}
                        disabled={!newTaskTitle.trim()}
                      >
                        <span>+ Add Task</span>
                      </Button>
                    </div>
                  </div>
                </section>

                <div className="task-manager-card">
                  <div className="task-controls-sticky">
                    <div className="controls-top-row">
                      <div className="view-indicator">
                        <span className="indicator-dot"></span>
                        <span className="indicator-text">
                          Showing: <strong>{taskFilter === 'ALL' ? 'All Tasks' : taskFilter}</strong>
                          <span className="text-divider">/</span>
                          <strong>{weekFilter === 'CURRENT_WEEK' ? 'Current Week' : weekFilter === 'ALL_WEEKS' ? 'Full History' : selectedWeekKey}</strong>
                        </span>
                      </div>
                      <div className="filter-block">
                        <select className="form-select-inline-v2" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}>
                          <option value="ALL_WEEKS">📅 All Weeks History</option>
                          <option value="CURRENT_WEEK">📍 Current Week Only</option>
                          <option value="WEEK_KEY">🔍 Specific Week...</option>
                        </select>
                      </div>
                    </div>

                    <div className="tab-group-v2">
                      {statusFilters.map(({ value, label }) => (
                        <button
                          key={value}
                          className={`tab-btn-v2 ${taskFilter === value ? "active" : ""}`}
                          onClick={() => setTaskFilter(value)}
                        >
                          {label}
                          <span className="tab-count">
                            {value === "ALL" ? summary.total : value === "PENDING" ? summary.pending : value === "DONE" ? summary.done : summary.cancelled}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="task-list-v2">
                    {tasksLoading ? (
                      <SkeletonBox />
                    ) : visibleTasks.length === 0 ? (
                      <div className="empty-state-v2">
                        <div className="empty-icon">{taskFilter === 'DONE' ? '📋' : '🎉'}</div>
                        <p className="empty-title">No {taskFilter.toLowerCase()} tasks found</p>
                        <p className="empty-sub">Try changing your filters or week selection</p>
                      </div>
                    ) : (
                      sortedVisibleTasks.map((task) => {
                        const badges = getBadges(task);
                        const overdue = isOverdueByDate(task);
                        const isDone = task.status === "DONE";

                        return (
                          <div key={task.id} className={`task-card-v2 ${overdue ? "is-overdue" : ""} ${isDone ? "is-completed" : ""}`}>
                            <div className={`task-priority-indicator ${task.priority === 'HIGH' ? 'high-priority' : 'normal-priority'}`}></div>

                            <div className="task-content-main">
                              <div className="task-primary-row">
                                <h5 className="task-title-v2">{task.title}</h5>
                                <div className="badge-container">
                                  {badges.map((b, i) => (
                                    <span key={i} className={`ui-badge ${b.type.toLowerCase()}`}>{b.text}</span>
                                  ))}
                                </div>
                              </div>

                              <div className="task-info-grid">
                                <div className="info-column">
                                  <span className="info-label">DUE DATE</span>
                                  <span className={`info-value-date ${overdue ? "date-overdue" : ""}`}>
                                    {formatDueDate(task.expectedCompletionDate)}
                                  </span>
                                </div>
                                <div className="info-column">
                                  <span className="info-label">WEEK</span>
                                  <span className="info-value-bold">{formatMarathiWeekFromDate(task.expectedCompletionDate)}</span>
                                </div>
                                {task.dayName && (
                                  <div className="info-column">
                                    <span className="info-label">SCHEDULED</span>
                                    <span className="info-value-bold">{task.dayName}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="task-actions-refined">
                              {task.status !== "DONE" && (
                                <button className="btn-pro-action btn-done" onClick={() => updateTaskStatus(task.id, "DONE")}>
                                  <span className="btn-icon">✓</span> Mark Done
                                </button>
                              )}
                              <button className="btn-pro-action btn-delete" onClick={() => deleteTask(task.id)}>
                                <span className="btn-icon">✕</span> Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </main>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Admin;

