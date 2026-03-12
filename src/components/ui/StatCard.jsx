export default function StatCard({ label, value, sub, accent = "#0d3" }) {
  return (
    <div
      style={{
        background: "#111a26",
        border: "1px solid #1c2738",
        borderRadius: 14,
        padding: "16px 18px",
        flex: "1 1 45%",
        minWidth: 0
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#95a8c0",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#7b8fa9", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
