// src/pages/DealerLedger.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";

function DealerLedger() {
  const { dealerId } = useParams();
  const navigate = useNavigate();
  const [dealer, setDealer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [sitesMap, setSitesMap] = useState({}); // 🔥 To convert Site ID to Name
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); // 🔥 Search State

  useEffect(() => {
    const loadLedger = async () => {
      try {
        setLoading(true);
        // 1. Get Dealer Info
        const dealerSnap = await getDoc(doc(db, "dealers", dealerId));
        if (!dealerSnap.exists()) return;
        const dData = dealerSnap.data();
        setDealer(dData);

        // 2. Fetch All Sites to build a Name Map
        const sitesSnap = await getDocs(collection(db, "sites"));
        const sMap = {};
        sitesSnap.forEach(d => { sMap[d.id] = d.data().name; });
        setSitesMap(sMap);

        // 3. Fetch all material entries for this dealer
        const q = query(collection(db, "material_entries"), where("dealerName", "==", dData.name));
        const snap = await getDocs(q);
        
        const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => new Date(b.date) - new Date(a.date));

        setTransactions(logs);
      } catch (e) { console.error("Ledger Error:", e); }
      finally { setLoading(false); }
    };
    loadLedger();
  }, [dealerId]);

  // 🔥 FILTER LOGIC: Search by Site Name or Material Details
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const siteName = sitesMap[t.siteId] || "";
      const details = t.details || "";
      return siteName.toLowerCase().includes(searchTerm.toLowerCase()) || 
             details.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [transactions, searchTerm, sitesMap]);

  const totals = filteredTransactions.reduce((acc, curr) => {
    const bill = curr.qty * curr.rate;
    acc.billed += bill;
    acc.paid += (curr.paidAmount || 0);
    return acc;
  }, { billed: 0, paid: 0 });

  if (loading) return <Layout><div style={{padding: '2rem'}}><SkeletonBox /></div></Layout>;

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

        {/* SEARCH BAR */}
        <div style={{ marginTop: '1.5rem', background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by Site Name or Material (e.g. Cement, Sand)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1rem', fontWeight: '600' }}
          />
        </div>

        {/* SUMMARY CARDS (updates based on search) */}
        <div className="detail-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '1.5rem'}}>
          <div className="config-card-pro" style={{borderLeft: '4px solid #64748b'}}>
            <div className="card-header-v3"><h3 style={{fontSize: '0.8rem'}}>TOTAL BILLED</h3></div>
            <div className="config-body-v3"><h2>₹ {totals.billed.toLocaleString('en-IN')}</h2></div>
          </div>
          <div className="config-card-pro" style={{borderLeft: '4px solid #10b981'}}>
            <div className="card-header-v3"><h3 style={{fontSize: '0.8rem'}}>TOTAL PAID</h3></div>
            <div className="config-body-v3"><h2>₹ {totals.paid.toLocaleString('en-IN')}</h2></div>
          </div>
          <div className="config-card-pro" style={{borderLeft: '4px solid #dc2626'}}>
            <div className="card-header-v3"><h3 style={{fontSize: '0.8rem'}}>OUTSTANDING</h3></div>
            <div className="config-body-v3"><h2 style={{color: '#dc2626'}}>₹ {(totals.billed - totals.paid).toLocaleString('en-IN')}</h2></div>
          </div>
        </div>

        {/* TRANSACTION TABLE */}
        <div className="master-section-card" style={{marginTop: '2rem'}}>
          <div className="section-header-v3">
            <h3 className="section-heading-v3">Bill & Payment History</h3>
            <button onClick={() => window.print()} className="btn-muted-action">🖨️ Print Report</button>
          </div>
          <div className="master-table-container">
            <table className="master-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Site Name</th>
                  <th>Material Details</th>
                  <th className="text-right">Bill Amt</th>
                  <th className="text-right">Paid Amt</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => {
                  const bill = t.qty * t.rate;
                  const paid = t.paidAmount || 0;
                  return (
                    <tr key={t.id}>
                      <td style={{fontSize: '0.85rem'}}>{t.date}</td>
                      <td><strong style={{color: '#2563eb'}}>{sitesMap[t.siteId] || "Unknown Site"}</strong></td>
                      <td>{t.details}</td>
                      <td className="text-right">₹ {bill.toLocaleString('en-IN')}</td>
                      <td className="text-right" style={{color: '#059669', fontWeight: '700'}}>₹ {paid.toLocaleString('en-IN')}</td>
                      <td className="text-right" style={{fontWeight: '800'}}>₹ {(bill - paid).toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default DealerLedger;