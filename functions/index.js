const admin = require("firebase-admin");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

admin.initializeApp();
const db = admin.firestore();
const APP_BASE_URL = process.env.APP_BASE_URL || "https://rp-construction-tracker.vercel.app";

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = asDate(value);
  if (!d) return "-";
  return d.toLocaleDateString("en-GB");
}

function weekKeyForDate(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function toAbsoluteLink(link) {
  if (!link) return `${APP_BASE_URL}/engineer`;
  if (/^https?:\/\//i.test(link)) return link;
  const safePath = link.startsWith("/") ? link : `/${link}`;
  return `${APP_BASE_URL}${safePath}`;
}

async function getUserPushTargets(uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return { tokens: [], tokenToInstallationIds: {} };
  const user = snap.data() || {};
  const tokenSet = new Set();
  const tokenToInstallationIds = {};

  if (typeof user.pushToken === "string" && user.pushToken) {
    tokenSet.add(user.pushToken);
  }

  const pushTokens = user.pushTokens || {};
  for (const [installationId, row] of Object.entries(pushTokens)) {
    const token = row && typeof row.token === "string" ? row.token : "";
    if (!token) continue;
    tokenSet.add(token);
    if (!tokenToInstallationIds[token]) tokenToInstallationIds[token] = [];
    tokenToInstallationIds[token].push(installationId);
  }

  return { tokens: Array.from(tokenSet), tokenToInstallationIds };
}

function isTokenInvalidError(code) {
  return code === "messaging/registration-token-not-registered"
    || code === "messaging/invalid-registration-token";
}

async function cleanupInvalidTokens(engineerId, invalidTokens, tokenToInstallationIds) {
  if (!engineerId || !invalidTokens.length) return;
  const updates = {};

  invalidTokens.forEach((token) => {
    const installationIds = tokenToInstallationIds[token] || [];
    installationIds.forEach((installationId) => {
      updates[`pushTokens.${installationId}`] = admin.firestore.FieldValue.delete();
    });
  });

  if (Object.keys(updates).length === 0) return;
  await db.collection("users").doc(engineerId).set(updates, { merge: true });
}

async function alreadySent(dedupeKey) {
  const ref = db.collection("notificationLogs").doc(dedupeKey);
  const snap = await ref.get();
  return snap.exists;
}

async function markSent(dedupeKey, meta = {}) {
  await db.collection("notificationLogs").doc(dedupeKey).set({
    ...meta,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function sendToEngineer({ engineerId, title, body, link, dedupeKey, meta }) {
  if (!engineerId) return;
  if (dedupeKey && await alreadySent(dedupeKey)) return;

  const { tokens, tokenToInstallationIds } = await getUserPushTargets(engineerId);
  if (!tokens.length) {
    logger.info("No push token found for engineer", engineerId);
    return;
  }

  const resolvedLink = toAbsoluteLink(link || "/engineer");
  const message = {
    tokens,
    notification: { title, body },
    data: {
      title,
      body,
      link: resolvedLink,
    },
    webpush: {
      fcmOptions: {
        link: resolvedLink,
      },
      notification: {
        icon: "/icons/icon-192.png",
      },
    },
  };

  try {
    const resp = await admin.messaging().sendEachForMulticast(message);
    const invalidTokens = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success && isTokenInvalidError(r.error?.code)) {
        invalidTokens.push(tokens[idx]);
      }
    });
    await cleanupInvalidTokens(engineerId, invalidTokens, tokenToInstallationIds);

    if (dedupeKey) {
      await markSent(dedupeKey, {
        engineerId,
        title,
        body,
        link: resolvedLink,
        requestedTokens: tokens.length,
        successCount: resp.successCount,
        failureCount: resp.failureCount,
        ...meta,
      });
    }
  } catch (e) {
    logger.error("Failed to send push", { engineerId, error: e.message });
  }
}

exports.onTaskAssignedNotification = onDocumentCreated("tasks/{taskId}", async (event) => {
  const task = event.data?.data();
  if (!task) return;
  const engineerId = task.assignedEngineerId;
  if (!engineerId) return;

  const siteName = task.siteName || "-";
  const taskTitle = task.title || "Task";
  const due = formatDate(task.expectedCompletionDate);
  const body = `Site: ${siteName} | Task: ${taskTitle} | Due: ${due}`;

  await sendToEngineer({
    engineerId,
    title: "New Task Assigned",
    body,
    link: `/engineer?siteId=${encodeURIComponent(task.siteId || "")}&taskId=${encodeURIComponent(event.params.taskId)}`,
    dedupeKey: `task_assigned_${event.params.taskId}_${engineerId}`,
    meta: { type: "TASK_ASSIGNED", taskId: event.params.taskId },
  });
});

exports.onSiteReassignedNotification = onDocumentUpdated("sites/{siteId}", async (event) => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};

  if (before.assignedEngineerId === after.assignedEngineerId) return;
  if (!after.assignedEngineerId) return;

  const siteName = after.name || "Site";

  await sendToEngineer({
    engineerId: after.assignedEngineerId,
    title: "Site Assignment Updated",
    body: `You have been assigned to Site: ${siteName}`,
    link: `/engineer?siteId=${encodeURIComponent(event.params.siteId)}`,
    dedupeKey: `site_reassigned_${event.params.siteId}_${after.assignedEngineerId}_${Date.now()}`,
    meta: { type: "SITE_REASSIGNED", siteId: event.params.siteId },
  });
});

exports.sendOverdueTaskReminders = onSchedule(
  {
    schedule: "every day 09:00",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    const now = new Date();
    const pendingSnap = await db
      .collection("tasks")
      .where("status", "==", "PENDING")
      .get();

    const sends = [];
    pendingSnap.forEach((docSnap) => {
      const task = docSnap.data();
      const due = asDate(task.expectedCompletionDate);
      if (!due || due.getTime() >= now.getTime()) return;
      if (!task.assignedEngineerId) return;

      const dedupeKey = `overdue_${docSnap.id}_${weekKeyForDate(now)}_${now.getDate()}`;
      sends.push(
        sendToEngineer({
          engineerId: task.assignedEngineerId,
          title: "Task Overdue",
          body: `${task.title || "Task"} at ${task.siteName || "Site"} is overdue.`,
          link: `/engineer?siteId=${encodeURIComponent(task.siteId || "")}&taskId=${encodeURIComponent(docSnap.id)}`,
          dedupeKey,
          meta: { type: "TASK_OVERDUE", taskId: docSnap.id, siteId: task.siteId || "" },
        }),
      );
    });

    await Promise.all(sends);
    logger.info("Overdue reminder run complete", { sentCount: sends.length });
  },
);

exports.sendWeeklyPendingReminders = onSchedule(
  {
    schedule: "every monday 08:30",
    timeZone: "Asia/Kolkata",
  },
  async () => {
    const currentWeek = weekKeyForDate(new Date());
    const pendingSnap = await db
      .collection("tasks")
      .where("status", "==", "PENDING")
      .get();

    const engineerPending = new Map();
    pendingSnap.forEach((docSnap) => {
      const task = docSnap.data();
      if (!task.assignedEngineerId) return;
      if (!task.weekKey || task.weekKey >= currentWeek) return;
      engineerPending.set(task.assignedEngineerId, (engineerPending.get(task.assignedEngineerId) || 0) + 1);
    });

    const sends = [];
    for (const [engineerId, count] of engineerPending.entries()) {
      const dedupeKey = `weekly_pending_${engineerId}_${currentWeek}`;
      sends.push(
        sendToEngineer({
          engineerId,
          title: "Pending Tasks Reminder",
          body: count > 0
            ? "You have pending tasks from last week."
            : "You have pending tasks.",
          link: "/engineer",
          dedupeKey,
          meta: { type: "WEEKLY_PENDING", count, weekKey: currentWeek },
        }),
      );
    }
    await Promise.all(sends);
    logger.info("Weekly pending reminder run complete", { sentCount: sends.length });
  },
);
