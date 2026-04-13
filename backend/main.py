from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Optional
from barcode.writer import ImageWriter
from PIL import Image
from bc_connector import get_orders_with_pallets, get_enriched_pallets, clear_cache
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
import io
import barcode
import smtplib

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.office365.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "")

app = FastAPI(title="Pallet Label Service", version="1.0.0")

# CORS - permite conexiones del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_barcode_image(data: str, width_mm: int = 90, height_mm: int = 20):
    """Genera imagen PNG de codigo de barras Code128"""
    Code128 = barcode.get_barcode_class('code128')
    writer = ImageWriter()
    writer.set_options({
        'module_width': 0.25,
        'module_height': height_mm,
        'quiet_zone': 2,
        'text_distance': 2,
        'font_size': 8,
        'dpi': 200,
    })
    code = Code128(data, writer=writer)
    buffer = io.BytesIO()
    code.write(buffer, options={'write_text': False})
    buffer.seek(0)
    return buffer.getvalue()


# ─── API Endpoints ───

@app.get("/api/barcode")
async def get_barcode(data: str, height: int = 20):
    """Genera imagen de codigo de barras Code128 para GS1-128"""
    try:
        img_bytes = generate_barcode_image(data, height_mm=height)
        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error generando codigo de barras: {str(e)}")

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
    try:
        orders = get_orders_with_pallets()
        order = next((o for o in orders if o["orderNo"] == order_no), None)
        if not order:
            raise HTTPException(status_code=404, detail=f"Pedido {order_no} no encontrado")
        # Load pallets on demand
        order["pallets"] = get_enriched_pallets(order_no)
        order["itemCount"] = len(set(p["itemNo"] for p in order["pallets"]))
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

class EmailRequest(BaseModel):
    to: str
    subject: str
    html: str

@app.post("/api/send-email")
async def send_email(req: EmailRequest):
    """Send label by email"""
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_FROM
        msg['To'] = req.to
        msg['Subject'] = req.subject
        msg.attach(MIMEText(req.html, 'html'))
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        return {"status": "ok", "message": f"Email enviado a {req.to}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando email: {str(e)}")

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
