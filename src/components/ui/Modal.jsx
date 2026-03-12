import { useTranslation } from "react-i18next";

export default function Modal({ open, onClose, title, children }) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#0d1420",
          borderTop: "1px solid #25354c",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px",
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          width: "100%",
          maxWidth: 500,
          maxHeight: "85vh",
          overflowY: "auto",
          animation: "slideUp 0.25s ease-out"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "#e8eef7" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "#111a26",
              color: "#c2d1e5",
              border: "1px solid #25354c",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 13,
              cursor: "pointer"
            }}
            aria-label={t("common.closeModal")}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
