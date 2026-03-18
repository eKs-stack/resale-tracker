import { useEffect } from "react";
import { useTranslation } from "react-i18next";

let modalScrollLockCount = 0;
let lockedScrollY = 0;

export default function Modal({ open, onClose, title, children }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open || typeof window === "undefined" || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousBodyTouchAction = body.style.touchAction;

    if (modalScrollLockCount === 0) {
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${lockedScrollY}px`;
      body.style.width = "100%";
      body.style.touchAction = "none";
    }

    modalScrollLockCount += 1;

    return () => {
      modalScrollLockCount = Math.max(0, modalScrollLockCount - 1);
      if (modalScrollLockCount > 0) return;

      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      body.style.touchAction = previousBodyTouchAction;
      window.scrollTo(0, lockedScrollY);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay-backdrop)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--browser-bottom-offset)",
        paddingLeft: "var(--safe-left)",
        paddingRight: "var(--safe-right)",
        zIndex: 1600
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--surface-0)",
          borderTop: "1px solid var(--border)",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px",
          paddingBottom: "calc(24px + var(--safe-bottom))",
          width: "100%",
          maxWidth: 500,
          minWidth: 0,
          maxHeight: "calc(var(--app-height) - var(--safe-top) - var(--browser-bottom-offset) - 10px)",
          overflowX: "hidden",
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
