const COLORS = {
  green: { background: "var(--accent)", color: "var(--accent-ink)" },
  red: { background: "var(--danger)", color: "var(--danger-ink)" },
  yellow: { background: "var(--warning)", color: "var(--accent-ink)" },
  blue: { background: "var(--info)", color: "var(--accent-ink)" },
  purple: { background: "var(--violet)", color: "var(--text-primary)" },
  neutral: { background: "var(--border)", color: "var(--text-primary)" },
  orange: { background: "var(--alert)", color: "var(--accent-ink)" }
};

export default function Badge({ children, color = "neutral" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        ...(COLORS[color] || COLORS.neutral)
      }}
    >
      {children}
    </span>
  );
}
