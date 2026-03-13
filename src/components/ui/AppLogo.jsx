export default function AppLogo({ size = 40 }) {
  return (
    <img
      src="/logo.jpeg"
      alt="DH logo"
      style={{
        width: size,
        height: size,
        display: "block",
        objectFit: "cover",
        borderRadius: Math.round(size * 0.28),
        border: "1px solid rgba(255,255,255,.18)",
        boxShadow: "0 8px 20px rgba(24,10,34,.42)"
      }}
    />
  );
}
