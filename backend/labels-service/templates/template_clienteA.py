# templates/template_clienteA.py
from reportlab.lib.units import mm
from reportlab.graphics.barcode import code128, eanbc, createBarcodeDrawing

def _draw_label_header(c, data):
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20*mm, 270*mm, "Sender:")
    c.setFont("Helvetica", 10)
    c.drawString(20*mm, 260*mm, data.get("sender", ""))

    c.setFont("Helvetica-Bold", 12)
    c.drawString(110*mm, 270*mm, "Recipient:")
    c.setFont("Helvetica", 10)
    c.drawString(110*mm, 260*mm, data.get("recipient", ""))

def _draw_labeled_text(c, label, value, x_lbl_mm, y_lbl_mm, x_val_mm=None, y_val_mm=None):
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x_lbl_mm*mm, y_lbl_mm*mm, label)
    c.setFont("Helvetica", 12)
    c.drawString((x_val_mm if x_val_mm is not None else x_lbl_mm)*mm,
                 (y_val_mm if y_val_mm is not None else (y_lbl_mm-10))*mm,
                 value or "")

def _safe_draw_ean_or_gtin(c, ean_text: str, x_mm: float, y_mm: float):
    """
    Admite:
      - 12 dígitos: EAN-13 (ReportLab calcula checksum)
      - 13 dígitos: probamos truncar a 12 (algunas versiones lo exigen)
      - 14 dígitos: GTIN-14 -> ITF-14 (via createBarcodeDrawing)
      - Otro: fallback a Code128
    """
    if not ean_text:
        return

    digits = ''.join(ch for ch in ean_text if ch.isdigit())
    try:
        if len(digits) == 12:
            ean = eanbc.Ean13(digits)
            ean.drawOn(c, x_mm*mm, y_mm*mm)
            return
        elif len(digits) == 13:
            # Algunas builds aceptan 13, otras solo 12; probamos 12
            try:
                ean = eanbc.Ean13(digits[:12])
                ean.drawOn(c, x_mm*mm, y_mm*mm)
                return
            except Exception:
                # fallback Code128
                code128.Code128(digits).drawOn(c, x_mm*mm, y_mm*mm)
                return
        elif len(digits) == 14:
            # GTIN-14 como ITF-14 usando factory (no dependemos del submódulo itf)
            try:
                itf14 = createBarcodeDrawing(
                    'ITF14',
                    value=digits,
                    barWidth=0.5*mm,     # ajusta grosor si hace falta
                    barHeight=20*mm,     # altura del código
                    humanReadable=True   # imprime el texto bajo el código
                )
                itf14.drawOn(c, x_mm*mm, y_mm*mm)
                return
            except Exception:
                # fallback por si la fuente no lo soporta
                code128.Code128(digits).drawOn(c, x_mm*mm, y_mm*mm)
                return
        else:
            # Fallback Code128
            code128.Code128(digits).drawOn(c, x_mm*mm, y_mm*mm)
            return
    except Exception:
        # Fallback de seguridad
        code128.Code128(digits or ean_text).drawOn(c, x_mm*mm, y_mm*mm)

def _safe_draw_sscc(c, sscc_text: str, x_mm: float, y_mm: float):
    """
    SSCC estándar = 18 dígitos (AI 00). 
    Usamos Code128 como representación GS1-128 visual (suficiente para impresión).
    """
    if not sscc_text:
        return
    digits = ''.join(ch for ch in sscc_text if ch.isdigit())
    try:
        code128.Code128(digits or sscc_text).drawOn(c, x_mm*mm, y_mm*mm)
    except Exception:
        code128.Code128(sscc_text).drawOn(c, x_mm*mm, y_mm*mm)

def render(c, data: dict, x, y, w, h):
    """
    data esperado:
      sender, recipient, sscc, ean, itemNo, orderNo, batch, quantity, bestBefore, gs1/barcodeValue
    """
    # Encabezados
    _draw_label_header(c, data)

    # SSCC como texto
    _draw_labeled_text(c, "SSCC", data.get("sscc", ""), 20, 240, 20, 230)

    # EAN / GTIN (izquierda)
    _safe_draw_ean_or_gtin(c, data.get("ean", ""), 20, 200)

    # Campos centrales
    _draw_labeled_text(c, "Item No.", data.get("itemNo", ""), 20, 180, 20, 170)
    _draw_labeled_text(c, "Batch", data.get("batch", ""), 110, 180, 110, 170)
    _draw_labeled_text(c, "Order No", data.get("orderNo", ""), 20, 155, 20, 145)
    _draw_labeled_text(c, "Quantity", str(data.get("quantity", "")), 110, 155, 110, 145)
    _draw_labeled_text(c, "Best Before", data.get("bestBefore", ""), 20, 130, 20, 120)

    # GS1-128 grande abajo (usamos Code128 con la cadena GS1)
    gs1_text = data.get("gs1") or data.get("barcodeValue") or ""
    if gs1_text:
        try:
            code128.Code128(gs1_text, barHeight=25*mm, barWidth=0.4).drawOn(c, 20*mm, 40*mm)
        except Exception:
            c.setFont("Helvetica", 10)
            c.drawString(20*mm, 40*mm, gs1_text)

