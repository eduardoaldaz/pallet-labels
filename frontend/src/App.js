import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Stack,
  Drawer,
  Checkbox,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PdfIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

// ----- CONSTANTES Y FUNCIONES AUXILIARES (se mantienen igual) -----
const API = "/api";
const fmtDate = (v) => {
  if (!v) return "\u2014";
  if (typeof v === "string" && v.includes("T")) return new Date(v).toLocaleDateString("es-ES");
  if (typeof v === "number") return new Date((v - 25569) * 86400000).toLocaleDateString("es-ES");
  return String(v);
};
// ----- FIN AUXILIARES -----

function App() {
  // ----- TODOS LOS ESTADOS Y FUNCIONES SE MANTIENEN IGUAL -----
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selOrder, setSelOrder] = useState(null);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState("");
  const [selPallets, setSelPallets] = useState(new Set());
  const [sortBy, setSortBy] = useState('orderNo');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderParam = params.get('order');
    if (orderParam && data && !selOrder) {
      setSelOrder(orderParam);
      setSelPallets(new Set());
      setPreview(null);
      fetch(`${API}/orders/${orderParam}`)
        .then(res => res.json())
        .then(orderData => {
          setData(prev => ({...prev, orders: prev.orders.map(x => x.orderNo === orderParam ? orderData : x)}));
        });
    }
  }, [data]);

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
      <div style="text-align:right"><div style="font-size:18px;font-weight:700">${p.externalDocNo||p.salesOrderNo}</div></div></div>
      <div class="sec"><div class="st">Customer</div><div class="row"><div class="f" style="flex:2"><div class="fl">Name</div><div class="fv">${p.customerName}</div></div><div class="f"><div class="fl">Country</div><div class="fv big">${p.shipToCountry}</div></div></div></div>
      <div class="sec"><div class="st">Item</div><div class="row"><div class="f"><div class="fl">Supplier's Code</div><div class="fv big">${p.itemRefNo||p.itemNo}</div></div><div class="f" style="flex:2"><div class="fl">Description</div><div class="fv">${p.itemDescription||""}</div></div><div class="f"><div class="fl">ETIN/EAN</div><div class="fv" style="font-size:13px">${p.eanCode||"--"}</div></div></div></div>
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
      html += `<div class="lbl"><div class="hdr"><div><div style="font-size:18px;font-weight:800">GLOBAL FOOD LINK S.L.</div></div><div style="text-align:right"><div style="font-size:18px;font-weight:700">${p.externalDocNo||p.salesOrderNo}</div></div></div><div class="sec"><div class="st">Customer</div><div class="row"><div class="f" style="flex:2"><div class="fl">Name</div><div class="fv">${p.customerName}</div></div><div class="f"><div class="fl">Country</div><div class="fv big">${p.shipToCountry}</div></div></div></div><div class="sec"><div class="st">Item</div><div class="row"><div class="f"><div class="fl">Supplier's Code</div><div class="fv big">${p.itemRefNo||p.itemNo}</div></div><div class="f" style="flex:2"><div class="fl">Description</div><div class="fv">${p.itemDescription||""}</div></div><div class="f"><div class="fl">ETIN/EAN</div><div class="fv" style="font-size:13px">${p.eanCode||"--"}</div></div></div></div><div class="sec"><div class="st">Details</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><div class="fl">SSCC</div><div class="fv big">${p.sscc||"--"}</div></div><div><div class="fl">Batch</div><div class="fv big">${p.lotNo}</div></div><div><div class="fl">Best Before</div><div class="fv big">${fmtDate(p.expirationDate)}</div></div><div><div class="fl">Net Weight</div><div class="fv big">${p.initQuantity} Kg</div></div><div><div class="fl">Boxes</div><div class="fv big">${p.boxesPerPallet}</div></div><div></div></div></div><div style="border-top:2px solid #000;padding-top:8px;margin-top:12px"><div class="st" style="text-align:center">GS1-128</div>${p.gs1Line1?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line1)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line1HR}</div></div>`:""} ${p.gs1Line2?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line2)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line2HR}</div></div>`:""}<div style="border-top:2px solid #000;padding-top:8px;margin-top:8px;text-align:center"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line3)}&height=16" style="width:90%;height:85px"/><div style="font-family:monospace;font-size:11px;font-weight:bold;margin-top:2px">${p.gs1Line3HR}</div></div></div></div>`;
    });
    html += "</body></html>"; w.document.write(html); w.document.close(); setTimeout(() => w.print(), 1500);
  };

  const generateLabelHTML = (p) => {
    return `<!DOCTYPE html><html><head><style>
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
      <div class="sec"><div class="st">Item</div><div class="row"><div class="f"><div class="fl">Supplier's Code</div><div class="fv big">${p.itemRefNo||p.itemNo}</div></div><div class="f" style="flex:2"><div class="fl">Description</div><div class="fv">${p.itemDescription||""}</div></div><div class="f"><div class="fl">ETIN/EAN</div><div class="fv" style="font-size:12px">${p.eanCode||"--"}</div></div></div></div>
      <div class="sec"><div class="st">Details</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><div class="fl">SSCC</div><div class="fv big">${p.sscc||"--"}</div></div><div><div class="fl">Batch</div><div class="fv big">${p.lotNo}</div></div><div><div class="fl">Best Before</div><div class="fv big">${fmtDate(p.expirationDate)}</div></div><div><div class="fl">Net Weight</div><div class="fv big">${p.initQuantity} Kg</div></div><div><div class="fl">Boxes</div><div class="fv big">${p.boxesPerPallet}</div></div><div></div></div></div>
      <div style="border-top:2px solid #000;padding-top:8px;margin-top:12px">
        <div class="st" style="text-align:center">GS1-128</div>
        ${p.gs1Line1?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line1)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line1HR}</div></div>`:""}
        ${p.gs1Line2?`<div style="text-align:center;margin:8px 0"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line2)}&height=14" style="width:90%;height:75px"/><div style="font-family:monospace;font-size:9px;margin-top:2px">${p.gs1Line2HR}</div></div>`:""}
        <div style="border-top:2px solid #000;padding-top:8px;margin-top:8px;text-align:center"><img src="${window.location.origin}/api/barcode?data=${encodeURIComponent(p.gs1Line3)}&height=16" style="width:90%;height:85px"/><div style="font-family:monospace;font-size:11px;font-weight:bold;margin-top:2px">${p.gs1Line3HR}</div></div>
      </div></div></body></html>`;
  };

  const downloadLabels = async () => {
    if (!selOrder) return;
    const order = data.orders.find(o => o.orderNo === selOrder);
    if (!order) return;
    const palletIds = selPallets.size > 0 ? Array.from(selPallets) : null;
    try {
      const res = await fetch(`${API}/generate-pdf`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ orderNo: selOrder, palletIds: palletIds })
      });
      if (!res.ok) { alert("Error generando PDF"); return; }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(new Blob([blob], {type: 'application/pdf'}));
      link.download = `etiquetas_${selOrder}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) { alert("Error: " + err.message); }
  };

  const sendEmail = async () => {
    if (!data || !selOrder) return;
    const order = data.orders.find(o => o.orderNo === selOrder);
    if (!order || !order.pallets.length) return;
    const email = order.pallets[0].locationEmail;
    if (!email) { alert("No hay email configurado para el almacen de este pedido"); return; }
    if (!window.confirm(`Enviar etiquetas PDF a: ${email}?`)) return;
    const palletIds = selPallets.size > 0 ? Array.from(selPallets) : null;
    try {
      const res = await fetch(`${API}/send-email`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ orderNo: selOrder, palletIds })
      });
      const result = await res.json();
      if (res.ok) { alert(`Email enviado a ${email}`); }
      else { alert(`Error: ${result.detail}`); }
    } catch (err) { alert("Error: " + err.message); }
  };
  // ----- FIN DE FUNCIONES (NO TOCAR) -----

  // Función de ordenación
  const handleSort = (field) => {
    const isAsc = sortBy === field && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortBy(field);
  };

  // Función para obtener los pedidos filtrados y ordenados
  const getSortedOrders = () => {
    let list = data.orders.filter(o =>
      !search || o.orderNo.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy) {
      list.sort((a, b) => {
        const aVal = a[sortBy] || '';
        const bVal = b[sortBy] || '';
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  };

  // ----- RENDERIZADO: LOADING -----
  if (loading) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#ffffff' }}>
      <CircularProgress sx={{ color: '#00B7C3' }} />
      <Typography variant="h6" sx={{ mt: 2, color: '#212121' }}></Typography>
      <Typography variant="body2" color="textSecondary">Getting ready...</Typography>
    </Box>
  );

  // ----- RENDERIZADO: ERROR -----
  if (error) return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: '#ffffff', p: 3 }}>
      <Alert severity="error" sx={{ mb: 2 }}>Error de conexión</Alert>
      <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      <Button variant="contained" color="primary" onClick={loadData}>Reintentar</Button>
    </Box>
  );

  if (!data) return null;

  // ----- VISTA: LISTA DE PEDIDOS (cuando no hay pedido seleccionado) -----
  if (!selOrder) {
    const list = getSortedOrders();

    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f3f2f1' }}>
        {/* Header con color primario (turquesa) */}
		<Paper elevation={0} sx={{ p: 2, bgcolor: '#2c2c2c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0 }}>          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Etiquetas de Palet</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>Pedidos de venta abiertos - Datos en tiempo real de BC</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label={`${data.totalOrders} pedidos`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
            <Chip label={`${data.totalPallets} pallets`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
            <IconButton size="small" sx={{ color: 'white' }} onClick={refresh}><RefreshIcon /></IconButton>
          </Stack>
        </Paper>

        {/* Barra de búsqueda */}
        <Box sx={{ p: 2, bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Buscar pedido o cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ bgcolor: '#faf9f8' }}
          />
        </Box>

        {/* Tabla de pedidos con ordenación */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <TableContainer component={Paper} sx={{ borderRadius: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'orderNo'}
                      direction={sortBy === 'orderNo' ? sortDirection : 'asc'}
                      onClick={() => handleSort('orderNo')}
                    >
                      Nº Pedido
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'customerName'}
                      direction={sortBy === 'customerName' ? sortDirection : 'asc'}
                      onClick={() => handleSort('customerName')}
                    >
                      Cliente
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'shipToCountry'}
                      direction={sortBy === 'shipToCountry' ? sortDirection : 'asc'}
                      onClick={() => handleSort('shipToCountry')}
                    >
                      País
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'shipmentDate'}
                      direction={sortBy === 'shipmentDate' ? sortDirection : 'asc'}
                      onClick={() => handleSort('shipmentDate')}
                    >
                      Fecha
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'itemCount'}
                      direction={sortBy === 'itemCount' ? sortDirection : 'asc'}
                      onClick={() => handleSort('itemCount')}
                    >
                      Artículos
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'palletCount'}
                      direction={sortBy === 'palletCount' ? sortDirection : 'asc'}
                      onClick={() => handleSort('palletCount')}
                    >
                      Pallets
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((o) => (
                  <TableRow
                    key={o.orderNo}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={async () => {
                      setSelOrder(o.orderNo);
                      setSelPallets(new Set());
                      setPreview(null);
                      const res = await fetch(`${API}/orders/${o.orderNo}`);
                      const orderData = await res.json();
                      setData(prev => ({ ...prev, orders: prev.orders.map(x => x.orderNo === o.orderNo ? orderData : x) }));
                    }}
                  >
                    <TableCell><Typography color="primary">{o.orderNo}</Typography></TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell>{o.shipToCountry || '--'}</TableCell>
                    <TableCell>{fmtDate(o.shipmentDate)}</TableCell>
                    <TableCell>{o.itemCount || '--'}</TableCell>
                    <TableCell><Chip label={`${o.palletCount || o.pallets.length}`} size="small" color="primary" /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver pedido">
                        <IconButton size="small" color="primary"><VisibilityIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Box>
    );
  }

  // ----- VISTA: DETALLE DE PEDIDO (cuando selOrder está definido) -----
  const selectedOrder = data.orders.find(o => o.orderNo === selOrder);
  if (!selectedOrder) return null;

  const items = {};
  selectedOrder.pallets.forEach(p => {
    if (!items[p.itemNo]) items[p.itemNo] = { info: p, list: [] };
    items[p.itemNo].list.push(p);
  });
  const toggleSel = id => setSelPallets(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => { const all = selectedOrder.pallets.map(p => p.id); setSelPallets(prev => prev.size === all.length ? new Set() : new Set(all)); };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f3f2f1' }}>
      {/* Header detalle */}
		<Paper elevation={0} sx={{ p: 2, bgcolor: '#2c2c2c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0 }}>        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton sx={{ color: 'white' }} onClick={() => { setSelOrder(null); setPreview(null); }}><ArrowBackIcon /></IconButton>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>{selectedOrder.orderNo}</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>{selectedOrder.customerName}</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={toggleAll} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}>
            {selPallets.size === selectedOrder.pallets.length ? 'Deseleccionar' : 'Seleccionar todo'}
          </Button>
          <Button variant="contained" size="small" onClick={downloadLabels} sx={{ bgcolor: '#d13438', color: 'white' }}>
			<PdfIcon fontSize="small" sx={{ mr: 0.5 }} /> PDF
		  </Button>
          <Button variant="contained" size="small" onClick={sendEmail} sx={{ bgcolor: '#35AB22', color: 'white' }}>
            <EmailIcon fontSize="small" sx={{ mr: 0.5 }} /> Email
          </Button>
        </Stack>
      </Paper>

      {/* Cuerpo: pallets + preview drawer */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Lista de pallets */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
            <Chip label={`Pallets: ${selectedOrder.pallets.length}`} color="primary" />
            <Chip label={`Artículos: ${Object.keys(items).length}`} color="success" />
            <Chip label={`País: ${selectedOrder.shipToCountry || '--'}`} color="warning" />
            <Chip label={`Envío: ${fmtDate(selectedOrder.shipmentDate)}`} />
          </Stack>

          {Object.entries(items).map(([no, g]) => (
            <Box key={no} sx={{ mb: 2 }}>
              <Paper sx={{ p: 1, bgcolor: '#e6e8ea', mb: 1 }}>
                <Typography variant="subtitle2"><strong>{no}</strong> - {g.info.itemDescription} <Chip label={`${g.list.length} pallets`} size="small" /></Typography>
              </Paper>
              <TableContainer component={Paper} sx={{ borderRadius: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width={40}><Checkbox checked={selPallets.size === selectedOrder.pallets.length} onChange={toggleAll} /></TableCell>
                      <TableCell>Pallet</TableCell>
                      <TableCell>Lote</TableCell>
                      <TableCell>Caducidad</TableCell>
                      <TableCell>Peso (Kg)</TableCell>
                      <TableCell>Cajas</TableCell>
                      <TableCell align="right">Vista previa</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {g.list.map(p => {
                      const sel = selPallets.has(p.id);
                      return (
                        <TableRow key={p.id} hover selected={preview?.id === p.id}>
                          <TableCell><Checkbox checked={sel} onChange={() => toggleSel(p.id)} /></TableCell>
                          <TableCell>{p.internalPalletNo}</TableCell>
                          <TableCell>{p.lotNo}</TableCell>
                          <TableCell>{fmtDate(p.expirationDate)}</TableCell>
                          <TableCell>{p.initQuantity}</TableCell>
                          <TableCell>{p.boxesPerPallet}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Vista previa">
                              <IconButton size="small" color="primary" onClick={() => setPreview(p)}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Box>

        {/* Drawer de preview con animación */}
        <Drawer
          anchor="right"
          open={!!preview}
          onClose={() => setPreview(null)}
          variant="persistent"
          sx={{
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: { xs: '100%', sm: '50%', md: '40%' }, boxSizing: 'border-box', p: 2, bgcolor: '#ffffff' },
          }}
        >
          {preview && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Vista previa</Typography>
                <IconButton onClick={() => setPreview(null)}><ArrowBackIcon /></IconButton>
              </Box>
              <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, boxShadow: 1 }}>
                <div dangerouslySetInnerHTML={{ __html: generateLabelHTML(preview) }} />
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button variant="contained" color="primary" size="small" onClick={() => printLabel(preview)}><PrintIcon fontSize="small" sx={{ mr: 0.5 }} /> Imprimir</Button>
                  <Button variant="outlined" size="small" onClick={async () => {
                    if (!preview) return;
                    const res = await fetch(`${API}/generate-pdf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNo: selOrder, palletIds: [preview.id] }) });
                    if (res.ok) { const blob = await res.blob(); const link = document.createElement('a'); link.href = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })); link.download = `etiqueta_${preview.internalPalletNo}.pdf`; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
                    else alert("Error generando PDF");
                  }}><PdfIcon fontSize="small" sx={{ mr: 0.5 }} /> Descargar PDF</Button>
                </Box>
              </Box>
            </>
          )}
        </Drawer>
      </Box>
    </Box>
  );
}

export default App;