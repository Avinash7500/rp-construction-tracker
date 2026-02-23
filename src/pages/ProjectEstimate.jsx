import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import Layout from "../components/Layout";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import { exportProjectEstimatePdf } from "../utils/exportProjectEstimatePdf";
import {
  computeEstimate,
  createEmptyEstimate,
  getDefaultRateByType,
  getTimelineByArea,
  syncFloorCount,
} from "../utils/estimateEngine";
import "./ProjectEstimate.css";

const TAB_NEW = "NEW";
const TAB_SAVED = "SAVED";
const TAB_BREAKDOWN = "BREAKDOWN";

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInputDate(value) {
  if (!value) return "-";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleDateString("en-GB");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB");
}

function normalizeLoadedEstimate(data) {
  const base = createEmptyEstimate();
  const merged = {
    ...base,
    ...data,
    floorRows: Array.isArray(data?.floorRows) ? data.floorRows : base.floorRows,
    predefinedExtras: Array.isArray(data?.predefinedExtras) ? data.predefinedExtras : base.predefinedExtras,
    customAddons: Array.isArray(data?.customAddons) ? data.customAddons : base.customAddons,
    categorySplit: Array.isArray(data?.categorySplit) ? data.categorySplit : base.categorySplit,
    paymentStages: Array.isArray(data?.paymentStages) ? data.paymentStages : base.paymentStages,
  };
  return {
    ...merged,
    floorRows: syncFloorCount(merged),
  };
}

export default function ProjectEstimate() {
  const navigate = useNavigate();
  const { estimateId } = useParams();
  const { user, role } = useAuth();

  const [activeTab, setActiveTab] = useState(TAB_NEW);
  const [estimate, setEstimate] = useState(createEmptyEstimate());
  const [savedEstimates, setSavedEstimates] = useState([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const computed = useMemo(() => computeEstimate(estimate), [estimate]);
  const selectedSaved = useMemo(
    () => savedEstimates.find((x) => x.id === selectedSavedId) || null,
    [savedEstimates, selectedSavedId],
  );
  const breakdownModel = useMemo(
    () => (activeTab === TAB_BREAKDOWN && selectedSaved ? computeEstimate(selectedSaved) : computed),
    [activeTab, selectedSaved, computed],
  );

  useEffect(() => {
    if (role && role !== "ADMIN") navigate("/login", { replace: true });
  }, [role, navigate]);

  const loadSavedEstimates = async () => {
    try {
      setLoadingSaved(true);
      const ref = collection(db, "projectEstimates");
      const q = query(ref, orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...normalizeLoadedEstimate(d.data()),
      }));
      setSavedEstimates(rows);

      if (estimateId) {
        const found = rows.find((row) => row.id === estimateId);
        if (found) {
          setSelectedSavedId(found.id);
          setActiveTab(TAB_BREAKDOWN);
        }
      }
    } catch (e) {
      showError(e, "Failed to load estimates");
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    loadSavedEstimates();
  }, [estimateId]);

  const setBasicField = (key, value) => {
    setEstimate((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "constructionType") {
        next.ratePerSqFt = getDefaultRateByType(value);
        next.floorRows = (next.floorRows || []).map((floor) => ({
          ...floor,
          rate: getDefaultRateByType(value),
        }));
      }
      if (key === "totalBuiltUpArea" && !next.timelineManual) {
        next.estimatedTimeline = getTimelineByArea(value);
      }
      if (key === "numberOfFloors") {
        next.floorRows = syncFloorCount({ ...next, numberOfFloors: value });
      }
      return next;
    });
  };

  const updateFloor = (id, key, value) => {
    setEstimate((prev) => ({
      ...prev,
      floorRows: prev.floorRows.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    }));
  };

  const addFloor = () => {
    setEstimate((prev) => {
      const idx = prev.floorRows.length;
      return {
        ...prev,
        numberOfFloors: idx + 1,
        floorRows: [
          ...prev.floorRows,
          {
            id: `floor_${Date.now()}`,
            name: idx === 0 ? "Ground Floor" : `${idx}th Floor`,
            area: 0,
            rate: asNumber(prev.ratePerSqFt),
            labourMultiplier: idx === 0 ? 1 : Number((1 + idx * 0.07).toFixed(2)),
            multiplierReason: "Higher floors need additional labour and lifting effort.",
          },
        ],
      };
    });
  };

  const removeFloor = (id) => {
    setEstimate((prev) => {
      const rows = prev.floorRows.filter((row) => row.id !== id);
      return {
        ...prev,
        numberOfFloors: Math.max(1, rows.length),
        floorRows: rows.length > 0 ? rows : syncFloorCount({ ...prev, numberOfFloors: 1, floorRows: [] }),
      };
    });
  };

  const togglePredefinedExtra = (key, checked) => {
    setEstimate((prev) => ({
      ...prev,
      predefinedExtras: prev.predefinedExtras.map((row) =>
        row.key === key ? { ...row, enabled: checked } : row,
      ),
    }));
  };

  const updatePredefinedCost = (key, value) => {
    setEstimate((prev) => ({
      ...prev,
      predefinedExtras: prev.predefinedExtras.map((row) =>
        row.key === key ? { ...row, cost: asNumber(value) } : row,
      ),
    }));
  };

  const addCustomAddon = () => {
    setEstimate((prev) => ({
      ...prev,
      customAddons: [
        ...prev.customAddons,
        { id: `addon_${Date.now()}`, name: "", quantity: 1, unitCost: 0 },
      ],
    }));
  };

  const updateCustomAddon = (id, key, value) => {
    setEstimate((prev) => ({
      ...prev,
      customAddons: prev.customAddons.map((row) =>
        row.id === id ? { ...row, [key]: key === "name" ? value : asNumber(value) } : row,
      ),
    }));
  };

  const removeCustomAddon = (id) => {
    setEstimate((prev) => ({
      ...prev,
      customAddons: prev.customAddons.filter((row) => row.id !== id),
    }));
  };

  const updatePaymentStage = (id, key, value) => {
    setEstimate((prev) => ({
      ...prev,
      paymentStages: prev.paymentStages.map((row) =>
        row.id === id ? { ...row, [key]: key === "percent" ? asNumber(value) : value } : row,
      ),
    }));
  };

  const updateCategory = (key, field, value) => {
    setEstimate((prev) => ({
      ...prev,
      categorySplit: prev.categorySplit.map((row) =>
        row.key === key
          ? { ...row, [field]: field === "mode" ? value : asNumber(value) }
          : row,
      ),
    }));
  };

  const saveEstimate = async (status = "DRAFT") => {
    if (!computed.clientName.trim() || !computed.projectName.trim()) {
      showError(null, "Client Name and Project Name are required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...computed,
        status,
        updatedAt: serverTimestamp(),
        createdByUid: user?.uid || null,
      };

      if (computed.id) {
        const ref = doc(db, "projectEstimates", computed.id);
        await updateDoc(ref, payload);
        showSuccess("Estimate updated");
      } else {
        const ref = collection(db, "projectEstimates");
        const created = await addDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setEstimate((prev) => ({ ...prev, id: created.id, status }));
        showSuccess("Estimate saved");
      }
      await loadSavedEstimates();
    } catch (e) {
      showError(e, "Failed to save estimate");
    } finally {
      setSaving(false);
    }
  };

  const openSaved = (row) => {
    setEstimate(normalizeLoadedEstimate(row));
    setSelectedSavedId(row.id);
    setActiveTab(TAB_BREAKDOWN);
  };

  const editSaved = (row) => {
    setEstimate(normalizeLoadedEstimate(row));
    setActiveTab(TAB_NEW);
  };

  const duplicateSaved = async (row) => {
    try {
      const copy = {
        ...computeEstimate(row),
        id: undefined,
        status: "DRAFT",
        projectName: `${row.projectName} (Copy)`,
      };
      const ref = collection(db, "projectEstimates");
      await addDoc(ref, {
        ...copy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: user?.uid || null,
      });
      showSuccess("Estimate duplicated");
      await loadSavedEstimates();
    } catch (e) {
      showError(e, "Failed to duplicate estimate");
    }
  };

  const deleteSaved = async (id) => {
    if (!window.confirm("Delete this estimate? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "projectEstimates", id));
      if (selectedSavedId === id) setSelectedSavedId("");
      showSuccess("Estimate deleted");
      await loadSavedEstimates();
    } catch (e) {
      showError(e, "Failed to delete estimate");
    }
  };

  const renderBreakdown = (model) => (
    <div className="estimate-breakdown">
      <section className="summary-hero">
        <div>
          <p className="estimate-muted">Executive Summary</p>
          <h2>{model.projectName || "Project Estimate"}</h2>
          <p>{model.clientName || "-"} • {model.location || "-"}</p>
        </div>
        <div className="summary-total">{`Rs ${model.totalEstimate.toLocaleString("en-IN")}`}</div>
        <div className="summary-grid">
          <div><span>Cost / sq ft</span><strong>{`Rs ${model.costPerSqFt.toLocaleString("en-IN")}`}</strong></div>
          <div><span>Floors</span><strong>{model.floorRows.length}</strong></div>
          <div><span>Timeline</span><strong>{model.estimatedTimeline}</strong></div>
          <div><span>Status</span><strong>{model.status}</strong></div>
        </div>
      </section>

      <section className="estimate-card">
        <h3>Floor-wise Detail</h3>
        <div className="floor-cards">
          {model.floorRows.map((floor) => (
            <details key={floor.id} className="floor-detail">
              <summary>
                <span>{floor.name}</span>
                <strong>{`Rs ${floor.floorCost.toLocaleString("en-IN")}`}</strong>
              </summary>
              <div className="floor-meta">
                <p>Area: <b>{`${floor.area.toLocaleString("en-IN")} sq ft`}</b></p>
                <p>Rate: <b>{`Rs ${floor.rate.toLocaleString("en-IN")}`}</b></p>
                <p>Labour Multiplier: <b>{floor.labourMultiplier.toFixed(2)}</b></p>
                <p>Formula: <b>{floor.formula}</b></p>
                <p>Reason: {floor.multiplierReason}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="estimate-card">
        <h3>Extra Options</h3>
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr>
          </thead>
          <tbody>
            {[
              ...model.predefinedExtras.filter((x) => x.enabled).map((x) => ({
                name: x.label,
                qty: 1,
                unitCost: x.cost,
                total: x.cost,
              })),
              ...model.customAddons.map((x) => ({
                name: x.name,
                qty: x.quantity,
                unitCost: x.unitCost,
                total: x.total,
              })),
            ].map((row, index) => (
              <tr key={`${row.name}_${index}`}>
                <td>{row.name || "-"}</td>
                <td>{row.qty}</td>
                <td>{`Rs ${Number(row.unitCost || 0).toLocaleString("en-IN")}`}</td>
                <td>{`Rs ${Number(row.total || 0).toLocaleString("en-IN")}`}</td>
              </tr>
            ))}
            {model.extrasTotal === 0 && (
              <tr>
                <td colSpan={4}>No extra options selected.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="estimate-card">
        <h3>Category Breakdown</h3>
        {model.categorySplit.map((row) => (
          <div key={row.key} className="bar-row">
            <div className="bar-label">
              <span>{row.label}</span>
              <strong>{`Rs ${row.amount.toLocaleString("en-IN")} (${row.percent.toFixed(2)}%)`}</strong>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.min(row.percent, 100)}%` }}></div>
            </div>
          </div>
        ))}
      </section>

      <section className="estimate-card">
        <h3>Payment Schedule</h3>
        <div className="timeline-list">
          {model.paymentStages.map((stage) => (
            <div key={stage.id} className="timeline-item">
              <div>
                <p className="stage-name">{stage.stage}</p>
                <p className="estimate-muted">{stage.trigger}</p>
              </div>
              <div className="timeline-amount">
                <strong>{`Rs ${stage.amount.toLocaleString("en-IN")}`}</strong>
                <span>{`${stage.percent.toFixed(2)}%`}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <Layout>
      <div className="estimate-page">
        <div className="estimate-hero-card">
          <div className="estimate-hero-left">
            <p className="estimate-kicker">RP Construction Tracker</p>
            <h1>Project Estimate</h1>
            <p>Sales tool + planning tool + client presentation</p>
          </div>
          <div className="estimate-hero-actions">
            <button className="btn-hero-secondary" onClick={() => navigate("/admin")}>Back to Admin</button>
            <button className="btn-hero-primary" onClick={() => exportProjectEstimatePdf(breakdownModel)}>Generate PDF</button>
          </div>
        </div>

        <div className="estimate-tabs">
          <button className={activeTab === TAB_NEW ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab(TAB_NEW)}>New Estimate</button>
          <button className={activeTab === TAB_SAVED ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab(TAB_SAVED)}>Saved Estimates</button>
          <button className={activeTab === TAB_BREAKDOWN ? "tab-btn active" : "tab-btn"} onClick={() => setActiveTab(TAB_BREAKDOWN)}>Breakdown View</button>
        </div>

        {activeTab === TAB_NEW && (
          <div className="estimate-form-wrap">
            <section className="estimate-card">
              <div className="section-head">
                <h3>Project Basic Info</h3>
                <p>Capture core project inputs used for estimate calculation.</p>
              </div>
              <div className="basic-grid">
                <label className="field-group">Client Name<input value={estimate.clientName} onChange={(e) => setBasicField("clientName", e.target.value)} /></label>
                <label className="field-group">Project / Site Name<input value={estimate.projectName} onChange={(e) => setBasicField("projectName", e.target.value)} /></label>
                <label className="field-group">Location<input value={estimate.location} onChange={(e) => setBasicField("location", e.target.value)} /></label>
                <label className="field-group">Total Built-up Area (sq ft)<input type="number" value={estimate.totalBuiltUpArea} onChange={(e) => setBasicField("totalBuiltUpArea", asNumber(e.target.value))} /></label>
                <label className="field-group">Number of Floors<input type="number" min={1} value={estimate.numberOfFloors} onChange={(e) => setBasicField("numberOfFloors", asNumber(e.target.value, 1))} /></label>
                <label className="field-group">Construction Type
                  <select value={estimate.constructionType} onChange={(e) => setBasicField("constructionType", e.target.value)}>
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </label>
                <label className="field-group field-rate">Rate per Sq Ft<input type="number" value={estimate.ratePerSqFt} onChange={(e) => setBasicField("ratePerSqFt", asNumber(e.target.value))} /></label>
                <label className="field-group">Estimated Timeline
                  <input value={estimate.estimatedTimeline} onChange={(e) => setEstimate((prev) => ({ ...prev, estimatedTimeline: e.target.value, timelineManual: true }))} />
                </label>
                <div className="inline-note">Auto suggestion: <span className="timeline-badge">{getTimelineByArea(estimate.totalBuiltUpArea)}</span></div>
              </div>
            </section>

            <section className="estimate-card">
              <div className="card-head-inline">
                <h3>Floor-Wise Estimation</h3>
                <button className="btn-primary-inline" onClick={addFloor}>+ Add Floor</button>
              </div>
              <div className="floor-edit-grid">
                {computed.floorRows.map((floor) => (
                  <article key={floor.id} className="floor-edit-card">
                    <div className="floor-edit-top">
                      <h4>{floor.name || "Floor"}</h4>
                      <div className="floor-total-pill">{`Rs ${floor.floorCost.toLocaleString("en-IN")}`}</div>
                    </div>
                    <div className="floor-edit-fields">
                      <label className="field-group">Floor Name<input value={floor.name} onChange={(e) => updateFloor(floor.id, "name", e.target.value)} /></label>
                      <label className="field-group">Area (sq ft)<input type="number" value={floor.area} onChange={(e) => updateFloor(floor.id, "area", asNumber(e.target.value))} /></label>
                      <label className="field-group">Rate / sq ft<input type="number" value={floor.rate} onChange={(e) => updateFloor(floor.id, "rate", asNumber(e.target.value))} /></label>
                      <label className="field-group">Labour Multiplier<input type="number" step="0.01" value={floor.labourMultiplier} onChange={(e) => updateFloor(floor.id, "labourMultiplier", asNumber(e.target.value))} /></label>
                    </div>
                    <div className="floor-edit-meta">
                      <span>Formula: <b>{floor.formula}</b></span>
                      <span>Reason: {floor.multiplierReason}</span>
                    </div>
                    <div className="floor-edit-actions">
                      <button className="btn-subtle-inline" onClick={() => removeFloor(floor.id)} disabled={computed.floorRows.length <= 1}>Remove Floor</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="estimate-card">
              <div className="section-head">
                <h3>Extra Options</h3>
                <p>Enable optional project add-ons with editable costing.</p>
              </div>
              <div className="extras-card-grid">
                {computed.predefinedExtras.map((item) => (
                  <label key={item.key} className={item.enabled ? "extra-choice-card is-selected" : "extra-choice-card"}>
                    <div className="extra-choice-top">
                      <input type="checkbox" checked={item.enabled} onChange={(e) => togglePredefinedExtra(item.key, e.target.checked)} />
                      <span>{item.label}</span>
                    </div>
                    <div className="extra-choice-bottom">
                      <span>Cost</span>
                      <input type="number" value={item.cost} onChange={(e) => updatePredefinedCost(item.key, e.target.value)} />
                    </div>
                  </label>
                ))}
              </div>
              <div className="card-head-inline"><h4>Custom Add-ons</h4><button className="btn-primary-inline" onClick={addCustomAddon}>+ Add Item</button></div>
              <table className="premium-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  {computed.customAddons.map((item) => (
                    <tr key={item.id}>
                      <td><input value={item.name || ""} onChange={(e) => updateCustomAddon(item.id, "name", e.target.value)} /></td>
                      <td><input type="number" value={item.quantity} onChange={(e) => updateCustomAddon(item.id, "quantity", e.target.value)} /></td>
                      <td><input type="number" value={item.unitCost} onChange={(e) => updateCustomAddon(item.id, "unitCost", e.target.value)} /></td>
                      <td>{`Rs ${item.total.toLocaleString("en-IN")}`}</td>
                      <td><button onClick={() => removeCustomAddon(item.id)}>Remove</button></td>
                    </tr>
                  ))}
                  {computed.customAddons.length === 0 && <tr><td colSpan={5}>No custom add-ons.</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="estimate-card">
              <h3>Category Breakdown</h3>
              <table className="premium-table">
                <thead><tr><th>Category</th><th>Mode</th><th>Value</th><th>Percent</th><th>Amount</th></tr></thead>
                <tbody>
                  {computed.categorySplit.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>
                        <select value={row.mode} onChange={(e) => updateCategory(row.key, "mode", e.target.value)}>
                          <option value="PERCENT">Percent</option>
                          <option value="AMOUNT">Amount</option>
                        </select>
                      </td>
                      <td><input type="number" value={row.value} onChange={(e) => updateCategory(row.key, "value", e.target.value)} /></td>
                      <td>{`${row.percent.toFixed(2)}%`}</td>
                      <td>{`Rs ${row.amount.toLocaleString("en-IN")}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="estimate-card">
              <h3>Payment Stage Planning</h3>
              <table className="premium-table">
                <thead><tr><th>Stage</th><th>Trigger</th><th>%</th><th>Amount</th></tr></thead>
                <tbody>
                  {computed.paymentStages.map((stage) => (
                    <tr key={stage.id}>
                      <td><input value={stage.stage} onChange={(e) => updatePaymentStage(stage.id, "stage", e.target.value)} /></td>
                      <td><input value={stage.trigger} onChange={(e) => updatePaymentStage(stage.id, "trigger", e.target.value)} /></td>
                      <td><input type="number" value={stage.percent} onChange={(e) => updatePaymentStage(stage.id, "percent", e.target.value)} /></td>
                      <td>{`Rs ${stage.amount.toLocaleString("en-IN")}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={computed.paymentPercentTotal === 100 ? "ok-text" : "warn-text"}>
                Total stage percentage: {computed.paymentPercentTotal.toFixed(2)}%
              </p>
            </section>

            <section className="estimate-footer">
              <div>
                <p>Total Estimate</p>
                <h2>{`Rs ${computed.totalEstimate.toLocaleString("en-IN")}`}</h2>
              </div>
              <div className="estimate-actions">
                <button className="btn-hero-secondary" disabled={saving} onClick={() => saveEstimate("DRAFT")}>Save Draft</button>
                <button className="btn-hero-primary" disabled={saving || computed.paymentPercentTotal !== 100} onClick={() => saveEstimate("FINAL")}>Save Final</button>
                <button className="btn-subtle-inline" onClick={() => setActiveTab(TAB_BREAKDOWN)}>Open Breakdown</button>
              </div>
            </section>
          </div>
        )}

        {activeTab === TAB_SAVED && (
          <section className="estimate-card">
            <h3>Saved Estimates</h3>
            {loadingSaved ? (
              <p>Loading estimates...</p>
            ) : (
              <table className="premium-table">
                <thead><tr><th>Client</th><th>Project</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {savedEstimates.map((row) => (
                    <tr key={row.id}>
                      <td>{row.clientName || "-"}</td>
                      <td>{row.projectName || "-"}</td>
                      <td>{toInputDate(row.updatedAt || row.createdAt)}</td>
                      <td>{`Rs ${computeEstimate(row).totalEstimate.toLocaleString("en-IN")}`}</td>
                      <td>{row.status || "DRAFT"}</td>
                      <td className="action-cell">
                        <button onClick={() => openSaved(row)}>View</button>
                        <button onClick={() => editSaved(row)}>Edit</button>
                        <button onClick={() => duplicateSaved(row)}>Duplicate</button>
                        <button onClick={() => deleteSaved(row.id)}>Delete</button>
                        <button onClick={() => exportProjectEstimatePdf(computeEstimate(row))}>PDF</button>
                      </td>
                    </tr>
                  ))}
                  {savedEstimates.length === 0 && <tr><td colSpan={6}>No saved estimates yet.</td></tr>}
                </tbody>
              </table>
            )}
          </section>
        )}

        {activeTab === TAB_BREAKDOWN && (
          <>
            {savedEstimates.length > 0 && (
              <section className="estimate-card">
                <h3>Breakdown Source</h3>
                <select value={selectedSavedId} onChange={(e) => setSelectedSavedId(e.target.value)}>
                  <option value="">Current Draft (unsaved / editing)</option>
                  {savedEstimates.map((x) => (
                    <option key={x.id} value={x.id}>{`${x.clientName || "-"} - ${x.projectName || "-"} (${x.status || "DRAFT"})`}</option>
                  ))}
                </select>
              </section>
            )}
            {renderBreakdown(breakdownModel)}
          </>
        )}
      </div>
    </Layout>
  );
}
