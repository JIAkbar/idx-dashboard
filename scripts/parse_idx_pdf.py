"""
IDX Daily Statistics PDF Parser
================================
Baca PDF IDX Daily Statistics → hasilkan file JSON per hari
Output: data/ds_YYMMDD.json + data/index.json

Cara pakai:
  python parse_idx_pdf.py ds_260605.pdf
  python parse_idx_pdf.py --semua          # parse semua PDF di folder ini
"""

import json, re, argparse
from pathlib import Path
import pdfplumber

ROOT_DIR   = Path(__file__).parent.parent  # root repo
OUTPUT_DIR = ROOT_DIR / "data"             # JSON output
PDF_DIR    = ROOT_DIR / "data" / "pdf"    # PDF input

HARI_ID  = {"Monday":"Senin","Tuesday":"Selasa","Wednesday":"Rabu",
            "Thursday":"Kamis","Friday":"Jumat","Saturday":"Sabtu","Sunday":"Minggu"}
BULAN_ID = {"January":"Januari","February":"Februari","March":"Maret",
            "April":"April","May":"Mei","June":"Juni","July":"Juli",
            "August":"Agustus","September":"September","October":"Oktober",
            "November":"November","December":"Desember"}
BULAN_LIST = list(BULAN_ID.keys())

def get_text(pdf, page_idx):
    return pdf.pages[page_idx].extract_text() or ""

def num(s):
    try:    return float(str(s).replace(",","").strip())
    except: return 0.0

def pct(s):
    try:    return float(str(s).replace("%","").replace("+","").strip())
    except: return 0.0

# ─── PAGE 1 ─── IHSG Summary ────────────────────────────────
def parse_page1(text):
    out = {}
    m = re.search(r'(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d+)\s+(\w+)\s+(\d{4})', text)
    if m:
        hari_en, tgl, bln_en, thn = m.groups()
        bln_id = BULAN_ID.get(bln_en, bln_en)
        out["date_raw"] = f"{hari_en}, {int(tgl):02d} {bln_en} {thn}"
        out["date_id"]  = f"{HARI_ID.get(hari_en,hari_en)}, {int(tgl)} {bln_id} {thn}"
        mm = BULAN_LIST.index(bln_en) + 1 if bln_en in BULAN_LIST else 1
        out["date_iso"] = f"{thn}-{mm:02d}-{int(tgl):02d}"

    m = re.search(r'Trading Day\s+(\d+)', text)
    out["trading_day"] = int(m.group(1)) if m else 0

    # IHSG value & change
    m = re.search(r'([\d,]+\.\d+)\s*\n([-\d,]+\.\d+)\s+\(([-+][\d.]+)%\)', text)
    if m:
        out["ihsg_value"]  = num(m.group(1))
        out["ihsg_change"] = num(m.group(2))
        out["ihsg_pct"]    = float(m.group(3))

    # Previous, Highest, Lowest
    m = re.search(r'Previous\s+Highest\s+Lowest\s*\n\s*([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)', text)
    if m:
        out["ihsg_prev"] = num(m.group(1))
        out["ihsg_high"] = num(m.group(2))
        out["ihsg_low"]  = num(m.group(3))

    # Volume today
    m = re.search(r'Volume\s*\n\s*IDX Composite.*?\n([\d,]+)\s*\n\s*\(million shares\)', text, re.S)
    if not m:
        m = re.search(r'([\d,]+)\s*\n\s*\(million shares\)', text)
    out["vol_today"] = num(m.group(1)) if m else 0

    # Value today
    m = re.search(r'([\d,]+)\s+([\d,]+)\s*\n\s*\(billion IDR\)\s+\(million USD', text)
    if m:
        out["val_idr_today"] = num(m.group(1))
        out["val_usd_today"] = num(m.group(2))

    # Frequency today
    m = re.search(r'([\d,]+)\s*\n\s*\(thousand times\)', text)
    out["freq_today"] = num(m.group(1)) if m else 0

    # Market Cap IDX
    m = re.search(r'IDX Market Cap\s*\n\s*([\d,]+)\s+([\d,]+)', text)
    if m:
        out["mcap_idr"] = num(m.group(1))
        out["mcap_usd"] = num(m.group(2))

    # USD/IDR
    m = re.search(r'USD/IDR BI\s*=\s*([\d,]+)', text)
    out["usd_idr"] = int(num(m.group(1))) if m else 0

    return out

# ─── PAGE 2 ─── Avg Trading, Net Foreign, Fundamental ────────
def parse_page2(text):
    out = {}
    lines = text.split("\n")

    # Avg Trading: 43,703 24,718 1,449 2,720
    m = re.search(r'([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*\n\s*\(million shares\)\s+\(billion IDR\)\s+\(million USD\)\s+\(thousand times\)', text)
    if m:
        out["avg_vol"]     = num(m.group(1))
        out["avg_val_idr"] = num(m.group(2))
        out["avg_val_usd"] = num(m.group(3))
        out["avg_freq"]    = num(m.group(4))

    # Net Foreign — scan lines sekuensial
    nf_idr, nf_usd, nf_status = [], [], []
    for line in lines:
        l = line.strip()
        # baris angka IDR: "-3,731.16 -61,361.58"
        m2 = re.match(r'^([-\d,.]+)\s+([-\d,.]+)$', l)
        if m2:
            v1, v2 = num(m2.group(1)), num(m2.group(2))
            if abs(v1) > 100 and len(nf_idr) == 0:
                nf_idr = [v1, v2]
            elif abs(v1) < 10000 and len(nf_usd) == 0 and len(nf_idr) > 0:
                nf_usd = [v1, v2]
        # baris status: "Net Sell Net Sell" / "Net Buy Net Sell"
        ms = re.match(r'^(Net (?:Sell|Buy))\s+(Net (?:Sell|Buy))$', l, re.I)
        if ms:
            nf_status = [ms.group(1).strip(), ms.group(2).strip()]

    if nf_idr:
        out["nf_today_idr"]    = nf_idr[0]
        out["nf_ytd_idr"]      = nf_idr[1]
        out["nf_today_status"] = nf_status[0] if nf_status else ("Net Sell" if nf_idr[0] < 0 else "Net Buy")
        out["nf_ytd_status"]   = nf_status[1] if len(nf_status) > 1 else ("Net Sell" if nf_idr[1] < 0 else "Net Buy")
    if nf_usd:
        out["nf_today_usd"] = nf_usd[0]
        out["nf_ytd_usd"]   = nf_usd[1]

    # Fundamental
    m = re.search(r'([\d.]+)\s+([\d.]+)\s*\n.*?\(x\)\s+\(x\)', text)
    if not m:
        # cari setelah "Market PER Market PBV"
        m = re.search(r'Market PER\s+Market PBV.*?\n([\d.]+)\s+([\d.]+)', text, re.S)
    if m:
        out["mkt_per"] = float(m.group(1))
        out["mkt_pbv"] = float(m.group(2))

    # USD/IDR
    m = re.search(r'USD/IDR BI\s*=\s*([\d,]+)', text)
    if m:
        out["usd_idr"] = int(num(m.group(1)))

    return out

# ─── PAGE 3 ─── Top Stocks + Top Brokers ─────────────────────
def parse_page3(text):
    out = {"top_vol":[],"top_val":[],"top_freq":[],
           "broker_vol":[],"broker_val":[],"broker_freq":[]}
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    section = None

    for line in lines:
        l = line.strip()
        if re.search(r'By Volume.*million', l, re.I):   section = "vol"
        elif re.search(r'By Value.*billion', l, re.I):  section = "val"
        elif re.search(r'By Frequency.*times', l, re.I):section = "freq"
        if section is None: continue

        # Pola ganda: STOCK N %  BROKER_CODE Nama N %
        m = re.match(r'^([A-Z0-9]{2,5})\s+([\d,]+)\s+([\d.]+)%\s+([A-Z]{2})\s+(.+?)\s+([\d,]+)\s+([\d.]+)%$', l)
        if m:
            sr = {"c":m.group(1),"v":num(m.group(2)),"p":pct(m.group(3))}
            br = {"cd":m.group(4),"nm":m.group(5).strip(),"v":num(m.group(6)),"p":pct(m.group(7))}
            if section=="vol":   out["top_vol"].append(sr); out["broker_vol"].append(br)
            elif section=="val": out["top_val"].append(sr); out["broker_val"].append(br)
            else:                out["top_freq"].append(sr);out["broker_freq"].append(br)
            continue

        # Pola tunggal saham
        m2 = re.match(r'^([A-Z0-9]{2,5})\s+([\d,]+)\s+([\d.]+)%$', l)
        if m2:
            sr = {"c":m2.group(1),"v":num(m2.group(2)),"p":pct(m2.group(3))}
            if section=="vol":   out["top_vol"].append(sr)
            elif section=="val": out["top_val"].append(sr)
            else:                out["top_freq"].append(sr)

    for k in out: out[k] = out[k][:10]
    return out

# ─── PAGE 4 ─── MCap, Gainers, Losers, Leaders, Laggards ─────
def parse_page4(text):
    out = {"mcap":[],"gainers":[],"losers":[],
           "leaders_today":[],"leaders_ytd":[],
           "laggards_today":[],"laggards_ytd":[]}
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    section = None

    for line in lines:
        l = line.strip()
        if "Market Capitalization" in l:   section = "mcap"
        elif "Top Gainers" in l:           section = "gainloss"
        elif "Top Leaders" in l:           section = "leadlag"

        if section == "mcap":
            # Mungkin ada garbage di kanan, ambil hanya CODE N %
            m = re.match(r'^([A-Z]{2,6})\s+([\d,]+)\s+([\d.]+)%', l)
            if m and m.group(1) not in ("Code","By","ETF","All","ISSI","SW"):
                out["mcap"].append({"c":m.group(1),"v":num(m.group(2)),"p":pct(m.group(3))})

        elif section == "gainloss":
            # Dual: GAIN PREV TODAY % LOSS PREV TODAY %
            m = re.match(r'^([A-Z]{2,6})\s+([\d,]+)\s+([\d,]+)\s+([\d.]+)%\s+([A-Z]{2,6})\s+([\d,]+)\s+([\d,]+)\s+([-\d.]+)%$', l)
            if m:
                out["gainers"].append({"c":m.group(1),"pr":num(m.group(2)),"td":num(m.group(3)),"p":pct(m.group(4))})
                out["losers"].append({"c":m.group(5),"pr":num(m.group(6)),"td":num(m.group(7)),"p":pct(m.group(8))})

        elif section == "leadlag":
            # 4-column: LT_CODE LT% LT_IHSG LY_CODE LY% LY_IHSG LAT_CODE LAT% LAT_IHSG LAY_CODE LAY% LAY_IHSG
            m = re.match(
                r'^([A-Z]{2,6})\s+([-\d.]+)%\s+([+-][\d.]+)\s+'
                r'([A-Z]{2,6})\s+([-\d.]+)%\s+([+-][\d.]+)\s+'
                r'([A-Z]{2,6})\s+([-\d.]+)%\s+([+-][\d.]+)\s+'
                r'([A-Z]{2,6})\s+([-\d.]+)%\s+([+-][\d.]+)$', l)
            if m:
                out["leaders_today"].append( {"c":m.group(1), "p":float(m.group(2)),  "ih":float(m.group(3))})
                out["leaders_ytd"].append(   {"c":m.group(4), "p":float(m.group(5)),  "ih":float(m.group(6))})
                out["laggards_today"].append({"c":m.group(7), "p":float(m.group(8)),  "ih":float(m.group(9))})
                out["laggards_ytd"].append(  {"c":m.group(10),"p":float(m.group(11)), "ih":float(m.group(12))})

    return out

# ─── PAGE 6 ─── Index Performance ────────────────────────────
def parse_page6(text):
    featured, sharia, board, sectors = [], [], [], []
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    def mk(name, val, d, ytd):
        return {"n":name.strip(),"v":num(val),"d":float(d),"ytd":float(ytd)}

    for line in lines:
        l = line.strip()

        # Cari sektor [X] apapun di baris ini (mungkin di kanan kolom atau berdiri sendiri)
        for sm in re.finditer(r'(\[[A-K]\][^[]+?)\s+\d+\s+([\d,.]+)\s+([-\d.]+)%\s+([-\d.]+)%', l):
            sectors.append(mk(sm.group(1), sm.group(2), sm.group(3), sm.group(4)))

        # Skip baris yang sudah punya sektor atau bukan data indeks
        if re.search(r'\[[A-K]\]', l): continue

        # Dual-column featured index: NAME N VAL DAY% YTD%  NAME N VAL DAY% YTD%
        # Hanya ambil bagian kiri (featured); bagian kanan sudah tertangkap di sharia/board nanti
        # Cari semua match "NAME N VAL DAY% YTD%" dalam satu baris
        idx_matches = list(re.finditer(
            r'((?:IDX|LQ|IHSG|ISSI|JII|BISNIS|KOMPAS|SRI|ESG|SMinfra|Investor|infobank|MNC|Pefindo|Board|Main|Dev|Accel)[^\d]+?)\s+'
            r'\d+\s+([\d,.]+)\s+([-\d.]+)%\s+([-\d.]+)%', l))

        for im in idx_matches:
            name = im.group(1).strip()
            row  = mk(name, im.group(2), im.group(3), im.group(4))
            nl   = name.lower()
            if any(x in nl for x in ["issi","jii","sharia","bumn 17","growth 30","syariah"]):
                sharia.append(row)
            elif any(x in nl for x in ["main board","development board","acceleration board"]):
                board.append(row)
            else:
                featured.append(row)

    return {
        "featured": featured,
        "sharia":   sharia[:6],
        "board":    board[:3],
        "sectors":  sectors[:11]
    }

# ─── PAGE 7 ─── World Index Comparison ───────────────────────
COUNTRIES = (
    "Indonesia|Malaysia|Philippines|Singapore|Thailand|Vietnam|"
    "Australia|China|Hong Kong|India|Japan|Korea|Taiwan|"
    "Brazil|Canada|Chile|Colombia|Mexico|US|"
    "Austria|France|Germany|Ireland|Israel|Norway|Poland|"
    "Qatar|Russia|Saudi Arabia|South Africa|Spain|Switzerland|Turkey|UAE|UK"
)
COUNTRY_RE = re.compile(
    rf'^({COUNTRIES})\s+(.+?)\s+([\d,]+\.[\d]+)\s+([-+\d.]+)%\s+([-+\d.]+)%'
    r'(?:\s+(\d+))?(?:\s+(\d+))?(?:\s+(\d+))?$'
)

def parse_page7(text):
    world  = []
    region = None
    regions_known = {"ASEAN","Asia Pacific","America","EMEA"}

    for line in text.split("\n"):
        l = line.strip()
        if l in regions_known:
            region = l; continue
        if not region: continue

        m = COUNTRY_RE.match(l)
        if m:
            world.append({
                "r":   region,
                "c":   m.group(1).strip(),
                "idx": m.group(2).strip(),
                "v":   num(m.group(3)),
                "d":   float(m.group(4)),
                "ytd": float(m.group(5)),
                "ra":  int(m.group(6)) if m.group(6) else None,
                "rap": int(m.group(7)) if m.group(7) else None,
                "rw":  int(m.group(8)) if m.group(8) else None,
                "is_idx": m.group(1).strip() == "Indonesia"
            })
    return world

# ─── MAIN PARSER ─────────────────────────────────────────────
def parse_pdf(pdf_path: Path) -> dict:
    pdf_path = Path(pdf_path)
    print(f"  Parsing: {pdf_path.name} ...", end=" ", flush=True)
    with pdfplumber.open(pdf_path) as pdf:
        p1 = parse_page1(get_text(pdf, 0))
        p2 = parse_page2(get_text(pdf, 1))
        p3 = parse_page3(get_text(pdf, 2))
        p4 = parse_page4(get_text(pdf, 3))
        p6 = parse_page6(get_text(pdf, 5))
        p7 = parse_page7(get_text(pdf, 6))

    result = {
        **p1, **p2,
        "top_vol":      p3["top_vol"],
        "top_val":      p3["top_val"],
        "top_freq":     p3["top_freq"],
        "broker_vol":   p3["broker_vol"],
        "broker_val":   p3["broker_val"],
        "broker_freq":  p3["broker_freq"],
        "mcap":         p4["mcap"],
        "gainers":      p4["gainers"],
        "losers":       p4["losers"],
        "leaders_today":  p4["leaders_today"],
        "leaders_ytd":    p4["leaders_ytd"],
        "laggards_today": p4["laggards_today"],
        "laggards_ytd":   p4["laggards_ytd"],
        "featured":     p6["featured"],
        "sharia":       p6["sharia"],
        "board":        p6["board"],
        "sectors":      p6["sectors"],
        "world":        p7,
    }

    # Fallback IHSG dari featured
    if not result.get("ihsg_value") and p6["featured"]:
        ihsg = next((x for x in p6["featured"] if "IDX Composite" in x["n"] or "IHSG" in x["n"]), None)
        if ihsg:
            result.setdefault("ihsg_value", ihsg["v"])
            result.setdefault("ihsg_pct",   ihsg["d"])

    print(f"OK  [world:{len(p7)} sectors:{len(p6['sectors'])} mcap:{len(p4['mcap'])} leaders:{len(p4['leaders_today'])}]")
    return result

def save_json(data: dict, stem: str):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / f"{stem}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return out

def update_index(stem: str, data: dict):
    idx_file = OUTPUT_DIR / "index.json"
    idx = json.load(open(idx_file, encoding="utf-8")) if idx_file.exists() else {"dates":[]}
    entry = {
        "stem":       stem,
        "date_iso":   data.get("date_iso",""),
        "date_id":    data.get("date_id",""),
        "date_raw":   data.get("date_raw",""),
        "ihsg":       round(data.get("ihsg_value",0), 3),
        "ihsg_pct":   round(data.get("ihsg_pct",0), 2),
        "trading_day":data.get("trading_day",0)
    }
    stems = [d["stem"] for d in idx["dates"]]
    if stem in stems: idx["dates"][stems.index(stem)] = entry
    else:             idx["dates"].append(entry)
    idx["dates"].sort(key=lambda x: x["date_iso"])
    with open(idx_file, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=2)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--semua", action="store_true")
    args = ap.parse_args()

    pdfs = sorted(PDF_DIR.glob("ds_*.pdf")) if args.semua else [PDF_DIR / f for f in args.files]
    if not pdfs:
        print("Tidak ada PDF dipilih."); return

    print(f"\nMemparse {len(pdfs)} file PDF...")
    for p in pdfs:
        if not p.exists():
            print(f"  SKIP: {p.name}"); continue
        try:
            d = parse_pdf(p)
            save_json(d, p.stem)
            update_index(p.stem, d)
        except Exception as e:
            print(f"  ERROR {p.name}: {e}")
            import traceback; traceback.print_exc()

    print(f"\nSelesai! JSON tersimpan di: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
