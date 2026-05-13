function readBooleanEnv(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

export const isRpInsightEnabled = readBooleanEnv(
  import.meta.env.VITE_RP_INSIGHT_ENABLED,
  false,
);

