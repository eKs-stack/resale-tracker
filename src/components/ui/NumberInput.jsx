const wrapperS = {
  position: "relative",
  width: "100%"
};

const unitS = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-subtle)",
  pointerEvents: "none",
  letterSpacing: 0.3,
  textTransform: "uppercase"
};

export default function NumberInput({ unit, style, unitStyle, ...props }) {
  return (
    <div style={wrapperS}>
      <input {...props} style={unit ? { ...style, paddingRight: 48 } : style} />
      {unit && (
        <span aria-hidden="true" style={{ ...unitS, ...unitStyle }}>
          {unit}
        </span>
      )}
    </div>
  );
}
