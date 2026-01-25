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

  useEffect(() => {
    const t = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // ✅ Load engineer sites
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

      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setSites(data);
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load assigned sites");
    } finally {
      setSitesLoading(false);
    }
  };

  // ✅ Load tasks for selected site + current week + engineer id
  const loadTasksBySite = async (site) => {
    try {
      setTasksLoading(true);
      setTasks([]);

      const ref = collection(db, "tasks");
      const weekKey = site?.currentWeekKey;

      let q;

      if (weekKey) {
        q = query(
          ref,
          where("siteId", "==", site.id),
          where("assignedEngineerId", "==", engineerUid),
          where("weekKey", "==", weekKey),
          orderBy("createdAt", "desc")
        );
      } else {
        // fallback for old data
        q = query(
          ref,
          where("siteId", "==", site.id),
          where("assignedEngineerId", "==", engineerUid),
          orderBy("createdAt", "desc")
        );
      }

      const snap = await getDocs(q);

      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setTasks(data);
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

  const updateTaskStatus = async (taskId, status) => {
    if (!selectedSite?.id) return;

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
      showError(e, "Failed to update task status");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // ✅ Next Week Carry Forward
  const onNextWeek = async () => {
    if (!selectedSite?.id) return;

    const pendingCount = tasks.filter((t) => t.status === "PENDING").length;

    if (pendingCount === 0) {
      showError(null, "No pending tasks to carry forward ✅");
      return;
    }

    const ok = window.confirm(
      `Next Week start करायचा?\n\n✅ Pending tasks carry forward: ${pendingCount}\n❌ Done/Cancelled tasks copy होणार नाहीत\n\nThis cannot be undone.`
    );
    if (!ok) return;

    try {
      setNextWeekLoading(true);

      const res = await carryForwardToNextWeek(selectedSite.id);

      showSuccess(
        `Next week started ✅ (${res.from} → ${res.to}) | Carried: ${res.carriedCount}`
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

  // ✅ Phase 4.4 Helpers
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
    const isOverdue =
      task.status === "PENDING" && pendingDays !== null && pendingDays >= 3;

    return {
      border: isOverdue ? "2px solid #000" : "1px solid #ddd",
      padding: 10,
      borderRadius: 6,
      marginBottom: 8,
      background: isOverdue ? "#fff6f6" : "#fff",
    };
  };

  // ✅ Counts (Phase 4.4.1)
  const counts = useMemo(() => {
    const pending = tasks.filter((t) => t.status === "PENDING").length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
    return { pending, done, cancelled };
  }, [tasks]);

  const visibleTasks = tasks.filter((t) =>
    taskFilter === "ALL" ? true : t.status === taskFilter
  );

  return (
    <Layout>
      <PageTitle title="Engineer Dashboard" role="Engineer" showBack />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
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
            }}
          >
            ← Back
          </Button>
        )}

        <Button loading={loggingOut} onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {/* ✅ Assigned Sites */}
      {!selectedSite && (pageLoading || sitesLoading) && (
        <>
          <SkeletonBox />
          <SkeletonBox />
        </>
      )}

      {!selectedSite && !pageLoading && !sitesLoading && sites.length === 0 && (
        <EmptyState
          title="No sites assigned"
          subtitle="Please wait for admin to assign you a site"
        />
      )}

      {!selectedSite && !pageLoading && !sitesLoading && sites.length > 0 && (
        <div>
          <h4>Assigned Sites</h4>

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
                setTaskFilter("ALL");
                await loadTasksBySite(site);
              }}
            >
              <strong>{site.name}</strong>
              <div style={{ fontSize: 12 }}>
                Engineer: {site.assignedEngineerName || "-"}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Week: <b>{site.currentWeekKey || "-"}</b>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ Tasks */}
      {selectedSite && (
        <div>
          <h4>{selectedSite.name}</h4>

          <div style={{ fontSize: 12, marginBottom: 10 }}>
            Current Week: <b>{selectedSite.currentWeekKey || "-"}</b>
          </div>

          {/* ✅ Phase 4.4.1 Counts */}
          <div
            style={{
              fontSize: 12,
              marginBottom: 10,
              padding: 10,
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
            }}
          >
            <b>Summary:</b>{" "}
            Pending: <b>{counts.pending}</b> | Done: <b>{counts.done}</b> | Cancelled:{" "}
            <b>{counts.cancelled}</b>
          </div>

          {/* ✅ Next Week button improved */}
          <div style={{ marginBottom: 12 }}>
            <Button
              loading={nextWeekLoading}
              disabled={counts.pending === 0}
              onClick={onNextWeek}
            >
              {counts.pending === 0
                ? "➜ Next Week (No Pending)"
                : `➜ Next Week (Carry Forward ${counts.pending})`}
            </Button>
          </div>

          {/* ✅ Status Filter */}
          <div style={{ marginBottom: 12 }}>
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {tasksLoading && (
            <>
              <SkeletonBox />
              <SkeletonBox />
            </>
          )}

          {!tasksLoading && visibleTasks.length === 0 && (
            <EmptyState
              title="No tasks available"
              subtitle="No tasks in this week (carry forward or wait for admin)"
            />
          )}

          {!tasksLoading &&
            visibleTasks.map((task) => {
              const badges = getBadges(task);
              const pendingDays = getPendingDays(task);

              return (
                <div key={task.id} style={getTaskCardStyle(task)}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <strong>{task.title}</strong>

                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Status: <b>{task.status}</b> | Priority:{" "}
                        <b>{task.priority}</b>
                      </div>

                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Week: <b>{task.weekKey || "-"}</b>
                      </div>

                      {pendingDays !== null && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Pending since: <b>{pendingDays} day(s)</b>
                        </div>
                      )}

                      {/* ✅ Badges */}
                      {badges.length > 0 && (
                        <div
                          style={{
                            marginTop: 6,
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
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
                          onClick={() =>
                            updateTaskStatus(task.id, "CANCELLED")
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </Layout>
  );
}

export default Engineer;
