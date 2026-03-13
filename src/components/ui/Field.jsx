export default function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14, flex: 1, minWidth: 0 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: "var(--text-muted)",
          marginBottom: 6,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
