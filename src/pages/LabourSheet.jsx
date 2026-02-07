// src/pages/LabourSheet.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

const MARATHI_DAYS = ["सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"];

function LabourSheet() {
  const { siteId, workType } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // 🔥 30-Day Lock State

  const [rows, setRows] = useState(
    MARATHI_DAYS.map((day) => ({
      dayName: day,
      details: "",
      mistriCount: 0,
      mistriRate: 0,
      labourCount: 0,
      labourRate: 0,
    }))
  );

  useEffect(() => {
    const loadSheetData = async () => {
      try {
        const siteSnap = await getDoc(doc(db, "sites", siteId));
        if (siteSnap.exists()) {
          const siteData = siteSnap.data();
          setSite({ id: siteSnap.id, ...siteData });

          const q = query(
            collection(db, "labour_entries"),
            where("siteId", "==", siteId),
            where("weekKey", "==", siteData.currentWeekKey),
            where("workType", "==", workType)
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            const existingData = snap.docs.map(d => d.data());
            
            // 🔥 CHECK FOR LOCK
            const lastSaved = existingData[0]?.updatedAt?.toDate();
            if (lastSaved) {
              const diffDays = Math.ceil(Math.abs(new Date() - lastSaved) / (1000 * 60 * 60 * 24));
              if (diffDays > 30) setIsLocked(true);
            }

            const mergedRows = MARATHI_DAYS.map(day => {
              const found = existingData.find(d => d.dayName === day);
              return found || { dayName: day, details: "", mistriCount: 0, mistriRate: 0, labourCount: 0, labourRate: 0 };
            });
            setRows(mergedRows);
          }
        }
      } catch (e) {
        showError(e, "Error loading sheet");
      } finally {
        setLoading(false);
      }
    };
    loadSheetData();
  }, [siteId, workType]);

  const handleInputChange = (index, field, value) => {
    if (isLocked) return;
    const updatedRows = [...rows];
    if (field !== 'details') {
        updatedRows[index][field] = value === "" ? 0 : parseFloat(value);
    } else {
        updatedRows[index][field] = value;
    }
    setRows(updatedRows);
  };

  const grandTotal = useMemo(() => {
    return rows.reduce((acc, row) => acc + (row.mistriCount * row.mistriRate) + (row.labourCount * row.labourRate), 0);
  }, [rows]);

  const saveSheet = async () => {
    if (isLocked) return;
    try {
      setSaving(true);
      const batch = writeBatch(db);
      const weekKey = site.currentWeekKey;

      rows.forEach((row) => {
        const docId = `${siteId}_${weekKey}_${workType}_${row.dayName}`;
        const docRef = doc(db, "labour_entries", docId);
        batch.set(docRef, { ...row, siteId, weekKey, workType, updatedAt: serverTimestamp() }, { merge: true });
      });

      await batch.commit();
      showSuccess("Sheet saved successfully ✅");
      navigate(`/accountant/site/${siteId}/labour`);
    } catch (e) {
      showError(e, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div style={{padding:'20px'}}>Loading Excel Sheet...</div></Layout>;

  return (
    <Layout>
      <div className="admin-dashboard labour-page-container">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate(`/accountant/site/${siteId}/labour`)}>
            <span className="back-icon">←</span>
            <div className="back-text">
                <span className="back-label">Back to Index</span>
                <span className="back-sub">{workType} List</span>
            </div>
          </button>
          <div className="engineer-badge-pill">
            <div className="badge-content-v5">
              <span className="eng-label-v5">लेबर शीट {isLocked && "(LOCKED)"}</span>
              <h2 className="eng-name-v5">{workType}</h2>
            </div>
          </div>
        </div>

        {isLocked && (
          <div style={{ background: '#fff1f2', color: '#e11d48', padding: '12px', borderRadius: '10px', marginBottom: '15px', textAlign: 'center', border: '1px solid #fda4af' }}>
            🔒 Entry Locked: Financial records older than 30 days cannot be modified.
          </div>
        )}

        {/* --- DESKTOP VIEW --- */}
        <div className="master-table-container desktop-view">
          <table className="master-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>वार (Day)</th>
                <th>तपशील (Details)</th>
                <th style={{ width: '80px' }}>मिस्त्री</th>
                <th style={{ width: '100px' }}>पगार (Rate)</th>
                <th style={{ width: '80px' }}>लेबर</th>
                <th style={{ width: '100px' }}>पगार (Rate)</th>
                <th style={{ width: '120px', textAlign: 'right' }}>एकूण (Total)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const dayTotal = (row.mistriCount * row.mistriRate) + (row.labourCount * row.labourRate);
                return (
                  <tr key={index}>
                    <td><strong>{row.dayName}</strong></td>
                    <td>
                      <input type="text" disabled={isLocked} className="sheet-input-text" value={row.details} onChange={(e) => handleInputChange(index, 'details', e.target.value)} placeholder="Work details..." />
                    </td>
                    <td><input type="number" disabled={isLocked} className="sheet-input-num" value={row.mistriCount} onChange={(e) => handleInputChange(index, 'mistriCount', e.target.value)} /></td>
                    <td><input type="number" disabled={isLocked} className="sheet-input-num" value={row.mistriRate} onChange={(e) => handleInputChange(index, 'mistriRate', e.target.value)} /></td>
                    <td><input type="number" disabled={isLocked} className="sheet-input-num" value={row.labourCount} onChange={(e) => handleInputChange(index, 'labourCount', e.target.value)} /></td>
                    <td><input type="number" disabled={isLocked} className="sheet-input-num" value={row.labourRate} onChange={(e) => handleInputChange(index, 'labourRate', e.target.value)} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹ {dayTotal.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* --- MOBILE VIEW --- */}
        <div className="mobile-view-list">
          {rows.map((row, index) => {
            const dayTotal = (row.mistriCount * row.mistriRate) + (row.labourCount * row.labourRate);
            return (
              <div key={index} className="labour-mobile-card">
                <div className="l-card-header">
                  <span className="l-day">{row.dayName}</span>
                  <span className="l-total">₹ {dayTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="l-card-body">
                   <div className="l-field-group">
                      <label>तपशील (Details)</label>
                      <input type="text" disabled={isLocked} className="l-input-full" value={row.details} onChange={(e) => handleInputChange(index, 'details', e.target.value)} />
                   </div>
                   <div className="l-staff-grid">
                      <div className="staff-box mistri">
                         <span className="staff-label">मिस्त्री (Mistri)</span>
                         <div className="staff-inputs">
                            <input type="number" disabled={isLocked} value={row.mistriCount} onChange={(e) => handleInputChange(index, 'mistriCount', e.target.value)} />
                            <input type="number" disabled={isLocked} value={row.mistriRate} onChange={(e) => handleInputChange(index, 'mistriRate', e.target.value)} />
                         </div>
                      </div>
                      <div className="staff-box labour">
                         <span className="staff-label">लेबर (Labour)</span>
                         <div className="staff-inputs">
                            <input type="number" disabled={isLocked} value={row.labourCount} onChange={(e) => handleInputChange(index, 'labourCount', e.target.value)} />
                            <input type="number" disabled={isLocked} value={row.labourRate} onChange={(e) => handleInputChange(index, 'labourRate', e.target.value)} />
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sheet-actions-footer">
          <div className="footer-grand-total">
            <span className="total-label">WEEKLY TOTAL:</span>
            <span className="total-amount">₹ {grandTotal.toLocaleString('en-IN')}</span>
          </div>
          {!isLocked && <Button loading={saving} onClick={saveSheet} className="save-btn-mobile">💾 Save Weekly Sheet</Button>}
        </div>
      </div>
      <style>{`
        /* 1. Default State: Hide Mobile, Show Desktop */
        .mobile-view-list { 
          display: none !important; 
        }
        .desktop-view { 
          display: block !important; 
        }

        /* 2. Mobile State: Screen width 768px or less */
        @media (max-width: 768px) {
          .desktop-view { 
            display: none !important; 
          }
          .mobile-view-list { 
            display: block !important; 
            padding: 10px; 
            padding-bottom: 140px; 
          }
          
          .labour-page-container { padding: 0 !important; }

          .labour-mobile-card {
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            margin-bottom: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            overflow: hidden;
          }

          .l-card-header {
            background: #f1f5f9;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
          }
          .l-day { font-weight: 800; color: #1e293b; }
          .l-total { font-weight: 800; color: #2563eb; font-size: 0.95rem; }

          .l-card-body { padding: 15px; display: flex; flex-direction: column; gap: 15px; }
          .l-field-group label, .staff-label { font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 5px; display: block; }
          
          .l-input-full { width: 100%; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
          
          .l-staff-grid { display: flex; flex-direction: column; gap: 12px; }
          .staff-box { background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #f1f5f9; }
          .staff-inputs { display: flex; gap: 10px; }
          .staff-inputs input { flex: 1; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; text-align: center; background: white; }

          /* Fixed Action Bar for Mobile */
          .sheet-actions-footer {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            background: white;
            border-top: 2px solid #e2e8f0;
            padding: 15px 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1000;
            box-shadow: 0 -5px 15px rgba(0,0,0,0.1);
          }

          .footer-grand-total { display: flex; justify-content: space-between; align-items: center; }
          .total-label { font-weight: 800; color: #475569; font-size: 0.85rem; }
          .total-amount { font-weight: 900; color: var(--admin-accent); font-size: 1.25rem; }
          
          .save-btn-mobile { width: 100% !important; height: 50px; font-size: 1rem !important; }
        }

        /* Desktop Table Inputs - Only applies when desktop-view is active */
        .sheet-input-num, .sheet-input-text {
          width: 100%;
          border: 1px solid #e2e8f0;
          padding: 8px;
          border-radius: 4px;
          text-align: center;
          font-family: inherit;
        }
        .sheet-input-text { text-align: left; }
      `}</style>
    </Layout>
  );
}

export default LabourSheet;