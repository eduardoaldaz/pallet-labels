
from reportlab.graphics.barcode import code128
from reportlab.lib.units import mm

def render(c, data, x, y, w, h):
    margin = 4 * mm

    # Título
    text_x = x + margin
    text_y = y + h - margin

    c.setFont("Helvetica-Bold", 10)
    c.drawString(text_x, text_y, data["itemNo"])

    c.setFont("Helvetica", 9)
    if data.get("description"):
        c.drawString(text_x, text_y - 12, data["description"])

    # Campos secundarios
    line = 24
    if data.get("serialNo"):
        c.drawString(text_x, text_y - line, f"Serial: {data['serialNo']}")
        line += 12
    if data.get("lotNo"):
        c.drawString(text_x, text_y - line, f"Lote: {data['lotNo']}")
        line += 12
    if data.get("expDate"):
        c.drawString(text_x, text_y - line, f"Caducidad: {data['expDate']}")
        line += 12

    # Código de barras
    barcode = code128.Code128(data["barcodeValue"], barHeight=18*mm, barWidth=0.28)
    bx = x + (w - barcode.width) / 2
    by = y + 8 * mm
    barcode.drawOn(c, bx, by)

    # Texto bajo el código
    c.setFont("Helvetica", 8)
    c.drawCentredString(x + w/2, by - 10, data["barcodeValue"])

    # Borde de la etiqueta (solo para pruebas)
    c.setLineWidth(0.5)
    c.rect(x, y, w, h)
