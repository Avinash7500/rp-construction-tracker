import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";

function AccountantDashboard() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadSites = async () => {
      try {
        const q = query(collection(db, "sites"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setSites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error loading sites", e);
      } finally {
        setLoading(false);
      }
    };
    loadSites();
  }, []);

  return (
    <Layout>
      <div className="admin-dashboard">
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">Accountant MIS</h1>
            <span className="header-badge">Site-wise Overview</span>
          </div>
        </header>

        <section className="sites-section">
          <div className="sites-section-header">
            <div className="highlight-pill">
              <h2 className="section-heading">All Project Sites</h2>
            </div>
          </div>

          <div className="master-table-container">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Site Name</th>
                  <th>Site Engineer</th>
                  <th>Total Spend (Till Last Week)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4"><SkeletonBox /></td></tr>
                ) : (
                  sites.map((site, index) => (
                    <tr key={site.id} onClick={() => navigate(`/accountant/site/${site.id}`)} style={{cursor: 'pointer'}}>
                      <td>{index + 1}</td>
                      <td><strong>{site.name}</strong></td>
                      <td>{site.assignedEngineerName || "Not Assigned"}</td>
                      <td>₹ {site.totalSpendTillDate?.toLocaleString('en-IN') || "0"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default AccountantDashboard;