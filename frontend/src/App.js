import React, { useState, useEffect, useCallback } from "react";

const API = "/api";
const C = {
  bg: "#0f172a", card: "#1e293b", border: "#334155", accent: "#3b82f6",
  text: "#e2e8f0", muted: "#94a3b8", dim: "#64748b", white: "#fff",
  green: "#10b981", amber: "#f59e0b", red: "#ef4444",
};

const fmtDate = (v) => {
  if (!v) return "\u2014";
  if (typeof v === "string" && v.includes("T")) return new Date(v).toLocaleDateString("es-ES");
  if (typeof v === "number") return new Date((v - 25569) * 86400000).toLocaleDateString("es-ES");
  return String(v);
};

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selOrder, setSelOrder] = useState(null);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState("");
  const [selPallets, setSelPallets] = useState(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/orders`);
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = async () => {
    await fetch(`${API}/refresh`, { method: "POST" });
    loadData();
  };

  const printLabel = (p) => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><style>
      @page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;margin:0;color:#000}
      .lbl{border:2px solid #000;padding:16px;box-sizing:border-box}
      .hdr{display:flex;justify-content:space-between;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:10px}
      .sec{border-bottom:1px solid #ccc;padding:8px 0}.st{font-size:10px;color:#333;text-transform:uppercase;letter-spacing:1px;font-weight:bold;margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:2px}
      .row{display:flex;gap:16px;flex-wrap:wrap}.f{flex:1;min-width:100px}
      .fl{font-size:8px;color:#888;text-transform:uppercase}.fv{font-size:14px;font-weight:700;margin-top:1px}.big{font-size:20px}
    </style></head><body><div class="lbl">
      <div class="hdr"><div><div style="font-size:18px;font-weight:800">GLOBAL FOOD LINK S.L.</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:700">${p.externalDocNo||p.salesOrderNo}</div></div></div>
      <div class="sec"><div class="st">Customer</div><div class="row"><div class="f" style="flex:2"><div class="fl">Name</div><div class="fv">${p.customerName}</div></div><div class="f"><div class="fl">Country</div><div class="fv big">${p.shipToCountry}</div></div></div></div>
      <div class="sec"><div class="st">Item</div><div class="row"><div class="f"><div class="fl">Item Code</div><div class="fv big">${p.itemRefNo||p.itemNo}</div></div><div class="f" style="flex:2"><div class="fl">Description</div><div class="fv">${p.itemDescription||""}</div></div><div class="f"><div class="fl">ETIN/EAN</div><div class="fv" style="font-size:12px">${p.eanCode||"--"}</div></div></div></div>
      <div class="sec"><div class="st">Details</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><div class="fl">SSCC</div><div class="fv big">${p.sscc||"--"}</div></div><div><div class="fl">Batch</div><div class="fv big">${p.lotNo}</div></div><div><div class="fl">Best Before</div><div class="fv big">${fmtDate(p.expirationDate)}</div></div><div><div class="fl">Net Weight</div><div class="fv big">${p.initQuantity} Kg</div></div><div><div class="fl">Boxes</div><div class="fv big">${p.boxesPerPallet}</div></div><div></div></div></div>
      <div style="border-top:2px solid #000;padding-top:8px;margin-top:12px">
        <div class="st" style="text-align:center">GS1-128</div>
        ${p.gs1Line1?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line1)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line1HR}</div></div>`:""}
        ${p.gs1Line2?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line2)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line2HR}</div></div>`:""}
        <div style="border-top:2px solid #000;padding-top:8px;margin-top:8px;text-align:center"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line3)}&height=16" style="width:90%;height:85px"/><div style="font-family:monospace;font-size:11px;font-weight:bold;margin-top:2px">${p.gs1Line3HR}</div></div>
      </div></div></body></html>`);
    w.document.close(); setTimeout(() => w.print(), 1500);
  };

  const printAll = () => {
    if (!data || !selOrder) return;
    const order = data.orders.find(o => o.orderNo === selOrder);
    if (!order) return;
    const pp = selPallets.size > 0 ? order.pallets.filter(p => selPallets.has(p.id)) : order.pallets;
    const w = window.open("", "_blank");
    let html = `<!DOCTYPE html><html><head><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;margin:0;color:#000}.lbl{border:2px solid #000;padding:16px;box-sizing:border-box;page-break-after:always}.lbl:last-child{page-break-after:auto}.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:10px}.sec{border-bottom:1px solid #ccc;padding:8px 0}.st{font-size:10px;color:#333;text-transform:uppercase;letter-spacing:1px;font-weight:bold;margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:2px}.row{display:flex;gap:16px;flex-wrap:wrap}.f{flex:1;min-width:100px}.fl{font-size:8px;color:#888;text-transform:uppercase}.fv{font-size:14px;font-weight:700;margin-top:1px}.big{font-size:20px}</style></head><body>`;
    pp.forEach(p => {
      html += `<div class="lbl"><div class="hdr"><div><div style="font-size:18px;font-weight:800">GLOBAL FOOD LINK S.L.</div></div><div style="text-align:right"><div style="font-size:16px;font-weight:700">${p.externalDocNo||p.salesOrderNo}</div></div></div><div class="sec"><div class="st">Customer</div><div class="row"><div class="f" style="flex:2"><div class="fl">Name</div><div class="fv">${p.customerName}</div></div><div class="f"><div class="fl">Country</div><div class="fv big">${p.shipToCountry}</div></div></div></div><div class="sec"><div class="st">Item</div><div class="row"><div class="f"><div class="fl">Item Code</div><div class="fv big">${p.itemRefNo||p.itemNo}</div></div><div class="f" style="flex:2"><div class="fl">Description</div><div class="fv">${p.itemDescription||""}</div></div><div class="f"><div class="fl">ETIN/EAN</div><div class="fv" style="font-size:12px">${p.eanCode||"--"}</div></div></div></div><div class="sec"><div class="st">Details</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><div class="fl">SSCC</div><div class="fv big">${p.sscc||"--"}</div></div><div><div class="fl">Batch</div><div class="fv big">${p.lotNo}</div></div><div><div class="fl">Best Before</div><div class="fv big">${fmtDate(p.expirationDate)}</div></div><div><div class="fl">Net Weight</div><div class="fv big">${p.initQuantity} Kg</div></div><div><div class="fl">Boxes</div><div class="fv big">${p.boxesPerPallet}</div></div><div></div></div></div><div style="border-top:2px solid #000;padding-top:8px;margin-top:12px"><div class="st" style="text-align:center">GS1-128</div>${p.gs1Line1?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line1)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line1HR}</div></div>`:""} ${p.gs1Line2?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line2)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line2HR}</div></div>`:""}<div style="border-top:2px solid #000;padding-top:8px;margin-top:8px;text-align:center"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line3)}&height=16" style="width:90%;height:85px"/><div style="font-family:monospace;font-size:11px;font-weight:bold;margin-top:2px">${p.gs1Line3HR}</div></div></div></div>`;
    });
    html += "</body></html>"; w.document.write(html); w.document.close(); setTimeout(() => w.print(), 1500);
  };

  // ── LOADING ──
  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>📦</div>
        <div style={{color:C.white,fontSize:18,fontWeight:600}}>Cargando datos de Business Central...</div>
        <div style={{color:C.muted,fontSize:13,marginTop:8}}>Conectando con OData</div>
      </div>
    </div>
  );

  // ── ERROR ──
  if (error) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{textAlign:"center",maxWidth:400}}>
        <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
        <div style={{color:C.red,fontSize:18,fontWeight:600,marginBottom:8}}>Error de conexion</div>
        <div style={{color:C.muted,fontSize:13,marginBottom:20}}>{error}</div>
        <button onClick={loadData} style={{background:C.accent,border:"none",color:"#fff",padding:"10px 24px",borderRadius:8,cursor:"pointer",fontSize:14}}>Reintentar</button>
      </div>
    </div>
  );

  if (!data) return null;

  // ── ORDERS ──
  if (!selOrder) {
    const list = data.orders.filter(o =>
      !search || o.orderNo.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
        <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>📦</span>
            <div><h1 style={{color:C.white,fontSize:16,fontWeight:700,margin:0}}>Etiquetas Palet</h1>
            <p style={{color:C.muted,fontSize:11,margin:0}}>Pedidos de venta abiertos - Datos en tiempo real de BC</p></div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <span style={{background:"rgba(59,130,246,0.12)",padding:"4px 10px",borderRadius:6,color:C.accent,fontSize:12,fontWeight:600}}>{data.totalOrders} pedidos</span>
            <span style={{background:"rgba(16,185,129,0.12)",padding:"4px 10px",borderRadius:6,color:C.green,fontSize:12,fontWeight:600}}>{data.totalPallets} pallets</span>
            <button onClick={refresh} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:11}}>🔄 Actualizar</button>
          </div>
        </div>
        <div style={{padding:"12px 20px"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pedido o cliente..."
            style={{width:"100%",padding:"10px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:13,outline:"none",boxSizing:"border-box"}} />
        </div>
        <div style={{padding:"0 20px 20px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))",gap:10}}>
          {list.map(o=>(
            <div key={o.orderNo} onClick={()=>{setSelOrder(o.orderNo);setSelPallets(new Set());setPreview(null)}}
              style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{color:C.accent,fontSize:16,fontWeight:700}}>{o.orderNo}</span>
                <span style={{background:"rgba(59,130,246,0.12)",color:C.accent,padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:600}}>{o.pallets.length} pallets</span>
              </div>
              <div style={{color:C.white,fontSize:13,fontWeight:500,marginBottom:4}}>{o.customerName}</div>
              <div style={{display:"flex",gap:14,color:C.muted,fontSize:11}}>
                <span>{o.shipToCountry||"--"}</span><span>{fmtDate(o.shipmentDate)}</span><span>{o.itemCount} art.</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── PALLETS ──
  const order = data.orders.find(o => o.orderNo === selOrder);
  if (!order) return null;
  const items = {};
  order.pallets.forEach(p => {
    if (!items[p.itemNo]) items[p.itemNo] = { info: p, list: [] };
    items[p.itemNo].list.push(p);
  });
  const toggleSel = id => setSelPallets(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll = () => { const all = order.pallets.map(p=>p.id); setSelPallets(prev=>prev.size===all.length?new Set():new Set(all)); };

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>{setSelOrder(null);setPreview(null)}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:16}}>&larr;</button>
          <div><h1 style={{color:C.accent,fontSize:16,fontWeight:700,margin:0}}>{order.orderNo}</h1><p style={{color:C.muted,fontSize:11,margin:0}}>{order.customerName}</p></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={toggleAll} style={{background:"none",border:`1px solid ${C.border}`,color:C.text,padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:11}}>
            {selPallets.size===order.pallets.length?"Deseleccionar":"Seleccionar todo"}</button>
          <button onClick={printAll} style={{background:C.accent,border:"none",color:"#fff",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600}}>
            Imprimir {selPallets.size>0?`(${selPallets.size})`:`todos (${order.pallets.length})`}</button>
        </div>
      </div>
      <div style={{display:"flex",height:"calc(100vh - 53px)"}}>
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            {[{l:"Pallets",v:order.pallets.length,c:C.accent},{l:"Articulos",v:Object.keys(items).length,c:C.green},{l:"Pais",v:order.shipToCountry||"--",c:C.amber},{l:"Envio",v:fmtDate(order.shipmentDate),c:C.muted}].map((s,i)=>(
              <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",flex:1,minWidth:80}}>
                <div style={{color:C.muted,fontSize:9,textTransform:"uppercase"}}>{s.l}</div>
                <div style={{color:s.c,fontSize:18,fontWeight:700}}>{s.v}</div>
              </div>
            ))}
          </div>
          {Object.entries(items).map(([no,g])=>(
            <div key={no} style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"6px 10px",background:C.card,borderRadius:6,border:`1px solid ${C.border}`}}>
                <span style={{color:C.accent,fontWeight:700,fontSize:14}}>{no}</span>
                <span style={{color:C.text,fontSize:12}}>{g.info.itemDescription}</span>
                <span style={{color:C.muted,fontSize:11,marginLeft:"auto"}}>{g.list.length} pallets</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:6,paddingLeft:6}}>
                {g.list.map(p=>{
                  const sel=selPallets.has(p.id); const prev=preview?.id===p.id;
                  return (
                    <div key={p.id} onClick={()=>setPreview(p)} style={{background:prev?C.card:"rgba(30,41,59,0.6)",border:`1px solid ${prev?C.accent:sel?C.green:C.border}`,borderRadius:8,padding:10,cursor:"pointer",display:"flex",gap:8}}>
                      <div onClick={e=>{e.stopPropagation();toggleSel(p.id)}} style={{width:18,height:18,borderRadius:3,border:`2px solid ${sel?C.green:C.dim}`,background:sel?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginTop:1}}>
                        {sel&&<span style={{color:"#fff",fontSize:10,fontWeight:700}}>&#10003;</span>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{color:C.white,fontWeight:600,fontSize:13}}>{p.internalPalletNo}</span>
                          <span style={{color:C.amber,fontSize:11,fontWeight:600}}>{p.initQuantity} Kg</span>
                        </div>
                        <div style={{display:"flex",gap:10,fontSize:10,color:C.muted}}>
                          <span>Lote: {p.lotNo}</span><span>Cad: {fmtDate(p.expirationDate)}</span>
                          <span style={{color:C.green,fontWeight:600}}>{p.boxesPerPallet} cajas</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {preview&&(
          <div style={{flex:1,borderLeft:`1px solid ${C.border}`,overflowY:"auto",padding:16,background:"#0d1117"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <h3 style={{color:C.white,fontSize:14,fontWeight:600,margin:0}}>Vista previa</h3>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>printLabel(preview)} style={{background:C.accent,border:"none",color:"#fff",padding:"4px 10px",borderRadius:5,cursor:"pointer",fontSize:11}}>Imprimir</button>
                <button onClick={()=>setPreview(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>X</button>
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:6,padding:16,color:"#000",boxShadow:"0 4px 20px rgba(0,0,0,0.4)",maxWidth:460,margin:"0 auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",borderBottom:"3px solid #000",paddingBottom:6,marginBottom:8}}>
                <div><div style={{fontSize:14,fontWeight:800}}>GLOBAL FOOD LINK S.L.</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700}}>{preview.externalDocNo||preview.salesOrderNo}</div></div>
              </div>
              <div style={{borderBottom:"1px solid #ddd",paddingBottom:5,marginBottom:5}}>
                <div style={{fontSize:8,color:"#333",textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:"1px solid #eee",paddingBottom:2,marginBottom:3}}>Customer</div>
                <div style={{display:"flex",gap:12}}>
                  <div style={{flex:2}}><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Name</div><div style={{fontSize:12,fontWeight:700}}>{preview.customerName}</div></div>
                  <div style={{flex:1}}><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Country</div><div style={{fontSize:16,fontWeight:700}}>{preview.shipToCountry}</div></div>
                </div>
              </div>
              <div style={{borderBottom:"1px solid #ddd",paddingBottom:5,marginBottom:5}}>
                <div style={{fontSize:8,color:"#333",textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:"1px solid #eee",paddingBottom:2,marginBottom:3}}>Item</div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Item Code</div><div style={{fontSize:16,fontWeight:800}}>{preview.itemRefNo||preview.itemNo}</div></div>
                  <div style={{flex:2}}><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Description</div><div style={{fontSize:11,fontWeight:600}}>{preview.itemDescription}</div></div>
                  <div style={{flex:1}}><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>ETIN/EAN</div><div style={{fontSize:10,fontWeight:600}}>{preview.eanCode||"--"}</div></div>
                </div>
              </div>
              <div style={{borderBottom:"1px solid #ddd",paddingBottom:6,marginBottom:6}}>
                <div style={{fontSize:8,color:"#333",textTransform:"uppercase",letterSpacing:1,fontWeight:700,borderBottom:"1px solid #eee",paddingBottom:2,marginBottom:3}}>Details</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>SSCC</div><div style={{fontSize:16,fontWeight:700}}>{preview.sscc||"--"}</div></div>
                  <div><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Batch</div><div style={{fontSize:16,fontWeight:700}}>{preview.lotNo}</div></div>
                  <div><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Best Before</div><div style={{fontSize:16,fontWeight:700}}>{fmtDate(preview.expirationDate)}</div></div>
                  <div><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Net Weight</div><div style={{fontSize:16,fontWeight:700}}>{preview.initQuantity} Kg</div></div>
                  <div><div style={{fontSize:7,color:"#999",textTransform:"uppercase"}}>Boxes</div><div style={{fontSize:16,fontWeight:700}}>{preview.boxesPerPallet}</div></div>
                  <div></div>
                </div>
              </div>
              <div>
                <div style={{fontSize:8,color:"#333",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:4}}>GS1-128</div>
                {preview.gs1Line1 && <div style={{background:"#f8f8f8",borderRadius:4,padding:8,marginBottom:6,textAlign:"center"}}>
                  <div style={{fontSize:8,color:"#666",marginBottom:4}}>(02) GTIN + (15) Best Before + (17) Expiry + (10) Batch</div>
                  <img src={`/api/barcode?data=${encodeURIComponent(preview.gs1Line1)}&height=14`} alt="GS1 Line 1" style={{width:"90%",height:55}} />
                  <div style={{fontFamily:"monospace",fontSize:8,marginTop:2,color:"#444"}}>{preview.gs1Line1HR}</div>
                </div>}
                {preview.gs1Line2 && <div style={{background:"#f8f8f8",borderRadius:4,padding:8,marginBottom:6,textAlign:"center"}}>
                  <div style={{fontSize:8,color:"#666",marginBottom:4}}>(37) Boxes + (3102) Net Weight</div>
                  <img src={`/api/barcode?data=${encodeURIComponent(preview.gs1Line2)}&height=14`} alt="GS1 Line 2" style={{width:"90%",height:55}} />
                  <div style={{fontFamily:"monospace",fontSize:8,marginTop:2,color:"#444"}}>{preview.gs1Line2HR}</div>
                </div>}
                <div style={{borderTop:"2px solid #000",paddingTop:6,marginTop:6,background:"#f0f0f0",borderRadius:4,padding:8,textAlign:"center"}}>
                  <div style={{fontSize:8,color:"#666",marginBottom:4}}>(00) SSCC</div>
                  <img src={`/api/barcode?data=${encodeURIComponent(preview.gs1Line3)}&height=16`} alt="SSCC" style={{width:"90%",height:60}} />
                  <div style={{fontFamily:"monospace",fontSize:10,fontWeight:700,marginTop:2,letterSpacing:1}}>{preview.gs1Line3HR}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
