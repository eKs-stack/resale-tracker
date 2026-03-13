export default function StatCard({ label, value, sub, accent = "var(--accent)" }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "16px 18px",
        flex: "1 1 45%",
        minWidth: 0
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
      {sub && (
        <div
          style={{
            fontSize: 10,
            color: "var(--text-subtle)",
            marginTop: 2,
            lineHeight: 1.35,
            textWrap: "balance"
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
