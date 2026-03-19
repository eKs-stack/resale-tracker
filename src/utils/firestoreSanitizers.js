import { CATEGORIES, CONDITIONS, PLATFORMS, PRODUCT_STATUS } from "../constants/domain";
import {
  sanitizeDateInput,
  sanitizeImageDataUrl,
  sanitizeInteger,
  sanitizeIsoDate,
  sanitizeNumber,
  sanitizeText
} from "./inputSanitizers";

const DEFAULT_CATEGORY = CATEGORIES[CATEGORIES.length - 1];
const DEFAULT_CONDITION = "Bueno";
const DEFAULT_PLATFORM = "Wallapop";
const DEFAULT_STATUS = "En venta";
const sanitizeCategory = (value) => sanitizeText(value, 80) || DEFAULT_CATEGORY;

const pickAllowed = (value, allowedValues, fallback) =>
  allowedValues.includes(value) ? value : fallback;

export const sanitizePackageDoc = (raw, id) => {
  const nowDate = nowInputDate();

  return {
    id,
    date: sanitizeDateInput(raw?.date, nowDate),
    cost: sanitizeNumber(raw?.cost, { min: 0, max: 100000, decimals: 2, fallback: 0 }),
    notes: sanitizeText(raw?.notes, 500),
    addedBy: sanitizeText(raw?.addedBy, 120),
    addedAt: sanitizeIsoDate(raw?.addedAt, null),
    updatedAt: sanitizeIsoDate(raw?.updatedAt, null),
    updatedBy: sanitizeText(raw?.updatedBy, 120)
  };
};

export const sanitizeProductDoc = (raw, id) => {
  const quantity = sanitizeInteger(raw?.quantity, { min: 1, max: 500, fallback: 1 });
  const soldQuantity = sanitizeInteger(raw?.soldQuantity, {
    min: 0,
    max: quantity,
    fallback: 0
  });

  const soldPrice = sanitizeNumber(raw?.soldPrice, {
    min: 0,
    max: 100000,
    decimals: 2,
    fallback: 0
  });

  const estPrice = sanitizeNumber(raw?.estPrice, {
    min: 0,
    max: 100000,
    decimals: 2,
    fallback: 0
  });

  return {
    id,
    name: sanitizeText(raw?.name, 160),
    category: sanitizeCategory(raw?.category),
    packageId: sanitizeText(raw?.packageId, 120),
    condition: pickAllowed(raw?.condition, CONDITIONS, DEFAULT_CONDITION),
    quantity,
    estPrice,
    status: pickAllowed(raw?.status, PRODUCT_STATUS, DEFAULT_STATUS),
    notes: sanitizeText(raw?.notes, 1000),
    createdAt: sanitizeIsoDate(raw?.createdAt, null),
    updatedAt: sanitizeIsoDate(raw?.updatedAt, null),
    soldQuantity,
    soldPrice,
    soldUnitPrice:
      soldQuantity > 0
        ? sanitizeNumber(raw?.soldUnitPrice ?? soldPrice / soldQuantity, {
            min: 0,
            max: 100000,
            decimals: 2,
            fallback: 0
          })
        : null,
    soldPlatform: raw?.soldPlatform
      ? pickAllowed(raw.soldPlatform, PLATFORMS, DEFAULT_PLATFORM)
      : null,
    soldDate: sanitizeDateInput(raw?.soldDate, null),
    soldBy: sanitizeText(raw?.soldBy, 120),
    reviewedAlertDays: sanitizeInteger(raw?.reviewedAlertDays, {
      min: 0,
      max: 3650,
      fallback: 0
    }),
    reviewedAt: sanitizeIsoDate(raw?.reviewedAt, null),
    reviewedBy: sanitizeText(raw?.reviewedBy, 120),
    addedBy: sanitizeText(raw?.addedBy, 120),
    sourceProductId: sanitizeText(raw?.sourceProductId, 120),
    imageDataUrl: sanitizeImageDataUrl(raw?.imageDataUrl),
    sales: Array.isArray(raw?.sales) ? raw.sales.slice(0, 200) : []
  };
};

export const nowInputDate = () => new Date().toISOString().split("T")[0];
