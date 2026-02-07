// src/pages/LabourIndex.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

const ITEMS_PER_PAGE = 10;

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

function LabourIndex() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [workTypes, setWorkTypes] = useState([]);
  const [newType, setNewType] = useState("");

  // ✅ NEW STATE: Search and Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const snap = await getDoc(doc(db, "sites", siteId));
        if (snap.exists()) {
          const data = snap.data();
          setSite(data);
          // Existing logic: priority to Firebase list, fallback to defaults
          setWorkTypes(data.workTypes || ["Tiles", "Bilal", "Department", "RCC"]);
        }
      } catch (e) {
        showError(e, "Failed to load site configuration");
      }
    };
    fetchSite();
  }, [siteId]);

  // Existing logic for adding types, updated with Firebase persistence
  const addWorkType = async () => {
    const trimmedType = newType.trim();
    if (!trimmedType) return;
    if (workTypes.includes(trimmedType)) return showError(null, "This sheet type already exists");

    try {
      setLoadingAction(true);
      const siteRef = doc(db, "sites", siteId);
      await updateDoc(siteRef, {
        workTypes: arrayUnion(trimmedType)
      });
      setWorkTypes(prev => [...prev, trimmedType]);
      setNewType("");
      showSuccess(`New Sheet "${trimmedType}" Added ✅`);
    } catch (e) {
      showError(e, "Failed to register new work type");
    } finally {
      setLoadingAction(false);
    }
  };

  // ✅ UPDATED LOGIC: Archive and sync with Dashboard
  const handleArchiveWeek = async () => {
    const currentLabel = formatWeekLabel(site?.currentWeekKey);
    const confirmMsg = `Finalize and Archive ${currentLabel}? \n\nThis will add this week's spend to the Project Grand Total and start a new week.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoadingAction(true);

      // 1. Calculate this week's total spend from DB before closing
      const [labSnap, matSnap] = await Promise.all([
        getDocs(query(collection(db, "labour_entries"), where("siteId", "==", siteId), where("weekKey", "==", site.currentWeekKey))),
        getDocs(query(collection(db, "material_entries"), where("siteId", "==", siteId), where("weekKey", "==", site.currentWeekKey)))
      ]);

      const weeklyLab = labSnap.docs.reduce((acc, d) => {
        const data = d.data();
        return acc + (data.mistriCount * data.mistriRate) + (data.labourCount * data.labourRate);
      }, 0);

      const weeklyMat = matSnap.docs.reduce((acc, d) => {
        const data = d.data();
        return acc + (data.qty * data.rate);
      }, 0);

      const weeklyTotal = weeklyLab + weeklyMat;

      // 2. Prepare next week key
      const [year, weekPart] = site.currentWeekKey.split("-W");
      const nextWeekNum = parseInt(weekPart) + 1;
      const nextWeekKey = `${year}-W${nextWeekNum.toString().padStart(2, '0')}`;

      // 3. Update Site Document with New Week AND New Cumulative Total for Dashboard
      const siteRef = doc(db, "sites", siteId);
      const existingTotal = site.totalSpendTillDate || 0;

      await updateDoc(siteRef, {
        currentWeekKey: nextWeekKey,
        totalSpendTillDate: existingTotal + weeklyTotal, // 🔥 Updates Dashboard ₹
        lastArchivedAt: serverTimestamp(),
      });

      showSuccess(`${currentLabel} finalized! ₹${weeklyTotal.toLocaleString('en-IN')} added to Grand Total.`);
      navigate(`/accountant/site/${siteId}`);
    } catch (e) {
      console.error(e);
      showError(e, "Archive failed");
    } finally {
      setLoadingAction(false);
    }
  };

  // ✅ NEW LOGIC: Filtering and Pagination Calculation
  const filteredTypes = workTypes.filter(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredTypes.length / ITEMS_PER_PAGE);
  const displayedTypes = filteredTypes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <Layout>
      <div className="admin-dashboard">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate(`/accountant/site/${siteId}`)}>
            <span className="back-icon">←</span>
            <div className="back-text">
              <span className="back-label">Back to Site Summary</span>
              <span className="back-sub">Site Finance</span>
            </div>
          </button>
          <div className="engineer-badge-pill">
             <div className="badge-content-v5">
               <span className="eng-label-v5">Labour Sheets Registry</span>
               <h2 className="eng-name-v5">{site?.name || "Loading..."}</h2>
             </div>
          </div>
        </div>

        <main className="master-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', marginTop: '2rem' }}>

          {/* LEFT SIDE: CONFIGURATION & ARCHIVE SECTION */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <section className="master-section-card">
              <div className="section-header-v3">
                <h3 className="section-heading-v3">⚙️ Sheet Configuration</h3>
              </div>
              <div style={{ padding: '24px' }}>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
                  Define new work categories. These will appear in the registry on the right.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    className="task-input-pro-v2"
                    placeholder="e.g. Plumbing, Electric"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  />
                  <button className="btn-primary-v5" onClick={addWorkType} disabled={loadingAction}>
                    {loadingAction ? "Saving..." : "+ Create New Sheet"}
                  </button>
                </div>
              </div>
            </section>

            <section className="master-section-card" style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}>
               <div className="section-header-v3">
                  <h3 className="section-heading-v3">📦 Archive Section</h3>
               </div>
               <div style={{ padding: '24px' }}>
                  <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px' }}>
                    Click below to finalize standard entries for <br /><strong>{formatWeekLabel(site?.currentWeekKey)}</strong>.
                  </p>
                  <button className="btn-archive-v5" onClick={handleArchiveWeek} disabled={loadingAction}>
                    {loadingAction ? "Processing..." : "Archive & Finalize Week"}
                  </button>
               </div>
            </section>
          </aside>

          {/* RIGHT SIDE: REGISTRY WITH SEARCH & PAGINATION */}
          <section className="master-section-card">
            <div className="section-header-v3" style={{ flexWrap: 'wrap', gap: '15px' }}>
              <h3 className="section-heading-v3">📂 Current Sheets ({formatWeekLabel(site?.currentWeekKey)})</h3>
              <input
                type="text"
                className="search-input-v5"
                placeholder="🔍 Search sheets..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="sheets-grid-v5">
              {displayedTypes.map((type) => (
                <div key={type} className="sheet-tile-pro" onClick={() => navigate(`/accountant/site/${siteId}/labour/${type}`)}>
                  <div className="tile-icon">📂</div>
                  <span className="tile-label">{type} Sheet</span>
                  <span className="tile-sub">Tap to open</span>
                </div>
              ))}
              {displayedTypes.length === 0 && (
                <div className="empty-search-v5">No matching sheets found.</div>
              )}
            </div>

            {/* Pagination UI */}
            {totalPages > 1 && (
              <footer className="pagination-footer-v5">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>← Previous</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next →</button>
              </footer>
            )}
          </section>
        </main>
      </div>

      <style>{`
        .btn-primary-v5 {
          background: #2563eb; color: white; border: none; padding: 12px; border-radius: 8px;
          font-weight: 700; cursor: pointer; transition: all 0.2s;
        }
        .btn-primary-v5:hover { background: #1d4ed8; transform: translateY(-1px); }

        .btn-archive-v5 {
          width: 100%; background: #0f172a; color: white; border: none; padding: 14px;
          border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s;
        }
        .btn-archive-v5:hover { background: #1e293b; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

        .search-input-v5 {
          flex: 1; min-width: 200px; padding: 10px 15px; border-radius: 20px;
          border: 1px solid #cbd5e1; outline: none; font-size: 0.85rem;
        }
        .search-input-v5:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }

        .sheets-grid-v5 {
          padding: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px; min-height: 350px;
        }

        .sheet-tile-pro {
          background: #fff; border: 1px solid #e2e8f0; padding: 25px 15px; border-radius: 16px;
          display: flex; flex-direction: column; align-items: center; cursor: pointer;
          transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .sheet-tile-pro:hover { 
          border-color: #2563eb; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(37, 99, 235, 0.08); 
        }
        .tile-icon { font-size: 1.8rem; margin-bottom: 12px; }
        .tile-label { font-weight: 800; color: #1e293b; font-size: 0.95rem; }
        .tile-sub { font-size: 0.7rem; color: #94a3b8; margin-top: 4px; text-transform: uppercase; }

        .pagination-footer-v5 {
          padding: 20px; border-top: 1px solid #f1f5f9; display: flex;
          justify-content: center; align-items: center; gap: 20px;
        }
        .pagination-footer-v5 button {
          background: white; border: 1px solid #e2e8f0; padding: 6px 15px;
          border-radius: 6px; cursor: pointer; font-weight: 600;
        }
        .pagination-footer-v5 button:disabled { opacity: 0.5; cursor: not-allowed; }
        .empty-search-v5 { grid-column: 1 / -1; textAlign: center; padding: 50px; color: #94a3b8; }
      `}</style>
    </Layout>
  );
}

export default LabourIndex;