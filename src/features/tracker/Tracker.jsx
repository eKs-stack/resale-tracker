import { useEffect, useMemo, useRef, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile
} from "firebase/auth";
import { deleteDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { auth, db } from "../../firebase";
import useTrackerCollections from "../../hooks/useTrackerCollections";
import {
  ALERT_LEVELS,
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
  getPriceDropSuggestions,
  getSalePriceDelta,
  getSoldQuantity,
  getSoldUnitPrice
} from "../../utils/trackerUtils";
import {
  sanitizeDateInput,
  sanitizeImageDataUrl,
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
import NumberInput from "../../components/ui/NumberInput";
import StatCard from "../../components/ui/StatCard";
import LoadingScreen from "../../components/ui/LoadingScreen";
import { getAuthErrorMessage } from "../auth/authErrors";

const DEFAULT_THEME = "default";
const VERCEL_DARK_THEME = "vercel-dark";
const MAX_IMAGE_TARGET_BYTES = 450 * 1024;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = dataUrl;
  });

const canvasToJpegBlob = (canvas, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });

const canvasToJpegDataUrl = (canvas, quality) => {
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("blob-read-failed"));
    reader.readAsDataURL(blob);
  });

const prepareProductImage = async (file) => {
  const baseDataUrl = await readFileAsDataUrl(file);
  if (!baseDataUrl) return "";
  const safeBaseDataUrl = sanitizeImageDataUrl(baseDataUrl);

  try {
    const image = await loadImageFromDataUrl(baseDataUrl);
    const maxSide = 1200;
    const sourceMaxSide = Math.max(image.width || 1, image.height || 1);
    const baseScale = Math.min(1, maxSide / sourceMaxSide);

    for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
      const extraScale = Math.pow(0.82, sizeAttempt);
      const scale = baseScale * extraScale;
      const width = Math.max(1, Math.round((image.width || 1) * scale));
      const height = Math.max(1, Math.round((image.height || 1) * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.drawImage(image, 0, 0, width, height);

      for (let quality = 0.86; quality >= 0.34; quality -= 0.08) {
        const blob = await canvasToJpegBlob(canvas, quality);
        let candidateDataUrl = "";

        if (blob) {
          candidateDataUrl = await blobToDataUrl(blob);
          if (blob.size <= MAX_IMAGE_TARGET_BYTES) {
            const safeDataUrl = sanitizeImageDataUrl(candidateDataUrl);
            if (safeDataUrl) return safeDataUrl;
          }
        } else {
          candidateDataUrl = canvasToJpegDataUrl(canvas, quality);
        }

        const safeDataUrl = sanitizeImageDataUrl(candidateDataUrl);
        if (safeDataUrl) return safeDataUrl;
      }
    }

    return safeBaseDataUrl;
  } catch {
    return safeBaseDataUrl;
  }
};

export default function Tracker({ user, theme = DEFAULT_THEME, onThemeChange }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || "es";
  const { packages, products, loading, error } = useTrackerCollections();

  const [tab, setTab] = useState("dashboard");
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [showAddProd, setShowAddProd] = useState(false);
  const [showSell, setShowSell] = useState(null);
  const [showPkgDetails, setShowPkgDetails] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editPackage, setEditPackage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showReviewLevel, setShowReviewLevel] = useState(null);
  const [reviewingProductIds, setReviewingProductIds] = useState(new Set());
  const [settingsName, setSettingsName] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");

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
  const [prodImageDataUrl, setProdImageDataUrl] = useState("");

  const [imagePreview, setImagePreview] = useState(null);

  const [sellPrice, setSellPrice] = useState("");
  const [sellQty, setSellQty] = useState("1");
  const [sellPlat, setSellPlat] = useState("Wallapop");
  const [sellDate, setSellDate] = useState(() => nowInputDate());
  const lastSavedEditProductKeyRef = useRef("");
  const lastSavedEditPackageKeyRef = useRef("");

  const currency = (value) => formatCurrency(value, locale);
  const shortDate = (value) => formatDate(value, locale);
  const noBreak = "\u00A0";
  const unitCount = (value) => `${value}${noBreak}${t("common.unitShort")}`;
  const productCount = (value) => `${value}${noBreak}${t("common.productsWord")}`;

  const statusLabel = (value) => t(`status.${getStatusKey(value)}`);
  const categoryLabel = (value) => t(`categories.${getCategoryKey(value)}`);
  const conditionLabel = (value) => t(`conditions.${getConditionKey(value)}`);
  const platformLabel = (value) => t(`platforms.${getPlatformKey(value)}`);
  const selectedTheme = theme === VERCEL_DARK_THEME ? VERCEL_DARK_THEME : DEFAULT_THEME;
  const actor = () => sanitizeText(user.displayName || user.email || "unknown", 120);
  const hasPasswordProvider = useMemo(
    () => (user?.providerData || []).some((provider) => provider.providerId === "password"),
    [user]
  );

  const handleThemeSelection = (event) => {
    if (!onThemeChange) return;
    const nextTheme = event.target.value === VERCEL_DARK_THEME ? VERCEL_DARK_THEME : DEFAULT_THEME;
    onThemeChange(nextTheme);
  };

  const openImagePreview = (src, name = "") => {
    const safeSrc = sanitizeImageDataUrl(src);
    if (!safeSrc) return;
    setImagePreview({ src: safeSrc, name: sanitizeText(name, 160) });
  };

  const closeImagePreview = () => {
    setImagePreview(null);
  };

  const applyImageFromFile = async (file, setter) => {
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      alert(t("products.imageInvalidType"));
      return;
    }

    try {
      const safeDataUrl = sanitizeImageDataUrl(await prepareProductImage(file));
      if (!safeDataUrl) {
        alert(t("products.imageProcessError"));
        return;
      }

      setter(safeDataUrl);
    } catch {
      alert(t("products.imageProcessError"));
    }
  };

  const handleNewProductImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await applyImageFromFile(file, setProdImageDataUrl);
  };

  const handleEditProductImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await applyImageFromFile(file, (safeDataUrl) => {
      setEditProduct((previous) => (previous ? { ...previous, imageDataUrl: safeDataUrl } : previous));
    });
  };

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

  const packageDateById = useMemo(() => {
    const map = {};
    packages.forEach((pkg) => {
      map[pkg.id] = pkg.date || null;
    });
    return map;
  }, [packages]);

  const stats = useMemo(() => buildStats(packages, products, locale), [packages, products, locale]);

  const staleProducts = useMemo(
    () =>
      products
        .map((product) => ({
          ...product,
          alert: getAlertLevel(product, t, packageDateById[product.packageId] || null)
        }))
        .filter((product) => product.alert && getAvailableQuantity(product) > 0)
        .sort((a, b) => b.alert.daysSince - a.alert.daysSince),
    [products, t, packageDateById]
  );

  const reviewFolders = useMemo(
    () =>
      ALERT_LEVELS.map((alert) => {
        const items = staleProducts.filter((product) => product.alert.level === alert.level);
        return {
          ...alert,
          items,
          count: items.length
        };
      }),
    [staleProducts]
  );

  const activeReviewFolder = useMemo(
    () => reviewFolders.find((folder) => folder.level === showReviewLevel) || null,
    [reviewFolders, showReviewLevel]
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

    const initialDraft = {
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
      imageDataUrl: product.imageDataUrl || "",
      status: PRODUCT_STATUS.includes(product.status) ? product.status : "En venta",
      soldQuantity: String(getSoldQuantity(product)),
      soldPrice: getProductRevenue(product) ? String(getProductRevenue(product)) : "",
      soldUnitPrice: getSoldUnitPrice(product) ? String(getSoldUnitPrice(product)) : "",
      soldPlatform: product.soldPlatform || "Wallapop",
      soldDate: product.soldDate || nowInputDate()
    };

    lastSavedEditProductKeyRef.current = JSON.stringify(initialDraft);
    setEditProduct(initialDraft);
  };

  const openEditPackage = (pkg) => {
    const initialDraft = {
      id: pkg.id,
      date: pkg.date || nowInputDate(),
      cost: pkg.cost ? String(pkg.cost) : "",
      notes: pkg.notes || ""
    };

    lastSavedEditPackageKeyRef.current = JSON.stringify(initialDraft);
    setEditPackage(initialDraft);
  };

  const openSettings = () => {
    setSettingsName(user.displayName || "");
    setSettingsEmail(user.email || "");
    setSettingsCurrentPassword("");
    setSettingsNewPassword("");
    setSettingsError("");
    setSettingsSuccess("");
    setShowSettings(true);
  };

  const buildPasswordCredential = () => {
    const currentUser = auth.currentUser;
    const safeEmail = sanitizeText(currentUser?.email || "", 160);
    const safePassword = sanitizeText(settingsCurrentPassword, 200);
    if (!safeEmail || !safePassword) return null;
    return EmailAuthProvider.credential(safeEmail, safePassword);
  };

  const saveDisplayName = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const nextName = sanitizeText(settingsName, 120);
    if (!nextName) {
      setSettingsError(t("settings.displayNameRequired"));
      setSettingsSuccess("");
      return;
    }

    setSettingsBusy(true);
    setSettingsError("");
    setSettingsSuccess("");

    try {
      await updateProfile(currentUser, { displayName: nextName });
      setSettingsSuccess(t("settings.profileUpdated"));
    } catch (err) {
      setSettingsError(getAuthErrorMessage(err, t));
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveEmail = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const safeEmail = sanitizeText(settingsEmail, 160).toLowerCase();
    if (!safeEmail) {
      setSettingsError(t("settings.emailRequired"));
      setSettingsSuccess("");
      return;
    }

    if (safeEmail === (currentUser.email || "").toLowerCase()) {
      setSettingsError("");
      setSettingsSuccess(t("settings.noEmailChanges"));
      return;
    }

    if (hasPasswordProvider && !sanitizeText(settingsCurrentPassword, 200)) {
      setSettingsError(t("settings.currentPasswordRequired"));
      setSettingsSuccess("");
      return;
    }

    setSettingsBusy(true);
    setSettingsError("");
    setSettingsSuccess("");

    try {
      if (hasPasswordProvider) {
        const credential = buildPasswordCredential();
        if (!credential) throw { code: "auth/requires-recent-login" };
        await reauthenticateWithCredential(currentUser, credential);
      }
      await updateEmail(currentUser, safeEmail);
      setSettingsCurrentPassword("");
      setSettingsSuccess(t("settings.emailUpdated", { email: safeEmail }));
    } catch (err) {
      setSettingsError(getAuthErrorMessage(err, t));
    } finally {
      setSettingsBusy(false);
    }
  };

  const savePassword = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (!hasPasswordProvider) {
      setSettingsError(t("settings.passwordNotAvailable"));
      setSettingsSuccess("");
      return;
    }

    const safePassword = sanitizeText(settingsNewPassword, 200);
    if (safePassword.length < 6) {
      setSettingsError(t("settings.passwordTooShort"));
      setSettingsSuccess("");
      return;
    }

    if (!sanitizeText(settingsCurrentPassword, 200)) {
      setSettingsError(t("settings.currentPasswordRequired"));
      setSettingsSuccess("");
      return;
    }

    setSettingsBusy(true);
    setSettingsError("");
    setSettingsSuccess("");

    try {
      const credential = buildPasswordCredential();
      if (!credential) throw { code: "auth/requires-recent-login" };
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, safePassword);
      setSettingsCurrentPassword("");
      setSettingsNewPassword("");
      setSettingsSuccess(t("settings.passwordUpdated"));
    } catch (err) {
      setSettingsError(getAuthErrorMessage(err, t));
    } finally {
      setSettingsBusy(false);
    }
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
      status: "En venta",
      notes: sanitizeText(prodNotes, 1000),
      imageDataUrl: sanitizeImageDataUrl(prodImageDataUrl),
      createdAt: new Date().toISOString(),
      soldQuantity: 0,
      soldPrice: 0,
      soldPlatform: null,
      soldDate: null,
      reviewedAlertDays: 0,
      reviewedAt: null,
      reviewedBy: null,
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
    setProdImageDataUrl("");
    setShowAddProd(false);
  };

  const saveEditedProduct = async (productDraft = editProduct) => {
    if (!productDraft) return false;

    const safeName = sanitizeText(productDraft.name, 160);
    const safePackageId = sanitizeText(productDraft.packageId, 120);
    if (!safeName || !safePackageId) return false;

    const quantity = sanitizeInteger(productDraft.quantity, { min: 1, max: 500, fallback: 1 });
    const status = PRODUCT_STATUS.includes(productDraft.status) ? productDraft.status : "En venta";

    const baseData = {
      name: safeName,
      category: CATEGORIES.includes(productDraft.category)
        ? productDraft.category
        : CATEGORIES[CATEGORIES.length - 1],
      packageId: safePackageId,
      condition: CONDITIONS.includes(productDraft.condition) ? productDraft.condition : "Bueno",
      quantity,
      estPrice: sanitizeNumber(productDraft.estPrice, {
        min: 0,
        max: 100000,
        decimals: 2,
        fallback: 0
      }),
      notes: sanitizeText(productDraft.notes, 1000),
      imageDataUrl: sanitizeImageDataUrl(productDraft.imageDataUrl),
      status,
      updatedAt: new Date().toISOString()
    };

    if (isSoldStatus(status)) {
      const soldQuantity = quantity;
      const soldUnitPrice = sanitizeNumber(productDraft.soldUnitPrice, {
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
          : sanitizeNumber(productDraft.soldPrice, {
              min: 0,
              max: 100000,
              decimals: 2,
              fallback: 0
            });

      await updateDoc(doc(db, "products", productDraft.id), {
        ...baseData,
        soldQuantity,
        soldPrice,
        soldUnitPrice:
          soldQuantity > 0 ? (soldUnitPrice > 0 ? soldUnitPrice : soldPrice / soldQuantity) : null,
        soldPlatform:
          productDraft.soldPlatform && PLATFORMS.includes(productDraft.soldPlatform)
            ? productDraft.soldPlatform
            : null,
        soldDate: sanitizeDateInput(productDraft.soldDate, null),
        soldBy: actor()
      });
    } else {
      await updateDoc(doc(db, "products", productDraft.id), {
        ...baseData,
        soldQuantity: 0,
        soldPrice: 0,
        soldUnitPrice: null,
        soldPlatform: null,
        soldDate: null,
        soldBy: null
      });
    }

    return true;
  };

  const saveEditedPackage = async (packageDraft = editPackage) => {
    if (!packageDraft) return false;

    const date = sanitizeDateInput(packageDraft.date, null);
    if (!date) return false;

    const cost = sanitizeNumber(packageDraft.cost, {
      min: 0,
      max: 100000,
      decimals: 2,
      fallback: 0
    });
    if (cost <= 0) return false;

    await updateDoc(doc(db, "packages", packageDraft.id), {
      date,
      cost,
      notes: sanitizeText(packageDraft.notes, 500),
      updatedAt: new Date().toISOString(),
      updatedBy: actor()
    });

    return true;
  };

  const closeEditPackage = () => {
    const draft = editPackage;
    if (draft) {
      const draftKey = JSON.stringify(draft);
      if (draftKey !== lastSavedEditPackageKeyRef.current) {
        void saveEditedPackage(draft).then((saved) => {
          if (saved) lastSavedEditPackageKeyRef.current = draftKey;
        });
      }
    }
    setEditPackage(null);
  };

  const closeEditProduct = () => {
    const draft = editProduct;
    if (draft) {
      const draftKey = JSON.stringify(draft);
      if (draftKey !== lastSavedEditProductKeyRef.current) {
        void saveEditedProduct(draft).then((saved) => {
          if (saved) lastSavedEditProductKeyRef.current = draftKey;
        });
      }
    }
    setEditProduct(null);
  };

  useEffect(() => {
    if (!editPackage) return;

    const draftKey = JSON.stringify(editPackage);
    if (draftKey === lastSavedEditPackageKeyRef.current) return;

    const timer = window.setTimeout(() => {
      void saveEditedPackage(editPackage).then((saved) => {
        if (saved) lastSavedEditPackageKeyRef.current = draftKey;
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [editPackage]);

  useEffect(() => {
    if (!editProduct) return;

    const draftKey = JSON.stringify(editProduct);
    if (draftKey === lastSavedEditProductKeyRef.current) return;

    const timer = window.setTimeout(() => {
      void saveEditedProduct(editProduct).then((saved) => {
        if (saved) lastSavedEditProductKeyRef.current = draftKey;
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [editProduct]);

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
      imageDataUrl: sanitizeImageDataUrl(currentSellProduct.imageDataUrl),
      createdAt: nowISO,
      soldQuantity: quantity,
      soldPrice: saleTotal,
      soldUnitPrice: unitPrice,
      soldPlatform: safePlatform,
      soldDate: safeSellDate,
      soldBy: actor(),
      reviewedAlertDays: 0,
      reviewedAt: null,
      reviewedBy: null,
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

  const markProductReviewed = async (product) => {
    if (!product?.id || !product?.alert?.days) return;

    const reviewedAt = new Date().toISOString();
    const alertDays = Number(product.alert.days) || 0;
    if (alertDays <= 0) return;

    setReviewingProductIds((previous) => {
      const next = new Set(previous);
      next.add(product.id);
      return next;
    });

    try {
      await updateDoc(doc(db, "products", product.id), {
        reviewedAlertDays: alertDays,
        reviewedAt,
        reviewedBy: actor()
      });
    } finally {
      setReviewingProductIds((previous) => {
        const next = new Set(previous);
        next.delete(product.id);
        return next;
      });
    }
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
    const alert = getAlertLevel(product, t, pkg?.date || null);
    const alertDropSuggestions = getPriceDropSuggestions(product, alert);
    const dropSuggestionText = alertDropSuggestions
      .map((item) =>
        t("alerts.dropSuggestionItem", {
          percent: item.percent,
          price: currency(item.unitPrice)
        })
      )
      .join(" · ");
    const quantity = getProductQuantity(product);
    const soldQty = getSoldQuantity(product);
    const availableQty = getAvailableQuantity(product);
    const revenue = getProductRevenue(product);
    const salePriceDelta = isSoldStatus(product.status) ? getSalePriceDelta(product) : null;

    const isSelected = selectedProductIds.has(product.id);
    const cardBackground = isSelected ? "var(--surface-3)" : alert ? alert.bg : "var(--surface-1)";
    const cardBorder = isSelected ? "var(--accent)" : alert ? alert.border : "var(--border)";

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
          boxShadow: isSelected ? "0 0 0 1px rgba(216,176,111,.45) inset" : "none",
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
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              {categoryLabel(product.category)} · {soldQty}/{quantity} {t("common.unitShort")}
              {pkg && <span> · {shortDate(pkg.date)}</span>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {selectionMode && (
              <span
                style={{
                  fontSize: 11,
                  color: isSelected ? "var(--accent)" : "var(--text-subtle)",
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

        {product.imageDataUrl && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              openImagePreview(product.imageDataUrl, product.name);
            }}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              padding: 0,
              marginBottom: 8,
              cursor: "zoom-in"
            }}
            title={t("products.openImage")}
          >
            <img
              src={product.imageDataUrl}
              alt={t("products.imageAlt", { name: product.name })}
              style={{
                width: "100%",
                maxHeight: 180,
                borderRadius: 10,
                objectFit: "cover",
                border: "1px solid var(--border)"
              }}
            />
            <div style={{ fontSize: 9, color: "var(--text-subtle)", marginTop: 4 }}>
              {t("products.tapToZoom")}
            </div>
          </button>
        )}

        {alert && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
            {dropSuggestionText && (
              <div style={{ fontSize: 10, color: "var(--text-soft)", marginTop: 3, paddingLeft: 13 }}>
                {t("alerts.dropSuggestionPrefix")} {dropSuggestionText}
              </div>
            )}
          </div>
        )}

        {revenue > 0 && (
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--accent)", marginBottom: 6 }}>
            {t("products.income")}: {currency(revenue)}
            {getSoldQuantity(product) > 0 && (
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>
                {` · ${currency(getSoldUnitPrice(product))}${t("common.perUnit")}`}
              </span>
            )}
            {product.soldPlatform && (
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>
                {` · ${platformLabel(product.soldPlatform)}`}
              </span>
            )}
          </div>
        )}

        {salePriceDelta && (
          <div
            style={{
              fontSize: 10,
              marginBottom: 6,
              color: salePriceDelta.totalDelta > 0 ? "var(--accent)" : salePriceDelta.totalDelta < 0 ? "var(--danger)" : "var(--text-soft)",
              fontWeight: 700
            }}
          >
            {salePriceDelta.totalDelta > 0
              ? t("products.saleVsExpectedAbove", {
                  total: currency(Math.abs(salePriceDelta.totalDelta)),
                  unit: currency(Math.abs(salePriceDelta.unitDelta))
                })
              : salePriceDelta.totalDelta < 0
                ? t("products.saleVsExpectedBelow", {
                    total: currency(Math.abs(salePriceDelta.totalDelta)),
                    unit: currency(Math.abs(salePriceDelta.unitDelta))
                  })
                : t("products.saleVsExpectedEqual", {
                    price: currency(salePriceDelta.expectedUnitPrice)
                  })}
          </div>
        )}

        {product.estPrice > 0 && availableQty > 0 && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
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
                background: isSelected ? "var(--accent)" : "var(--border)",
                color: isSelected ? "var(--accent-ink)" : "var(--text-soft)",
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
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
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
                  background: "var(--border)",
                  border: "none",
                  color: "var(--info)",
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
                  background: "var(--border)",
                  border: "none",
                  color: "var(--danger)",
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

  if (error) {
    return (
      <div
        style={{
          height: "var(--app-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <AppLogo size={36} fontSize={12} />
            <div style={{ fontWeight: 800 }}>{t("common.dataLoadErrorTitle")}</div>
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 14 }}>
            {t("common.dataLoadErrorBody")}
          </div>
          <div
            style={{
              background: "var(--surface-0)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              color: "var(--text-soft)",
              padding: "9px 10px",
              fontSize: 11,
              marginBottom: 12,
              wordBreak: "break-word"
            }}
          >
            {error.code || error.message || "unknown_error"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                flex: 1,
                background: "var(--border)",
                color: "var(--text-primary)",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              {t("common.reload")}
            </button>
            <button
              onClick={() => signOut(auth)}
              style={{
                flex: 1,
                background: "var(--danger)",
                color: "var(--danger-ink)",
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 700
              }}
            >
              {t("common.signOut")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "calc(var(--app-height) + 1px)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          paddingTop: "calc(12px + var(--safe-top))",
          borderBottom: "1px solid var(--surface-1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0
        }}
      >
        <button
          onClick={openSettings}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "transparent",
            border: "none",
            padding: 0,
            color: "inherit",
            cursor: "pointer",
            textAlign: "left"
          }}
          title={t("settings.openTitle")}
        >
          <AppLogo size={32} fontSize={11} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: -0.5 }}>
              {t("common.appName")}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-subtle)" }}>{user.displayName || user.email}</div>
          </div>
        </button>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {tab === "packages" && (
            <button
              onClick={() => setShowAddPkg(true)}
              style={{
                background: "var(--accent)",
                color: "var(--accent-ink)",
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
                background: "var(--accent)",
                color: "var(--accent-ink)",
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

        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: 16,
          paddingBottom:
            "calc(20px + var(--bottom-nav-height) + var(--safe-bottom) + var(--browser-bottom-offset))"
        }}
      >
        {tab === "dashboard" && (
          <div style={{ animation: "fadeIn .2s ease", display: "flex", flexDirection: "column", gap: 12 }}>
            {packages.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 20px", marginTop: 16 }}>
                <div style={{ fontSize: 13, color: "var(--text-subtle)", marginBottom: 14 }}>
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
                <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
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
                      accent={stats.profit >= 0 ? "var(--accent)" : "var(--danger)"}
                    />
                    <StatCard
                      label={t("dashboard.roiAndMargin")}
                      value={`${stats.roi}%`}
                      sub={t("dashboard.marginAndRecovery", {
                        margin: stats.marginRate.toFixed(0),
                        recovery: stats.recoveryRate.toFixed(0)
                      })}
                      accent={stats.profit >= 0 ? "var(--accent)" : "var(--danger)"}
                    />
                    <StatCard
                      label={t("dashboard.activeCapital")}
                      value={currency(stats.activeCapital)}
                      sub={t("dashboard.activeProductsAndUnits", {
                        products: stats.activeProducts,
                        units: unitCount(stats.availableUnits)
                      })}
                      accent="var(--alert)"
                    />
                    <StatCard
                      label={t("dashboard.rotation")}
                      value={`${stats.sellThroughRate.toFixed(0)}%`}
                      sub={t("dashboard.soldOverTotalUnits", {
                        sold: stats.soldCount,
                        total: stats.totalUnits
                      })}
                      accent="var(--info)"
                    />
                  </div>
                </div>

                <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
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
                      sub={`${currency(stats.month.revenue)} / ${currency(stats.month.cost)} · ${unitCount(stats.month.soldUnits)}`}
                      accent={stats.month.profit >= 0 ? "var(--accent)" : "var(--danger)"}
                    />
                    <StatCard
                      label={t("dashboard.yearLabel", { year: stats.yearLabel })}
                      value={currency(stats.year.profit)}
                      sub={`${currency(stats.year.revenue)} / ${currency(stats.year.cost)} · ${unitCount(stats.year.soldUnits)}`}
                      accent={stats.year.profit >= 0 ? "var(--accent)" : "var(--danger)"}
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
                              background: "var(--surface-0)",
                              borderRadius: 8,
                              padding: "9px 10px"
                            }}
                          >
                            <div style={{ fontSize: 11, color: "var(--text-soft)" }}>{row.label}</div>
                            <div style={{ textAlign: "right" }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: row.profit >= 0 ? "var(--accent)" : "var(--danger)"
                                }}
                              >
                                {currency(row.profit)}
                              </div>
                              <div style={{ fontSize: 9, color: "var(--text-subtle)" }}>
                                {currency(row.revenue)} / {currency(row.cost)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
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
                      accent="var(--violet)"
                    />
                    <StatCard
                      label={t("dashboard.avgTicketUnit")}
                      value={currency(stats.avgUnitRevenue)}
                      sub={`${unitCount(stats.soldCount)} ${t("common.soldWordPlural")}`}
                      accent="var(--info)"
                    />
                    <StatCard
                      label={t("dashboard.avgTicketSale")}
                      value={currency(stats.avgProductRevenue)}
                      sub={`${productCount(stats.soldProductsCount)} ${t("common.soldWordPlural")}`}
                      accent="var(--accent)"
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
                      accent={stats.estimatedOpenProfit >= 0 ? "var(--accent)" : "var(--alert)"}
                    />
                  </div>

                  {staleProducts.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-subtle)", padding: "6px 2px" }}>
                      {t("alerts.noStaleProducts")}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>
                        {t("alerts.reviewFoldersTitle")}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
                          gap: 8
                        }}
                      >
                        {reviewFolders.map((folder) => (
                          <button
                            key={folder.level}
                            onClick={() => folder.count > 0 && setShowReviewLevel(folder.level)}
                            disabled={folder.count === 0}
                            style={{
                              background: folder.count > 0 ? folder.bg : "var(--surface-0)",
                              border: `1px solid ${folder.count > 0 ? folder.border : "var(--border)"}`,
                              borderRadius: 10,
                              padding: "10px 11px",
                              textAlign: "left",
                              cursor: folder.count > 0 ? "pointer" : "default",
                              opacity: folder.count > 0 ? 1 : 0.62
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10,
                                marginBottom: 5
                              }}
                            >
                              <span style={{ fontSize: 11, color: folder.color, fontWeight: 700 }}>
                                📁 {folder.icon} {t("alerts.folderLabel", { days: folder.days })}
                              </span>
                              <span
                                style={{
                                  fontSize: 16,
                                  fontWeight: 800,
                                  color: folder.count > 0 ? "var(--text-primary)" : "var(--text-subtle)"
                                }}
                              >
                                {folder.count}
                              </span>
                            </div>
                            <div style={{ fontSize: 9, color: "var(--text-soft)" }}>
                              {t("alerts.pendingCount", { count: folder.count })}
                            </div>
                          </button>
                        ))}
                      </div>

                      <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 2 }}>
                        {t("alerts.reviewedHint")}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
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
                        style={{ flex: 1, background: "var(--surface-0)", borderRadius: 10, padding: 12 }}
                      >
                        <div style={{ fontSize: 10, color: "var(--text-soft)", marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                          {t("dashboard.packagesCount", { count: item.data.count })}
                        </div>
                        <div
                          style={{
                            fontSize: 19,
                            fontWeight: 800,
                            color: item.data.profit >= 0 ? "var(--accent)" : "var(--danger)",
                            marginTop: 6
                          }}
                        >
                          {currency(item.data.profit)}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--text-subtle)" }}>
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
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 8
                          }}
                        >
                          {t("dashboard.topCategories")}
                        </div>
                        <MiniBar data={chartCategoryData.slice(0, 5)} color="var(--info)" />
                      </div>
                    )}

                    {chartPlatformData.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            marginBottom: 8
                          }}
                        >
                          {t("dashboard.revenueByPlatform")}
                        </div>
                        <MiniBar data={chartPlatformData} color="var(--violet)" />
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
                      background: pkgSelectionMode ? "var(--danger)" : "var(--border)",
                      border: "none",
                      color: pkgSelectionMode ? "var(--danger-ink)" : "var(--text-soft)",
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
                        background: "var(--danger)",
                        border: "none",
                        color: "var(--danger-ink)",
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
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
                      {t("packages.selectedCount", { count: selectedPackageIds.size })}
                    </div>
                  )}
                </div>

                {sortedPackages.map((pkg) => {
                  const packageProducts = products.filter((product) => product.packageId === pkg.id);
                  const previewProducts = packageProducts.slice(0, 3);
                  const remainingPreviewCount = Math.max(0, packageProducts.length - previewProducts.length);
                  const previewCategories = [...new Set(packageProducts.map((product) => categoryLabel(product.category)))].slice(
                    0,
                    3
                  );
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
                        background: isSelected ? "var(--surface-3)" : "var(--surface-1)",
                        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 14,
                        padding: "14px 16px",
                        cursor: pkgSelectionMode ? "pointer" : "default",
                        boxShadow: isSelected ? "0 0 0 1px rgba(216,176,111,.45) inset" : "none",
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
                                color: isSelected ? "var(--accent)" : "var(--text-subtle)",
                                fontWeight: 700
                              }}
                            >
                              {isSelected ? "✓" : "○"}
                            </span>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{shortDate(pkg.date)}</div>
                            {pkg.notes && (
                              <div
                                style={{
                                  fontSize: 9,
                                  color: "var(--text-subtle)",
                                  marginTop: 2,
                                  maxWidth: 180,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis"
                                }}
                              >
                                {pkg.notes}
                              </div>
                            )}
                          </div>
                          <Badge color={(Number(pkg.cost) || 0) <= 3 ? "green" : "orange"}>
                            {currency(pkg.cost)}
                          </Badge>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: revenue > 0 ? (profit >= 0 ? "var(--accent)" : "var(--danger)") : "var(--border-strong)",
                              fontSize: 15
                            }}
                          >
                            {revenue > 0 ? `${profit >= 0 ? "+" : ""}${currency(profit)}` : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                            {t("packages.soldUnits", { sold: soldUnits, total: totalUnits })}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          background: "var(--surface-0)",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: "10px 11px",
                          marginBottom: 8
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: packageProducts.length > 0 ? 8 : 0
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text-muted)",
                              textTransform: "uppercase",
                              letterSpacing: 0.9
                            }}
                          >
                            {t("packages.packageProductsTitle")}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                            {t("products.itemsCount", { count: packageProducts.length })}
                          </div>
                        </div>

                        {packageProducts.length === 0 ? (
                          <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                            {t("packages.packageHasNoProducts")}
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                              {previewCategories.map((category) => (
                                <span
                                  key={`${pkg.id}-${category}`}
                                  style={{
                                    fontSize: 9,
                                    color: "var(--text-soft)",
                                    padding: "3px 8px",
                                    borderRadius: 999,
                                    border: "1px solid var(--border)",
                                    background: "var(--surface-2)"
                                  }}
                                >
                                  {category}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {previewProducts.map((product) => (
                                <div
                                  key={product.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                    <div
                                      style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 6,
                                        border: "1px solid var(--border)",
                                        background: "var(--surface-2)",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                        display: "grid",
                                        placeItems: "center",
                                        color: "var(--text-muted)",
                                        fontSize: 10,
                                        fontWeight: 700
                                      }}
                                    >
                                      {product.imageDataUrl ? (
                                        <img
                                          src={product.imageDataUrl}
                                          alt={t("products.imageAlt", { name: product.name })}
                                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                      ) : (
                                        (product.name || "?").trim().charAt(0).toUpperCase()
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        minWidth: 0,
                                        fontSize: 11,
                                        color: "var(--text-soft)",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis"
                                      }}
                                    >
                                      {product.name}
                                    </div>
                                  </div>

                                  <Badge color={STATUS_BADGE_COLORS[getStatusKey(product.status)] || "neutral"}>
                                    {statusLabel(product.status)}
                                  </Badge>
                                </div>
                              ))}

                              {remainingPreviewCount > 0 && (
                                <div style={{ fontSize: 10, color: "var(--text-subtle)" }}>
                                  +{t("products.itemsCount", { count: remainingPreviewCount })}
                                </div>
                              )}
                            </div>
                          </>
                        )}
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
                              background: isSelected ? "var(--accent)" : "var(--border)",
                              color: isSelected ? "var(--accent-ink)" : "var(--text-soft)",
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
                                background: "var(--border)",
                                border: "none",
                                color: "var(--info)",
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
                                background: "var(--border)",
                                border: "none",
                                color: "var(--accent)",
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
                                background: "var(--border)",
                                border: "none",
                                color: "var(--info)",
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
                                background: "var(--border)",
                                border: "none",
                                color: "var(--danger)",
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
                  background: selectionMode ? "var(--danger)" : "var(--border)",
                  border: "none",
                  color: selectionMode ? "var(--danger-ink)" : "var(--text-soft)",
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
                    background: "var(--danger)",
                    border: "none",
                    color: "var(--danger-ink)",
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
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
                  {t("packages.selectedCount", { count: selectedProductIds.size })}
                </div>
              )}
            </div>

            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "8px 10px",
                marginBottom: 12,
                fontSize: 10,
                color: "var(--text-muted)"
              }}
            >
              {t("products.ageLegend")} <span style={{ color: "var(--info)" }}>7d</span> ·{" "}
              <span style={{ color: "var(--warning)" }}>14d</span> ·{" "}
              <span style={{ color: "var(--alert)" }}>28d</span> · <span style={{ color: "var(--danger)" }}>42d+</span>
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState
                icon="🔎"
                msg={products.length === 0 ? t("products.addFromPackage") : t("products.noResults")}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 12 }}>🟢 {t("products.listedTitle")}</div>
                    <div style={{ fontSize: 10, color: "var(--text-soft)" }}>
                      {t("products.itemsCount", { count: productsForSale.length })}
                    </div>
                  </div>

                  {productsForSale.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-subtle)", textAlign: "center", padding: 16 }}>
                      {t("products.noListedProducts")}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {productsForSale.map(renderProductCard)}
                    </div>
                  )}
                </div>

                <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 12 }}>✅ {t("products.soldTitle")}</div>
                    <div style={{ fontSize: 10, color: "var(--text-soft)" }}>
                      {t("products.itemsCount", { count: productsSold.length })}
                    </div>
                  </div>

                  {productsSold.length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-subtle)", textAlign: "center", padding: 16 }}>
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
          left: 0,
          right: 0,
          bottom: "var(--browser-bottom-offset)",
          background: "var(--surface-0)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "flex-end",
          boxSizing: "border-box",
          paddingTop: 8,
          paddingBottom: "calc(8px + var(--safe-bottom))",
          minHeight: "calc(var(--bottom-nav-height) + var(--safe-bottom))",
          paddingLeft: "var(--safe-left)",
          paddingRight: "var(--safe-right)",
          zIndex: 1100
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
              color: tab === tabItem.id ? "var(--accent)" : "var(--text-muted)",
              transition: "color .2s",
              lineHeight: 1
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, display: "block" }}>{tabItem.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>{tabItem.label}</span>
          </button>
        ))}
      </div>

      <Modal
        open={!!showReviewLevel}
        onClose={() => setShowReviewLevel(null)}
        title={
          activeReviewFolder
            ? t("alerts.reviewScreenTitle", { days: activeReviewFolder.days })
            : t("alerts.reviewScreenGeneric")
        }
      >
        {!activeReviewFolder || activeReviewFolder.count === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 2px 8px" }}>
            {t("alerts.reviewScreenEmpty")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: activeReviewFolder.color, fontWeight: 700, marginBottom: 2 }}>
              {activeReviewFolder.icon} {t("alerts.pendingCount", { count: activeReviewFolder.count })}
            </div>

            {activeReviewFolder.items.map((product) => {
              const estimatedCost = getCostPerProduct(product, packages, products);
              const reviewDropSuggestions = getPriceDropSuggestions(product, product.alert);
              const reviewDropSuggestionText = reviewDropSuggestions
                .map((item) =>
                  t("alerts.dropSuggestionItem", {
                    percent: item.percent,
                    price: currency(item.unitPrice)
                  })
                )
                .join(" · ");
              const isReviewing = reviewingProductIds.has(product.id);

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
                      <div style={{ fontSize: 10, color: "var(--text-soft)", marginTop: 3 }}>
                        {product.alert.daysSince}d · {product.alert.message}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {t("dashboard.estimatedCost", { cost: currency(estimatedCost) })}
                      </div>
                      {reviewDropSuggestionText && (
                        <div style={{ fontSize: 10, color: "var(--text-soft)", marginTop: 2 }}>
                          {t("alerts.dropSuggestionPrefix")} {reviewDropSuggestionText}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          setShowReviewLevel(null);
                          setTimeout(() => openSellModal(product.id), 80);
                        }}
                        style={{
                          background: "var(--accent)",
                          color: "var(--accent-ink)",
                          border: "none",
                          padding: "8px 10px",
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: "pointer",
                          whiteSpace: "nowrap"
                        }}
                      >
                        💰 {t("common.sell")}
                      </button>

                      <button
                        onClick={() => markProductReviewed(product)}
                        disabled={isReviewing}
                        style={{
                          background: "var(--surface-1)",
                          color: product.alert.color,
                          border: `1px solid ${product.alert.border}`,
                          padding: "8px 10px",
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: isReviewing ? "default" : "pointer",
                          opacity: isReviewing ? 0.7 : 1,
                          whiteSpace: "nowrap"
                        }}
                      >
                        ✅ {isReviewing ? t("alerts.reviewingButton") : t("alerts.reviewedButton")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title={t("settings.title")}>
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10
            }}
          >
            🌐 {t("settings.languageTitle")}
          </div>
          <LanguageSelector />
        </div>

        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10
            }}
          >
            🎨 {t("settings.themeTitle")}
          </div>

          <Field label={t("settings.themeLabel")}>
            <select value={selectedTheme} onChange={handleThemeSelection} style={selectS}>
              <option value={DEFAULT_THEME}>{t("settings.themeClassic")}</option>
              <option value={VERCEL_DARK_THEME}>{t("settings.themeVercelDark")}</option>
            </select>
          </Field>

          <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 8 }}>
            {t("settings.themeHint")}
          </div>
        </div>

        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10
            }}
          >
            👤 {t("settings.profileTitle")}
          </div>

          <Field label={t("settings.displayNameLabel")}>
            <input
              value={settingsName}
              onChange={(event) => setSettingsName(event.target.value)}
              placeholder={t("settings.displayNamePlaceholder")}
              style={inputS}
            />
          </Field>

          <Field label={t("settings.currentEmailLabel")}>
            <input value={user.email || "—"} readOnly style={{ ...inputS, color: "var(--text-soft)" }} />
          </Field>

          <button
            onClick={saveDisplayName}
            disabled={settingsBusy}
            style={{
              ...btnP,
              opacity: settingsBusy ? 0.55 : 1,
              marginTop: 2
            }}
          >
            {t("settings.saveProfileButton")}
          </button>
        </div>

        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10
            }}
          >
            🔐 {t("settings.securityTitle")}
          </div>

          <Field label={t("settings.newEmailLabel")}>
            <input
              type="email"
              value={settingsEmail}
              onChange={(event) => setSettingsEmail(event.target.value)}
              placeholder={t("settings.newEmailPlaceholder")}
              style={inputS}
              autoCapitalize="none"
            />
          </Field>

          {hasPasswordProvider && (
            <Field label={t("settings.currentPasswordLabel")}>
              <input
                type="password"
                value={settingsCurrentPassword}
                onChange={(event) => setSettingsCurrentPassword(event.target.value)}
                placeholder={t("settings.currentPasswordPlaceholder")}
                style={inputS}
              />
            </Field>
          )}

          <button
            onClick={saveEmail}
            disabled={settingsBusy}
            style={{
              ...btnP,
              opacity: settingsBusy ? 0.55 : 1,
              marginBottom: hasPasswordProvider ? 10 : 0
            }}
          >
            {t("settings.saveEmailButton")}
          </button>

          {hasPasswordProvider ? (
            <>
              <Field label={t("settings.newPasswordLabel")}>
                <input
                  type="password"
                  value={settingsNewPassword}
                  onChange={(event) => setSettingsNewPassword(event.target.value)}
                  placeholder={t("settings.newPasswordPlaceholder")}
                  style={inputS}
                />
              </Field>

              <button
                onClick={savePassword}
                disabled={settingsBusy}
                style={{ ...btnP, opacity: settingsBusy ? 0.55 : 1 }}
              >
                {t("settings.savePasswordButton")}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 10 }}>
              {t("settings.passwordNotAvailable")}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setShowSettings(false);
            signOut(auth);
          }}
          style={{
            width: "100%",
            marginTop: 12,
            background: "var(--danger)",
            color: "var(--danger-ink)",
            border: "none",
            borderRadius: 10,
            padding: "12px 14px",
            fontWeight: 800,
            cursor: "pointer"
          }}
        >
          🚪 {t("common.signOut")}
        </button>

        {settingsError && (
          <div
            style={{
              background: "rgba(118,40,62,.24)",
              border: "1px solid rgba(200,106,130,.45)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "var(--danger)",
              marginTop: 12
            }}
          >
            {settingsError}
          </div>
        )}

        {settingsSuccess && (
          <div
            style={{
              background: "rgba(84,60,104,.25)",
              border: "1px solid rgba(216,176,111,.45)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "var(--accent-strong)",
              marginTop: 12
            }}
          >
            {settingsSuccess}
          </div>
        )}
      </Modal>

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
          <NumberInput
            type="number"
            step="0.5"
            placeholder={suggestedCost ? String(suggestedCost) : ""}
            value={pkgCost}
            onChange={(event) => setPkgCost(event.target.value)}
            style={inputS}
            unit="€"
          />
        </Field>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[1, 5, 10, 20].map((amount) => (
            <button
              key={amount}
              onClick={() => setPkgQty(String(amount))}
              style={{
                flex: 1,
                background: pkgQtyNum === amount ? "var(--accent)" : "var(--border)",
                color: pkgQtyNum === amount ? "var(--accent-ink)" : "var(--text-soft)",
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
            <NumberInput
              type="number"
              min="1"
              max="200"
              step="1"
              value={pkgQty}
              onChange={(event) => setPkgQty(event.target.value)}
              style={inputS}
              unit={t("common.unitShort")}
            />
          </Field>
          <Field label={t("common.totalEstimate")}>
            <input value={currency(pkgTotalEstimate || 0)} readOnly style={{ ...inputS, color: "var(--text-soft)" }} />
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

      <Modal open={!!editPackage} onClose={closeEditPackage} title={t("packages.editPackage")}>
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
              <NumberInput
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
                unit="€"
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
            <NumberInput
              type="number"
              min="1"
              step="1"
              value={prodQty}
              onChange={(event) => setProdQty(event.target.value)}
              style={inputS}
              unit={t("common.unitShort")}
            />
          </Field>

          <Field label={t("products.targetUnitPrice")}>
            <NumberInput
              type="number"
              step="0.5"
              placeholder={t("products.targetPricePlaceholder")}
              value={prodEst}
              onChange={(event) => setProdEst(event.target.value)}
              style={inputS}
              unit="€"
            />
          </Field>
        </div>

        <Field label={t("products.photoLabel")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {prodImageDataUrl ? (
              <button
                onClick={() => openImagePreview(prodImageDataUrl, prodName)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "zoom-in"
                }}
                title={t("products.openImage")}
              >
                <img
                  src={prodImageDataUrl}
                  alt={t("products.imageAlt", { name: prodName || t("products.newProduct") })}
                  style={{
                    width: "100%",
                    maxHeight: 210,
                    borderRadius: 10,
                    objectFit: "cover",
                    border: "1px solid var(--border)"
                  }}
                />
              </button>
            ) : (
              <div
                style={{
                  ...inputS,
                  padding: "12px 14px",
                  fontSize: 11,
                  color: "var(--text-subtle)",
                  textAlign: "center"
                }}
              >
                {t("products.photoHint")}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <label
                style={{
                  flex: 1,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-soft)",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center"
                }}
              >
                📷 {t("products.photoTakeButton")}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleNewProductImage}
                  style={{ display: "none" }}
                />
              </label>

              <label
                style={{
                  flex: 1,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-soft)",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center"
                }}
              >
                🖼️ {t("products.photoGalleryButton")}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleNewProductImage}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {prodImageDataUrl && (
              <button
                onClick={() => setProdImageDataUrl("")}
                style={{
                  background: "var(--border)",
                  color: "var(--text-soft)",
                  border: "none",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer"
                }}
              >
                🗑 {t("products.removePhotoButton")}
              </button>
            )}
          </div>
        </Field>

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
              const alert = getAlertLevel(
                product,
                t,
                selectedPackage?.date || packageDateById[product.packageId] || null
              );
              const packageDropSuggestions = getPriceDropSuggestions(product, alert);
              const packageDropSuggestionText = packageDropSuggestions
                .map((item) =>
                  t("alerts.dropSuggestionItem", {
                    percent: item.percent,
                    price: currency(item.unitPrice)
                  })
                )
                .join(" · ");

              return (
                <div
                  key={product.id}
                  style={{
                    background: alert ? alert.bg : "var(--surface-1)",
                    border: `1px solid ${alert ? alert.border : "var(--border)"}`,
                    borderRadius: 10,
                    padding: "12px 14px"
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{product.name}</div>
                  {product.imageDataUrl && (
                    <button
                      onClick={() => openImagePreview(product.imageDataUrl, product.name)}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: "zoom-in"
                      }}
                      title={t("products.openImage")}
                    >
                      <img
                        src={product.imageDataUrl}
                        alt={t("products.imageAlt", { name: product.name })}
                        style={{
                          width: "100%",
                          maxHeight: 170,
                          borderRadius: 10,
                          objectFit: "cover",
                          border: "1px solid var(--border)"
                        }}
                      />
                    </button>
                  )}
                  {alert && (
                    <div style={{ fontSize: 10, color: alert.color, marginTop: 3, fontWeight: 700 }}>
                      {alert.icon} {alert.daysSince}d · {alert.message}
                    </div>
                  )}
                  {packageDropSuggestionText && (
                    <div style={{ fontSize: 10, color: "var(--text-soft)", marginTop: 2 }}>
                      {t("alerts.dropSuggestionPrefix")} {packageDropSuggestionText}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--text-soft)", marginTop: 3 }}>
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
                            background: "var(--accent)",
                            color: "var(--accent-ink)",
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
                          background: "var(--border)",
                          color: "var(--info)",
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
          <div style={{ fontSize: 11, color: "var(--text-soft)", marginBottom: 12 }}>
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
          <NumberInput
            type="number"
            min="1"
            max={sellAvailableQty || 1}
            step="1"
            value={sellQty}
            onChange={(event) => setSellQty(event.target.value)}
            style={inputS}
            unit={t("common.unitShort")}
          />
        </Field>

        <Field label={t("sale.unitPrice")}>
          <NumberInput
            type="number"
            step="0.5"
            placeholder={t("sale.unitPricePlaceholder")}
            value={sellPrice}
            onChange={(event) => setSellPrice(event.target.value)}
            style={inputS}
            unit="€"
          />
        </Field>

        {sellPreviewTotal > 0 && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
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

      <Modal open={!!editProduct} onClose={closeEditProduct} title={t("products.editProduct")}>
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
                <NumberInput
                  type="number"
                  min="1"
                  step="1"
                  value={editProduct.quantity}
                  onChange={(event) =>
                    setEditProduct((previous) => ({ ...previous, quantity: event.target.value }))
                  }
                  style={inputS}
                  unit={t("common.unitShort")}
                />
              </Field>

              <Field label={t("products.targetUnitPrice")}>
                <NumberInput
                  type="number"
                  step="0.5"
                  value={editProduct.estPrice}
                  onChange={(event) =>
                    setEditProduct((previous) => ({ ...previous, estPrice: event.target.value }))
                  }
                  style={inputS}
                  unit="€"
                />
              </Field>
            </div>

            <Field label={t("products.photoLabel")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {editProduct.imageDataUrl ? (
                  <button
                    onClick={() => openImagePreview(editProduct.imageDataUrl, editProduct.name)}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "zoom-in"
                    }}
                    title={t("products.openImage")}
                  >
                    <img
                      src={editProduct.imageDataUrl}
                      alt={t("products.imageAlt", { name: editProduct.name })}
                      style={{
                        width: "100%",
                        maxHeight: 210,
                        borderRadius: 10,
                        objectFit: "cover",
                        border: "1px solid var(--border)"
                      }}
                    />
                  </button>
                ) : (
                  <div
                    style={{
                      ...inputS,
                      padding: "12px 14px",
                      fontSize: 11,
                      color: "var(--text-subtle)",
                      textAlign: "center"
                    }}
                  >
                    {t("products.photoHint")}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <label
                    style={{
                      flex: 1,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-soft)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    📷 {t("products.photoTakeButton")}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleEditProductImage}
                      style={{ display: "none" }}
                    />
                  </label>

                  <label
                    style={{
                      flex: 1,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text-soft)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    🖼️ {t("products.photoGalleryButton")}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditProductImage}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                {editProduct.imageDataUrl && (
                  <button
                    onClick={() =>
                      setEditProduct((previous) => (previous ? { ...previous, imageDataUrl: "" } : previous))
                    }
                    style={{
                      background: "var(--border)",
                      color: "var(--text-soft)",
                      border: "none",
                      padding: "10px 12px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: "pointer"
                    }}
                  >
                    🗑 {t("products.removePhotoButton")}
                  </button>
                )}
              </div>
            </Field>

            {editIsSold && (
              <>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                  {t("products.saleData")}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Field label={t("products.saleUnitPrice")}>
                    <NumberInput
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
                      unit="€"
                    />
                  </Field>
                  <Field label={t("products.saleTotal")}>
                    <input
                      value={currency(editSoldTotalPreview)}
                      style={{ ...inputS, color: "var(--text-soft)" }}
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

          </>
        )}
      </Modal>

      {imagePreview && (
        <div
          onClick={closeImagePreview}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(6,6,8,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 920,
              maxHeight: "95vh",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "var(--text-soft)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                {imagePreview.name || t("products.imagePreviewTitle")}
              </div>
              <button
                onClick={closeImagePreview}
                style={{
                  background: "var(--surface-1)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>

            <img
              src={imagePreview.src}
              alt={t("products.imageAlt", { name: imagePreview.name || t("products.imagePreviewTitle") })}
              style={{
                width: "100%",
                maxHeight: "calc(95vh - 70px)",
                objectFit: "contain",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface-0)"
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
