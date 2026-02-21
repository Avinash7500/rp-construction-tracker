function safeToDate(v) {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

const MARATHI_MONTHS = [
  "जानेवारी",
  "फेब्रुवारी",
  "मार्च",
  "एप्रिल",
  "मे",
  "जून",
  "जुलै",
  "ऑगस्ट",
  "सप्टेंबर",
  "ऑक्टोबर",
  "नोव्हेंबर",
  "डिसेंबर",
];

function marathiWeekLabelByDay(dayOfMonth) {
  if (dayOfMonth >= 1 && dayOfMonth <= 7) return "पहिला आठवडा";
  if (dayOfMonth >= 8 && dayOfMonth <= 14) return "दुसरा आठवडा";
  if (dayOfMonth >= 15 && dayOfMonth <= 21) return "तिसरा आठवडा";
  if (dayOfMonth >= 22 && dayOfMonth <= 28) return "चौथा आठवडा";
  return "पाचवा आठवडा";
}

export function formatMarathiWeekFromDate(inputDate) {
  const d = safeToDate(inputDate);
  if (!d) return "-";
  const monthName = MARATHI_MONTHS[d.getMonth()] || "-";
  const weekLabel = marathiWeekLabelByDay(d.getDate());
  return `${monthName} - ${weekLabel}`;
}

function isoWeekStartDate(year, week) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - jan4Day + 1);
  const result = new Date(mondayWeek1);
  result.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  return result;
}

export function formatMarathiWeekFromWeekKey(weekKey) {
  const s = (weekKey || "").toString().trim();
  const m = s.match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return "-";
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    return "-";
  }
  const date = isoWeekStartDate(year, week);
  return formatMarathiWeekFromDate(date);
}
