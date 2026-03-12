import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { value: "es", labelKey: "language.es" },
  { value: "en", labelKey: "language.en" },
  { value: "bg", labelKey: "language.bg" }
];

export default function LanguageSelector({ compact = false }) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage || "es";

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "#95a8c0",
        fontSize: compact ? 10 : 11,
        textTransform: "uppercase",
        letterSpacing: 0.6
      }}
    >
      {!compact && <span>{t("language.label")}</span>}
      <select
        value={currentLanguage}
        onChange={(event) => {
          i18n.changeLanguage(event.target.value);
        }}
        style={{
          background: "#111a26",
          color: "#d5e1ef",
          border: "1px solid #304560",
          borderRadius: 8,
          padding: compact ? "4px 8px" : "6px 10px",
          fontSize: compact ? 10 : 11,
          cursor: "pointer"
        }}
      >
        {LANGUAGES.map((language) => (
          <option key={language.value} value={language.value}>
            {t(language.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
