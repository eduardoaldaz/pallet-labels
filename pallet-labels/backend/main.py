from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import os

from bc_connector import get_orders_with_pallets, get_enriched_pallets, clear_cache

app = FastAPI(title="Pallet Label Service", version="1.0.0")

# CORS - permite conexiones del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── API Endpoints ───

@app.get("/api/orders")
async def get_orders():
    """Retorna todos los pedidos de venta abiertos con sus pallets"""
    try:
        orders = get_orders_with_pallets()
        total_pallets = sum(len(o["pallets"]) for o in orders)
        return {
            "orders": orders,
            "totalOrders": len(orders),
            "totalPallets": total_pallets,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error conectando con BC: {str(e)}")


@app.get("/api/orders/{order_no}")
async def get_order(order_no: str):
    """Retorna un pedido especifico con sus pallets"""
    try:
        orders = get_orders_with_pallets()
        order = next((o for o in orders if o["orderNo"] == order_no), None)
        if not order:
            raise HTTPException(status_code=404, detail=f"Pedido {order_no} no encontrado")
        return order
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pallets")
async def get_pallets(order_no: Optional[str] = None):
    """Retorna pallets, opcionalmente filtrados por pedido"""
    try:
        pallets = get_enriched_pallets()
        if order_no:
            pallets = [p for p in pallets if p["salesOrderNo"] == order_no]
        return {"pallets": pallets, "total": len(pallets)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refresh")
async def refresh_data():
    """Limpia la cache y recarga datos de BC"""
    clear_cache()
    return {"message": "Cache limpiada. Los datos se recargan en la proxima consulta."}


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "pallet-labels"}


# ─── Servir el frontend (React build) ───
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React app for all non-API routes"""
        file_path = os.path.join(frontend_path, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))
