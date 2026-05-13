export function normalizeMarathiText(value) {
  if (typeof value !== "string" || !value) return value;
  // Already valid Marathi Unicode.
  if (/[\u0900-\u097F]/.test(value)) return value;

  // Common UTF-8 mojibake markers (UTF-8 bytes read as latin1/win1252).
  if (!/(?:\u00e0\u00a4|\u00e0\u00a5|\u00c3|\u00e2\u201a|\u00f0\u0178)/.test(value)) {
    return value;
  }

  try {
    const bytes = new Uint8Array([...value].map((ch) => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded || value;
  } catch {
    return value;
  }
}
