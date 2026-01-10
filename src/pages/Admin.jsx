import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Layout from "../components/Layout";
import PageTitle from "../components/PageTitle";
import { sites } from "../data/dummyData";

function Admin() {
  const navigate = useNavigate();

  const [selectedSite, setSelectedSite] = useState(null);
  const [tasks, setTasks] = useState([]);

  // Add task
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");

  // Completion flow
  const [completedSites, setCompletedSites] = useState([]);
  const [showCompleteFlow, setShowCompleteFlow] = useState(false);
  const [appreciation, setAppreciation] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);

  // Task filter
  const [taskFilter, setTaskFilter] = useState("ALL");

  const addTask = () => {
    if (!newTaskTitle.trim()) return;

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
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const completeSiteFinally = () => {
    setCompletedSites([
      ...completedSites,
      {
        ...selectedSite,
        tasks,
        appreciation
      }
    ]);

    setSelectedSite(null);
    setTasks([]);
    setAppreciation("");
    setShowCompleteFlow(false);
    setConfirmComplete(false);
  };

  const visibleTasks = tasks.filter(task => {
    if (taskFilter === "ALL") return true;
    return task.status === taskFilter;
  });

  return (
    <Layout>
      <PageTitle
        title="Admin Dashboard"
        role="Admin"
        showBack={true}
        onBack={() => {
          if (showCompleteFlow) {
            setShowCompleteFlow(false);
            setConfirmComplete(false);
          } else if (selectedSite) {
            setSelectedSite(null);
            setTasks([]);
          } else {
            navigate("/");
          }
        }}
      />

      {/* ACTIVE SITES */}
      {!selectedSite && (
        <div>
          <h4>Active Sites</h4>
          {sites.map(site => (
            <div
              key={site.id}
              style={{
                border: "1px solid #ddd",
                padding: 12,
                marginBottom: 10,
                cursor: "pointer"
              }}
              onClick={() => {
                setSelectedSite(site);
                setTasks(site.tasks);
              }}
            >
              <strong>{site.name}</strong>
              <div style={{ fontSize: 12 }}>
                Engineer: {site.engineer}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMPLETED SITES */}
      {!selectedSite && completedSites.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h4>Completed Sites (History)</h4>
          {completedSites.map(site => (
            <div
              key={site.id}
              style={{
                backgroundColor: "#ecfdf5",
                border: "1px solid #22c55e",
                padding: 12,
                marginBottom: 10
              }}
            >
              <strong>{site.name}</strong>
              <div style={{ fontSize: 12 }}>
                Engineer: {site.engineer}
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                🎉 Congratulations to {site.engineer} & RP Construction
              </div>
              {site.appreciation && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Appreciation: {site.appreciation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SITE DETAILS */}
      {selectedSite && !showCompleteFlow && (
        <div>
          <h4>{selectedSite.name}</h4>
          <p>Engineer: {selectedSite.engineer}</p>

          {/* COMPLETE SITE BUTTON */}
          <button
            onClick={() => setShowCompleteFlow(true)}
            style={{
              marginBottom: 15,
              backgroundColor: "#22c55e",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              cursor: "pointer"
            }}
          >
            Complete Site
          </button>

          {/* ADD TASK */}
          <div style={{ marginBottom: 15 }}>
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              style={{ width: "100%", marginBottom: 6 }}
            />
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              style={{ width: "100%", marginBottom: 6 }}
            >
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
            </select>
            <button onClick={addTask}>Add Task</button>
          </div>

          {/* FILTERS */}
          {["ALL", "PENDING", "DONE", "CANCELLED"].map(f => (
            <button
              key={f}
              onClick={() => setTaskFilter(f)}
              style={{ marginRight: 6 }}
            >
              {f}
            </button>
          ))}

          {/* TASK LIST */}
          {visibleTasks.map(task => (
            <div key={task.id} style={{ border: "1px solid", padding: 8, marginTop: 6 }}>
              <strong>{task.title}</strong>
              <div>Status: {task.status}</div>
              {task.status === "PENDING" && task.pendingWeeks > 0 && (
                <div>Pending since {task.pendingWeeks} week(s)</div>
              )}
              <button
                onClick={() => deleteTask(task.id)}
                style={{ marginTop: 4, backgroundColor: "#ef4444", color: "#fff" }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* COMPLETE SITE FLOW */}
      {selectedSite && showCompleteFlow && (
        <div
          style={{
            border: "1px solid #ef4444",
            padding: 15,
            backgroundColor: "#fff1f2"
          }}
        >
          <h4>⚠️ Confirm Site Completion</h4>
          <p>
            Site: <strong>{selectedSite.name}</strong>
          </p>
          <p>
            Engineer: <strong>{selectedSite.engineer}</strong>
          </p>

          <p style={{ color: "#b91c1c", fontSize: 13 }}>
            Are you sure this site is completed?  
            Once completed, this site cannot be modified again.
          </p>

          <textarea
            placeholder="Write appreciation message"
            value={appreciation}
            onChange={(e) => setAppreciation(e.target.value)}
            rows={3}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <label>
            <input
              type="checkbox"
              checked={confirmComplete}
              onChange={(e) => setConfirmComplete(e.target.checked)}
            />{" "}
            Yes, I confirm this site is completed
          </label>

          <br />

          <button
            disabled={!confirmComplete}
            onClick={completeSiteFinally}
            style={{
              marginTop: 10,
              backgroundColor: confirmComplete ? "#22c55e" : "#9ca3af",
              color: "#fff",
              border: "none",
              padding: "6px 12px"
            }}
          >
            Complete Site
          </button>
        </div>
      )}
    </Layout>
  );
}

export default Admin;
