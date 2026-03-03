function safeToDate(value) {
  if (!value) return null;
  try {
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export const PENDING_REASON_OPTIONS = [
  "MATERIAL साहित्य उपलब्ध नाही",
  "LABOUR उपलब्ध नाहीत",
  "LABOUR फोन उचलत नाहीत",
  "पुरवठादाराकडून विलंब",
  "मालकाची मान्यता प्रलंबित",
  "WEATHER_ISSUE",
  "डिझाइनमध्ये बदल",
  "इतर कारण",
];

export function getPendingHistory(task) {
  return Array.isArray(task?.pendingHistory) ? task.pendingHistory : [];
}

export function getLatestPendingReason(task) {
  const history = getPendingHistory(task);
  if (history.length === 0) return null;

  return [...history].sort((a, b) => {
    const aTs = safeToDate(a?.loggedAt)?.getTime() || 0;
    const bTs = safeToDate(b?.loggedAt)?.getTime() || 0;
    return bTs - aTs;
  })[0];
}

export function isPendingReasonComplianceRequired(task, pendingDays) {
  if (task?.status !== "PENDING") return false;
  if (pendingDays === null || pendingDays === undefined) return false;
  if (pendingDays <= 3) return false;
  return getPendingHistory(task).length === 0;
}

