import { useTranslation } from "react-i18next";
import { formatCurrency } from "../../utils/trackerUtils";

export default function MiniBar({ data, color = "var(--accent)" }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || "es";

  if (!data || !data.length) return null;

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((item, index) => (
        <div key={`${item.label}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 70,
              fontSize: 10,
              color: "var(--text-soft)",
              textAlign: "right",
              flexShrink: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              flex: 1,
              background: "var(--surface-0)",
              borderRadius: 4,
              height: 22,
              position: "relative",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                width: `${(item.value / max) * 100}%`,
                background: color,
                height: "100%",
                borderRadius: 4,
                transition: "width 0.5s ease",
                minWidth: item.value > 0 ? 4 : 0
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text-primary)"
              }}
            >
              {formatCurrency(item.value, locale)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
