// src/pages/AccountantSiteDetail.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { signOut } from "firebase/auth";
import Layout from "../components/Layout";
import Button from "../components/Button";
import SkeletonBox from "../components/SkeletonBox";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

// Helper to format: 2026-W06 -> "2 Week - Feb"
const formatWeekLabel = (weekKey) => {
  if (!weekKey) return "N/A";
  try {
    const [year, weekPart] = weekKey.split("-W");
    const weekNum = parseInt(weekPart);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    const weekOfMonth = (weekNum % 4) || 4;
    const monthIndex = Math.floor((weekNum - 1) / 4.34); 
    return `${weekOfMonth} Week - ${monthNames[monthIndex % 12]}`;
  } catch (e) {
    return weekKey;
  }
};

// Helper to calculate date range for the "Week Period" column
const getWeekDateRange = (weekKey) => {
  if (!weekKey) return "N/A";
  try {
    const [year, weekPart] = weekKey.split("-W");
    const weekNum = parseInt(weekPart);
    const janFirst = new Date(year, 0, 1);
    const days = (weekNum - 1) * 7;
    const start = new Date(year, 0, 1 + days);
    const end = new Date(year, 0, 1 + days + 6);
    const options = { month: 'short', day: '2-digit' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  } catch (e) {
    return "Date Range N/A";
  }
};

function AccountantSiteDetail() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  // States for calculations
  const [weeklyTotals, setWeeklyTotals] = useState({ labour: 0, material: 0 });
  const [projectTotals, setProjectTotals] = useState({ labour: 0, material: 0 }); // 🔥 Cumulative State
  
  // History states
  const [labourHistory, setLabourHistory] = useState([]);
  const [materialHistory, setMaterialHistory] = useState([]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showSuccess("Logged out successfully");
      navigate("/login");
    } catch (e) {
      showError(e, "Logout failed");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Site Info
      const siteSnap = await getDoc(doc(db, "sites", siteId));
      if (!siteSnap.exists()) return;
      const siteData = siteSnap.data();
      setSite({ id: siteSnap.id, ...siteData });

      const activeWeekKey = siteData.currentWeekKey;

      // 2. Fetch ALL data for site-wide cumulative and history
      const [allLabSnap, allMatSnap] = await Promise.all([
        getDocs(query(collection(db, "labour_entries"), where("siteId", "==", siteId))),
        getDocs(query(collection(db, "material_entries"), where("siteId", "==", siteId)))
      ]);

      // 3. Process Labour Data
      let wLab = 0; // Weekly total
      let pLab = 0; // Project total
      const labMap = {};

      allLabSnap.docs.forEach(doc => {
        const d = doc.data();
        const rowAmount = (d.mistriCount * d.mistriRate) + (d.labourCount * d.labourRate);
        
        pLab += rowAmount;
        if (d.weekKey === activeWeekKey) wLab += rowAmount;

        // Grouping for History Table
        if (!labMap[d.weekKey]) labMap[d.weekKey] = { weekKey: d.weekKey, total: 0, dateRange: getWeekDateRange(d.weekKey) };
        labMap[d.weekKey].total += rowAmount;
      });

      // 4. Process Material Data
      let wMat = 0;
      let pMat = 0;
      const matMap = {};

      allMatSnap.docs.forEach(doc => {
        const d = doc.data();
        const rowAmount = (d.qty * d.rate);
        
        pMat += rowAmount;
        if (d.weekKey === activeWeekKey) wMat += rowAmount;

        // Grouping for History Table
        if (!matMap[d.weekKey]) matMap[d.weekKey] = { weekKey: d.weekKey, total: 0, dateRange: getWeekDateRange(d.weekKey) };
        matMap[d.weekKey].total += rowAmount;
      });

      setWeeklyTotals({ labour: wLab, material: wMat });
      setProjectTotals({ labour: pLab, material: pMat });
      setLabourHistory(Object.values(labMap).sort((a, b) => b.weekKey.localeCompare(a.weekKey)));
      setMaterialHistory(Object.values(matMap).sort((a, b) => b.weekKey.localeCompare(a.weekKey)));
      
    } catch (e) {
      console.error("MIS Load Error:", e);
      showError(e, "Failed to load financial data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [siteId]);

  if (loading) return <Layout><div style={{padding: "2rem"}}><SkeletonBox /></div></Layout>;

  return (
    <Layout>
      <div className="admin-dashboard">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate("/accountant/dashboard")}>
            <span className="back-icon">←</span>
            <div className="back-text">
              <span className="back-label">Back to MIS</span>
              <span className="back-sub">Site Selection</span>
            </div>
          </button>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="engineer-badge-pill">
              <div className="badge-content-v5">
                <span className="eng-label-v5">Active Week</span>
                <h2 className="eng-name-v5">{formatWeekLabel(site?.currentWeekKey)}</h2>
              </div>
            </div>
            <button className="btn-logout-v5" onClick={handleLogout} style={{ padding: '8px 15px', borderRadius: '20px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 'bold' }}> Logout </button>
          </div>
        </div>

        <div className="system-alerts-bar">
          <div className="alert-content">
            <span className="pulse-dot"></span>
            <p><strong>Site:</strong> {site?.name} | <strong>Engineer:</strong> {site?.assignedEngineerName}</p>
          </div>
          <div className="alert-btns">
            <button className="btn-muted-action" onClick={loadData}>🔄 Refresh Summary</button>
          </div>
        </div>

        {/* --- 🔥 PROJECT TOTAL SECTION (Overall Cumulative) --- */}
        <h3 className="section-heading" style={{ margin: "1.5rem 0 1rem 0" }}>Total Financial Summary</h3>
        <div className="detail-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", display: 'grid', gap: '1.5rem' }}>
          <div className="config-card-pro" style={{ background: '#f8fafc' }}>
            <div className="card-header-v3"><h3 className="card-heading-v3">Overall Labour</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <span className="stat-label">Total project labour</span>
                  <span className="stat-value" style={{ color: '#1e293b' }}>₹ {projectTotals.labour.toLocaleString('en-IN')}</span>
               </div>
            </div>
          </div>

          <div className="config-card-pro" style={{ background: '#f8fafc' }}>
            <div className="card-header-v3"><h3 className="card-heading-v3">Overall Material</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <span className="stat-label">Total project material</span>
                  <span className="stat-value" style={{ color: '#1e293b' }}>₹ {projectTotals.material.toLocaleString('en-IN')}</span>
               </div>
            </div>
          </div>

          <div className="config-card-pro" style={{ borderLeft: "4px solid #2563eb", background: '#f0f7ff' }}>
            <div className="card-header-v3"><h3 className="card-heading-v3">Project Grand Total</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <h2 style={{ color: "#2563eb", margin: 0 }}>₹ {(projectTotals.labour + projectTotals.material).toLocaleString('en-IN')}</h2>
               </div>
            </div>
          </div>
        </div>

        {/* --- WEEKLY SECTION --- */}
        <h3 className="section-heading" style={{ margin: "1.5rem 0 1rem 0" }}>Weekly Financial Summary</h3>
        <div className="detail-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", display: 'grid', gap: '1.5rem' }}>
          <div className="config-card-pro">
            <div className="card-header-v3"><h3 className="card-heading-v3">Labour Total</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <span className="stat-label">Spent this week</span>
                  <span className="stat-value">₹ {weeklyTotals.labour.toLocaleString('en-IN')}</span>
               </div>
            </div>
          </div>

          <div className="config-card-pro">
            <div className="card-header-v3"><h3 className="card-heading-v3">Material Total</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <span className="stat-label">Spent this week</span>
                  <span className="stat-value">₹ {weeklyTotals.material.toLocaleString('en-IN')}</span>
               </div>
            </div>
          </div>

          <div className="config-card-pro" style={{ borderLeft: "4px solid var(--admin-success)" }}>
            <div className="card-header-v3"><h3 className="card-heading-v3">Grand Total (Weekly)</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <h2 style={{ color: "var(--admin-blue)", margin: 0 }}>₹ {(weeklyTotals.labour + weeklyTotals.material).toLocaleString('en-IN')}</h2>
               </div>
            </div>
          </div>
        </div>

        <section className="task-creation-panel" style={{ marginTop: "2.5rem", textAlign: 'center' }}>
          <div className="panel-header-pro">
             <h3 className="panel-title-pro">Data Entry Sheets</h3>
             <p className="panel-subtitle-pro">Select a sheet to update daily site records.</p>
          </div>
          
          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", padding: "1rem", flexWrap: "wrap" }}>
            <div className="sheet-action-card" onClick={() => navigate(`/accountant/site/${siteId}/labour`)} style={{ cursor: 'pointer' }}>
               <div className="sheet-icon">👷</div>
               <span className="sheet-label">Labour Sheets</span>
               <p className="sheet-sub">Daily Mistri/Labour counts</p>
            </div>

            <div className="sheet-action-card" onClick={() => navigate(`/accountant/site/${siteId}/material`)} style={{ cursor: 'pointer' }}>
               <div className="sheet-icon">🚚</div>
               <span className="sheet-label">Material Sheet</span>
               <p className="sheet-sub">Cement, Sand, Steel etc.</p>
            </div>
          </div>
        </section>

        {/* --- DUAL HISTORY TABLES WITH NAVIGATION --- */}
        <div className="history-section" style={{ marginTop: '3rem' }}>
          <h3 className="section-heading">Financial History Logs</h3>
          
          <div className="history-grid-v5" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
            
            {/* Labour History Table */}
            <div className="master-section-card">
              <div className="section-header-v3">
                <h3 className="section-heading-v3">👷 Labour History</h3>
              </div>
              <div className="master-table-container">
                <table className="master-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>Sr.</th>
                      <th>Sheet Name</th>
                      <th>Week Period</th>
                      <th>Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourHistory.map((item, idx) => (
                      <tr key={item.weekKey} onClick={() => navigate(`/accountant/site/${siteId}/labour`)} style={{ cursor: 'pointer' }}>
                        <td>{idx + 1}</td>
                        <td><strong>{formatWeekLabel(item.weekKey)}</strong></td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{item.dateRange}</td>
                        <td style={{ fontWeight: '800' }}>₹ {item.total.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Material History Table */}
            <div className="master-section-card">
              <div className="section-header-v3">
                <h3 className="section-heading-v3">🚚 Material History</h3>
              </div>
              <div className="master-table-container">
                <table className="master-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>Sr.</th>
                      <th>Sheet Name</th>
                      <th>Week Period</th>
                      <th>Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialHistory.map((item, idx) => (
                      <tr key={item.weekKey} onClick={() => navigate(`/accountant/site/${siteId}/material`)} style={{ cursor: 'pointer' }}>
                        <td>{idx + 1}</td>
                        <td><strong>{formatWeekLabel(item.weekKey)}</strong></td>
                        <td style={{ color: '#64748b', fontSize: '0.85rem' }}>{item.dateRange}</td>
                        <td style={{ fontWeight: '800' }}>₹ {item.total.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
      <style>{`
        .master-table tr:hover { background-color: #f8fafc; }
        @media (max-width: 1024px) {
          .history-grid-v5 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Layout>
  );
}

export default AccountantSiteDetail;