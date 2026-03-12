import AppLogo from "./AppLogo";
import { globalCSS } from "../../constants/styles";
import { useTranslation } from "react-i18next";

export default function LoadingScreen({ fullBackground = false }) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: fullBackground ? "#070d16" : undefined
      }}
    >
      <style>{globalCSS}</style>
      <div style={{ textAlign: "center" }}>
        <AppLogo size={48} fontSize={16} />
        <div style={{ color: "#95a8c0", fontSize: 13, marginTop: 12 }}>{t("common.loading")}</div>
      </div>
    </div>
  );
}
