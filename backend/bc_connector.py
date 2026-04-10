import os
import requests
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

BC_BASE_URL = os.getenv("BC_ODATA_URL", "https://api.businesscentral.dynamics.com/v2.0/7bd617d8-1150-4669-b1fe-3fddd532dd57/Production/ODataV4/Company('Global%20Food%20Link%20S.L')")

# OAuth2 Client Credentials
BC_TENANT_ID = os.getenv("BC_TENANT_ID", "")
BC_CLIENT_ID = os.getenv("BC_CLIENT_ID", "")
BC_CLIENT_SECRET = os.getenv("BC_CLIENT_SECRET", "")
BC_AUTHORITY = f"https://login.microsoftonline.com/{BC_TENANT_ID}/oauth2/v2.0/token"
BC_SCOPE = "https://api.businesscentral.dynamics.com/.default"

# Nombres de los Web Services publicados en BC
WS_PALLETS = os.getenv("WS_PALLETS", "Lista_Palets_Excel")
WS_SALES_HEADER = os.getenv("WS_SALES_HEADER", "Pedido_venta_Excel")
WS_SALES_LINE = os.getenv("WS_SALES_LINE", "SalesLinesPV")
WS_ITEM_UOM = os.getenv("WS_ITEM_UOM", "Unidades_medida_producto_Excel")
WS_ITEM_REF = os.getenv("WS_ITEM_REF", "Movs_ref_art__Excel")

# GS1 - para generar SSCC
GS1_PREFIX = os.getenv("GS1_PREFIX", "8495390")
SSCC_EXTENSION_DIGIT = os.getenv("SSCC_EXTENSION_DIGIT", "0")

# Cache
CACHE_DURATION = int(os.getenv("CACHE_MINUTES", "5"))
_cache = {}
_cache_time = {}

# Token cache
_token = None
_token_expiry = None


def _get_token():
    """Obtener token OAuth2 usando Client Credentials Flow"""
    global _token, _token_expiry
    
    # Reusar token si aun es valido
    if _token and _token_expiry and datetime.now() < _token_expiry:
        return _token
    
    try:
        response = requests.post(BC_AUTHORITY, data={
            "grant_type": "client_credentials",
            "client_id": BC_CLIENT_ID,
            "client_secret": BC_CLIENT_SECRET,
            "scope": BC_SCOPE,
        })
        response.raise_for_status()
        data = response.json()
        _token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        _token_expiry = datetime.now() + timedelta(seconds=expires_in - 60)
        print(f"Token OAuth2 obtenido, expira en {expires_in}s")
        return _token
    except Exception as e:
        print(f"Error obteniendo token OAuth2: {e}")
        raise


def _get_headers():
    token = _get_token()
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


def generate_sscc(pallet_id):
    """
    Genera un SSCC (Serial Shipping Container Code) de 18 digitos.
    Estructura: Extension(1) + GS1 Prefix(7) + Serial(9) + Check(1)
    El serial se basa en el Id del palet para que sea unico y reproducible.
    """
    ext = str(SSCC_EXTENSION_DIGIT)[:1]
    prefix = str(GS1_PREFIX)
    
    # Serial: usar el pallet_id, rellenar con ceros hasta 9 digitos
    serial_length = 17 - len(ext) - len(prefix)
    serial = str(pallet_id).zfill(serial_length)[-serial_length:]
    
    # 17 digitos sin check digit
    sscc_without_check = f"{ext}{prefix}{serial}"
    
    # Calcular digito de control (Modulo 10 GS1)
    total = 0
    for i, digit in enumerate(sscc_without_check):
        weight = 3 if i % 2 == 0 else 1
        total += int(digit) * weight
    check_digit = (10 - (total % 10)) % 10
    
    return f"{sscc_without_check}{check_digit}"


def _fetch_odata(endpoint, params=None):
    """Fetch all pages from BC OData endpoint"""
    cache_key = f"{endpoint}_{str(params)}"
    
    # Check cache
    if cache_key in _cache and cache_key in _cache_time:
        if datetime.now() - _cache_time[cache_key] < timedelta(minutes=CACHE_DURATION):
            return _cache[cache_key]
    
    url = f"{BC_BASE_URL}/{endpoint}"
    all_records = []
    
    while url:
        try:
            response = requests.get(
                url,
                headers=_get_headers(),
                params=params,
                timeout=300
            )
            response.raise_for_status()
            data = response.json()
            records = data.get("value", [])
            all_records.extend(records)
            
            # Pagination
            url = data.get("@odata.nextLink", None)
            params = None  # nextLink already includes params
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {endpoint}: {e}")
            break
    
    # Update cache
    _cache[cache_key] = all_records
    _cache_time[cache_key] = datetime.now()
    
    return all_records


def clear_cache():
    """Clear all cached data"""
    _cache.clear()
    _cache_time.clear()


def fetch_pallets(sales_order_no=None):
    """Fetch AIT Pallets - filtered by specific order"""
    if sales_order_no:
        today = datetime.now().strftime("%Y-%m-%d")
        records = _fetch_odata(WS_PALLETS, params={
            "$filter": f"Sales_Order_No eq '{sales_order_no}' and Expiration_date ge {today}"
        })
        return records
    return []


def fetch_sales_headers():
    """Fetch open Sales Orders - last 2 months only"""
    two_months_ago = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d")
    return _fetch_odata(WS_SALES_HEADER, params={"$filter": f"Order_Date ge {two_months_ago}"})


def fetch_sales_lines():
    """Fetch Sales Lines for open orders"""
    return _fetch_odata(WS_SALES_LINE)


def fetch_item_uom():
    """Fetch Item Unit of Measure - only CAJA"""
    records = _fetch_odata(WS_ITEM_UOM)
    return [r for r in records if str(r.get("Code", "")).upper() == "CAJA"]


def fetch_item_references():
    """Fetch Item References - only CAJA, selecting the currently valid one by date"""
    records = _fetch_odata(WS_ITEM_REF)
    today = datetime.now().date()
    
    # Group by Item_No, filter CAJA, pick the valid one
    by_item = {}
    for r in records:
        if str(r.get("Unit_of_Measure", "")).upper() != "CAJA":
            continue
        item = str(r.get("Item_No", ""))
        if item not in by_item:
            by_item[item] = []
        by_item[item].append(r)
    
    result = {}
    for item, refs in by_item.items():
        if len(refs) == 1:
            result[item] = refs[0]
        else:
            valid = None
            for r in refs:
                start = r.get("Starting_Date", "")
                end = r.get("Ending_Date", "")
                start_date = None
                end_date = None
                try:
                    if start and start != "0001-01-01":
                        start_date = datetime.fromisoformat(str(start).replace("Z", "")).date()
                except (ValueError, TypeError):
                    pass
                try:
                    if end and end != "0001-01-01":
                        end_date = datetime.fromisoformat(str(end).replace("Z", "")).date()
                except (ValueError, TypeError):
                    pass
                
                if not start_date and not end_date:
                    valid = r
                    break
                if start_date and end_date:
                    if start_date <= today <= end_date:
                        valid = r
                        break
                elif start_date and not end_date:
                    if start_date <= today:
                        valid = r
                        break
                elif not start_date and end_date:
                    if today <= end_date:
                        valid = r
                        break
            
            if not valid:
                refs_with_dates = [r for r in refs if r.get("Starting_Date") and r.get("Starting_Date") != "0001-01-01"]
                if refs_with_dates:
                    valid = max(refs_with_dates, key=lambda x: str(x.get("Starting_Date", "")))
                else:
                    valid = refs[0]
            result[item] = valid
    
    return result


def get_enriched_pallets(sales_order_no=None):
    """
    Fetch all tables and perform JOINs to return enriched pallet data.
    Only returns pallets from open orders (Inner Join with SalesHeader and SalesLine).
    Description comes from SalesLine. EAN is the currently valid one by date.
    """
    pallets = fetch_pallets(sales_order_no)
    orders = fetch_sales_headers()
    if sales_order_no:
        lines = _fetch_odata(WS_SALES_LINE, params={"$filter": f"Document_No eq '{sales_order_no}'"})
    else:
        lines = fetch_sales_lines()
    units = fetch_item_uom()
    ref_map = fetch_item_references()  # Already returns {item_no: valid_ref}
    
    # Build lookup maps
    order_map = {o.get("No", ""): o for o in orders}
    
    line_map = {}
    for l in lines:
        key = f"{l.get('Document_No', '')}|{l.get('No', '')}"
        if key not in line_map:
            line_map[key] = l
    
    unit_map = {str(u.get("Item_No", "")): u for u in units}
    
    # Enrich pallets with Inner Join
    enriched = []
    for p in pallets:
        sales_order = p.get("Sales_Order_No", "")
        item_no = str(p.get("Item_No", ""))
        
        # Inner Join: order must exist in SalesHeader (open order)
        if sales_order not in order_map:
            continue
        
        # Inner Join: line must exist in SalesLine
        line_key = f"{sales_order}|{item_no}"
        if line_key not in line_map:
            continue
        
        o = order_map[sales_order]
        l = line_map[line_key]
        u = unit_map.get(item_no, {})
        rf = ref_map.get(item_no, {})
        
        kg_box = u.get("Qty_per_Unit_of_Measure", 0) or 0
        init_qty = p.get("Qty_to_sales", 0) or 0
        boxes = round(init_qty / kg_box) if kg_box > 0 else 0
        
        pallet_id = p.get("Id", 0)
        ean_code = str(rf.get("Reference_No", ""))
        sscc = generate_sscc(pallet_id)
        
        # Format expiration date for GS1: YYMMDD
        exp_raw = p.get("Expiration_date", "")
        exp_gs1 = ""
        try:
            if exp_raw:
                exp_str = str(exp_raw)
                if "T" in exp_str:
                    exp_date = datetime.fromisoformat(exp_str.replace("Z", ""))
                    exp_gs1 = exp_date.strftime("%y%m%d")
                elif "-" in exp_str and len(exp_str) >= 10:
                    # Format: 2028-03-30
                    exp_date = datetime.strptime(exp_str[:10], "%Y-%m-%d")
                    exp_gs1 = exp_date.strftime("%y%m%d")
                elif "/" in exp_str:
                    # Format: 30/03/2028
                    parts = exp_str.split("/")
                    if len(parts) == 3:
                        exp_date = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                        exp_gs1 = exp_date.strftime("%y%m%d")
                elif isinstance(exp_raw, (int, float)):
                    # Excel serial date
                    exp_date = datetime(1899, 12, 30) + timedelta(days=int(exp_raw))
                    exp_gs1 = exp_date.strftime("%y%m%d")
        except (ValueError, TypeError, IndexError):
            pass
        
        # GS1-128 barcode data strings
        gtin14 = ean_code.zfill(14) if ean_code else ""
        lot_no = p.get("Lot_No", "")
        
        # (3102) Net Weight with 2 decimal places, 6 digits
        # Example: 576 Kg -> 057600, 315.5 Kg -> 031550
        weight_3102 = str(int(round(init_qty * 100))).zfill(6)
        
        # Line 1: (02) GTIN + (15) Best Before + (17) Expiry + (10) Batch
        gs1_line1 = f"02{gtin14}15{exp_gs1}17{exp_gs1}10{lot_no}" if gtin14 else ""
        # Line 2: (37) Quantity + (3102) Net Weight
        gs1_line2 = f"37{boxes}3102{weight_3102}" if boxes else ""
        # Line 3: (00) SSCC
        gs1_line3 = f"00{sscc}"
        
        # Human-readable format for labels
        gs1_line1_hr = f"(02) {gtin14} (15) {exp_gs1} (17) {exp_gs1} (10) {lot_no}" if gtin14 else ""
        gs1_line2_hr = f"(37) {boxes} (3102) {weight_3102}" if boxes else ""
        gs1_line3_hr = f"(00) {sscc}"
        
        enriched.append({
            "id": pallet_id,
            "itemNo": item_no,
            "itemDescription": l.get("Description", "") or p.get("Item_Description", ""),
            "purchaseOrderNo": p.get("Purchase_Order_No", ""),
            "receiptNo": p.get("Receipt_No", ""),
            "lotNo": lot_no,
            "locationCode": p.get("Location_Code", ""),
            "internalPalletNo": p.get("Internal_Pallet_No", ""),
            "expirationDate": exp_raw,
            "baseHeight": p.get("Base_Height", ""),
            "initQuantity": init_qty,
            "outstandingQuantity": p.get("Outstanding_Quantity", 0),
            "salesOrderNo": sales_order,
            "shipmentNo": p.get("Shipment_No", ""),
            "shipmentLineNo": p.get("Shipment_Line_No", 0),
            "customerNo": o.get("Sell_to_Customer_No", "") or p.get("Customer_No", ""),
            "customerName": o.get("Sell_to_Customer_Name", ""),
            "shipToCountry": o.get("Ship_to_Country_Region_Code", ""),
            "orderDate": o.get("Order_Date", ""),
            "shipmentDate": o.get("Shipment_Date", ""),
            "externalDocNo": o.get("External_Document_No", ""),
            "itemRefNo": l.get("Item_Reference_No", ""),
            "lineQuantity": l.get("Quantity", 0),
            "kgPerBox": kg_box,
            "boxesPerPallet": boxes,
            "eanCode": ean_code,
            "sscc": sscc,
            "gs1Line1": gs1_line1,
            "gs1Line2": gs1_line2,
            "gs1Line3": gs1_line3,
            "gs1Line1HR": gs1_line1_hr,
            "gs1Line2HR": gs1_line2_hr,
            "gs1Line3HR": gs1_line3_hr,
        })
    
    return enriched


def get_orders_with_pallets():
    """Returns orders with pallet counts (lightweight, no full enrichment)"""
    orders = fetch_sales_headers()
    
    # Lightweight fetch: only get Sales_Order_No and Item_No for counting
    today = datetime.now().strftime("%Y-%m-%d")
    all_pallets = _fetch_odata(WS_PALLETS, params={
        "$filter": f"Expiration_date ge {today}",
        "$select": "Sales_Order_No,Item_No"
    })
    
    # Count pallets and items per order
    counts = {}
    for p in all_pallets:
        so = p.get("Sales_Order_No", "")
        if not so.startswith("PV"):
            continue
        if so not in counts:
            counts[so] = {"pallets": 0, "items": set()}
        counts[so]["pallets"] += 1
        counts[so]["items"].add(p.get("Item_No", ""))
    
    result = []
    for o in orders:
        no = o.get("No", "")
        c = counts.get(no, {"pallets": 0, "items": set()})
        result.append({
            "orderNo": no,
            "customerName": o.get("Sell_to_Customer_Name", ""),
            "customerNo": o.get("Sell_to_Customer_No", ""),
            "shipToCountry": o.get("Ship_to_Country_Region_Code", ""),
            "shipmentDate": o.get("Shipment_Date", ""),
            "orderDate": o.get("Order_Date", ""),
            "externalDocNo": o.get("External_Document_No", ""),
            "pallets": [],
            "itemCount": len(c["items"]),
            "palletCount": c["pallets"],
        })
    
    # Only return orders that have pallets
    result = [r for r in result if r["palletCount"] > 0]
    result.sort(key=lambda x: x["orderNo"], reverse=True)
    return result
