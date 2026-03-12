import { ALERT_LEVELS, isDiscardedOrKeptStatus, isSoldStatus, isTerminalStatus } from "../constants/domain";

export const generateId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().replaceAll("-", "")
    : Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

export const parseDateValue = (value) => {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const dayOfWeek = (dateStr) => {
  const parsed = parseDateValue(dateStr);
  return parsed ? parsed.getDay() : -1;
};

export const formatDate = (value, locale = "es-ES") => {
  const parsed = parseDateValue(value);
  if (!parsed) return "";

  return parsed.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short"
  });
};

export const formatCurrency = (value, locale = "es-ES") =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

export const getMonthKey = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return null;

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

export const getYearKey = (value) => {
  const parsed = parseDateValue(value);
  return parsed ? String(parsed.getFullYear()) : null;
};

export const formatMonthKey = (key, locale = "es-ES") => {
  if (!key) return "";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "short",
    year: "numeric"
  });
};

export const getDayLabel = (dateStr, locale = "es-ES", t) => {
  const day = dayOfWeek(dateStr);
  if (day === 2) return t("weekdays.tuesday");
  if (day === 3) return t("weekdays.wednesday");

  const parsed = parseDateValue(dateStr);
  if (!parsed) return "";
  return parsed.toLocaleDateString(locale, { weekday: "long" });
};

export const getDaysSince = (dateStr) => {
  const parsed = parseDateValue(dateStr);
  if (!parsed) return 0;

  return Math.floor((Date.now() - parsed.getTime()) / 86400000);
};

export const getAlertLevel = (product, t) => {
  if (isTerminalStatus(product?.status)) return null;

  const days = getDaysSince(product?.createdAt);
  let matched = null;

  for (const alert of ALERT_LEVELS) {
    if (days >= alert.days) {
      matched = {
        ...alert,
        daysSince: days,
        message: t(alert.messageKey)
      };
    }
  }

  return matched;
};

export const getProductQuantity = (product) =>
  Math.max(1, parseInt(product?.quantity, 10) || 1);

export const getSoldQuantity = (product) => {
  const quantity = getProductQuantity(product);

  if (typeof product?.soldQuantity === "number") {
    return Math.max(0, Math.min(quantity, product.soldQuantity));
  }

  if (isSoldStatus(product?.status)) return quantity;

  return 0;
};

export const getProductRevenue = (product) => Number(product?.soldPrice) || 0;

export const getSoldUnitPrice = (product) => {
  const explicit = Number(product?.soldUnitPrice) || 0;
  if (explicit > 0) return explicit;

  const soldQty = getSoldQuantity(product);
  const total = getProductRevenue(product);

  return soldQty > 0 ? total / soldQty : 0;
};

export const getAvailableQuantity = (product) =>
  Math.max(0, getProductQuantity(product) - getSoldQuantity(product));

export const getCostPerProduct = (product, packages, products) => {
  const pkg = packages.find((item) => item.id === product.packageId);
  if (!pkg) return 0;

  const count = products.filter((item) => item.packageId === pkg.id).length;
  return count > 0 ? (Number(pkg.cost) || 0) / count : Number(pkg.cost) || 0;
};

export const buildStats = (packages, products, locale = "es-ES") => {
  const totalCost = packages.reduce((sum, pkg) => sum + (Number(pkg.cost) || 0), 0);
  const totalRev = products.reduce((sum, product) => sum + getProductRevenue(product), 0);
  const soldUnits = products.reduce((sum, product) => sum + getSoldQuantity(product), 0);
  const totalUnits = products.reduce((sum, product) => sum + getProductQuantity(product), 0);
  const availableUnits = products.reduce((sum, product) => sum + getAvailableQuantity(product), 0);

  const pendingCount = products
    .filter((product) => !isTerminalStatus(product.status))
    .reduce((sum, product) => sum + getAvailableQuantity(product), 0);

  const profit = totalRev - totalCost;
  const sellThroughRate = totalUnits > 0 ? (soldUnits / totalUnits) * 100 : 0;
  const marginRate = totalRev > 0 ? (profit / totalRev) * 100 : 0;
  const recoveryRate = totalCost > 0 ? (totalRev / totalCost) * 100 : 0;

  const tuesdayPackages = packages.filter((pkg) => dayOfWeek(pkg.date) === 2);
  const wednesdayPackages = packages.filter((pkg) => dayOfWeek(pkg.date) === 3);

  const tuesdayIds = new Set(tuesdayPackages.map((pkg) => pkg.id));
  const wednesdayIds = new Set(wednesdayPackages.map((pkg) => pkg.id));

  const tuesdayRevenue = products
    .filter((product) => tuesdayIds.has(product.packageId))
    .reduce((sum, product) => sum + getProductRevenue(product), 0);

  const tuesdayCost = tuesdayPackages.reduce(
    (sum, pkg) => sum + (Number(pkg.cost) || 0),
    0
  );

  const wednesdayRevenue = products
    .filter((product) => wednesdayIds.has(product.packageId))
    .reduce((sum, product) => sum + getProductRevenue(product), 0);

  const wednesdayCost = wednesdayPackages.reduce(
    (sum, pkg) => sum + (Number(pkg.cost) || 0),
    0
  );

  const activeProductsList = products.filter(
    (product) => getAvailableQuantity(product) > 0 && !isDiscardedOrKeptStatus(product.status)
  );

  const activeProducts = activeProductsList.length;
  const activeCapital = activeProductsList.reduce(
    (sum, product) => sum + getCostPerProduct(product, packages, products),
    0
  );

  const byCat = {};
  products.forEach((product) => {
    const rev = getProductRevenue(product);
    if (rev <= 0) return;

    if (!byCat[product.category]) byCat[product.category] = { revenue: 0 };
    byCat[product.category].revenue += rev;
  });

  const catData = Object.entries(byCat)
    .map(([label, value]) => ({ label, value: value.revenue }))
    .sort((a, b) => b.value - a.value);

  const byPlat = {};
  products.forEach((product) => {
    const rev = getProductRevenue(product);
    if (rev <= 0) return;

    const platform = product.soldPlatform || "Otro";
    if (!byPlat[platform]) byPlat[platform] = { revenue: 0 };
    byPlat[platform].revenue += rev;
  });

  const platData = Object.entries(byPlat)
    .map(([label, value]) => ({ label, value: value.revenue }))
    .sort((a, b) => b.value - a.value);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYearKey = String(now.getFullYear());

  const soldProducts = products.filter(
    (product) => isSoldStatus(product.status) && getProductRevenue(product) > 0
  );

  const soldProductsCount = soldProducts.length;
  const avgUnitRevenue = soldUnits > 0 ? totalRev / soldUnits : 0;
  const avgProductRevenue = soldProductsCount > 0 ? totalRev / soldProductsCount : 0;

  const estimatedOpenRevenue = activeProductsList.reduce((sum, product) => {
    const estPrice = Number(product.estPrice) || 0;
    if (estPrice <= 0) return sum;

    return sum + estPrice * getAvailableQuantity(product);
  }, 0);

  const estimatedOpenProfit = estimatedOpenRevenue - activeCapital;

  const monthSales = soldProducts.filter(
    (product) => getMonthKey(product.soldDate || product.createdAt) === currentMonthKey
  );

  const yearSales = soldProducts.filter(
    (product) => getYearKey(product.soldDate || product.createdAt) === currentYearKey
  );

  const monthRevenue = monthSales.reduce((sum, product) => sum + getProductRevenue(product), 0);
  const yearRevenue = yearSales.reduce((sum, product) => sum + getProductRevenue(product), 0);

  const monthSoldUnits = monthSales.reduce((sum, product) => sum + getSoldQuantity(product), 0);
  const yearSoldUnits = yearSales.reduce((sum, product) => sum + getSoldQuantity(product), 0);

  const monthCost = packages
    .filter((pkg) => getMonthKey(pkg.date) === currentMonthKey)
    .reduce((sum, pkg) => sum + (Number(pkg.cost) || 0), 0);

  const yearCost = packages
    .filter((pkg) => getYearKey(pkg.date) === currentYearKey)
    .reduce((sum, pkg) => sum + (Number(pkg.cost) || 0), 0);

  const monthProfit = monthRevenue - monthCost;
  const yearProfit = yearRevenue - yearCost;

  const monthMap = {};
  const yearMap = {};

  packages.forEach((pkg) => {
    const monthKey = getMonthKey(pkg.date);
    const yearKey = getYearKey(pkg.date);

    if (monthKey) {
      if (!monthMap[monthKey]) monthMap[monthKey] = { cost: 0, revenue: 0 };
      monthMap[monthKey].cost += Number(pkg.cost) || 0;
    }

    if (yearKey) {
      if (!yearMap[yearKey]) yearMap[yearKey] = { cost: 0, revenue: 0 };
      yearMap[yearKey].cost += Number(pkg.cost) || 0;
    }
  });

  soldProducts.forEach((product) => {
    const sourceDate = product.soldDate || product.createdAt;
    const monthKey = getMonthKey(sourceDate);
    const yearKey = getYearKey(sourceDate);
    const revenue = getProductRevenue(product);

    if (monthKey) {
      if (!monthMap[monthKey]) monthMap[monthKey] = { cost: 0, revenue: 0 };
      monthMap[monthKey].revenue += revenue;
    }

    if (yearKey) {
      if (!yearMap[yearKey]) yearMap[yearKey] = { cost: 0, revenue: 0 };
      yearMap[yearKey].revenue += revenue;
    }
  });

  const monthBreakdown = Object.entries(monthMap)
    .map(([key, value]) => ({
      key,
      label: formatMonthKey(key, locale),
      cost: value.cost,
      revenue: value.revenue,
      profit: value.revenue - value.cost
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const yearBreakdown = Object.entries(yearMap)
    .map(([key, value]) => ({
      key,
      label: key,
      cost: value.cost,
      revenue: value.revenue,
      profit: value.revenue - value.cost
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    totalCost,
    totalRev,
    profit,
    roi: totalCost > 0 ? ((profit / totalCost) * 100).toFixed(0) : 0,
    totalPkgs: packages.length,
    soldCount: soldUnits,
    pendingCount,
    totalUnits,
    availableUnits,
    sellThroughRate,
    marginRate,
    recoveryRate,
    activeProducts,
    activeCapital,
    soldProductsCount,
    avgUnitRevenue,
    avgProductRevenue,
    estimatedOpenRevenue,
    estimatedOpenProfit,
    avgPerPkg: packages.length ? totalRev / packages.length : 0,
    martes: {
      cost: tuesdayCost,
      revenue: tuesdayRevenue,
      profit: tuesdayRevenue - tuesdayCost,
      count: tuesdayPackages.length
    },
    miercoles: {
      cost: wednesdayCost,
      revenue: wednesdayRevenue,
      profit: wednesdayRevenue - wednesdayCost,
      count: wednesdayPackages.length
    },
    month: {
      cost: monthCost,
      revenue: monthRevenue,
      profit: monthProfit,
      soldUnits: monthSoldUnits
    },
    year: {
      cost: yearCost,
      revenue: yearRevenue,
      profit: yearProfit,
      soldUnits: yearSoldUnits
    },
    monthLabel: now.toLocaleDateString(locale, { month: "long" }),
    yearLabel: currentYearKey,
    monthBreakdown,
    yearBreakdown,
    catData,
    platData
  };
};
