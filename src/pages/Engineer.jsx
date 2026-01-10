import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Layout from "../components/Layout";
import PageTitle from "../components/PageTitle";
import { sites } from "../data/dummyData";

function Engineer() {
  const navigate = useNavigate();

  const [selectedSite, setSelectedSite] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);

  // Change task status (Done / Pending / Cancelled)
  const updateTaskStatus = (taskId, newStatus) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId
        ? { ...task, status: newStatus }
        : task
    );
    setTasks(updatedTasks);
  };

  // Update note for a task
  const updateTaskNote = (taskId, note) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId
        ? { ...task, note }
        : task
    );
    setTasks(updatedTasks);
  };

  // Decide card color based on task status
  const getStatusStyle = (status) => {
    switch (status) {
      case "DONE":
        return { backgroundColor: "#dcfce7", borderColor: "#22c55e" };
      case "PENDING":
        return { backgroundColor: "#fef9c3", borderColor: "#eab308" };
      case "CANCELLED":
        return { backgroundColor: "#e5e7eb", borderColor: "#9ca3af" };
      default:
        return { backgroundColor: "#f9fafb", borderColor: "#d1d5db" };
    }
  };

  // Simulate next week (carry-forward logic)
  const goToNextWeek = () => {
    const updatedTasks = tasks.map(task => {
      if (task.status === "PENDING") {
        return {
          ...task,
          pendingWeeks: (task.pendingWeeks || 0) + 1
        };
      }
      return task;
    });

    setTasks(updatedTasks);
    setCurrentWeek(currentWeek + 1);
  };

  return (
    <Layout>
      <PageTitle
        title="Engineer Dashboard"
        role="Engineer"
        showBack={true}
        onBack={() => {
          if (selectedSite) {
            setSelectedSite(null);
            setCurrentWeek(1);
          } else {
            navigate("/");
          }
        }}
      />

      {/* SITE LIST */}
      {!selectedSite && (
        <div>
          <h4>Assigned Sites</h4>

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
                setTasks(
                  site.tasks.map(task => ({
                    ...task,
                    pendingWeeks: task.pendingWeeks || 0
                  }))
                );
                setCurrentWeek(1);
              }}
            >
              <strong>{site.name}</strong>
            </div>
          ))}
        </div>
      )}

      {/* TASK LIST */}
      {selectedSite && (
        <div>
          <h4>{selectedSite.name}</h4>

          {/* WEEK CONTROLS */}
          <div style={{ marginBottom: 12 }}>
            <strong>Week:</strong> {currentWeek}
            <button
              onClick={goToNextWeek}
              style={{ marginLeft: 10 }}
            >
              Next Week →
            </button>
          </div>

          {tasks.map(task => (
            <div
              key={task.id}
              style={{
                border: "1px solid",
                padding: 10,
                marginBottom: 8,
                ...getStatusStyle(task.status)
              }}
            >
              <strong>{task.title}</strong>
              <div>Status: {task.status}</div>

              {task.status === "PENDING" && task.pendingWeeks > 0 && (
                <div style={{ fontSize: 12, color: "#92400e" }}>
                  Pending since {task.pendingWeeks} week(s)
                </div>
              )}

              {/* STATUS BUTTONS */}
              <div style={{ marginTop: 6 }}>
                <button onClick={() => updateTaskStatus(task.id, "DONE")}>
                  Done
                </button>

                <button
                  onClick={() => updateTaskStatus(task.id, "PENDING")}
                  style={{ marginLeft: 6 }}
                >
                  Pending
                </button>

                <button
                  onClick={() => updateTaskStatus(task.id, "CANCELLED")}
                  style={{ marginLeft: 6 }}
                >
                  Cancel
                </button>
              </div>

              {/* NOTES */}
              <div style={{ marginTop: 8 }}>
                <textarea
                  placeholder="Add note (why pending / what done)"
                  value={task.note || ""}
                  onChange={(e) =>
                    updateTaskNote(task.id, e.target.value)
                  }
                  rows={2}
                  style={{
                    width: "100%",
                    padding: 6,
                    fontSize: 12
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Engineer;
