// src/pages/ReportsSnapshots.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";

import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

import { collection, deleteDoc, doc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

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

function paginate(list, page, pageSize) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    total,
    totalPages,
    page: safePage,
    pageSize,
  };
}

function StatPill({ label, value }) {
  return (
    <span
      style={{
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
      }}
    >
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

/* ----------------- UI Styles ----------------- */
const styles = {
  pageBg: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 500px at 0% 0%, #e0f2fe 0%, rgba(224,242,254,0) 60%), radial-gradient(1000px 500px at 100% 0%, #fae8ff 0%, rgba(250,232,255,0) 60%), #f8fafc",
    padding: 12,
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

  input: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    background: "#fff",
    outline: "none",
    minWidth: 240,
  },

  section: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
    marginTop: 12,
  },

  card: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
    marginBottom: 10,
  },

  footer: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
  },
};

function Pager({ page, totalPages, total, onPrev, onNext }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
        marginTop: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>
        Showing page <b>{page}</b> / <b>{totalPages}</b> • Total: <b>{total}</b>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.pill(false)} onClick={onPrev} disabled={page <= 1}>
          ← Prev
        </button>
        <button style={styles.pill(false)} onClick={onNext} disabled={page >= totalPages}>
          Next →
        </button>
      </div>
    </div>
  );
}

/* ----------------- Page ----------------- */
export default function ReportsSnapshots() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const loadSnapshots = async () => {
    try {
      setLoading(true);

      const ref = collection(db, "reportSnapshots");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const data = snap.docs.map((d) => ({
        id: d.id, // weekKey
        ...d.data(),
      }));

      setSnapshots(data);
    } catch (e) {
      console.error(e);
      showError(e, "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const deleteSnapshot = async (weekKey) => {
    try {
      if (!weekKey) return;

      const ok = window.confirm(`Delete snapshot "${weekKey}"?\n\nThis cannot be undone.`);
      if (!ok) return;

      await deleteDoc(doc(db, "reportSnapshots", weekKey));

      setSnapshots((prev) => prev.filter((x) => (x.weekKey || x.id) !== weekKey));
      showSuccess(`Snapshot deleted ✅ (${weekKey})`);
    } catch (e) {
      console.error(e);
      showError(e, "Failed to delete snapshot");
    }
  };

  const filtered = useMemo(() => {
    return snapshots.filter((s) => {
      return (
        textIncludes(s.weekKey, search) ||
        textIncludes(s.range?.from, search) ||
        textIncludes(s.range?.to, search) ||
        textIncludes(s.createdBy, search)
      );
    });
  }, [snapshots, search]);

  const pageModel = useMemo(() => paginate(filtered, page, 8), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <Layout>
      <div style={styles.pageBg}>
        <div style={styles.container}>
          {/* Hero */}
          <div style={styles.hero}>
            <h1 style={styles.heroTitle}>📌 Weekly Report Snapshots</h1>
            <p style={styles.heroSub}>
              Saved snapshots history. Open any week instantly without recalculating live data.
            </p>
          </div>

          {/* Sticky Bar */}
          <div style={styles.stickyBar}>
            <div style={styles.pillsWrap}>
              <button style={styles.pill(false)} onClick={() => navigate("/admin")}>
                ← Admin
              </button>

              <button style={styles.pill(false)} onClick={() => navigate("/admin/reports")}>
                📊 Live Reports
              </button>

              <button style={styles.pill(true)} onClick={() => {}}>
                📌 Snapshots
              </button>

              <button style={styles.pill(false)} onClick={loadSnapshots} title="Reload snapshots">
                🔄 Refresh
              </button>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                style={styles.input}
                placeholder="Search snapshot (weekKey, dates, createdBy...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <button
                style={{
                  ...styles.pill(false),
                  background: "#0f172a",
                  color: "#fff",
                  borderColor: "#0f172a",
                }}
                onClick={() => {
                  setSearch("");
                  showSuccess("Search cleared ✅");
                }}
              >
                ✖ Clear
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ marginTop: 12 }}>
              <SkeletonBox />
              <SkeletonBox />
            </div>
          )}

          {/* List */}
          {!loading && (
            <div style={styles.section}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                Snapshot History
              </h3>
              <p style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                Open snapshot details, export from details page, or delete old snapshots.
              </p>

              {pageModel.total === 0 ? (
                <EmptyState
                  title="No snapshots found"
                  subtitle="Go to Reports and click 'Save Snapshot' to create weekly backups."
                />
              ) : (
                <>
                  <div style={{ marginTop: 10 }}>
                    {pageModel.items.map((s) => {
                      const wk = s.weekKey || s.id;
                      const createdAt = safeDate(s.createdAt);
                      const summary = s.summary || {};

                      return (
                        <div key={wk} style={styles.card}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                                📌 {wk}
                              </div>

                              <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>
                                Range:{" "}
                                <b style={{ color: "#0f172a" }}>
                                  {s.range?.from || "-"} → {s.range?.to || "-"}
                                </b>
                              </div>

                              <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
                                Saved: {createdAt ? createdAt.toLocaleString() : "-"} • By:{" "}
                                {s.createdBy ? String(s.createdBy).slice(0, 10) + "..." : "-"}
                              </div>

                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                                <StatPill label="Sites" value={summary.totalSites ?? 0} />
                                <StatPill label="Tasks" value={summary.totalTasks ?? 0} />
                                <StatPill label="✅ Done" value={summary.done ?? 0} />
                                <StatPill label="⏳ Pending" value={summary.pending ?? 0} />
                                <StatPill label="❌ Cancelled" value={summary.cancelled ?? 0} />
                                <StatPill label="🔥 Overdue" value={summary.overdue ?? 0} />
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <button
                                style={styles.pill(false)}
                                onClick={() => navigate(`/admin/reports/snapshots/${wk}`)}
                              >
                                Open →
                              </button>

                              <button
                                style={{
                                  ...styles.pill(false),
                                  borderColor: "#ef4444",
                                  color: "#ef4444",
                                  background: "#fff",
                                }}
                                onClick={() => deleteSnapshot(wk)}
                                title="Delete snapshot"
                              >
                                🗑 Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Pager
                    page={pageModel.page}
                    totalPages={pageModel.totalPages}
                    total={pageModel.total}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => Math.min(pageModel.totalPages, p + 1))}
                  />
                </>
              )}
            </div>
          )}

          <div style={styles.footer}>
            © {new Date().getFullYear()} RP Construction Tracker • Snapshot History (Phase 6.3 + 6.9)
          </div>
        </div>
      </div>
    </Layout>
  );
}
