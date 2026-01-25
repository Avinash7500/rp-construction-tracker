// src/utils/reportSnapshotBuilder.js
import { getISOWeekKey } from "./weekUtils";

export function buildWeeklySnapshot({ sites, tasks, user }) {
  const weekKey = getISOWeekKey();

  // ✅ Weekly range (Mon-Sun) based on current date
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const pad = (n) => String(n).padStart(2, "0");
  const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const range = {
    type: "WEEK",
    from: toYMD(monday),
    to: toYMD(sunday),
  };

  // ✅ Summary calc
  const totalSites = sites.length;
  const totalTasks = tasks.length;

  const done = tasks.filter((t) => t.status === "DONE").length;
  const pending = tasks.filter((t) => t.status === "PENDING").length;
  const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;

  let overdue = 0;
  tasks.forEach((t) => {
    const site = sites.find((s) => s.id === t.siteId);
    if (!site) return;

    const currentWeekKey = site.currentWeekKey || "";
    if (t.status === "PENDING" && t.weekKey && currentWeekKey && t.weekKey < currentWeekKey) {
      overdue += 1;
    }
  });

  // ✅ Engineer breakdown
  const engineerMap = new Map();

  // Init from sites
  sites.forEach((s) => {
    const uid = s.assignedEngineerId || "UNKNOWN";
    const name = s.assignedEngineerName || "Unknown Engineer";

    if (!engineerMap.has(uid)) {
      engineerMap.set(uid, {
        engineerUid: uid,
        name,
        pending: 0,
        done: 0,
        cancelled: 0,
      });
    }
  });

  // Aggregate tasks
  tasks.forEach((t) => {
    const site = sites.find((s) => s.id === t.siteId);
    if (!site) return;

    const engUid = site.assignedEngineerId || "UNKNOWN";
    const engName = site.assignedEngineerName || "Unknown Engineer";

    if (!engineerMap.has(engUid)) {
      engineerMap.set(engUid, {
        engineerUid: engUid,
        name: engName,
        pending: 0,
        done: 0,
        cancelled: 0,
      });
    }

    const row = engineerMap.get(engUid);

    if (t.status === "PENDING") row.pending += 1;
    if (t.status === "DONE") row.done += 1;
    if (t.status === "CANCELLED") row.cancelled += 1;
  });

  return {
    weekKey,
    createdBy: user?.uid || null,
    range,
    summary: {
      totalSites,
      totalTasks,
      done,
      pending,
      cancelled,
      overdue,
    },
    engineerBreakdown: Array.from(engineerMap.values()),
  };
}
