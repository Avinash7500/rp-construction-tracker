// src/pages/Admin.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import PageTitle from "../components/PageTitle";
import { logout } from "../utils/logout";
import Button from "../components/Button";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";

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

  const getTaskCardStyle = (task) => {
    const pendingDays = getPendingDays(task);
    const isOverdue = task.status === "PENDING" && pendingDays !== null && pendingDays >= 3;

    return {
      border: isOverdue ? "2px solid #000" : "1px solid #ddd",
      padding: 10,
      marginBottom: 8,
      borderRadius: 6,
      background: isOverdue ? "#fff6f6" : "#fff",
    };
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

  return (
    <Layout>
      <PageTitle title="Admin Dashboard" role="Admin" showBack />

      {/* ✅ TOP ACTIONS */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!selectedSite ? (
            <Button onClick={() => setShowCreateSite(true)}>+ Create Site</Button>
          ) : (
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

          <Button onClick={() => navigate("/admin/reports")}>📊 Reports</Button>
        </div>

        <Button loading={loggingOut} onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {/* ✅ Phase 7.1 Admin Alerts Banner (only on sites list) */}
      {!selectedSite && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: adminAlertCounts.overdue > 0 ? "2px solid #000" : "1px solid #ddd",
            background: adminAlertCounts.overdue > 0 ? "#fff6f6" : "#fff",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12 }}>
            <b>🔔 System Alerts:</b>{" "}
            {adminStatsLoading ? (
              <>Loading...</>
            ) : adminAlertCounts.overdue > 0 ? (
              <>
                🔥 Overdue: <b>{adminAlertCounts.overdue}</b> • ⏳ Pending:{" "}
                <b>{adminAlertCounts.pending}</b>
              </>
            ) : (
              <>
                ✅ No overdue tasks • Pending: <b>{adminAlertCounts.pending}</b>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              onClick={() => {
                navigate("/admin/reports");
                showSuccess("Opening Reports → check Overdue Ranking ✅");
              }}
            >
              Open Reports →
            </Button>

            <Button
              onClick={async () => {
                await loadAllTasksForAdminStats();
                showSuccess("Alerts refreshed ✅");
              }}
            >
              🔄 Refresh
            </Button>
          </div>
        </div>
      )}

      {/* ✅ CREATE SITE MODAL */}
      {!selectedSite && showCreateSite && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginTop: 12,
            borderRadius: 8,
            background: "#fff",
          }}
        >
          <h4 style={{ marginTop: 0 }}>Create New Site</h4>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              style={{ flex: 1, minWidth: 180 }}
              placeholder="Site name (e.g. Wakad Site)"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
            />

            <select
              style={{ flex: 1, minWidth: 180 }}
              value={selectedEngineerUid}
              onChange={(e) => setSelectedEngineerUid(e.target.value)}
              disabled={engineersLoading}
            >
              <option value="">{engineersLoading ? "Loading engineers..." : "Select Engineer"}</option>

              {engineers.map((eng) => (
                <option key={eng.uid} value={eng.uid}>
                  {eng.name || eng.email || eng.uid}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <Button loading={creatingSite} onClick={handleCreateSite}>
              Create
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
      )}

      {/* ✅ ACTIVE SITES */}
      {!selectedSite && (pageLoading || sitesLoading) && (
        <>
          <SkeletonBox />
          <SkeletonBox />
          <SkeletonBox />
        </>
      )}

      {!selectedSite && !pageLoading && !sitesLoading && sites.length === 0 && (
        <EmptyState title="No active sites" subtitle="Create or assign a site to get started" />
      )}

      {!selectedSite && !pageLoading && !sitesLoading && sites.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4>Active Sites</h4>

          {sites.map((site) => (
            <div
              key={site.id}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                marginBottom: 10,
                cursor: "pointer",
              }}
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
              <strong>{site.name || "Unnamed Site"}</strong>

              <div style={{ fontSize: 12 }}>
                Engineer: <b>{site.assignedEngineerName || "-"}</b>
              </div>

              <div style={{ fontSize: 12, marginTop: 4 }}>
                Current Week: <b>{site.currentWeekKey || "-"}</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ TASKS */}
      {selectedSite && !showCompleteFlow && (
        <div style={{ marginTop: 12 }}>
          <h4>{selectedSite.name}</h4>

          <div style={{ fontSize: 12, marginBottom: 10 }}>
            Current Week: <b>{selectedSite.currentWeekKey || "-"}</b>
          </div>

          {/* ✅ Reassign Engineer Panel */}
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              Assigned Engineer: <b>{selectedSite.assignedEngineerName || "-"}</b>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                value={reassignEngineerUid}
                onChange={(e) => setReassignEngineerUid(e.target.value)}
                disabled={engineersLoading || reassigning}
                style={{ minWidth: 200 }}
              >
                <option value="">Change Engineer...</option>
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

            <div style={{ fontSize: 12, marginTop: 6 }}>
              ✅ Only <b>Current Week</b> tasks will be moved to new engineer.
            </div>
          </div>

          {/* ✅ Summary */}
          <div
            style={{
              fontSize: 12,
              marginBottom: 12,
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <b>Summary:</b> Total: <b>{summary.total}</b> | Pending: <b>{summary.pending}</b> | Done:{" "}
            <b>{summary.done}</b> | Cancelled: <b>{summary.cancelled}</b>
          </div>

          {/* ✅ Week Filter */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
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

          {/* ✅ Status Filter */}
          <div style={{ marginBottom: 12 }}>
            <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* ✅ Add Task */}
          <div style={{ marginBottom: 12 }}>
            <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title" />

            <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
            </select>

            <Button loading={addingTask} onClick={addTask}>
              Add Task
            </Button>
          </div>

          {tasksLoading && (
            <>
              <SkeletonBox />
              <SkeletonBox />
            </>
          )}

          {!tasksLoading && visibleTasks.length === 0 && (
            <EmptyState title="No tasks found" subtitle="No tasks match this filter" />
          )}

          {!tasksLoading &&
            visibleTasks.map((task) => {
              const badges = getBadges(task);
              const pendingDays = (() => {
                try {
                  return getPendingDays(task);
                } catch {
                  return null;
                }
              })();

              return (
                <div key={task.id} style={getTaskCardStyle(task)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <strong>{task.title}</strong>

                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Status: <b>{task.status}</b> | Priority: <b>{task.priority}</b>
                      </div>

                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Week: <b>{task.weekKey || "-"}</b>
                      </div>

                      {pendingDays !== null && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Pending since: <b>{pendingDays} day(s)</b>
                        </div>
                      )}

                      {badges.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {badges.map((b, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: 12,
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: "1px solid #ddd",
                                background: "#f9f9f9",
                              }}
                            >
                              {b.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {task.status !== "DONE" && (
                        <Button loading={updatingTaskId === task.id} onClick={() => updateTaskStatus(task.id, "DONE")}>
                          Mark DONE
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
                </div>
              );
            })}
        </div>
      )}

      {/* ✅ COMPLETE FLOW */}
      {selectedSite && showCompleteFlow && (
        <div style={{ border: "1px solid red", padding: 12, marginTop: 12 }}>
          <textarea placeholder="Appreciation" value={appreciation} onChange={(e) => setAppreciation(e.target.value)} />

          <label>
            <input type="checkbox" checked={confirmComplete} onChange={(e) => setConfirmComplete(e.target.checked)} /> I
            confirm
          </label>

          <Button loading={completingSite} disabled={!confirmComplete} onClick={() => {}}>
            Complete Site
          </Button>
        </div>
      )}
    </Layout>
  );
}

export default Admin;
