"""
IDX Weekly Statistics PDF Parser
=================================
Baca PDF IDX Weekly Statistics -> hasilkan file JSON per minggu.
Output: data-idx/json/ws_YYMMDD.json + data-idx/json/index_weekly.json

PDF sumber (10 halaman) berisi jauh lebih banyak dari yang diparse di sini.
Baru diambil 4 halaman yang tata letak teksnya rapi/linear (aman diregex):
  hal 1 - Market Activity (ringkasan volume/nilai/frekuensi minggu ini vs
          minggu lalu, IHSG close/low/high)
  hal 3 - Top Stocks Weekly + Top Exchange Members Weekly (by volume/value/
          frequency, 10 baris tiap kategori)
  hal 4 - Stock Trading Recapitulation (RG/TN/NG) + Top Gainers/Losers Weekly
  hal 5 - Index Movers (IHSG & LQ45, top leaders/laggards)

SENGAJA DILEWATI (tata letak tabel multi-kolom kompleks, extract_text() nya
tidak linear, pdfplumber.extract_tables() juga tidak mendeteksi garis tabel
di PDF ini - butuh kerja tambahan kalau mau diambil nanti):
  hal 2  - Transaction by Investor (F-F/D-F/F-D/D-D per hari)
  hal 6  - Trading Summaries
  hal 7  - IDX Index Weekly Performance
  hal 8  - Global Index Comparison
  hal 9  - Total Fund Raised YTD
  hal 10 - Appendix

Cara pakai:
  python parse_idx_weekly.py ws_260605.pdf
  python parse_idx_weekly.py --semua          # parse semua PDF di folder ini
"""

import json, re, argparse
from pathlib import Path
import pdfplumber

ROOT_DIR   = Path(__file__).parent.parent
OUTPUT_DIR = ROOT_DIR / "data-idx" / "json"
PDF_DIR    = ROOT_DIR / "data-idx" / "weekly"

BULAN_ID = {"January":"Januari","February":"Februari","March":"Maret",
            "April":"April","May":"Mei","June":"Juni","July":"Juli",
            "August":"Agustus","September":"September","October":"Oktober",
            "November":"November","December":"Desember"}

def get_text(pdf, page_idx):
    return pdf.pages[page_idx].extract_text() or ""

def num(s):
    try:    return float(str(s).replace(",", "").strip())
    except: return 0.0

def pct(s):
    try:    return float(str(s).replace("%", "").strip())
    except: return 0.0

# Baris "Label ... last_week this_week change pct" - dipakai berulang di
# beberapa halaman (Average Daily, IHSG Close/Low/High, dst). Dicocokkan
# PER-BARIS supaya tahan terhadap teks sisipan (sidebar/footnote) yang
# nyempil di antara baris data akibat layout kotak PDF (extract_text() IDX
# Weekly tidak selalu linear top-to-bottom sesuai tampilan visualnya). Tidak
# di-anchor "$" di akhir - kadang ada teks sisipan nempel SESUDAH 4 angka
# terakhir (mis. "Value (bill. IDR) 28,382 26,967 -1,415 -4.98 (thousand times)").
RE_4NUM = re.compile(
    r'^([A-Za-z][A-Za-z .()]*?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d.]+)%?(?:\s|$)'
)
# Kadang label sendirian di satu baris (mis. "Market Cap (trill. IDR)"), 4
# angkanya baru muncul di baris BERIKUTNYA tanpa label sama sekali.
RE_4NUM_POLOS = re.compile(
    r'^([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+(-?[\d,]+\.?\d*)\s+(-?[\d.]+)%?$'
)

def cari_baris_4num(text, label_prefix):
    """Cari baris berpola 'Label angka angka angka angka%' yang labelnya
    diawali label_prefix. Kalau label ketemu sendirian, cek baris berikutnya
    buat 4 angka polos. Return dict atau None."""
    lines = [l.strip() for l in text.split("\n")]
    for i, line in enumerate(lines):
        m = RE_4NUM.match(line)
        if m and m.group(1).strip().lower().startswith(label_prefix.lower()):
            return {"minggu_lalu": num(m.group(2)), "minggu_ini": num(m.group(3)),
                    "perubahan": num(m.group(4)), "persen": pct(m.group(5))}
        if line.lower().startswith(label_prefix.lower()) and len(line) < len(label_prefix) + 5:
            for j in range(i + 1, min(i + 4, len(lines))):
                m2 = RE_4NUM_POLOS.match(lines[j])
                if m2:
                    return {"minggu_lalu": num(m2.group(1)), "minggu_ini": num(m2.group(2)),
                            "perubahan": num(m2.group(3)), "persen": pct(m2.group(4))}
    return None

# ─── HALAMAN 1 ─── Market Activity ──────────────────────────
def parse_hal1(text):
    out = {}

    m = re.search(r'(\d+)\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})', text)
    if m:
        tgl, bln_en, thn = m.groups()
        out["tanggal_edisi_id"] = f"{int(tgl)} {BULAN_ID.get(bln_en, bln_en)} {thn}"
        mm = list(BULAN_ID.keys()).index(bln_en) + 1
        out["tanggal_edisi_iso"] = f"{thn}-{mm:02d}-{int(tgl):02d}"

    m = re.search(r'([A-Za-z]+)\s+(\d+)\s*-\s*(\d+),\s*(\d{4})', text)
    if m:
        out["rentang_minggu"] = m.group(0)

    m = re.search(r'THIS WEEK TRADING\*\s*Volume\s*\(million shares\)\s*([\d,]+)\s*Value\s*\(billion IDR\)\s*([\d,]+)\s*\(million USD\)\s*([\d,]+)', text, re.S)
    if m:
        out["minggu_ini"] = {
            "volume_juta_lembar": num(m.group(1)),
            "nilai_miliar_idr": num(m.group(2)),
            "nilai_juta_usd": num(m.group(3)),
        }

    avg = {}
    for label, key in [
        ("Volume (mill. shares)", "volume_juta_lembar"),
        ("Value (bill. IDR)", "nilai_miliar_idr"),
        ("Value (mill. USD)", "nilai_juta_usd"),
        ("Frequency (th. times)", "frekuensi_ribu_kali"),
        ("Market Cap (trill. IDR)", "kapitalisasi_triliun_idr"),
        ("Market Cap (bill. USD)", "kapitalisasi_miliar_usd"),
    ]:
        r = cari_baris_4num(text, label)
        if r:
            avg[key] = r
    if avg:
        out["rata_rata_harian"] = avg

    ihsg = {}
    for label, key in [("Close", "penutupan"), ("Low", "terendah"), ("High", "tertinggi")]:
        r = cari_baris_4num(text, label)
        if r:
            ihsg[key] = r
    if ihsg:
        out["ihsg"] = ihsg

    return out

# ─── HALAMAN 3 ─── Top Stocks & Top Broker Weekly ───────────
# PDF ini merender 2 kolom (Top Stocks kiri, Top Broker kanan) sebagai SATU
# baris teks gabungan lewat extract_text() - bukan 2 blok terpisah. Jadi tiap
# baris data harus ditangkap sekaligus: "KODE nilai% KODEBROKER Nama Broker nilai%"
RE_STOCK_BROKER_ROW = re.compile(
    r'^([A-Z]{4})\s+([\d,]+)\s+([\d.]+)\s+([A-Z]{2})\s+(.+?)\s+([\d,]+)\s+([\d.]+)$'
)

def parse_hal3(text):
    lines = text.split("\n")
    out = {"top_saham": {}, "top_broker": {}}
    kategori_map = [
        ("By Volume (Million Shares)", "volume"),
        ("By Value (Billion IDR)", "value"),
        ("By Frequency (Thousand Times)", "frekuensi"),
    ]
    for i, line in enumerate(lines):
        line_s = line.strip()
        for label, key in kategori_map:
            # baris header dual-kolom = label diulang 2x, mis. "By Volume (...) By Volume (...)"
            if line_s.count(label) >= 2:
                saham, broker = [], []
                j = i + 2  # lewati baris header "Code ... Code Name ..."
                while j < len(lines) and len(saham) < 10:
                    m = RE_STOCK_BROKER_ROW.match(lines[j].strip())
                    if m:
                        saham.append({"kode": m.group(1), "nilai": num(m.group(2)), "persen": pct(m.group(3))})
                        broker.append({"kode": m.group(4), "nama": m.group(5).strip(),
                                        "nilai": num(m.group(6)), "persen": pct(m.group(7))})
                    j += 1
                if saham:
                    out["top_saham"][key] = saham
                if broker:
                    out["top_broker"][key] = broker
    return out

# ─── HALAMAN 4 ─── Trading Recap + Gainers/Losers Weekly ────
RE_RECAP_ROW = re.compile(r'^(Regular \(RG\)|Cash \(TN\)|Negotiated \(NG\)|Total)\s+([\d,]+)\s+([\d.]*)%?\s+([\d,]+)\s+([\d.]*)%?\s+([\d,]+)\s+([\d.]*)%?$')
# Top Gainers (kiri) + Top Losers (kanan) juga digabung 1 baris teks, sama
# pola dual-kolom seperti hal 3.
RE_GAIN_LOSE_ROW = re.compile(
    r'^([A-Z]{4})\s+([\d,]+)\s+([\d,]+)\s+(-?[\d,]+)\s+(-?[\d.]+)%\s+'
    r'([A-Z]{4})\s+([\d,]+)\s+([\d,]+)\s+(-?[\d,]+)\s+(-?[\d.]+)%$'
)

def parse_hal4(text):
    lines = text.split("\n")
    out = {"rekap_transaksi": {}, "top_gainers": [], "top_losers": []}

    for line in lines:
        m = RE_RECAP_ROW.match(line.strip())
        if m:
            key = {"Regular (RG)": "reguler", "Cash (TN)": "tunai",
                   "Negotiated (NG)": "negosiasi", "Total": "total"}[m.group(1)]
            out["rekap_transaksi"][key] = {
                "volume": num(m.group(2)),
                "volume_persen": pct(m.group(3)) if m.group(3) else None,
                "nilai": num(m.group(4)),
                "nilai_persen": pct(m.group(5)) if m.group(5) else None,
                "frekuensi": num(m.group(6)),
                "frekuensi_persen": pct(m.group(7)) if m.group(7) else None,
            }

    # Tiap baris = 1 gainer (kiri) + 1 loser (kanan) sekaligus.
    for line in lines:
        m = RE_GAIN_LOSE_ROW.match(line.strip())
        if m:
            out["top_gainers"].append({"kode": m.group(1), "minggu_lalu": num(m.group(2)),
                                        "minggu_ini": num(m.group(3)), "perubahan": num(m.group(4)),
                                        "persen": pct(m.group(5))})
            out["top_losers"].append({"kode": m.group(6), "minggu_lalu": num(m.group(7)),
                                       "minggu_ini": num(m.group(8)), "perubahan": num(m.group(9)),
                                       "persen": pct(m.group(10))})

    return out

# ─── HALAMAN 5 ─── Index Movers (IHSG & LQ45) ───────────────
RE_MOVER_ROW = re.compile(r'^([A-Z]{4})\s+(-?[\d.]+)\s+([\d.]+)\s+(-?[\d.]+)$')

def parse_hal5(text):
    lines = text.split("\n")
    out = {"ihsg": {"top_leaders": [], "top_laggards": []},
           "lq45": {"top_leaders": [], "top_laggards": []}}

    # Header dual-kolom ("Top Leaders Top Leaders" / "Top Laggards Top Laggards")
    # sama pola dengan hal 3/4 - label diulang 2x dalam satu baris teks.
    seksi_urut = []  # urutan kemunculan: (jenis, indeks_baris)
    for i, line in enumerate(lines):
        s = line.strip()
        if s.count("Top Leaders") >= 2:
            seksi_urut.append(("leaders", i))
        elif s.count("Top Laggards") >= 2:
            seksi_urut.append(("laggards", i))

    # 4 seksi harusnya: leaders(IHSG), leaders(LQ45) [baris sama], laggards(IHSG), laggards(LQ45)
    # tapi karena 2 kolom sejajar, satu baris "Top Leaders"/"Top Laggards" mewakili
    # KEDUA indeks - baris data sesudahnya juga 2 kolom (IHSG kiri, LQ45 kanan),
    # namun extract_text() sudah menggabungkan jadi satu baris "kode1 .. kode2 ..".
    for jenis, start in seksi_urut:
        i = start + 2  # lewati baris "Top Leaders"/"Top Laggards" + header kolom
        n = 0
        while i < len(lines) and n < 10:
            s = lines[i].strip()
            m = re.match(r'^([A-Z]{4})\s+(-?[\d.]+)\s+([\d.]+)\s+(-?[\d.]+)\s+([A-Z]{4})\s+(-?[\d.]+)\s+([\d.]+)\s+(-?[\d.]+)$', s)
            if m:
                target = "top_leaders" if jenis == "leaders" else "top_laggards"
                out["ihsg"][target].append({"kode": m.group(1), "harga_persen": pct(m.group(2)),
                                             "mcff_triliun": num(m.group(3)), "poin_indeks": num(m.group(4))})
                out["lq45"][target].append({"kode": m.group(5), "harga_persen": pct(m.group(6)),
                                             "mcff_triliun": num(m.group(7)), "poin_indeks": num(m.group(8))})
                n += 1
            i += 1

    return out

def parse_satu_pdf(path: Path):
    with pdfplumber.open(path) as pdf:
        hal1 = parse_hal1(get_text(pdf, 0))
        hal3 = parse_hal3(get_text(pdf, 2)) if len(pdf.pages) > 2 else {}
        hal4 = parse_hal4(get_text(pdf, 3)) if len(pdf.pages) > 3 else {}
        hal5 = parse_hal5(get_text(pdf, 4)) if len(pdf.pages) > 4 else {}

    out = {**hal1, **hal3, **hal4, "index_movers": hal5}
    out["_sumber_pdf"] = path.name
    out["_halaman_diambil"] = [1, 3, 4, 5]
    out["_halaman_dilewati"] = [2, 6, 7, 8, 9, 10]
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--semua", action="store_true")
    ap.add_argument("files", nargs="*")
    args = ap.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(PDF_DIR.glob("ws_*.pdf")) if args.semua else [PDF_DIR / f for f in args.files]

    idx_file = OUTPUT_DIR / "index_weekly.json"
    idx = json.load(open(idx_file, encoding="utf-8")) if idx_file.exists() else {"minggu": []}

    ok = fail = 0
    for p in pdfs:
        if not p.exists():
            print(f"  SKIP (tidak ada): {p.name}")
            continue
        stem = p.stem  # ws_260605
        try:
            data = parse_satu_pdf(p)
            out_path = OUTPUT_DIR / f"{stem}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            ringkas = f"saham:{len(data.get('top_saham',{}).get('volume',[]))} " \
                      f"broker:{len(data.get('top_broker',{}).get('volume',[]))} " \
                      f"gainers:{len(data.get('top_gainers',[]))} " \
                      f"leaders_ihsg:{len(data.get('index_movers',{}).get('ihsg',{}).get('top_leaders',[]))}"
            print(f"  Parsing: {p.name} ... OK  [{ringkas}]")
            tgl_iso = data.get("tanggal_edisi_iso")
            if tgl_iso and tgl_iso not in [m.get("tanggal_edisi_iso") for m in idx["minggu"]]:
                idx["minggu"].append({"stem": stem, "tanggal_edisi_iso": tgl_iso,
                                       "rentang_minggu": data.get("rentang_minggu", "")})
            ok += 1
        except Exception as e:
            print(f"  Parsing: {p.name} ... GAGAL  ({e})")
            fail += 1

    idx["minggu"].sort(key=lambda m: m.get("tanggal_edisi_iso", ""))
    with open(idx_file, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=2)

    print(f"\nSelesai! {ok} OK, {fail} gagal. JSON tersimpan di: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
