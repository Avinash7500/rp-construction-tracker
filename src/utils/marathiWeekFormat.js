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

