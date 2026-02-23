import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
  appendDelayReason,
  computeDelayInfo,
  computeProgressPercent,
  createAuditLogEntry,
  ensureStageTemplateForSite,
  getSiteStages,
  isLockedByDependency,
} from "../utils/stageWorkflow";
import "./StageWorkflow.css";

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function statusClass(status) {
  return `stage-status-chip chip-${String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
}

function taskStatusFromUi(value) {
  if (value === "Done") return "Done";
  if (value === "Cancelled") return "Cancelled";
  return "Pending";
}

export default function EngineerExecutionStages() {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const { role, user, userDoc } = useAuth();
  const engineerId = user?.uid || "";
  const engineerName = userDoc?.name || user?.email || "ENGINEER";

  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(siteId || "");
  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [delayReason, setDelayReason] = useState(DELAY_REASONS[0]);
  const [delayExplanation, setDelayExplanation] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId],
  );

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => asNumber(a.orderIndex) - asNumber(b.orderIndex)),
    [stages],
  );

  const selectedIndex = useMemo(
    () => sortedStages.findIndex((s) => s.id === selectedStageId),
    [sortedStages, selectedStageId],
  );

  const selectedStage = useMemo(
    () => sortedStages.find((s) => s.id === selectedStageId) || sortedStages[0] || null,
    [sortedStages, selectedStageId],
  );

  const projectProgress = useMemo(() => {
    if (!sortedStages.length) return 0;
    const sum = sortedStages.reduce((acc, item) => acc + asNumber(item.progressPercent), 0);
    return Math.round(sum / sortedStages.length);
  }, [sortedStages]);

  const activeStage = useMemo(() => {
    const unlocked = sortedStages.find((stage, index) => !isLockedByDependency(sortedStages, index));
    const running = sortedStages.find((stage) => stage.status === STAGE_STATUS.IN_PROGRESS);
    return running || unlocked || null;
  }, [sortedStages]);

  useEffect(() => {
    if (role && role !== "ENGINEER") navigate("/login", { replace: true });
  }, [role, navigate]);

  const loadSites = async () => {
    try {
      if (!engineerId) return;
      const snap = await getDocs(
        query(
          collection(db, "sites"),
          where("assignedEngineerId", "==", engineerId),
          orderBy("createdAt", "desc"),
        ),
      );
      setSites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load assigned sites");
    }
  };

  const refreshStages = async (siteMeta) => {
    if (!siteMeta?.id) {
      setStages([]);
      return;
    }
    try {
      const seeded = await ensureStageTemplateForSite(siteMeta, engineerName);
      const hydrated = seeded.map((stage) => ({
        ...stage,
        progressPercent: computeProgressPercent(stage.tasks || []),
      }));

      const updates = hydrated.map((stage) => {
        const delay = computeDelayInfo(stage);
        if (!delay.delayed || stage.status === STAGE_STATUS.COMPLETED || stage.status === STAGE_STATUS.DELAYED) {
          return null;
        }
        return updateDoc(doc(db, "sites", siteMeta.id, "executionStages", stage.id), {
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
        });
      });
      await Promise.all(updates.filter(Boolean));

      const latest = await getSiteStages(siteMeta.id);
      const normalized = latest
        .map((stage) => ({
          ...stage,
          progressPercent: computeProgressPercent(stage.tasks || []),
        }))
        .sort((a, b) => asNumber(a.orderIndex) - asNumber(b.orderIndex));
      setStages(normalized);
      setSelectedStageId((prev) => prev || normalized[0]?.id || "");
    } catch (e) {
      showError(e, "Failed to load execution stages");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadSites();
      setLoading(false);
    };
    init();
  }, [engineerId]);

  useEffect(() => {
    if (!sites.length) return;
    const target = sites.find((s) => s.id === selectedSiteId) || (siteId ? null : sites[0]);
    if (!target) return;
    setSelectedSiteId(target.id);
    refreshStages(target);
  }, [sites, selectedSiteId]);

  const persistStage = async (next, actionType, oldValue, newValue, successMessage) => {
    if (!selectedSite?.id || !next?.id) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, "sites", selectedSite.id, "executionStages", next.id), {
        ...next,
        updatedAt: serverTimestamp(),
        auditLog: appendAudit(
          next,
          createAuditLogEntry({
            actionType,
            oldValue,
            newValue,
            userName: engineerName,
          }),
        ),
      });
      await refreshStages(selectedSite);
      if (successMessage) showSuccess(successMessage);
    } catch (e) {
      showError(e, "Stage update failed");
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (stage, taskId, updater) => {
    const tasks = (stage.tasks || []).map((task) => {
      if (task.id !== taskId) return task;
      return updater(task);
    });
    const progressPercent = computeProgressPercent(tasks);
    const nowIso = new Date().toISOString();
    const nextStatus =
      progressPercent >= 100
        ? STAGE_STATUS.COMPLETED
        : stage.status === STAGE_STATUS.NOT_STARTED
          ? STAGE_STATUS.IN_PROGRESS
          : stage.status;

    await persistStage(
      {
        ...stage,
        tasks,
        progressPercent,
        status: nextStatus,
        actualStartDate: stage.actualStartDate || nowIso.slice(0, 10),
        actualCompletionDate:
          progressPercent >= 100 ? (stage.actualCompletionDate || nowIso.slice(0, 10)) : null,
        delayDays: computeDelayInfo({ ...stage, status: nextStatus, progressPercent }).delayDays,
      },
      "TASK_UPDATED",
      "task",
      taskId,
      "Task updated",
    );
  };

  const markStageCompleted = async () => {
    if (!selectedStage) return;
    const progressPercent = computeProgressPercent(selectedStage.tasks || []);
    if (progressPercent < 100) {
      showError(null, "Complete all stage tasks before marking stage complete");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    await persistStage(
      {
        ...selectedStage,
        progressPercent: 100,
        status: STAGE_STATUS.COMPLETED,
        actualStartDate: selectedStage.actualStartDate || today,
        actualCompletionDate: today,
        delayDays: 0,
      },
      "STAGE_COMPLETED",
      selectedStage.status,
      STAGE_STATUS.COMPLETED,
      "Stage completed",
    );
  };

  const submitDelayReason = async () => {
    if (!selectedStage) return;
    if (!delayExplanation.trim()) {
      showError(null, "Delay explanation is required");
      return;
    }
    const delay = computeDelayInfo(selectedStage);
    const entry = {
      reason: delayReason,
      explanation: delayExplanation.trim(),
      delayDays: delay.delayDays,
      userName: engineerName,
      engineerId,
      timestamp: new Date().toISOString(),
    };
    await persistStage(
      {
        ...selectedStage,
        status: STAGE_STATUS.DELAYED,
        delayDays: delay.delayDays,
        delayReasonHistory: appendDelayReason(selectedStage, entry),
      },
      "DELAY_REASON_LOGGED",
      null,
      entry,
      "Delay reason logged",
    );
    setDelayExplanation("");
  };

  return (
    <Layout>
      <div className="stage-workflow-page">
        <section className="stage-workflow-hero">
          <div>
            <h1>Execution Stages - Engineer</h1>
            <p>Structured site execution timeline, progress controls, and delay compliance.</p>
          </div>
          <div className="stage-btn-row">
            <button className="stage-btn" onClick={() => navigate("/engineer")}>
              Back to Engineer
            </button>
            {selectedSite && (
              <button className="stage-btn primary" onClick={() => refreshStages(selectedSite)}>
                Refresh Timeline
              </button>
            )}
          </div>
        </section>

        <section className="stage-card">
          <h3>Assigned Site</h3>
          <div className="stage-two-col">
            <select
              className="stage-select"
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value);
                navigate(`/engineer/stages/${e.target.value}`);
              }}
            >
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <section className="stage-card">Loading...</section>
        ) : !selectedSite ? (
          <section className="stage-card">No assigned site selected.</section>
        ) : (
          <>
            <section className="stage-card">
              <h3>{selectedSite.name} - Execution Health</h3>
              <div className="stage-metrics">
                <div className="stage-metric">
                  <span>Project Progress</span>
                  <strong>{projectProgress}%</strong>
                </div>
                <div className="stage-metric">
                  <span>Current Active Stage</span>
                  <strong>{activeStage?.stageName || "-"}</strong>
                </div>
                <div className="stage-metric">
                  <span>Expected Completion</span>
                  <strong>{activeStage?.expectedEndDate || "-"}</strong>
                </div>
                <div className="stage-metric">
                  <span>Delayed Stages</span>
                  <strong>{sortedStages.filter((s) => s.status === STAGE_STATUS.DELAYED).length}</strong>
                </div>
              </div>
            </section>

            <section className="stage-grid">
              <aside className="stage-card">
                <h3>Stage Timeline</h3>
                <div className="stage-timeline">
                  {sortedStages.map((stage, index) => {
                    const locked = isLockedByDependency(sortedStages, index);
                    return (
                      <article
                        key={stage.id}
                        className={`stage-node ${stage.id === selectedStage?.id ? "active" : ""} ${locked ? "locked" : ""}`}
                        onClick={() => !locked && setSelectedStageId(stage.id)}
                      >
                        <div className="stage-node-head">
                          <span className="stage-node-title">
                            {stage.status === STAGE_STATUS.COMPLETED ? "✔ " : locked ? "🔒 " : "● "}
                            {stage.stageName}
                          </span>
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
                    );
                  })}
                </div>
              </aside>

              <section className="stage-card">
                {!selectedStage ? (
                  <p>Select a stage to view details.</p>
                ) : (
                  <>
                    <h3>{selectedStage.stageName}</h3>
                    <div className="stage-metrics">
                      <div className="stage-metric">
                        <span>Status</span>
                        <strong>{selectedStage.status}</strong>
                      </div>
                      <div className="stage-metric">
                        <span>Progress</span>
                        <strong>{asNumber(selectedStage.progressPercent)}%</strong>
                      </div>
                      <div className="stage-metric">
                        <span>Expected End</span>
                        <strong>{selectedStage.expectedEndDate || "-"}</strong>
                      </div>
                      <div className="stage-metric">
                        <span>Delay Days</span>
                        <strong>{asNumber(selectedStage.delayDays)}</strong>
                      </div>
                    </div>

                    <table className="stage-task-table">
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Status</th>
                          <th>Due</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedStage.tasks || []).map((task) => (
                          <tr key={task.id}>
                            <td>{task.taskName}</td>
                            <td>
                              <select
                                value={task.status || "Pending"}
                                onChange={(e) =>
                                  updateTask(selectedStage, task.id, (current) => ({
                                    ...current,
                                    status: taskStatusFromUi(e.target.value),
                                    completionDate:
                                      e.target.value === "Done"
                                        ? new Date().toISOString().slice(0, 10)
                                        : null,
                                    lastUpdatedBy: engineerName,
                                  }))
                                }
                                disabled={saving}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Done">Done</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="date"
                                value={task.dueDate || ""}
                                onChange={(e) =>
                                  updateTask(selectedStage, task.id, (current) => ({
                                    ...current,
                                    dueDate: e.target.value,
                                    lastUpdatedBy: engineerName,
                                  }))
                                }
                                disabled={saving}
                              />
                            </td>
                            <td>
                              <input
                                value={task.notes || ""}
                                placeholder="Add update note"
                                onChange={(e) =>
                                  updateTask(selectedStage, task.id, (current) => ({
                                    ...current,
                                    notes: e.target.value,
                                    lastUpdatedBy: engineerName,
                                  }))
                                }
                                disabled={saving}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="stage-btn-row" style={{ marginTop: 10 }}>
                      <button
                        className="stage-btn success"
                        onClick={markStageCompleted}
                        disabled={saving || asNumber(selectedStage.progressPercent) < 100}
                      >
                        Mark Stage Completed
                      </button>
                    </div>

                    <div className="delay-log">
                      <strong>Delay Tracking (Mandatory for overdue stage)</strong>
                      <p style={{ marginTop: 6 }}>
                        If stage is overdue, select reason and add explanation to maintain delay history.
                      </p>
                      <div className="stage-two-col">
                        <select
                          className="stage-select"
                          value={delayReason}
                          onChange={(e) => setDelayReason(e.target.value)}
                          disabled={saving}
                        >
                          {DELAY_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                        <input
                          value={delayExplanation}
                          onChange={(e) => setDelayExplanation(e.target.value)}
                          placeholder="Explain delay details"
                          disabled={saving}
                        />
                      </div>
                      <div className="stage-btn-row" style={{ marginTop: 10 }}>
                        <button className="stage-btn danger" onClick={submitDelayReason} disabled={saving}>
                          Log Delay Reason
                        </button>
                      </div>

                      {(selectedStage.delayReasonHistory || []).length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          {(selectedStage.delayReasonHistory || []).map((entry, idx) => (
                            <p key={idx}>
                              <b>{entry.reason}</b> - {entry.explanation} ({entry.userName}, {entry.timestamp})
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
