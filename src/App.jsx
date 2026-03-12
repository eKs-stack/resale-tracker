import { useState, useMemo, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect
} from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";

const PLATFORMS = ["Wallapop", "Vinted"];
const PRODUCT_STATUS = ["Pendiente", "En venta", "Vendido", "Descartado", "Me lo quedo"];
const CATEGORIES = ["Electrónica", "Ropa", "Hogar", "Juguetes", "Belleza", "Deporte", "Libros/Media", "Accesorios", "Otro"];
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
const formatDate = (d) => { if (!d) return ""; return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }); };
const formatCurrency = (n) => n.toFixed(2) + "€";
const dayOfWeek = (dateStr) => new Date(dateStr).getDay();
const getDayLabel = (dateStr) => { const day = dayOfWeek(dateStr); if (day === 2) return "Martes"; if (day === 3) return "Miércoles"; return new Date(dateStr).toLocaleDateString("es-ES", { weekday: "long" }); };
const parseDateValue = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getMonthKey = (value) => {
  const d = parseDateValue(value); if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const getYearKey = (value) => {
  const d = parseDateValue(value); if (!d) return null;
  return String(d.getFullYear());
};
const formatMonthKey = (key) => {
  if (!key) return "";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-ES", { month: "short", year: "numeric" });
};

const ALERT_LEVELS = [
  { days: 14, level: "warning", color: "#fd0", bg: "#1a1800", border: "#3a3200", icon: "⚠️", message: "Baja precio 20-30%" },
  { days: 28, level: "urgent", color: "#f90", bg: "#1a1000", border: "#3a2200", icon: "🔥", message: "Pon a precio de coste" },
  { days: 42, level: "critical", color: "#f43", bg: "#1a0808", border: "#3a1515", icon: "🚨", message: "Libera capital ya" },
];

const getDaysSince = (dateStr) => { if (!dateStr) return 0; return Math.floor((new Date() - new Date(dateStr)) / 86400000); };
const getAlertLevel = (product) => {
  if (product.status === "Vendido" || product.status === "Descartado" || product.status === "Me lo quedo") return null;
  const days = getDaysSince(product.createdAt); let matched = null;
  for (const alert of ALERT_LEVELS) { if (days >= alert.days) matched = { ...alert, daysSince: days }; }
  return matched;
};
const getCostPerProduct = (product, pkgs, prods) => {
  const pkg = pkgs.find((p) => p.id === product.packageId); if (!pkg) return 0;
  const count = prods.filter((p) => p.packageId === pkg.id).length;
  return count > 0 ? pkg.cost / count : pkg.cost;
};
const getProductQuantity = (product) => Math.max(1, parseInt(product?.quantity, 10) || 1);
const getSoldQuantity = (product) => {
  const qty = getProductQuantity(product);
  if (typeof product?.soldQuantity === "number") return Math.max(0, Math.min(qty, product.soldQuantity));
  if (product?.status === "Vendido") return qty;
  return 0;
};
const getProductRevenue = (product) => Number(product?.soldPrice) || 0;
const getSoldUnitPrice = (product) => {
  const explicit = Number(product?.soldUnitPrice) || 0;
  if (explicit > 0) return explicit;
  const soldQty = getSoldQuantity(product);
  const total = getProductRevenue(product);
  return soldQty > 0 ? total / soldQty : 0;
};
const getAvailableQuantity = (product) => Math.max(0, getProductQuantity(product) - getSoldQuantity(product));

const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;width:100%;background:#070d16;color:#e8eef7;font-family:'JetBrains Mono',monospace;font-size:14px;overflow:hidden}
input,select,button{font-family:inherit}input,select{color-scheme:dark}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#304560;border-radius:4px}`;

const inputS = { width:"100%",background:"#111a26",border:"1px solid #304560",borderRadius:10,padding:"14px 16px",color:"#e8eef7",fontSize:15,outline:"none" };
const selectS = {
  ...inputS,
  paddingRight:44,
  appearance:"none",
  WebkitAppearance:"none",
  MozAppearance:"none",
  backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7l5 5 5-5' stroke='%23c2d1e5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat:"no-repeat",
  backgroundPosition:"right 14px center",
  backgroundSize:"16px",
  cursor:"pointer"
};
const btnP = { background:"#0d3",color:"#000",border:"none",padding:"16px 24px",borderRadius:12,fontWeight:800,fontSize:15,cursor:"pointer",width:"100%" };
const btnGoogle = { background:"#fff",color:"#111a26",border:"none",padding:"14px 24px",borderRadius:12,fontWeight:800,fontSize:14,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10 };

const AUTH_ERROR_MESSAGES = {
  "auth/email-already-in-use": "Ese email ya está registrado",
  "auth/invalid-email": "Email no válido",
  "auth/weak-password": "Mínimo 6 caracteres",
  "auth/invalid-credential": "Email o contraseña incorrectos",
  "auth/user-not-found": "No existe esa cuenta",
  "auth/wrong-password": "Contraseña incorrecta",
  "auth/popup-closed-by-user": "Has cerrado la ventana de Google",
  "auth/popup-blocked": "El navegador bloqueó la ventana emergente",
  "auth/cancelled-popup-request": "Se canceló la solicitud de acceso",
  "auth/account-exists-with-different-credential": "Ese email ya usa otro método de acceso",
  "auth/operation-not-allowed": "Google login no está activado en Firebase",
  "auth/unauthorized-domain": "Dominio no autorizado en Firebase Auth",
  "auth/network-request-failed": "Error de red. Revisa tu conexión"
};

const getAuthErrorMessage = (error) => AUTH_ERROR_MESSAGES[error?.code] || "No se pudo iniciar sesión. Inténtalo otra vez.";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function Badge({children,color="neutral"}) {
  const c = {green:{background:"#0d3",color:"#001a00"},red:{background:"#f43",color:"#fff"},yellow:{background:"#fd0",color:"#1a1400"},blue:{background:"#08f",color:"#fff"},purple:{background:"#a855f7",color:"#fff"},neutral:{background:"#304560",color:"#d5e1ef"},orange:{background:"#f90",color:"#1a0e00"}};
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",...(c[color]||c.neutral)}}>{children}</span>;
}
function AppLogo({size=40,fontSize=14}) {
  return <div style={{width:size,height:size,borderRadius:Math.round(size*0.28),background:"linear-gradient(135deg,#00e266 0%, #00b3ff 100%)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 18px rgba(0,180,255,.25)"}}>
    <span style={{fontSize,fontWeight:800,color:"#00140a",letterSpacing:-.5,lineHeight:1}}>RT</span>
  </div>;
}
function StatCard({label,value,sub,accent="#0d3"}) {
  return <div style={{background:"#111a26",border:"1px solid #1c2738",borderRadius:14,padding:"16px 18px",flex:"1 1 45%",minWidth:0}}>
    <div style={{fontSize:10,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
    <div style={{fontSize:22,fontWeight:800,color:accent}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:"#7b8fa9",marginTop:2}}>{sub}</div>}
  </div>;
}
function Modal({open,onClose,title,children}) {
  if (!open) return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#0d1420",borderTop:"1px solid #25354c",borderRadius:"20px 20px 0 0",padding:"24px 20px",paddingBottom:"calc(24px + env(safe-area-inset-bottom, 0px))",width:"100%",maxWidth:500,maxHeight:"85vh",overflowY:"auto",animation:"slideUp 0.25s ease-out"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h3 style={{fontSize:17,fontWeight:800,color:"#e8eef7"}}>{title}</h3>
        <button onClick={onClose} style={{background:"#111a26",color:"#c2d1e5",border:"1px solid #25354c",borderRadius:8,padding:"6px 10px",fontSize:13,cursor:"pointer"}} aria-label="Cerrar modal">✕</button>
      </div>
      {children}
    </div>
  </div>;
}
function Field({label,children}) {
  return <div style={{marginBottom:14,flex:1,minWidth:0}}>
    <label style={{display:"block",fontSize:11,color:"#95a8c0",marginBottom:6,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</label>
    {children}
  </div>;
}
function EmptyState({icon,msg}) { return <div style={{textAlign:"center",padding:"50px 20px",color:"#304560"}}><div style={{fontSize:44,marginBottom:12}}>{icon}</div><div style={{fontSize:13,color:"#7b8fa9"}}>{msg}</div></div>; }
function MiniBar({data,color="#0d3"}) {
  if (!data||!data.length) return null; const max=Math.max(...data.map(d=>d.value),1);
  return <div style={{display:"flex",flexDirection:"column",gap:6}}>{data.map((d,i)=>
    <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:70,fontSize:10,color:"#b0c2d8",textAlign:"right",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.label}</div>
      <div style={{flex:1,background:"#0d1420",borderRadius:4,height:22,position:"relative",overflow:"hidden"}}>
        <div style={{width:`${(d.value/max)*100}%`,background:color,height:"100%",borderRadius:4,transition:"width 0.5s ease",minWidth:d.value>0?4:0}}/>
        <span style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",fontSize:10,fontWeight:700,color:"#c2d1e5"}}>{formatCurrency(d.value)}</span>
      </div>
    </div>)}</div>;
}

function LoginScreen() {
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [name,setName]=useState("");
  const [isReg,setIsReg]=useState(false);const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  const [googleLoading,setGoogleLoading]=useState(false);
  const submit = async()=>{
    if(!email||!pass) return setError("Rellena email y contraseña");
    if(isReg&&!name) return setError("Pon tu nombre");
    setError("");setLoading(true);
    try {
      if(isReg){const cred=await createUserWithEmailAndPassword(auth,email,pass);await updateProfile(cred.user,{displayName:name});}
      else await signInWithEmailAndPassword(auth,email,pass);
    } catch(e) {
      setError(getAuthErrorMessage(e));
    } finally { setLoading(false); }
  };
  const submitGoogle = async()=>{
    setError("");setGoogleLoading(true);
    let redirectStarted=false;
    try {
      await signInWithPopup(auth,googleProvider);
    } catch(e) {
      const shouldUseRedirect=["auth/popup-blocked","auth/operation-not-supported-in-this-environment"].includes(e.code);
      if(shouldUseRedirect){
        try {
          redirectStarted=true;
          await signInWithRedirect(auth,googleProvider);
          return;
        } catch(redirectError) {
          redirectStarted=false;
          setError(getAuthErrorMessage(redirectError));
        }
      } else {
        setError(getAuthErrorMessage(e));
      }
    } finally {
      if(!redirectStarted) setGoogleLoading(false);
    }
  };
  return <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <style>{globalCSS}</style>
    <div style={{marginBottom:16}}><AppLogo size={56} fontSize={20}/></div>
    <h1 style={{fontSize:20,fontWeight:800,marginBottom:4}}>RESALE TRACKER</h1>
    <p style={{fontSize:11,color:"#95a8c0",marginBottom:32}}>{isReg?"Crea tu cuenta":"Inicia sesión"}</p>
    <div style={{width:"100%",maxWidth:340}}>
      {isReg&&<Field label="Tu nombre"><input placeholder="Ej: Juan" value={name} onChange={e=>setName(e.target.value)} style={inputS}/></Field>}
      <Field label="Email"><input type="email" placeholder="tu@email.com" value={email} onChange={e=>setEmail(e.target.value)} style={inputS} autoCapitalize="none"/></Field>
      <Field label="Contraseña"><input type="password" placeholder="Mínimo 6 caracteres" value={pass} onChange={e=>setPass(e.target.value)} style={inputS} onKeyDown={e=>e.key==="Enter"&&submit()}/></Field>
      {error&&<div style={{background:"#1a0808",border:"1px solid #3a1515",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#f43",marginBottom:14}}>{error}</div>}
      <button onClick={submit} disabled={loading||googleLoading} style={{...btnP,opacity:(loading||googleLoading)?.5:1,marginBottom:10}}>{loading?"...":isReg?"Crear cuenta":"Entrar"}</button>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <div style={{flex:1,height:1,background:"#2a3d58"}}/>
        <span style={{fontSize:10,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1}}>o</span>
        <div style={{flex:1,height:1,background:"#2a3d58"}}/>
      </div>
      <button onClick={submitGoogle} disabled={loading||googleLoading} style={{...btnGoogle,opacity:(loading||googleLoading)?.5:1,marginBottom:8}}>
        <span style={{fontSize:16,lineHeight:1}}>G</span>
        <span>{googleLoading?"Conectando...":"Continuar con Google"}</span>
      </button>
      <button onClick={()=>{setIsReg(!isReg);setError("");}} style={{background:"transparent",border:"none",color:"#95a8c0",fontSize:12,cursor:"pointer",width:"100%",padding:10}}>{isReg?"Ya tengo cuenta → Iniciar sesión":"No tengo cuenta → Registrarme"}</button>
    </div>
  </div>;
}

function Tracker({user}) {
  const [packages,setPackages]=useState([]);const [products,setProducts]=useState([]);
  const [tab,setTab]=useState("dashboard");const [showAddPkg,setShowAddPkg]=useState(false);
  const [showAddProd,setShowAddProd]=useState(false);const [showSell,setShowSell]=useState(null);
  const [showPkgDetails,setShowPkgDetails]=useState(null);const [editProduct,setEditProduct]=useState(null);const [editPackage,setEditPackage]=useState(null);
  const [productSearch,setProductSearch]=useState("");const [loading,setLoading]=useState(true);
  const [selectionMode,setSelectionMode]=useState(false);const [selectedProductIds,setSelectedProductIds]=useState(new Set());
  const [pkgSelectionMode,setPkgSelectionMode]=useState(false);const [selectedPackageIds,setSelectedPackageIds]=useState(new Set());

  const [pkgDate,setPkgDate]=useState(new Date().toISOString().split("T")[0]);
  const [pkgCost,setPkgCost]=useState("");const [pkgQty,setPkgQty]=useState("1");const [pkgNotes,setPkgNotes]=useState("");
  const [prodName,setProdName]=useState("");const [prodCat,setProdCat]=useState("Otro");
  const [prodPkgId,setProdPkgId]=useState("");const [prodCond,setProdCond]=useState("Bueno");
  const [prodQty,setProdQty]=useState("1");const [prodEst,setProdEst]=useState("");const [prodNotes,setProdNotes]=useState("");

  const [sellPrice,setSellPrice]=useState("");const [sellQty,setSellQty]=useState("1");
  const [sellPlat,setSellPlat]=useState("Wallapop");const [sellDate,setSellDate]=useState(new Date().toISOString().split("T")[0]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"packages"),s=>{setPackages(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(collection(db,"products"),s=>{setProducts(s.docs.map(d=>({id:d.id,...d.data()})));});
    return()=>{u1();u2();};
  },[]);
  useEffect(()=>{
    if(tab!=="products"&&selectionMode){setSelectionMode(false);setSelectedProductIds(new Set());}
  },[tab,selectionMode]);
  useEffect(()=>{
    if(tab!=="packages"&&pkgSelectionMode){setPkgSelectionMode(false);setSelectedPackageIds(new Set());}
  },[tab,pkgSelectionMode]);
  useEffect(()=>{
    if(selectedProductIds.size===0)return;
    const validIds=new Set(products.map(p=>p.id));
    setSelectedProductIds(prev=>{
      let changed=false;
      const next=new Set();
      prev.forEach(id=>{
        if(validIds.has(id))next.add(id);
        else changed=true;
      });
      return changed?next:prev;
    });
  },[products,selectedProductIds.size]);
  useEffect(()=>{
    if(selectedPackageIds.size===0)return;
    const validIds=new Set(packages.map(p=>p.id));
    setSelectedPackageIds(prev=>{
      let changed=false;
      const next=new Set();
      prev.forEach(id=>{
        if(validIds.has(id))next.add(id);
        else changed=true;
      });
      return changed?next:prev;
    });
  },[packages,selectedPackageIds.size]);

  const getPkg=(id)=>packages.find(p=>p.id===id);
  const sortedPackages=useMemo(()=>[...packages].sort((a,b)=>b.date.localeCompare(a.date)),[packages]);
  const currentSellProduct=useMemo(()=>products.find(p=>p.id===showSell)||null,[products,showSell]);
  const sellAvailableQty=currentSellProduct?getAvailableQuantity(currentSellProduct):0;
  const sellQtyNum=Math.max(1,parseInt(sellQty,10)||1);
  const sellUnitPriceNum=Math.max(0,parseFloat(sellPrice)||0);
  const sellPreviewTotal=sellQtyNum*sellUnitPriceNum;
  const selectedPackage=useMemo(()=>packages.find(p=>p.id===showPkgDetails)||null,[packages,showPkgDetails]);
  const selectedPackageProducts=useMemo(()=>{
    if(!showPkgDetails)return[];
    return products.filter(p=>p.packageId===showPkgDetails).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },[products,showPkgDetails]);

  const stats=useMemo(()=>{
    const totalCost=packages.reduce((s,p)=>s+p.cost,0);
    const totalRev=products.reduce((s,p)=>s+getProductRevenue(p),0);
    const soldUnits=products.reduce((s,p)=>s+getSoldQuantity(p),0);
    const totalUnits=products.reduce((s,p)=>s+getProductQuantity(p),0);
    const availableUnits=products.reduce((s,p)=>s+getAvailableQuantity(p),0);
    const pendingCount=products
      .filter(p=>!["Vendido","Descartado","Me lo quedo"].includes(p.status))
      .reduce((s,p)=>s+getAvailableQuantity(p),0);
    const profit=totalRev-totalCost;
    const sellThroughRate=totalUnits>0?(soldUnits/totalUnits)*100:0;
    const marginRate=totalRev>0?(profit/totalRev)*100:0;
    const recoveryRate=totalCost>0?(totalRev/totalCost)*100:0;
    const mar=packages.filter(p=>dayOfWeek(p.date)===2);const mie=packages.filter(p=>dayOfWeek(p.date)===3);
    const marIds=new Set(mar.map(p=>p.id));const mieIds=new Set(mie.map(p=>p.id));
    const marRev=products.filter(p=>marIds.has(p.packageId)).reduce((s,p)=>s+getProductRevenue(p),0);
    const marCost=mar.reduce((s,p)=>s+p.cost,0);
    const mieRev=products.filter(p=>mieIds.has(p.packageId)).reduce((s,p)=>s+getProductRevenue(p),0);
    const mieCost=mie.reduce((s,p)=>s+p.cost,0);
    const activeProductsList=products.filter(p=>getAvailableQuantity(p)>0&&!["Descartado","Me lo quedo"].includes(p.status));
    const activeProducts=activeProductsList.length;
    const activeCapital=activeProductsList.reduce((s,p)=>s+getCostPerProduct(p,packages,products),0);
    const byCat={};products.forEach(p=>{const rev=getProductRevenue(p);if(rev<=0)return;if(!byCat[p.category])byCat[p.category]={revenue:0};byCat[p.category].revenue+=rev;});
    const catData=Object.entries(byCat).map(([l,v])=>({label:l,value:v.revenue})).sort((a,b)=>b.value-a.value);
    const byPlat={};products.forEach(p=>{const rev=getProductRevenue(p);if(rev<=0)return;const pl=p.soldPlatform||"Otro";if(!byPlat[pl])byPlat[pl]={revenue:0};byPlat[pl].revenue+=rev;});
    const platData=Object.entries(byPlat).map(([l,v])=>({label:l,value:v.revenue})).sort((a,b)=>b.value-a.value);
    const now=new Date();
    const currentMonthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const currentYearKey=String(now.getFullYear());
    const soldProducts=products.filter(p=>p.status==="Vendido"&&getProductRevenue(p)>0);
    const soldProductsCount=soldProducts.length;
    const avgUnitRevenue=soldUnits>0?totalRev/soldUnits:0;
    const avgProductRevenue=soldProductsCount>0?totalRev/soldProductsCount:0;
    const estimatedOpenRevenue=activeProductsList.reduce((s,p)=>{
      const est=Number(p.estPrice)||0;
      if(est<=0)return s;
      return s+(est*getAvailableQuantity(p));
    },0);
    const estimatedOpenProfit=estimatedOpenRevenue-activeCapital;
    const monthSales=soldProducts.filter(p=>getMonthKey(p.soldDate||p.createdAt)===currentMonthKey);
    const yearSales=soldProducts.filter(p=>getYearKey(p.soldDate||p.createdAt)===currentYearKey);
    const monthRevenue=monthSales.reduce((s,p)=>s+getProductRevenue(p),0);
    const yearRevenue=yearSales.reduce((s,p)=>s+getProductRevenue(p),0);
    const monthSoldUnits=monthSales.reduce((s,p)=>s+getSoldQuantity(p),0);
    const yearSoldUnits=yearSales.reduce((s,p)=>s+getSoldQuantity(p),0);
    const monthCost=packages.filter(p=>getMonthKey(p.date)===currentMonthKey).reduce((s,p)=>s+p.cost,0);
    const yearCost=packages.filter(p=>getYearKey(p.date)===currentYearKey).reduce((s,p)=>s+p.cost,0);
    const monthProfit=monthRevenue-monthCost;
    const yearProfit=yearRevenue-yearCost;
    const monthMap={};
    const yearMap={};
    packages.forEach(pkg=>{
      const monthKey=getMonthKey(pkg.date);const yearKey=getYearKey(pkg.date);
      if(monthKey){if(!monthMap[monthKey])monthMap[monthKey]={cost:0,revenue:0};monthMap[monthKey].cost+=Number(pkg.cost)||0;}
      if(yearKey){if(!yearMap[yearKey])yearMap[yearKey]={cost:0,revenue:0};yearMap[yearKey].cost+=Number(pkg.cost)||0;}
    });
    soldProducts.forEach(prod=>{
      const sourceDate=prod.soldDate||prod.createdAt;
      const monthKey=getMonthKey(sourceDate);const yearKey=getYearKey(sourceDate);const rev=getProductRevenue(prod);
      if(monthKey){if(!monthMap[monthKey])monthMap[monthKey]={cost:0,revenue:0};monthMap[monthKey].revenue+=rev;}
      if(yearKey){if(!yearMap[yearKey])yearMap[yearKey]={cost:0,revenue:0};yearMap[yearKey].revenue+=rev;}
    });
    const monthBreakdown=Object.entries(monthMap)
      .map(([key,val])=>({key,label:formatMonthKey(key),cost:val.cost,revenue:val.revenue,profit:val.revenue-val.cost}))
      .sort((a,b)=>a.key.localeCompare(b.key));
    const yearBreakdown=Object.entries(yearMap)
      .map(([key,val])=>({key,label:key,cost:val.cost,revenue:val.revenue,profit:val.revenue-val.cost}))
      .sort((a,b)=>a.key.localeCompare(b.key));
    return{totalCost,totalRev,profit,roi:totalCost>0?((profit/totalCost)*100).toFixed(0):0,
      totalPkgs:packages.length,soldCount:soldUnits,pendingCount,totalUnits,availableUnits,
      sellThroughRate,marginRate,recoveryRate,activeProducts,activeCapital,soldProductsCount,
      avgUnitRevenue,avgProductRevenue,estimatedOpenRevenue,estimatedOpenProfit,
      avgPerPkg:packages.length?totalRev/packages.length:0,
      martes:{cost:marCost,revenue:marRev,profit:marRev-marCost,count:mar.length},
      miercoles:{cost:mieCost,revenue:mieRev,profit:mieRev-mieCost,count:mie.length},
      month:{cost:monthCost,revenue:monthRevenue,profit:monthProfit,soldUnits:monthSoldUnits},
      year:{cost:yearCost,revenue:yearRevenue,profit:yearProfit,soldUnits:yearSoldUnits},
      monthLabel:now.toLocaleDateString("es-ES",{month:"long"}),
      yearLabel:currentYearKey,
      monthBreakdown,
      yearBreakdown,
      catData,platData};
  },[packages,products]);

  const staleProds=useMemo(()=>products.map(p=>({...p,alert:getAlertLevel(p)})).filter(p=>p.alert&&getAvailableQuantity(p)>0).sort((a,b)=>b.alert.days-a.alert.days),[products]);
  const filteredProducts=useMemo(()=>{
    const q=productSearch.trim().toLowerCase();
    let l=[...products];
    if(q)l=l.filter(p=>[p.name,p.category,p.notes,p.condition].some(v=>(v||"").toLowerCase().includes(q)));
    return l.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },[products,productSearch]);
  const productsForSale=useMemo(()=>filteredProducts.filter(p=>p.status!=="Vendido"),[filteredProducts]);
  const productsSold=useMemo(()=>filteredProducts.filter(p=>p.status==="Vendido"),[filteredProducts]);

  const openSellModal=(productId)=>{
    const p=products.find(x=>x.id===productId);if(!p)return;
    const avail=getAvailableQuantity(p);if(avail<=0)return;
    setSellPrice("");setSellQty("1");setSellPlat(p.soldPlatform||"Wallapop");
    setSellDate(new Date().toISOString().split("T")[0]);setShowSell(productId);
  };

  const openEditProduct=(p)=>{
    setEditProduct({
      id:p.id,name:p.name||"",category:p.category||"Otro",packageId:p.packageId||"",
      condition:p.condition||"Bueno",quantity:String(getProductQuantity(p)),estPrice:p.estPrice?String(p.estPrice):"",
      notes:p.notes||"",status:p.status||"Pendiente",soldQuantity:String(getSoldQuantity(p)),
      soldPrice:getProductRevenue(p)?String(getProductRevenue(p)):"",
      soldUnitPrice:getSoldUnitPrice(p)?String(getSoldUnitPrice(p)):"",
      soldPlatform:p.soldPlatform||"Wallapop",
      soldDate:p.soldDate||new Date().toISOString().split("T")[0]
    });
  };
  const openEditPackage=(pkg)=>{
    setEditPackage({
      id:pkg.id,
      date:pkg.date||new Date().toISOString().split("T")[0],
      cost:pkg.cost?String(pkg.cost):"",
      notes:pkg.notes||""
    });
  };

  const addPkg=async()=>{
    if(!pkgDate)return;
    const qty=Math.max(1,Math.min(200,parseInt(pkgQty,10)||1));
    const cost=pkgCost?parseFloat(pkgCost):dayOfWeek(pkgDate)===3?3:6;
    if(!cost||cost<=0)return;
    const batch=writeBatch(db);
    const baseTime=Date.now();
    const addedBy=user.displayName||user.email;
    for(let i=0;i<qty;i++){
      const id=generateId();
      const pkg={id,date:pkgDate,cost,notes:pkgNotes,addedBy,addedAt:new Date(baseTime+i).toISOString()};
      batch.set(doc(db,"packages",id),pkg);
    }
    await batch.commit();
    setPkgDate(new Date().toISOString().split("T")[0]);setPkgCost("");setPkgQty("1");setPkgNotes("");setShowAddPkg(false);
  };

  const addProd=async()=>{
    if(!prodName||!prodPkgId)return;
    const quantity=Math.max(1,parseInt(prodQty,10)||1);
    const p={id:generateId(),name:prodName.trim(),category:prodCat,packageId:prodPkgId,condition:prodCond,quantity,
      estPrice:prodEst?parseFloat(prodEst):0,status:"Pendiente",notes:prodNotes,createdAt:new Date().toISOString(),
      soldQuantity:0,soldPrice:0,soldPlatform:null,soldDate:null,addedBy:user.displayName||user.email,sales:[]};
    await setDoc(doc(db,"products",p.id),p);
    setProdName("");setProdCat("Otro");setProdCond("Bueno");setProdQty("1");setProdEst("");setProdNotes("");setShowAddProd(false);
  };

  const saveEditedProduct=async()=>{
    if(!editProduct||!editProduct.name||!editProduct.packageId)return;
    const quantity=Math.max(1,parseInt(editProduct.quantity,10)||1);
    const status=editProduct.status;
    const baseData={
      name:editProduct.name.trim(),category:editProduct.category,packageId:editProduct.packageId,condition:editProduct.condition,
      quantity,estPrice:editProduct.estPrice?parseFloat(editProduct.estPrice):0,notes:editProduct.notes,status,updatedAt:new Date().toISOString()
    };
    if(status==="Vendido"){
      const soldQuantity=quantity;
      const soldUnitPrice=Math.max(0,parseFloat(editProduct.soldUnitPrice)||0);
      const soldPrice=soldUnitPrice>0?(soldUnitPrice*soldQuantity):Math.max(0,parseFloat(editProduct.soldPrice)||0);
      await updateDoc(doc(db,"products",editProduct.id),{
        ...baseData,
        soldQuantity,
        soldPrice,
        soldUnitPrice:soldQuantity>0?((soldUnitPrice>0?soldUnitPrice:(soldPrice/soldQuantity))):null,
        soldPlatform:editProduct.soldPlatform||null,
        soldDate:editProduct.soldDate||null,
        soldBy:user.displayName||user.email
      });
    } else {
      await updateDoc(doc(db,"products",editProduct.id),{
        ...baseData,
        soldQuantity:0,
        soldPrice:0,
        soldUnitPrice:null,
        soldPlatform:null,
        soldDate:null,
        soldBy:null
      });
    }
    setEditProduct(null);
  };
  const saveEditedPackage=async()=>{
    if(!editPackage||!editPackage.date)return;
    const cost=Math.max(0,parseFloat(editPackage.cost)||0);
    if(cost<=0)return;
    await updateDoc(doc(db,"packages",editPackage.id),{
      date:editPackage.date,
      cost,
      notes:editPackage.notes||"",
      updatedAt:new Date().toISOString(),
      updatedBy:user.displayName||user.email
    });
    setEditPackage(null);
  };

  const deletePackagesWithProducts=async(packageIds)=>{
    if(!packageIds||packageIds.length===0)return;
    let batch=writeBatch(db);let ops=0;
    const commitIfNeeded=async(force=false)=>{
      if(ops===0)return;
      if(force||ops>=400){await batch.commit();batch=writeBatch(db);ops=0;}
    };
    for(const packageId of packageIds){
      batch.delete(doc(db,"packages",packageId));ops+=1;
      await commitIfNeeded();
      const relatedProducts=products.filter(p=>p.packageId===packageId);
      for(const product of relatedProducts){
        batch.delete(doc(db,"products",product.id));ops+=1;
        await commitIfNeeded();
      }
      if(showPkgDetails===packageId)setShowPkgDetails(null);
    }
    await commitIfNeeded(true);
  };

  const sell=async()=>{
    if(!currentSellProduct||!sellPrice)return;
    const available=getAvailableQuantity(currentSellProduct);if(available<=0)return;
    const qty=Math.min(available,Math.max(1,parseInt(sellQty,10)||1));
    const unitPrice=parseFloat(sellPrice);if(!unitPrice||unitPrice<=0)return;
    const saleTotal=unitPrice*qty;
    const nowISO=new Date().toISOString();
    const soldId=generateId();
    const soldProduct={
      id:soldId,
      name:currentSellProduct.name,
      category:currentSellProduct.category,
      packageId:currentSellProduct.packageId,
      condition:currentSellProduct.condition,
      quantity:qty,
      estPrice:Number(currentSellProduct.estPrice)||0,
      status:"Vendido",
      notes:currentSellProduct.notes||"",
      createdAt:nowISO,
      soldQuantity:qty,
      soldPrice:saleTotal,
      soldUnitPrice:unitPrice,
      soldPlatform:sellPlat,
      soldDate:sellDate,
      soldBy:user.displayName||user.email,
      addedBy:currentSellProduct.addedBy||user.displayName||user.email,
      sourceProductId:currentSellProduct.id
    };

    const remaining=available-qty;
    const batch=writeBatch(db);
    batch.set(doc(db,"products",soldId),soldProduct);
    if(remaining<=0){
      batch.delete(doc(db,"products",currentSellProduct.id));
    }else{
      batch.update(doc(db,"products",currentSellProduct.id),{
        quantity:remaining,
        soldQuantity:0,
        soldPrice:0,
        soldUnitPrice:null,
        soldPlatform:null,
        soldDate:null,
        soldBy:null,
        sales:[],
        status:"En venta",
        updatedAt:nowISO
      });
    }
    await batch.commit();
    setSellPrice("");setSellQty("1");setSellPlat("Wallapop");setSellDate(new Date().toISOString().split("T")[0]);setShowSell(null);
  };
  const toggleProductSelection=(id)=>{
    setSelectedProductIds(prev=>{
      const next=new Set(prev);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  };
  const clearBatchSelection=()=>{setSelectedProductIds(new Set());setSelectionMode(false);};
  const deleteSelectedProducts=async()=>{
    if(selectedProductIds.size===0)return;
    if(!confirm(`¿Eliminar ${selectedProductIds.size} producto(s)?`))return;
    const ids=[...selectedProductIds];
    for(let i=0;i<ids.length;i+=400){
      const batch=writeBatch(db);
      ids.slice(i,i+400).forEach(id=>batch.delete(doc(db,"products",id)));
      await batch.commit();
    }
    clearBatchSelection();
  };
  const togglePackageSelection=(id)=>{
    setSelectedPackageIds(prev=>{
      const next=new Set(prev);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  };
  const clearPackageBatchSelection=()=>{setSelectedPackageIds(new Set());setPkgSelectionMode(false);};
  const deleteSelectedPackages=async()=>{
    if(selectedPackageIds.size===0)return;
    if(!confirm(`¿Eliminar ${selectedPackageIds.size} paquete(s) y todos sus productos?`))return;
    await deletePackagesWithProducts([...selectedPackageIds]);
    clearPackageBatchSelection();
  };

  const delPkg=async(id)=>{await deletePackagesWithProducts([id]);};
  const delProd=async(id)=>{await deleteDoc(doc(db,"products",id));};
  const sugCost=useMemo(()=>{if(pkgCost)return null;const d=dayOfWeek(pkgDate);return d===2?6:d===3?3:null;},[pkgDate,pkgCost]);
  const pkgQtyNum=Math.max(1,Math.min(200,parseInt(pkgQty,10)||1));
  const pkgUnitCost=pkgCost?(parseFloat(pkgCost)||0):(dayOfWeek(pkgDate)===3?3:6);
  const pkgTotalEstimate=pkgUnitCost*pkgQtyNum;
  const tabList=[{id:"dashboard",icon:"📊",label:"Inicio"},{id:"packages",icon:"📦",label:"Paquetes"},{id:"products",icon:"🏷",label:"Productos"}];
  const editIsSold=!!editProduct&&editProduct.status==="Vendido";
  const editQtyNum=editProduct?Math.max(1,parseInt(editProduct.quantity,10)||1):0;
  const editSoldUnitNum=editProduct?Math.max(0,parseFloat(editProduct.soldUnitPrice)||0):0;
  const editSoldTotalPreview=editQtyNum*editSoldUnitNum;

  const renderProductCard=(p)=>{
    const pkg=getPkg(p.packageId);const al=getAlertLevel(p);const qty=getProductQuantity(p);
    const soldQty=getSoldQuantity(p);const availQty=getAvailableQuantity(p);const revenue=getProductRevenue(p);
    const isSelected=selectedProductIds.has(p.id);
    const cardBackground=isSelected?"#112417":(al?al.bg:"#111a26");
    const cardBorder=isSelected?"#0d3":(al?al.border:"#1c2738");
    const sc={Pendiente:"yellow","En venta":"blue",Vendido:"green",Descartado:"red","Me lo quedo":"purple"};
    return <div
      key={p.id}
      onClick={selectionMode?()=>toggleProductSelection(p.id):undefined}
      style={{
        background:cardBackground,border:"1px solid "+cardBorder,borderRadius:14,padding:"14px 16px",
        cursor:selectionMode?"pointer":"default",
        boxShadow:isSelected?"0 0 0 1px rgba(0,221,51,.4) inset":"none",
        transition:"background .15s ease, border-color .15s ease, box-shadow .15s ease"
      }}
    >
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
          <div style={{fontSize:10,color:"#95a8c0",marginTop:2}}>
            {p.category} · {soldQty}/{qty} uds
            {pkg&&<span> · {formatDate(pkg.date)}</span>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {selectionMode&&<span style={{fontSize:11,color:isSelected?"#0d3":"#7b8fa9",fontWeight:700}}>{isSelected?"✓":"○"}</span>}
          <Badge color={sc[p.status]||"neutral"}>{p.status}</Badge>
        </div>
      </div>
      {al&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
        <span style={{width:7,height:7,borderRadius:"50%",background:al.color,display:"inline-block",animation:al.level==="critical"?"pulse 1.5s infinite":"none"}}/>
        <span style={{fontSize:10,color:al.color,fontWeight:700}}>{al.daysSince}d · {al.message}</span>
      </div>}
      {revenue>0&&<div style={{fontSize:12,fontWeight:800,color:"#0d3",marginBottom:6}}>
        Ingresos: {formatCurrency(revenue)}
        {getSoldQuantity(p)>0&&<span style={{fontSize:10,color:"#95a8c0",fontWeight:500}}> · {formatCurrency(getSoldUnitPrice(p))}/ud</span>}
        {p.soldPlatform&&<span style={{fontSize:10,color:"#95a8c0",fontWeight:500}}> · {p.soldPlatform}</span>}
      </div>}
      {p.estPrice>0&&availQty>0&&<div style={{fontSize:10,color:"#95a8c0",marginBottom:6}}>Objetivo: {formatCurrency(p.estPrice)}/ud · quedan {availQty} uds</div>}
      <div style={{display:"flex",gap:6}}>
        {selectionMode?
          <button onClick={e=>{e.stopPropagation();toggleProductSelection(p.id);}} style={{flex:1,background:isSelected?"#0d3":"#1c2738",color:isSelected?"#001a00":"#c2d1e5",border:"none",padding:10,borderRadius:8,fontWeight:800,fontSize:12,cursor:"pointer"}}>
            {isSelected?"Seleccionado":"Seleccionar"}
          </button>:
          <>
            {availQty>0&&p.status!=="Descartado"&&p.status!=="Me lo quedo"&&<button onClick={e=>{e.stopPropagation();openSellModal(p.id);}} style={{flex:1,background:"#0d3",color:"#000",border:"none",padding:10,borderRadius:8,fontWeight:800,fontSize:12,cursor:"pointer"}}>💰 Vender</button>}
            <button onClick={e=>{e.stopPropagation();openEditProduct(p);}} style={{background:"#1c2738",border:"none",color:"#08f",padding:"10px 12px",borderRadius:8,fontSize:13,cursor:"pointer"}} title="Editar">✏️</button>
            <button onClick={e=>{e.stopPropagation();if(confirm("¿Eliminar?"))delProd(p.id);}} style={{background:"#1c2738",border:"none",color:"#f43",padding:"10px 12px",borderRadius:8,fontSize:12,cursor:"pointer"}}>🗑</button>
          </>
        }
      </div>
    </div>;
  };

  if(loading)return<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><AppLogo size={48} fontSize={16}/><div style={{color:"#95a8c0",fontSize:13,marginTop:12}}>Cargando...</div></div></div>;

  return <div style={{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Header */}
    <div style={{padding:"12px 16px",paddingTop:"calc(12px + env(safe-area-inset-top, 0px))",borderBottom:"1px solid #111a26",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <AppLogo size={32} fontSize={11}/>
        <div><div style={{fontWeight:800,fontSize:14,letterSpacing:-.5}}>RESALE TRACKER</div><div style={{fontSize:9,color:"#7b8fa9"}}>{user.displayName||user.email}</div></div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {tab==="packages"&&<button onClick={()=>setShowAddPkg(true)} style={{background:"#0d3",color:"#000",border:"none",padding:"10px 16px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>+ Paquete</button>}
        {tab==="products"&&packages.length>0&&<button onClick={()=>{setProdPkgId(sortedPackages[0]?.id||"");setShowAddProd(true);}} style={{background:"#0d3",color:"#000",border:"none",padding:"10px 16px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>+ Producto</button>}
        <button onClick={()=>signOut(auth)} style={{background:"#111a26",border:"none",color:"#95a8c0",padding:"10px",borderRadius:10,cursor:"pointer",fontSize:14}} title="Salir">🚪</button>
      </div>
    </div>

    {/* Content */}
    <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:16,paddingBottom:"calc(96px + env(safe-area-inset-bottom, 0px))"}}>

      {tab==="dashboard"&&<div style={{animation:"fadeIn .2s ease",display:"flex",flexDirection:"column",gap:12}}>
        {packages.length===0&&<div style={{textAlign:"center",padding:"30px 20px",marginTop:16}}>
          <div style={{fontSize:13,color:"#7b8fa9",marginBottom:14}}>¡Registra tu primer paquete!</div>
          <button onClick={()=>{setTab("packages");setTimeout(()=>setShowAddPkg(true),100);}} style={{...btnP,width:"auto",padding:"14px 28px"}}>+ Añadir Paquete</button>
        </div>}

        {packages.length>0&&<>
          <div style={{background:"#111a26",border:"1px solid #1c2738",borderRadius:14,padding:14}}>
            <div style={{fontSize:11,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📌 Resumen General</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              <StatCard label="Beneficio neto" value={formatCurrency(stats.profit)} sub={`${formatCurrency(stats.totalRev)} facturado · ${formatCurrency(stats.totalCost)} invertido`} accent={stats.profit>=0?"#0d3":"#f43"}/>
              <StatCard label="ROI y margen" value={`${stats.roi}%`} sub={`${stats.marginRate.toFixed(0)}% margen · ${stats.recoveryRate.toFixed(0)}% recuperado`} accent={stats.profit>=0?"#0d3":"#f43"}/>
              <StatCard label="Capital activo" value={formatCurrency(stats.activeCapital)} sub={`${stats.activeProducts} productos activos · ${stats.availableUnits} uds`} accent="#f90"/>
              <StatCard label="Rotación" value={`${stats.sellThroughRate.toFixed(0)}%`} sub={`${stats.soldCount}/${stats.totalUnits} uds vendidas`} accent="#08f"/>
            </div>
          </div>

          <div style={{background:"#111a26",border:"1px solid #1c2738",borderRadius:14,padding:14}}>
            <div style={{fontSize:11,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📅 Periodo Actual</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
              <StatCard
                label={`Mes (${stats.monthLabel})`}
                value={formatCurrency(stats.month.profit)}
                sub={`${formatCurrency(stats.month.revenue)} / ${formatCurrency(stats.month.cost)} · ${stats.month.soldUnits} uds`}
                accent={stats.month.profit>=0?"#0d3":"#f43"}
              />
              <StatCard
                label={`Año (${stats.yearLabel})`}
                value={formatCurrency(stats.year.profit)}
                sub={`${formatCurrency(stats.year.revenue)} / ${formatCurrency(stats.year.cost)} · ${stats.year.soldUnits} uds`}
                accent={stats.year.profit>=0?"#0d3":"#f43"}
              />
            </div>
            {stats.monthBreakdown.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
              {stats.monthBreakdown.slice(-6).reverse().map(row=><div key={row.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:"#0d1420",borderRadius:8,padding:"9px 10px"}}>
                <div style={{fontSize:11,color:"#c2d1e5"}}>{row.label}</div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12,fontWeight:800,color:row.profit>=0?"#0d3":"#f43"}}>{formatCurrency(row.profit)}</div>
                  <div style={{fontSize:9,color:"#7b8fa9"}}>{formatCurrency(row.revenue)} / {formatCurrency(row.cost)}</div>
                </div>
              </div>)}
            </div>}
          </div>

          <div style={{background:"#111a26",border:"1px solid #1c2738",borderRadius:14,padding:14}}>
            <div style={{fontSize:11,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📦 Inventario y Riesgo</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
              <StatCard label="Pendientes" value={stats.pendingCount} sub="unidades por vender" accent="#a855f7"/>
              <StatCard label="Ticket medio / ud" value={formatCurrency(stats.avgUnitRevenue)} sub={`${stats.soldCount} uds vendidas`} accent="#08f"/>
              <StatCard label="Ticket medio / venta" value={formatCurrency(stats.avgProductRevenue)} sub={`${stats.soldProductsCount} productos vendidos`} accent="#0d3"/>
              <StatCard label="Potencial stock" value={formatCurrency(stats.estimatedOpenRevenue)} sub={stats.estimatedOpenRevenue>0?`Estimado: ${(stats.estimatedOpenProfit>=0?"+":"")+formatCurrency(stats.estimatedOpenProfit)}`:"Añade precios objetivo para ver potencial"} accent={stats.estimatedOpenProfit>=0?"#0d3":"#f90"}/>
            </div>
            {staleProds.length===0?<div style={{fontSize:11,color:"#7b8fa9",padding:"6px 2px"}}>Sin productos estancados ahora mismo.</div>:
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:10,color:"#95a8c0",marginBottom:2}}>
                {staleProds.filter(p=>p.alert.level==="critical").length>0&&<span style={{color:"#f43"}}>🚨 {staleProds.filter(p=>p.alert.level==="critical").length} crítico(s) </span>}
                {staleProds.filter(p=>p.alert.level==="urgent").length>0&&<span style={{color:"#f90"}}>🔥 {staleProds.filter(p=>p.alert.level==="urgent").length} urgente(s) </span>}
                {staleProds.filter(p=>p.alert.level==="warning").length>0&&<span style={{color:"#fd0"}}>⚠️ {staleProds.filter(p=>p.alert.level==="warning").length} aviso(s)</span>}
              </div>
              {staleProds.slice(0,4).map(p=>{const c=getCostPerProduct(p,packages,products);return<div key={p.id} style={{background:p.alert.bg,border:"1px solid "+p.alert.border,borderRadius:10,padding:"11px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.alert.icon} {p.name}</div>
                    <div style={{fontSize:10,color:"#b0c2d8",marginTop:3}}>{p.alert.daysSince}d · {p.alert.message}</div>
                    <div style={{fontSize:10,color:"#95a8c0",marginTop:2}}>Coste estimado: {formatCurrency(c)}</div>
                  </div>
                  <button onClick={()=>openSellModal(p.id)} style={{background:p.alert.color,color:"#000",border:"none",padding:"8px 10px",borderRadius:8,fontWeight:800,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>💰 Vender</button>
                </div>
              </div>;})}
              {staleProds.length>4&&<button onClick={()=>setTab("products")} style={{background:"#1c2738",border:"none",color:"#c2d1e5",padding:10,borderRadius:8,fontSize:11,cursor:"pointer"}}>Ver {staleProds.length-4} más →</button>}
            </div>}
          </div>

          <div style={{background:"#111a26",border:"1px solid #1c2738",borderRadius:14,padding:14}}>
            <div style={{fontSize:11,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📈 Canales y Eficiencia</div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              {[{l:"MAR (6€)",d:stats.martes},{l:"MIÉ (3€)",d:stats.miercoles}].map(x=><div key={x.l} style={{flex:1,background:"#0d1420",borderRadius:10,padding:12}}>
                <div style={{fontSize:10,color:"#b0c2d8",marginBottom:2}}>{x.l}</div>
                <div style={{fontSize:10,color:"#7b8fa9"}}>{x.d.count} paquetes</div>
                <div style={{fontSize:19,fontWeight:800,color:x.d.profit>=0?"#0d3":"#f43",marginTop:6}}>{formatCurrency(x.d.profit)}</div>
                <div style={{fontSize:9,color:"#7b8fa9"}}>{x.d.count>0?formatCurrency(x.d.profit/x.d.count)+"/paq":"—"}</div>
              </div>)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {stats.catData.length>0&&<div>
                <div style={{fontSize:10,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Top categorías</div>
                <MiniBar data={stats.catData.slice(0,5)} color="#08f"/>
              </div>}
              {stats.platData.length>0&&<div>
                <div style={{fontSize:10,color:"#95a8c0",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Ingresos por plataforma</div>
                <MiniBar data={stats.platData} color="#a855f7"/>
              </div>}
            </div>
          </div>
        </>}
      </div>}

      {tab==="packages"&&<div style={{animation:"fadeIn .2s ease"}}>
        {packages.length===0?<EmptyState icon="📦" msg="No hay paquetes registrados"/>:
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginBottom:4}}>
            <button
              onClick={()=>pkgSelectionMode?clearPackageBatchSelection():setPkgSelectionMode(true)}
              style={{background:pkgSelectionMode?"#f43":"#1c2738",border:"none",color:pkgSelectionMode?"#fff":"#c2d1e5",padding:"10px 12px",borderRadius:8,fontWeight:700,fontSize:11,cursor:"pointer"}}
            >
              {pkgSelectionMode?"Cancelar selección":"Seleccionar en lote"}
            </button>
            {pkgSelectionMode&&selectedPackageIds.size>0&&<button
              onClick={deleteSelectedPackages}
              style={{background:"#f43",border:"none",color:"#fff",padding:"10px 12px",borderRadius:8,fontWeight:800,fontSize:11,cursor:"pointer"}}
            >
              🗑 Borrar ({selectedPackageIds.size})
            </button>}
            {pkgSelectionMode&&<div style={{fontSize:10,color:"#95a8c0",marginLeft:"auto"}}>{selectedPackageIds.size} seleccionado(s)</div>}
          </div>
          {sortedPackages.map(pkg=>{
            const pp=products.filter(p=>p.packageId===pkg.id);const soldUnits=pp.reduce((s,p)=>s+getSoldQuantity(p),0);
            const totalUnits=pp.reduce((s,p)=>s+getProductQuantity(p),0);const rev=pp.reduce((s,p)=>s+getProductRevenue(p),0);
            const prof=rev-pkg.cost;
            const isSelected=selectedPackageIds.has(pkg.id);
            return<div
              key={pkg.id}
              onClick={pkgSelectionMode?()=>togglePackageSelection(pkg.id):undefined}
              style={{
                background:isSelected?"#112417":"#111a26",
                border:"1px solid "+(isSelected?"#0d3":"#1c2738"),
                borderRadius:14,padding:"14px 16px",
                cursor:pkgSelectionMode?"pointer":"default",
                boxShadow:isSelected?"0 0 0 1px rgba(0,221,51,.4) inset":"none",
                transition:"background .15s ease, border-color .15s ease, box-shadow .15s ease"
              }}
            >
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {pkgSelectionMode&&<span style={{fontSize:11,color:isSelected?"#0d3":"#7b8fa9",fontWeight:700}}>{isSelected?"✓":"○"}</span>}
                  <div><div style={{fontWeight:700,fontSize:14}}>{formatDate(pkg.date)}</div></div>
                  <Badge color={pkg.cost<=3?"green":"orange"}>{formatCurrency(pkg.cost)}</Badge>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:rev>0?(prof>=0?"#0d3":"#f43"):"#304560",fontSize:15}}>{rev>0?(prof>=0?"+":"")+formatCurrency(prof):"—"}</div>
                  <div style={{fontSize:10,color:"#7b8fa9"}}>{soldUnits}/{totalUnits} uds vendidas</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:6}}>
                {pkgSelectionMode?
                  <button onClick={e=>{e.stopPropagation();togglePackageSelection(pkg.id);}} style={{flex:1,background:isSelected?"#0d3":"#1c2738",color:isSelected?"#001a00":"#c2d1e5",border:"none",padding:10,borderRadius:8,fontWeight:800,fontSize:12,cursor:"pointer"}}>
                    {isSelected?"Seleccionado":"Seleccionar"}
                  </button>:
                  <>
                    <button onClick={e=>{e.stopPropagation();setShowPkgDetails(pkg.id);}} style={{flex:1,background:"#1c2738",border:"none",color:"#08f",padding:10,borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer"}}>Ver productos</button>
                    <button onClick={e=>{e.stopPropagation();setProdPkgId(pkg.id);setShowAddProd(true);}} style={{background:"#1c2738",border:"none",color:"#0d3",padding:"10px 14px",borderRadius:8,fontSize:12,cursor:"pointer"}}>+ Producto</button>
                    <button onClick={e=>{e.stopPropagation();openEditPackage(pkg);}} style={{background:"#1c2738",border:"none",color:"#08f",padding:"10px 14px",borderRadius:8,fontSize:12,cursor:"pointer"}}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();if(confirm("¿Borrar paquete y sus productos?"))delPkg(pkg.id);}} style={{background:"#1c2738",border:"none",color:"#f43",padding:"10px 14px",borderRadius:8,fontSize:12,cursor:"pointer"}}>🗑</button>
                  </>
                }
              </div>
            </div>;})}
        </div>}
      </div>}

      {tab==="products"&&<div style={{animation:"fadeIn .2s ease"}}>
        <div style={{marginBottom:10}}>
          <input placeholder="Buscar producto, categoría o notas..." value={productSearch} onChange={e=>setProductSearch(e.target.value)} style={{...inputS,padding:"12px 14px"}}/>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginBottom:12}}>
          <button
            onClick={()=>selectionMode?clearBatchSelection():setSelectionMode(true)}
            style={{background:selectionMode?"#f43":"#1c2738",border:"none",color:selectionMode?"#fff":"#c2d1e5",padding:"10px 12px",borderRadius:8,fontWeight:700,fontSize:11,cursor:"pointer"}}
          >
            {selectionMode?"Cancelar selección":"Seleccionar en lote"}
          </button>
          {selectionMode&&selectedProductIds.size>0&&<button
            onClick={deleteSelectedProducts}
            style={{background:"#f43",border:"none",color:"#fff",padding:"10px 12px",borderRadius:8,fontWeight:800,fontSize:11,cursor:"pointer"}}
          >
            🗑 Borrar ({selectedProductIds.size})
          </button>}
          {selectionMode&&<div style={{fontSize:10,color:"#95a8c0",marginLeft:"auto"}}>{selectedProductIds.size} seleccionado(s)</div>}
        </div>
        <div style={{background:"#101826",border:"1px solid #1f2b3d",borderRadius:10,padding:"8px 10px",marginBottom:12,fontSize:10,color:"#95a8c0"}}>
          Colores por antigüedad: <span style={{color:"#fd0"}}>14d</span> · <span style={{color:"#f90"}}>28d</span> · <span style={{color:"#f43"}}>42d+</span>
        </div>
        {filteredProducts.length===0?<EmptyState icon="🔎" msg={products.length===0?"Añade productos desde cada paquete":"No hay resultados para tu búsqueda"}/>:
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"#101826",border:"1px solid #1f2b3d",borderRadius:14,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontWeight:800,fontSize:12}}>🟢 En venta</div>
              <div style={{fontSize:10,color:"#b0c2d8"}}>{productsForSale.length} productos</div>
            </div>
            {productsForSale.length===0?<div style={{fontSize:11,color:"#7b8fa9",textAlign:"center",padding:16}}>No hay productos en venta</div>:
              <div style={{display:"flex",flexDirection:"column",gap:6}}>{productsForSale.map(renderProductCard)}</div>}
          </div>
          <div style={{background:"#101826",border:"1px solid #1f2b3d",borderRadius:14,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontWeight:800,fontSize:12}}>✅ Vendidos</div>
              <div style={{fontSize:10,color:"#b0c2d8"}}>{productsSold.length} productos</div>
            </div>
            {productsSold.length===0?<div style={{fontSize:11,color:"#7b8fa9",textAlign:"center",padding:16}}>Aún no hay productos vendidos</div>:
              <div style={{display:"flex",flexDirection:"column",gap:6}}>{productsSold.map(renderProductCard)}</div>}
          </div>
        </div>}
      </div>}
    </div>

    {/* Bottom Nav */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0d1420",borderTop:"1px solid #1c2738",display:"flex",justifyContent:"space-around",alignItems:"center",boxSizing:"border-box",paddingBottom:"env(safe-area-inset-bottom, 0px)",height:"calc(64px + env(safe-area-inset-bottom, 0px))",flexShrink:0,zIndex:100}}>
      {tabList.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:"8px 20px",color:tab===t.id?"#0d3":"#95a8c0",transition:"color .2s",lineHeight:1}}>
        <span style={{fontSize:20,lineHeight:1,display:"block"}}>{t.icon}</span>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:.5}}>{t.label}</span>
      </button>)}
    </div>

    {/* Modals */}
    <Modal open={showAddPkg} onClose={()=>setShowAddPkg(false)} title="Nuevo Paquete">
      <Field label="Fecha de compra"><input type="date" value={pkgDate} onChange={e=>setPkgDate(e.target.value)} style={inputS}/></Field>
      <Field label={"Coste por paquete"+(sugCost?" (auto: "+sugCost+"€ — "+getDayLabel(pkgDate)+")":"")}>
        <input type="number" step="0.5" placeholder={sugCost?String(sugCost):"€"} value={pkgCost} onChange={e=>setPkgCost(e.target.value)} style={inputS}/>
      </Field>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[1,5,10,20].map(n=><button key={n} onClick={()=>setPkgQty(String(n))} style={{flex:1,background:pkgQtyNum===n?"#0d3":"#1c2738",color:pkgQtyNum===n?"#000":"#c2d1e5",border:"none",padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>{n}</button>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Field label="Cantidad de paquetes"><input type="number" min="1" max="200" step="1" value={pkgQty} onChange={e=>setPkgQty(e.target.value)} style={inputS}/></Field>
        <Field label="Total estimado"><input value={formatCurrency(pkgTotalEstimate||0)} readOnly style={{...inputS,color:"#b0c2d8"}}/></Field>
      </div>
      <Field label="Notas (opcional)"><input placeholder="Paquete grande, pesado..." value={pkgNotes} onChange={e=>setPkgNotes(e.target.value)} style={inputS}/></Field>
      <button onClick={addPkg} style={btnP}>{pkgQtyNum>1?`Añadir ${pkgQtyNum} paquetes`:"Añadir Paquete"}</button>
    </Modal>
    <Modal open={!!editPackage} onClose={()=>setEditPackage(null)} title="Editar Paquete">
      {editPackage&&<>
        <Field label="Fecha de compra"><input type="date" value={editPackage.date} onChange={e=>setEditPackage(prev=>({...prev,date:e.target.value}))} style={inputS}/></Field>
        <Field label="Coste por paquete (€)"><input type="number" step="0.5" min="0" value={editPackage.cost} onChange={e=>setEditPackage(prev=>({...prev,cost:e.target.value}))} style={inputS}/></Field>
        <Field label="Notas (opcional)"><input value={editPackage.notes} onChange={e=>setEditPackage(prev=>({...prev,notes:e.target.value}))} style={inputS}/></Field>
        <button onClick={saveEditedPackage} style={btnP}>Guardar Cambios</button>
      </>}
    </Modal>

    <Modal open={showAddProd} onClose={()=>setShowAddProd(false)} title="Nuevo Producto">
      <Field label="Nombre"><input placeholder="Auriculares Bluetooth..." value={prodName} onChange={e=>setProdName(e.target.value)} style={inputS}/></Field>
      <Field label="Paquete">
        <select value={prodPkgId} onChange={e=>setProdPkgId(e.target.value)} style={selectS}>
          <option value="">Seleccionar...</option>
          {sortedPackages.map(p=><option key={p.id} value={p.id}>{formatDate(p.date)} — {formatCurrency(p.cost)} {p.notes?"("+p.notes+")":""}</option>)}
        </select>
      </Field>
      <div style={{display:"flex",gap:8}}>
        <Field label="Categoría"><select value={prodCat} onChange={e=>setProdCat(e.target.value)} style={selectS}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Condición"><select value={prodCond} onChange={e=>setProdCond(e.target.value)} style={selectS}>{["Nuevo","Bueno","Aceptable","Dañado"].map(c=><option key={c}>{c}</option>)}</select></Field>
      </div>
      <div style={{display:"flex",gap:8}}>
        <Field label="Cantidad"><input type="number" min="1" step="1" value={prodQty} onChange={e=>setProdQty(e.target.value)} style={inputS}/></Field>
        <Field label="Precio objetivo/u (€)"><input type="number" step="0.5" placeholder="Opcional" value={prodEst} onChange={e=>setProdEst(e.target.value)} style={inputS}/></Field>
      </div>
      <Field label="Notas (opcional)"><input placeholder="Detalles..." value={prodNotes} onChange={e=>setProdNotes(e.target.value)} style={inputS}/></Field>
      <button onClick={addProd} style={btnP}>Añadir Producto</button>
    </Modal>

    <Modal open={!!showPkgDetails} onClose={()=>setShowPkgDetails(null)} title={selectedPackage?`Productos del paquete · ${formatDate(selectedPackage.date)}`:"Productos del paquete"}>
      {selectedPackageProducts.length===0?<EmptyState icon="📦" msg="Este paquete no tiene productos"/>:
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {selectedPackageProducts.map(p=>{const qty=getProductQuantity(p);const soldQty=getSoldQuantity(p);return<div key={p.id} style={{background:"#111a26",border:"1px solid #1c2738",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontWeight:700,fontSize:13}}>{p.name}</div>
          <div style={{fontSize:10,color:"#b0c2d8",marginTop:3}}>{p.category} · {soldQty}/{qty} uds vendidas</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            <Badge color={p.status==="Vendido"?"green":p.status==="En venta"?"blue":"neutral"}>{p.status}</Badge>
            <div style={{display:"flex",gap:6}}>
              {getAvailableQuantity(p)>0&&<button onClick={()=>openSellModal(p.id)} style={{background:"#0d3",color:"#000",border:"none",padding:"8px 10px",borderRadius:8,fontWeight:800,fontSize:11,cursor:"pointer"}}>Vender</button>}
              <button onClick={()=>openEditProduct(p)} style={{background:"#1c2738",color:"#08f",border:"none",padding:"8px 10px",borderRadius:8,fontSize:12,cursor:"pointer"}}>✏️</button>
            </div>
          </div>
        </div>;})}
      </div>}
    </Modal>

    <Modal open={!!showSell} onClose={()=>setShowSell(null)} title="Registrar Venta">
      {currentSellProduct&&<div style={{fontSize:11,color:"#b0c2d8",marginBottom:12}}>
        {currentSellProduct.name} · disponibles: <b style={{color:"#e1e9f5"}}>{sellAvailableQty}</b>
      </div>}
      <Field label={"Cantidad a vender"+(sellAvailableQty>0?" (máx: "+sellAvailableQty+")":"")}>
        <input type="number" min="1" max={sellAvailableQty||1} step="1" value={sellQty} onChange={e=>setSellQty(e.target.value)} style={inputS}/>
      </Field>
      <Field label="Precio por unidad (€)"><input type="number" step="0.5" placeholder="Precio por unidad" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} style={inputS}/></Field>
      {sellPreviewTotal>0&&<div style={{fontSize:11,color:"#95a8c0",marginBottom:10}}>Total estimado: {formatCurrency(sellPreviewTotal)} ({sellQtyNum} uds)</div>}
      <Field label="Plataforma"><select value={sellPlat} onChange={e=>setSellPlat(e.target.value)} style={selectS}>{PLATFORMS.map(p=><option key={p} value={p}>{p}</option>)}</select></Field>
      <Field label="Fecha"><input type="date" value={sellDate} onChange={e=>setSellDate(e.target.value)} style={inputS}/></Field>
      <button onClick={sell} disabled={!currentSellProduct||sellAvailableQty<=0} style={{...btnP,opacity:(!currentSellProduct||sellAvailableQty<=0)?.5:1}}>💰 Registrar Venta</button>
    </Modal>

    <Modal open={!!editProduct} onClose={()=>setEditProduct(null)} title="Editar Producto">
      {editProduct&&<>
        <Field label="Nombre"><input value={editProduct.name} onChange={e=>setEditProduct(prev=>({...prev,name:e.target.value}))} style={inputS}/></Field>
        <Field label="Paquete">
          <select value={editProduct.packageId} onChange={e=>setEditProduct(prev=>({...prev,packageId:e.target.value}))} style={selectS}>
            <option value="">Seleccionar...</option>
            {sortedPackages.map(p=><option key={p.id} value={p.id}>{formatDate(p.date)} — {formatCurrency(p.cost)}</option>)}
          </select>
        </Field>
        <div style={{display:"flex",gap:8}}>
          <Field label="Categoría"><select value={editProduct.category} onChange={e=>setEditProduct(prev=>({...prev,category:e.target.value}))} style={selectS}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Condición"><select value={editProduct.condition} onChange={e=>setEditProduct(prev=>({...prev,condition:e.target.value}))} style={selectS}>{["Nuevo","Bueno","Aceptable","Dañado"].map(c=><option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Estado"><select value={editProduct.status} onChange={e=>setEditProduct(prev=>({...prev,status:e.target.value}))} style={selectS}>{PRODUCT_STATUS.map(s=><option key={s} value={s}>{s}</option>)}</select></Field>
        <div style={{display:"flex",gap:8}}>
          <Field label="Unidades"><input type="number" min="1" step="1" value={editProduct.quantity} onChange={e=>setEditProduct(prev=>({...prev,quantity:e.target.value}))} style={inputS}/></Field>
          <Field label="Precio objetivo/u (€)"><input type="number" step="0.5" value={editProduct.estPrice} onChange={e=>setEditProduct(prev=>({...prev,estPrice:e.target.value}))} style={inputS}/></Field>
        </div>
        {editIsSold&&<>
          <div style={{fontSize:11,color:"#95a8c0",marginBottom:10}}>Datos de venta</div>
          <div style={{display:"flex",gap:8}}>
            <Field label="Precio venta/u (€)"><input type="number" step="0.5" value={editProduct.soldUnitPrice} onChange={e=>setEditProduct(prev=>({...prev,soldUnitPrice:e.target.value}))} style={inputS}/></Field>
            <Field label="Total venta (€)"><input value={formatCurrency(editSoldTotalPreview)} style={{...inputS,color:"#b0c2d8"}} readOnly/></Field>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Field label="Plataforma venta"><select value={editProduct.soldPlatform} onChange={e=>setEditProduct(prev=>({...prev,soldPlatform:e.target.value}))} style={selectS}>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></Field>
            <Field label="Fecha de venta"><input type="date" value={editProduct.soldDate} onChange={e=>setEditProduct(prev=>({...prev,soldDate:e.target.value}))} style={inputS}/></Field>
          </div>
        </>}
        <Field label="Notas"><input value={editProduct.notes} onChange={e=>setEditProduct(prev=>({...prev,notes:e.target.value}))} style={inputS}/></Field>
        <button onClick={saveEditedProduct} style={btnP}>Guardar Cambios</button>
      </>}
    </Modal>
  </div>;
}

export default function App() {
  const [user,setUser]=useState(null);const [checking,setChecking]=useState(true);
  useEffect(()=>{const u=onAuthStateChanged(auth,u=>{setUser(u);setChecking(false);});return u;},[]);
  if(checking)return<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#070d16",fontFamily:"'JetBrains Mono',monospace"}}><style>{globalCSS}</style><div style={{textAlign:"center"}}><AppLogo size={48} fontSize={16}/><div style={{color:"#95a8c0",fontSize:13,marginTop:12}}>Cargando...</div></div></div>;
  return<><style>{globalCSS}</style>{user?<Tracker user={user}/>:<LoginScreen/>}</>;
}
