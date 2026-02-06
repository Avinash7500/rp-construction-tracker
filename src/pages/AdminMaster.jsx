// src/pages/AdminMaster.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import SkeletonBox from "../components/SkeletonBox";
import { db } from "../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  query,
  where,
  writeBatch,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import "./AdminMaster.css";

const ROWS_PER_PAGE = 10;
const TEMP_ENGINEER_ID = "TEMP_ENG_SYSTEM";

function AdminMaster() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [engineers, setEngineers] = useState([]);
  const [accountants, setAccountants] = useState([]);
  const [sites, setSites] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  // Filter State
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  // Pagination States
  const [engPage, setEngPage] = useState(0);
  const [accPage, setAccPage] = useState(0);
  const [sitePage, setSitePage] = useState(0);

  // Inline Edit States
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const loadMasterData = async () => {
    try {
      setLoading(true);
      const [userSnap, siteSnap, taskSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "sites")),
        getDocs(collection(db, "tasks")),
      ]);

      const allUsers = userSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      setEngineers(allUsers.filter(u => u.role === "ENGINEER"));
      setAccountants(allUsers.filter(u => u.role === "ACCOUNTANT"));
      setSites(siteSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load master data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMasterData(); }, []);

  // --- ACTIONS ---
  
  const handleToggleActive = async (userId, currentStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus,
        updatedAt: serverTimestamp()
      });
      showSuccess("User status updated successfully");
      loadMasterData();
    } catch (e) {
      showError(e, "Failed to update status");
    }
  };

  const handlePermanentDeleteUser = async (user) => {
    const assigned = sites.filter(s => s.assignedEngineerId === user.id);
    const confirmMsg = assigned.length > 0 
      ? `WARNING: ${user.name || user.email} is assigned to ${assigned.length} sites. These sites will move to TEMP ENGINEER. Permanently delete this account?`
      : `Are you sure you want to permanently delete ${user.name || user.email}? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const batch = writeBatch(db);

      // 1. Reassign sites to TEMP if they belonged to this user
      assigned.forEach(s => {
        batch.update(doc(db, "sites", s.id), { 
          assignedEngineerId: TEMP_ENGINEER_ID, 
          assignedEngineerName: "TEMP ENGINEER" 
        });
      });

      // 2. Delete the user document
      batch.delete(doc(db, "users", user.id));

      await batch.commit();
      showSuccess("User permanently deleted and sites secured ✅");
      loadMasterData();
    } catch (e) {
      showError(e, "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInlineRename = async (id, type) => {
    if (!editValue.trim()) return setEditingId(null);
    try {
      const batch = writeBatch(db);
      if (type === "ENGINEER" || type === "ACCOUNTANT") {
        batch.update(doc(db, "users", id), { name: editValue, updatedAt: serverTimestamp() });
        if (type === "ENGINEER") {
          sites.filter(s => s.assignedEngineerId === id).forEach(s => {
            batch.update(doc(db, "sites", s.id), { assignedEngineerName: editValue });
          });
        }
      } else {
        batch.update(doc(db, "sites", id), { name: editValue, updatedAt: serverTimestamp() });
      }
      await batch.commit();
      showSuccess(`${type} Updated Successfully`);
      setEditingId(null);
      loadMasterData();
    } catch (e) { showError(e); }
  };

  // ✅ ADDED: Two-Step Site Deactivation Logic
  const handleToggleSiteActive = async (siteId, currentStatus) => {
    try {
      await updateDoc(doc(db, "sites", siteId), {
        isActive: !currentStatus,
        updatedAt: serverTimestamp()
      });
      showSuccess(`Site ${!currentStatus ? 'Activated' : 'Deactivated'} successfully`);
      loadMasterData();
    } catch (e) {
      showError(e, "Failed to toggle site status");
    }
  };

  const handleDeleteSite = async (siteId, siteName) => {
    if (!window.confirm(`CRITICAL: Permanently delete "${siteName}" and all associated tasks?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "sites", siteId));
      tasks.filter(t => t.siteId === siteId).forEach(t => batch.delete(doc(db, "tasks", t.id)));
      await batch.commit();
      showSuccess("Site purged");
      loadMasterData();
    } catch (e) { showError(e); }
  };

  // --- FILTERS ---
  const filteredEngineers = showPendingOnly ? engineers.filter(e => !e.isActive) : engineers;
  const filteredAccountants = showPendingOnly ? accountants.filter(a => !a.isActive) : accountants;

  // --- PAGINATION HELPER ---
  const paginate = (data, page) => data.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  if (loading) return <Layout><SkeletonBox /></Layout>;

  return (
    <Layout>
      <div className="admin-dashboard master-page">
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">Master Control Center</h1>
            <p className="header-subtitle-v3">Personnel Registry & Site Architecture</p>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Button className="btn-secondary-header" onClick={() => navigate("/admin")}>← Dashboard</Button>
          </div>
        </header>

        <main className="master-grid">
          
          {/* ENGINEERS SECTION */}
          <section className="master-section-card">
            <div className="section-header-v3">
              <div className="header-title-group">
                <span className="section-icon">👷</span>
                <h2 className="section-heading-v3">Engineers</h2>
              </div>
            </div>
            <table className="master-data-table">
              <thead>
                <tr>
                  <th>Name / Status</th>
                  <th>Sites</th>
                  <th className="text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {paginate(filteredEngineers, engPage).map(eng => (
                  <tr key={eng.id}>
                    <td>
                      <div className="row-status-group">
                        <span className={`status-dot ${eng.isActive ? 'active' : 'inactive'}`}></span>
                        <span className="clickable-name" onClick={() => { setEditingId(eng.id); setEditValue(eng.name || eng.email); }}>
                          {eng.name || eng.email.split('@')[0]}
                        </span>
                      </div>
                    </td>
                    <td><span className="site-count-pill">{sites.filter(s => s.assignedEngineerId === eng.id).length}</span></td>
                    <td className="actions-cell">
                      <button className="action-icon-btn edit" onClick={() => handleToggleActive(eng.id, eng.isActive)}>
                        {eng.isActive ? "🚫" : "✅"}
                      </button>
                      {!eng.isActive && (
                        <button className="action-icon-btn delete" onClick={() => handlePermanentDeleteUser(eng)} title="Permanent Delete">
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="pagination-footer">
              <span className="pagination-info">Page {engPage + 1} of {Math.ceil(filteredEngineers.length / ROWS_PER_PAGE) || 1}</span>
              <div className="pagination-actions">
                <button className="btn-pagination" disabled={engPage === 0} onClick={() => setEngPage(p => p - 1)}>←</button>
                <button className="btn-pagination" disabled={(engPage + 1) * ROWS_PER_PAGE >= filteredEngineers.length} onClick={() => setEngPage(p => p + 1)}>→</button>
              </div>
            </footer>
          </section>

          {/* ACCOUNTANTS SECTION */}
          <section className="master-section-card">
            <div className="section-header-v3">
              <div className="header-title-group">
                <span className="section-icon">🧾</span>
                <h2 className="section-heading-v3">Accountants</h2>
              </div>
            </div>
            <table className="master-data-table">
              <thead>
                <tr>
                  <th>Name / Status</th>
                  <th className="text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {paginate(filteredAccountants, accPage).map(acc => (
                  <tr key={acc.id}>
                    <td>
                      <div className="row-status-group">
                        <span className={`status-dot ${acc.isActive ? 'active' : 'inactive'}`}></span>
                        <span>{acc.name || acc.email}</span>
                      </div>
                    </td>
                    <td className="actions-cell">
                      <button className="action-icon-btn edit" onClick={() => handleToggleActive(acc.id, acc.isActive)}>
                        {acc.isActive ? "🚫" : "✅"}
                      </button>
                      {!acc.isActive && (
                        <button className="action-icon-btn delete" onClick={() => handlePermanentDeleteUser(acc)} title="Permanent Delete">
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="pagination-footer">
              <span className="pagination-info">Page {accPage + 1} of {Math.ceil(filteredAccountants.length / ROWS_PER_PAGE) || 1}</span>
              <div className="pagination-actions">
                <button className="btn-pagination" disabled={accPage === 0} onClick={() => setAccPage(p => p - 1)}>←</button>
                <button className="btn-pagination" disabled={(accPage + 1) * ROWS_PER_PAGE >= filteredAccountants.length} onClick={() => setAccPage(p => p + 1)}>→</button>
              </div>
            </footer>
          </section>

          {/* SITES SECTION ✅ UPDATED with 2-Step Logic */}
          <section className="master-section-card" style={{ gridColumn: "span 2" }}>
            <div className="section-header-v3">
              <div className="header-title-group">
                <span className="section-icon">🏗️</span>
                <h2 className="section-heading-v3">Sites</h2>
              </div>
            </div>
            <table className="master-data-table">
              <thead>
                <tr>
                  <th>Site Name / Status</th>
                  <th>Tasks</th>
                  <th className="text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sites, sitePage).map(site => (
                  <tr key={site.id}>
                    <td>
                      <div className="row-status-group">
                        <span className={`status-dot ${site.isActive !== false ? 'active' : 'inactive'}`}></span>
                        {editingId === site.id ? (
                          <div className="inline-edit-box">
                            <input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                            <button onClick={() => handleInlineRename(site.id, "SITE")}>OK</button>
                          </div>
                        ) : (
                          <span className="clickable-name" onClick={() => { setEditingId(site.id); setEditValue(site.name); }}>{site.name}</span>
                        )}
                      </div>
                    </td>
                    <td><span className="site-count-pill">{tasks.filter(t => t.siteId === site.id).length}</span></td>
                    <td className="actions-cell">
                      <button className="action-icon-btn edit" title={site.isActive !== false ? "Deactivate" : "Activate"} onClick={() => handleToggleSiteActive(site.id, site.isActive !== false)}>
                        {site.isActive !== false ? "🚫" : "✅"}
                      </button>
                      {/* Trash can only visible for inactive sites */}
                      {site.isActive === false && (
                        <button className="action-icon-btn delete" onClick={() => handleDeleteSite(site.id, site.name)}>🗑️</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="pagination-footer">
              <span className="pagination-info">Page {sitePage + 1} of {Math.ceil(sites.length / ROWS_PER_PAGE) || 1}</span>
              <div className="pagination-actions">
                <button className="btn-pagination" disabled={sitePage === 0} onClick={() => setSitePage(p => p - 1)}>←</button>
                <button className="btn-pagination" disabled={(sitePage + 1) * ROWS_PER_PAGE >= sites.length} onClick={() => setSitePage(p => p + 1)}>→</button>
              </div>
            </footer>
          </section>
        </main>
      </div>
    </Layout>
  );
}

export default AdminMaster;