// src/pages/Engineer.jsx
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
import { carryForwardToNextWeek } from "../services/carryForward";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

import "./Admin.css"; 
import "./Engineer.css"; 

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
  const [loggingOut, setLoggingOut] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [nextWeekLoading, setNextWeekLoading] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDayName, setNewTaskDayName] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");
  const [expectedCompletionDate, setExpectedCompletionDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // 🔥 NEW: Auto-transition logic if task is pending for > 7 days
  useEffect(() => {
    const checkAutoCarryForward = async () => {
      if (!selectedSite || tasks.length === 0 || nextWeekLoading) return;
      
      const hasVeryOldTask = tasks.some(task => {
        if (task.status !== "PENDING" || !task.statusUpdatedAt) return false;
        const diffDays = (Date.now() - task.statusUpdatedAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 7;
      });

      if (hasVeryOldTask) {
        console.log("Auto-carrying forward due to 7-day pending rule");
        onNextWeek(true); // Passing true to skip the manual window.confirm
      }
    };

    checkAutoCarryForward();
  }, [tasks, selectedSite]);

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

  useEffect(() => {
    loadEngineerSites();
  }, [engineerUid]);

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
      return showError(null, "Description and Completion Date are required");
    }
    try {
      setAddingTask(true);
      const ref = collection(db, "tasks");
      await addDoc(ref, {
        siteId: selectedSite.id,
        assignedEngineerId: engineerUid,
        title: newTaskTitle.trim(),
        status: "PENDING",
        priority: newTaskPriority,
        dayName: newTaskDayName || null,
        expectedCompletionDate: Timestamp.fromDate(new Date(expectedCompletionDate)),
        createdBy: "ENGINEER",
        weekKey: selectedSite.currentWeekKey,
        statusUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showSuccess("Task added ✅");
      setNewTaskTitle("");
      setNewTaskDayName("");
      setExpectedCompletionDate("");
      await loadTasksBySite(selectedSite);
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
      showSuccess(`Task updated: ${status} ✅`);
      await loadTasksBySite(selectedSite);
    } catch (e) {
      showError(e, "Failed to update task");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const onNextWeek = async (isAuto = false) => {
    const pendingCount = tasks.filter((t) => t.status === "PENDING").length;
    if (pendingCount === 0) return !isAuto && showError(null, "No pending tasks");
    
    if (!isAuto && !window.confirm(`Start next week? Tasks to carry: ${pendingCount}`)) return;
    
    try {
      setNextWeekLoading(true);
      const res = await carryForwardToNextWeek(selectedSite.id);
      showSuccess(isAuto ? "Auto-transition: Next week started" : "Next week started");
      const updatedSite = { ...selectedSite, currentWeekKey: res.to };
      setSelectedSite(updatedSite);
      await loadTasksBySite(updatedSite);
    } catch (e) {
      showError(e, "Failed to start next week");
    } finally {
      setNextWeekLoading(false);
    }
  };

  const formatDueDate = (ts) => {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  };

  // 🔥 NEW: Helper to show how long a task has been pending
  const getPendingSinceDays = (task) => {
    if (task.status !== "PENDING" || !task.statusUpdatedAt) return null;
    const diff = Date.now() - task.statusUpdatedAt.toDate().getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const summary = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === "PENDING").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
    return { total, pending, done, cancelled };
  }, [tasks]);

  const visibleTasks = tasks.filter((t) => (taskFilter === "ALL" ? true : t.status === taskFilter));

  return (
    <Layout>
      <div className="admin-dashboard">
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">RP Construction Tracker</h1>
            <span className="header-badge">Engineer: {engineerName}</span>
          </div>
          <div className="header-actions">
            <Button className="btn-danger-header" loading={loggingOut} onClick={handleLogout}>Logout</Button>
          </div>
        </header>

        {!selectedSite && (
          <section className="sites-section">
            <div className="sites-section-header">
               <div className="highlight-pill"><h2 className="section-heading">Assigned Projects</h2></div>
            </div>
            {sitesLoading ? <SkeletonBox /> : (
              <div className="sites-grid">
                {sites.map((site) => (
                  <div key={site.id} className="site-card-compact" onClick={() => { setSelectedSite(site); loadTasksBySite(site); }}>
                    <div className="card-top"><h3 className="site-name-bold">{site.name}</h3></div>
                    <div className="card-footer"><div className="meta-item">Week: <strong>{site.currentWeekKey}</strong></div></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedSite && (
          <div className="detail-view">
            <div className="sticky-back-header-v5">
              <button className="btn-back-pro" onClick={() => setSelectedSite(null)}>
                <span className="back-icon">←</span>
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
                <p><strong>Site Health:</strong> Pending: <b>{summary.pending}</b> | Done: <b>{summary.done}</b> | Week: <b>{selectedSite.currentWeekKey}</b></p>
              </div>
              <div className="alert-btns">
                 <button className="btn-muted-action" onClick={() => loadTasksBySite(selectedSite)}>Refresh</button>
              </div>
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
                        </div>
                        <div className="stats-list-v3">
                          <div className="stat-item-v3"><span className="stat-label">Done</span><span className="stat-value">{summary.done}</span></div>
                          <div className="stat-item-v3"><span className="stat-label">Pending</span><span className="stat-value">{summary.pending}</span></div>
                        </div>
                        <div className="completion-v3">
                          <span className="completion-pct">{Math.round((summary.done / summary.total) * 100)}%</span>
                          <span className="completion-label">Progress</span>
                        </div>
                      </>
                    ) : <EmptyState title="No tasks" />}
                  </div>
                </div>
                
                <Button 
                  className="btn-add-task-pro"
                  style={{ width: '100%', marginTop: '10px' }} 
                  loading={nextWeekLoading} 
                  disabled={summary.pending === 0} 
                  onClick={() => onNextWeek(false)}
                >
                  🚀 Start Next Week
                </Button>
              </aside>

              <main className="detail-main">
                <section className="task-creation-panel">
                  <div className="panel-header-pro">
                    <h3 className="panel-title-pro">Create Site Task</h3>
                  </div>
                  <div className="task-form-grid">
                    <div className="form-item-pro title-span">
                      <label className="input-label-pro">Description</label>
                      <input className="task-input-pro-v2" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g. Slab Reinforcement" />
                    </div>
                    <div className="form-item-pro">
                      <label className="input-label-pro">Day</label>
                      <select className="task-select-pro-v2" value={newTaskDayName} onChange={(e) => setNewTaskDayName(e.target.value)}>
                        <option value="">Any Day</option>
                        {["सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="form-item-pro">
                      <label className="input-label-pro">Due Date</label>
                      <input type="date" className="task-input-pro-v2" value={expectedCompletionDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setExpectedCompletionDate(e.target.value)} />
                    </div>
                    <div className="form-item-pro">
                      <label className="input-label-pro">Priority</label>
                      <div className="priority-segmented-control">
                        <button type="button" className={`segment-btn ${newTaskPriority === 'NORMAL' ? 'active' : ''}`} onClick={() => setNewTaskPriority('NORMAL')}>Normal</button>
                        <button type="button" className={`segment-btn high ${newTaskPriority === 'HIGH' ? 'active' : ''}`} onClick={() => setNewTaskPriority('HIGH')}>⚡ High</button>
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
                      {['ALL', 'PENDING', 'DONE', 'CANCELLED'].map(val => (
                        <button key={val} className={`tab-btn-v2 ${taskFilter === val ? "active" : ""}`} onClick={() => setTaskFilter(val)}>
                          {val} <span className="tab-count">
                            {val === 'ALL' ? summary.total : val === 'PENDING' ? summary.pending : val === 'DONE' ? summary.done : summary.cancelled}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="task-list-v2">
                    {tasksLoading ? <SkeletonBox /> : visibleTasks.map((task) => {
                        const pendingDays = getPendingSinceDays(task);
                        return (
                          <div key={task.id} className={`task-card-v2 ${task.status === "DONE" ? "is-completed" : ""}`}>
                            <div className={`task-priority-indicator ${task.priority === 'HIGH' ? 'high-priority' : 'normal-priority'}`}></div>
                            <div className="task-content-main">
                              <div className="task-primary-row">
                                <h5 className="task-title-v2">{task.title}</h5>
                                {/* 🔥 NEW: Pending Since Tag */}
                                {pendingDays !== null && pendingDays > 0 && (
                                    <span className="ui-badge overdue" style={{marginLeft: '10px'}}>
                                        ⏳ Pending {pendingDays}d
                                    </span>
                                )}
                              </div>
                              <div className="task-info-grid">
                                <div className="info-column"><span className="info-label">DUE DATE</span><span className="info-value-date">{formatDueDate(task.expectedCompletionDate)}</span></div>
                                <div className="info-column"><span className="info-label">WEEK</span><span className="info-value-bold">{task.weekKey}</span></div>
                                <div className="info-column"><span className="info-label">DAY</span><span className="info-value-bold">{task.dayName || 'Any'}</span></div>
                              </div>
                            </div>
                            <div className="task-actions-refined">
                              {task.status !== "DONE" && (
                                <button className="btn-pro-action btn-done" onClick={() => updateTaskStatus(task.id, "DONE")}>✓ Done</button>
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
        )}
      </div>
    </Layout>
  );
}

export default Engineer;