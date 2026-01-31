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

  // The 7-day data state
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

          // Try to fetch existing data for this week/site/workType
          const q = query(
            collection(db, "labour_entries"),
            where("siteId", "==", siteId),
            where("weekKey", "==", siteData.currentWeekKey),
            where("workType", "==", workType)
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            // Map existing Firestore data to our 7-day grid
            const existingData = snap.docs.map(d => d.data());
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
    const updatedRows = [...rows];
    // Allow decimals for counts (e.g. 4.5 mistri)
    if (field !== 'details') {
        updatedRows[index][field] = value === "" ? 0 : parseFloat(value);
    } else {
        updatedRows[index][field] = value;
    }
    setRows(updatedRows);
  };

  // Calculate Grand Total for the bottom summary
  const grandTotal = useMemo(() => {
    return rows.reduce((acc, row) => {
      return acc + (row.mistriCount * row.mistriRate) + (row.labourCount * row.labourRate);
    }, 0);
  }, [rows]);

  const saveSheet = async () => {
    try {
      setSaving(true);
      const batch = writeBatch(db);
      const weekKey = site.currentWeekKey;

      rows.forEach((row) => {
        // Create a unique ID for each day's entry: siteId_weekKey_workType_dayName
        const docId = `${siteId}_${weekKey}_${workType}_${row.dayName}`;
        const docRef = doc(db, "labour_entries", docId);
        
        batch.set(docRef, {
          ...row,
          siteId,
          weekKey,
          workType,
          updatedAt: serverTimestamp()
        }, { merge: true });
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
      <div className="admin-dashboard">
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
              <span className="eng-label-v5">Work Type Sheet</span>
              <h2 className="eng-name-v5">{workType}</h2>
            </div>
          </div>
        </div>

        <div className="master-table-container">
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
                      <input 
                        type="text" 
                        className="sheet-input-text" 
                        value={row.details} 
                        onChange={(e) => handleInputChange(index, 'details', e.target.value)} 
                        placeholder="Work details..."
                      />
                    </td>
                    <td><input type="number" className="sheet-input-num" value={row.mistriCount} onChange={(e) => handleInputChange(index, 'mistriCount', e.target.value)} /></td>
                    <td><input type="number" className="sheet-input-num" value={row.mistriRate} onChange={(e) => handleInputChange(index, 'mistriRate', e.target.value)} /></td>
                    <td><input type="number" className="sheet-input-num" value={row.labourCount} onChange={(e) => handleInputChange(index, 'labourCount', e.target.value)} /></td>
                    <td><input type="number" className="sheet-input-num" value={row.labourRate} onChange={(e) => handleInputChange(index, 'labourRate', e.target.value)} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹ {dayTotal.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan="6" style={{ textAlign: 'right', fontWeight: '800', fontSize: '1rem' }}>WEEKLY TOTAL:</td>
                <td style={{ textAlign: 'right', fontWeight: '900', fontSize: '1.2rem', color: 'var(--admin-accent)' }}>
                  ₹ {grandTotal.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <Button loading={saving} onClick={saveSheet}>💾 Save Weekly Sheet</Button>
        </div>
      </div>

      <style>{`
        .sheet-input-num {
          width: 100%;
          border: 1px solid #e2e8f0;
          padding: 8px;
          border-radius: 4px;
          text-align: center;
          font-family: inherit;
        }
        .sheet-input-text {
          width: 100%;
          border: 1px solid #e2e8f0;
          padding: 8px;
          border-radius: 4px;
          font-family: inherit;
        }
        .sheet-input-num:focus, .sheet-input-text:focus {
          outline: 2px solid var(--admin-accent);
          border-color: transparent;
        }
      `}</style>
    </Layout>
  );
}

export default LabourSheet;