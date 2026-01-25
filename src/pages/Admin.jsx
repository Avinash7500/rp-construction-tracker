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

// Construction theme (RP Construction Tracker) – scoped to .admin
const ADMIN_THEME_STYLES = `
  .admin { --rp-concrete: #e8e4df; --rp-sand: #d4cfc8; --rp-beige: #f5f1eb; --rp-yellow: #e6b800; --rp-yellow-soft: #fef9e6; --rp-grey: #4a4a4a; --rp-grey-light: #6b6b6b; --rp-card: #fff; --rp-shadow: 0 2px 12px rgba(0,0,0,0.08); --rp-radius: 10px; --rp-radius-sm: 8px; }
  .admin { background: linear-gradient(165deg, #ebe8e3 0%, #dfdbd4 50%, #d8d3cc 100%); min-height: 100%; color: var(--rp-grey); }
  .admin .rp-header { background: var(--rp-card); border-radius: var(--rp-radius); padding: 1rem 1.25rem; margin-bottom: 1.25rem; box-shadow: var(--rp-shadow); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .admin .rp-header__left { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .admin .rp-header__title { font-size: 1.125rem; font-weight: 600; margin: 0; color: var(--rp-grey); }
  .admin .rp-header__role { font-size: 0.75rem; color: var(--rp-grey-light); background: var(--rp-beige); padding: 2px 8px; border-radius: 999px; font-weight: 500; }
  .admin .rp-header__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .admin .rp-cta { background: var(--rp-yellow) !important; color: #1a1a1a !important; border: none !important; font-weight: 600 !important; }
  .admin .rp-cta:hover { filter: brightness(1.05); }
  .admin .admin-card, .admin .admin__alerts, .admin .admin-site-card, .admin .admin-task-card { background: var(--rp-card); box-shadow: var(--rp-shadow); border: 1px solid rgba(0,0,0,0.06); border-radius: var(--rp-radius); }
  .admin .admin-site-card { padding: 1.25rem; min-height: 88px; }
  .admin .admin-site-card:hover, .admin .admin-site-card:focus-visible { border-color: var(--rp-yellow); box-shadow: 0 4px 16px rgba(230,184,0,0.15); outline: none; }
  .admin .rp-site-status { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 999px; }
  .admin .rp-site-status--active { background: #dcfce7; color: #166534; }
  .admin .rp-site-status--completed { background: #e5e7eb; color: #4b5563; }
  .admin .rp-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .admin .rp-modal { background: var(--rp-card); border-radius: var(--rp-radius); box-shadow: 0 20px 40px rgba(0,0,0,0.15); max-width: 420px; width: 100%; padding: 1.5rem; }
  .admin .rp-modal__title { margin: 0 0 1rem; font-size: 1.1rem; font-weight: 600; color: var(--rp-grey); }
  .admin .rp-modal .admin-create__input, .admin .rp-modal .admin-create__select { width: 100%; min-width: 0; padding: 0.75rem 1rem; border-radius: var(--rp-radius-sm); border: 1px solid var(--rp-sand); font-size: 1rem; box-sizing: border-box; }
  .admin .rp-summary-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
  .admin .rp-chip { font-size: 0.8125rem; padding: 0.4rem 0.75rem; border-radius: 999px; background: var(--rp-beige); color: var(--rp-grey); font-weight: 500; border: 1px solid rgba(0,0,0,0.06); }
  .admin .rp-chip--highlight { background: var(--rp-yellow-soft); color: #7c5a00; border-color: rgba(230,184,0,0.4); }
  .admin .rp-tabs { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 1rem; padding: 3px; background: var(--rp-beige); border-radius: var(--rp-radius-sm); }
  .admin .rp-tabs button { padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 500; border: none; background: transparent; color: var(--rp-grey-light); border-radius: 6px; cursor: pointer; transition: background 0.15s, color 0.15s; }
  .admin .rp-tabs button:hover { color: var(--rp-grey); }
  .admin .rp-tabs button.rp-tabs--active { background: var(--rp-card); color: var(--rp-grey); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .admin .admin-add-task__input, .admin .admin-reassign__select, .admin .admin-filters__select { width: 100%; min-width: 0; padding: 0.65rem 1rem; border-radius: var(--rp-radius-sm); border: 1px solid var(--rp-sand); font-size: 0.9375rem; box-sizing: border-box; }
  .admin .rp-modal .admin-create__row { display: flex; flex-direction: column; gap: 0.75rem; }
  .admin .rp-modal .admin-create__row .admin-create__input, .admin .rp-modal .admin-create__row .admin-create__select { width: 100%; }
  @media (min-width: 480px) { .admin .admin-add-task__input { min-width: 200px; } .admin .admin-reassign__select { min-width: 180px; } }
  .admin .admin-task-card__actions { align-items: center; }
`;

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
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

import { getISOWeekKey } from "../utils/weekUtils";

function Admin() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);

  // ✅ Sites
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  // ✅ Engineers list (for dropdown)
  const [engineers, setEngineers] = useState([]);
  const [engineersLoading, setEngineersLoading] = useState(true);

  // ✅ Create Site Modal
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [selectedEngineerUid, setSelectedEngineerUid] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);

  const [selectedSite, setSelectedSite] = useState(null);

  // ✅ Tasks (selected site)
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // ✅ Phase 7.1: All tasks for admin dashboard notification counts
  const [allTasks, setAllTasks] = useState([]);
  const [adminStatsLoading, setAdminStatsLoading] = useState(true);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");

  const [showCompleteFlow, setShowCompleteFlow] = useState(false);
  const [appreciation, setAppreciation] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);

  const [taskFilter, setTaskFilter] = useState("ALL");

  const [loggingOut, setLoggingOut] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [completingSite, setCompletingSite] = useState(false);

  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  // ✅ Phase 4.3: Week Filter + History
  const [weekFilter, setWeekFilter] = useState("ALL_WEEKS");
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState("");

  // ✅ Phase 4.5: Reassign engineer UI
  const [reassignEngineerUid, setReassignEngineerUid] = useState("");
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // ✅ Load Sites
  const loadSites = async () => {
    try {
      setSitesLoading(true);

      const ref = collection(db, "sites");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const sitesData = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setSites(sitesData);
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load sites");
    } finally {
      setSitesLoading(false);
    }
  };

  // ✅ Load Engineers
  const loadEngineers = async () => {
    try {
      setEngineersLoading(true);

      const ref = collection(db, "users");
      const q = query(ref, where("role", "==", "ENGINEER"));

      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({
        uid: d.id,
        ...d.data(),
      }));

      setEngineers(list);
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load engineers");
    } finally {
      setEngineersLoading(false);
    }
  };

  // ✅ Load Tasks of site (All weeks)
  const loadTasksBySite = async (siteId) => {
    try {
      setTasksLoading(true);
      setTasks([]);

      const ref = collection(db, "tasks");
      const q = query(ref, where("siteId", "==", siteId), orderBy("createdAt", "desc"));

      const snap = await getDocs(q);

      const tasksData = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setTasks(tasksData);

      const weeks = Array.from(new Set(tasksData.map((t) => t.weekKey).filter(Boolean))).sort();
      setAvailableWeeks(weeks);
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  };

  // ✅ Phase 7.1: Load all tasks for dashboard stats
  const loadAllTasksForAdminStats = async () => {
    try {
      setAdminStatsLoading(true);

      const ref = collection(db, "tasks");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setAllTasks(data);
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load admin stats");
    } finally {
      setAdminStatsLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
    loadEngineers();
    loadAllTasksForAdminStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ✅ Create Site
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
      console.error(e);
      showError(e, "Failed to create site");
    } finally {
      setCreatingSite(false);
    }
  };

  // ✅ Add Task
  const addTask = async () => {
    if (!selectedSite?.id) return;
    if (!newTaskTitle.trim()) return;

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

        weekKey: selectedSite.currentWeekKey || getISOWeekKey(),

        statusUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showSuccess("Task added ✅");

      setNewTaskTitle("");
      setNewTaskPriority("NORMAL");

      await loadTasksBySite(selectedSite.id);
      await loadAllTasksForAdminStats();
    } catch (e) {
      console.error(e);
      showError(e, "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  // ✅ Update Task Status
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
      console.error(e);
      showError(e, "Failed to update task status");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // ✅ Delete Task
  const deleteTask = async (taskId) => {
    if (!selectedSite?.id) return;

    const ok = window.confirm("Delete this task permanently?");
    if (!ok) return;

    try {
      setDeletingTaskId(taskId);

      const taskRef = doc(db, "tasks", taskId);
      await deleteDoc(taskRef);

      showSuccess("Task deleted ✅");
      await loadTasksBySite(selectedSite.id);
      await loadAllTasksForAdminStats();
    } catch (e) {
      console.error(e);
      showError(e, "Failed to delete task");
    } finally {
      setDeletingTaskId(null);
    }
  };

  // ✅ Phase 4.4 helpers
  const getPendingDays = (task) => {
    try {
      if (!task?.statusUpdatedAt) return null;
      if (task.status !== "PENDING") return null;

      const d = task.statusUpdatedAt?.toDate?.();
      if (!d) return null;

      const diffMs = Date.now() - d.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  // ✅ Phase 7.1 Admin alert counts (overall system)
  const adminAlertCounts = useMemo(() => {
    const pending = allTasks.filter((t) => t.status === "PENDING").length;

    const overdue = allTasks.filter((t) => {
      if (t.status !== "PENDING") return false;
      const pd = getPendingDays(t);
      return pd !== null && pd >= 3;
    }).length;

    return { pending, overdue };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTasks]);

  const getBadges = (task) => {
    const badges = [];

    const pendingDays = getPendingDays(task);

    if (task.status === "PENDING" && pendingDays !== null && pendingDays >= 3) {
      badges.push({ type: "OVERDUE", text: `🔥 Overdue ${pendingDays}d` });
    }

    const pw = task?.pendingWeeks || 0;
    if (pw >= 1) {
      badges.push({
        type: "CARRY",
        text: `↪ Carried ${pw} week${pw > 1 ? "s" : ""}`,
      });
    }

    if (task.priority === "HIGH") {
      badges.push({ type: "HIGH", text: "⚡ High Priority" });
    }

    return badges;
  };

  const isTaskOverdue = (task) => {
    const pendingDays = getPendingDays(task);
    return task.status === "PENDING" && pendingDays !== null && pendingDays >= 3;
  };

  // ✅ Week Filter
  const filteredByWeek = tasks.filter((t) => {
    if (!selectedSite) return true;

    if (weekFilter === "ALL_WEEKS") return true;

    if (weekFilter === "CURRENT_WEEK") {
      return t.weekKey === selectedSite.currentWeekKey;
    }

    if (weekFilter === "WEEK_KEY") {
      return selectedWeekKey ? t.weekKey === selectedWeekKey : true;
    }

    return true;
  });

  // ✅ Summary counts (week based)
  const summary = useMemo(() => {
    const total = filteredByWeek.length;
    const pending = filteredByWeek.filter((t) => t.status === "PENDING").length;
    const done = filteredByWeek.filter((t) => t.status === "DONE").length;
    const cancelled = filteredByWeek.filter((t) => t.status === "CANCELLED").length;

    return { total, pending, done, cancelled };
  }, [filteredByWeek]);

  // ✅ Status Filter after summary
  const visibleTasks = filteredByWeek.filter((t) => (taskFilter === "ALL" ? true : t.status === taskFilter));

  // ✅ Phase 4.5: Reassign engineer
  const reassignEngineer = async () => {
    if (!selectedSite?.id) return;
    if (!reassignEngineerUid) return showError(null, "Select engineer first");

    if (reassignEngineerUid === selectedSite.assignedEngineerId) {
      return showError(null, "Same engineer already assigned");
    }

    const newEngineer = engineers.find((e) => e.uid === reassignEngineerUid);
    if (!newEngineer) return showError(null, "Engineer not found");

    const ok = window.confirm(
      `Reassign this site?\n\nSite: ${selectedSite.name}\nFrom: ${selectedSite.assignedEngineerName}\nTo: ${
        newEngineer.name || newEngineer.email || newEngineer.uid
      }\n\n✅ Current week tasks will move to new engineer.\n❌ Old history weeks remain unchanged.`
    );
    if (!ok) return;

    try {
      setReassigning(true);

      const batch = writeBatch(db);

      // ✅ Update site
      const siteRef = doc(db, "sites", selectedSite.id);
      batch.update(siteRef, {
        assignedEngineerId: newEngineer.uid,
        assignedEngineerName: newEngineer.name || "",
        updatedAt: serverTimestamp(),
      });

      // ✅ Update only current week tasks
      const tasksRef = collection(db, "tasks");
      const currentWeekKey = selectedSite.currentWeekKey;

      if (!currentWeekKey) {
        throw new Error("Site currentWeekKey missing");
      }

      const q = query(tasksRef, where("siteId", "==", selectedSite.id), where("weekKey", "==", currentWeekKey));
      const snap = await getDocs(q);

      snap.docs.forEach((d) => {
        batch.update(doc(db, "tasks", d.id), {
          assignedEngineerId: newEngineer.uid,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      showSuccess("Engineer reassigned ✅");

      const updatedSite = {
        ...selectedSite,
        assignedEngineerId: newEngineer.uid,
        assignedEngineerName: newEngineer.name || "",
      };
      setSelectedSite(updatedSite);

      setReassignEngineerUid("");

      await loadSites();
      await loadTasksBySite(selectedSite.id);
      await loadAllTasksForAdminStats();
    } catch (e) {
      console.error(e);
      showError(e, "Failed to reassign engineer");
    } finally {
      setReassigning(false);
    }
  };

  const statusFilters = [
    { value: "ALL", label: "All" },
    { value: "PENDING", label: "Pending" },
    { value: "DONE", label: "Done" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <Layout>
      <style>{ADMIN_THEME_STYLES}</style>
      <div className="admin">
        <header className="rp-header">
          <div className="rp-header__left">
            <h1 className="rp-header__title">RP Construction Tracker</h1>
            <span className="rp-header__role">{role === "admin" ? "Admin" : role || "Admin"}</span>
            {selectedSite && (
              <Button
                onClick={() => {
                  setSelectedSite(null);
                  setTasks([]);
                  setShowCompleteFlow(false);
                  setTaskFilter("ALL");
                  setWeekFilter("ALL_WEEKS");
                  setSelectedWeekKey("");
                  setAvailableWeeks([]);
                  setReassignEngineerUid("");
                }}
              >
                ← Back to Sites
              </Button>
            )}
          </div>
          <div className="rp-header__actions">
            {!selectedSite && (
              <Button className="rp-cta" onClick={() => setShowCreateSite(true)}>
                + Create Site
              </Button>
            )}
            <Button onClick={() => navigate("/admin/reports")}>Reports</Button>
            <Button loading={loggingOut} onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        {!selectedSite && (
          <div
            className={`admin__alerts ${adminAlertCounts.overdue > 0 ? "admin__alerts--overdue" : ""}`}
          >
            <div className="admin__alerts-text">
              <strong>System alerts</strong>{" "}
              {adminStatsLoading ? (
                "Loading…"
              ) : adminAlertCounts.overdue > 0 ? (
                <>
                  Overdue: <strong>{adminAlertCounts.overdue}</strong> · Pending:{" "}
                  <strong>{adminAlertCounts.pending}</strong>
                </>
              ) : (
                <>
                  No overdue · Pending: <strong>{adminAlertCounts.pending}</strong>
                </>
              )}
            </div>
            <div className="admin__alerts-actions">
              <Button
                onClick={() => {
                  navigate("/admin/reports");
                  showSuccess("Opening Reports → check Overdue Ranking");
                }}
              >
                Open Reports
              </Button>
              <Button
                onClick={async () => {
                  await loadAllTasksForAdminStats();
                  showSuccess("Alerts refreshed");
                }}
              >
                Refresh
              </Button>
            </div>
          </div>
        )}

        {!selectedSite && showCreateSite && (
          <div
            className="rp-modal-backdrop"
            onClick={() => {
              setShowCreateSite(false);
              setNewSiteName("");
              setSelectedEngineerUid("");
            }}
            role="presentation"
          >
            <div
              className="rp-modal admin-create"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-site-title"
            >
              <h4 id="create-site-title" className="rp-modal__title">Create New Site</h4>
              <div className="admin-create__row">
                <input
                  className="admin-create__input"
                  placeholder="Site name (e.g. Wakad Site)"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                />
                <select
                  className="admin-create__select"
                  value={selectedEngineerUid}
                  onChange={(e) => setSelectedEngineerUid(e.target.value)}
                  disabled={engineersLoading}
                >
                  <option value="">{engineersLoading ? "Loading engineers…" : "Select Engineer"}</option>
                  {engineers.map((eng) => (
                    <option key={eng.uid} value={eng.uid}>
                      {eng.name || eng.email || eng.uid}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-create__actions">
                <Button className="rp-cta" loading={creatingSite} onClick={handleCreateSite}>
                  Create Site
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateSite(false);
                    setNewSiteName("");
                    setSelectedEngineerUid("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {!selectedSite && (pageLoading || sitesLoading) && (
          <div className="admin-skeletons">
            <SkeletonBox />
            <SkeletonBox />
            <SkeletonBox />
          </div>
        )}

        {!selectedSite && !pageLoading && !sitesLoading && sites.length === 0 && (
          <EmptyState title="No active sites" subtitle="Create or assign a site to get started" />
        )}

        {!selectedSite && !pageLoading && !sitesLoading && sites.length > 0 && (
          <section>
            <h4 className="admin-sites__title">Sites</h4>
            <div className="admin-sites__grid">
              {sites.map((site) => (
                <button
                  type="button"
                  key={site.id}
                  className="admin-site-card"
                  onClick={async () => {
                    setSelectedSite(site);
                    setShowCompleteFlow(false);
                    setTaskFilter("ALL");
                    setWeekFilter("ALL_WEEKS");
                    setSelectedWeekKey("");
                    setReassignEngineerUid("");
                    await loadTasksBySite(site.id);
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div className="admin-site-card__name">{site.name || "Unnamed Site"}</div>
                    <span className={site.isCompleted ? "rp-site-status rp-site-status--completed" : "rp-site-status rp-site-status--active"}>
                      {site.isCompleted ? "Completed" : "Active"}
                    </span>
                  </div>
                  <div className="admin-site-card__meta">Engineer: <strong>{site.assignedEngineerName || "—"}</strong></div>
                  <div className="admin-site-card__meta">Current week: <strong>{site.currentWeekKey || "—"}</strong></div>
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedSite && !showCompleteFlow && (
          <>
            <section className="admin-card" style={{ marginBottom: "1.25rem" }}>
              <header className="admin-detail__header">
                <h4 className="admin-detail__site-name">{selectedSite.name}</h4>
                <div className="admin-detail__week">Engineer: <strong>{selectedSite.assignedEngineerName || "—"}</strong> · Week: <strong>{selectedSite.currentWeekKey || "—"}</strong></div>
              </header>

              <div className="admin-reassign">
                <div className="admin-reassign__engineer">Reassign engineer</div>
                <div className="admin-reassign__row">
                  <select
                    className="admin-reassign__select"
                    value={reassignEngineerUid}
                    onChange={(e) => setReassignEngineerUid(e.target.value)}
                    disabled={engineersLoading || reassigning}
                  >
                    <option value="">Change engineer…</option>
                    {engineers.map((eng) => (
                      <option key={eng.uid} value={eng.uid}>
                        {eng.name || eng.email || eng.uid}
                      </option>
                    ))}
                  </select>
                  <Button loading={reassigning} onClick={reassignEngineer}>
                    Reassign
                  </Button>
                </div>
                <div className="admin-reassign__note">Only current week tasks move to the new engineer.</div>
              </div>
            </section>

            <div className="rp-summary-chips">
              <span className="rp-chip">Total <strong>{summary.total}</strong></span>
              <span className={`rp-chip ${summary.pending > 0 ? "rp-chip--highlight" : ""}`}>Pending <strong>{summary.pending}</strong></span>
              <span className="rp-chip">Done <strong>{summary.done}</strong></span>
              <span className="rp-chip">Cancelled <strong>{summary.cancelled}</strong></span>
            </div>

            <div className="admin-filters">
              <div className="admin-filters__group">
                <span className="admin-filters__label">Week</span>
                <div className="admin-filters__row">
                  <select
                    className="admin-filters__select"
                    value={weekFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      setWeekFilter(v);
                      if (v !== "WEEK_KEY") setSelectedWeekKey("");
                    }}
                  >
                    <option value="ALL_WEEKS">All weeks</option>
                    <option value="CURRENT_WEEK">Current week</option>
                    <option value="WEEK_KEY">Select week…</option>
                  </select>
                  {weekFilter === "WEEK_KEY" && (
                    <select
                      className="admin-filters__select"
                      value={selectedWeekKey}
                      onChange={(e) => setSelectedWeekKey(e.target.value)}
                    >
                      <option value="">Select week</option>
                      {availableWeeks.map((wk) => (
                        <option key={wk} value={wk}>{wk}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="admin-filters__group">
                <span className="admin-filters__label">Status</span>
                <div className="rp-tabs">
                  {statusFilters.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={taskFilter === value ? "rp-tabs--active" : ""}
                      onClick={() => setTaskFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-add-task">
              <input
                className="admin-add-task__input"
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <select
                className="admin-add-task__select"
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
              <Button loading={addingTask} onClick={addTask}>
                Add Task
              </Button>
            </div>

            {tasksLoading && (
              <div className="admin-skeletons">
                <SkeletonBox />
                <SkeletonBox />
              </div>
            )}

            {!tasksLoading && visibleTasks.length === 0 && (
              <EmptyState title="No tasks found" subtitle="No tasks match this filter" />
            )}

            {!tasksLoading && visibleTasks.length > 0 && (
              <div className="admin-tasks">
                {visibleTasks.map((task) => {
                  const badges = getBadges(task);
                  const pendingDays = (() => {
                    try { return getPendingDays(task); } catch { return null; }
                  })();
                  const overdue = isTaskOverdue(task);

                  return (
                    <article
                      key={task.id}
                      className={`admin-task-card ${overdue ? "admin-task-card--overdue" : ""}`}
                    >
                      <div className="admin-task-card__head">
                        <h5 className="admin-task-card__title">{task.title}</h5>
                        <div className="admin-task-card__actions">
                          {task.status !== "DONE" && (
                            <Button
                              loading={updatingTaskId === task.id}
                              onClick={() => updateTaskStatus(task.id, "DONE")}
                            >
                              Mark done
                            </Button>
                          )}
                          {task.status !== "CANCELLED" && (
                            <Button
                              loading={updatingTaskId === task.id}
                              onClick={() => updateTaskStatus(task.id, "CANCELLED")}
                            >
                              Cancel
                            </Button>
                          )}
                          <Button loading={deletingTaskId === task.id} onClick={() => deleteTask(task.id)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="admin-task-card__meta">
                        <span className={`admin-badge admin-badge--${(task.status || "").toLowerCase()}`}>
                          {task.status}
                        </span>
                        {" · "}
                        Priority: <strong>{task.priority}</strong>
                        {" · "}
                        Week: <strong>{task.weekKey || "—"}</strong>
                      </div>
                      {pendingDays !== null && (
                        <div className="admin-task-card__meta">
                          Pending since: <strong>{pendingDays} day{pendingDays !== 1 ? "s" : ""}</strong>
                        </div>
                      )}
                      {badges.length > 0 && (
                        <div className="admin-badges">
                          {badges.map((b, idx) => (
                            <span
                              key={idx}
                              className={`admin-badge admin-badge--${String(b.type).toLowerCase()}`}
                            >
                              {b.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {selectedSite && showCompleteFlow && (
          <div className="admin-complete">
            <textarea
              placeholder="Appreciation"
              value={appreciation}
              onChange={(e) => setAppreciation(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={confirmComplete}
                onChange={(e) => setConfirmComplete(e.target.checked)}
              />{" "}
              I confirm
            </label>
            <Button loading={completingSite} disabled={!confirmComplete} onClick={() => {}}>
              Complete Site
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Admin;
