// src/pages/ReportsAdvanced.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";

import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

function safeDate(d) {
  if (!d) return null;
  try {
    if (typeof d?.toDate === "function") return d.toDate();
    if (d instanceof Date) return d;
    return new Date(d);
  } catch {
    return null;
  }
}

function toInputDate(dateObj) {
  if (!dateObj) return "";
  const d = new Date(dateObj);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseInputDate(str) {
  if (!str) return null;
  const d = new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d;
}

export default function ReportsAdvanced() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [sites, setSites] = useState([]);
  const [tasks, setTasks] = useState([]);

  // ✅ Custom Date Range
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [appliedFrom, setAppliedFrom] = useState(null);
  const [appliedTo, setAppliedTo] = useState(null);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);

        const sitesRef = collection(db, "sites");
        const sitesQ = query(sitesRef, orderBy("createdAt", "desc"));
        const sitesSnap = await getDocs(sitesQ);

        const sitesData = sitesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setSites(sitesData);

        const tasksRef = collection(db, "tasks");
        const tasksQ = query(tasksRef, orderBy("createdAt", "desc"));
        const tasksSnap = await getDocs(tasksQ);

        const tasksData = tasksSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setTasks(tasksData);
      } catch (e) {
        console.error(e);
        showError(e, "Failed to load Advanced Reports");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const filteredTasks = useMemo(() => {
    if (!appliedFrom && !appliedTo) return tasks;

    const from = appliedFrom ? new Date(appliedFrom) : null;
    const to = appliedTo ? new Date(appliedTo) : null;

    // ✅ include end-date full day
    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    return tasks.filter((t) => {
      const d = safeDate(t.createdAt);
      if (!d) return false;

      if (from && d.getTime() < from.getTime()) return false;
      if (to && d.getTime() > to.getTime()) return false;

      return true;
    });
  }, [tasks, appliedFrom, appliedTo]);

  const summary = useMemo(() => {
    const total = filteredTasks.length;
    const pending = filteredTasks.filter((t) => t.status === "PENDING").length;
    const done = filteredTasks.filter((t) => t.status === "DONE").length;
    const cancelled = filteredTasks.filter((t) => t.status === "CANCELLED").length;
    return { total, pending, done, cancelled };
  }, [filteredTasks]);

  const applyFilter = () => {
    const f = parseInputDate(fromDate);
    const t = parseInputDate(toDate);

    if (fromDate && !f) return showError(null, "Invalid From date");
    if (toDate && !t) return showError(null, "Invalid To date");

    if (f && t && f.getTime() > t.getTime()) {
      return showError(null, "From date must be <= To date");
    }

    setAppliedFrom(f);
    setAppliedTo(t);

    showSuccess("Custom range applied ✅");
  };

  const resetAll = () => {
    setFromDate("");
    setToDate("");
    setAppliedFrom(null);
    setAppliedTo(null);
    showSuccess("Filters reset ✅");
  };

  return (
    <Layout>
      <div style={{ padding: 14, minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              borderRadius: 16,
              padding: 16,
              background: "linear-gradient(135deg, #0f172a 0%, #111827 60%)",
              color: "#fff",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>⚙ Advanced Reports</h1>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  Custom Date Range filter + Reset button (Phase 6.0)
                </div>
              </div>

              <button
                onClick={() => navigate("/admin/reports")}
                style={{
                  border: "1px solid rgba(255,255,255,0.25)",
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                ← Back to Reports
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: 12,
              background: "#fff",
              boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "8px 10px",
                    fontSize: 12,
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "8px 10px",
                    fontSize: 12,
                  }}
                />
              </div>

              <button
                onClick={applyFilter}
                style={{
                  border: "1px solid #0f172a",
                  background: "#0f172a",
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ✅ Apply
              </button>

              <button
                onClick={resetAll}
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#0f172a",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ♻ Reset
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>
              Applied Range:{" "}
              <b style={{ color: "#0f172a" }}>
                {appliedFrom ? toInputDate(appliedFrom) : "All Time"} → {appliedTo ? toInputDate(appliedTo) : "Today"}
              </b>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <>
              <SkeletonBox />
              <SkeletonBox />
            </>
          )}

          {/* Summary */}
          {!loading && (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: 12,
                background: "#fff",
                boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                📌 Summary (Filtered Tasks)
              </h3>

              {sites.length === 0 ? (
                <EmptyState title="No sites found" subtitle="Create site first" />
              ) : (
                <div style={{ marginTop: 10, fontSize: 13, color: "#0f172a", display: "grid", gap: 6 }}>
                  <div>Total Tasks: <b>{summary.total}</b></div>
                  <div>Pending: <b>{summary.pending}</b></div>
                  <div>Done: <b>{summary.done}</b></div>
                  <div>Cancelled: <b>{summary.cancelled}</b></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
