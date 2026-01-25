// ✅ src/utils/weekUtils.js

export function getISOWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // ISO week starts Monday
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getNextWeekKey(currentWeekKey) {
  if (!currentWeekKey || !currentWeekKey.includes("-W")) {
    return getISOWeekKey();
  }

  const [yearStr, weekStr] = currentWeekKey.split("-W");
  let year = Number(yearStr);
  let week = Number(weekStr);

  if (Number.isNaN(year) || Number.isNaN(week)) {
    return getISOWeekKey();
  }

  week += 1;

  // Basic rollover
  if (week > 53) {
    week = 1;
    year += 1;
  }

  return `${year}-W${String(week).padStart(2, "0")}`;
}
