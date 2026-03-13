export const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=JetBrains+Mono:wght@400;700;800&display=swap');
:root{
--app-height:100vh;
--bg-root:#2a1b37;
--bg-root-alt:#342145;
--surface-0:#3a2850;
--surface-1:#452e5f;
--surface-2:#51376c;
--surface-3:#5e4380;
--border:#7a5a90;
--border-strong:#9a76ad;
--text-primary:#f6e8d1;
--text-soft:#e7d6c0;
--text-muted:#ccb3c9;
--text-subtle:#ad8fb4;
--accent:#d8b06f;
--accent-strong:#f0cd8a;
--accent-ink:#2d1d10;
--danger:#c86a82;
--danger-ink:#ffe7ee;
--info:#b89ad6;
--warning:#e7c58c;
--alert:#d59b69;
--violet:#9f7fc2
}
@supports (height: 100dvh){:root{--app-height:100dvh}}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;width:100%;background:radial-gradient(120% 120% at 15% -10%,#5a3a6b 0%,var(--bg-root) 40%,#23142f 100%);color:var(--text-primary);font-family:'JetBrains Mono',monospace;font-size:14px;overflow:hidden}
input,select,button{font-family:inherit}
input,select{color-scheme:dark}
input[type="date"]{width:100%;max-width:100%;min-width:0;display:block}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:4px}`;

export const inputS = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "block",
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "14px 16px",
  color: "var(--text-primary)",
  fontSize: 16,
  outline: "none"
};

export const selectS = {
  ...inputS,
  paddingRight: 44,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%23e7d6c0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 14px center",
  backgroundSize: "16px",
  cursor: "pointer"
};

export const btnP = {
  background: "linear-gradient(135deg,var(--accent) 0%,var(--accent-strong) 100%)",
  color: "var(--accent-ink)",
  border: "1px solid rgba(255,255,255,.18)",
  padding: "16px 24px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  width: "100%"
};

export const btnGoogle = {
  background: "var(--surface-1)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
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
