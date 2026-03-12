import { useState, useMemo, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc } from "firebase/firestore";

const PLATFORMS = ["Wallapop", "Vinted"];
const PRODUCT_STATUS = ["Pendiente", "En venta", "Vendido", "Descartado", "Me lo quedo"];
const CATEGORIES = ["Electrónica", "Ropa", "Hogar", "Juguetes", "Belleza", "Deporte", "Libros/Media", "Accesorios", "Otro"];
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
const formatDate = (d) => { if (!d) return ""; return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }); };
const formatCurrency = (n) => n.toFixed(2) + "€";
const dayOfWeek = (dateStr) => new Date(dateStr).getDay();
const getDayLabel = (dateStr) => { const day = dayOfWeek(dateStr); if (day === 2) return "Martes"; if (day === 3) return "Miércoles"; return new Date(dateStr).toLocaleDateString("es-ES", { weekday: "long" }); };

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

const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;width:100%;background:#000;color:#eee;font-family:'JetBrains Mono',monospace;font-size:14px;overflow:hidden}
input,select,button{font-family:inherit}input,select{color-scheme:dark}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#333;border-radius:4px}`;

const inputS = { width:"100%",background:"#111",border:"1px solid #333",borderRadius:10,padding:"14px 16px",color:"#eee",fontSize:15,outline:"none" };
const btnP = { background:"#0d3",color:"#000",border:"none",padding:"16px 24px",borderRadius:12,fontWeight:800,fontSize:15,cursor:"pointer",width:"100%" };

function Badge({children,color="neutral"}) {
  const c = {green:{background:"#0d3",color:"#001a00"},red:{background:"#f43",color:"#fff"},yellow:{background:"#fd0",color:"#1a1400"},blue:{background:"#08f",color:"#fff"},purple:{background:"#a855f7",color:"#fff"},neutral:{background:"#333",color:"#ccc"},orange:{background:"#f90",color:"#1a0e00"}};
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",...(c[color]||c.neutral)}}>{children}</span>;
}
function StatCard({label,value,sub,accent="#0d3"}) {
  return <div style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:14,padding:"16px 18px",flex:"1 1 45%",minWidth:0}}>
    <div style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
    <div style={{fontSize:22,fontWeight:800,color:accent}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:"#444",marginTop:2}}>{sub}</div>}
  </div>;
}
function Modal({open,onClose,title,children}) {
  if (!open) return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(8px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:1000}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#0a0a0a",borderTop:"1px solid #222",borderRadius:"20px 20px 0 0",padding:"24px 20px",paddingBottom:"calc(24px + env(safe-area-inset-bottom, 0px))",width:"100%",maxWidth:500,maxHeight:"85vh",overflowY:"auto",animation:"slideUp 0.25s ease-out"}}>
      <div style={{width:40,height:4,background:"#333",borderRadius:4,margin:"0 auto 16px"}}/>
      <h3 style={{fontSize:17,fontWeight:800,color:"#eee",marginBottom:20}}>{title}</h3>
      {children}
    </div>
  </div>;
}
function Field({label,children}) { return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>{children}</div>; }
function EmptyState({icon,msg}) { return <div style={{textAlign:"center",padding:"50px 20px",color:"#333"}}><div style={{fontSize:44,marginBottom:12}}>{icon}</div><div style={{fontSize:13,color:"#444"}}>{msg}</div></div>; }
function MiniBar({data,color="#0d3"}) {
  if (!data||!data.length) return null; const max=Math.max(...data.map(d=>d.value),1);
  return <div style={{display:"flex",flexDirection:"column",gap:6}}>{data.map((d,i)=>
    <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:70,fontSize:10,color:"#666",textAlign:"right",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.label}</div>
      <div style={{flex:1,background:"#0a0a0a",borderRadius:4,height:22,position:"relative",overflow:"hidden"}}>
        <div style={{width:`${(d.value/max)*100}%`,background:color,height:"100%",borderRadius:4,transition:"width 0.5s ease",minWidth:d.value>0?4:0}}/>
        <span style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",fontSize:10,fontWeight:700,color:"#888"}}>{formatCurrency(d.value)}</span>
      </div>
    </div>)}</div>;
}

function LoginScreen() {
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [name,setName]=useState("");
  const [isReg,setIsReg]=useState(false);const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  const submit = async()=>{
    if(!email||!pass) return setError("Rellena email y contraseña");
    if(isReg&&!name) return setError("Pon tu nombre");
    setError("");setLoading(true);
    try {
      if(isReg){const cred=await createUserWithEmailAndPassword(auth,email,pass);await updateProfile(cred.user,{displayName:name});}
      else await signInWithEmailAndPassword(auth,email,pass);
    } catch(e) {
      const m={"auth/email-already-in-use":"Ese email ya está registrado","auth/invalid-email":"Email no válido","auth/weak-password":"Mínimo 6 caracteres","auth/invalid-credential":"Email o contraseña incorrectos","auth/user-not-found":"No existe esa cuenta","auth/wrong-password":"Contraseña incorrecta"};
      setError(m[e.code]||e.message);
    } setLoading(false);
  };
  return <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <style>{globalCSS}</style>
    <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#0d3,#08f)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:16}}>📦</div>
    <h1 style={{fontSize:20,fontWeight:800,marginBottom:4}}>RESALE TRACKER</h1>
    <p style={{fontSize:11,color:"#555",marginBottom:32}}>{isReg?"Crea tu cuenta":"Inicia sesión"}</p>
    <div style={{width:"100%",maxWidth:340}}>
      {isReg&&<Field label="Tu nombre"><input placeholder="Ej: Juan" value={name} onChange={e=>setName(e.target.value)} style={inputS}/></Field>}
      <Field label="Email"><input type="email" placeholder="tu@email.com" value={email} onChange={e=>setEmail(e.target.value)} style={inputS} autoCapitalize="none"/></Field>
      <Field label="Contraseña"><input type="password" placeholder="Mínimo 6 caracteres" value={pass} onChange={e=>setPass(e.target.value)} style={inputS} onKeyDown={e=>e.key==="Enter"&&submit()}/></Field>
      {error&&<div style={{background:"#1a0808",border:"1px solid #3a1515",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#f43",marginBottom:14}}>{error}</div>}
      <button onClick={submit} disabled={loading} style={{...btnP,opacity:loading?.5:1,marginBottom:14}}>{loading?"...":isReg?"Crear cuenta":"Entrar"}</button>
      <button onClick={()=>{setIsReg(!isReg);setError("");}} style={{background:"transparent",border:"none",color:"#555",fontSize:12,cursor:"pointer",width:"100%",padding:10}}>{isReg?"Ya tengo cuenta → Iniciar sesión":"No tengo cuenta → Registrarme"}</button>
    </div>
  </div>;
}

function Tracker({user}) {
  const [packages,setPackages]=useState([]);const [products,setProducts]=useState([]);
  const [tab,setTab]=useState("dashboard");const [showAddPkg,setShowAddPkg]=useState(false);
  const [showAddProd,setShowAddProd]=useState(false);const [showSell,setShowSell]=useState(null);
  const [filterStatus,setFilterStatus]=useState("all");const [loading,setLoading]=useState(true);
  const [pkgDate,setPkgDate]=useState(new Date().toISOString().split("T")[0]);
  const [pkgCost,setPkgCost]=useState("");const [pkgNotes,setPkgNotes]=useState("");
  const [prodName,setProdName]=useState("");const [prodCat,setProdCat]=useState("Otro");
  const [prodPkgId,setProdPkgId]=useState("");const [prodCond,setProdCond]=useState("Bueno");
  const [prodEst,setProdEst]=useState("");const [prodNotes,setProdNotes]=useState("");
  const [sellPrice,setSellPrice]=useState("");const [sellPlat,setSellPlat]=useState("Wallapop");
  const [sellDate,setSellDate]=useState(new Date().toISOString().split("T")[0]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"packages"),s=>{setPackages(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(collection(db,"products"),s=>{setProducts(s.docs.map(d=>({id:d.id,...d.data()})));});
    return()=>{u1();u2();};
  },[]);

  const stats=useMemo(()=>{
    const totalCost=packages.reduce((s,p)=>s+p.cost,0);
    const sold=products.filter(p=>p.status==="Vendido");
    const totalRev=sold.reduce((s,p)=>s+(p.soldPrice||0),0);
    const profit=totalRev-totalCost;
    const pending=products.filter(p=>p.status==="Pendiente"||p.status==="En venta");
    const mar=packages.filter(p=>dayOfWeek(p.date)===2);const mie=packages.filter(p=>dayOfWeek(p.date)===3);
    const marIds=new Set(mar.map(p=>p.id));const mieIds=new Set(mie.map(p=>p.id));
    const marRev=sold.filter(p=>marIds.has(p.packageId)).reduce((s,p)=>s+(p.soldPrice||0),0);
    const marCost=mar.reduce((s,p)=>s+p.cost,0);
    const mieRev=sold.filter(p=>mieIds.has(p.packageId)).reduce((s,p)=>s+(p.soldPrice||0),0);
    const mieCost=mie.reduce((s,p)=>s+p.cost,0);
    const byCat={};sold.forEach(p=>{if(!byCat[p.category])byCat[p.category]={revenue:0};byCat[p.category].revenue+=p.soldPrice||0;});
    const catData=Object.entries(byCat).map(([l,v])=>({label:l,value:v.revenue})).sort((a,b)=>b.value-a.value);
    const byPlat={};sold.forEach(p=>{const pl=p.soldPlatform||"Otro";if(!byPlat[pl])byPlat[pl]={revenue:0};byPlat[pl].revenue+=p.soldPrice||0;});
    const platData=Object.entries(byPlat).map(([l,v])=>({label:l,value:v.revenue})).sort((a,b)=>b.value-a.value);
    return{totalCost,totalRev,profit,roi:totalCost>0?((profit/totalCost)*100).toFixed(0):0,
      totalPkgs:packages.length,soldCount:sold.length,pendingCount:pending.length,
      avgPerPkg:packages.length?totalRev/packages.length:0,
      martes:{cost:marCost,revenue:marRev,profit:marRev-marCost,count:mar.length},
      miercoles:{cost:mieCost,revenue:mieRev,profit:mieRev-mieCost,count:mie.length},catData,platData};
  },[packages,products]);

  const staleProds=useMemo(()=>products.map(p=>({...p,alert:getAlertLevel(p)})).filter(p=>p.alert).sort((a,b)=>b.alert.days-a.alert.days),[products]);

  const addPkg=async()=>{
    if(!pkgDate)return;const cost=pkgCost?parseFloat(pkgCost):dayOfWeek(pkgDate)===3?3:6;
    const pkg={id:generateId(),date:pkgDate,cost,notes:pkgNotes,addedBy:user.displayName||user.email,addedAt:new Date().toISOString()};
    await setDoc(doc(db,"packages",pkg.id),pkg);
    setPkgDate(new Date().toISOString().split("T")[0]);setPkgCost("");setPkgNotes("");setShowAddPkg(false);
  };
  const addProd=async()=>{
    if(!prodName||!prodPkgId)return;
    const p={id:generateId(),name:prodName,category:prodCat,packageId:prodPkgId,condition:prodCond,
      estPrice:prodEst?parseFloat(prodEst):0,status:"Pendiente",notes:prodNotes,
      createdAt:new Date().toISOString(),soldPrice:null,soldPlatform:null,soldDate:null,
      addedBy:user.displayName||user.email};
    await setDoc(doc(db,"products",p.id),p);
    setProdName("");setProdCat("Otro");setProdCond("Bueno");setProdEst("");setProdNotes("");setShowAddProd(false);
  };
  const sell=async()=>{
    if(!showSell||!sellPrice)return;
    await updateDoc(doc(db,"products",showSell),{status:"Vendido",soldPrice:parseFloat(sellPrice),soldPlatform:sellPlat,soldDate:sellDate,soldBy:user.displayName||user.email});
    setSellPrice("");setSellPlat("Wallapop");setSellDate(new Date().toISOString().split("T")[0]);setShowSell(null);
  };
  const delPkg=async(id)=>{await deleteDoc(doc(db,"packages",id));const ps=products.filter(p=>p.packageId===id);for(const p of ps)await deleteDoc(doc(db,"products",p.id));};
  const delProd=async(id)=>{await deleteDoc(doc(db,"products",id));};
  const updStatus=async(id,s)=>{await updateDoc(doc(db,"products",id),{status:s});};
  const getPkg=(id)=>packages.find(p=>p.id===id);
  const filtered=useMemo(()=>{let l=[...products];if(filterStatus!=="all")l=l.filter(p=>p.status===filterStatus);return l.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));},[products,filterStatus]);
  const sugCost=useMemo(()=>{if(pkgCost)return null;const d=dayOfWeek(pkgDate);return d===2?6:d===3?3:null;},[pkgDate,pkgCost]);
  const tabList=[{id:"dashboard",icon:"📊",label:"Inicio"},{id:"packages",icon:"📦",label:"Paquetes"},{id:"products",icon:"🏷",label:"Productos"}];

  if(loading)return<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>📦</div><div style={{color:"#555",fontSize:13}}>Cargando...</div></div></div>;

  return <div style={{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Header */}
    <div style={{padding:"12px 16px",paddingTop:"calc(12px + env(safe-area-inset-top, 0px))",borderBottom:"1px solid #111",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#0d3,#08f)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📦</div>
        <div><div style={{fontWeight:800,fontSize:14,letterSpacing:-.5}}>RESALE TRACKER</div><div style={{fontSize:9,color:"#444"}}>{user.displayName||user.email}</div></div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {tab==="packages"&&<button onClick={()=>setShowAddPkg(true)} style={{background:"#0d3",color:"#000",border:"none",padding:"10px 16px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>+ Paquete</button>}
        {tab==="products"&&packages.length>0&&<button onClick={()=>{setProdPkgId(packages[packages.length-1].id);setShowAddProd(true);}} style={{background:"#0d3",color:"#000",border:"none",padding:"10px 16px",borderRadius:10,fontWeight:800,fontSize:13,cursor:"pointer"}}>+ Producto</button>}
        <button onClick={()=>signOut(auth)} style={{background:"#111",border:"none",color:"#555",padding:"10px",borderRadius:10,cursor:"pointer",fontSize:14}} title="Salir">🚪</button>
      </div>
    </div>

    {/* Content */}
    <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:16,paddingBottom:100}}>

      {tab==="dashboard"&&<div style={{animation:"fadeIn .2s ease"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          <StatCard label="Invertido" value={formatCurrency(stats.totalCost)} sub={stats.totalPkgs+" paquetes"} accent="#f90"/>
          <StatCard label="Facturado" value={formatCurrency(stats.totalRev)} sub={stats.soldCount+" ventas"} accent="#08f"/>
          <StatCard label="Beneficio" value={formatCurrency(stats.profit)} sub={"ROI: "+stats.roi+"%"} accent={stats.profit>=0?"#0d3":"#f43"}/>
          <StatCard label="Pendientes" value={stats.pendingCount} sub="por vender" accent="#a855f7"/>
          {staleProds.length>0&&<StatCard label="Capital parado" value={formatCurrency(staleProds.reduce((s,p)=>s+getCostPerProduct(p,packages,products),0))} sub={staleProds.length+" estancado"+(staleProds.length!==1?"s":"")} accent="#f43"/>}
        </div>

        {staleProds.length>0&&<div style={{background:"#111",border:"1px solid #222",borderRadius:14,padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:800}}>⏰ Productos estancados</div>
            <div style={{fontSize:10,color:"#555"}}>
              {staleProds.filter(p=>p.alert.level==="critical").length>0&&<span style={{color:"#f43"}}>🚨{staleProds.filter(p=>p.alert.level==="critical").length} </span>}
              {staleProds.filter(p=>p.alert.level==="urgent").length>0&&<span style={{color:"#f90"}}>🔥{staleProds.filter(p=>p.alert.level==="urgent").length} </span>}
              {staleProds.filter(p=>p.alert.level==="warning").length>0&&<span style={{color:"#fd0"}}>⚠️{staleProds.filter(p=>p.alert.level==="warning").length}</span>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {staleProds.slice(0,5).map(p=>{const c=getCostPerProduct(p,packages,products);return<div key={p.id} style={{background:p.alert.bg,border:"1px solid "+p.alert.border,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.alert.icon} {p.name}</div>
                  <div style={{fontSize:10,color:"#666",marginTop:3}}>{p.alert.daysSince}d · {p.alert.message}</div>
                  <div style={{fontSize:10,color:"#555",marginTop:2}}>Mín: {formatCurrency(c)}{p.estPrice>0&&<span> · Puesto a {formatCurrency(p.estPrice)}</span>}</div>
                </div>
                <button onClick={()=>{setSellPrice("");setShowSell(p.id);}} style={{background:p.alert.color,color:"#000",border:"none",padding:"8px 12px",borderRadius:8,fontWeight:800,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>💰 Vender</button>
              </div>
            </div>;})}
            {staleProds.length>5&&<button onClick={()=>{setTab("products");setFilterStatus("En venta");}} style={{background:"#1a1a1a",border:"none",color:"#888",padding:10,borderRadius:8,fontSize:11,cursor:"pointer"}}>Ver {staleProds.length-5} más →</button>}
          </div>
        </div>}

        <div style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:14,padding:16,marginBottom:12}}>
          <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>🗓 Martes vs Miércoles</div>
          <div style={{display:"flex",gap:10}}>
            {[{l:"MAR (6€)",d:stats.martes},{l:"MIÉ (3€)",d:stats.miercoles}].map(x=><div key={x.l} style={{flex:1,background:"#0a0a0a",borderRadius:10,padding:14}}>
              <div style={{fontSize:10,color:"#666",marginBottom:2}}>{x.l}</div>
              <div style={{fontSize:10,color:"#444"}}>{x.d.count} paq</div>
              <div style={{fontSize:20,fontWeight:800,color:x.d.profit>=0?"#0d3":"#f43",marginTop:6}}>{formatCurrency(x.d.profit)}</div>
              <div style={{fontSize:9,color:"#444"}}>{x.d.count>0?formatCurrency(x.d.profit/x.d.count)+"/paq":"—"}</div>
            </div>)}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:14,padding:16}}>
            <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>🏷 Top Categorías</div>
            {stats.catData.length>0?<MiniBar data={stats.catData.slice(0,5)} color="#08f"/>:<div style={{color:"#333",fontSize:11,textAlign:"center",padding:16}}>Sin ventas aún</div>}
          </div>
          <div style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:14,padding:16}}>
            <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>📱 Por Plataforma</div>
            {stats.platData.length>0?<MiniBar data={stats.platData} color="#a855f7"/>:<div style={{color:"#333",fontSize:11,textAlign:"center",padding:16}}>Sin ventas aún</div>}
          </div>
          {packages.length>0&&<div style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:14,padding:16}}>
            <div style={{fontSize:11,color:"#555",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>📊 Media por Paquete</div>
            <div style={{fontSize:28,fontWeight:800,color:"#0d3"}}>{formatCurrency(stats.avgPerPkg)}</div>
            <div style={{fontSize:10,color:"#444",marginTop:2}}>{(products.length/packages.length).toFixed(1)} productos/paquete</div>
          </div>}
        </div>
        {packages.length===0&&<div style={{textAlign:"center",padding:"30px 20px",marginTop:16}}>
          <div style={{fontSize:13,color:"#444",marginBottom:14}}>¡Registra tu primer paquete!</div>
          <button onClick={()=>{setTab("packages");setTimeout(()=>setShowAddPkg(true),100);}} style={{...btnP,width:"auto",padding:"14px 28px"}}>+ Añadir Paquete</button>
        </div>}
      </div>}

      {tab==="packages"&&<div style={{animation:"fadeIn .2s ease"}}>
        {packages.length===0?<EmptyState icon="📦" msg="No hay paquetes registrados"/>:
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[...packages].sort((a,b)=>b.date.localeCompare(a.date)).map(pkg=>{
            const pp=products.filter(p=>p.packageId===pkg.id);const ps=pp.filter(p=>p.status==="Vendido");
            const rev=ps.reduce((s,p)=>s+(p.soldPrice||0),0);const prof=rev-pkg.cost;
            return<div key={pkg.id} style={{background:"#111",border:"1px solid #1a1a1a",borderRadius:14,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div><div style={{fontWeight:700,fontSize:14}}>{formatDate(pkg.date)}</div><div style={{fontSize:10,color:"#444"}}>{getDayLabel(pkg.date)}</div></div>
                  <Badge color={pkg.cost<=3?"green":"orange"}>{formatCurrency(pkg.cost)}</Badge>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:rev>0?(prof>=0?"#0d3":"#f43"):"#333",fontSize:15}}>{rev>0?(prof>=0?"+":"")+formatCurrency(prof):"—"}</div>
                  <div style={{fontSize:10,color:"#444"}}>{pp.length} prod · {ps.length} vendido{ps.length!==1?"s":""}</div>
                </div>
              </div>
              {pkg.addedBy&&<div style={{fontSize:9,color:"#333",marginBottom:6}}>por {pkg.addedBy}</div>}
              <div style={{display:"flex",gap:8,marginTop:6}}>
                <button onClick={()=>{setProdPkgId(pkg.id);setShowAddProd(true);}} style={{flex:1,background:"#1a1a1a",border:"none",color:"#0d3",padding:10,borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Producto</button>
                <button onClick={()=>{if(confirm("¿Borrar paquete y sus productos?"))delPkg(pkg.id);}} style={{background:"#1a1a1a",border:"none",color:"#f43",padding:"10px 14px",borderRadius:8,fontSize:12,cursor:"pointer"}}>🗑</button>
              </div>
            </div>;})}
        </div>}
      </div>}

      {tab==="products"&&<div style={{animation:"fadeIn .2s ease"}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
          {[{v:"all",l:"Todos"},...PRODUCT_STATUS.map(s=>({v:s,l:s}))].map(f=>
            <button key={f.v} onClick={()=>setFilterStatus(f.v)} style={{background:filterStatus===f.v?"#0d3":"#111",color:filterStatus===f.v?"#000":"#666",border:"1px solid "+(filterStatus===f.v?"#0d3":"#222"),padding:"8px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{f.l}</button>)}
        </div>
        {filtered.length===0?<EmptyState icon="🏷" msg={products.length===0?"Añade productos desde cada paquete":"Sin resultados"}/>:
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {filtered.map(p=>{const pkg=getPkg(p.packageId);const al=getAlertLevel(p);
            const sc={Pendiente:"yellow","En venta":"blue",Vendido:"green",Descartado:"red","Me lo quedo":"purple"};
            return<div key={p.id} style={{background:al?al.bg:"#111",border:"1px solid "+(al?al.border:"#1a1a1a"),borderRadius:14,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{fontSize:10,color:"#555",marginTop:2}}>{p.category} · {p.condition}{pkg&&<span> · {formatDate(pkg.date)}</span>}</div>
                </div>
                <Badge color={sc[p.status]||"neutral"}>{p.status}</Badge>
              </div>
              {al&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:al.color,display:"inline-block",animation:al.level==="critical"?"pulse 1.5s infinite":"none"}}/>
                <span style={{fontSize:10,color:al.color,fontWeight:700}}>{al.daysSince}d — {al.message}</span>
                <span style={{fontSize:9,color:"#555"}}>(mín {formatCurrency(getCostPerProduct(p,packages,products))})</span>
              </div>}
              {p.status==="Vendido"&&<div style={{fontSize:13,fontWeight:800,color:"#0d3",marginBottom:6}}>
                {formatCurrency(p.soldPrice)} · {p.soldPlatform}
                {p.soldBy&&<span style={{fontSize:9,color:"#555",fontWeight:400}}> por {p.soldBy}</span>}
              </div>}
              {p.estPrice>0&&p.status!=="Vendido"&&<div style={{fontSize:10,color:"#555",marginBottom:6}}>Precio: {formatCurrency(p.estPrice)}</div>}
              <div style={{display:"flex",gap:6}}>
                {p.status!=="Vendido"&&p.status!=="Descartado"&&<>
                  <button onClick={()=>{setSellPrice("");setShowSell(p.id);}} style={{flex:1,background:"#0d3",color:"#000",border:"none",padding:10,borderRadius:8,fontWeight:800,fontSize:12,cursor:"pointer"}}>💰 Vender</button>
                  <select value={p.status} onChange={e=>updStatus(p.id,e.target.value)} style={{background:"#1a1a1a",border:"none",color:"#888",padding:"10px 8px",borderRadius:8,fontSize:11,cursor:"pointer"}}>
                    {PRODUCT_STATUS.filter(s=>s!=="Vendido").map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </>}
                <button onClick={()=>{if(confirm("¿Eliminar?"))delProd(p.id);}} style={{background:"#1a1a1a",border:"none",color:"#f43",padding:"10px 12px",borderRadius:8,fontSize:12,cursor:"pointer"}}>🗑</button>
              </div>
            </div>;})}
        </div>}
      </div>}
    </div>

    {/* Bottom Nav */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a0a0a",borderTop:"1px solid #1a1a1a",display:"flex",justifyContent:"space-around",alignItems:"center",paddingBottom:"env(safe-area-inset-bottom, 0px)",height:64,flexShrink:0,zIndex:100}}>
      {tabList.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 20px",color:tab===t.id?"#0d3":"#555",transition:"color .2s"}}>
        <span style={{fontSize:20}}>{t.icon}</span>
        <span style={{fontSize:9,fontWeight:700,letterSpacing:.5}}>{t.label}</span>
      </button>)}
    </div>

    {/* Modals */}
    <Modal open={showAddPkg} onClose={()=>setShowAddPkg(false)} title="Nuevo Paquete">
      <Field label="Fecha de compra"><input type="date" value={pkgDate} onChange={e=>setPkgDate(e.target.value)} style={inputS}/></Field>
      <Field label={"Coste"+(sugCost?" (auto: "+sugCost+"€ — "+getDayLabel(pkgDate)+")":"")}>
        <input type="number" step="0.5" placeholder={sugCost?String(sugCost):"€"} value={pkgCost} onChange={e=>setPkgCost(e.target.value)} style={inputS}/>
      </Field>
      <Field label="Notas (opcional)"><input placeholder="Paquete grande, pesado..." value={pkgNotes} onChange={e=>setPkgNotes(e.target.value)} style={inputS}/></Field>
      <button onClick={addPkg} style={btnP}>Añadir Paquete</button>
    </Modal>

    <Modal open={showAddProd} onClose={()=>setShowAddProd(false)} title="Nuevo Producto">
      <Field label="Nombre"><input placeholder="Auriculares Bluetooth..." value={prodName} onChange={e=>setProdName(e.target.value)} style={inputS}/></Field>
      <Field label="Paquete">
        <select value={prodPkgId} onChange={e=>setProdPkgId(e.target.value)} style={inputS}>
          <option value="">Seleccionar...</option>
          {[...packages].sort((a,b)=>b.date.localeCompare(a.date)).map(p=><option key={p.id} value={p.id}>{formatDate(p.date)} — {formatCurrency(p.cost)} {p.notes?"("+p.notes+")":""}</option>)}
        </select>
      </Field>
      <div style={{display:"flex",gap:8}}>
        <Field label="Categoría"><select value={prodCat} onChange={e=>setProdCat(e.target.value)} style={inputS}>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Estado"><select value={prodCond} onChange={e=>setProdCond(e.target.value)} style={inputS}>{["Nuevo","Bueno","Aceptable","Dañado"].map(c=><option key={c}>{c}</option>)}</select></Field>
      </div>
      <Field label="Precio estimado (€)"><input type="number" step="0.5" placeholder="Opcional" value={prodEst} onChange={e=>setProdEst(e.target.value)} style={inputS}/></Field>
      <Field label="Notas (opcional)"><input placeholder="Detalles..." value={prodNotes} onChange={e=>setProdNotes(e.target.value)} style={inputS}/></Field>
      <button onClick={addProd} style={btnP}>Añadir Producto</button>
    </Modal>

    <Modal open={!!showSell} onClose={()=>setShowSell(null)} title="Registrar Venta">
      <Field label="Precio de venta (€)"><input type="number" step="0.5" placeholder="¿Cuánto?" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} style={inputS}/></Field>
      <Field label="Plataforma"><select value={sellPlat} onChange={e=>setSellPlat(e.target.value)} style={inputS}>{PLATFORMS.map(p=><option key={p} value={p}>{p}</option>)}</select></Field>
      <Field label="Fecha"><input type="date" value={sellDate} onChange={e=>setSellDate(e.target.value)} style={inputS}/></Field>
      <button onClick={sell} style={btnP}>💰 Registrar Venta</button>
    </Modal>
  </div>;
}

export default function App() {
  const [user,setUser]=useState(null);const [checking,setChecking]=useState(true);
  useEffect(()=>{const u=onAuthStateChanged(auth,u=>{setUser(u);setChecking(false);});return u;},[]);
  if(checking)return<div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#000",fontFamily:"'JetBrains Mono',monospace"}}><style>{globalCSS}</style><div style={{textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>📦</div><div style={{color:"#555",fontSize:13}}>Cargando...</div></div></div>;
  return<><style>{globalCSS}</style>{user?<Tracker user={user}/>:<LoginScreen/>}</>;
}
