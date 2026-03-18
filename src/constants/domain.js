export const PLATFORMS = ["Wallapop", "Vinted"];

export const PRODUCT_STATUS = [
  "En venta",
  "Vendido",
  "Descartado",
  "Me lo quedo"
];

export const CATEGORIES = [
  "Electrónica",
  "Ropa",
  "Hogar",
  "Juguetes",
  "Belleza",
  "Deporte",
  "Libros/Media",
  "Accesorios",
  "Otros"
];

export const CONDITIONS = ["Nuevo", "Bueno", "Aceptable", "Dañado"];

export const STATUS_KEYS = {
  "En venta": "listed",
  Vendido: "sold",
  Descartado: "discarded",
  "Me lo quedo": "kept"
};

export const CATEGORY_KEYS = {
  "Electrónica": "electronics",
  Ropa: "clothes",
  Hogar: "home",
  Juguetes: "toys",
  Belleza: "beauty",
  Deporte: "sports",
  "Libros/Media": "booksMedia",
  Accesorios: "accessories",
  Otros: "others"
};

export const CONDITION_KEYS = {
  Nuevo: "new",
  Bueno: "good",
  Aceptable: "acceptable",
  "Dañado": "damaged"
};

export const PLATFORM_KEYS = {
  Wallapop: "wallapop",
  Vinted: "vinted",
  Otro: "other"
};

export const STATUS_BADGE_COLORS = {
  listed: "blue",
  sold: "green",
  discarded: "red",
  kept: "purple"
};

export const ALERT_LEVELS = [
  {
    days: 7,
    level: "notice",
    color: "var(--info)",
    bg: "rgba(87,58,116,.24)",
    border: "rgba(184,154,214,.48)",
    icon: "🪻",
    messageKey: "alerts.reviewListing"
  },
  {
    days: 14,
    level: "warning",
    color: "var(--warning)",
    bg: "rgba(122,88,47,.26)",
    border: "rgba(231,197,140,.48)",
    icon: "⚠️",
    messageKey: "alerts.reducePrice",
    dropPercents: [20, 30]
  },
  {
    days: 28,
    level: "urgent",
    color: "var(--alert)",
    bg: "rgba(124,81,52,.28)",
    border: "rgba(213,155,105,.5)",
    icon: "🔥",
    messageKey: "alerts.sellAtCost"
  },
  {
    days: 42,
    level: "critical",
    color: "var(--danger)",
    bg: "rgba(108,42,63,.32)",
    border: "rgba(200,106,130,.55)",
    icon: "🚨",
    messageKey: "alerts.freeCapital"
  }
];

export const TERMINAL_STATUS = new Set(["Vendido", "Descartado", "Me lo quedo"]);

export const getStatusKey = (value) => STATUS_KEYS[value] || "listed";
export const getCategoryKey = (value) => CATEGORY_KEYS[value] || "others";
export const getConditionKey = (value) => CONDITION_KEYS[value] || "good";
export const getPlatformKey = (value) => PLATFORM_KEYS[value] || "other";

export const isTerminalStatus = (status) => TERMINAL_STATUS.has(status);
export const isSoldStatus = (status) => status === "Vendido";
export const isDiscardedOrKeptStatus = (status) => status === "Descartado" || status === "Me lo quedo";
