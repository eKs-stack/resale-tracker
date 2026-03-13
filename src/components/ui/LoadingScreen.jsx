import AppLogo from "./AppLogo";
import { globalCSS } from "../../constants/styles";
import { useTranslation } from "react-i18next";

export default function LoadingScreen({ fullBackground = false }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: fullBackground ? "var(--bg-root)" : undefined
      }}
    >
      <style>{globalCSS}</style>
      <div style={{ textAlign: "center" }}>
        <AppLogo size={48} fontSize={16} />
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>{t("common.loading")}</div>
      </div>
    </div>
  );
}
