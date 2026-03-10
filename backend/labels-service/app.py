from fastapi import FastAPI, Response, HTTPException
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4, mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import code128
from reportlab.lib.units import mm
from io import BytesIO
from datetime import datetime

from templates import template_simple, template_clienteA

TEMPLATES = {
    "simple": template_simple,
    "clienteA": template_clienteA
}


app = FastAPI(title="Label Service", version="0.1.0")

class LabelRequest(BaseModel):
    # ⬇️ Este es el "contrato" de lo que esperamos recibir (desde BC o Power Automate)
    template: str = "simple"
    itemNo: str
    description: str | None = None
    serialNo: str | None = None
    lotNo: str | None = None
    expDate: str | None = None  # "YYYY-MM-DD"
    qty: int = 1
    # Este valor es el que se codifica en Code128 (puede ser serial, SKU, o "SKU|Serial")
    barcodeValue: str
    # Tamaño físico de la etiqueta en milímetros (configurable)
    labelWidthMm: float = 80
    labelHeightMm: float = 50

def render_single_label(c: canvas.Canvas, x, y, w, h, data: LabelRequest, index: int):
    # Margen interno
    margin = 4 * mm
    # Coordenadas de texto superior
    text_x = x + margin
    text_y = y + h - margin

    # Título: ItemNo
    c.setFont("Helvetica-Bold", 10)
    c.drawString(text_x, text_y, f"{data.itemNo}")

    # Descripción (si viene)
    c.setFont("Helvetica", 9)
    if data.description:
        c.drawString(text_x, text_y - 12, data.description[:48])

    # Campos secundarios en líneas abajo
    line = 24
    if data.serialNo:
        c.drawString(text_x, text_y - line,    f"Serial: {data.serialNo}")
        line += 12
    if data.lotNo:
        c.drawString(text_x, text_y - line,    f"Lote: {data.lotNo}")
        line += 12
    if data.expDate:
        c.drawString(text_x, text_y - line,    f"Cad: {data.expDate}")
        line += 12

    # Código de barras Code128
    barcode = code128.Code128(data.barcodeValue, barHeight=18*mm, barWidth=0.28)
    bw = barcode.width
    bx = x + (w - bw) / 2
    by = y + 8*mm
    barcode.drawOn(c, bx, by)

    # Texto debajo del código de barras
    c.setFont("Helvetica", 8)
    c.drawCentredString(x + w/2, by - 10, data.barcodeValue)

    # Borde de la etiqueta (útil para pruebas visuales)
    c.setLineWidth(0.5)
    c.rect(x, y, w, h)

@app.post("/label/generate")
def generate_label(req: LabelRequest):
    # Convertimos mm a puntos (unidad del PDF)
    label_w = req.labelWidthMm * mm
    label_h = req.labelHeightMm * mm

    # Pagina A4 en modo rejilla de etiquetas iguales
    page_w, page_h = A4
    cols = max(1, int(page_w // label_w))
    rows = max(1, int(page_h // label_h))

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    remaining = req.qty
    i = 0

    while remaining > 0:
        for r in range(rows):
            for col in range(cols):
                if remaining == 0:
                    break
                x = col * label_w
                y = page_h - (r+1) * label_h

                # Seleccionar plantilla a partir del request
                template = TEMPLATES.get(req.template)
                if not template:
                    raise HTTPException(status_code=400, detail=f"Plantilla '{req.template}' no encontrada")

                # Dibujar etiqueta usando la plantilla seleccionada
                template.render(c, req.dict(), x, y, label_w, label_h)

                i += 1
                remaining -= 1
            if remaining == 0:
                break
        if remaining > 0:
            c.showPage()

    c.setAuthor("Label Service")
    c.setTitle(f"Labels_{req.itemNo}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()

    headers = {
        "Content-Disposition": f'attachment; filename="labels_{req.itemNo}.pdf"'
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)