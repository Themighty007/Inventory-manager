import csv
import io
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber
import pymupdf
from docx import Document
from sqlalchemy.orm import Session

from backend.app.database.models import Invoice, Item
from backend.app.schemas.inventory import ParsedInvoiceItem, ParsedInvoiceResponse

# Shipping / courier / non-component charge keywords
SHIPPING_KEYWORDS = (
    "STANDARD SHIPPING",
    "SHIPPING CHARGE",
    "SHIPPING FEE",
    "SHIPPING & HANDLING",
    "FREIGHT",
    "COURIER",
    "DELIVERY CHARGE",
    "DELIVERY FEE",
    "PACKING CHARGE",
    "HANDLING CHARGE",
    "COD CHARGE",
    "CONVENIENCE FEE",
    "IGST (SALE)",
    "CGST (SALE)",
    "SGST (SALE)",
)

SHIPPING_HSN_CODES = {"996819", "996812", "996511", "996813"}

CATEGORY_RULES: List[Tuple[str, Tuple[str, ...]]] = [
    ("Microcontrollers", ("arduino", "esp32", "esp8266", "wemos", "stm32", "rp2040", "raspberry", "pico", "ch340", "atmega", "attiny", "nodemcu", "teensy", "mcu", "breakout")),
    ("Semiconductors", ("mosfet", "timer ic", "ne555", "dc-dc", "converter", "regulator", "buck", "boost", "ldo", "amplifier", "op-amp", "shift register", "74hc", "sn74", "sot-23", "sot23", "sot-563", "tssop", "vssop", "sop-16", "sop-8", "diode", "transistor", "bjt", "igbt", "ic ", "triac", "optocoupler")),
    ("Sensors", ("sensor", "ultrasonic", "hc-sr04", "dht11", "dht22", "bme280", "bmp280", "mpu6050", "imu", "accelerometer", "gyro", "lidar", "ir ", "ldr", "thermistor", "hall effect", "current sense")),
    ("Electrical", ("relay", "ssr", "mcb", "breaker", "contactor", "fuse", "transformer", "heat sink", "heatsink", "heat radiator", "smps", "power supply", "battery", "switch", "solenoid")),
    ("Passives", ("resistor", "capacitor", "inductor", "potentiometer", "trimmer", "crystal", "oscillator", "varistor", "ferrite", "0603", "0805", "1206", "1/4w")),
    ("Cables & Connectors", ("header strip", "pin header", "male single row", "female header", "connector", "jst", "dupont", "jumper", "cable", "wire", "terminal block", "usb", "jack", "plug", "socket")),
    ("Hardware", ("adapter board", "pcb", "breadboard", "protoboard", "standoff", "spacer", "screw", "nut", "enclosure", "case", "chassis", "bracket", "mounting")),
    ("Network", ("ethernet", "cat6", "cat5", "rj45", "lora", "nrf24", "rfid", "nfc", "zigbee", "bluetooth", "wifi", "antenna")),
    ("HVAC", ("refrigerant", "hvac", "chiller", "cooling fan", "blower", "peltier")),
    ("Tools & Mechanical", ("solder", "flux", "multimeter", "tweezers", "crimper", "motor", "servo", "stepper", "bearing", "gear", "pulley")),
]

RESERVED_HEADER_TOKENS = {
    "REFERENCE", "SALE", "ORDER", "INVOICE", "DATE", "CUSTOMER", "SHIPPING",
    "BILL", "NUMBER", "NO", "TOTAL", "STATUS", "GSTIN", "PAGE", "FROM",
}


def _clean_text(text: Optional[str]) -> str:
    """Normalize unicode glyphs, preserve contextual hyphens, and drop FontAwesome PUA icons."""
    if not text:
        return ""
    s = text
    # Replace \ufffd between two alphanumeric chars with '-' (e.g. SOT\ufffd23 -> SOT-23), else space
    s = re.sub(r"(?<=[A-Za-z0-9])\ufffd(?=[A-Za-z0-9])", "-", s)
    cleaned_chars: List[str] = []
    for ch in s:
        code = ord(ch)
        if 0xE000 <= code <= 0xF8FF or 0xF0000 <= code <= 0xFFFFD or ch == "\ufffd":
            cleaned_chars.append(" ")
            continue
        if ch in ("\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2212"):
            cleaned_chars.append("-")
            continue
        if ch in ("\xa0", "\u200b", "\ufeff"):
            cleaned_chars.append(" ")
            continue
        cleaned_chars.append(ch)
    return re.sub(r"[ \t]+", " ", "".join(cleaned_chars)).strip()


def _parse_number(val: Optional[str]) -> Optional[float]:
    if not val:
        return None
    s = _clean_text(val)
    s = re.sub(r"\([^)]*%\)", "", s)
    s = s.replace(",", "")
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def _classify_category(name: str) -> str:
    lower = f" {name.lower()} "
    for category, keywords in CATEGORY_RULES:
        if any(kw in lower for kw in keywords):
            return category
    return "General"


def _is_shipping_or_fee(name: str, hsn: Optional[str] = None) -> bool:
    upper = name.upper().strip()
    if hsn and hsn.strip() in SHIPPING_HSN_CODES:
        return True
    if any(kw in upper for kw in SHIPPING_KEYWORDS):
        return True
    if re.match(r"^\d+%\s*(IGST|CGST|SGST|GST)", upper):
        return True
    return False


def _extract_sku_and_name(raw_desc: str, explicit_sku: Optional[str] = None) -> Tuple[str, str]:
    desc = _clean_text(raw_desc)
    desc = re.sub(r"\s*\(\d+(?:\.\d+)?%\)\s*$", "", desc).strip()

    if explicit_sku and _clean_text(explicit_sku):
        sku = _clean_text(explicit_sku).upper()
        cleaned_name = re.sub(rf"^\[{re.escape(sku)}\]\s*", "", desc, flags=re.IGNORECASE).strip()
        return sku, cleaned_name or sku

    # Pattern 1: Leading bracketed SKU "[1165458] WEMOS..." or "[R248317] SI2301..."
    m = re.match(r"^\[([A-Za-z0-9\-_/\.]{2,40})\]\s*(.+)$", desc)
    if m:
        return m.group(1).strip().upper(), m.group(2).strip()

    # Pattern 2: Embedded tag SKU: XYZ or Part No: XYZ
    m2 = re.search(
        r"\b(?:SKU|Part\s*(?:No\.?|#)|MPN|Item\s*Code)\s*[:#-]?\s*([A-Za-z0-9\-_/\.]{3,40})\b",
        desc,
        re.IGNORECASE,
    )
    if m2:
        sku = m2.group(1).upper()
        cleaned_name = desc.replace(m2.group(0), "").strip(" -:,")
        return sku, cleaned_name or desc

    # Pattern 3: First token looks like a manufacturer part number (e.g. NE555PWR, ESP32-DEV-01)
    first_tok = desc.split(" ", 1)[0].strip(",;:-") if desc else ""
    if (
        4 <= len(first_tok) <= 32
        and re.search(r"[A-Za-z]", first_tok)
        and re.search(r"\d", first_tok)
        and re.match(r"^[A-Za-z0-9\-_/\.]+$", first_tok)
    ):
        return first_tok.upper(), desc

    tokens = re.findall(r"[A-Za-z0-9]+", desc.upper())
    synth = "-".join(tokens[:3])[:24] if tokens else "COMP-ITEM"
    return synth, desc or synth


def _parse_smart_date(raw_date: str, prefer_dayfirst: bool = True) -> Optional[datetime]:
    """Parse date/datetime strings accurately, respecting regional DD/MM/YYYY vs MM/DD/YYYY."""
    s = _clean_text(raw_date)
    if not s:
        return None

    iso_m = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?", s)
    if iso_m:
        y, m, d = int(iso_m.group(1)), int(iso_m.group(2)), int(iso_m.group(3))
        hh = int(iso_m.group(4) or 0)
        mm = int(iso_m.group(5) or 0)
        ss = int(iso_m.group(6) or 0)
        try:
            return datetime(y, m, d, hh, mm, ss)
        except ValueError:
            pass

    named_formats = [
        "%d %b %Y %I:%M %p", "%d %b %Y %H:%M", "%d %b %Y",
        "%d-%b-%Y %H:%M", "%d-%b-%Y",
        "%d %B %Y %I:%M %p", "%d %B %Y %H:%M", "%d %B %Y",
        "%b %d, %Y %I:%M %p", "%b %d, %Y", "%B %d, %Y",
    ]
    cleaned_named = re.sub(r"(\d+)(?:st|nd|rd|th)\b", r"\1", s, flags=re.IGNORECASE)
    for fmt in named_formats:
        try:
            return datetime.strptime(cleaned_named, fmt)
        except ValueError:
            continue

    num_m = re.search(
        r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?",
        s,
        re.IGNORECASE,
    )
    if num_m:
        p1, p2, yr = int(num_m.group(1)), int(num_m.group(2)), int(num_m.group(3))
        if yr < 100:
            yr += 2000
        hh = int(num_m.group(4) or 0)
        mm = int(num_m.group(5) or 0)
        ss = int(num_m.group(6) or 0)
        ampm = (num_m.group(7) or "").upper()
        if ampm == "PM" and hh < 12:
            hh += 12
        elif ampm == "AM" and hh == 12:
            hh = 0

        if p1 > 12:
            day, month = p1, p2
        elif p2 > 12:
            month, day = p1, p2
        elif prefer_dayfirst:
            day, month = p1, p2
        else:
            month, day = p1, p2

        try:
            return datetime(yr, month, day, hh, mm, ss)
        except ValueError:
            pass

    return None


def _extract_metadata(full_text: str, filename: str, lines_with_coords: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Extract supplier, invoice #, sale order #, dates, currency and totals."""
    text = _clean_text(full_text)
    upper = text.upper()

    prefer_dayfirst = any(
        tok in upper
        for tok in ("GSTIN", "IGST", "CGST", "SGST", "HSN", "INR", "₹", "INDIA", "ROBU", "MACFOS", "MAHARASHTRA", "TAMIL NADU")
    )

    currency = "INR"
    if "USD" in upper or ("$" in text and "₹" not in text and "INR" not in upper):
        currency = "USD"
    elif "EUR" in upper or "€" in text:
        currency = "EUR"

    # Supplier detection
    supplier = "Unknown Supplier"
    known_vendors = [
        ("ROBU", "MACFOS LIMITED (Robu.in)"),
        ("MACFOS", "MACFOS LIMITED (Robu.in)"),
        ("MOUSER", "Mouser Electronics"),
        ("DIGIKEY", "DigiKey Electronics"),
        ("DIGI-KEY", "DigiKey Electronics"),
        ("LCSC", "LCSC Electronics"),
        ("ELEMENT14", "Element14"),
        ("ELECTRONICSCOMP", "ElectronicsComp"),
        ("QUARTZCOMPONENTS", "Quartz Components"),
        ("THINGBITS", "Thingbits"),
        ("EVELTA", "Evelta"),
        ("AMAZON", "Amazon"),
    ]
    for key, label in known_vendors:
        if key in upper:
            supplier = label
            break

    if supplier == "Unknown Supplier":
        m_sup = re.search(
            r"(?:Sold\s*By|Supplier|Vendor|Seller|From|Billed\s*By)\s*[:\-]?\s*([A-Za-z0-9 &.,\-]{3,60})",
            full_text,
            re.IGNORECASE,
        )
        if m_sup:
            supplier = _clean_text(m_sup.group(1).splitlines()[0])[:80]
        else:
            for line in full_text.splitlines():
                cl = _clean_text(line)
                if len(cl) >= 4 and not any(skip in cl.upper() for skip in ("TAX INVOICE", "INVOICE", "ORIGINAL FOR", "PAGE ")):
                    supplier = cl[:80]
                    break

    # Invoice number extraction
    invoice_number = ""
    for pat in (
        r"Invoice\s*#\s*[:\-]?\s*([A-Za-z0-9/_-]{3,40})",
        r"Invoice\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Za-z0-9/_-]{3,40})",
        r"Reference\s*[:\-]\s*([A-Za-z0-9/_-]{3,40})",
        r"Bill\s*(?:No\.?|#)\s*[:\-]?\s*([A-Za-z0-9/_-]{3,40})",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            cand = m.group(1).strip()
            if cand.upper() not in RESERVED_HEADER_TOKENS:
                invoice_number = cand
                break

    if not invoice_number:
        stem = Path(filename).stem
        invoice_number = re.sub(r"[^A-Za-z0-9/_-]", "-", stem)[:40] or f"INV-{datetime.now().strftime('%Y%m%d%H%M')}"

    # Sale Order / PO extraction (checks spatial tabular value below label if label-row-above-value)
    sale_order: Optional[str] = None
    so_m = re.search(
        r"(?:Sale\s*Order|Sales\s*Order|Order\s*(?:No\.?|ID|#)|PO\s*(?:No\.?|#))\s*[:\-]\s*([A-Za-z0-9/_-]{3,40})",
        text,
        re.IGNORECASE,
    )
    if so_m:
        cand = so_m.group(1).strip()
        if cand.upper() not in RESERVED_HEADER_TOKENS:
            sale_order = cand

    # Tabular label-over-value lookup using PDF lines coordinates
    if not sale_order and lines_with_coords:
        for idx, line in enumerate(lines_with_coords):
            words = line["words"]
            for wi, w in enumerate(words):
                wt = _clean_text(w["text"]).lower()
                # Detect "Sale" followed by "Order:"
                next_wt = _clean_text(words[wi + 1]["text"]).lower() if wi + 1 < len(words) else ""
                if (wt == "sale" and next_wt.startswith("order")) or "sale order" in wt:
                    lx0, lx1 = w["x0"], (words[wi + 1]["x1"] if wi + 1 < len(words) else w["x1"])
                    # Look directly below on subsequent lines
                    for below in lines_with_coords[idx + 1 : min(len(lines_with_coords), idx + 4)]:
                        if below["top"] - line["top"] > 35:
                            break
                        for bw in below["words"]:
                            bcx = (bw["x0"] + bw["x1"]) / 2.0
                            if (lx0 - 15) <= bcx <= (lx1 + 30):
                                bval = _clean_text(bw["text"])
                                if bval and bval.upper() not in RESERVED_HEADER_TOKENS:
                                    sale_order = bval
                                    break
                        if sale_order:
                            break
                if sale_order:
                    break
            if sale_order:
                break

    # Order Date extraction (prioritize Order Date, fallback to Invoice Date)
    order_dt: Optional[datetime] = None
    invoice_date_raw: Optional[str] = None

    for pat in (
        r"(?:Order\s*Date|PO\s*Date|Ordered\s*On|Order\s*Placed)\s*[:\-]?\s*([0-9A-Za-z/\-,:\s]{6,28}?)(?=\s{2,}|Sale|Invoice|Reference|Customer|Delivery|\n|$)",
        r"(?:Invoice\s*Date|Bill\s*Date|Dated)\s*[:\-]?\s*([0-9A-Za-z/\-,:\s]{6,28}?)(?=\s{2,}|Sale|Invoice|Reference|Customer|Delivery|\n|$)",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            candidate_str = _clean_text(m.group(1))
            parsed = _parse_smart_date(candidate_str, prefer_dayfirst=prefer_dayfirst)
            if parsed:
                order_dt = parsed
                invoice_date_raw = candidate_str
                break

    if not order_dt:
        raw_lines = [_clean_text(l) for l in full_text.splitlines() if _clean_text(l)]
        for idx, line in enumerate(raw_lines):
            if re.search(r"\b(Order\s*Date|Invoice\s*Date|Bill\s*Date)\b", line, re.IGNORECASE):
                window = " ".join(raw_lines[idx : min(len(raw_lines), idx + 4)])
                parsed = _parse_smart_date(window, prefer_dayfirst=prefer_dayfirst)
                if parsed:
                    order_dt = parsed
                    invoice_date_raw = window[:40]
                    break

    # Delivery / Arrival Time extraction (when printed in invoice/waybill/packing list)
    delivery_dt: Optional[datetime] = None
    delivery_extracted = False
    for pat in (
        r"(?:Delivery\s*(?:Date|Time|Date\s*&\s*Time)|Delivered\s*(?:On|At)|Arrival\s*(?:Date|Time)|Received\s*(?:On|Date)|Dispatch\s*Date)\s*[:\-]?\s*([0-9A-Za-z/\-,:\s]{6,32}?)(?=\s{2,}|\n|$)",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            parsed = _parse_smart_date(m.group(1), prefer_dayfirst=prefer_dayfirst)
            if parsed:
                delivery_dt = parsed
                delivery_extracted = True
                break

    if not delivery_dt:
        delivery_dt = datetime.now().replace(second=0, microsecond=0)

    # Financial totals extraction (allow currency symbols or PUA/replacement glyphs before numbers)
    subtotal_val = 0.0
    tax_val = 0.0
    total_val = 0.0
    total_qty_val: Optional[float] = None

    curr_prefix = r"(?:Rs\.?|INR|USD|EUR|GBP|[^\dA-Za-z\s\n]{1,4})?"

    m_sub = re.search(
        rf"\bSub\s*total\b\s*[:\-]?\s*{curr_prefix}\s*([\d,]+\.\d{{1,4}})",
        text,
        re.IGNORECASE,
    )
    if m_sub:
        subtotal_val = _parse_number(m_sub.group(1)) or 0.0

    m_tax = re.search(
        rf"\b(?:Taxes|Total\s*Tax)\b\s*[:\-]?\s*{curr_prefix}\s*([\d,]+\.\d{{1,4}})",
        text,
        re.IGNORECASE,
    )
    if m_tax:
        tax_val = _parse_number(m_tax.group(1)) or 0.0
    else:
        # Handle Robu/Odoo summary line e.g. "18% IGST (Sale) 824.59 148.41" where last amount is tax
        m_igst = re.search(
            rf"(?:IGST|CGST|SGST|GST)\s*\(Sale\)\s*{curr_prefix}\s*[\d,]+\.\d{{1,4}}\s+{curr_prefix}\s*([\d,]+\.\d{{1,4}})",
            text,
            re.IGNORECASE,
        )
        if m_igst:
            tax_val = _parse_number(m_igst.group(1)) or 0.0

    # Look at footer lines specifically for Grand Total ("Total ₹ 973.00" or "Total <glyph> 973.00")
    footer_lines = [_clean_text(l) for l in full_text.splitlines() if _clean_text(l)]
    for line in footer_lines:
        if "SUBTOTAL" in line.upper():
            continue
        m_tot = re.match(
            rf"^(?:Grand\s*Total|Invoice\s*Total|Total)\s*[:\-]?\s*{curr_prefix}\s*([\d,]+\.\d{{2}})\b",
            line,
            re.IGNORECASE,
        )
        if m_tot:
            val = _parse_number(m_tot.group(1)) or 0.0
            if val > 0:
                total_val = val
        elif subtotal_val > 0 or "AMOUNT IN WORDS" in upper or "IGST" in upper or "GST" in upper:
            m_tot_inline = re.search(
                rf"(?:Grand\s*Total|Invoice\s*Total|\bTotal)\s*[:\-]?\s*{curr_prefix}\s*([\d,]+\.\d{{2}})\b",
                line,
                re.IGNORECASE,
            )
            if m_tot_inline:
                val = _parse_number(m_tot_inline.group(1)) or 0.0
                if val > 0:
                    total_val = val

    if total_val == 0.0 and subtotal_val > 0.0:
        # Also catch "Total" paired with an amount separated by more space or after Taxes line
        m_tot_fallback = re.findall(
            rf"\b(?:Grand\s*Total|Invoice\s*Total|Total)\b(?!\s*:?\s*[\d,]+\.\d{{3}}\b)[^\d\n]{{0,10}}([\d,]+\.\d{{2}})\b",
            text,
            re.IGNORECASE,
        )
        for cand in m_tot_fallback:
            val = _parse_number(cand) or 0.0
            if val >= subtotal_val:
                total_val = val

    m_qty_tot = re.search(r"\bTotal\s*:\s*([\d,]+\.\d{1,3})\b", text, re.IGNORECASE)
    if m_qty_tot:
        total_qty_val = _parse_number(m_qty_tot.group(1))

    return {
        "supplier": supplier,
        "invoice_number": invoice_number,
        "sale_order_number": sale_order,
        "order_date": order_dt.strftime("%Y-%m-%d") if order_dt else None,
        "invoice_date_raw": invoice_date_raw,
        "delivery_arrival_time": delivery_dt.strftime("%Y-%m-%dT%H:%M"),
        "delivery_extracted_from_doc": delivery_extracted,
        "currency": currency,
        "subtotal_amount": round(subtotal_val, 2),
        "tax_amount": round(tax_val, 2),
        "total_amount": round(total_val, 2),
        "extracted_total_qty": total_qty_val,
    }


def _match_header_column(header_text: str) -> Optional[str]:
    h = _clean_text(header_text).lower()
    if not h:
        return None
    if h in ("#", "sr", "sr.", "s.no", "sno", "sl", "sl.", "no", "no."):
        return "idx"
    if h in ("name", "title", "desc") or any(
        k in h for k in ("description", "particulars", "product", "component", "item name", "part name")
    ):
        return "desc"
    if h == "item":
        return "item_or_idx"
    if any(k in h for k in ("sku", "part no", "mpn", "part #", "code", "cat")):
        return "sku"
    if "hsn" in h or "sac" in h:
        return "hsn"
    if "rate" in h or "unit price" in h or "price" in h:
        return "rate"
    if "qty" in h or "quantity" in h:
        return "qty"
    if "disc" in h:
        return "disc"
    if "amount" in h or "taxable" in h:
        return "amount"
    if any(k in h for k in ("igst", "cgst", "sgst", "gst", "tax", "vat")):
        return "tax"
    if "total" in h:
        return "total"
    return None


def _group_words_into_lines(words: List[Dict[str, Any]], y_tolerance: float = 4.0) -> List[Dict[str, Any]]:
    """Group pdfplumber words by vertical coordinate into horizontal visual lines."""
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (round(w["top"], 1), w["x0"]))
    lines: List[Dict[str, Any]] = []
    current_group: List[Dict[str, Any]] = [sorted_words[0]]
    current_top = sorted_words[0]["top"]

    for w in sorted_words[1:]:
        if abs(w["top"] - current_top) <= y_tolerance:
            current_group.append(w)
        else:
            current_group.sort(key=lambda item: item["x0"])
            lines.append({
                "top": current_top,
                "bottom": max(i["bottom"] for i in current_group),
                "words": current_group,
                "text": _clean_text(" ".join(i["text"] for i in current_group)),
            })
            current_group = [w]
            current_top = w["top"]

    if current_group:
        current_group.sort(key=lambda item: item["x0"])
        lines.append({
            "top": current_top,
            "bottom": max(i["bottom"] for i in current_group),
            "words": current_group,
            "text": _clean_text(" ".join(i["text"] for i in current_group)),
        })
    return lines


def _detect_header_columns(header_words: List[Dict[str, Any]]) -> Optional[List[Tuple[str, float, float]]]:
    """Identify ordered column roles and header x0/x1 bounds from a header row."""
    detected_cols: List[Tuple[str, float, float]] = []
    sorted_hw = sorted(header_words, key=lambda w: w["x0"])

    merged: List[Dict[str, Any]] = []
    for w in sorted_hw:
        txt = _clean_text(w["text"])
        if not txt:
            continue
        if merged and (w["x0"] - merged[-1]["x1"]) < 6.0:
            merged[-1]["text"] += " " + txt
            merged[-1]["x1"] = w["x1"]
        else:
            merged.append({"text": txt, "x0": w["x0"], "x1": w["x1"]})

    for col in merged:
        role = _match_header_column(col["text"])
        if role:
            detected_cols.append((role, col["x0"], col["x1"]))

    roles_present = {r for r, _, _ in detected_cols}
    if "item_or_idx" in roles_present and "tax" in roles_present and "qty" not in roles_present and "rate" not in roles_present:
        return None
    if not (
        ("desc" in roles_present or "sku" in roles_present or "item_or_idx" in roles_present)
        and ("qty" in roles_present or "total" in roles_present or "amount" in roles_present)
    ):
        return None

    detected_cols.sort(key=lambda c: (c[1] + c[2]) / 2.0)

    resolved: List[Tuple[str, float, float]] = []
    has_desc = "desc" in roles_present
    for role, x0, x1 in detected_cols:
        if role == "item_or_idx":
            role = "idx" if has_desc else "desc"
        resolved.append((role, x0, x1))

    if resolved and resolved[0][0] == "desc" and resolved[0][1] > 42:
        # Reserve an idx column on the left for serial numbers (# glyph may not have decoded as '#')
        resolved.insert(0, ("idx", 20.0, resolved[0][1] - 10.0))

    return resolved


def _compute_gutter_bands(
    resolved_cols: List[Tuple[str, float, float]],
    body_chars: List[Dict[str, Any]],
    page_width: float,
) -> Dict[str, Tuple[float, float]]:
    """
    Use a 1D X-coordinate character occupancy projection across all table body rows
    to place gapless, non-overlapping split boundaries strictly inside whitespace gutters.
    """
    max_w = int(page_width) + 2
    occupied = [0] * max_w
    for ch in body_chars:
        txt = _clean_text(ch.get("text", ""))
        if not txt:
            continue
        x_start = max(0, int(ch["x0"]))
        x_end = min(max_w - 1, int(ch["x1"]))
        for x in range(x_start, x_end + 1):
            occupied[x] += 1

    split_points: List[float] = [0.0]

    for i in range(len(resolved_cols) - 1):
        role_cur, x0_cur, x1_cur = resolved_cols[i]
        role_nxt, x0_nxt, x1_nxt = resolved_cols[i + 1]

        # Search window between header bounds (expanding left toward desc if cur == desc)
        c_cur = (x0_cur + x1_cur) / 2.0
        c_nxt = (x0_nxt + x1_nxt) / 2.0

        if role_cur == "desc":
            # Look left of the next column header so right/center-aligned numeric columns never leak into desc
            search_lo = max(int(x1_cur) + 1, int(x0_nxt) - 55)
            search_hi = min(max_w - 1, max(search_lo, int(x0_nxt)))
        else:
            search_lo = max(0, int(min(x1_cur, c_cur)) - 4)
            search_hi = min(max_w - 1, int(max(x0_nxt, c_nxt)) + 4)

        # Find all zero-occupancy runs inside [search_lo, search_hi]
        best_split = (x1_cur + x0_nxt) / 2.0
        runs: List[Tuple[int, int]] = []
        run_start: Optional[int] = None

        for x in range(max(0, search_lo), min(max_w, search_hi + 1)):
            if occupied[x] == 0:
                if run_start is None:
                    run_start = x
            else:
                if run_start is not None:
                    runs.append((run_start, x - 1))
                    run_start = None
        if run_start is not None:
            runs.append((run_start, min(max_w - 1, search_hi)))

        if runs:
            # Prefer real multi-point column gutters (>= 3px) over 1px kerning gaps inside numbers/words
            wide_runs = [r for r in runs if (r[1] - r[0]) >= 2]
            candidate_runs = wide_runs if wide_runs else runs
            if role_cur == "desc":
                target_x = x0_nxt - 2.0
                best_run = min(candidate_runs, key=lambda r: (-(r[1] - r[0]), abs(((r[0] + r[1]) / 2.0) - target_x)))
            else:
                best_run = max(candidate_runs, key=lambda r: r[1] - r[0])
            best_split = (best_run[0] + best_run[1]) / 2.0 + 0.5
        else:
            # Find minimum occupancy x in search window
            if search_lo <= search_hi:
                min_occ = min(range(search_lo, search_hi + 1), key=lambda x: occupied[x])
                best_split = float(min_occ)

        # Guarantee strictly monotonic boundaries
        if best_split <= split_points[-1]:
            best_split = (split_points[-1] + x0_nxt) / 2.0
        split_points.append(best_split)

    split_points.append(page_width + 5.0)

    bands: Dict[str, Tuple[float, float]] = {}
    for i, (role, _, _) in enumerate(resolved_cols):
        bands[role] = (split_points[i], split_points[i + 1])
    return bands


def _extract_chars_in_bands(
    page_chars: List[Dict[str, Any]],
    top_y: float,
    bottom_y: float,
    bands: Dict[str, Tuple[float, float]],
) -> Dict[str, str]:
    """Slice exact character streams per column X-band within [top_y, bottom_y), preserving inter-word spaces."""
    col_chars: Dict[str, List[Dict[str, Any]]] = {k: [] for k in bands}
    for ch in page_chars:
        if not (top_y <= ch["top"] < bottom_y):
            continue
        cx = (ch["x0"] + ch["x1"]) / 2.0
        for col_name, (bx0, bx1) in bands.items():
            if bx0 <= cx < bx1:
                col_chars[col_name].append(ch)
                break

    result: Dict[str, str] = {}
    for col_name, chars in col_chars.items():
        if not chars:
            result[col_name] = ""
            continue
        # Group into lines by vertical Y, then sort each line left-to-right and insert spaces on X gaps
        chars_sorted = sorted(chars, key=lambda c: (round(c["top"] / 4.0), c["x0"]))
        line_bufs: List[str] = []
        cur_line: List[Dict[str, Any]] = [chars_sorted[0]]
        cur_y = chars_sorted[0]["top"]

        for ch in chars_sorted[1:]:
            if abs(ch["top"] - cur_y) <= 4.5:
                cur_line.append(ch)
            else:
                line_bufs.append(_join_line_chars(cur_line))
                cur_line = [ch]
                cur_y = ch["top"]
        if cur_line:
            line_bufs.append(_join_line_chars(cur_line))

        joined_parts: List[str] = []
        for lb in line_bufs:
            lb_clean = lb.strip()
            if not lb_clean:
                continue
            if joined_parts and joined_parts[-1].endswith("-") and not joined_parts[-1].endswith(" -"):
                joined_parts[-1] = joined_parts[-1] + lb_clean
            else:
                joined_parts.append(lb_clean)
        result[col_name] = _clean_text(" ".join(joined_parts))
    return result


def _join_line_chars(chars: List[Dict[str, Any]]) -> str:
    chars = sorted(chars, key=lambda c: c["x0"])
    out: List[str] = []
    prev_x1: Optional[float] = None
    for ch in chars:
        t = ch.get("text", "")
        if prev_x1 is not None and (ch["x0"] - prev_x1) > 1.8:
            out.append(" ")
        out.append(t)
        prev_x1 = ch["x1"]
    return "".join(out)


def _parse_pdf_spatial(pdf_bytes: bytes) -> Tuple[List[Dict[str, Any]], str, List[Dict[str, Any]]]:
    """Extract line items accurately across multi-page PDFs using 1D gutter X-projection + char slicing."""
    extracted_rows: List[Dict[str, Any]] = []
    full_text_pages: List[str] = []
    all_lines_coords: List[Dict[str, Any]] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            raw_words = page.extract_words(keep_blank_chars=False, use_text_flow=False, x_tolerance=1.2, y_tolerance=3)
            lines = _group_words_into_lines(raw_words, y_tolerance=4.5)
            page_text = "\n".join(l["text"] for l in lines if l["text"])
            full_text_pages.append(page_text)
            if page_idx == 0:
                all_lines_coords = lines

            resolved_cols: Optional[List[Tuple[str, float, float]]] = None
            header_bottom_y: float = 0.0

            for l in lines:
                cols = _detect_header_columns(l["words"])
                if cols:
                    resolved_cols = cols
                    header_bottom_y = l["bottom"]
                    break

            if not resolved_cols:
                continue

            # Identify body lines strictly below header and above footer/summary sections
            body_lines: List[Dict[str, Any]] = []
            table_end_y: float = page.height
            for l in lines:
                if l["top"] <= header_bottom_y + 1.0:
                    continue
                upper_line = l["text"].upper()
                if any(
                    stop in upper_line
                    for stop in (
                        "AMOUNT IN WORDS",
                        "PAYMENT TERMS",
                        "TERMS & CONDITIONS",
                        "THIS IS A COMPUTER GENERATED",
                        "SUBJECT TO ",
                        "MACFOS LIMITED •",
                        "CIN: L",
                    )
                ):
                    table_end_y = l["top"] - 1.0
                    break
                if re.match(r"^(?:SUB\s*TOTAL|SUBTOTAL|TOTAL\s*:|\d+\s*/\s*\d+$)", upper_line):
                    table_end_y = l["top"] - 1.0
                    break
                if _detect_header_columns(l["words"]) is None and ("TAXES" in upper_line and "AMOUNT" in upper_line):
                    table_end_y = l["top"] - 1.0
                    break
                body_lines.append(l)

            if not body_lines:
                continue

            body_chars = [
                ch
                for ch in page.chars
                if (header_bottom_y + 1.0) <= ch["top"] < table_end_y
            ]
            bands = _compute_gutter_bands(resolved_cols, body_chars, page.width)

            idx_band = bands.get("idx")
            qty_band = bands.get("qty")
            total_band = bands.get("total") or bands.get("amount")

            row_anchors: List[float] = []
            if idx_band:
                for l in body_lines:
                    # Check integer serial numbers strictly inside idx_band
                    row_idx_text = _clean_text(
                        "".join(
                            ch["text"]
                            for ch in body_chars
                            if abs(ch["top"] - l["top"]) <= 4.5 and idx_band[0] <= ((ch["x0"] + ch["x1"]) / 2.0) < idx_band[1]
                        )
                    )
                    if re.match(r"^\d{1,3}$", row_idx_text) and len(l["words"]) >= 2:
                        row_anchors.append(l["top"] - 2.0)

            if not row_anchors:
                for l in body_lines:
                    has_qty = any(
                        qty_band and qty_band[0] <= ((w["x0"] + w["x1"]) / 2.0) < qty_band[1] and _parse_number(w["text"]) is not None
                        for w in l["words"]
                    )
                    has_total = any(
                        total_band and total_band[0] <= ((w["x0"] + w["x1"]) / 2.0) < total_band[1] and _parse_number(w["text"]) is not None
                        for w in l["words"]
                    )
                    if has_qty or has_total:
                        row_anchors.append(l["top"] - 2.0)

            if not row_anchors:
                continue

            for r_idx, start_y in enumerate(row_anchors):
                end_y = row_anchors[r_idx + 1] if r_idx + 1 < len(row_anchors) else table_end_y
                col_map = _extract_chars_in_bands(body_chars, start_y, end_y, bands)

                desc_str = col_map.get("desc", "")
                sku_col_str = col_map.get("sku", "")
                hsn_str = col_map.get("hsn", "")
                rate_str = col_map.get("rate", "")
                qty_str = col_map.get("qty", "")
                amount_str = col_map.get("amount", "")
                tax_str = col_map.get("tax", "")
                total_str = col_map.get("total", "")

                if not desc_str and not sku_col_str:
                    continue

                qty_val = _parse_number(qty_str) or 1.0
                rate_val = _parse_number(rate_str) or 0.0
                amount_val = _parse_number(amount_str) or 0.0
                total_val = _parse_number(total_str) or amount_val or (rate_val * qty_val)

                tax_rate = 0.0
                m_tr = re.search(r"(\d+(?:\.\d+)?)\s*%", tax_str)
                if m_tr:
                    tax_rate = float(m_tr.group(1))

                sku, clean_name = _extract_sku_and_name(desc_str, sku_col_str or None)
                is_fee = _is_shipping_or_fee(clean_name, hsn_str)

                if qty_val > 0 and total_val > 0:
                    eff_unit = round(total_val / qty_val, 2)
                elif qty_val > 0 and amount_val > 0:
                    eff_unit = round(amount_val / qty_val, 2)
                else:
                    eff_unit = round(rate_val, 2)

                extracted_rows.append({
                    "sku": sku,
                    "name": clean_name,
                    "raw_quantity": qty_val,
                    "quantity": max(1, int(round(qty_val))),
                    "unit_price": round(rate_val, 2) if rate_val > 0 else eff_unit,
                    "effective_unit_cost": eff_unit,
                    "tax_rate": tax_rate,
                    "line_total": round(total_val, 2),
                    "hsn_code": hsn_str or None,
                    "is_shipping_or_fee": is_fee,
                })

    combined_text = "\n".join(full_text_pages)
    if not extracted_rows:
        extracted_rows, fallback_text = _parse_pdf_fallback(pdf_bytes)
        if fallback_text and len(fallback_text) > len(combined_text):
            combined_text = fallback_text

    return extracted_rows, combined_text, all_lines_coords


def _parse_pdf_fallback(pdf_bytes: bytes) -> Tuple[List[Dict[str, Any]], str]:
    """Secondary PDF fallback using PyMuPDF table finder and structured text patterns."""
    rows: List[Dict[str, Any]] = []
    texts: List[str] = []

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    for page in doc:
        texts.append(page.get_text("text"))
        try:
            tables = page.find_tables()
            for tab in tables.tables:
                raw_table = tab.extract()
                if not raw_table or len(raw_table) < 2:
                    continue
                rows.extend(_parse_generic_grid(raw_table))
        except Exception:
            pass

    if not rows:
        rows = _parse_text_lines("\n".join(texts))

    return rows, "\n".join(texts)


def _parse_generic_grid(grid: List[List[Optional[str]]]) -> List[Dict[str, Any]]:
    """Parse any 2D table grid (PDF find_tables, DOCX tables, CSV rows) using header mapping."""
    if not grid:
        return []

    header_idx = -1
    col_map: Dict[str, int] = {}

    for r_idx, row in enumerate(grid[:6]):
        candidate_map: Dict[str, int] = {}
        for c_idx, cell in enumerate(row):
            role = _match_header_column(cell or "")
            if role:
                if role == "item_or_idx":
                    role = "desc" if "desc" not in candidate_map else "idx"
                candidate_map[role] = c_idx
        if ("desc" in candidate_map or "sku" in candidate_map) and (
            "qty" in candidate_map or "total" in candidate_map or "amount" in candidate_map or "rate" in candidate_map
        ):
            header_idx = r_idx
            col_map = candidate_map
            break

    if header_idx == -1:
        return []

    parsed: List[Dict[str, Any]] = []
    for row in grid[header_idx + 1 :]:
        if not row or all(not _clean_text(c) for c in row):
            continue
        joined = " ".join(_clean_text(c) for c in row if c).upper()
        if any(s in joined for s in ("SUBTOTAL", "SUB TOTAL", "GRAND TOTAL", "AMOUNT IN WORDS")):
            break

        desc_raw = _clean_text(row[col_map["desc"]]) if "desc" in col_map and col_map["desc"] < len(row) else ""
        sku_raw = _clean_text(row[col_map["sku"]]) if "sku" in col_map and col_map["sku"] < len(row) else ""
        qty_raw = _clean_text(row[col_map["qty"]]) if "qty" in col_map and col_map["qty"] < len(row) else "1"
        rate_raw = _clean_text(row[col_map["rate"]]) if "rate" in col_map and col_map["rate"] < len(row) else ""
        amount_raw = _clean_text(row[col_map["amount"]]) if "amount" in col_map and col_map["amount"] < len(row) else ""
        total_raw = _clean_text(row[col_map["total"]]) if "total" in col_map and col_map["total"] < len(row) else ""
        hsn_raw = _clean_text(row[col_map["hsn"]]) if "hsn" in col_map and col_map["hsn"] < len(row) else ""

        if not desc_raw and not sku_raw:
            continue

        qty_val = _parse_number(qty_raw) or 1.0
        rate_val = _parse_number(rate_raw) or 0.0
        amount_val = _parse_number(amount_raw) or 0.0
        total_val = _parse_number(total_raw) or amount_val or (rate_val * qty_val)

        sku, clean_name = _extract_sku_and_name(desc_raw or sku_raw, sku_raw or None)
        eff_unit = round(total_val / qty_val, 2) if (qty_val > 0 and total_val > 0) else round(rate_val, 2)

        parsed.append({
            "sku": sku,
            "name": clean_name,
            "raw_quantity": qty_val,
            "quantity": max(1, int(round(qty_val))),
            "unit_price": round(rate_val, 2) if rate_val > 0 else eff_unit,
            "effective_unit_cost": eff_unit,
            "tax_rate": 0.0,
            "line_total": round(total_val, 2),
            "hsn_code": hsn_raw or None,
            "is_shipping_or_fee": _is_shipping_or_fee(clean_name, hsn_raw),
        })

    return parsed


def _parse_text_lines(text: str) -> List[Dict[str, Any]]:
    """Fallback pattern parser for unstructured plain-text or bracketed invoice dumps."""
    items: List[Dict[str, Any]] = []
    pattern = re.compile(
        r"(?:^|\n)\s*(?:\d+\s+)?(\[[A-Za-z0-9\-_/.]{2,35}\]\s+.+?)(?=\n\s*(?:\d+\s+\[|Subtotal|Total:|Amount in Words|$))",
        re.DOTALL | re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        block = _clean_text(m.group(1))
        nums = re.findall(r"(?:₹|Rs\.?|\$|€)?\s*(\d+(?:\.\d{1,6})?)", block)
        sku, clean_name = _extract_sku_and_name(block)
        clean_name = re.split(r"\s+\d{6,8}\s+|₹", clean_name)[0].strip()
        qty_val = 1.0
        total_val = 0.0
        if len(nums) >= 2:
            total_val = float(nums[-1])
            for n in reversed(nums[:-1]):
                fn = float(n)
                if 0 < fn < 10000 and re.match(r"^\d+\.00$", n):
                    qty_val = fn
                    break
        eff = round(total_val / qty_val, 2) if qty_val > 0 and total_val > 0 else 0.0
        items.append({
            "sku": sku,
            "name": clean_name or sku,
            "raw_quantity": qty_val,
            "quantity": max(1, int(round(qty_val))),
            "unit_price": eff,
            "effective_unit_cost": eff,
            "tax_rate": 0.0,
            "line_total": round(total_val, 2),
            "hsn_code": None,
            "is_shipping_or_fee": _is_shipping_or_fee(clean_name),
        })
    return items


def _parse_docx(doc_bytes: bytes) -> Tuple[List[Dict[str, Any]], str]:
    doc = Document(io.BytesIO(doc_bytes))
    paragraphs = [_clean_text(p.text) for p in doc.paragraphs if _clean_text(p.text)]
    all_rows: List[Dict[str, Any]] = []
    table_text_lines: List[str] = []

    for table in doc.tables:
        grid = [[_clean_text(cell.text) for cell in row.cells] for row in table.rows]
        for row in grid:
            table_text_lines.append(" | ".join(row))
        all_rows.extend(_parse_generic_grid(grid))

    full_text = "\n".join(paragraphs + table_text_lines)
    if not all_rows:
        all_rows = _parse_text_lines(full_text)
    return all_rows, full_text


def _parse_csv(file_bytes: bytes) -> Tuple[List[Dict[str, Any]], str]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    sample = text[:2048]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        reader = list(csv.reader(io.StringIO(text), dialect))
    except csv.Error:
        reader = list(csv.reader(io.StringIO(text)))

    items = _parse_generic_grid(reader)
    return items, text


def parse_invoice_document(file_bytes: bytes, filename: str, db: Session) -> ParsedInvoiceResponse:
    """
    Parse an uploaded invoice document (.pdf, .docx, .csv, .txt, .json) into structured
    component lines + invoice dates, enriched with existing cabinet inventory matches.
    """
    ext = Path(filename).suffix.lower().lstrip(".")
    file_type = ext.upper() if ext else "UNKNOWN"
    raw_items: List[Dict[str, Any]] = []
    full_text = ""
    lines_with_coords: Optional[List[Dict[str, Any]]] = None

    if ext == "pdf":
        raw_items, full_text, lines_with_coords = _parse_pdf_spatial(file_bytes)
    elif ext in ("docx",):
        raw_items, full_text = _parse_docx(file_bytes)
    elif ext in ("csv", "tsv"):
        raw_items, full_text = _parse_csv(file_bytes)
    elif ext == "json":
        full_text = file_bytes.decode("utf-8-sig", errors="replace")
        data = json.loads(full_text)
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            for entry in data["items"]:
                sku, name = _extract_sku_and_name(entry.get("name", ""), entry.get("sku"))
                qty = float(entry.get("quantity", 1))
                price = float(entry.get("unit_price", 0))
                raw_items.append({
                    "sku": sku,
                    "name": name,
                    "raw_quantity": qty,
                    "quantity": max(1, int(round(qty))),
                    "unit_price": price,
                    "effective_unit_cost": price,
                    "tax_rate": 0.0,
                    "line_total": round(price * qty, 2),
                    "hsn_code": entry.get("hsn_code"),
                    "is_shipping_or_fee": _is_shipping_or_fee(name),
                })
    else:
        full_text = file_bytes.decode("utf-8-sig", errors="replace")
        raw_items = _parse_text_lines(full_text)

    metadata = _extract_metadata(full_text, filename, lines_with_coords=lines_with_coords)
    warnings: List[str] = []

    if ext == "pdf" and len(full_text.strip()) < 25:
        warnings.append(
            "This PDF appears to be an image-only scan without embedded selectable text. "
            "Try downloading the original digital PDF invoice or upload a .docx/.csv/.txt export."
        )

    existing_inv = (
        db.query(Invoice)
        .filter(Invoice.invoice_number == metadata["invoice_number"])
        .first()
    )
    already_logged = existing_inv is not None
    if already_logged:
        warnings.append(
            f"Invoice '{metadata['invoice_number']}' is already logged in the database "
            f"(logged on {existing_inv.received_date.strftime('%Y-%m-%d')}). Review carefully before committing."
        )

    component_items: List[ParsedInvoiceItem] = []
    skipped_rows: List[ParsedInvoiceItem] = []

    for idx, row in enumerate(raw_items, start=1):
        sku = row["sku"].upper()
        existing_item = db.query(Item).filter(Item.sku == sku).first()
        existing_drawers: List[str] = []
        existing_name: Optional[str] = None
        suggested_drawer: Optional[str] = None

        if existing_item:
            existing_name = existing_item.name
            existing_drawers = [
                loc.drawer_id for loc in existing_item.stock_locations if loc.quantity > 0
            ]
            if not existing_drawers and existing_item.stock_locations:
                existing_drawers = [existing_item.stock_locations[0].drawer_id]
            if existing_drawers:
                suggested_drawer = existing_drawers[0]

        item_obj = ParsedInvoiceItem(
            line_no=idx,
            sku=sku,
            name=row["name"],
            category=existing_item.category if existing_item else _classify_category(row["name"]),
            quantity=row["quantity"],
            raw_quantity=row["raw_quantity"],
            unit=existing_item.unit if existing_item else "pcs",
            unit_price=row["unit_price"],
            effective_unit_cost=row["effective_unit_cost"],
            tax_rate=row["tax_rate"],
            line_total=row["line_total"],
            hsn_code=row.get("hsn_code"),
            is_shipping_or_fee=row["is_shipping_or_fee"],
            suggested_drawer_id=suggested_drawer,
            existing_drawers=existing_drawers,
            existing_item_name=existing_name,
            confidence="HIGH" if (row["name"] and row["line_total"] > 0) else "MEDIUM",
        )

        if row["is_shipping_or_fee"]:
            skipped_rows.append(item_obj)
        else:
            component_items.append(item_obj)

    lines_sum = round(sum(it.line_total for it in component_items) + sum(it.line_total for it in skipped_rows), 2)
    doc_total = metadata["total_amount"]
    if doc_total > 0 and component_items:
        diff = abs(lines_sum - doc_total)
        if diff > 1.0:
            warnings.append(
                f"Extracted line totals sum to {lines_sum:.2f} vs invoice total {doc_total:.2f}. "
                "Please double-check item quantities and prices below."
            )

    if not component_items and not warnings:
        warnings.append("No component line items could be automatically matched from this document.")

    if not metadata["delivery_extracted_from_doc"]:
        warnings.append(
            "Delivery / arrival time was not printed on the invoice; defaulted to current arrival time (you can edit it)."
        )

    return ParsedInvoiceResponse(
        filename=filename,
        file_type=file_type,
        supplier=metadata["supplier"],
        invoice_number=metadata["invoice_number"],
        sale_order_number=metadata["sale_order_number"],
        order_date=metadata["order_date"],
        invoice_date_raw=metadata["invoice_date_raw"],
        delivery_arrival_time=metadata["delivery_arrival_time"],
        delivery_extracted_from_doc=metadata["delivery_extracted_from_doc"],
        currency=metadata["currency"],
        subtotal_amount=metadata["subtotal_amount"],
        tax_amount=metadata["tax_amount"],
        total_amount=metadata["total_amount"],
        extracted_total_qty=metadata["extracted_total_qty"],
        already_logged=already_logged,
        existing_invoice_id=existing_inv.id if existing_inv else None,
        warnings=warnings,
        items=component_items,
        skipped_fee_rows=skipped_rows,
        raw_text_preview=full_text[:1500],
    )
