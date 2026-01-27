import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
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
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

import { useAuth } from "../context/AuthContext";
import { carryForwardToNextWeek } from "../services/carryForward";

// 🔥 NEW
import AddEngineerTaskModal from "../components/AddEngineerTaskModal";

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

  const [showReminders, setShowReminders] = useState(false);
  const remindersRef = useRef(null);

  // 🔥 NEW
  const [showAddTask, setShowAddTask] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  /* ---------------- LOAD ENGINEER SITES ---------------- */
  const loadEngineerSites = async () => {
    try {
      setSitesLoading(true);

      if (!engineerUid) {
        setSites([]);
        return;
      }

      const ref = collection(db, "sites");
      const q = query(
        ref,
        where("assignedEngineerId", "==", engineerUid),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setSites(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load assigned sites");
    } finally {
      setSitesLoading(false);
    }
  };

  /* ---------------- LOAD TASKS ---------------- */
  const loadTasksBySite = async (site) => {
    try {
      setTasksLoading(true);
      setTasks([]);
      setShowReminders(false);

      const ref = collection(db, "tasks");
      const weekKey = site?.currentWeekKey;

      const q = weekKey
        ? query(
            ref,
            where("siteId", "==", site.id),
            where("assignedEngineerId", "==", engineerUid),
            where("weekKey", "==", weekKey),
            orderBy("createdAt", "desc")
          )
        : query(
            ref,
            where("siteId", "==", site.id),
            where("assignedEngineerId", "==", engineerUid),
            orderBy("createdAt", "desc")
          );

      const snap = await getDocs(q);

      setTasks(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    loadEngineerSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineerUid]);

  /* ---------------- LOGOUT ---------------- */
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

  /* ---------------- UPDATE STATUS ---------------- */
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
      console.error(e);
      showError(e, "Failed to update task");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  /* ---------------- NEXT WEEK ---------------- */
  const onNextWeek = async () => {
    const pendingCount = tasks.filter((t) => t.status === "PENDING").length;

    if (pendingCount === 0) {
      showError(null, "No pending tasks to carry forward");
      return;
    }

    const ok = window.confirm(
      `Next Week start करायचा?\n\nPending tasks: ${pendingCount}\nThis cannot be undone.`
    );
    if (!ok) return;

    try {
      setNextWeekLoading(true);

      const res = await carryForwardToNextWeek(selectedSite.id);

      showSuccess(
        `Next week started (${res.from} → ${res.to}) | Carried: ${res.carriedCount}`
      );

      const updatedSite = {
        ...selectedSite,
        currentWeekKey: res.to,
      };

      setSelectedSite(updatedSite);
      await loadTasksBySite(updatedSite);
      await loadEngineerSites();
    } catch (e) {
      console.error(e);
      showError(e, "Failed to start next week");
    } finally {
      setNextWeekLoading(false);
    }
  };

  /* ---------------- HELPERS ---------------- */
  const getPendingDays = (task) => {
    if (!task?.statusUpdatedAt || task.status !== "PENDING") return null;
    const d = task.statusUpdatedAt?.toDate?.();
    if (!d) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const counts = useMemo(() => {
    const pending = tasks.filter((t) => t.status === "PENDING").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
    return { pending, done, cancelled };
  }, [tasks]);

  const visibleTasks = tasks.filter((t) =>
    taskFilter === "ALL" ? true : t.status === taskFilter
  );

  /* ---------------- UI ---------------- */
  return (
    <Layout>
      <PageTitle title="Engineer Dashboard" role="Engineer" showBack />

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        {!selectedSite ? (
          <div style={{ fontSize: 12 }}>
            Logged in as: <b>{engineerName || "-"}</b>
          </div>
        ) : (
          <Button
            onClick={() => {
              setSelectedSite(null);
              setTasks([]);
              setTaskFilter("ALL");
              setShowReminders(false);
            }}
          >
            ← Back
          </Button>
        )}

        <Button loading={loggingOut} onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {!selectedSite && (pageLoading || sitesLoading) && (
        <>
          <SkeletonBox />
          <SkeletonBox />
        </>
      )}

      {!selectedSite && !sitesLoading && sites.length === 0 && (
        <EmptyState title="No sites assigned" />
      )}

      {!selectedSite &&
        sites.map((site) => (
          <div
            key={site.id}
            style={{ border: "1px solid #ddd", padding: 12, marginBottom: 10 }}
            onClick={async () => {
              setSelectedSite(site);
              await loadTasksBySite(site);
            }}
          >
            <strong>{site.name}</strong>
            <div style={{ fontSize: 12 }}>
              Week: <b>{site.currentWeekKey}</b>
            </div>
          </div>
        ))}

      {selectedSite && (
        <>
          <h4>{selectedSite.name}</h4>

          <div style={{ fontSize: 12, marginBottom: 10 }}>
            Current Week: <b>{selectedSite.currentWeekKey}</b>
          </div>

          {/* 🔥 NEW ADD TASK BUTTON */}
          <Button onClick={() => setShowAddTask(true)}>➕ Add Task</Button>

          <div style={{ marginTop: 12 }}>
            <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div style={{ marginTop: 12 }}>
            <Button
              loading={nextWeekLoading}
              disabled={counts.pending === 0}
              onClick={onNextWeek}
            >
              Next Week (Carry {counts.pending})
            </Button>
          </div>

          {tasksLoading && <SkeletonBox />}

          {!tasksLoading &&
            visibleTasks.map((task) => (
              <div
                key={task.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <strong>{task.title}</strong>

                {/* 🔥 NEW DAY DISPLAY */}
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Day: <b>{task.dayName || "-"}</b>
                </div>

                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Status: <b>{task.status}</b>
                </div>

                <div style={{ marginTop: 6 }}>
                  {task.status !== "DONE" && (
                    <Button
                      loading={updatingTaskId === task.id}
                      onClick={() => updateTaskStatus(task.id, "DONE")}
                    >
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
                </div>
              </div>
            ))}
        </>
      )}

      {/* 🔥 NEW ADD TASK MODAL */}
      {showAddTask && (
        <AddEngineerTaskModal
          site={selectedSite}
          engineerUid={engineerUid}
          engineerName={engineerName}
          onClose={() => setShowAddTask(false)}
          onSuccess={async () => {
            await loadTasksBySite(selectedSite);
          }}
        />
      )}
    </Layout>
  );
}

export default Engineer;
