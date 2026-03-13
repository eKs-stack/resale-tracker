import { useTranslation } from "react-i18next";
import { selectS } from "../../constants/styles";

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
        color: "var(--text-muted)",
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
          ...selectS,
          width: "auto",
          minWidth: compact ? 78 : 84,
          borderRadius: 8,
          padding: compact ? "4px 30px 4px 8px" : "6px 32px 6px 10px",
          fontSize: compact ? 10 : 11,
          backgroundPosition: "right 10px center",
          backgroundSize: "14px"
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
