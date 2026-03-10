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
WS_PALLETS = os.getenv("WS_PALLETS", "AITPalletsList")
WS_SALES_HEADER = os.getenv("WS_SALES_HEADER", "SalesOrder")
WS_SALES_LINE = os.getenv("WS_SALES_LINE", "SalesLinePrueba")
WS_ITEM_UOM = os.getenv("WS_ITEM_UOM", "ItemUnitOfMeasure")
WS_PROD_TRANSLATE = os.getenv("WS_PROD_TRANSLATE", "ProductTranslation")
WS_ITEM_REF = os.getenv("WS_ITEM_REF", "ItemReference")

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
                timeout=120
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


def fetch_pallets():
    """Fetch AIT Pallets - only those assigned to PV orders"""
    records = _fetch_odata(WS_PALLETS)
    return [r for r in records if r.get("Sales_Order_No", "").startswith("PV")]


def fetch_sales_headers():
    """Fetch open Sales Orders"""
    return _fetch_odata(WS_SALES_HEADER)


def fetch_sales_lines():
    """Fetch Sales Lines for open orders"""
    return _fetch_odata(WS_SALES_LINE)


def fetch_item_uom():
    """Fetch Item Unit of Measure - only CAJA"""
    records = _fetch_odata(WS_ITEM_UOM)
    return [r for r in records if str(r.get("Code", "")).upper() == "CAJA"]


def fetch_prod_translations():
    """Fetch product translations"""
    return _fetch_odata(WS_PROD_TRANSLATE)


def fetch_item_references():
    """Fetch Item References"""
    return _fetch_odata(WS_ITEM_REF)


def get_enriched_pallets():
    """
    Fetch all tables and perform JOINs to return enriched pallet data.
    Only returns pallets from open orders (Inner Join with SalesHeader and SalesLine).
    """
    pallets = fetch_pallets()
    orders = fetch_sales_headers()
    lines = fetch_sales_lines()
    units = fetch_item_uom()
    translations = fetch_prod_translations()
    refs = fetch_item_references()
    
    # Build lookup maps
    order_map = {o.get("No", ""): o for o in orders}
    
    line_map = {}
    for l in lines:
        key = f"{l.get('Document_No', '')}|{l.get('No', '')}"
        if key not in line_map:
            line_map[key] = l
    
    unit_map = {str(u.get("Item_No", "")): u for u in units}
    
    trans_map = {}
    for t in translations:
        item = str(t.get("Item_No", ""))
        if item not in trans_map:
            trans_map[item] = t
    
    ref_map = {}
    for r in refs:
        item = str(r.get("Item_No", ""))
        if item not in ref_map:
            ref_map[item] = r
    
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
        t = trans_map.get(item_no, {})
        rf = ref_map.get(item_no, {})
        
        kg_box = u.get("Qty_per_Unit_of_Measure", 0) or 0
        init_qty = p.get("Init_Quantity", 0) or 0
        boxes = round(init_qty / kg_box) if kg_box > 0 else 0
        
        enriched.append({
            "id": p.get("Id"),
            "itemNo": item_no,
            "itemDescription": p.get("Item_Description", ""),
            "purchaseOrderNo": p.get("Purchase_Order_No", ""),
            "receiptNo": p.get("Receipt_No", ""),
            "lotNo": p.get("Lot_No", ""),
            "locationCode": p.get("Location_Code", ""),
            "internalPalletNo": p.get("Internal_Pallet_No", ""),
            "expirationDate": p.get("Expiration_date", ""),
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
            "lineDescription": l.get("Description", "") or p.get("Item_Description", ""),
            "itemRefNo": l.get("Item_Reference_No", ""),
            "lineQuantity": l.get("Quantity", 0),
            "kgPerBox": kg_box,
            "boxesPerPallet": boxes,
            "descriptionEN": t.get("Description", ""),
            "eanCode": str(rf.get("Reference_No", "")),
        })
    
    return enriched


def get_orders_with_pallets():
    """
    Returns enriched pallets grouped by order.
    """
    enriched = get_enriched_pallets()
    
    groups = {}
    for p in enriched:
        order_no = p["salesOrderNo"]
        if order_no not in groups:
            groups[order_no] = {
                "orderNo": order_no,
                "customerName": p["customerName"],
                "customerNo": p["customerNo"],
                "shipToCountry": p["shipToCountry"],
                "shipmentDate": p["shipmentDate"],
                "orderDate": p["orderDate"],
                "pallets": [],
                "items": set(),
            }
        groups[order_no]["pallets"].append(p)
        groups[order_no]["items"].add(p["itemNo"])
    
    # Convert sets to counts
    result = []
    for g in groups.values():
        g["itemCount"] = len(g["items"])
        del g["items"]
        result.append(g)
    
    result.sort(key=lambda x: x["orderNo"], reverse=True)
    return result
