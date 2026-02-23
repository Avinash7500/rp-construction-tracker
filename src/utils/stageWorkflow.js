import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export const STAGE_STATUS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
  REOPENED: "Reopened",
};

export const DELAY_REASONS = [
  "Labour shortage",
  "Material delay",
  "Weather issue",
  "Client change",
  "Approval pending",
  "Other",
];

export const DEFAULT_STAGE_TEMPLATE = [
  {
    phaseName: "Phase 1 - Pre-Construction",
    stageName: "Pre-Construction Readiness",
    criticalStage: true,
    tasks: [
      "Site survey and boundary marking",
      "Soil test and report review",
      "Permit and utility approvals",
      "Contractor mobilization",
    ],
  },
  {
    phaseName: "Phase 2 - Foundation",
    stageName: "Foundation Work",
    criticalStage: true,
    tasks: [
      "Excavation and PCC",
      "Footing steel and concreting",
      "Plinth beam completion",
      "Backfilling and compaction",
    ],
  },
  {
    phaseName: "Phase 3 - Structure",
    stageName: "Ground Structure",
    criticalStage: true,
    tasks: [
      "Column casting",
      "Beam and slab shuttering",
      "Concrete pouring and curing",
      "Masonry start",
    ],
  },
  {
    phaseName: "Phase 4 - Upper Floor",
    stageName: "Upper Floor Structure",
    criticalStage: true,
    tasks: [
      "Upper floor column and beam",
      "Slab reinforcement and pour",
      "Staircase and parapet",
      "Blockwork completion",
    ],
  },
  {
    phaseName: "Phase 5 - Services",
    stageName: "MEP Services",
    criticalStage: false,
    tasks: [
      "Electrical conduit and wiring",
      "Plumbing lines and testing",
      "Drainage and waterproof checks",
      "Service shaft closure",
    ],
  },
  {
    phaseName: "Phase 6 - Finishing",
    stageName: "Finishing Works",
    criticalStage: false,
    tasks: [
      "Plastering and putty",
      "Flooring and tiling",
      "Doors windows and fixtures",
      "Painting and polish",
    ],
  },
  {
    phaseName: "Phase 7 - Completion",
    stageName: "Final Handover",
    criticalStage: true,
    tasks: [
      "Snag closure and punch list",
      "Final cleaning",
      "Client walkthrough",
      "Handover documentation",
    ],
  },
];

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function createStageTasks(taskNames = []) {
  return taskNames.map((name, index) => ({
    id: `task_${index + 1}`,
    taskName: name,
    status: "Pending",
    notes: "",
    dueDate: null,
    completionDate: null,
    photoUrl: "",
    createdBy: "SYSTEM",
    lastUpdatedBy: "SYSTEM",
  }));
}

export function computeProgressPercent(tasks = []) {
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.status === "Done").length;
  return Math.round((done / tasks.length) * 100);
}

export function createAuditLogEntry({
  actionType,
  oldValue = null,
  newValue = null,
  userName = "SYSTEM",
  meta = {},
}) {
  return {
    actionType,
    oldValue,
    newValue,
    userName,
    meta,
    timestamp: new Date().toISOString(),
  };
}

export function appendAudit(stage, entry) {
  return [...(stage.auditLog || []), entry];
}

export function appendDelayReason(stage, reasonPayload) {
  return [...(stage.delayReasonHistory || []), reasonPayload];
}

export function isStageCompleted(stage) {
  return stage.status === STAGE_STATUS.COMPLETED || Number(stage.progressPercent || 0) >= 100;
}

export function computeDelayInfo(stage) {
  const endDate = stage.expectedEndDate ? new Date(stage.expectedEndDate) : null;
  if (!endDate || isStageCompleted(stage)) return { delayed: false, delayDays: 0 };

  const now = startOfDay(new Date());
  const due = startOfDay(endDate);
  if (now <= due) return { delayed: false, delayDays: 0 };

  const diffMs = now.getTime() - due.getTime();
  const delayDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  return { delayed: true, delayDays };
}

export function isLockedByDependency(stages, index) {
  if (index <= 0) return false;
  const prev = stages[index - 1];
  if (!prev) return false;
  if (prev.allowParallelExecution === true) return false;
  if (prev.overrideUnlocked === true) return false;
  if (prev.status === STAGE_STATUS.COMPLETED) return false;
  if (Number(prev.progressPercent || 0) >= Number(prev?.dependencyRule?.thresholdPercent || 100)) return false;
  return true;
}

export function buildStagePayload(template, index, siteMeta = {}) {
  const today = startOfDay(new Date());
  const expectedStart = addDays(today, index * 12);
  const expectedEnd = addDays(expectedStart, 11);
  return {
    stageName: template.stageName,
    phaseName: template.phaseName,
    orderIndex: index,
    assignedEngineerId: siteMeta.assignedEngineerId || null,
    assignedEngineerName: siteMeta.assignedEngineerName || "",
    expectedStartDate: toIsoDate(expectedStart),
    expectedEndDate: toIsoDate(expectedEnd),
    actualStartDate: null,
    actualCompletionDate: null,
    status: STAGE_STATUS.NOT_STARTED,
    progressPercent: 0,
    criticalStage: template.criticalStage === true,
    dependencyRule: { thresholdPercent: 100 },
    allowParallelExecution: false,
    overrideUnlocked: false,
    delayDays: 0,
    delayReasonHistory: [],
    auditLog: [
      createAuditLogEntry({
        actionType: "STAGE_CREATED",
        newValue: { stageName: template.stageName, orderIndex: index },
        userName: siteMeta.createdByName || "SYSTEM",
      }),
    ],
    estimatedStageCost: 0,
    actualStageCost: 0,
    variance: 0,
    suggestedMaterials: [],
    tasks: createStageTasks(template.tasks),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function getSiteStages(siteId) {
  const ref = collection(db, "sites", siteId, "executionStages");
  const q = query(ref, orderBy("orderIndex", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function initializeDefaultStagesForSite({
  siteId,
  assignedEngineerId,
  assignedEngineerName,
  createdByName = "SYSTEM",
}) {
  const existing = await getSiteStages(siteId);
  if (existing.length > 0) return existing;

  const batch = writeBatch(db);
  DEFAULT_STAGE_TEMPLATE.forEach((template, index) => {
    const stageRef = doc(collection(db, "sites", siteId, "executionStages"));
    const payload = buildStagePayload(template, index, {
      assignedEngineerId,
      assignedEngineerName,
      createdByName,
    });
    batch.set(stageRef, payload);
  });
  await batch.commit();
  return getSiteStages(siteId);
}

export async function ensureStageTemplateForSite(siteMeta, createdByName = "SYSTEM") {
  if (!siteMeta?.id) return [];
  return initializeDefaultStagesForSite({
    siteId: siteMeta.id,
    assignedEngineerId: siteMeta.assignedEngineerId || null,
    assignedEngineerName: siteMeta.assignedEngineerName || "",
    createdByName,
  });
}
