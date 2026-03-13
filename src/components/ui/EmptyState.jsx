export default function EmptyState({ icon, msg }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-subtle)" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg}</div>
    </div>
  );
}
