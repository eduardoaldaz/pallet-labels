from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Optional, List
from barcode.writer import ImageWriter
from PIL import Image
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from fpdf import FPDF
from bc_connector import get_orders_with_pallets, get_enriched_pallets, clear_cache
import os
import io
import barcode
import smtplib
import tempfile

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


def generate_barcode_image(data, width_mm=90, height_mm=20):
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


def save_barcode_temp(data, height=12):
    img_bytes = generate_barcode_image(data, height_mm=height)
    tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    tmp.write(img_bytes)
    tmp.close()
    return tmp.name


def fmt_date(v):
    if not v:
        return "--"
    s = str(v)
    if "T" in s:
        return s[:10]
    return s


def generate_pdf(pallets):
    pdf = FPDF('P', 'mm', 'A4')
    pdf.set_auto_page_break(auto=False)
    
    for p in pallets:
        pdf.add_page()
        pw = 190  # page width usable
        x0 = 10
        y = 10
        
        # Header
        pdf.set_font('Helvetica', 'B', 16)
        pdf.set_xy(x0, y)
        pdf.cell(pw/2, 8, 'GLOBAL FOOD LINK S.L.', 0, 0, 'L')
        pdf.set_font('Helvetica', 'B', 14)
        pdf.cell(pw/2, 8, str(p.get('externalDocNo') or p.get('salesOrderNo', '')), 0, 1, 'R')
        y += 10
        pdf.set_draw_color(0, 0, 0)
        pdf.line(x0, y, x0 + pw, y)
        y += 2
        
        # CUSTOMER
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_xy(x0, y)
        pdf.cell(pw, 5, 'CUSTOMER', 0, 1, 'L')
        y += 5
        pdf.set_draw_color(200, 200, 200)
        pdf.line(x0, y, x0 + pw, y)
        y += 1
        
        pdf.set_font('Helvetica', '', 7)
        pdf.set_text_color(130, 130, 130)
        pdf.set_xy(x0, y)
        pdf.cell(pw * 0.65, 3, 'NAME', 0, 0)
        pdf.cell(pw * 0.35, 3, 'COUNTRY', 0, 1)
        y += 3
        
        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Helvetica', 'B', 12)
        pdf.set_xy(x0, y)
        pdf.cell(pw * 0.65, 7, str(p.get('customerName', '')), 0, 0)
        pdf.set_font('Helvetica', 'B', 18)
        pdf.cell(pw * 0.35, 7, str(p.get('shipToCountry', '')), 0, 1)
        y += 9
        pdf.set_draw_color(200, 200, 200)
        pdf.line(x0, y, x0 + pw, y)
        y += 2
        
        # ITEM
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_xy(x0, y)
        pdf.cell(pw, 5, 'ITEM', 0, 1)
        y += 5
        pdf.line(x0, y, x0 + pw, y)
        y += 1
        
        col1 = pw * 0.2
        col2 = pw * 0.5
        col3 = pw * 0.3
        
        pdf.set_font('Helvetica', '', 7)
        pdf.set_text_color(130, 130, 130)
        pdf.set_xy(x0, y)
        pdf.cell(col1, 3, 'CODE', 0, 0)
        pdf.cell(col2, 3, 'DESCRIPTION', 0, 0)
        pdf.cell(col3, 3, 'ETIN/EAN', 0, 1)
        y += 3
        
        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Helvetica', 'B', 16)
        pdf.set_xy(x0, y)
        pdf.cell(col1, 7, str(p.get('itemRefNo') or p.get('itemNo', '')), 0, 0)
        pdf.set_font('Helvetica', 'B', 11)
        desc = str(p.get('itemDescription', ''))[:45]
        pdf.cell(col2, 7, desc, 0, 0)
        pdf.set_font('Helvetica', 'B', 10)
        pdf.cell(col3, 7, str(p.get('eanCode', '')), 0, 1)
        y += 9
        pdf.set_draw_color(200, 200, 200)
        pdf.line(x0, y, x0 + pw, y)
        y += 2
        
        # DETAILS
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_xy(x0, y)
        pdf.cell(pw, 5, 'DETAILS', 0, 1)
        y += 5
        pdf.line(x0, y, x0 + pw, y)
        y += 1
        
        dc = pw / 3
        # Row 1 labels
        pdf.set_font('Helvetica', '', 7)
        pdf.set_text_color(130, 130, 130)
        pdf.set_xy(x0, y)
        pdf.cell(dc, 3, 'SSCC', 0, 0)
        pdf.cell(dc, 3, 'BATCH', 0, 0)
        pdf.cell(dc, 3, 'BEST BEFORE', 0, 1)
        y += 3
        
        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Helvetica', 'B', 12)
        pdf.set_xy(x0, y)
        sscc = str(p.get('sscc', '--'))
        pdf.cell(dc, 7, sscc, 0, 0)
        pdf.set_font('Helvetica', 'B', 16)
        pdf.cell(dc, 7, str(p.get('lotNo', '')), 0, 0)
        pdf.cell(dc, 7, fmt_date(p.get('expirationDate')), 0, 1)
        y += 8
        
        # Row 2 labels
        pdf.set_font('Helvetica', '', 7)
        pdf.set_text_color(130, 130, 130)
        pdf.set_xy(x0, y)
        pdf.cell(dc, 3, 'NET WEIGHT', 0, 0)
        pdf.cell(dc, 3, 'BOXES', 0, 1)
        y += 3
        
        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Helvetica', 'B', 16)
        pdf.set_xy(x0, y)
        pdf.cell(dc, 7, f"{p.get('initQuantity', 0)} Kg", 0, 0)
        pdf.cell(dc, 7, str(p.get('boxesPerPallet', 0)), 0, 1)
        y += 9
        
        pdf.set_draw_color(0, 0, 0)
        pdf.line(x0, y, x0 + pw, y)
        y += 3
        
        # GS1-128 BARCODES
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_xy(x0, y)
        pdf.cell(pw, 5, 'GS1-128', 0, 1, 'C')
        y += 6
        
        bh1 = 18
        bh2 = 18
        bh3 = 22
        
        # Line 1
        gs1_1 = p.get('gs1Line1', '')
        if gs1_1:
            tmp1 = save_barcode_temp(gs1_1, height=12)
            pdf.image(tmp1, x=x0 + 10, y=y, w=pw - 20, h=bh1)
            os.unlink(tmp1)
            y += bh1 + 1
            pdf.set_font('Helvetica', '', 7)
            pdf.set_xy(x0, y)
            pdf.cell(pw, 4, str(p.get('gs1Line1HR', '')), 0, 1, 'C')
            y += 6
        
        # Line 2
        gs1_2 = p.get('gs1Line2', '')
        if gs1_2:
            tmp2 = save_barcode_temp(gs1_2, height=12)
            pdf.image(tmp2, x=x0 + 10, y=y, w=pw - 20, h=bh2)
            os.unlink(tmp2)
            y += bh2 + 1
            pdf.set_font('Helvetica', '', 7)
            pdf.set_xy(x0, y)
            pdf.cell(pw, 4, str(p.get('gs1Line2HR', '')), 0, 1, 'C')
            y += 6
        
        # Line 3 - SSCC
        pdf.set_draw_color(0, 0, 0)
        pdf.line(x0, y, x0 + pw, y)
        y += 2
        gs1_3 = p.get('gs1Line3', '')
        if gs1_3:
            tmp3 = save_barcode_temp(gs1_3, height=14)
            pdf.image(tmp3, x=x0 + 10, y=y, w=pw - 20, h=bh3)
            os.unlink(tmp3)
            y += bh3 + 1
            pdf.set_font('Helvetica', 'B', 9)
            pdf.set_xy(x0, y)
            pdf.cell(pw, 5, str(p.get('gs1Line3HR', '')), 0, 1, 'C')
    
    return pdf.output()


# ─── API Endpoints ───

@app.get("/api/barcode")
async def get_barcode(data: str, height: int = 20):
    try:
        img_bytes = generate_barcode_image(data, height_mm=height)
        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class PdfRequest(BaseModel):
    orderNo: str
    palletIds: Optional[List[int]] = None

@app.post("/api/generate-pdf")
async def gen_pdf(req: PdfRequest):
    try:
        pallets = get_enriched_pallets(req.orderNo)
        if req.palletIds:
            pallets = [p for p in pallets if p['id'] in req.palletIds]
        if not pallets:
            raise HTTPException(status_code=404, detail="No pallets found")
        pdf_bytes = bytes(generate_pdf(pallets))
        return Response(content=pdf_bytes, media_type="application/pdf",
                       headers={"Content-Disposition": f"attachment; filename=etiquetas_{req.orderNo}.pdf"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EmailRequest(BaseModel):
    orderNo: str
    palletIds: Optional[List[int]] = None

@app.post("/api/send-email")
async def send_email(req: EmailRequest):
    try:
        pallets = get_enriched_pallets(req.orderNo)
        if req.palletIds:
            pallets = [p for p in pallets if p['id'] in req.palletIds]
        if not pallets:
            raise HTTPException(status_code=404, detail="No pallets found")
        
        email_to = pallets[0].get('locationEmail', '')
        if not email_to:
            raise HTTPException(status_code=400, detail="No hay email configurado para el almacen")
        
        pdf_bytes = bytes(generate_pdf(pallets))
        ext_doc = pallets[0].get('externalDocNo') or req.orderNo
        customer = pallets[0].get('customerName', '')
        
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM
        msg['To'] = email_to
        msg['Subject'] = f"Etiquetas Palet - {ext_doc} - {customer}"
        
        body = f"Buen día. \nSe adjuntan etiquetas de palet para el pedido {ext_doc} del cliente {customer}.\n\nTotal pallets: {len(pallets)} \n\nSaludos Cordiales. \nGlobal Food Link SL"
        msg.attach(MIMEText(body, 'plain'))
        
        attachment = MIMEBase('application', 'pdf')
        attachment.set_payload(pdf_bytes)
        encoders.encode_base64(attachment)
        attachment.add_header('Content-Disposition', f'attachment; filename="etiquetas_{ext_doc}.pdf"')
        msg.attach(attachment)
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        return {"status": "ok", "message": f"Email con Email enviado a {email_to}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
