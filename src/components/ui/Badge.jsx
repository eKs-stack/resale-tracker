const COLORS = {
  green: { background: "#0d3", color: "#001a00" },
  red: { background: "#f43", color: "#fff" },
  yellow: { background: "#fd0", color: "#1a1400" },
  blue: { background: "#08f", color: "#fff" },
  purple: { background: "#a855f7", color: "#fff" },
  neutral: { background: "#304560", color: "#d5e1ef" },
  orange: { background: "#f90", color: "#1a0e00" }
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
