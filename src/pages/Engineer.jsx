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

function Engineer() {
  const navigate = useNavigate();

  const [pageLoading, setPageLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);

  const [loggingOut, setLoggingOut] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);

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

  const goToNextWeek = async () => {
    setWeekLoading(true);
    await new Promise(r => setTimeout(r, 400));

    setTasks(tasks.map(t =>
      t.status === "PENDING"
        ? { ...t, pendingWeeks: (t.pendingWeeks || 0) + 1 }
        : t
    ));
    setCurrentWeek(w => w + 1);
    setWeekLoading(false);
  };

  return (
    <Layout>
      <PageTitle title="Engineer Dashboard" role="Engineer" showBack />

      <div style={{ textAlign: "right", marginBottom: 10 }}>
        <Button loading={loggingOut} onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {!selectedSite && pageLoading && (
        <>
          <SkeletonBox />
          <SkeletonBox />
        </>
      )}

      {!selectedSite && !pageLoading && sites.length === 0 && (
        <EmptyState
          title="No sites assigned"
          subtitle="Please wait for admin to assign you a site"
        />
      )}

      {!selectedSite && !pageLoading && sites.length > 0 && (
        <div>
          <h4>Assigned Sites</h4>
          {sites.map(site => (
            <div
              key={site.id}
              style={{ border: "1px solid #ddd", padding: 12 }}
              onClick={() => {
                setSelectedSite(site);
                setTasks(site.tasks);
                setCurrentWeek(1);
              }}
            >
              {site.name}
            </div>
          ))}
        </div>
      )}

      {selectedSite && (
        <div>
          <h4>{selectedSite.name}</h4>

          <Button loading={weekLoading} onClick={goToNextWeek}>
            Next Week →
          </Button>

          {tasks.length === 0 && (
            <EmptyState
              title="No tasks available"
              subtitle="Admin has not added tasks yet"
            />
          )}

          {tasks.map(task => (
            <div key={task.id} style={{ border: "1px solid", padding: 8 }}>
              {task.title}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Engineer;
