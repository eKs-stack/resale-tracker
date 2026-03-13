export const sanitizeText = (value, maxLength = 120) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

export const sanitizeInteger = (
  value,
  { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}
) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const sanitizeNumber = (
  value,
  {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    decimals = 2,
    fallback = 0
  } = {}
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  const clamped = Math.min(max, Math.max(min, parsed));
  const factor = 10 ** decimals;
  return Math.round(clamped * factor) / factor;
};

export const sanitizeDateInput = (value, fallback = null) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return fallback;
};

export const sanitizeIsoDate = (value, fallback = null) => {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return fallback;
};

export const sanitizeImageDataUrl = (
  value,
  { maxLength = 900000, fallback = "" } = {}
) => {
  if (typeof value !== "string") return fallback;

  const safeValue = value.trim();
  if (!safeValue) return fallback;
  if (safeValue.length > maxLength) return fallback;
  if (!safeValue.startsWith("data:image/")) return fallback;
  if (!safeValue.includes(";base64,")) return fallback;

  return safeValue;
};
