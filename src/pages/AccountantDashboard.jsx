import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import AccountantShell from "../components/AccountantShell";
import SkeletonBox from "../components/SkeletonBox";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { formatMarathiWeekFromWeekKey } from "../utils/marathiWeekFormat";

function computeLabourSpend(entry) {
  return (entry.mistriCount || 0) * (entry.mistriRate || 0)
    + (entry.labourCount || 0) * (entry.labourRate || 0);
}

function computeMaterialSpend(entry) {
  if (typeof entry.billAmount === "number") return entry.billAmount;
  return (entry.qty || 0) * (entry.rate || 0);
}

function getCurrentWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export default function AccountantDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const siteSnap = await getDocs(
        query(collection(db, "sites"), orderBy("createdAt", "desc")),
      );
      const siteList = siteSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((site) => site.isActive !== false);

      const enriched = await Promise.all(
        siteList.map(async (site) => {
          const [labourSnap, materialSnap] = await Promise.all([
            getDocs(
              query(
                collection(db, "labour_entries"),
                where("siteId", "==", site.id),
              ),
            ),
            getDocs(
              query(
                collection(db, "material_entries"),
                where("siteId", "==", site.id),
              ),
            ),
          ]);

          const labourTotal = labourSnap.docs.reduce(
            (sum, docSnap) => sum + computeLabourSpend(docSnap.data()),
            0,
          );
          const materialTotal = materialSnap.docs.reduce(
            (sum, docSnap) => sum + computeMaterialSpend(docSnap.data()),
            0,
          );
          return {
            ...site,
            totalLabourSpend: labourTotal,
            totalMaterialSpend: materialTotal,
            totalSpend: labourTotal + materialTotal,
          };
        }),
      );

      setSites(enriched);
    } catch (e) {
      showError(e, "Failed to load accountant dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const totalSpendAllSites = useMemo(() => {
    return sites.reduce((sum, site) => sum + (site.totalSpend || 0), 0);
  }, [sites]);

  const currentWeekLabel = useMemo(() => {
    return formatMarathiWeekFromWeekKey(getCurrentWeekKey(new Date()));
  }, []);

  return (
    <AccountantShell
      title="Accountant Dashboard"
      subtitle="लेखापाल डॅशबोर्ड"
      actions={(
        <button className="btn-primary-v5" onClick={loadDashboard}>
          Refresh
        </button>
      )}
    >
      <section className="acc-grid-3">
        <article className="acc-stat-card">
          <div className="acc-stat-label">Active Sites</div>
          <div className="acc-stat-value">{sites.length}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Combined Total Spend</div>
          <div className="acc-stat-value">₹ {totalSpendAllSites.toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">सध्याचा आठवडा</div>
          <div className="acc-stat-value" style={{ fontSize: "1rem" }}>
            {currentWeekLabel}
          </div>
        </article>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Active Site Tracking</h3>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0 }}>
          {loading ? (
            <SkeletonBox />
          ) : (
            <table className="acc-table">
              <thead>
                <tr>
                  <th style={{ width: 64 }}>Sr No</th>
                  <th>Site Name / Location</th>
                  <th>Supervisor</th>
                  <th>Status</th>
                  <th className="acc-right">Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {sites.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                      No active sites available.
                    </td>
                  </tr>
                ) : (
                  sites.map((site, idx) => (
                    <tr
                      key={site.id}
                      onClick={() => navigate(`/accountant/site/${site.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{site.name || "-"}</strong>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          {site.location || "Location not set"}
                        </div>
                      </td>
                      <td>{site.assignedEngineerName || "Not assigned"}</td>
                      <td>
                        <span className="acc-tag">
                          {site.status || (site.isActive === false ? "Inactive" : "In Progress")}
                        </span>
                      </td>
                      <td className="acc-right">₹ {(site.totalSpend || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AccountantShell>
  );
}
