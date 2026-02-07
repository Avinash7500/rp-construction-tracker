// src/pages/MaterialIndex.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

const formatWeekLabel = (weekKey) => {
    if (!weekKey) return "N/A";
    try {
        const [year, weekPart] = weekKey.split("-W");
        const weekNum = parseInt(weekPart);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const weekOfMonth = (weekNum % 4) || 4;
        const monthIndex = Math.floor((weekNum - 1) / 4.34);
        return `${weekOfMonth} Week - ${monthNames[monthIndex % 12]}`;
    } catch (e) { return weekKey; }
};

function MaterialIndex() {
    const { siteId } = useParams();
    const navigate = useNavigate();
    const [site, setSite] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPopup, setShowPopup] = useState(false);
    const [selectedWeekData, setSelectedWeekData] = useState([]);
    const [viewingWeekLabel, setViewingWeekLabel] = useState("");

    useEffect(() => {
        const loadData = async () => {
            try {
                const siteSnap = await getDoc(doc(db, "sites", siteId));
                if (siteSnap.exists()) setSite(siteSnap.data());

                const q = query(collection(db, "material_entries"), where("siteId", "==", siteId));
                const snap = await getDocs(q);
                const matMap = {};
                snap.docs.forEach(d => {
                    const data = d.data();
                    if (!matMap[data.weekKey]) matMap[data.weekKey] = { weekKey: data.weekKey, total: 0, items: [] };
                    matMap[data.weekKey].total += (data.qty * data.rate);
                    matMap[data.weekKey].items.push(data);
                });
                setHistory(Object.values(matMap).sort((a, b) => b.weekKey.localeCompare(a.weekKey)));
            } catch (e) { showError(e, "Load failed"); }
            finally { setLoading(false); }
        };
        loadData();
    }, [siteId]);

    const handleStartNextWeek = async () => {
        if (!window.confirm("Are you sure you want to close this week and start the NEXT week?")) return;
        try {
            const currentKey = site.currentWeekKey;
            const [year, weekNum] = currentKey.split("-W");
            const nextWeekNum = String(parseInt(weekNum) + 1).padStart(2, '0');
            const nextWeekKey = `${year}-W${nextWeekNum}`;

            await updateDoc(doc(db, "sites", siteId), {
                currentWeekKey: nextWeekKey
            });

            setSite({ ...site, currentWeekKey: nextWeekKey });
            showSuccess(`New Week ${nextWeekKey} Started! 🚀`);
        } catch (e) { showError(e, "Failed to start next week"); }
    };

    const openHistoryPopup = (group) => {
        setSelectedWeekData(group.items);
        setViewingWeekLabel(group.weekKey);
        setShowPopup(true);
    };

    return (
        <Layout>
            <div className="admin-dashboard">
                <div className="sticky-back-header-v5">
                    <button className="btn-back-pro" onClick={() => navigate(`/accountant/site/${siteId}`)}>
                        <span className="back-icon">←</span>
                        <div className="back-text"><span className="back-label">Back to Site Summary</span></div>
                    </button>
                    <div className="engineer-badge-pill">
                        <div className="badge-content-v5">
                            <span className="eng-label-v5">Material Registry</span>
                            <h2 className="eng-name-v5">{site?.name}</h2>
                        </div>
                    </div>
                </div>

                {/* 🔥 UPDATED GRID: Narrow sidebar (320px) and wide content (1fr) */}
                <main className="master-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                    
                    {/* LEFT SIDEBAR: Compact boxes */}
                    <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        <section className="master-section-card sidebar-box-v5">
                            <div className="section-header-v3" style={{padding: '12px 15px'}}>
                                <h3 className="section-heading-v3" style={{fontSize: '0.9rem'}}>📦 Week Control</h3>
                            </div>
                            <div style={{ padding: '15px' }}>
                                <p style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '10px' }}>
                                    Current Active: <strong>{formatWeekLabel(site?.currentWeekKey)}</strong>
                                </p>
                                <button className="btn-archive-v5" onClick={handleStartNextWeek} style={{ width: '100%', background: '#059669', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    🚀 Create New Week Sheet
                                </button>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '8px', lineHeight: '1.4' }}>
                                    Clicking moves the project to the next weekly cycle.
                                </p>
                            </div>
                        </section>

                        <section className="master-section-card sidebar-box-v5">
                            <div className="section-header-v3" style={{padding: '12px 15px'}}>
                                <h3 className="section-heading-v3" style={{fontSize: '0.9rem'}}>📊 Export Center</h3>
                            </div>
                            <div style={{ padding: '15px' }}>
                                <button onClick={() => window.print()} style={{ width: '100%', background: '#3b82f6', color: 'white', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    📄 Export Monthly Summary (PDF)
                                </button>
                            </div>
                        </section>
                    </aside>

                    {/* RIGHT CONTENT: Wide history table */}
                    <section className="master-section-card">
                        <div className="section-header-v3">
                            <h3 className="section-heading-v3">🚚 Material History Table</h3>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div className="sheet-tile-pro" onClick={() => navigate(`/accountant/site/${siteId}/material-sheet`)} style={{ cursor: 'pointer', border: '1px solid #e2e8f0', padding: '25px', borderRadius: '16px', textAlign: 'center', background: '#f8fafc', marginBottom: '2rem' }}>
                                <div style={{ fontSize: '1.8rem' }}>🚚</div>
                                <div style={{ fontWeight: '800', marginTop: '8px' }}>Open Live Entry Sheet</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Currently: {formatWeekLabel(site?.currentWeekKey)}</div>
                            </div>

                            <h4 style={{ marginBottom: '1rem', color: '#475569', fontSize: '1rem' }}>Past Weekly Reports</h4>
                            <div className="master-table-container">
                                <table className="master-table">
                                    <thead>
                                        <tr>
                                            <th>Week Period</th>
                                            <th style={{ textAlign: 'right' }}>Total Spend</th>
                                            <th style={{ textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item) => (
                                            <tr key={item.weekKey}>
                                                <td><strong>{formatWeekLabel(item.weekKey)}</strong></td>
                                                <td style={{ textAlign: 'right', fontWeight: '700' }}>₹ {item.total.toLocaleString('en-IN')}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button onClick={() => openHistoryPopup(item)} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '6px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}>
                                                       View Report
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </main>
            </div>

            {showPopup && (
                <div className="modal-overlay" onClick={() => setShowPopup(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{margin:0}}>Report: {formatWeekLabel(viewingWeekLabel)}</h3>
                            <button className="close-btn" onClick={() => setShowPopup(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <table className="master-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Dealer</th>
                                        <th>Details</th>
                                        <th style={{textAlign:'right'}}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedWeekData.map((item, i) => (
                                        <tr key={i}>
                                            <td>{item.date}</td>
                                            <td><strong>{item.dealerName || "Local"}</strong></td>
                                            <td>{item.details}</td>
                                            <td style={{textAlign:'right', fontWeight:'700'}}>₹ {(item.qty * item.rate).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => window.print()} className="btn-primary-v5">🖨️ Print to PDF</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .sidebar-box-v5 { border: 1px solid #e2e8f0; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
                .master-table tr:hover { background: #f8fafc; }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; }
                .modal-content { background: white; width: 90%; max-width: 850px; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
                .modal-header { padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .close-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #64748b; }
                .modal-body { padding: 20px; max-height: 60vh; overflow-y: auto; }
                .modal-footer { padding: 20px; border-top: 1px solid #e2e8f0; text-align: right; }
                @media (max-width: 1024px) {
                    .master-grid { grid-template-columns: 1fr !important; }
                }
                @media print { .sticky-back-header-v5, aside, .sheet-tile-pro, .modal-header .close-btn { display: none !important; } .master-grid { grid-template-columns: 1fr !important; } }
            `}</style>
        </Layout>
    );
}

export default MaterialIndex;