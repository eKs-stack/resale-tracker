export default function AppLogo({ size = 40, fontSize = 14 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: "linear-gradient(135deg,#00e266 0%, #00b3ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 18px rgba(0,180,255,.25)"
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 800,
          color: "#00140a",
          letterSpacing: -0.5,
          lineHeight: 1
        }}
      >
        RT
      </span>
    </div>
  );
}
