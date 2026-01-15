import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import PageTitle from "../components/PageTitle";
import { sites } from "../data/dummyData";
import { logout } from "../utils/logout";
import Button from "../components/Button";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";

function Admin() {
  const navigate = useNavigate();

  const [pageLoading, setPageLoading] = useState(true);

  const [selectedSite, setSelectedSite] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");

  const [completedSites, setCompletedSites] = useState([]);
  const [showCompleteFlow, setShowCompleteFlow] = useState(false);
  const [appreciation, setAppreciation] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);

  const [taskFilter, setTaskFilter] = useState("ALL");

  const [loggingOut, setLoggingOut] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [completingSite, setCompletingSite] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(t);
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

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    await new Promise(r => setTimeout(r, 400));

    setTasks([
      ...tasks,
      {
        id: Date.now(),
        title: newTaskTitle,
        status: "PENDING",
        priority: newTaskPriority,
        pendingWeeks: 0
      }
    ]);

    setNewTaskTitle("");
    setNewTaskPriority("NORMAL");
    setAddingTask(false);
  };

  const completeSiteFinally = async () => {
    if (!confirmComplete) return;

    setCompletingSite(true);
    await new Promise(r => setTimeout(r, 500));

    setCompletedSites([
      ...completedSites,
      { ...selectedSite, tasks, appreciation }
    ]);

    setSelectedSite(null);
    setTasks([]);
    setAppreciation("");
    setShowCompleteFlow(false);
    setConfirmComplete(false);
    setCompletingSite(false);

    showSuccess("Site completed successfully");
  };

  const visibleTasks = tasks.filter(t =>
    taskFilter === "ALL" ? true : t.status === taskFilter
  );

  return (
    <Layout>
      <PageTitle title="Admin Dashboard" role="Admin" showBack />

      <div style={{ textAlign: "right", marginBottom: 10 }}>
        <Button loading={loggingOut} onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {/* ACTIVE SITES */}
      {!selectedSite && pageLoading && (
        <>
          <SkeletonBox />
          <SkeletonBox />
          <SkeletonBox />
        </>
      )}

      {!selectedSite && !pageLoading && sites.length === 0 && (
        <EmptyState
          title="No active sites"
          subtitle="Create or assign a site to get started"
        />
      )}

      {!selectedSite && !pageLoading && sites.length > 0 && (
        <div>
          <h4>Active Sites</h4>
          {sites.map(site => (
            <div
              key={site.id}
              style={{ border: "1px solid #ddd", padding: 12, marginBottom: 10 }}
              onClick={() => {
                setSelectedSite(site);
                setTasks(site.tasks);
              }}
            >
              <strong>{site.name}</strong>
              <div style={{ fontSize: 12 }}>Engineer: {site.engineer}</div>
            </div>
          ))}
        </div>
      )}

      {/* TASKS */}
      {selectedSite && !showCompleteFlow && (
        <div>
          <h4>{selectedSite.name}</h4>

          <Button style={{ marginBottom: 12 }} onClick={() => setShowCompleteFlow(true)}>
            Complete Site
          </Button>

          <div style={{ marginBottom: 12 }}>
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title"
            />
            <select
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

          {visibleTasks.length === 0 && (
            <EmptyState
              title="No tasks added"
              subtitle="Start by adding the first task for this site"
            />
          )}

          {visibleTasks.map(task => (
            <div key={task.id} style={{ border: "1px solid", padding: 8 }}>
              {task.title}
            </div>
          ))}
        </div>
      )}

      {/* COMPLETE FLOW */}
      {selectedSite && showCompleteFlow && (
        <div style={{ border: "1px solid red", padding: 12 }}>
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

          <Button
            loading={completingSite}
            disabled={!confirmComplete}
            onClick={completeSiteFinally}
          >
            Complete Site
          </Button>
        </div>
      )}
    </Layout>
  );
}

export default Admin;
