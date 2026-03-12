import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { deleteDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { auth, db } from "../../firebase";
import useTrackerCollections from "../../hooks/useTrackerCollections";
import {
  CATEGORIES,
  CONDITIONS,
  getCategoryKey,
  getConditionKey,
  getPlatformKey,
  getStatusKey,
  isDiscardedOrKeptStatus,
  isSoldStatus,
  PLATFORMS,
  PRODUCT_STATUS,
  STATUS_BADGE_COLORS
} from "../../constants/domain";
import {
  buildStats,
  dayOfWeek,
  formatCurrency,
  formatDate,
  generateId,
  getAlertLevel,
  getAvailableQuantity,
  getCostPerProduct,
  getDayLabel,
  getProductQuantity,
  getProductRevenue,
  getSoldQuantity,
  getSoldUnitPrice
} from "../../utils/trackerUtils";
import {
  sanitizeDateInput,
  sanitizeInteger,
  sanitizeNumber,
  sanitizeText
} from "../../utils/inputSanitizers";
import { nowInputDate } from "../../utils/firestoreSanitizers";
import { btnP, inputS, selectS } from "../../constants/styles";
import AppLogo from "../../components/ui/AppLogo";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import Field from "../../components/ui/Field";
import LanguageSelector from "../../components/ui/LanguageSelector";
import MiniBar from "../../components/ui/MiniBar";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import LoadingScreen from "../../components/ui/LoadingScreen";

export default function Tracker({ user }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || "es";
  const { packages, products, loading } = useTrackerCollections();

  const [tab, setTab] = useState("dashboard");
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [showAddProd, setShowAddProd] = useState(false);
  const [showSell, setShowSell] = useState(null);
  const [showPkgDetails, setShowPkgDetails] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editPackage, setEditPackage] = useState(null);

  const [productSearch, setProductSearch] = useState("");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [pkgSelectionMode, setPkgSelectionMode] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState(new Set());

  const [pkgDate, setPkgDate] = useState(() => nowInputDate());
  const [pkgCost, setPkgCost] = useState("");
  const [pkgQty, setPkgQty] = useState("1");
  const [pkgNotes, setPkgNotes] = useState("");

  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState(CATEGORIES[CATEGORIES.length - 1]);
  const [prodPkgId, setProdPkgId] = useState("");
  const [prodCond, setProdCond] = useState("Bueno");
  const [prodQty, setProdQty] = useState("1");
  const [prodEst, setProdEst] = useState("");
  const [prodNotes, setProdNotes] = useState("");

  const [sellPrice, setSellPrice] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [sellPlat, setSellPlat] = useState("Wallapop");
  const [sellDate, setSellDate] = useState(() => nowInputDate());

  const currency = (value) => formatCurrency(value, locale);
  const shortDate = (value) => formatDate(value, locale);

  const statusLabel = (value) => t(`status.${getStatusKey(value)}`);
  const categoryLabel = (value) => t(`categories.${getCategoryKey(value)}`);
  const conditionLabel = (value) => t(`conditions.${getConditionKey(value)}`);
  const platformLabel = (value) => t(`platforms.${getPlatformKey(value)}`);
  const actor = () => sanitizeText(user.displayName || user.email || "unknown", 120);

  useEffect(() => {
    if (tab !== "products" && selectionMode) {
      setSelectionMode(false);
      setSelectedProductIds(new Set());
    }
  }, [tab, selectionMode]);

  useEffect(() => {
    if (tab !== "packages" && pkgSelectionMode) {
      setPkgSelectionMode(false);
      setSelectedPackageIds(new Set());
    }
  }, [tab, pkgSelectionMode]);

  useEffect(() => {
    if (selectedProductIds.size === 0) return;

    const validIds = new Set(products.map((product) => product.id));
    setSelectedProductIds((previous) => {
      let changed = false;
      const next = new Set();

      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      });

      return changed ? next : previous;
    });
  }, [products, selectedProductIds.size]);

  useEffect(() => {
    if (selectedPackageIds.size === 0) return;

    const validIds = new Set(packages.map((pkg) => pkg.id));
    setSelectedPackageIds((previous) => {
      let changed = false;
      const next = new Set();

      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
        else changed = true;
      });

      return changed ? next : previous;
    });
  }, [packages, selectedPackageIds.size]);

  const getPackageById = (id) => packages.find((pkg) => pkg.id === id);

  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [packages]
  );

  const currentSellProduct = useMemo(
    () => products.find((product) => product.id === showSell) || null,
    [products, showSell]
  );

  const sellAvailableQty = currentSellProduct ? getAvailableQuantity(currentSellProduct) : 0;
  const sellQtyNum = Math.max(1, parseInt(sellQty, 10) || 1);
  const sellUnitPriceNum = Math.max(0, parseFloat(sellPrice) || 0);
  const sellPreviewTotal = sellQtyNum * sellUnitPriceNum;

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === showPkgDetails) || null,
    [packages, showPkgDetails]
  );

  const selectedPackageProducts = useMemo(() => {
    if (!showPkgDetails) return [];

    return products
      .filter((product) => product.packageId === showPkgDetails)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [products, showPkgDetails]);

  const stats = useMemo(() => buildStats(packages, products, locale), [packages, products, locale]);

  const staleProducts = useMemo(
    () =>
      products
        .map((product) => ({ ...product, alert: getAlertLevel(product, t) }))
        .filter((product) => product.alert && getAvailableQuantity(product) > 0)
        .sort((a, b) => b.alert.days - a.alert.days),
    [products, t]
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    let list = [...products];

    if (query) {
      list = list.filter((product) => {
        const searchable = [
          product.name,
          product.category,
          categoryLabel(product.category),
          product.notes,
          product.condition,
          conditionLabel(product.condition)
        ];

        return searchable.some((value) => (value || "").toLowerCase().includes(query));
      });
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [products, productSearch, locale]);

  const productsForSale = useMemo(
    () => filteredProducts.filter((product) => !isSoldStatus(product.status)),
    [filteredProducts]
  );

  const productsSold = useMemo(
    () => filteredProducts.filter((product) => isSoldStatus(product.status)),
    [filteredProducts]
  );

  const chartCategoryData = useMemo(
    () =>
      stats.catData.map((item) => ({
        ...item,
        label: categoryLabel(item.label)
      })),
    [stats.catData, locale]
  );

  const chartPlatformData = useMemo(
    () =>
      stats.platData.map((item) => ({
        ...item,
        label: platformLabel(item.label)
      })),
    [stats.platData, locale]
  );

  const openSellModal = (productId) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const available = getAvailableQuantity(product);
    if (available <= 0) return;

    setSellPrice("");
    setSellQty("1");
    setSellPlat(product.soldPlatform || "Wallapop");
    setSellDate(nowInputDate());
    setShowSell(productId);
  };

  const openEditProduct = (product) => {
    const fallbackCategory = CATEGORIES[CATEGORIES.length - 1];
    const fallbackCondition = "Bueno";

    setEditProduct({
      id: product.id,
      name: product.name || "",
      category: CATEGORIES.includes(product.category) ? product.category : fallbackCategory,
      packageId: product.packageId || "",
      condition: CONDITIONS.includes(product.condition)
        ? product.condition
        : fallbackCondition,
      quantity: String(getProductQuantity(product)),
      estPrice: product.estPrice ? String(product.estPrice) : "",
      notes: product.notes || "",
      status: PRODUCT_STATUS.includes(product.status) ? product.status : "Pendiente",
      soldQuantity: String(getSoldQuantity(product)),
      soldPrice: getProductRevenue(product) ? String(getProductRevenue(product)) : "",
      soldUnitPrice: getSoldUnitPrice(product) ? String(getSoldUnitPrice(product)) : "",
      soldPlatform: product.soldPlatform || "Wallapop",
      soldDate: product.soldDate || nowInputDate()
    });
  };

  const openEditPackage = (pkg) => {
    setEditPackage({
      id: pkg.id,
      date: pkg.date || nowInputDate(),
      cost: pkg.cost ? String(pkg.cost) : "",
      notes: pkg.notes || ""
    });
  };

  const addPkg = async () => {
    const safeDate = sanitizeDateInput(pkgDate, nowInputDate());
    const quantity = sanitizeInteger(pkgQty, { min: 1, max: 200, fallback: 1 });
    const manualCost = sanitizeNumber(pkgCost, {
      min: 0,
      max: 100000,
      decimals: 2,
      fallback: 0
    });
    const cost = pkgCost ? manualCost : dayOfWeek(safeDate) === 3 ? 3 : 6;
    if (cost <= 0) return;

    const batch = writeBatch(db);
    const baseTime = Date.now();
    const addedBy = actor();
    const notes = sanitizeText(pkgNotes, 500);

    for (let index = 0; index < quantity; index += 1) {
      const id = generateId();
      const pkg = {
        id,
        date: safeDate,
        cost,
        notes,
        addedBy,
        addedAt: new Date(baseTime + index).toISOString()
      };

      batch.set(doc(db, "packages", id), pkg);
    }

    await batch.commit();

    setPkgDate(nowInputDate());
    setPkgCost("");
    setPkgQty("1");
    setPkgNotes("");
    setShowAddPkg(false);
  };

  const addProd = async () => {
    const safeName = sanitizeText(prodName, 160);
    const safePackageId = sanitizeText(prodPkgId, 120);
    if (!safeName || !safePackageId) return;

    const quantity = sanitizeInteger(prodQty, { min: 1, max: 500, fallback: 1 });
    const estPrice = sanitizeNumber(prodEst, {
      min: 0,
      max: 100000,
      decimals: 2,
      fallback: 0
    });
    const category = CATEGORIES.includes(prodCat) ? prodCat : CATEGORIES[CATEGORIES.length - 1];
    const condition = CONDITIONS.includes(prodCond) ? prodCond : "Bueno";

    const product = {
      id: generateId(),
      name: safeName,
      category,
      packageId: safePackageId,
      condition,
      quantity,
      estPrice,
      status: "Pendiente",
      notes: sanitizeText(prodNotes, 1000),
      createdAt: new Date().toISOString(),
      soldQuantity: 0,
      soldPrice: 0,
      soldPlatform: null,
      soldDate: null,
      addedBy: actor(),
      sales: []
    };

    await setDoc(doc(db, "products", product.id), product);

    setProdName("");
    setProdCat(CATEGORIES[CATEGORIES.length - 1]);
    setProdCond("Bueno");
    setProdQty("1");
    setProdEst("");
    setProdNotes("");
    setShowAddProd(false);
  };

  const saveEditedProduct = async () => {
    if (!editProduct) return;

    const safeName = sanitizeText(editProduct.name, 160);
    const safePackageId = sanitizeText(editProduct.packageId, 120);
    if (!safeName || !safePackageId) return;

    const quantity = sanitizeInteger(editProduct.quantity, { min: 1, max: 500, fallback: 1 });
    const status = PRODUCT_STATUS.includes(editProduct.status) ? editProduct.status : "Pendiente";

    const baseData = {
      name: safeName,
      category: CATEGORIES.includes(editProduct.category)
        ? editProduct.category
        : CATEGORIES[CATEGORIES.length - 1],
      packageId: safePackageId,
      condition: CONDITIONS.includes(editProduct.condition) ? editProduct.condition : "Bueno",
      quantity,
      estPrice: sanitizeNumber(editProduct.estPrice, {
        min: 0,
        max: 100000,
        decimals: 2,
        fallback: 0
      }),
      notes: sanitizeText(editProduct.notes, 1000),
      status,
      updatedAt: new Date().toISOString()
    };

    if (isSoldStatus(status)) {
      const soldQuantity = quantity;
      const soldUnitPrice = sanitizeNumber(editProduct.soldUnitPrice, {
        min: 0,
        max: 100000,
        decimals: 2,
        fallback: 0
      });
      const soldPrice =
        soldUnitPrice > 0
          ? sanitizeNumber(soldUnitPrice * soldQuantity, {
              min: 0,
              max: 100000,
              decimals: 2,
              fallback: 0
            })
          : sanitizeNumber(editProduct.soldPrice, {
              min: 0,
              max: 100000,
              decimals: 2,
              fallback: 0
            });

      await updateDoc(doc(db, "products", editProduct.id), {
        ...baseData,
        soldQuantity,
        soldPrice,
        soldUnitPrice:
          soldQuantity > 0 ? (soldUnitPrice > 0 ? soldUnitPrice : soldPrice / soldQuantity) : null,
        soldPlatform:
          editProduct.soldPlatform && PLATFORMS.includes(editProduct.soldPlatform)
            ? editProduct.soldPlatform
            : null,
        soldDate: sanitizeDateInput(editProduct.soldDate, null),
        soldBy: actor()
      });
    } else {
      await updateDoc(doc(db, "products", editProduct.id), {
        ...baseData,
        soldQuantity: 0,
        soldPrice: 0,
        soldUnitPrice: null,
        soldPlatform: null,
        soldDate: null,
        soldBy: null
      });
    }

    setEditProduct(null);
  };

  const saveEditedPackage = async () => {
    if (!editPackage) return;

    const date = sanitizeDateInput(editPackage.date, null);
    if (!date) return;

    const cost = sanitizeNumber(editPackage.cost, {
      min: 0,
      max: 100000,
      decimals: 2,
      fallback: 0
    });
    if (cost <= 0) return;

    await updateDoc(doc(db, "packages", editPackage.id), {
      date,
      cost,
      notes: sanitizeText(editPackage.notes, 500),
      updatedAt: new Date().toISOString(),
      updatedBy: actor()
    });

    setEditPackage(null);
  };

  const deletePackagesWithProducts = async (packageIds) => {
    if (!packageIds || packageIds.length === 0) return;

    let batch = writeBatch(db);
    let operations = 0;

    const commitIfNeeded = async (force = false) => {
      if (operations === 0) return;
      if (force || operations >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        operations = 0;
      }
    };

    for (const packageId of packageIds) {
      batch.delete(doc(db, "packages", packageId));
      operations += 1;
      await commitIfNeeded();

      const relatedProducts = products.filter((product) => product.packageId === packageId);
      for (const product of relatedProducts) {
        batch.delete(doc(db, "products", product.id));
        operations += 1;
        await commitIfNeeded();
      }

      if (showPkgDetails === packageId) setShowPkgDetails(null);
    }

    await commitIfNeeded(true);
  };

  const sell = async () => {
    if (!currentSellProduct || !sellPrice) return;

    const available = getAvailableQuantity(currentSellProduct);
    if (available <= 0) return;

    const quantity = sanitizeInteger(sellQty, { min: 1, max: available, fallback: 1 });
    const unitPrice = sanitizeNumber(sellPrice, {
      min: 0,
      max: 100000,
      decimals: 2,
      fallback: 0
    });
    if (!unitPrice || unitPrice <= 0) return;

    const saleTotal = unitPrice * quantity;
    const nowISO = new Date().toISOString();
    const safePlatform = PLATFORMS.includes(sellPlat) ? sellPlat : "Wallapop";
    const safeSellDate = sanitizeDateInput(sellDate, nowInputDate());

    const soldId = generateId();
    const soldProduct = {
      id: soldId,
      name: sanitizeText(currentSellProduct.name, 160),
      category: CATEGORIES.includes(currentSellProduct.category)
        ? currentSellProduct.category
        : CATEGORIES[CATEGORIES.length - 1],
      packageId: sanitizeText(currentSellProduct.packageId, 120),
      condition: CONDITIONS.includes(currentSellProduct.condition)
        ? currentSellProduct.condition
        : "Bueno",
      quantity,
      estPrice: sanitizeNumber(currentSellProduct.estPrice, {
        min: 0,
        max: 100000,
        decimals: 2,
        fallback: 0
      }),
      status: "Vendido",
      notes: sanitizeText(currentSellProduct.notes, 1000),
      createdAt: nowISO,
      soldQuantity: quantity,
      soldPrice: saleTotal,
      soldUnitPrice: unitPrice,
      soldPlatform: safePlatform,
      soldDate: safeSellDate,
      soldBy: actor(),
      addedBy: sanitizeText(currentSellProduct.addedBy || actor(), 120),
      sourceProductId: sanitizeText(currentSellProduct.id, 120)
    };

    const remaining = available - quantity;
    const batch = writeBatch(db);

    batch.set(doc(db, "products", soldId), soldProduct);

    if (remaining <= 0) {
      batch.delete(doc(db, "products", currentSellProduct.id));
    } else {
      batch.update(doc(db, "products", currentSellProduct.id), {
        quantity: remaining,
        soldQuantity: 0,
        soldPrice: 0,
        soldUnitPrice: null,
        soldPlatform: null,
        soldDate: null,
        soldBy: null,
        sales: [],
        status: "En venta",
        updatedAt: nowISO
      });
    }

    await batch.commit();

    setSellPrice("");
    setSellQty("1");
    setSellPlat("Wallapop");
    setSellDate(nowInputDate());
    setShowSell(null);
  };

  const toggleProductSelection = (id) => {
    setSelectedProductIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearBatchSelection = () => {
    setSelectedProductIds(new Set());
    setSelectionMode(false);
  };

  const deleteSelectedProducts = async () => {
    if (selectedProductIds.size === 0) return;

    if (!confirm(t("confirm.deleteProducts", { count: selectedProductIds.size }))) return;

    const ids = [...selectedProductIds];
    for (let index = 0; index < ids.length; index += 400) {
      const batch = writeBatch(db);
      ids.slice(index, index + 400).forEach((id) => {
        batch.delete(doc(db, "products", id));
      });
      await batch.commit();
    }

    clearBatchSelection();
  };

  const togglePackageSelection = (id) => {
    setSelectedPackageIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearPackageBatchSelection = () => {
    setSelectedPackageIds(new Set());
    setPkgSelectionMode(false);
  };

  const deleteSelectedPackages = async () => {
    if (selectedPackageIds.size === 0) return;

    if (!confirm(t("confirm.deletePackagesWithProducts", { count: selectedPackageIds.size }))) return;

    await deletePackagesWithProducts([...selectedPackageIds]);
    clearPackageBatchSelection();
  };

  const deleteSinglePackage = async (id) => {
    await deletePackagesWithProducts([id]);
  };

  const deleteSingleProduct = async (id) => {
    await deleteDoc(doc(db, "products", id));
  };

  const suggestedCost = useMemo(() => {
    if (pkgCost) return null;
    const day = dayOfWeek(sanitizeDateInput(pkgDate, nowInputDate()));
    if (day === 2) return 6;
    if (day === 3) return 3;
    return null;
  }, [pkgDate, pkgCost]);

  const pkgQtyNum = sanitizeInteger(pkgQty, { min: 1, max: 200, fallback: 1 });
  const pkgUnitCost = pkgCost
    ? sanitizeNumber(pkgCost, { min: 0, max: 100000, decimals: 2, fallback: 0 })
    : dayOfWeek(sanitizeDateInput(pkgDate, nowInputDate())) === 3
      ? 3
      : 6;
  const pkgTotalEstimate = pkgUnitCost * pkgQtyNum;

  const tabList = [
    { id: "dashboard", icon: "📊", label: t("tabs.dashboard") },
    { id: "packages", icon: "📦", label: t("tabs.packages") },
    { id: "products", icon: "🏷", label: t("tabs.products") }
  ];

  const editIsSold = !!editProduct && isSoldStatus(editProduct.status);
  const editQtyNum = editProduct ? Math.max(1, parseInt(editProduct.quantity, 10) || 1) : 0;
  const editSoldUnitNum = editProduct
    ? Math.max(0, parseFloat(editProduct.soldUnitPrice) || 0)
    : 0;
  const editSoldTotalPreview = editQtyNum * editSoldUnitNum;

  const renderProductCard = (product) => {
    const pkg = getPackageById(product.packageId);
    const alert = getAlertLevel(product, t);
    const quantity = getProductQuantity(product);
    const soldQty = getSoldQuantity(product);
    const availableQty = getAvailableQuantity(product);
    const revenue = getProductRevenue(product);

    const isSelected = selectedProductIds.has(product.id);
    const cardBackground = isSelected ? "#112417" : alert ? alert.bg : "#111a26";
    const cardBorder = isSelected ? "#0d3" : alert ? alert.border : "#1c2738";

    return (
      <div
        key={product.id}
        onClick={selectionMode ? () => toggleProductSelection(product.id) : undefined}
        style={{
          background: cardBackground,
          border: `1px solid ${cardBorder}`,
          borderRadius: 14,
          padding: "14px 16px",
          cursor: selectionMode ? "pointer" : "default",
          boxShadow: isSelected ? "0 0 0 1px rgba(0,221,51,.4) inset" : "none",
          transition: "background .15s ease, border-color .15s ease, box-shadow .15s ease"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 6,
            gap: 8
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {product.name}
            </div>
            <div style={{ fontSize: 10, color: "#95a8c0", marginTop: 2 }}>
              {categoryLabel(product.category)} · {soldQty}/{quantity} {t("common.unitShort")}
              {pkg && <span> · {shortDate(pkg.date)}</span>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {selectionMode && (
              <span
                style={{
                  fontSize: 11,
                  color: isSelected ? "#0d3" : "#7b8fa9",
                  fontWeight: 700
                }}
              >
                {isSelected ? "✓" : "○"}
              </span>
            )}
            <Badge color={STATUS_BADGE_COLORS[getStatusKey(product.status)] || "neutral"}>
              {statusLabel(product.status)}
            </Badge>
          </div>
        </div>

        {alert && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: alert.color,
                display: "inline-block",
                animation: alert.level === "critical" ? "pulse 1.5s infinite" : "none"
              }}
            />
            <span style={{ fontSize: 10, color: alert.color, fontWeight: 700 }}>
              {alert.daysSince}d · {alert.message}
            </span>
          </div>
        )}

        {revenue > 0 && (
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0d3", marginBottom: 6 }}>
            {t("products.income")}: {currency(revenue)}
            {getSoldQuantity(product) > 0 && (
              <span style={{ fontSize: 10, color: "#95a8c0", fontWeight: 500 }}>
                {` · ${currency(getSoldUnitPrice(product))}${t("common.perUnit")}`}
              </span>
            )}
            {product.soldPlatform && (
              <span style={{ fontSize: 10, color: "#95a8c0", fontWeight: 500 }}>
                {` · ${platformLabel(product.soldPlatform)}`}
              </span>
            )}
          </div>
        )}

        {product.estPrice > 0 && availableQty > 0 && (
          <div style={{ fontSize: 10, color: "#95a8c0", marginBottom: 6 }}>
            {t("products.targetWithUnits", {
              price: currency(product.estPrice),
              units: availableQty
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 6 }}>
          {selectionMode ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleProductSelection(product.id);
              }}
              style={{
                flex: 1,
                background: isSelected ? "#0d3" : "#1c2738",
                color: isSelected ? "#001a00" : "#c2d1e5",
                border: "none",
                padding: 10,
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              {isSelected ? t("common.selected") : t("common.select")}
            </button>
          ) : (
            <>
              {availableQty > 0 && !isDiscardedOrKeptStatus(product.status) && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    openSellModal(product.id);
                  }}
                  style={{
                    flex: 1,
                    background: "#0d3",
                    color: "#000",
                    border: "none",
                    padding: 10,
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  💰 {t("common.sell")}
                </button>
              )}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  openEditProduct(product);
                }}
                style={{
                  background: "#1c2738",
                  border: "none",
                  color: "#08f",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer"
                }}
                title={t("common.edit")}
              >
                ✏️
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  if (confirm(t("products.confirmDeleteSingle"))) {
                    deleteSingleProduct(product.id);
                  }
                }}
                style={{
                  background: "#1c2738",
                  border: "none",
                  color: "#f43",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
          borderBottom: "1px solid #111a26",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AppLogo size={32} fontSize={11} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: -0.5 }}>
              {t("common.appName")}
            </div>
            <div style={{ fontSize: 9, color: "#7b8fa9" }}>{user.displayName || user.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <LanguageSelector compact />
          {tab === "packages" && (
            <button
              onClick={() => setShowAddPkg(true)}
              style={{
                background: "#0d3",
                color: "#000",
                border: "none",
                padding: "10px 16px",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              {t("header.addPackage")}
            </button>
          )}

          {tab === "products" && packages.length > 0 && (
            <button
              onClick={() => {
                setProdPkgId(sortedPackages[0]?.id || "");
                setShowAddProd(true);
              }}
              style={{
                background: "#0d3",
                color: "#000",
                border: "none",
                padding: "10px 16px",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer"
              }}
            >
              {t("header.addProduct")}
            </button>
          )}

          <button
            onClick={() => signOut(auth)}
            style={{
              background: "#111a26",
              border: "none",
              color: "#95a8c0",
              padding: "10px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 14
            }}
            title={t("header.logoutTitle")}
          >
            🚪
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: 16,
          paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))"
        }}
      >
        {tab === "dashboard" && (
          <div style={{ animation: "fadeIn .2s ease", display: "flex", flexDirection: "column", gap: 12 }}>
            {packages.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 20px", marginTop: 16 }}>
                <div style={{ fontSize: 13, color: "#7b8fa9", marginBottom: 14 }}>
                  {t("dashboard.firstPackagePrompt")}
                </div>
                <button
                  onClick={() => {
                    setTab("packages");
                    setTimeout(() => setShowAddPkg(true), 100);
                  }}
                  style={{ ...btnP, width: "auto", padding: "14px 28px" }}
                >
                  {t("dashboard.addFirstPackage")}
                </button>
              </div>
            )}

            {packages.length > 0 && (
              <>
                <div style={{ background: "#111a26", border: "1px solid #1c2738", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#95a8c0",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 10
                    }}
                  >
                    📌 {t("dashboard.summaryTitle")}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <StatCard
                      label={t("dashboard.netProfit")}
                      value={currency(stats.profit)}
                      sub={t("dashboard.billedAndInvested", {
                        revenue: currency(stats.totalRev),
                        cost: currency(stats.totalCost)
                      })}
                      accent={stats.profit >= 0 ? "#0d3" : "#f43"}
                    />
                    <StatCard
                      label={t("dashboard.roiAndMargin")}
                      value={`${stats.roi}%`}
                      sub={t("dashboard.marginAndRecovery", {
                        margin: stats.marginRate.toFixed(0),
                        recovery: stats.recoveryRate.toFixed(0)
                      })}
                      accent={stats.profit >= 0 ? "#0d3" : "#f43"}
                    />
                    <StatCard
                      label={t("dashboard.activeCapital")}
                      value={currency(stats.activeCapital)}
                      sub={t("dashboard.activeProductsAndUnits", {
                        products: stats.activeProducts,
                        units: stats.availableUnits
                      })}
                      accent="#f90"
                    />
                    <StatCard
                      label={t("dashboard.rotation")}
                      value={`${stats.sellThroughRate.toFixed(0)}%`}
                      sub={t("dashboard.soldOverTotalUnits", {
                        sold: stats.soldCount,
                        total: stats.totalUnits
                      })}
                      accent="#08f"
                    />
                  </div>
                </div>

                <div style={{ background: "#111a26", border: "1px solid #1c2738", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#95a8c0",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 10
                    }}
                  >
                    📅 {t("dashboard.currentPeriod")}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <StatCard
                      label={t("dashboard.monthLabel", { month: stats.monthLabel })}
                      value={currency(stats.month.profit)}
                      sub={`${currency(stats.month.revenue)} / ${currency(stats.month.cost)} · ${stats.month.soldUnits} ${t("common.unitShort")}`}
                      accent={stats.month.profit >= 0 ? "#0d3" : "#f43"}
                    />
                    <StatCard
                      label={t("dashboard.yearLabel", { year: stats.yearLabel })}
                      value={currency(stats.year.profit)}
                      sub={`${currency(stats.year.revenue)} / ${currency(stats.year.cost)} · ${stats.year.soldUnits} ${t("common.unitShort")}`}
                      accent={stats.year.profit >= 0 ? "#0d3" : "#f43"}
                    />
                  </div>

                  {stats.monthBreakdown.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {stats.monthBreakdown
                        .slice(-6)
                        .reverse()
                        .map((row) => (
                          <div
                            key={row.key}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              background: "#0d1420",
                              borderRadius: 8,
                              padding: "9px 10px"
                            }}
                          >
                            <div style={{ fontSize: 11, color: "#c2d1e5" }}>{row.label}</div>
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: row.profit >= 0 ? "#0d3" : "#f43"
                                }}
                              >
                                {currency(row.profit)}
                              </div>
                              <div style={{ fontSize: 9, color: "#7b8fa9" }}>
                                {currency(row.revenue)} / {currency(row.cost)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div style={{ background: "#111a26", border: "1px solid #1c2738", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#95a8c0",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 10
                    }}
                  >
                    📦 {t("dashboard.inventoryRisk")}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <StatCard
                      label={t("dashboard.pendingUnits")}
                      value={stats.pendingCount}
                      sub={t("dashboard.unitsToSell")}
                      accent="#a855f7"
                    />
                    <StatCard
                      label={t("dashboard.avgTicketUnit")}
                      value={currency(stats.avgUnitRevenue)}
                      sub={`${stats.soldCount} ${t("common.unitShort")} ${t("common.soldWordPlural")}`}
                      accent="#08f"
                    />
                    <StatCard
                      label={t("dashboard.avgTicketSale")}
                      value={currency(stats.avgProductRevenue)}
                      sub={`${stats.soldProductsCount} ${t("common.productsWord")} ${t("common.soldWordPlural")}`}
                      accent="#0d3"
                    />
                    <StatCard
                      label={t("dashboard.stockPotential")}
                      value={currency(stats.estimatedOpenRevenue)}
                      sub={
                        stats.estimatedOpenRevenue > 0
                          ? t("dashboard.estimatedProfit", {
                              profit: `${stats.estimatedOpenProfit >= 0 ? "+" : ""}${currency(stats.estimatedOpenProfit)}`
                            })
                          : t("dashboard.addTargetPriceHint")
                      }
                      accent={stats.estimatedOpenProfit >= 0 ? "#0d3" : "#f90"}
                    />
                  </div>

                  {staleProducts.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#7b8fa9", padding: "6px 2px" }}>
                      {t("alerts.noStaleProducts")}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 10, color: "#95a8c0", marginBottom: 2 }}>
                        {staleProducts.filter((item) => item.alert.level === "critical").length > 0 && (
                          <span style={{ color: "#f43" }}>
                            🚨 {t("alerts.criticalCount", { count: staleProducts.filter((item) => item.alert.level === "critical").length })}{" "}
                          </span>
                        )}
                        {staleProducts.filter((item) => item.alert.level === "urgent").length > 0 && (
                          <span style={{ color: "#f90" }}>
                            🔥 {t("alerts.urgentCount", { count: staleProducts.filter((item) => item.alert.level === "urgent").length })}{" "}
                          </span>
                        )}
                        {staleProducts.filter((item) => item.alert.level === "warning").length > 0 && (
                          <span style={{ color: "#fd0" }}>
                            ⚠️ {t("alerts.warningCount", { count: staleProducts.filter((item) => item.alert.level === "warning").length })}
                          </span>
                        )}
                      </div>

                      {staleProducts.slice(0, 4).map((product) => {
                        const estimatedCost = getCostPerProduct(product, packages, products);
                        return (
                          <div
                            key={product.id}
                            style={{
                              background: product.alert.bg,
                              border: `1px solid ${product.alert.border}`,
                              borderRadius: 10,
                              padding: "11px 12px"
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 8
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 13,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                  }}
                                >
                                  {product.alert.icon} {product.name}
                                </div>
                                <div style={{ fontSize: 10, color: "#b0c2d8", marginTop: 3 }}>
                                  {product.alert.daysSince}d · {product.alert.message}
                                </div>
                                <div style={{ fontSize: 10, color: "#95a8c0", marginTop: 2 }}>
                                  {t("dashboard.estimatedCost", { cost: currency(estimatedCost) })}
                                </div>
                              </div>
                              <button
                                onClick={() => openSellModal(product.id)}
                                style={{
                                  background: product.alert.color,
                                  color: "#000",
                                  border: "none",
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  fontWeight: 800,
                                  fontSize: 11,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0
                                }}
                              >
                                💰 {t("common.sell")}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {staleProducts.length > 4 && (
                        <button
                          onClick={() => setTab("products")}
                          style={{
                            background: "#1c2738",
                            border: "none",
                            color: "#c2d1e5",
                            padding: 10,
                            borderRadius: 8,
                            fontSize: 11,
                            cursor: "pointer"
                          }}
                        >
                          {t("dashboard.seeMore", { count: staleProducts.length - 4 })}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ background: "#111a26", border: "1px solid #1c2738", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#95a8c0",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 10
                    }}
                  >
                    📈 {t("dashboard.channelsEfficiency")}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    {[
                      { label: t("dashboard.tuesdayPackLabel"), data: stats.martes },
                      { label: t("dashboard.wednesdayPackLabel"), data: stats.miercoles }
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{ flex: 1, background: "#0d1420", borderRadius: 10, padding: 12 }}
                      >
                        <div style={{ fontSize: 10, color: "#b0c2d8", marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: "#7b8fa9" }}>
                          {t("dashboard.packagesCount", { count: item.data.count })}
                        </div>
                        <div
                          style={{
                            fontSize: 19,
                            fontWeight: 800,
                            color: item.data.profit >= 0 ? "#0d3" : "#f43",
                            marginTop: 6
                          }}
                        >
                          {currency(item.data.profit)}
                        </div>
                        <div style={{ fontSize: 9, color: "#7b8fa9" }}>
                          {item.data.count > 0
                            ? t("dashboard.perPackage", {
                                value: currency(item.data.profit / item.data.count)
                              })
                            : "—"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {chartCategoryData.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#95a8c0",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 8
                          }}
                        >
                          {t("dashboard.topCategories")}
                        </div>
                        <MiniBar data={chartCategoryData.slice(0, 5)} color="#08f" />
                      </div>
                    )}

                    {chartPlatformData.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#95a8c0",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 8
                          }}
                        >
                          {t("dashboard.revenueByPlatform")}
                        </div>
                        <MiniBar data={chartPlatformData} color="#a855f7" />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "packages" && (
          <div style={{ animation: "fadeIn .2s ease" }}>
            {packages.length === 0 ? (
              <EmptyState icon="📦" msg={t("packages.noPackages")} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <button
                    onClick={() =>
                      pkgSelectionMode ? clearPackageBatchSelection() : setPkgSelectionMode(true)
                    }
                    style={{
                      background: pkgSelectionMode ? "#f43" : "#1c2738",
                      border: "none",
                      color: pkgSelectionMode ? "#fff" : "#c2d1e5",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: "pointer"
                    }}
                  >
                    {pkgSelectionMode ? t("packages.cancelSelection") : t("packages.batchSelect")}
                  </button>

                  {pkgSelectionMode && selectedPackageIds.size > 0 && (
                    <button
                      onClick={deleteSelectedPackages}
                      style={{
                        background: "#f43",
                        border: "none",
                        color: "#fff",
                        padding: "10px 12px",
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 11,
                        cursor: "pointer"
                      }}
                    >
                      🗑 {t("packages.deleteSelected", { count: selectedPackageIds.size })}
                    </button>
                  )}

                  {pkgSelectionMode && (
                    <div style={{ fontSize: 10, color: "#95a8c0", marginLeft: "auto" }}>
                      {t("packages.selectedCount", { count: selectedPackageIds.size })}
                    </div>
                  )}
                </div>

                {sortedPackages.map((pkg) => {
                  const packageProducts = products.filter((product) => product.packageId === pkg.id);
                  const soldUnits = packageProducts.reduce(
                    (sum, product) => sum + getSoldQuantity(product),
                    0
                  );
                  const totalUnits = packageProducts.reduce(
                    (sum, product) => sum + getProductQuantity(product),
                    0
                  );
                  const revenue = packageProducts.reduce(
                    (sum, product) => sum + getProductRevenue(product),
                    0
                  );
                  const profit = revenue - (Number(pkg.cost) || 0);

                  const isSelected = selectedPackageIds.has(pkg.id);

                  return (
                    <div
                      key={pkg.id}
                      onClick={pkgSelectionMode ? () => togglePackageSelection(pkg.id) : undefined}
                      style={{
                        background: isSelected ? "#112417" : "#111a26",
                        border: `1px solid ${isSelected ? "#0d3" : "#1c2738"}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                        cursor: pkgSelectionMode ? "pointer" : "default",
                        boxShadow: isSelected ? "0 0 0 1px rgba(0,221,51,.4) inset" : "none",
                        transition: "background .15s ease, border-color .15s ease, box-shadow .15s ease"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                          gap: 10
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {pkgSelectionMode && (
                            <span
                              style={{
                                fontSize: 11,
                                color: isSelected ? "#0d3" : "#7b8fa9",
                                fontWeight: 700
                              }}
                            >
                              {isSelected ? "✓" : "○"}
                            </span>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{shortDate(pkg.date)}</div>
                          </div>
                          <Badge color={(Number(pkg.cost) || 0) <= 3 ? "green" : "orange"}>
                            {currency(pkg.cost)}
                          </Badge>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: revenue > 0 ? (profit >= 0 ? "#0d3" : "#f43") : "#304560",
                              fontSize: 15
                            }}
                          >
                            {revenue > 0 ? `${profit >= 0 ? "+" : ""}${currency(profit)}` : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "#7b8fa9" }}>
                            {t("packages.soldUnits", { sold: soldUnits, total: totalUnits })}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        {pkgSelectionMode ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePackageSelection(pkg.id);
                            }}
                            style={{
                              flex: 1,
                              background: isSelected ? "#0d3" : "#1c2738",
                              color: isSelected ? "#001a00" : "#c2d1e5",
                              border: "none",
                              padding: 10,
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: "pointer"
                            }}
                          >
                            {isSelected ? t("common.selected") : t("common.select")}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setShowPkgDetails(pkg.id);
                              }}
                              style={{
                                flex: 1,
                                background: "#1c2738",
                                border: "none",
                                color: "#08f",
                                padding: 10,
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              {t("packages.viewProducts")}
                            </button>

                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setProdPkgId(pkg.id);
                                setShowAddProd(true);
                              }}
                              style={{
                                background: "#1c2738",
                                border: "none",
                                color: "#0d3",
                                padding: "10px 14px",
                                borderRadius: 8,
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              {t("packages.addProduct")}
                            </button>

                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditPackage(pkg);
                              }}
                              style={{
                                background: "#1c2738",
                                border: "none",
                                color: "#08f",
                                padding: "10px 14px",
                                borderRadius: 8,
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              ✏️
                            </button>

                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (confirm(t("confirm.deleteSinglePackageWithProducts"))) {
                                  deleteSinglePackage(pkg.id);
                                }
                              }}
                              style={{
                                background: "#1c2738",
                                border: "none",
                                color: "#f43",
                                padding: "10px 14px",
                                borderRadius: 8,
                                fontSize: 12,
                                cursor: "pointer"
                              }}
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "products" && (
          <div style={{ animation: "fadeIn .2s ease" }}>
            <div style={{ marginBottom: 10 }}>
              <input
                placeholder={t("products.searchPlaceholder")}
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                style={{ ...inputS, padding: "12px 14px" }}
              />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <button
                onClick={() => (selectionMode ? clearBatchSelection() : setSelectionMode(true))}
                style={{
                  background: selectionMode ? "#f43" : "#1c2738",
                  border: "none",
                  color: selectionMode ? "#fff" : "#c2d1e5",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer"
                }}
              >
                {selectionMode ? t("packages.cancelSelection") : t("packages.batchSelect")}
              </button>

              {selectionMode && selectedProductIds.size > 0 && (
                <button
                  onClick={deleteSelectedProducts}
                  style={{
                    background: "#f43",
                    border: "none",
                    color: "#fff",
                    padding: "10px 12px",
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: "pointer"
                  }}
                >
                  🗑 {t("packages.deleteSelected", { count: selectedProductIds.size })}
                </button>
              )}

              {selectionMode && (
                <div style={{ fontSize: 10, color: "#95a8c0", marginLeft: "auto" }}>
                  {t("packages.selectedCount", { count: selectedProductIds.size })}
                </div>
              )}
            </div>

            <div
              style={{
                background: "#101826",
                border: "1px solid #1f2b3d",
                borderRadius: 10,
                padding: "8px 10px",
                marginBottom: 12,
                fontSize: 10,
                color: "#95a8c0"
              }}
            >
              {t("products.ageLegend")} <span style={{ color: "#fd0" }}>14d</span> ·{" "}
              <span style={{ color: "#f90" }}>28d</span> · <span style={{ color: "#f43" }}>42d+</span>
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState
                icon="🔎"
                msg={products.length === 0 ? t("products.addFromPackage") : t("products.noResults")}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "#101826", border: "1px solid #1f2b3d", borderRadius: 14, padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 12 }}>🟢 {t("products.listedTitle")}</div>
                    <div style={{ fontSize: 10, color: "#b0c2d8" }}>
                      {t("products.itemsCount", { count: productsForSale.length })}
                    </div>
                  </div>

                  {productsForSale.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#7b8fa9", textAlign: "center", padding: 16 }}>
                      {t("products.noListedProducts")}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {productsForSale.map(renderProductCard)}
                    </div>
                  )}
                </div>

                <div style={{ background: "#101826", border: "1px solid #1f2b3d", borderRadius: 14, padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 12 }}>✅ {t("products.soldTitle")}</div>
                    <div style={{ fontSize: 10, color: "#b0c2d8" }}>
                      {t("products.itemsCount", { count: productsSold.length })}
                    </div>
                  </div>

                  {productsSold.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#7b8fa9", textAlign: "center", padding: 16 }}>
                      {t("products.noSoldProducts")}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {productsSold.map(renderProductCard)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0d1420",
          borderTop: "1px solid #1c2738",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          boxSizing: "border-box",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          height: "calc(64px + env(safe-area-inset-bottom, 0px))",
          flexShrink: 0,
          zIndex: 100
        }}
      >
        {tabList.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "8px 20px",
              color: tab === tabItem.id ? "#0d3" : "#95a8c0",
              transition: "color .2s",
              lineHeight: 1
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, display: "block" }}>{tabItem.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{tabItem.label}</span>
          </button>
        ))}
      </div>

      <Modal open={showAddPkg} onClose={() => setShowAddPkg(false)} title={t("packages.newPackage")}>
        <Field label={t("packages.purchaseDate")}>
          <input
            type="date"
            value={pkgDate}
            onChange={(event) => setPkgDate(event.target.value)}
            style={inputS}
          />
        </Field>
        <Field
          label={
            t("packages.packageCost") +
            (suggestedCost
              ? t("packages.autoCostLabel", {
                  cost: suggestedCost,
                  day: getDayLabel(pkgDate, locale, t)
                })
              : "")
          }
        >
          <input
            type="number"
            step="0.5"
            placeholder={suggestedCost ? String(suggestedCost) : "€"}
            value={pkgCost}
            onChange={(event) => setPkgCost(event.target.value)}
            style={inputS}
          />
        </Field>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[1, 5, 10, 20].map((amount) => (
            <button
              key={amount}
              onClick={() => setPkgQty(String(amount))}
              style={{
                flex: 1,
                background: pkgQtyNum === amount ? "#0d3" : "#1c2738",
                color: pkgQtyNum === amount ? "#000" : "#c2d1e5",
                border: "none",
                padding: "8px 0",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {amount}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Field label={t("packages.packageCount")}>
            <input
              type="number"
              min="1"
              max="200"
              step="1"
              value={pkgQty}
              onChange={(event) => setPkgQty(event.target.value)}
              style={inputS}
            />
          </Field>
          <Field label={t("common.totalEstimate")}>
            <input value={currency(pkgTotalEstimate || 0)} readOnly style={{ ...inputS, color: "#b0c2d8" }} />
          </Field>
        </div>

        <Field label={t("common.notesOptional")}>
          <input
            placeholder={t("packages.packageNotesPlaceholder")}
            value={pkgNotes}
            onChange={(event) => setPkgNotes(event.target.value)}
            style={inputS}
          />
        </Field>

        <button onClick={addPkg} style={btnP}>
          {pkgQtyNum > 1
            ? t("packages.addMultiplePackages", { count: pkgQtyNum })
            : t("packages.addSinglePackage")}
        </button>
      </Modal>

      <Modal open={!!editPackage} onClose={() => setEditPackage(null)} title={t("packages.editPackage")}>
        {editPackage && (
          <>
            <Field label={t("packages.purchaseDate")}>
              <input
                type="date"
                value={editPackage.date}
                onChange={(event) =>
                  setEditPackage((previous) => ({
                    ...previous,
                    date: event.target.value
                  }))
                }
                style={inputS}
              />
            </Field>
            <Field label={t("packages.costPerPackageLabel")}>
              <input
                type="number"
                step="0.5"
                min="0"
                value={editPackage.cost}
                onChange={(event) =>
                  setEditPackage((previous) => ({
                    ...previous,
                    cost: event.target.value
                  }))
                }
                style={inputS}
              />
            </Field>
            <Field label={t("common.notesOptional")}>
              <input
                value={editPackage.notes}
                onChange={(event) =>
                  setEditPackage((previous) => ({
                    ...previous,
                    notes: event.target.value
                  }))
                }
                style={inputS}
              />
            </Field>
            <button onClick={saveEditedPackage} style={btnP}>
              {t("common.saveChanges")}
            </button>
          </>
        )}
      </Modal>

      <Modal open={showAddProd} onClose={() => setShowAddProd(false)} title={t("products.newProduct")}>
        <Field label={t("products.name")}>
          <input
            placeholder={t("products.productNamePlaceholder")}
            value={prodName}
            onChange={(event) => setProdName(event.target.value)}
            style={inputS}
          />
        </Field>

        <Field label={t("products.package")}>
          <select
            value={prodPkgId}
            onChange={(event) => setProdPkgId(event.target.value)}
            style={selectS}
          >
            <option value="">{t("products.selectPackagePlaceholder")}</option>
            {sortedPackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {shortDate(pkg.date)} — {currency(pkg.cost)} {pkg.notes ? `(${pkg.notes})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "flex", gap: 8 }}>
          <Field label={t("products.category")}>
            <select value={prodCat} onChange={(event) => setProdCat(event.target.value)} style={selectS}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("products.condition")}>
            <select value={prodCond} onChange={(event) => setProdCond(event.target.value)} style={selectS}>
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {conditionLabel(condition)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Field label={t("products.quantity")}>
            <input
              type="number"
              min="1"
              step="1"
              value={prodQty}
              onChange={(event) => setProdQty(event.target.value)}
              style={inputS}
            />
          </Field>

          <Field label={t("products.targetUnitPrice")}>
            <input
              type="number"
              step="0.5"
              placeholder={t("products.targetPricePlaceholder")}
              value={prodEst}
              onChange={(event) => setProdEst(event.target.value)}
              style={inputS}
            />
          </Field>
        </div>

        <Field label={t("common.notesOptional")}>
          <input
            placeholder={t("products.detailsPlaceholder")}
            value={prodNotes}
            onChange={(event) => setProdNotes(event.target.value)}
            style={inputS}
          />
        </Field>

        <button onClick={addProd} style={btnP}>
          {t("products.addProductButton")}
        </button>
      </Modal>

      <Modal
        open={!!showPkgDetails}
        onClose={() => setShowPkgDetails(null)}
        title={
          selectedPackage
            ? t("packages.packageProductsWithDate", { date: shortDate(selectedPackage.date) })
            : t("packages.packageProductsTitle")
        }
      >
        {selectedPackageProducts.length === 0 ? (
          <EmptyState icon="📦" msg={t("packages.packageHasNoProducts")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedPackageProducts.map((product) => {
              const quantity = getProductQuantity(product);
              const soldQty = getSoldQuantity(product);

              return (
                <div
                  key={product.id}
                  style={{
                    background: "#111a26",
                    border: "1px solid #1c2738",
                    borderRadius: 10,
                    padding: "12px 14px"
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{product.name}</div>
                  <div style={{ fontSize: 10, color: "#b0c2d8", marginTop: 3 }}>
                    {categoryLabel(product.category)} · {soldQty}/{quantity} {t("common.unitShort")} {t("common.soldWordPlural")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8
                    }}
                  >
                    <Badge color={STATUS_BADGE_COLORS[getStatusKey(product.status)] || "neutral"}>
                      {statusLabel(product.status)}
                    </Badge>
                    <div style={{ display: "flex", gap: 6 }}>
                      {getAvailableQuantity(product) > 0 && (
                        <button
                          onClick={() => openSellModal(product.id)}
                          style={{
                            background: "#0d3",
                            color: "#000",
                            border: "none",
                            padding: "8px 10px",
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: 11,
                            cursor: "pointer"
                          }}
                        >
                          {t("common.sell")}
                        </button>
                      )}
                      <button
                        onClick={() => openEditProduct(product)}
                        style={{
                          background: "#1c2738",
                          color: "#08f",
                          border: "none",
                          padding: "8px 10px",
                          borderRadius: 8,
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal open={!!showSell} onClose={() => setShowSell(null)} title={t("sale.registerSale")}>
        {currentSellProduct && (
          <div style={{ fontSize: 11, color: "#b0c2d8", marginBottom: 12 }}>
            {t("sale.availableUnits", {
              name: currentSellProduct.name,
              units: sellAvailableQty
            })}
          </div>
        )}

        <Field
          label={
            sellAvailableQty > 0
              ? t("sale.quantityToSellWithMax", { max: sellAvailableQty })
              : t("sale.quantityToSell")
          }
        >
          <input
            type="number"
            min="1"
            max={sellAvailableQty || 1}
            step="1"
            value={sellQty}
            onChange={(event) => setSellQty(event.target.value)}
            style={inputS}
          />
        </Field>

        <Field label={t("sale.unitPrice")}>
          <input
            type="number"
            step="0.5"
            placeholder={t("sale.unitPricePlaceholder")}
            value={sellPrice}
            onChange={(event) => setSellPrice(event.target.value)}
            style={inputS}
          />
        </Field>

        {sellPreviewTotal > 0 && (
          <div style={{ fontSize: 11, color: "#95a8c0", marginBottom: 10 }}>
            {t("sale.estimatedTotal", {
              total: currency(sellPreviewTotal),
              qty: sellQtyNum
            })}
          </div>
        )}

        <Field label={t("common.platform")}>
          <select value={sellPlat} onChange={(event) => setSellPlat(event.target.value)} style={selectS}>
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platformLabel(platform)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("common.date")}>
          <input
            type="date"
            value={sellDate}
            onChange={(event) => setSellDate(event.target.value)}
            style={inputS}
          />
        </Field>

        <button
          onClick={sell}
          disabled={!currentSellProduct || sellAvailableQty <= 0}
          style={{ ...btnP, opacity: !currentSellProduct || sellAvailableQty <= 0 ? 0.5 : 1 }}
        >
          💰 {t("sale.registerSaleButton")}
        </button>
      </Modal>

      <Modal open={!!editProduct} onClose={() => setEditProduct(null)} title={t("products.editProduct")}>
        {editProduct && (
          <>
            <Field label={t("products.name")}>
              <input
                value={editProduct.name}
                onChange={(event) =>
                  setEditProduct((previous) => ({ ...previous, name: event.target.value }))
                }
                style={inputS}
              />
            </Field>

            <Field label={t("products.package")}>
              <select
                value={editProduct.packageId}
                onChange={(event) =>
                  setEditProduct((previous) => ({ ...previous, packageId: event.target.value }))
                }
                style={selectS}
              >
                <option value="">{t("products.selectPackagePlaceholder")}</option>
                {sortedPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {shortDate(pkg.date)} — {currency(pkg.cost)}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ display: "flex", gap: 8 }}>
              <Field label={t("products.category")}>
                <select
                  value={editProduct.category}
                  onChange={(event) =>
                    setEditProduct((previous) => ({ ...previous, category: event.target.value }))
                  }
                  style={selectS}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("products.condition")}>
                <select
                  value={editProduct.condition}
                  onChange={(event) =>
                    setEditProduct((previous) => ({ ...previous, condition: event.target.value }))
                  }
                  style={selectS}
                >
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {conditionLabel(condition)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={t("products.status")}>
              <select
                value={editProduct.status}
                onChange={(event) =>
                  setEditProduct((previous) => ({ ...previous, status: event.target.value }))
                }
                style={selectS}
              >
                {PRODUCT_STATUS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ display: "flex", gap: 8 }}>
              <Field label={t("products.units")}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editProduct.quantity}
                  onChange={(event) =>
                    setEditProduct((previous) => ({ ...previous, quantity: event.target.value }))
                  }
                  style={inputS}
                />
              </Field>

              <Field label={t("products.targetUnitPrice")}>
                <input
                  type="number"
                  step="0.5"
                  value={editProduct.estPrice}
                  onChange={(event) =>
                    setEditProduct((previous) => ({ ...previous, estPrice: event.target.value }))
                  }
                  style={inputS}
                />
              </Field>
            </div>

            {editIsSold && (
              <>
                <div style={{ fontSize: 11, color: "#95a8c0", marginBottom: 10 }}>
                  {t("products.saleData")}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Field label={t("products.saleUnitPrice")}>
                    <input
                      type="number"
                      step="0.5"
                      value={editProduct.soldUnitPrice}
                      onChange={(event) =>
                        setEditProduct((previous) => ({
                          ...previous,
                          soldUnitPrice: event.target.value
                        }))
                      }
                      style={inputS}
                    />
                  </Field>
                  <Field label={t("products.saleTotal")}>
                    <input
                      value={currency(editSoldTotalPreview)}
                      style={{ ...inputS, color: "#b0c2d8" }}
                      readOnly
                    />
                  </Field>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Field label={t("products.salePlatform")}>
                    <select
                      value={editProduct.soldPlatform}
                      onChange={(event) =>
                        setEditProduct((previous) => ({
                          ...previous,
                          soldPlatform: event.target.value
                        }))
                      }
                      style={selectS}
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platformLabel(platform)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={t("products.saleDate")}>
                    <input
                      type="date"
                      value={editProduct.soldDate}
                      onChange={(event) =>
                        setEditProduct((previous) => ({ ...previous, soldDate: event.target.value }))
                      }
                      style={inputS}
                    />
                  </Field>
                </div>
              </>
            )}

            <Field label={t("common.notes")}>
              <input
                value={editProduct.notes}
                onChange={(event) =>
                  setEditProduct((previous) => ({ ...previous, notes: event.target.value }))
                }
                style={inputS}
              />
            </Field>

            <button onClick={saveEditedProduct} style={btnP}>
              {t("common.saveChanges")}
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
