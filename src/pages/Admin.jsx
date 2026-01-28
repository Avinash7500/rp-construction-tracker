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
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getISOWeekKey } from "../utils/weekUtils";

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
  const [reassignEngineerUid, setReassignEngineerUid] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // ✅ New Site Search State
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
      const tasksData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
    if (!selectedSite?.id || !newTaskTitle.trim()) return;
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
    } catch { return null; }
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

  const isTaskOverdue = (task) => {
    const pendingDays = getPendingDays(task);
    return task.status === "PENDING" && pendingDays !== null && pendingDays >= 3;
  };

  const filteredSites = useMemo(() => {
    return sites.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase()));
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
        {/* MAIN HEADER */}
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">RP Construction Tracker</h1>
            <span className="header-badge">{role === "admin" ? "Master Admin" : role}</span>
          </div>
          <div className="header-actions">
            {!selectedSite && (
              <Button className="btn-primary-header" onClick={() => setShowCreateSite(true)}>+ Create Site</Button>
            )}
            <Button className="btn-secondary-header" onClick={() => navigate("/admin/reports")}>Analytics</Button>
            <Button className="btn-danger-header" loading={loggingOut} onClick={handleLogout}>Logout</Button>
          </div>
        </header>

        {/* ALERTS SECTION */}
        {!selectedSite && (
          <div className={`system-alerts-bar ${adminAlertCounts.overdue > 0 ? "alert-critical" : ""}`}>
            <div className="alert-content">
              <span className="pulse-dot"></span>
              <p>
                <strong>System Health:</strong> {adminStatsLoading ? "Checking..." : (
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

        {/* MODAL: CREATE SITE */}
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
                    <span className="form-hint-pro">This name will be visible to Admin & assigned Engineer.</span>
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
                      <option value="">{engineersLoading ? "⏳ Fetching Engineers..." : "Select lead engineer for this site"}</option>
                      {engineers.map((eng) => (
                        <option key={eng.uid} value={eng.uid}>
                          👤 {eng.name || eng.email}
                        </option>
                      ))}
                    </select>
                    <span className="form-hint-pro">The engineer will receive notification for this site access.</span>
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
                  🚀 Initialize Site
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* SITES LIST */}
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

        {/* SITE DETAIL VIEW */}
        {selectedSite && !showCompleteFlow && (
          <div className="detail-view">
            <Button className="btn-back" onClick={() => setSelectedSite(null)}>← Back to Sites</Button>
            <div className="detail-grid">
              <aside className="detail-config">
                <div className="config-card">
                  <h3 className="card-subheading">Site Configuration</h3>
                  <div className="config-row">
                    <label>Assigned Engineer</label>
                    <select
                      className="form-select-sm"
                      value={reassignEngineerUid}
                      onChange={(e) => setReassignEngineerUid(e.target.value)}
                      disabled={engineersLoading || reassigning}
                    >
                      <option value="">Transfer Site...</option>
                      {engineers.map((eng) => (
                        <option key={eng.uid} value={eng.uid}>{eng.name || eng.email}</option>
                      ))}
                    </select>
                    <Button className="btn-primary-sm" loading={reassigning} onClick={reassignEngineer}>Reassign</Button>
                  </div>
                </div>
                <div className="config-card">
                  <h3 className="card-subheading">Quick Summary</h3>
                  <div className="stats-chips">
                    <div className="stat-chip"><span>Total</span> <b>{summary.total}</b></div>
                    <div className="stat-chip highlight"><span>Pending</span> <b>{summary.pending}</b></div>
                    <div className="stat-chip"><span>Done</span> <b>{summary.done}</b></div>
                  </div>
                </div>
              </aside>

              <main className="detail-main">
                <div className="task-manager-card">
                  <div className="task-controls">
                    <div className="filter-block">
                      <select className="form-select-inline" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}>
                        <option value="ALL_WEEKS">History: All Weeks</option>
                        <option value="CURRENT_WEEK">Current Week Only</option>
                        <option value="WEEK_KEY">Specific Week...</option>
                      </select>
                    </div>
                    <div className="tab-group">
                      {statusFilters.map(({ value, label }) => (
                        <button key={value} className={`tab-btn ${taskFilter === value ? "active" : ""}`} onClick={() => setTaskFilter(value)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="add-task-bar">
                    <input className="task-input" placeholder="Enter task details..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
                    <Button className="btn-add" loading={addingTask} onClick={addTask}>Add</Button>
                  </div>
                  <div className="task-list">
                    {tasksLoading ? <SkeletonBox /> : visibleTasks.length === 0 ? <EmptyState title="Clear Desk" /> : (
                      visibleTasks.map((task) => {
                        const badges = getBadges(task);
                        const overdue = isTaskOverdue(task);
                        return (
                          <div key={task.id} className={`task-row ${overdue ? "task-overdue" : ""}`}>
                            <div className="task-main-info">
                              <h5 className="task-title">{task.title}</h5>
                              <div className="task-meta">
                                <span className={`status-tag ${task.status.toLowerCase()}`}>{task.status}</span>
                                <span>Week: <b>{task.weekKey}</b></span>
                              </div>
                            </div>
                            <div className="task-row-actions">
                              {task.status !== "DONE" && <button className="action-btn done" onClick={() => updateTaskStatus(task.id, "DONE")}>Done</button>}
                              <button className="action-btn delete" onClick={() => deleteTask(task.id)}>Delete</button>
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