export const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;width:100%;background:#070d16;color:#e8eef7;font-family:'JetBrains Mono',monospace;font-size:14px;overflow:hidden}
input,select,button{font-family:inherit}input,select{color-scheme:dark}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#304560;border-radius:4px}`;

export const inputS = {
  width: "100%",
  background: "#111a26",
  border: "1px solid #304560",
  borderRadius: 10,
  padding: "14px 16px",
  color: "#e8eef7",
  fontSize: 15,
  outline: "none"
};

export const selectS = {
  ...inputS,
  paddingRight: 44,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%23c2d1e5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  backgroundSize: "16px",
  cursor: "pointer"
};

export const btnP = {
  background: "#0d3",
  color: "#000",
  border: "none",
  padding: "16px 24px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  width: "100%"
};

export const btnGoogle = {
  background: "#fff",
  color: "#111a26",
  border: "none",
  padding: "14px 24px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10
};
