// src/pages/DealerRegistry.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

function DealerRegistry() {
    const navigate = useNavigate(); 
    const [dealers, setDealers] = useState([]);
    const [newDealer, setNewDealer] = useState({ name: "", phone: "", category: "General" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchDealers = async () => {
            try {
                const q = query(collection(db, "dealers"), orderBy("name", "asc"));
                const snap = await getDocs(q);
                setDealers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error("Fetch Dealers Error:", e);
            }
        };
        fetchDealers();
    }, []);

    const handleAddDealer = async () => {
        if (!newDealer.name.trim()) return;
        try {
            setLoading(true);
            const docRef = await addDoc(collection(db, "dealers"), {
                ...newDealer,
                createdAt: serverTimestamp()
            });
            setDealers([...dealers, { id: docRef.id, ...newDealer }]);
            setNewDealer({ name: "", phone: "", category: "General" });
            showSuccess("New Dealer Registered! ✅");
        } catch (e) { 
            showError(e, "Failed to add dealer"); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <Layout>
            <div className="admin-dashboard">
                {/* 🔥 UPDATED HEADER: Added professional back button */}
                <div className="sticky-back-header-v5">
                  <button className="btn-back-pro" onClick={() => navigate("/accountant/dashboard")}>
                    <span className="back-icon">←</span>
                    <div className="back-text">
                      <span className="back-label">Back to Dashboard</span>
                      <span className="back-sub">Main MIS Overview</span>
                    </div>
                  </button>
                  
                  <div className="engineer-badge-pill">
                    <div className="badge-content-v5">
                      <span className="eng-label-v5">MASTER DATA</span>
                      <h2 className="eng-name-v5">Dealer Registry</h2>
                    </div>
                  </div>
                </div>

                <main className="master-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginTop: '2rem' }}>
                    {/* Left: Add Dealer */}
                    <aside className="master-section-card">
                        <div className="section-header-v3">
                            <h3 className="section-heading-v3">Register New Dealer</h3>
                        </div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Add permanent vendors to track site delivery history and lumpsum payments.
                            </p>
                            <input 
                                className="task-input-pro-v2" 
                                placeholder="Dealer Name (e.g. Gayatri Traders)" 
                                value={newDealer.name} 
                                onChange={e => setNewDealer({ ...newDealer, name: e.target.value })} 
                            />
                            <input 
                                className="task-input-pro-v2" 
                                placeholder="Phone Number" 
                                value={newDealer.phone} 
                                onChange={e => setNewDealer({ ...newDealer, phone: e.target.value })} 
                            />
                            <Button loading={loading} onClick={handleAddDealer}>+ Save Dealer</Button>
                        </div>
                    </aside>

                    {/* Right: Dealer List */}
                    <section className="master-section-card">
                        <div className="section-header-v3">
                            <h3 className="section-heading-v3">Active Dealers List</h3>
                        </div>
                        <div className="master-table-container">
                            <table className="master-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px' }}>Sr.</th>
                                        <th>Dealer Name</th>
                                        <th>Contact</th>
                                        <th style={{ width: '150px' }}>Ledger</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dealers.map((d, idx) => (
                                        <tr key={d.id}>
                                            <td>{idx + 1}</td>
                                            <td><strong style={{ color: '#0f172a' }}>{d.name}</strong></td>
                                            <td style={{ color: '#64748b' }}>{d.phone || "No Contact"}</td>
                                            <td>
                                                <button
                                                    onClick={() => navigate(`/accountant/dealers/${d.id}`)}
                                                    style={{
                                                        color: '#2563eb',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontWeight: 'bold',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '5px 0'
                                                    }}
                                                >
                                                    View Ledger
                                                    <span style={{ fontSize: '1.2rem' }}>→</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {dealers.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                                No dealers registered yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </main>
            </div>

            <style>{`
                .btn-back-pro {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    padding: 8px 16px;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-back-pro:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }
                .back-icon { font-size: 1.2rem; color: #64748b; }
                .back-text { text-align: left; }
                .back-label { display: block; font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }
                .back-sub { font-size: 0.9rem; font-weight: 700; color: #1e293b; }
                .master-table tr:hover { background: #f8fafc; }
            `}</style>
        </Layout>
    );
}

export default DealerRegistry;