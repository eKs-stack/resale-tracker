import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: ["es", "en", "bg"],
    fallbackLng: "es",
    load: "languageOnly",
    detection: {
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      lookupQuerystring: "lang",
      caches: ["localStorage"]
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

const applyLang = (lang) => {
  document.documentElement.lang = lang;
};

applyLang(i18n.resolvedLanguage || "es");
i18n.on("languageChanged", applyLang);

export default i18n;
