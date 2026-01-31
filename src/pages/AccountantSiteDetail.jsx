// src/pages/AccountantSiteDetail.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import SkeletonBox from "../components/SkeletonBox";

function AccountantSiteDetail() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Real calculation states
  const [totals, setTotals] = useState({ labour: 0, material: 0 });

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Site Info to get the currentWeekKey
      const siteSnap = await getDoc(doc(db, "sites", siteId));
      if (!siteSnap.exists()) return;
      const siteData = siteSnap.data();
      setSite({ id: siteSnap.id, ...siteData });

      const weekKey = siteData.currentWeekKey;

      // 2. Fetch all Labour entries for this week & site
      const labourQ = query(
        collection(db, "labour_entries"),
        where("siteId", "==", siteId),
        where("weekKey", "==", weekKey)
      );
      const labourSnap = await getDocs(labourQ);
      const totalLabour = labourSnap.docs.reduce((acc, d) => {
        const data = d.data();
        return acc + (data.mistriCount * data.mistriRate) + (data.labourCount * data.labourRate);
      }, 0);

      // 3. Fetch all Material entries for this week & site
      const materialQ = query(
        collection(db, "material_entries"),
        where("siteId", "==", siteId),
        where("weekKey", "==", weekKey)
      );
      const materialSnap = await getDocs(materialQ);
      const totalMaterial = materialSnap.docs.reduce((acc, d) => {
        const data = d.data();
        return acc + (data.qty * data.rate);
      }, 0);

      setTotals({ labour: totalLabour, material: totalMaterial });
      
    } catch (e) {
      console.error("MIS Load Error:", e);
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
          <div className="engineer-badge-pill">
            <div className="badge-content-v5">
              <span className="eng-label-v5">Current Active Week</span>
              <h2 className="eng-name-v5">{site?.currentWeekKey || "W--"}</h2>
            </div>
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

        <h3 className="section-heading" style={{ margin: "1.5rem 0 1rem 0" }}>Weekly Financial Summary</h3>
        
        <div className="detail-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", display: 'grid', gap: '1.5rem' }}>
          
          {/* LABOUR CARD */}
          <div className="config-card-pro">
            <div className="card-header-v3"><h3 className="card-heading-v3">Labour Total</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <span className="stat-label">Spent this week</span>
                  <span className="stat-value">₹ {totals.labour.toLocaleString('en-IN')}</span>
               </div>
            </div>
          </div>

          {/* MATERIAL CARD */}
          <div className="config-card-pro">
            <div className="card-header-v3"><h3 className="card-heading-v3">Material Total</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <span className="stat-label">Spent this week</span>
                  <span className="stat-value">₹ {totals.material.toLocaleString('en-IN')}</span>
               </div>
            </div>
          </div>

          {/* GRAND TOTAL CARD */}
          <div className="config-card-pro" style={{ borderLeft: "4px solid var(--admin-success)" }}>
            <div className="card-header-v3"><h3 className="card-heading-v3">Grand Total</h3></div>
            <div className="config-body-v3">
               <div className="stat-item-v3">
                  <h2 style={{ color: "var(--admin-blue)", margin: 0 }}>₹ {(totals.labour + totals.material).toLocaleString('en-IN')}</h2>
               </div>
            </div>
          </div>
        </div>

        {/* SHEET NAVIGATION AREA */}
        <section className="task-creation-panel" style={{ marginTop: "2.5rem", textAlign: 'center' }}>
          <div className="panel-header-pro">
             <h3 className="panel-title-pro">Data Entry Sheets</h3>
             <p className="panel-subtitle-pro">Select a sheet to update daily site records.</p>
          </div>
          
          <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", padding: "1rem", flexWrap: "wrap" }}>
            <div className="sheet-action-card" onClick={() => navigate(`/accountant/site/${siteId}/labour`)}>
               <div className="sheet-icon">👷</div>
               <span className="sheet-label">Labour Sheets</span>
               <p className="sheet-sub">Daily Mistri/Labour counts</p>
            </div>

            <div className="sheet-action-card" onClick={() => navigate(`/accountant/site/${siteId}/material`)}>
               <div className="sheet-icon">🚚</div>
               <span className="sheet-label">Material Sheet</span>
               <p className="sheet-sub">Cement, Sand, Steel etc.</p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default AccountantSiteDetail;