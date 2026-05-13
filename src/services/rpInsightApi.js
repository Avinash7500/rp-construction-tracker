const RP_INSIGHT_API_BASE = (
  import.meta.env.VITE_RP_INSIGHT_API_BASE || "http://localhost:8081"
).replace(/\/+$/, "");

async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || `RP Insight request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export async function uploadRpInsightFile({ siteId, file }) {
  const body = new FormData();
  body.append("siteId", siteId);
  body.append("file", file);

  const response = await fetch(`${RP_INSIGHT_API_BASE}/api/rp-insight/upload`, {
    method: "POST",
    body,
  });

  return parseResponse(response);
}

export async function getRpInsightFile(fileId) {
  const response = await fetch(
    `${RP_INSIGHT_API_BASE}/api/rp-insight/files/${encodeURIComponent(fileId)}`,
  );

  return parseResponse(response);
}

export async function askRpInsight({ siteId, question, topK }) {
  const payload = { siteId, question };
  if (topK) payload.topK = topK;

  const response = await fetch(`${RP_INSIGHT_API_BASE}/api/rp-insight/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

