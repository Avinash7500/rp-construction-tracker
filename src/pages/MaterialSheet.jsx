// src/pages/MaterialSheet.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

const MARATHI_DAYS = ["रविवार", "सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];

function MaterialSheet() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialize with 7 rows
  const [rows, setRows] = useState(
    MARATHI_DAYS.map((day) => ({
      dayName: day,
      date: "", // Now controlled by type="date"
      details: "",
      qty: 0,
      rate: 0,
    }))
  );

  useEffect(() => {
    const loadMaterialData = async () => {
      try {
        const siteSnap = await getDoc(doc(db, "sites", siteId));
        if (siteSnap.exists()) {
          const siteData = siteSnap.data();
          setSite({ id: siteSnap.id, ...siteData });

          const q = query(
            collection(db, "material_entries"),
            where("siteId", "==", siteId),
            where("weekKey", "==", siteData.currentWeekKey)
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
            const existingData = snap.docs.map(d => d.data());
            const mergedRows = MARATHI_DAYS.map(day => {
              const found = existingData.find(d => d.dayName === day);
              return found || { dayName: day, date: "", details: "", qty: 0, rate: 0 };
            });
            setRows(mergedRows);
          }
        }
      } catch (e) {
        showError(e, "Failed to load materials");
      } finally {
        setLoading(false);
      }
    };
    loadMaterialData();
  }, [siteId]);

  const handleInputChange = (index, field, value) => {
    const updatedRows = [...rows];
    if (field === 'qty' || field === 'rate') {
      updatedRows[index][field] = value === "" ? 0 : parseFloat(value);
    } else {
      updatedRows[index][field] = value;
    }
    setRows(updatedRows);
  };

  const grandTotal = useMemo(() => {
    return rows.reduce((acc, row) => acc + (row.qty * row.rate), 0);
  }, [rows]);

  const saveSheet = async () => {
    try {
      setSaving(true);
      const batch = writeBatch(db);
      const weekKey = site.currentWeekKey;

      rows.forEach((row) => {
        // Unique ID per day to prevent duplicate rows for the same week
        const docId = `${siteId}_${weekKey}_material_${row.dayName}`;
        const docRef = doc(db, "material_entries", docId);
        
        batch.set(docRef, {
          ...row,
          siteId,
          weekKey,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      showSuccess("Material Sheet Saved ✅");
      navigate(`/accountant/site/${siteId}`);
    } catch (e) {
      showError(e, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div style={{padding:'20px'}}>Loading Material Sheet...</div></Layout>;

  return (
    <Layout>
      <div className="admin-dashboard">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate(`/accountant/site/${siteId}`)}>
            <span className="back-icon">←</span>
            <div className="back-text">
                <span className="back-label">Back to Site</span>
                <span className="back-sub">Site MIS</span>
            </div>
          </button>
          <div className="engineer-badge-pill">
            <div className="badge-content-v5">
              <span className="eng-label-v5">मटेरियल शीट (Material)</span>
              <h2 className="eng-name-v5">{site?.name}</h2>
            </div>
          </div>
        </div>

        <div className="master-table-container">
          <table className="master-table">
            <thead>
              <tr>
                <th style={{ width: '160px' }}>तारीख (Date)</th>
                <th style={{ width: '110px' }}>वार (Day)</th>
                <th>तपशील (Details)</th>
                <th style={{ width: '100px' }}>ब्रास/नग</th>
                <th style={{ width: '120px' }}>दर (Rate)</th>
                <th style={{ width: '140px', textAlign: 'right' }}>एकूण (Total)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowTotal = row.qty * row.rate;
                return (
                  <tr key={index}>
                    <td>
                      {/* 🔥 DATE PICKER ADDED HERE */}
                      <input 
                        type="date" 
                        className="sheet-input-text" 
                        value={row.date} 
                        onChange={(e) => handleInputChange(index, 'date', e.target.value)} 
                      />
                    </td>
                    <td><strong>{row.dayName}</strong></td>
                    <td>
                      <input 
                        type="text" 
                        className="sheet-input-text" 
                        value={row.details} 
                        onChange={(e) => handleInputChange(index, 'details', e.target.value)} 
                        placeholder="Material details..."
                      />
                    </td>
                    <td><input type="number" className="sheet-input-num" value={row.qty} onChange={(e) => handleInputChange(index, 'qty', e.target.value)} /></td>
                    <td><input type="number" className="sheet-input-num" value={row.rate} onChange={(e) => handleInputChange(index, 'rate', e.target.value)} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹ {rowTotal.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan="5" style={{ textAlign: 'right', fontWeight: '800', fontSize: '1rem' }}>एकूण (TOTAL):</td>
                <td style={{ textAlign: 'right', fontWeight: '900', fontSize: '1.2rem', color: 'var(--admin-accent)' }}>
                  ₹ {grandTotal.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <Button loading={saving} onClick={saveSheet}>💾 Save Material Sheet</Button>
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
        /* Custom styling for date picker to look cleaner */
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          filter: invert(0.5);
        }
        .sheet-input-num:focus, .sheet-input-text:focus {
          outline: 2px solid var(--admin-accent);
          border-color: transparent;
        }
      `}</style>
    </Layout>
  );
}

export default MaterialSheet;