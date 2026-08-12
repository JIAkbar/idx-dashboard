"""
IDX Weekly Statistics PDF Parser
=================================
Baca PDF IDX Weekly Statistics -> hasilkan file JSON per minggu.
Output: data-idx/json/ws_YYMMDD.json + data-idx/json/index_weekly.json

PDF sumber (10 halaman). Halaman yang diparse:
  hal 1 - Market Activity (ringkasan volume/nilai/frekuensi minggu ini vs
          minggu lalu, IHSG close/low/high)
  hal 2 - Transaction by Investor (F-F/D-F/F-D/D-D per hari bursa) + Net
          Foreign minggu ini vs lalu -> key "transaksi_investor" & "net_asing"
  hal 3 - Top Stocks Weekly + Top Exchange Members Weekly (by volume/value/
          frequency, 10 baris tiap kategori)
  hal 4 - Stock Trading Recapitulation (RG/TN/NG) + Top Gainers/Losers Weekly
  hal 5 - Index Movers (IHSG & LQ45, top leaders/laggards)
  hal 6 - Trading Summaries (per instrumen, futures, transaksi investor
          asing) -> key "ringkasan_perdagangan"
  hal 7 - IDX Index Weekly Performance -> key "indeks_mingguan". Layout 2
          kolom dan label kadang beda ~4pt vertikal dari angkanya (jadi
          extract_text() memecahnya ke baris terpisah); ditangani dengan
          extract_words() + klaster baris per `top` toleransi longgar
          (~setengah tinggi huruf, jauh di bawah jarak antarbaris ~2x tinggi
          huruf), lalu regex "label 3-angka-desimal + persen" per baris
          rekonstruksi (bisa 2 match per baris = kolom kiri + kanan).
  hal 8 - Global Index Comparison -> key "indeks_global" (baris negara lalu
          baris "NamaIndeks lw tw chg pct" - linear, cukup regex per baris)
  hal 9 - Total Fund Raised YTD -> key "dana_dihimpun". Sel ABS dilewati:
          teks hanya memunculkan 2 dari 3 sel ABS (kolom OTHER/BOND-IDR/
          BOND-USD) sehingga tidak bisa dipetakan yakin; nilainya pun selalu
          "-" di seluruh edisi 2026.

SENGAJA DILEWATI:
  hal 2  - grafik Trading Value by Investor & Market PER/PBV (hanya chart)
  hal 6  - tabel Bonds/Sukuk/ABS outstanding (urutan label vs angka di
           extract_text() tidak stabil: label kadang muncul SETELAH baris
           angkanya, tidak aman dipasangkan)
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

# ─── HALAMAN 2 ─── Transaction by Investor + Net Foreign ────
# Baris data: "dd/mm/yyyy" + 12 angka (Volume F-F/D-F/F-D/D-D, Value idem,
# Frequency idem). Teks sidebar (mis. "June 2-5, 2026") kadang nempel di DEPAN
# tanggal, jadi regex di-search, bukan di-anchor awal baris.
RE_INVESTOR_ROW = re.compile(r'(\d{2})/(\d{2})/(\d{4})((?:\s+-?[\d,.]+){12})\s*$')

def parse_hal2(text):
    out = {}
    baris = []
    for line in text.split("\n"):
        m = RE_INVESTOR_ROW.search(line.strip())
        if m:
            dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
            v = [num(x) for x in m.group(4).split()]
            baris.append({
                "tanggal_iso": f"{yyyy}-{mm}-{dd}",
                "volume_juta_lembar":  {"ff": v[0], "df": v[1], "fd": v[2], "dd": v[3]},
                "nilai_miliar_idr":    {"ff": v[4], "df": v[5], "fd": v[6], "dd": v[7]},
                "frekuensi_ribu_kali": {"ff": v[8], "df": v[9], "fd": v[10], "dd": v[11]},
            })
    if baris:
        out["transaksi_investor"] = baris

    # Blok Net Foreign: 4 angka desimal berurutan (minggu ini b.IDR, m.USD,
    # minggu lalu b.IDR, m.USD) + 2x arah "Net Buy"/"Net Sell". Urutan ini
    # konsisten di semua edisi walau posisi kata This/Last/Week acak.
    i, j = text.find("Net Foreign"), text.find("Foreign Domestic")
    if i != -1 and j > i:
        seg = text[i:j]
        angka = re.findall(r'-?[\d,]+\.\d+', seg)
        arah = re.findall(r'Net (Buy|Sell)', seg)
        if len(angka) == 4 and len(arah) == 2:
            out["net_asing"] = {
                "minggu_ini":  {"arah": "beli" if arah[0] == "Buy" else "jual",
                                "miliar_idr": num(angka[0]), "juta_usd": num(angka[1])},
                "minggu_lalu": {"arah": "beli" if arah[1] == "Buy" else "jual",
                                "miliar_idr": num(angka[2]), "juta_usd": num(angka[3])},
            }
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

# ─── HALAMAN 6 ─── Trading Summaries ────────────────────────
def num_int(s):
    try:    return int(str(s).replace(",", "").strip())
    except: return 0

RE_INSTRUMEN_ROW = re.compile(
    r'(Stock|Right|Structured Warrant|Warrant|ETF|REIT|Total)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$')
KEY_INSTRUMEN = {"Stock": "saham", "Right": "right", "Warrant": "waran",
                 "Structured Warrant": "waran_terstruktur", "ETF": "etf",
                 "REIT": "reit", "Total": "total"}

def parse_hal6(text):
    out = {}
    instrumen = {}
    for line in text.split("\n"):
        m = RE_INSTRUMEN_ROW.search(line.strip())
        if m and KEY_INSTRUMEN[m.group(1)] not in instrumen:
            instrumen[KEY_INSTRUMEN[m.group(1)]] = {
                "volume_lembar": num_int(m.group(2)), "nilai_idr": num_int(m.group(3)),
                "frekuensi_kali": num_int(m.group(4))}
    if instrumen:
        out["instrumen"] = instrumen

    m = re.search(r'Future\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)', text)
    if m:
        out["futures"] = {"volume_kontrak": num_int(m.group(1)),
                          "nilai_idr": num_int(m.group(2)),
                          "frekuensi_kali": num_int(m.group(3))}

    # Buy/Sell hanya dicari SETELAH heading "By Foreign Investor"
    i = text.find("By Foreign Investor")
    if i != -1:
        asing = {}
        for label, key in [("Buy", "beli"), ("Sell", "jual")]:
            m = re.search(rf'{label}\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)', text[i:])
            if m:
                asing[key] = {"volume_lembar": num_int(m.group(1)),
                              "nilai_idr": num_int(m.group(2)),
                              "frekuensi_kali": num_int(m.group(3))}
        if asing:
            out["transaksi_asing"] = asing
    return out

# ─── HALAMAN 7 ─── IDX Index Weekly Performance ─────────────
# Nilai indeks selalu 3 desimal, persen 2 desimal - dipakai sebagai anchor.
RE_INDEKS_ROW = re.compile(
    r'([A-Za-z\[][A-Za-z0-9\[\]()&.\-/ ]*?)\s+'
    r'([\d,]+\.\d{3})\s+([\d,]+\.\d{3})\s+([\d,]+\.\d{3})\s+(-?[\d,]+\.\d{2})%')
RE_SEKSI = re.compile(r'^(Featured|Sharia|Board|Sector|Co-Branding) Indices\s*')

def parse_hal7(page):
    # Rekonstruksi baris visual dari koordinat kata: label kadang tergeser
    # ~4pt vertikal dari angkanya sehingga extract_text() memecahnya. Klaster
    # per `top` dengan toleransi setengah tinggi huruf menyatukan kembali
    # (jarak antarbaris ~2x tinggi huruf, jadi tidak mungkin 2 baris menyatu).
    words = [w for w in page.extract_words() if w.get("upright", True)]
    if not words:
        return []
    tinggi = sorted(w["bottom"] - w["top"] for w in words)[len(words) // 2]
    rows = pdfplumber.utils.cluster_objects(words, lambda w: w["top"], tolerance=tinggi * 0.55)
    hasil = []
    for row in rows:
        line = " ".join(w["text"] for w in sorted(row, key=lambda w: w["x0"]))
        for m in RE_INDEKS_ROW.finditer(line):
            nama = RE_SEKSI.sub("", m.group(1).strip()).strip()
            if not nama or nama in ("Index", "Hi", "Low", "Close", "Change"):
                continue
            hasil.append({"nama": nama, "tertinggi": num(m.group(2)),
                          "terendah": num(m.group(3)), "penutupan": num(m.group(4)),
                          "persen": pct(m.group(5))})
    return hasil

# ─── HALAMAN 8 ─── Global Index Comparison ──────────────────
RE_GLOBAL_ROW = re.compile(
    r'^(.+?)\s+(-?[\d,]+\.\d+)\s+(-?[\d,]+\.\d+)\s+(-?[\d,]+\.\d+)\s+(-?[\d,.]+)%$')
WILAYAH = {"ASEAN", "Asia Pacific", "America", "EMEA"}
# Di sebagian edisi nama negara menyatu di depan baris indeks ("Thailand SET
# Index ..."), di edisi lain di baris tersendiri. Daftar statis buat memisah
# prefix; negara baru yang belum terdaftar cuma bikin negara=None (aman).
NEGARA = sorted(["Philippines", "Thailand", "Malaysia", "Singapore", "Vietnam",
    "Indonesia", "Taiwan", "Japan", "India", "Hong Kong", "China", "Australia",
    "Korea", "Colombia", "Canada", "US", "Mexico", "Brazil", "Chile", "France",
    "Turkey", "Norway", "Spain", "UAE", "UK", "Austria", "Ireland", "Germany",
    "Saudi Arabia", "Poland", "Switzerland", "South Africa", "Qatar", "Israel",
    "Russia"], key=len, reverse=True)

def parse_hal8(text):
    hasil, wilayah, negara = [], None, None
    for line in text.split("\n"):
        s = line.strip()
        if s in WILAYAH:
            wilayah, negara = s, None
            continue
        m = RE_GLOBAL_ROW.match(s)
        if m:
            indeks = m.group(1)
            if negara is None:
                for c in NEGARA:
                    if indeks.startswith(c + " "):
                        negara, indeks = c, indeks[len(c) + 1:]
                        break
            hasil.append({"wilayah": wilayah, "negara": negara, "indeks": indeks,
                          "minggu_lalu": num(m.group(2)), "minggu_ini": num(m.group(3)),
                          "perubahan": num(m.group(4)), "persen": pct(m.group(5))})
            negara = None
        elif s and re.fullmatch(r'[A-Za-z ]{2,30}', s) and s not in (
                "GLOBAL INDEX COMPARISON",):
            negara = s
    return hasil

# ─── HALAMAN 9 ─── Total Fund Raised YTD ────────────────────
ANGKA_STRIP = r'([\d,.]+|-)'  # sel bisa "-" (belum ada)

def _fund(v):
    return None if v == "-" else num(v)

def parse_hal9(text):
    out = {}
    m = re.search(r'Equity Market Bond Market\s+([\d,.]+)\s+([\d,.]+)', text)
    if m:
        out["pasar_saham_triliun"] = num(m.group(1))
        out["pasar_obligasi_triliun"] = num(m.group(2))
    m = re.search(rf'Stocks\s+{ANGKA_STRIP}\s+REIT\s+{ANGKA_STRIP}\s+Corp\. Bonds\s+{ANGKA_STRIP}\s+Corp\. Bonds\s+{ANGKA_STRIP}', text)
    if m:
        out["saham"], out["reit"] = _fund(m.group(1)), _fund(m.group(2))
        out["obligasi_korporasi_idr"], out["obligasi_korporasi_usd"] = _fund(m.group(3)), _fund(m.group(4))
    m = re.search(rf'Rights\s+{ANGKA_STRIP}\s+DINFRA\s+{ANGKA_STRIP}\s+Gov\. Bonds\s+{ANGKA_STRIP}\s+Gov\. Bonds\s+{ANGKA_STRIP}', text)
    if m:
        out["rights"], out["dinfra"] = _fund(m.group(1)), _fund(m.group(2))
        out["obligasi_pemerintah_idr"], out["obligasi_pemerintah_usd"] = _fund(m.group(3)), _fund(m.group(4))
    m = re.search(rf'Warrants\s+{ANGKA_STRIP}\s', text)
    if m:
        out["waran"] = _fund(m.group(1))
    return out

def parse_satu_pdf(path: Path):
    with pdfplumber.open(path) as pdf:
        n = len(pdf.pages)
        hal1 = parse_hal1(get_text(pdf, 0))
        hal2 = parse_hal2(get_text(pdf, 1)) if n > 1 else {}
        hal3 = parse_hal3(get_text(pdf, 2)) if n > 2 else {}
        hal4 = parse_hal4(get_text(pdf, 3)) if n > 3 else {}
        hal5 = parse_hal5(get_text(pdf, 4)) if n > 4 else {}
        hal6 = parse_hal6(get_text(pdf, 5)) if n > 5 else {}
        hal7 = parse_hal7(pdf.pages[6]) if n > 6 else []
        hal8 = parse_hal8(get_text(pdf, 7)) if n > 7 else []
        hal9 = parse_hal9(get_text(pdf, 8)) if n > 8 else {}

    out = {**hal1, **hal2, **hal3, **hal4, "index_movers": hal5}
    if hal6: out["ringkasan_perdagangan"] = hal6
    if hal7: out["indeks_mingguan"] = hal7
    if hal8: out["indeks_global"] = hal8
    if hal9: out["dana_dihimpun"] = hal9
    out["_sumber_pdf"] = path.name
    out["_halaman_diambil"] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    out["_halaman_dilewati"] = [10]
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
                      f"leaders_ihsg:{len(data.get('index_movers',{}).get('ihsg',{}).get('top_leaders',[]))} " \
                      f"inv:{len(data.get('transaksi_investor',[]))} " \
                      f"net:{'y' if 'net_asing' in data else 'n'} " \
                      f"instr:{len(data.get('ringkasan_perdagangan',{}).get('instrumen',{}))} " \
                      f"idx7:{len(data.get('indeks_mingguan',[]))} " \
                      f"glob:{len(data.get('indeks_global',[]))} " \
                      f"dana:{len(data.get('dana_dihimpun',{}))}"
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
