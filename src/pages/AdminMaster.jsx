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
  serverTimestamp
} from "firebase/firestore";
import "./AdminMaster.css";

const ROWS_PER_PAGE = 10;
const TEMP_ENGINEER_ID = "TEMP_ENG_SYSTEM";

function AdminMaster() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [engineers, setEngineers] = useState([]);
  const [sites, setSites] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  // Pagination States
  const [engPage, setEngPage] = useState(0);
  const [sitePage, setSitePage] = useState(0);

  // Inline Edit States
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const loadMasterData = async () => {
    try {
      setLoading(true);
      const [engSnap, siteSnap, taskSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "ENGINEER"))),
        getDocs(collection(db, "sites")),
        getDocs(collection(db, "tasks")),
      ]);
      setEngineers(engSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
  const handleInlineRename = async (id, type) => {
    if (!editValue.trim()) return setEditingId(null);
    try {
      const batch = writeBatch(db);
      if (type === "ENGINEER") {
        batch.update(doc(db, "users", id), { name: editValue, updatedAt: serverTimestamp() });
        sites.filter(s => s.assignedEngineerId === id).forEach(s => {
          batch.update(doc(db, "sites", s.id), { assignedEngineerName: editValue });
        });
      } else {
        batch.update(doc(db, "sites", id), { name: editValue, updatedAt: serverTimestamp() });
      }
      await batch.commit();
      showSuccess(`${type} Updated Successfully`);
      setEditingId(null);
      loadMasterData();
    } catch (e) { showError(e); }
  };

  const handleDeleteSite = async (siteId, siteName) => {
    if (!window.confirm(`CRITICAL: Permanently delete "${siteName}" and all associated tasks? This cannot be undone.`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "sites", siteId));
      tasks.filter(t => t.siteId === siteId).forEach(t => batch.delete(doc(db, "tasks", t.id)));
      await batch.commit();
      showSuccess("Site and tasks purged");
      loadMasterData();
    } catch (e) { showError(e); }
  };

  const handleDeactivateEng = async (engId, engName) => {
    const assigned = sites.filter(s => s.assignedEngineerId === engId);
    if (!window.confirm(`Deactivate ${engName}? ${assigned.length > 0 ? `Assigned sites will move to TEMP ENGINEER.` : ""}`)) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", engId), { isActive: false, role: "INACTIVE_ENGINEER" });
      assigned.forEach(s => batch.update(doc(db, "sites", s.id), { 
        assignedEngineerId: TEMP_ENGINEER_ID, assignedEngineerName: "TEMP ENGINEER" 
      }));
      await batch.commit();
      showSuccess("Engineer de-activated");
      loadMasterData();
    } catch (e) { showError(e); }
  };

  // --- PAGINATION HELPER ---
  const paginate = (data, page) => data.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  if (loading) return <Layout><SkeletonBox /></Layout>;

  return (
    <Layout>
      <div className="admin-dashboard master-page">
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">Master Control Center</h1>
            <p className="header-subtitle-v3">Manage organizational blueprints and personnel registry</p>
          </div>
          <Button className="btn-secondary-header" onClick={() => navigate("/admin")}>← Dashboard</Button>
        </header>

        <main className="master-grid">
          {/* ENGINEERS SECTION */}
          <section className="master-section-card">
            <div className="section-header-v3">
              <div className="header-title-group">
                <span className="section-icon">👥</span>
                <h2 className="section-heading-v3">Engineers</h2>
              </div>
            </div>
            
            <table className="master-data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Sites</th>
                  <th className="text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {paginate(engineers, engPage).map(eng => (
                  <tr key={eng.id}>
                    <td>
                      {editingId === eng.id ? (
                        <div className="inline-edit-box">
                          <input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                          <button onClick={() => handleInlineRename(eng.id, "ENGINEER")}>OK</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className={`status-dot ${eng.isActive !== false ? 'active' : 'inactive'}`}></span>
                          <span className="clickable-name" onClick={() => { setEditingId(eng.id); setEditValue(eng.name); }}>{eng.name}</span>
                        </div>
                      )}
                    </td>
                    <td><span className="site-count-pill">{sites.filter(s => s.assignedEngineerId === eng.id).length}</span></td>
                    <td className="actions-cell">
                      <button className="action-icon-btn edit" title="Rename" onClick={() => { setEditingId(eng.id); setEditValue(eng.name); }}>✎</button>
                      {eng.isActive !== false && (
                        <button className="action-icon-btn delete" title="Deactivate" onClick={() => handleDeactivateEng(eng.id, eng.name)}>🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <footer className="pagination-footer">
              <span className="pagination-info">Page {engPage + 1} of {Math.ceil(engineers.length / ROWS_PER_PAGE) || 1}</span>
              <div className="pagination-actions">
                <button className="btn-pagination" disabled={engPage === 0} onClick={() => setEngPage(p => p - 1)}>← Prev</button>
                <button className="btn-pagination" disabled={(engPage + 1) * ROWS_PER_PAGE >= engineers.length} onClick={() => setEngPage(p => p + 1)}>Next →</button>
              </div>
            </footer>
          </section>

          {/* SITES SECTION */}
          <section className="master-section-card">
            <div className="section-header-v3">
              <div className="header-title-group">
                <span className="section-icon">🏗️</span>
                <h2 className="section-heading-v3">Sites</h2>
              </div>
            </div>
            
            <table className="master-data-table">
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>Tasks</th>
                  <th className="text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sites, sitePage).map(site => (
                  <tr key={site.id}>
                    <td>
                      {editingId === site.id ? (
                        <div className="inline-edit-box">
                          <input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                          <button onClick={() => handleInlineRename(site.id, "SITE")}>OK</button>
                        </div>
                      ) : (
                        <span className="clickable-name" onClick={() => { setEditingId(site.id); setEditValue(site.name); }}>{site.name}</span>
                      )}
                    </td>
                    <td><span className="site-count-pill">{tasks.filter(t => t.siteId === site.id).length}</span></td>
                    <td className="actions-cell">
                      <button className="action-icon-btn edit" title="Rename" onClick={() => { setEditingId(site.id); setEditValue(site.name); }}>✎</button>
                      <button className="action-icon-btn delete" title="Delete Permanently" onClick={() => handleDeleteSite(site.id, site.name)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <footer className="pagination-footer">
              <span className="pagination-info">Page {sitePage + 1} of {Math.ceil(sites.length / ROWS_PER_PAGE) || 1}</span>
              <div className="pagination-actions">
                <button className="btn-pagination" disabled={sitePage === 0} onClick={() => setSitePage(p => p - 1)}>← Prev</button>
                <button className="btn-pagination" disabled={(sitePage + 1) * ROWS_PER_PAGE >= sites.length} onClick={() => setSitePage(p => p + 1)}>Next →</button>
              </div>
            </footer>
          </section>
        </main>
      </div>
    </Layout>
  );
}

export default AdminMaster;