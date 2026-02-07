// src/pages/MaterialSheet.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

const MARATHI_DAYS = ["रविवार", "सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];

// 🔥 HELPER: Get Week Key from Date (Matches your system format: YYYY-Www)
const getWeekKeyFromDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

function MaterialSheet() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  const historyWeek = queryParams.get("week");

  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  const [rows, setRows] = useState([]);
  const [dealers, setDealers] = useState([]);

  useEffect(() => {
    const loadMaterialData = async () => {
      try {
        const siteSnap = await getDoc(doc(db, "sites", siteId));
        if (siteSnap.exists()) {
          const siteData = siteSnap.data();
          setSite({ id: siteSnap.id, ...siteData });

          const targetWeek = historyWeek || siteData.currentWeekKey;
          if (historyWeek && historyWeek !== siteData.currentWeekKey) setIsReadOnly(true);

          const q = query(
            collection(db, "material_entries"),
            where("siteId", "==", siteId),
            where("weekKey", "==", targetWeek)
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            const existingData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (!historyWeek) {
              const lastSaved = existingData[0]?.updatedAt?.toDate();
              if (lastSaved && Math.ceil(Math.abs(new Date() - lastSaved) / (1000 * 60 * 60 * 24)) > 30) {
                setIsLocked(true);
              }
            }
            setRows(existingData);
          } else if (!historyWeek) {
            addNewRow();
          }
        }

        const dealerSnap = await getDocs(query(collection(db, "dealers"), orderBy("name", "asc")));
        setDealers(dealerSnap.docs.map(d => d.data().name));

      } catch (e) {
        showError(e, "Failed to load material sheet");
      } finally {
        setLoading(false);
      }
    };
    loadMaterialData();
  }, [siteId, historyWeek]);

  const addNewRow = () => {
    if (isReadOnly || isLocked) return;
    const today = new Date();
    setRows([...rows, { 
      id: `temp_${Date.now()}_${Math.random()}`, 
      dayName: MARATHI_DAYS[today.getDay()], 
      date: today.toISOString().split('T')[0], 
      details: "", 
      dealerName: "", 
      qty: 0, 
      rate: 0,
      paidAmount: 0 
    }]);
  };

  const removeRow = (index) => {
    if (isReadOnly || isLocked) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleInputChange = (index, field, value) => {
    if (isLocked || isReadOnly) return;
    const updatedRows = [...rows];
    
    if (field === 'date') {
      // 🔥 UPDATED WEEK GUARD LOGIC
      const selectedDate = new Date(value);
      const selectedWeekKey = getWeekKeyFromDate(selectedDate);

      // Compare selected date's week with Site's Current Week
      if (selectedWeekKey !== site.currentWeekKey) {
         alert(`Wrong Week! This date belongs to ${selectedWeekKey}, but the site is currently on ${site.currentWeekKey}. Please "Create New Week" in the Registry first.`);
         return;
      }

      updatedRows[index].dayName = MARATHI_DAYS[selectedDate.getDay()];
      updatedRows[index].date = value;
    } else if (['qty', 'rate', 'paidAmount'].includes(field)) {
      updatedRows[index][field] = value === "" ? 0 : parseFloat(value);
    } else {
      updatedRows[index][field] = value;
    }
    setRows(updatedRows);
  };

  const totals = useMemo(() => {
    return rows.reduce((acc, row) => {
      const bill = row.qty * row.rate;
      acc.grandTotal += bill;
      acc.totalPaid += (row.paidAmount || 0);
      return acc;
    }, { grandTotal: 0, totalPaid: 0 });
  }, [rows]);

  const saveSheet = async () => {
    if (isLocked || isReadOnly) return;
    try {
      setSaving(true);
      const batch = writeBatch(db);
      const weekKey = site.currentWeekKey;

      rows.forEach((row) => {
        const docId = row.id.toString().startsWith('temp_') 
          ? `${siteId}_${weekKey}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` 
          : row.id;
        const docRef = doc(db, "material_entries", docId);
        
        batch.set(docRef, {
          dayName: row.dayName,
          date: row.date,
          details: row.details,
          dealerName: row.dealerName,
          qty: row.qty,
          rate: row.rate,
          paidAmount: row.paidAmount || 0,
          siteId,
          weekKey,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      showSuccess("Material Sheet Saved ✅");
      navigate(`/accountant/site/${siteId}/material`);
    } catch (e) {
      showError(e, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="admin-dashboard material-page-container">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate(`/accountant/site/${siteId}/material`)}>
            <span className="back-icon">←</span>
            <div className="back-text">
                <span className="back-label">Back to Material Registry</span>
                <span className="back-sub">{isReadOnly ? "View History Mode" : "Live Entry Mode"}</span>
            </div>
          </button>
          <div className="engineer-badge-pill">
            <div className="badge-content-v5">
              <span className="eng-label-v5">मटेरियल एन्ट्री (With Dealer & Payment)</span>
              <h2 className="eng-name-v5">{site?.name}</h2>
            </div>
          </div>
          {isReadOnly && (
            <button className="btn-logout-v5" onClick={() => window.print()} style={{marginLeft: 'auto', background: '#f8fafc', color: '#1e293b'}}>🖨️ Print</button>
          )}
        </div>

        <datalist id="dealer-list">
          {dealers.map((name, i) => <option key={i} value={name} />)}
        </datalist>

        <div className="master-table-container desktop-view" style={{marginTop: '20px'}}>
          <table className="master-table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>तारीख (Date)</th>
                <th>तपशील (Details)</th>
                <th style={{ width: '180px' }}>डिलीर (Dealer)</th>
                <th style={{ width: '90px' }}>ब्रास/नग</th>
                <th style={{ width: '100px' }}>दर (Rate)</th>
                <th style={{ width: '120px' }}>एकूण (Bill)</th>
                <th style={{ width: '120px', color: '#059669' }}>पेड (Paid)</th>
                {!isReadOnly && <th style={{ width: '40px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    {isReadOnly ? <span>{row.date} <br/><small>{row.dayName}</small></span> : 
                    <input type="date" disabled={isLocked} className="sheet-input-text" value={row.date} onChange={(e) => handleInputChange(index, 'date', e.target.value)} />}
                  </td>
                  <td>
                    {isReadOnly ? <span>{row.details}</span> :
                    <input type="text" disabled={isLocked} className="sheet-input-text" value={row.details} onChange={(e) => handleInputChange(index, 'details', e.target.value)} placeholder="Cement..." />}
                  </td>
                  <td>
                    {isReadOnly ? <span style={{fontWeight: '700'}}>{row.dealerName || "Local"}</span> :
                    <input type="text" list="dealer-list" disabled={isLocked} className="sheet-input-text" value={row.dealerName} onChange={(e) => handleInputChange(index, 'dealerName', e.target.value)} placeholder="Search or Type..." />}
                  </td>
                  <td>
                    {isReadOnly ? <span>{row.qty}</span> :
                    <input type="number" disabled={isLocked} className="sheet-input-num" value={row.qty} onChange={(e) => handleInputChange(index, 'qty', e.target.value)} />}
                  </td>
                  <td>
                    {isReadOnly ? <span>{row.rate}</span> :
                    <input type="number" disabled={isLocked} className="sheet-input-num" value={row.rate} onChange={(e) => handleInputChange(index, 'rate', e.target.value)} />}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹ {(row.qty * row.rate).toLocaleString('en-IN')}</td>
                  <td>
                    {isReadOnly ? <span style={{color: '#059669', fontWeight: '800'}}>₹ {row.paidAmount || 0}</span> :
                    <input type="number" disabled={isLocked} className="sheet-input-num payment-input" value={row.paidAmount} onChange={(e) => handleInputChange(index, 'paidAmount', e.target.value)} placeholder="Amount Paid" />}
                  </td>
                  {!isReadOnly && (
                    <td>
                      {!isLocked && <button onClick={() => removeRow(index)} style={{background:'none', border:'none', cursor:'pointer'}}>❌</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          
          {!isLocked && !isReadOnly && (
            <button className="btn-add-row" onClick={addNewRow}>+ Add New Material Row</button>
          )}
        </div>

        <div className="sheet-actions-footer">
          <div className="footer-summary-grid">
            <div className="summary-item">
               <span className="label">Grand Total:</span>
               <span className="val">₹ {totals.grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="summary-item">
               <span className="label" style={{color: '#059669'}}>Total Paid:</span>
               <span className="val" style={{color: '#059669'}}>₹ {totals.totalPaid.toLocaleString('en-IN')}</span>
            </div>
            <div className="summary-item">
               <span className="label" style={{color: '#dc2626'}}>Pending:</span>
               <span className="val" style={{color: '#dc2626'}}>₹ {(totals.grandTotal - totals.totalPaid).toLocaleString('en-IN')}</span>
            </div>
          </div>
          {!isLocked && !isReadOnly && <Button loading={saving} onClick={saveSheet}>💾 Save Material & Payments</Button>}
        </div>
      </div>

      <style>{`
        .btn-add-row { width: 100%; padding: 15px; margin-top: 10px; background: #f8fafc; border: 2px dashed #cbd5e1; color: #64748b; font-weight: 700; border-radius: 8px; cursor: pointer; }
        .sheet-input-num, .sheet-input-text { width: 100%; border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; text-align: center; }
        .payment-input { border-color: #10b981 !important; background: #f0fdf4; color: #065f46; font-weight: 700; }
        .sheet-actions-footer { margin-top: 2rem; padding: 25px; background: #f1f5f9; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }
        .footer-summary-grid { display: flex; gap: 30px; }
        .summary-item { display: flex; flex-direction: column; }
        .summary-item .label { font-size: 0.8rem; font-weight: 800; text-transform: uppercase; }
        .summary-item .val { font-size: 1.4rem; font-weight: 900; }
        @media print { .sticky-back-header-v5, .btn-add-row, .sheet-actions-footer button { display: none !important; } }
      `}</style>
    </Layout>
  );
}

export default MaterialSheet;