// src/pages/AccountantDashboard.jsx
import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

function AccountantDashboard() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadSitesAndTotals = async () => {
      try {
        setLoading(true);
        // 1. Fetch all project sites
        const q = query(collection(db, "sites"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const sitesData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Fetch all financial entries
        const [labourSnap, materialSnap] = await Promise.all([
          getDocs(collection(db, "labour_entries")),
          getDocs(collection(db, "material_entries"))
        ]);

        const allLabour = labourSnap.docs.map(d => d.data());
        const allMaterial = materialSnap.docs.map(d => d.data());

        // 3. Map real-time totals to each site
        const sitesWithTotals = sitesData.map(site => {
          const siteLabourTotal = allLabour
            .filter(entry => entry.siteId === site.id)
            .reduce((sum, entry) => sum + (entry.mistriCount * entry.mistriRate) + (entry.labourCount * entry.labourRate), 0);

          const siteMaterialData = allMaterial.filter(entry => entry.siteId === site.id);
          
          const siteMaterialTotal = siteMaterialData.reduce((sum, entry) => sum + (entry.qty * entry.rate), 0);
          const sitePaidTotal = siteMaterialData.reduce((sum, entry) => sum + (entry.paidAmount || 0), 0);

          return {
            ...site,
            realGrandTotal: siteLabourTotal + siteMaterialTotal,
            pendingBalance: siteMaterialTotal - sitePaidTotal // Track what's still owed
          };
        });

        setSites(sitesWithTotals);
      } catch (e) {
        console.error("Error loading dashboard data", e);
        showError(e, "Failed to calculate project totals");
      } finally {
        setLoading(false);
      }
    };
    loadSitesAndTotals();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showSuccess("Logged out successfully");
      navigate("/login");
    } catch (e) {
      showError(e, "Logout failed");
    }
  };

  return (
    <Layout>
      <div className="admin-dashboard dashboard-container">
        <header className="admin-header-card dashboard-header">
          <div className="header-info">
            <h1 className="header-title">Accountant MIS</h1>
            <span className="header-badge">Real-Time Financial Overview</span>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* 🔥 NEW: Manage Dealers Button */}
            <button 
              className="btn-primary-v5" 
              onClick={() => navigate("/accountant/dealers")}
              style={{ 
                background: '#0f172a', 
                color: 'white', 
                padding: '8px 18px', 
                borderRadius: '25px', 
                border: 'none', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              🚚 Manage Dealers
            </button>
            
            <button className="btn-logout-v5" onClick={handleLogout} style={{
              padding: '8px 20px', borderRadius: '25px', border: '1px solid #e2e8f0',
              background: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#ef4444'
            }}>
              🚪 Logout
            </button>
          </div>
        </header>

        <section className="sites-section">
          <div className="sites-section-header">
            <div className="highlight-pill">
              <h2 className="section-heading">Project Registry</h2>
            </div>
            {!loading && <span className="site-count-pill">{sites.length} Active Sites</span>}
          </div>

          {/* --- DESKTOP TABLE VIEW --- */}
          <div className="master-table-container desktop-view">
            <table className="master-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Sr No</th>
                  <th>Site Name</th>
                  <th>Site Engineer</th>
                  <th className="text-right">Pending (Dealers)</th>
                  <th className="text-right">Total Spend (Cumulative)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5"><SkeletonBox /></td></tr>
                ) : (
                  sites.map((site, index) => (
                    <tr key={site.id} onClick={() => navigate(`/accountant/site/${site.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{index + 1}</td>
                      <td><strong style={{ color: '#2563eb' }}>{site.name}</strong></td>
                      <td>{site.assignedEngineerName || "Not Assigned"}</td>
                      <td className="text-right" style={{ color: '#dc2626', fontWeight: '700' }}>
                        ₹ {(site.pendingBalance || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="text-right" style={{ fontWeight: '900', color: '#1e293b', fontSize: '1rem' }}>
                        ₹ {(site.realGrandTotal || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* --- MOBILE CARD VIEW --- */}
          <div className="mobile-view-list">
            {loading ? (
              <SkeletonBox />
            ) : (
              sites.map((site, index) => (
                <div key={site.id} className="site-mobile-card" onClick={() => navigate(`/accountant/site/${site.id}`)}>
                  <div className="card-top">
                    <span className="site-index">#{index + 1}</span>
                    <h3 className="site-name-mobile">{site.name}</h3>
                  </div>
                  <div className="card-details">
                    <div className="detail-row">
                      <span className="label">Engineer:</span>
                      <span className="val">{site.assignedEngineerName || "N/A"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Pending Payments:</span>
                      <span className="val" style={{color: '#dc2626'}}>₹ {(site.pendingBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="detail-row total-spend-row">
                      <span className="label">Grand Total Spend:</span>
                      <span className="val">₹ {(site.realGrandTotal || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="card-arrow">View Site MIS →</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <style>{`
        .mobile-view-list { display: none !important; }
        .desktop-view { display: block !important; }
        
        @media (max-width: 768px) {
          .desktop-view { display: none !important; }
          .mobile-view-list { display: block !important; padding: 10px; }
          .site-mobile-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 15px; }
          .total-spend-row { border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 8px; }
          .total-spend-row .val { color: #2563eb; font-weight: 800; }
        }
        .text-right { text-align: right; }
      `}</style>
    </Layout>
  );
}

export default AccountantDashboard;