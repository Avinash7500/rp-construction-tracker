import {
  formatMarathiWeekFromDate,
  formatMarathiWeekFromWeekKey,
} from "./marathiWeekFormat";

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

export function formatDate(value) {
  const d = safeToDate(value);
  if (!d) return "-";
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, "-");
}

export function formatDateTime(value) {
  const d = safeToDate(value);
  if (!d) return "-";
  const datePart = formatDate(d);
  const timePart = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

export function getWeekLabel(weekKey, fallbackDate = null) {
  if (weekKey) {
    const fromWeekKey = formatMarathiWeekFromWeekKey(weekKey);
    if (fromWeekKey && fromWeekKey !== "-") return fromWeekKey;
  }
  if (fallbackDate) return formatMarathiWeekFromDate(fallbackDate);
  return "-";
}

export function getDayLabel(dayValue) {
  const raw = String(dayValue || "").trim();
  if (!raw) return "-";

  const normalized = raw.toUpperCase().replace(/\s+/g, "_");
  const englishToMarathi = {
    MONDAY: "\u0938\u094b\u092e\u0935\u093e\u0930",
    TUESDAY: "\u092e\u0902\u0917\u0933\u0935\u093e\u0930",
    WEDNESDAY: "\u092c\u0941\u0927\u0935\u093e\u0930",
    THURSDAY: "\u0917\u0941\u0930\u0941\u0935\u093e\u0930",
    FRIDAY: "\u0936\u0941\u0915\u094d\u0930\u0935\u093e\u0930",
    SATURDAY: "\u0936\u0928\u093f\u0935\u093e\u0930",
    SUNDAY: "\u0930\u0935\u093f\u0935\u093e\u0930",
  };

  return englishToMarathi[normalized] || raw;
}

