import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

// 🔥 Correctly importing the named function
import { exportSnapshotPdf } from "../utils/exportSnapshotPdf";

function DealerLedger() {
  const { dealerId } = useParams();
  const navigate = useNavigate();
  const [dealer, setDealer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [sitesMap, setSitesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    const loadLedger = async () => {
      try {
        setLoading(true);
        const dealerSnap = await getDoc(doc(db, "dealers", dealerId));
        if (!dealerSnap.exists()) return;
        const dData = dealerSnap.data();
        setDealer(dData);

        const sitesSnap = await getDocs(collection(db, "sites"));
        const sMap = {};
        sitesSnap.forEach((d) => { sMap[d.id] = d.data().name; });
        setSitesMap(sMap);

        const q = query(collection(db, "material_entries"), where("dealerName", "==", dData.name));
        const snap = await getDocs(q);

        const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        setTransactions(logs);
      } catch (e) { console.error("Ledger Error:", e); }
      finally { setLoading(false); }
    };
    loadLedger();
  }, [dealerId]);

  const handleUpdatePayment = async (entryId) => {
    try {
      const amount = parseFloat(editValue) || 0;
      const entryRef = doc(db, "material_entries", entryId);
      await updateDoc(entryRef, { paidAmount: amount, lastPaymentUpdate: new Date().toISOString() });
      setTransactions((prev) => prev.map((t) => (t.id === entryId ? { ...t, paidAmount: amount } : t)));
      setEditingId(null);
      showSuccess("Payment updated successfully!");
    } catch (e) { showError(e, "Failed to update payment"); }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const siteName = sitesMap[t.siteId] || "";
      const details = t.details || "";
      return (siteName.toLowerCase().includes(searchTerm.toLowerCase()) || details.toLowerCase().includes(searchTerm.toLowerCase()));
    });
  }, [transactions, searchTerm, sitesMap]);

  const totals = filteredTransactions.reduce((acc, curr) => {
      const bill = curr.qty * curr.rate;
      acc.billed += bill;
      acc.paid += curr.paidAmount || 0;
      return acc;
    }, { billed: 0, paid: 0 });

  const handleDownloadPDF = () => {
    // 🔥 Calling the utility with professional R.P. Construction formatting
    exportSnapshotPdf({
      dealerName: dealer?.name,
      dealerPhone: dealer?.phone || "N/A",
      summary: totals,
      history: filteredTransactions.map((t) => ({
        date: t.date,
        site: sitesMap[t.siteId] || "N/A",
        details: t.details,
        bill: t.qty * t.rate,
        paid: t.paidAmount || 0,
        balance: t.qty * t.rate - (t.paidAmount || 0),
      })),
    });
  };

  if (loading) return <Layout><div style={{ padding: "2rem" }}><SkeletonBox /></div></Layout>;

  return (
    <Layout>
      <div className="admin-dashboard">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate("/accountant/dealers")}>
            <span className="back-icon">←</span>
            <div className="back-text"><span className="back-label">Back to Dealer List</span></div>
          </button>
          <div className="engineer-badge-pill">
            <div className="badge-content-v5">
              <span className="eng-label-v5">DEALER STATEMENT</span>
              <h2 className="eng-name-v5">{dealer?.name}</h2>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1.5rem", background: "white", padding: "15px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", gap: "15px", alignItems: "center" }}>
          <span style={{ fontSize: "1.2rem" }}>🔍</span>
          <input type="text" placeholder="Search by Site Name or Material..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", border: "none", outline: "none", fontSize: "1rem", fontWeight: "600" }} />
        </div>

        <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginTop: "1.5rem" }}>
          <div className="config-card-pro" style={{ borderLeft: "4px solid #64748b" }}>
            <div className="card-header-v3"><h3 style={{ fontSize: "0.8rem" }}>TOTAL BILLED</h3></div>
            <div className="config-body-v3"><h2>₹ {totals.billed.toLocaleString("en-IN")}</h2></div>
          </div>
          <div className="config-card-pro" style={{ borderLeft: "4px solid #10b981" }}>
            <div className="card-header-v3"><h3 style={{ fontSize: "0.8rem" }}>TOTAL PAID</h3></div>
            <div className="config-body-v3"><h2>₹ {totals.paid.toLocaleString("en-IN")}</h2></div>
          </div>
          <div className="config-card-pro" style={{ borderLeft: "4px solid #dc2626" }}>
            <div className="card-header-v3"><h3 style={{ fontSize: "0.8rem" }}>OUTSTANDING</h3></div>
            <div className="config-body-v3"><h2 style={{ color: "#dc2626" }}>₹ {(totals.billed - totals.paid).toLocaleString("en-IN")}</h2></div>
          </div>
        </div>

        <div className="master-section-card" style={{ marginTop: "2rem" }}>
          <div className="section-header-v3">
            <h3 className="section-heading-v3">Bill & Payment History</h3>
            <button onClick={handleDownloadPDF} className="btn-muted-action" style={{ background: '#0f172a', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
              📄 Export PDF Report
            </button>
          </div>
          <div className="master-table-container">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Site Name</th>
                  <th>Material Details</th>
                  <th className="text-right">Bill Amt</th>
                  <th className="text-right" style={{ width: "180px" }}>Paid Amt</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => {
                  const bill = t.qty * t.rate;
                  const paid = t.paidAmount || 0;
                  const balance = bill - paid;
                  const isEditing = editingId === t.id;
                  const isFullyPaid = balance === 0 && bill > 0;

                  return (
                    <tr key={t.id} className={isFullyPaid ? "row-cleared" : ""} style={{ backgroundColor: isFullyPaid ? "#f0fdf4" : "inherit", transition: "background-color 0.3s ease" }}>
                      <td style={{ fontSize: "0.85rem" }}>{t.date}</td>
                      <td><strong style={{ color: "#2563eb" }}>{sitesMap[t.siteId] || "Unknown"}</strong></td>
                      <td>{t.details}</td>
                      <td className="text-right">₹ {bill.toLocaleString("en-IN")}</td>
                      <td className="text-right">
                        {isEditing ? (
                          <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
                            <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} style={{ width: "100px", padding: "4px", borderRadius: "4px", border: "1px solid #2563eb" }} autoFocus />
                            <button onClick={() => handleUpdatePayment(t.id)} style={{ background: "#10b981", color: "white", border: "none", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}>✓</button>
                            <button onClick={() => setEditingId(null)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}>✕</button>
                          </div>
                        ) : (
                          <div onClick={() => { setEditingId(t.id); setEditValue(paid); }} style={{ cursor: "pointer", color: isFullyPaid ? "#166534" : "#059669", fontWeight: "700", borderBottom: "1px dashed #059669", display: "inline-block" }}>
                            ₹ {paid.toLocaleString("en-IN")}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <strong style={{ color: isFullyPaid ? "#166534" : "inherit" }}>₹ {balance.toLocaleString("en-IN")}</strong>
                        {isFullyPaid && <span style={{ marginLeft: "8px", fontSize: "0.8rem" }}>✅</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style>{`
        .row-cleared { border-left: 5px solid #22c55e !important; }
      `}</style>
    </Layout>
  );
}

export default DealerLedger;