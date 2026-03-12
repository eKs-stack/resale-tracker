export const PLATFORMS = ["Wallapop", "Vinted"];

export const PRODUCT_STATUS = [
  "Pendiente",
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
  "Pendiente": "pending",
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
  pending: "yellow",
  listed: "blue",
  sold: "green",
  discarded: "red",
  kept: "purple"
};

export const ALERT_LEVELS = [
  {
    days: 14,
    level: "warning",
    color: "#fd0",
    bg: "#1a1800",
    border: "#3a3200",
    icon: "⚠️",
    messageKey: "alerts.reducePrice"
  },
  {
    days: 28,
    level: "urgent",
    color: "#f90",
    bg: "#1a1000",
    border: "#3a2200",
    icon: "🔥",
    messageKey: "alerts.sellAtCost"
  },
  {
    days: 42,
    level: "critical",
    color: "#f43",
    bg: "#1a0808",
    border: "#3a1515",
    icon: "🚨",
    messageKey: "alerts.freeCapital"
  }
];

export const TERMINAL_STATUS = new Set(["Vendido", "Descartado", "Me lo quedo"]);

export const getStatusKey = (value) => STATUS_KEYS[value] || "pending";
export const getCategoryKey = (value) => CATEGORY_KEYS[value] || "others";
export const getConditionKey = (value) => CONDITION_KEYS[value] || "good";
export const getPlatformKey = (value) => PLATFORM_KEYS[value] || "other";

export const isTerminalStatus = (status) => TERMINAL_STATUS.has(status);
export const isSoldStatus = (status) => status === "Vendido";
export const isDiscardedOrKeptStatus = (status) => status === "Descartado" || status === "Me lo quedo";
