// src/pages/ReportsSnapshotDetails.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";

import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

import { exportSnapshotToExcel } from "../utils/exportSnapshotExcel";
import { exportSnapshotToPDF } from "../utils/exportSnapshotPdf";

/* ----------------- Helpers ----------------- */
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

function textIncludes(hay, needle) {
  const h = (hay || "").toString().toLowerCase();
  const n = (needle || "").toString().toLowerCase().trim();
  if (!n) return true;
  return h.includes(n);
}

function percent(n) {
  if (!isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

/* ----------------- UI Styles ----------------- */
const styles = {
  pageBg: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 12,
    overflowX: "hidden",
  },
  container: { maxWidth: 1100, margin: "0 auto" },

  hero: {
    borderRadius: 16,
    padding: 16,
    background: "linear-gradient(135deg, #0f172a 0%, #111827 60%, #0b1220 100%)",
    color: "#fff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: 800, margin: 0 },
  heroSub: { fontSize: 12, opacity: 0.85, marginTop: 6, marginBottom: 0 },

  stickyBar: {
    position: "sticky",
    top: 10,
    zIndex: 30,
    background: "rgba(248,250,252,0.85)",
    backdropFilter: "blur(10px)",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 10,
    boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  },

  pillsWrap: { display: "flex", gap: 8, flexWrap: "wrap" },

  pill: (active) => ({
    border: "1px solid #e2e8f0",
    background: active ? "#0f172a" : "#fff",
    color: active ? "#fff" : "#0f172a",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  }),

  section: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
    marginTop: 12,
  },

  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 900, color: "#0f172a" },
  sectionSub: { marginTop: 6, fontSize: 12, color: "#64748b" },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 10,
  },

  statCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    background: "#fff",
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
  },

  statLabel: { fontSize: 12, color: "#64748b", fontWeight: 700 },
  statValue: { fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 },

  card: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
    marginBottom: 10,
    overflow: "hidden",
  },

  input: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    background: "#fff",
    outline: "none",
    minWidth: "min(240px, 100%)",
    maxWidth: "100%",
  },

  miniPill: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 700,
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
  },

  footer: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
  },
};

function MiniPill({ label, value }) {
  return (
    <span style={styles.miniPill}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

/* ----------------- Page ----------------- */
export default function ReportsSnapshotDetails() {
  const navigate = useNavigate();
  const { weekKey } = useParams();

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [search, setSearch] = useState("");

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      if (!weekKey) {
        setSnapshot(null);
        return;
      }

      const ref = doc(db, "reportSnapshots", weekKey);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setSnapshot(null);
        return;
      }

      setSnapshot({
        id: snap.id,
        ...snap.data(),
      });
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load snapshot details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [weekKey]);

  const createdAt = useMemo(() => safeDate(snapshot?.createdAt), [snapshot]);
  const summary = snapshot?.summary || {};
  const engineerBreakdown = snapshot?.engineerBreakdown || [];

  const filteredEngineers = useMemo(() => {
    return engineerBreakdown.filter((e) => {
      return textIncludes(e.name, search) || textIncludes(e.engineerUid, search);
    });
  }, [engineerBreakdown, search]);

  const onExportExcel = async () => {
    try {
      if (!snapshot) return;
      setExporting(true);
      await exportSnapshotToExcel(snapshot);
      showSuccess("Excel exported ✅");
    } catch (e) {
      console.error(e);
      showError(e, "Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  const onExportPdf = async () => {
    try {
      if (!snapshot) return;
      setExporting(true);
      await exportSnapshotToPDF(snapshot);
      showSuccess("PDF exported ✅");
    } catch (e) {
      console.error(e);
      showError(e, "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    try {
      if (!weekKey) return;

      const ok = window.confirm(`Delete snapshot "${weekKey}"?\n\nThis cannot be undone.`);
      if (!ok) return;

      setDeleting(true);

      await deleteDoc(doc(db, "reportSnapshots", weekKey));

      showSuccess(`Snapshot deleted ✅ (${weekKey})`);
      navigate("/admin/reports/snapshots");
    } catch (e) {
      console.error(e);
      showError(e, "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div style={styles.pageBg}>
        <div style={styles.container}>
          {/* Hero */}
          <div style={styles.hero}>
            <h1 style={styles.heroTitle}>📌 Snapshot Details</h1>
            <p style={styles.heroSub}>
              Week: <b>{weekKey || "-"}</b> • Read-only data from Firestore snapshot
            </p>
          </div>

          {/* Sticky Bar */}
          <div style={styles.stickyBar}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={styles.pillsWrap}>
                <button style={styles.pill(false)} onClick={() => navigate("/admin")}>
                  ← Admin
                </button>

                <button style={styles.pill(false)} onClick={() => navigate("/admin/reports/snapshots")}>
                  📌 Snapshots
                </button>

                <button style={styles.pill(true)} onClick={() => {}}>
                  🔍 Details
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={{
                    ...styles.pill(false),
                    background: "#0f172a",
                    color: "#fff",
                    borderColor: "#0f172a",
                    opacity: exporting ? 0.7 : 1,
                  }}
                  disabled={exporting || !snapshot}
                  onClick={onExportExcel}
                  title="Export this snapshot to Excel"
                >
                  ⬇ Excel
                </button>

                <button
                  style={{
                    ...styles.pill(false),
                    background: "#fff",
                    color: "#0f172a",
                    opacity: exporting ? 0.7 : 1,
                  }}
                  disabled={exporting || !snapshot}
                  onClick={onExportPdf}
                  title="Export this snapshot to PDF"
                >
                  ⬇ PDF
                </button>

                <button
                  style={{
                    ...styles.pill(false),
                    background: "#fff",
                    color: "#ef4444",
                    borderColor: "#ef4444",
                    opacity: deleting ? 0.7 : 1,
                  }}
                  disabled={deleting || !snapshot}
                  onClick={onDelete}
                  title="Delete snapshot"
                >
                  🗑 {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ marginTop: 12 }}>
              <SkeletonBox />
              <SkeletonBox />
            </div>
          )}

          {/* Not Found */}
          {!loading && !snapshot && (
            <div style={{ marginTop: 12 }}>
              <EmptyState
                title="Snapshot not found"
                subtitle="This weekKey snapshot does not exist. Go back and save snapshot from live Reports."
              />
            </div>
          )}

          {/* Content */}
          {!loading && snapshot && (
            <>
              {/* Summary */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>📊 Weekly Summary</h3>
                <p style={styles.sectionSub}>
                  Range: <b>{snapshot.range?.from || "-"}</b> → <b>{snapshot.range?.to || "-"}</b> • Saved:{" "}
                  <b>{createdAt ? createdAt.toLocaleString() : "-"}</b>
                </p>

                <div style={styles.grid}>
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>Total Sites</div>
                    <div style={styles.statValue}>{summary.totalSites ?? 0}</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>Total Tasks</div>
                    <div style={styles.statValue}>{summary.totalTasks ?? 0}</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>✅ Done</div>
                    <div style={styles.statValue}>{summary.done ?? 0}</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>⏳ Pending</div>
                    <div style={styles.statValue}>{summary.pending ?? 0}</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>❌ Cancelled</div>
                    <div style={styles.statValue}>{summary.cancelled ?? 0}</div>
                  </div>

                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>🔥 Overdue</div>
                    <div style={styles.statValue}>{summary.overdue ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Engineers */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>👷 Engineer Breakdown</h3>
                <p style={styles.sectionSub}>Search engineers inside this snapshot (fast, no Firestore call).</p>

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    style={styles.input}
                    placeholder="Search engineer (name / uid)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  <button style={styles.pill(false)} onClick={() => setSearch("")} disabled={!search}>
                    ✖ Clear
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  {filteredEngineers.length === 0 ? (
                    <EmptyState title="No engineers found" subtitle="Try clearing search." />
                  ) : (
                    filteredEngineers.map((e) => {
                      const total = (e.pending || 0) + (e.done || 0) + (e.cancelled || 0);
                      const completionRate = total > 0 ? (e.done / total) * 100 : 0;

                      return (
                        <div key={e.engineerUid} style={styles.card}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 14 }}>
                                {e.name || "Unknown Engineer"}
                              </div>

                              <div style={{ fontSize: 11, marginTop: 4, color: "#94a3b8" }}>
                                UID: {e.engineerUid || "-"}
                              </div>

                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                <MiniPill label="Total" value={total} />
                                <MiniPill label="✅ Done" value={e.done || 0} />
                                <MiniPill label="⏳ Pending" value={e.pending || 0} />
                                <MiniPill label="❌ Cancelled" value={e.cancelled || 0} />
                                <MiniPill label="🏁 Completion" value={percent(completionRate)} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          <div style={styles.footer}>
            © {new Date().getFullYear()} RP Construction Tracker • Snapshot Export (6.5) + Delete (6.9)
          </div>
        </div>
      </div>
    </Layout>
  );
}
