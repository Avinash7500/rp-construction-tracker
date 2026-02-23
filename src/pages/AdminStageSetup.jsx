import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import Layout from "../components/Layout";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import {
  DELAY_REASONS,
  STAGE_STATUS,
  appendAudit,
  buildStagePayload,
  computeDelayInfo,
  computeProgressPercent,
  createAuditLogEntry,
  ensureStageTemplateForSite,
  getSiteStages,
} from "../utils/stageWorkflow";
import "./StageWorkflow.css";

function statusClass(status) {
  return `stage-status-chip chip-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function AdminStageSetup() {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const { role, userDoc } = useAuth();
  const adminName = userDoc?.name || "ADMIN";

  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(siteId || "");
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [customStage, setCustomStage] = useState({
    phaseName: "Custom Phase",
    stageName: "",
    insertAfterId: "",
  });

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId],
  );
  const selectedStage = useMemo(
    () => stages.find((s) => s.id === selectedStageId) || stages[0] || null,
    [stages, selectedStageId],
  );

  const projectProgress = useMemo(() => {
    if (!stages.length) return 0;
    const total = stages.reduce((sum, s) => sum + asNumber(s.progressPercent), 0);
    return Math.round(total / stages.length);
  }, [stages]);

  useEffect(() => {
    if (role && role !== "ADMIN") navigate("/login", { replace: true });
  }, [role, navigate]);

  const loadStaticLists = async () => {
    try {
      const [siteSnap, engineerSnap] = await Promise.all([
        getDocs(query(collection(db, "sites"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "users"), orderBy("name", "asc"))),
      ]);
      setSites(siteSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEngineers(
        engineerSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => (u.role || "").toUpperCase() === "ENGINEER"),
      );
    } catch (e) {
      showError(e, "Failed to load sites or engineers");
    }
  };

  const refreshStages = async (targetSite) => {
    if (!targetSite?.id) {
      setStages([]);
      return;
    }
    try {
      const seeded = await ensureStageTemplateForSite(targetSite, adminName);
      const hydrated = seeded.map((stage) => ({
        ...stage,
        progressPercent: computeProgressPercent(stage.tasks || []),
      }));

      // Auto-mark delayed stages by expected end date.
      const batch = writeBatch(db);
      let changed = 0;
      hydrated.forEach((stage) => {
        const delay = computeDelayInfo(stage);
        const shouldMarkDelayed =
          delay.delayed &&
          stage.status !== STAGE_STATUS.COMPLETED &&
          stage.status !== STAGE_STATUS.DELAYED;
        if (!shouldMarkDelayed) return;
        changed += 1;
        const next = {
          ...stage,
          status: STAGE_STATUS.DELAYED,
          delayDays: delay.delayDays,
          auditLog: appendAudit(
            stage,
            createAuditLogEntry({
              actionType: "AUTO_DELAYED",
              oldValue: stage.status,
              newValue: STAGE_STATUS.DELAYED,
              userName: "SYSTEM",
              meta: { delayDays: delay.delayDays },
            }),
          ),
          updatedAt: serverTimestamp(),
        };
        batch.update(doc(db, "sites", targetSite.id, "executionStages", stage.id), next);
      });
      if (changed > 0) await batch.commit();

      const latest = changed > 0 ? await getSiteStages(targetSite.id) : hydrated;
      const normalized = latest.map((s) => ({
        ...s,
        progressPercent: computeProgressPercent(s.tasks || []),
      }));
      setStages(normalized);
      setSelectedStageId((prev) => prev || normalized[0]?.id || "");
    } catch (e) {
      showError(e, "Failed to load stage setup");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadStaticLists();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!sites.length) return;
    const target = sites.find((s) => s.id === selectedSiteId) || (siteId ? null : sites[0]);
    if (!target) return;
    setSelectedSiteId(target.id);
    refreshStages(target);
  }, [sites, selectedSiteId]);

  const persistStage = async (stage, actionType, oldValue, newValue, successMessage) => {
    if (!selectedSite?.id || !stage?.id) return;
    try {
      const next = {
        ...stage,
        progressPercent: computeProgressPercent(stage.tasks || []),
        auditLog: appendAudit(
          stage,
          createAuditLogEntry({
            actionType,
            oldValue,
            newValue,
            userName: adminName,
          }),
        ),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "sites", selectedSite.id, "executionStages", stage.id), next);
      setStages((prev) =>
        prev.map((x) =>
          x.id === stage.id
            ? {
                ...next,
                updatedAt: new Date().toISOString(),
              }
            : x,
        ),
      );
      if (successMessage) showSuccess(successMessage);
    } catch (e) {
      showError(e, "Stage update failed");
    }
  };

  const updateStageField = async (stage, key, value) => {
    const oldValue = stage[key];
    await persistStage(
      { ...stage, [key]: value },
      "STAGE_FIELD_UPDATED",
      { [key]: oldValue },
      { [key]: value },
      "Stage updated",
    );
  };

  const reorderStage = async (stage, direction) => {
    const index = stages.findIndex((s) => s.id === stage.id);
    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= stages.length) return;
    const other = stages[targetIndex];
    if (!other) return;
    try {
      const batch = writeBatch(db);
      const aRef = doc(db, "sites", selectedSite.id, "executionStages", stage.id);
      const bRef = doc(db, "sites", selectedSite.id, "executionStages", other.id);

      const nextA = {
        ...stage,
        orderIndex: other.orderIndex,
        auditLog: appendAudit(
          stage,
          createAuditLogEntry({
            actionType: "STAGE_REORDERED",
            oldValue: stage.orderIndex,
            newValue: other.orderIndex,
            userName: adminName,
          }),
        ),
        updatedAt: serverTimestamp(),
      };
      const nextB = {
        ...other,
        orderIndex: stage.orderIndex,
        auditLog: appendAudit(
          other,
          createAuditLogEntry({
            actionType: "STAGE_REORDERED",
            oldValue: other.orderIndex,
            newValue: stage.orderIndex,
            userName: adminName,
          }),
        ),
        updatedAt: serverTimestamp(),
      };
      batch.update(aRef, nextA);
      batch.update(bRef, nextB);
      await batch.commit();
      await refreshStages(selectedSite);
      showSuccess("Stage order updated");
    } catch (e) {
      showError(e, "Failed to reorder stages");
    }
  };

  const addCustomStage = async () => {
    if (!selectedSite?.id || !customStage.stageName.trim()) {
      showError(null, "Custom stage name required");
      return;
    }
    try {
      const afterStage = stages.find((s) => s.id === customStage.insertAfterId) || stages[stages.length - 1];
      const insertIndex = afterStage ? afterStage.orderIndex + 1 : stages.length;
      const batch = writeBatch(db);

      stages
        .filter((s) => s.orderIndex >= insertIndex)
        .forEach((s) => {
          batch.update(doc(db, "sites", selectedSite.id, "executionStages", s.id), {
            orderIndex: asNumber(s.orderIndex) + 1,
            updatedAt: serverTimestamp(),
            auditLog: appendAudit(
              s,
              createAuditLogEntry({
                actionType: "STAGE_REORDERED",
                oldValue: s.orderIndex,
                newValue: asNumber(s.orderIndex) + 1,
                userName: adminName,
              }),
            ),
          });
        });

      const stageRef = doc(collection(db, "sites", selectedSite.id, "executionStages"));
      const payload = buildStagePayload(
        {
          phaseName: customStage.phaseName || "Custom Phase",
          stageName: customStage.stageName.trim(),
          criticalStage: false,
          tasks: ["Planning", "Execution", "Review"],
        },
        insertIndex,
        {
          assignedEngineerId: selectedSite.assignedEngineerId || null,
          assignedEngineerName: selectedSite.assignedEngineerName || "",
          createdByName: adminName,
        },
      );
      payload.auditLog = appendAudit(
        payload,
        createAuditLogEntry({
          actionType: "CUSTOM_STAGE_ADDED",
          oldValue: null,
          newValue: payload.stageName,
          userName: adminName,
        }),
      );
      batch.set(stageRef, payload);
      await batch.commit();
      setCustomStage({ phaseName: "Custom Phase", stageName: "", insertAfterId: "" });
      await refreshStages(selectedSite);
      showSuccess("Custom stage added");
    } catch (e) {
      showError(e, "Failed to add custom stage");
    }
  };

  return (
    <Layout>
      <div className="stage-workflow-page">
        <section className="stage-workflow-hero">
          <div>
            <h1>Stage Setup - Admin Control</h1>
            <p>Lifecycle orchestration, delay intelligence, dependency and audit visibility.</p>
          </div>
          <div className="stage-btn-row">
            <button className="stage-btn" onClick={() => navigate("/admin")}>
              Back to Admin
            </button>
            {selectedSite && (
              <button className="stage-btn primary" onClick={() => refreshStages(selectedSite)}>
                Refresh Stages
              </button>
            )}
          </div>
        </section>

        <section className="stage-card">
          <h3>Site Selection</h3>
          <div className="stage-two-col">
            <select
              className="stage-select"
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value);
                navigate(`/admin/stages/${e.target.value}`);
              }}
            >
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <select
              className="stage-select"
              value={customStage.insertAfterId}
              onChange={(e) => setCustomStage((prev) => ({ ...prev, insertAfterId: e.target.value }))}
            >
              <option value="">Insert custom stage at end</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  After: {stage.stageName}
                </option>
              ))}
            </select>
          </div>
          <div className="stage-field-grid" style={{ marginTop: 10 }}>
            <label>
              Custom Phase
              <input
                value={customStage.phaseName}
                onChange={(e) => setCustomStage((prev) => ({ ...prev, phaseName: e.target.value }))}
              />
            </label>
            <label>
              Custom Stage Name
              <input
                value={customStage.stageName}
                onChange={(e) => setCustomStage((prev) => ({ ...prev, stageName: e.target.value }))}
              />
            </label>
          </div>
          <div className="stage-btn-row" style={{ marginTop: 10 }}>
            <button className="stage-btn primary" onClick={addCustomStage}>
              Add Custom Stage
            </button>
          </div>
        </section>

        {loading ? (
          <section className="stage-card">Loading...</section>
        ) : selectedSite ? (
          <>
            <section className="stage-card">
              <h3>{selectedSite.name} - Stage Health</h3>
              <div className="stage-metrics">
                <div className="stage-metric">
                  <span>Project Progress</span>
                  <strong>{projectProgress}%</strong>
                </div>
                <div className="stage-metric">
                  <span>Total Stages</span>
                  <strong>{stages.length}</strong>
                </div>
                <div className="stage-metric">
                  <span>Delayed Stages</span>
                  <strong>{stages.filter((s) => s.status === STAGE_STATUS.DELAYED).length}</strong>
                </div>
                <div className="stage-metric">
                  <span>Completed Stages</span>
                  <strong>{stages.filter((s) => s.status === STAGE_STATUS.COMPLETED).length}</strong>
                </div>
              </div>
            </section>

            <section className="stage-grid">
              <aside className="stage-card">
                <h3>Stage Timeline</h3>
                <div className="stage-timeline">
                  {stages.map((stage) => (
                    <article
                      key={stage.id}
                      className={stage.id === selectedStage?.id ? "stage-node active" : "stage-node"}
                      onClick={() => setSelectedStageId(stage.id)}
                    >
                      <div className="stage-node-head">
                        <span className="stage-node-title">{stage.stageName}</span>
                        <span className={statusClass(stage.status)}>{stage.status}</span>
                      </div>
                      <small>{stage.phaseName}</small>
                      <div className="stage-progress-track">
                        <div
                          className="stage-progress-fill"
                          style={{ width: `${Math.min(asNumber(stage.progressPercent), 100)}%` }}
                        ></div>
                      </div>
                    </article>
                  ))}
                </div>
              </aside>

              <section className="stage-card">
                {!selectedStage ? (
                  <p>Select a stage to view details.</p>
                ) : (
                  <>
                    <h3>{selectedStage.stageName}</h3>
                    <div className="stage-field-grid">
                      <label>
                        Phase Name
                        <input
                          value={selectedStage.phaseName || ""}
                          onChange={(e) =>
                            setStages((prev) =>
                              prev.map((s) => (s.id === selectedStage.id ? { ...s, phaseName: e.target.value } : s)),
                            )
                          }
                          onBlur={(e) => updateStageField(selectedStage, "phaseName", e.target.value)}
                        />
                      </label>
                      <label>
                        Stage Name
                        <input
                          value={selectedStage.stageName || ""}
                          onChange={(e) =>
                            setStages((prev) =>
                              prev.map((s) => (s.id === selectedStage.id ? { ...s, stageName: e.target.value } : s)),
                            )
                          }
                          onBlur={(e) => updateStageField(selectedStage, "stageName", e.target.value)}
                        />
                      </label>
                      <label>
                        Assigned Engineer
                        <select
                          value={selectedStage.assignedEngineerId || ""}
                          onChange={(e) => {
                            const eng = engineers.find((x) => x.id === e.target.value);
                            const next = {
                              ...selectedStage,
                              assignedEngineerId: eng?.id || "",
                              assignedEngineerName: eng?.name || "",
                            };
                            persistStage(
                              next,
                              "ENGINEER_REASSIGNED",
                              selectedStage.assignedEngineerId,
                              next.assignedEngineerId,
                              "Engineer updated",
                            );
                          }}
                        >
                          <option value="">Unassigned</option>
                          {engineers.map((eng) => (
                            <option key={eng.id} value={eng.id}>
                              {eng.name || eng.email || eng.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select
                          value={selectedStage.status}
                          onChange={(e) => updateStageField(selectedStage, "status", e.target.value)}
                        >
                          {Object.values(STAGE_STATUS).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Expected Start
                        <input
                          type="date"
                          value={selectedStage.expectedStartDate || ""}
                          onChange={(e) => updateStageField(selectedStage, "expectedStartDate", e.target.value)}
                        />
                      </label>
                      <label>
                        Expected End
                        <input
                          type="date"
                          value={selectedStage.expectedEndDate || ""}
                          onChange={(e) => updateStageField(selectedStage, "expectedEndDate", e.target.value)}
                        />
                      </label>
                      <label>
                        Critical Stage
                        <select
                          value={selectedStage.criticalStage ? "YES" : "NO"}
                          onChange={(e) => updateStageField(selectedStage, "criticalStage", e.target.value === "YES")}
                        >
                          <option value="NO">No</option>
                          <option value="YES">Yes</option>
                        </select>
                      </label>
                      <label>
                        Dependency Threshold %
                        <input
                          type="number"
                          value={selectedStage?.dependencyRule?.thresholdPercent ?? 100}
                          onChange={(e) =>
                            updateStageField(selectedStage, "dependencyRule", {
                              thresholdPercent: asNumber(e.target.value, 100),
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="stage-btn-row" style={{ marginTop: 10 }}>
                      <button className="stage-btn" onClick={() => reorderStage(selectedStage, "UP")}>
                        Move Up
                      </button>
                      <button className="stage-btn" onClick={() => reorderStage(selectedStage, "DOWN")}>
                        Move Down
                      </button>
                      <button
                        className="stage-btn"
                        onClick={() =>
                          persistStage(
                            {
                              ...selectedStage,
                              overrideUnlocked: !selectedStage.overrideUnlocked,
                            },
                            "ADMIN_OVERRIDE_UNLOCK",
                            selectedStage.overrideUnlocked,
                            !selectedStage.overrideUnlocked,
                            "Override updated",
                          )
                        }
                      >
                        {selectedStage.overrideUnlocked ? "Disable Override Unlock" : "Override Unlock Next"}
                      </button>
                      <button
                        className="stage-btn"
                        onClick={() =>
                          persistStage(
                            {
                              ...selectedStage,
                              allowParallelExecution: !selectedStage.allowParallelExecution,
                            },
                            "PARALLEL_EXECUTION_TOGGLED",
                            selectedStage.allowParallelExecution,
                            !selectedStage.allowParallelExecution,
                            "Parallel rule updated",
                          )
                        }
                      >
                        {selectedStage.allowParallelExecution ? "Disable Parallel" : "Allow Parallel"}
                      </button>
                      <button
                        className="stage-btn danger"
                        onClick={() =>
                          persistStage(
                            {
                              ...selectedStage,
                              status: STAGE_STATUS.REOPENED,
                              actualCompletionDate: null,
                            },
                            "STAGE_REOPENED",
                            selectedStage.status,
                            STAGE_STATUS.REOPENED,
                            "Stage reopened",
                          )
                        }
                      >
                        Reopen Stage
                      </button>
                    </div>

                    <div className="delay-log">
                      <strong>Delay History ({(selectedStage.delayReasonHistory || []).length})</strong>
                      {(selectedStage.delayReasonHistory || []).length === 0 ? (
                        <p>No delay logs yet.</p>
                      ) : (
                        (selectedStage.delayReasonHistory || []).map((entry, idx) => (
                          <p key={idx}>
                            <b>{entry.reason}</b> - {entry.explanation} ({entry.userName}, {entry.timestamp})
                          </p>
                        ))
                      )}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <strong>Audit Log</strong>
                      <div className="audit-box">
                        {(selectedStage.auditLog || []).length === 0 ? (
                          <p>No audit entries.</p>
                        ) : (
                          (selectedStage.auditLog || []).map((log, idx) => (
                            <div key={idx} className="audit-item">
                              <b>{log.actionType}</b> by {log.userName} - {log.timestamp}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </section>
          </>
        ) : (
          <section className="stage-card">Select a site to configure stages.</section>
        )}
      </div>
    </Layout>
  );
}
