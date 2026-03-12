export default function EmptyState({ icon, msg }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: "#304560" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "#7b8fa9" }}>{msg}</div>
    </div>
  );
}
