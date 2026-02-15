// src/pages/DealerRegistry.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc, // 🔥 Added for delete
  doc, // 🔥 Added for delete
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

function DealerRegistry() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [newDealer, setNewDealer] = useState({
    name: "",
    phone: "",
    category: "General",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDealers = async () => {
      try {
        const q = query(collection(db, "dealers"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        setDealers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Fetch Dealers Error:", e);
      }
    };
    fetchDealers();
  }, []);

  // 🔥 NEW: Delete Handler with confirmation
  const handleDeleteDealer = async (dealerId, dealerName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${dealerName}? This cannot be undone.`,
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "dealers", dealerId));
      setDealers(dealers.filter((d) => d.id !== dealerId));
      showSuccess(`${dealerName} removed from registry.`);
    } catch (e) {
      showError(e, "Failed to delete dealer");
    }
  };

  const handleAddDealer = async () => {
    if (!newDealer.name.trim()) return;
    try {
      setLoading(true);
      const docRef = await addDoc(collection(db, "dealers"), {
        ...newDealer,
        createdAt: serverTimestamp(),
      });
      setDealers(
        [...dealers, { id: docRef.id, ...newDealer }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
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
        <div className="sticky-back-header-v5">
          <button
            className="btn-back-pro"
            onClick={() => navigate("/accountant/dashboard")}
          >
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

        <main className="master-grid-v2">
          <aside className="registry-card create-card">
            <div className="create-card-accent"></div>
            <div className="card-inner-container">
              <div className="card-form-scroll">
                <div className="card-header-minimal">
                  <span className="category-tag">Vendor Entry</span>
                  <h3 className="card-title-main">Register Dealer</h3>
                  <p className="card-desc">
                    Add a new supplier to the R.P. Construction network.
                  </p>
                </div>

                <div className="form-stack">
                  <div className="input-wrapper-pro">
                    <label>Dealer / Vendor Name</label>
                    <div className="input-field-container">
                      <span className="field-icon">🏢</span>
                      <input
                        type="text"
                        placeholder="e.g. Gayatri Traders"
                        value={newDealer.name}
                        onChange={(e) =>
                          setNewDealer({ ...newDealer, name: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="input-wrapper-pro">
                    <label>Contact Number</label>
                    <div className="input-field-container">
                      <span className="field-icon">📞</span>
                      <input
                        type="tel"
                        placeholder="9999999999"
                        value={newDealer.phone}
                        onChange={(e) =>
                          setNewDealer({ ...newDealer, phone: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-footer-action">
                <button
                  className={`btn-submit-dealer ${loading ? "loading" : ""}`}
                  onClick={handleAddDealer}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Add Vendor to Database"}
                </button>
              </div>
            </div>
          </aside>

          <section className="registry-card list-card">
            <div className="card-header-v4">
              <h3 className="card-heading-v4">
                Active Dealers ({dealers.length})
              </h3>
            </div>
            <div className="table-wrapper-v2">
              <table className="master-table-v2">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>Sr.</th>
                    <th>Dealer Name</th>
                    <th>Contact</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dealers.map((d, idx) => (
                    <tr key={d.id}>
                      <td className="sr-no">{idx + 1}</td>
                      <td>
                        <strong style={{ color: "#0f172a" }}>{d.name}</strong>
                      </td>
                      <td className="contact-cell">{d.phone || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            className="btn-view-ledger"
                            onClick={() =>
                              navigate(`/accountant/dealers/${d.id}`)
                            }
                          >
                            View Ledger
                          </button>
                          {/* 🔥 DELETE BUTTON */}
                          <button
                            className="btn-delete-dealer"
                            onClick={() => handleDeleteDealer(d.id, d.name)}
                            title="Delete Dealer"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      <style>{`
                .master-grid-v2 {
                    display: grid;
                    grid-template-columns: 380px 1fr;
                    gap: 2.5rem;
                    margin-top: 2rem;
                    align-items: start;
                }

                .registry-card.create-card {
                    background: #ffffff;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
                    max-height: 550px;
                    display: flex;
                    flex-direction: column;
                }

                .card-inner-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
                .card-form-scroll { padding: 30px; overflow-y: auto; flex: 1; }
                .card-footer-action { padding: 20px 30px; background: #f8fafc; border-top: 1px solid #f1f5f9; }
                .create-card-accent { height: 6px; background: linear-gradient(90deg, #0f172a 0%, #2563eb 100%); width: 100%; }

                .card-header-minimal { margin-bottom: 25px; }
                .category-tag { font-size: 0.65rem; font-weight: 900; color: #2563eb; background: #eff6ff; padding: 4px 10px; border-radius: 50px; }
                .card-title-main { font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 10px 0 5px 0; }
                .card-desc { font-size: 0.85rem; color: #64748b; }

                .form-stack { display: flex; flex-direction: column; gap: 20px; }
                .input-wrapper-pro label { display: block; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 8px; }
                .input-field-container { display: flex; align-items: center; background: #f8fafc; border: 2px solid #f1f5f9; border-radius: 12px; padding: 0 15px; }
                .input-field-container input { border: none; background: transparent; padding: 14px 12px; width: 100%; font-weight: 700; outline: none; }

                .btn-submit-dealer { background: #0f172a; color: white; border: none; padding: 16px; border-radius: 12px; font-weight: 800; width: 100%; cursor: pointer; }
                
                .registry-card.list-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; }
                .master-table-v2 { width: 100%; border-collapse: collapse; }
                .master-table-v2 th { text-align: left; padding: 15px 25px; background: #f8fafc; color: #64748b; font-size: 0.75rem; text-transform: uppercase; }
                .master-table-v2 td { padding: 18px 25px; border-bottom: 1px solid #f1f5f9; }

                .btn-view-ledger { background: #eff6ff; color: #2563eb; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
                
                /* 🔥 DELETE BUTTON STYLE */
                .btn-delete-dealer { 
                  background: #fff1f2; 
                  border: 1px solid #fecdd3; 
                  padding: 8px; 
                  border-radius: 8px; 
                  cursor: pointer; 
                  transition: all 0.2s;
                }
                .btn-delete-dealer:hover { background: #ffe4e6; border-color: #fda4af; transform: scale(1.05); }

                @media (max-width: 1024px) {
                    .master-grid-v2 { grid-template-columns: 1fr; }
                }
            `}</style>
    </Layout>
  );
}

export default DealerRegistry;
