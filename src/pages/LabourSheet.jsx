// src/pages/LabourSheet.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";
import { showSuccess } from "../utils/showSuccess";
import { showError } from "../utils/showError";

const MARATHI_DAYS = [
  "सोमवार",
  "मंगळवार",
  "बुधवार",
  "गुरुवार",
  "शुक्रवार",
  "शनिवार",
  "रविवार",
];

function LabourSheet() {
  const { siteId, workType, weekKey: urlWeekKey } = useParams(); // 🔥 Added urlWeekKey
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false); // 🔥 History Mode State

  const [rows, setRows] = useState(
    MARATHI_DAYS.map((day) => ({
      dayName: day,
      details: "",
      mistriCount: 0,
      mistriRate: 0,
      labourCount: 0,
      labourRate: 0,
    })),
  );

  useEffect(() => {
    const loadSheetData = async () => {
      try {
        const siteSnap = await getDoc(doc(db, "sites", siteId));
        if (!siteSnap.exists()) return;

        const siteData = siteSnap.data();
        setSite({ id: siteSnap.id, ...siteData });

        // 🔥 Determine which week to load
        const targetWeek = urlWeekKey || siteData.currentWeekKey;
        if (urlWeekKey && urlWeekKey !== siteData.currentWeekKey) {
          setIsHistoryView(true);
          setIsLocked(true); // Always lock historical data
        }

        const q = query(
          collection(db, "labour_entries"),
          where("siteId", "==", siteId),
          where("weekKey", "==", targetWeek),
          where("workType", "==", workType),
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const existingData = snap.docs.map((d) => d.data());

          // Check for 30-day lock on active sheets only
          if (!urlWeekKey) {
            const lastSaved = existingData[0]?.updatedAt?.toDate();
            if (lastSaved) {
              const diffDays = Math.ceil(
                Math.abs(new Date() - lastSaved) / (1000 * 60 * 60 * 24),
              );
              if (diffDays > 30) setIsLocked(true);
            }
          }

          const mergedRows = MARATHI_DAYS.map((day) => {
            const found = existingData.find((d) => d.dayName === day);
            return (
              found || {
                dayName: day,
                details: "",
                mistriCount: 0,
                mistriRate: 0,
                labourCount: 0,
                labourRate: 0,
              }
            );
          });
          setRows(mergedRows);
        } else {
          // Reset rows if no data found for historical week
          if (urlWeekKey) {
            setRows(
              MARATHI_DAYS.map((day) => ({
                dayName: day,
                details: "No data recorded",
                mistriCount: 0,
                mistriRate: 0,
                labourCount: 0,
                labourRate: 0,
              })),
            );
          }
        }
      } catch (e) {
        showError(e, "Error loading sheet");
      } finally {
        setLoading(false);
      }
    };
    loadSheetData();
  }, [siteId, workType, urlWeekKey]);

  const handleInputChange = (index, field, value) => {
    if (isLocked) return;
    const updatedRows = [...rows];
    if (field !== "details") {
      updatedRows[index][field] = value === "" ? 0 : parseFloat(value);
    } else {
      updatedRows[index][field] = value;
    }
    setRows(updatedRows);
  };

  const grandTotal = useMemo(() => {
    return rows.reduce(
      (acc, row) =>
        acc +
        row.mistriCount * row.mistriRate +
        row.labourCount * row.labourRate,
      0,
    );
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
        batch.set(
          docRef,
          { ...row, siteId, weekKey, workType, updatedAt: serverTimestamp() },
          { merge: true },
        );
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

  if (loading)
    return (
      <Layout>
        <div style={{ padding: "20px" }}>Loading {workType} Data...</div>
      </Layout>
    );

  return (
    <Layout>
      <div className="admin-dashboard labour-page-container">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate(-1)}>
            <span className="back-icon">←</span>
            <div className="back-text">
              <span className="back-label">Back</span>
              <span className="back-sub">
                {isHistoryView ? "History" : "Index"}
              </span>
            </div>
          </button>
          <div
            className="engineer-badge-pill"
            style={{ background: isHistoryView ? "#64748b" : "" }}
          >
            <div className="badge-content-v5">
              <span className="eng-label-v5">
                {isHistoryView ? `HISTORY: ${urlWeekKey}` : "लेबर शीट"}{" "}
                {isLocked && !isHistoryView && "(LOCKED)"}
              </span>
              <h2 className="eng-name-v5">{workType}</h2>
            </div>
          </div>
        </div>

        {isHistoryView && (
          <div
            style={{
              background: "#f0f9ff",
              color: "#0369a1",
              padding: "12px",
              borderRadius: "10px",
              marginBottom: "15px",
              textAlign: "center",
              border: "1px solid #bae6fd",
              fontWeight: "bold",
            }}
          >
            👁️ Viewing Historical Records (Read Only)
          </div>
        )}

        {/* ... Rest of your existing Table UI (Desktop/Mobile) remains the same ... */}
        {/* Note: All inputs already have disabled={isLocked}, so they will correctly be read-only in history view */}

        <div className="master-table-container desktop-view">
          <table className="master-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>वार (Day)</th>
                <th>तपशील (Details)</th>
                <th style={{ width: "80px" }}>मिस्त्री</th>
                <th style={{ width: "100px" }}>पगार (Rate)</th>
                <th style={{ width: "80px" }}>लेबर</th>
                <th style={{ width: "100px" }}>पगार (Rate)</th>
                <th style={{ width: "120px", textAlign: "right" }}>
                  एकूण (Total)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const dayTotal =
                  row.mistriCount * row.mistriRate +
                  row.labourCount * row.labourRate;
                return (
                  <tr key={index}>
                    <td>
                      <strong>{row.dayName}</strong>
                    </td>
                    <td>
                      <input
                        type="text"
                        disabled={isLocked}
                        className="sheet-input-text"
                        value={row.details}
                        onChange={(e) =>
                          handleInputChange(index, "details", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={isLocked}
                        className="sheet-input-num"
                        value={row.mistriCount}
                        onChange={(e) =>
                          handleInputChange(
                            index,
                            "mistriCount",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={isLocked}
                        className="sheet-input-num"
                        value={row.mistriRate}
                        onChange={(e) =>
                          handleInputChange(index, "mistriRate", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={isLocked}
                        className="sheet-input-num"
                        value={row.labourCount}
                        onChange={(e) =>
                          handleInputChange(
                            index,
                            "labourCount",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={isLocked}
                        className="sheet-input-num"
                        value={row.labourRate}
                        onChange={(e) =>
                          handleInputChange(index, "labourRate", e.target.value)
                        }
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                      ₹ {dayTotal.toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="sheet-actions-footer">
          <div className="footer-grand-total">
            <span className="total-label">SHEET TOTAL:</span>
            <span className="total-amount">
              ₹ {grandTotal.toLocaleString("en-IN")}
            </span>
          </div>
          {!isHistoryView && !isLocked && (
            <Button
              loading={saving}
              onClick={saveSheet}
              className="save-btn-mobile"
            >
              💾 Save Weekly Sheet
            </Button>
          )}
        </div>
      </div>
      <style>{/* Keep your existing styles */}</style>
    </Layout>
  );
}

export default LabourSheet;
