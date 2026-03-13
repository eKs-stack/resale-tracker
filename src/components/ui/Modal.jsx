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
        background: "rgba(24,8,33,0.78)",
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
          background: "var(--surface-0)",
          borderTop: "1px solid var(--border)",
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
          <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "var(--surface-1)",
              color: "var(--text-soft)",
              border: "1px solid var(--border)",
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
