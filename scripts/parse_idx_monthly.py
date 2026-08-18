# -*- coding: utf-8 -*-
"""
IDX Monthly Statistics (Equity) PDF Parser
==========================================
Baca PDF `ms_YYMM.pdf` ("IDX Monthly Statistics for Equity Market") ->
data-idx/json/ms_YYMM.json + data-idx/json/index_monthly.json

Bentuk keluarannya SENGAJA meniru mingguan (`ws_YYMMDD.json` +
`index_weekly.json`) supaya UI bisa memperlakukan harian/mingguan/bulanan
dengan cara yang sama.

RUAS APA YANG DIAMBIL, DAN KENAPA
---------------------------------
Dasarnya: apa yang sudah diambil versi mingguan, supaya bisa dibandingkan.
Yang ditambahkan hanya yang memang cuma ada di edisi bulanan.

  hal  2  ringkasan_pasar      <- padanan `rata_rata_harian` + `ihsg` mingguan
  hal  3  rekap_transaksi      <- padanan `rekap_transaksi` mingguan (RG/NG/TN)
  hal  4  sektor               <- TIDAK ADA di mingguan (11 sektor IDX-IC)
  hal  6  syariah              <- TIDAK ADA di mingguan
  hal  7  sekuritas_tercatat   <- TIDAK ADA di mingguan
  hal  8  top_saham.kapitalisasi
  hal  9  top_saham.value      <- padanan `top_saham.value` mingguan
  hal 10  top_saham.volume     <- padanan `top_saham.volume` mingguan
  hal 11  top_broker.value     <- padanan `top_broker.value` mingguan
  hal 12  top_broker.volume    <- padanan `top_broker.volume` mingguan
  hal 13  top_gainers/top_losers (+ varian LQ45) <- padanan mingguan
  hal 14  index_movers         <- padanan `index_movers` mingguan (IHSG + LQ45)
  hal 15  asing                <- padanan `net_asing` mingguan, jauh lebih lengkap
  hal 19  indeks_kinerja       <- padanan `indeks_mingguan`, tapi horizon
  hal 20                          1M/3M/6M/1Y/3Y/5Y/10Y + volatilitas

BEDA RUAS MINGGUAN vs BULANAN (UI perlu tahu)
---------------------------------------------
Ada di MINGGUAN, TIDAK ada di bulanan:
  - `indeks_global`      — hal 21 bulanan cuma GRAFIK, tanpa satu pun angka
  - `transaksi_investor` — hal 16 bulanan cuma grafik donat, tanpa angka
  - `dana_dihimpun`      — tak ada padanannya sama sekali di edisi bulanan
  - `top_saham.frekuensi` & `top_broker.frekuensi` — bulanan hanya menerbitkan
    kapitalisasi/nilai/volume untuk saham, dan nilai/volume untuk broker
Ada di BULANAN, TIDAK ada di mingguan:
  - `sektor`, `syariah`, `sekuritas_tercatat`, `indeks_kinerja`
  - kolom pembanding YoY (bulan yang sama tahun lalu) dan YTD
  - Market PER & PBV (di dalam `ringkasan_pasar`)

SENGAJA DILEWATI (isinya grafik, bukan angka):
  hal 1 (sampul), 5 (top-3 pemimpin sektor — nested, belum ada yang memakai),
  16, 17, 18, 21, 22 (appendix)

PENAMAAN KUNCI `ringkasan_pasar`/`syariah`/`asing`: slug dari LABEL ASLI PDF
(mis. `market_capitalization_tr_idr`), bukan tabel terjemahan buatan tangan.
Alasannya: labelnya 30+ baris dan IDX menambah/mengganti baris antar edisi —
tabel terjemahan akan MENJATUHKAN baris baru tanpa satu pun galat. Tiap entri
tetap membawa `label` aslinya supaya UI tak perlu menerjemahkan sendiri.

Cara pakai:
  python scripts/parse_idx_monthly.py ms_2607.pdf
  python scripts/parse_idx_monthly.py --semua
"""

import argparse
import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT_DIR = Path(__file__).parent.parent
OUTPUT_DIR = ROOT_DIR / "data-idx" / "json"
PDF_DIR = ROOT_DIR / "data-idx" / "monthly"

BULAN_ID = {"January": "Januari", "February": "Februari", "March": "Maret",
            "April": "April", "May": "Mei", "June": "Juni", "July": "Juli",
            "August": "Agustus", "September": "September", "October": "Oktober",
            "November": "November", "December": "Desember"}
BULAN_NO = {n: i + 1 for i, n in enumerate(BULAN_ID)}

# Tiap halaman menempelkan "July 2026" sebagai stempel di sisi kiri, dan
# extract_text() menyisipkannya di TENGAH baris data. Dibersihkan lebih dulu,
# kalau tidak label barisnya ikut terbawa stempel.
RE_STEMPEL = re.compile(r"\b(?:" + "|".join(BULAN_ID) + r")\s+\d{4}\b")


def angka(s):
    """'1,234.5' -> 1234.5 · '-' / '' -> None. Tanda % dibuang."""
    s = str(s).replace(",", "").replace("%", "").replace("+", "").strip()
    if s in ("", "-", "N/A"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def teks(pdf, i):
    if i >= len(pdf.pages):
        return ""
    baris = (pdf.pages[i].extract_text() or "").split("\n")
    return "\n".join(RE_STEMPEL.sub("", b).strip() for b in baris)


def dua_kolom(pdf, i):
    """Belah halaman jadi (teks_kiri, teks_kanan) memakai posisi x kata.

    Halaman 13 & 14 mencetak dua tabel BERDAMPINGAN (Gainers|Losers,
    Leaders|Laggards) dan extract_text() menggabungkannya jadi satu baris.
    Menebak "kecocokan pertama = kolom kiri" bekerja selama kolom kiri selalu
    lebih panjang — dan itu asumsi yang akan patah diam-diam di bulan pertama
    yang jumlah barisnya terbalik (LQ45 Juli 2026 sudah 10 lawan 4). Posisi x
    tidak menebak apa pun.
    """
    if i >= len(pdf.pages):
        return "", ""
    hal = pdf.pages[i]
    tengah = hal.width / 2
    sisi = {True: {}, False: {}}   # kiri/kanan -> {baris_y: [kata]}
    for w in hal.extract_words():
        kiri = w["x0"] < tengah
        sisi[kiri].setdefault(round(w["top"] / 3), []).append(w)
    out = []
    for kiri in (True, False):
        baris = []
        for y in sorted(sisi[kiri]):
            kata = sorted(sisi[kiri][y], key=lambda w: w["x0"])
            baris.append(RE_STEMPEL.sub("", " ".join(w["text"] for w in kata)).strip())
        out.append("\n".join(baris))
    return out[0], out[1]


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    return re.sub(r"_+", "_", s)


# ─── hal 2 / 6 / 15 — tabel "label + bulan ini + bulan lalu + tahun lalu + MoM + YoY"
RE_NILAI = re.compile(r"^[+-]?[\d,]+\.?\d*%?$|^-$")
RE_SATUAN = re.compile(r"\s*(?:tr\.|b\.|m\.|th\.)?\s*(?:IDR|USD|shares|times|%)\s*$")
RE_LANJUT = re.compile(r"^(?:tr\.|b\.|m\.|th\.)\s")


def tabel_banding(txt):
    """Baris apa pun yang berakhir dengan 5 sel angka (atau '-').

    Dipakai bersama oleh tiga halaman berbentuk sama (hal 2, 6, 15). Dua jenis
    baris TIDAK membawa labelnya sendiri dan wajib mewarisi baris di atasnya —
    kalau tidak, keduanya bertabrakan di kunci yang sama dan yang belakangan
    HILANG tanpa satu pun galat (terukur: tiga baris 'Of total IDX %' di hal 15
    menyusut jadi satu):
      - baris satuan lanjutan  : 'b. USD' setelah 'Market Capitalization tr. IDR'
      - baris rasio            : 'Of total IDX %' setelah Volume/Value/Frequency
      - Buy/Sell/Net           : 'Sell m. shares' setelah 'Volume Buy m. shares'
    """
    out, induk, dasar, bagian = {}, "", "", ""
    for baris in txt.split("\n"):
        tok = baris.split()
        if len(tok) < 6 or not all(RE_NILAI.match(t) for t in tok[-5:]):
            # baris tanpa angka yang diawali huruf = judul bagian
            if baris and baris[0].isalpha() and not any(c.isdigit() for c in baris):
                bagian = baris.strip()
            continue
        label = " ".join(tok[:-5]).strip()
        nilai = tok[-5:]
        if (RE_LANJUT.match(label) or label.startswith("Of total")) and dasar:
            label_penuh = f"{dasar} {label}"
        elif re.match(r"^(Buy|Sell|Net)\b", label) and induk:
            label_penuh = f"{induk} {label}"
        else:
            label_penuh = label
            dasar = RE_SATUAN.sub("", label).strip() or label
            induk = label.split()[0] if label else induk
        kunci = slug(f"{bagian} {label_penuh}") if bagian else slug(label_penuh)
        if kunci in out:      # jangan menimpa diam-diam
            continue
        out[kunci] = {
            "label": label_penuh,
            "bagian": bagian or None,
            "bulan_ini": angka(nilai[0]),
            "bulan_lalu": angka(nilai[1]),
            "tahun_lalu": angka(nilai[2]),
            "mom": angka(nilai[3]),
            "yoy": angka(nilai[4]),
        }
    return out


# ─── hal 3 — rekap transaksi RG/NG/TN ────────────────────────────
PASAR = {"RG": "reguler", "NG": "negosiasi", "TN": "tunai"}
SKALA = {"m. shares": 1e6, "th. shares": 1e3, "b. IDR": 1e9, "m. IDR": 1e6,
         "th. times": 1e3, "times": 1.0, "shares": 1.0, "th. IDR": 1e3}
# TANPA jangkar akhir baris: blok Stocks dan Futures saling menyisip, jadi
# baris "NG times 17,072 109,606" bisa disambung "Total Value m. IDR 431 2,427"
# milik blok lain. Yang dianggarkan cuma dua angka pertama sesudah satuannya.
RE_PASAR = re.compile(r"^(RG|NG|TN)\s+((?:th\.|m\.|b\.)?\s?(?:shares|IDR|times))\s+([\d,]+)\s+([\d,]+)\b")
RE_TOTAL = re.compile(r"^Total (Volume|Value|Frequency)\s+((?:th\.|m\.|b\.)?\s?(?:shares|IDR|times))\s+([\d,]+)\s+([\d,]+)\b")
RUAS_PASAR = {"shares": "volume", "IDR": "nilai", "times": "frekuensi"}
# Satuan yang menandai blok SAHAM di halaman itu. Halaman 3 memuat enam blok
# (Stocks/ETFs/REITs/Futures/Rights/Warrants) yang teksnya SALING SISIPAN;
# yang membedakan blok saham adalah satuannya — ETF pakai 'th. shares',
# REIT 'shares', Futures 'contracts'. Menyaring per satuan jauh lebih aman
# daripada mencoba memisahkan kolom berdasarkan posisi.
SATUAN_SAHAM = {"m. shares", "b. IDR", "th. times"}


def parse_hal3(txt):
    out = {v: {} for v in PASAR.values()}
    total = {}
    for baris in txt.split("\n"):
        baris = baris.strip()
        m = RE_PASAR.match(baris)
        if m:
            kode, satuan, bln, ytd = m.groups()
            ruas = RUAS_PASAR[satuan.split()[-1]]
            skala = SKALA.get(satuan.strip(), 1.0)
            out[PASAR[kode]][ruas] = {"bulan": angka(bln) * skala, "ytd": angka(ytd) * skala}
            continue
        m = RE_TOTAL.match(baris)
        if m and m.group(2).strip() in SATUAN_SAHAM:
            ruas = {"Volume": "volume", "Value": "nilai", "Frequency": "frekuensi"}[m.group(1)]
            # YANG PERTAMA MENANG. Blok Rights/Warrants/Structured Warrants di
            # bawahnya juga memakai satuan 'm. shares', jadi "yang terakhir
            # menang" diam-diam menaruh volume Waran Terstruktur (28.456 juta)
            # sebagai total saham (655.598 juta) — 23x meleset, tanpa galat.
            if ruas in total:
                continue
            skala = SKALA.get(m.group(2).strip(), 1.0)
            total[ruas] = {"bulan": angka(m.group(3)) * skala, "ytd": angka(m.group(4)) * skala}
    if total:
        out["total"] = total
    return {k: v for k, v in out.items() if v}


# ─── hal 4 — sektor IDX-IC ───────────────────────────────────────
RE_SEKTOR = re.compile(
    r"^([A-Z])\s+(.+?)\s+([\d,]+)\s+([\d.]+)%\s+([\d,]+)\s+([\d.]+)%\s+"
    r"([\d,]+)\s+([\d.]+)%\s+([\d,]+)\s+([\d,]+)$")


def parse_hal4(txt):
    out = []
    for baris in txt.split("\n"):
        m = RE_SEKTOR.match(baris.strip())
        if not m:
            continue
        g = m.groups()
        out.append({
            "kode": g[0], "nama": g[1].strip(),
            "jumlah_saham": angka(g[2]), "persen_saham": angka(g[3]),
            "kapitalisasi_miliar_idr": angka(g[4]), "persen_kapitalisasi": angka(g[5]),
            "nilai_miliar_idr": angka(g[6]), "persen_nilai": angka(g[7]),
            "volume_juta_lembar": angka(g[8]), "frekuensi_kali": angka(g[9]),
        })
    return out


# ─── hal 7 — jumlah efek tercatat ────────────────────────────────
EFEK = {"Stock": "saham", "Structured Warrant": "waran_terstruktur",
        "ETF": "etf", "REIT": "reit", "Futures": "futures"}


def parse_hal7(txt):
    out = {}
    for baris in txt.split("\n"):
        m = re.fullmatch(r"(Stock|Structured Warrant|ETF|REIT|Futures)\s+([\d,]+)", baris.strip())
        if m:
            out[EFEK[m.group(1)]] = angka(m.group(2))
    return out


# ─── hal 8/9/10 — top saham ──────────────────────────────────────
RE_TOPSAHAM = re.compile(
    r"^([A-Z]{4})\s+(.+?)\s+([S-])\s+([\d,]+)\s+([\d.]+)%\s+([\d,]+)\s+(-?[\d,.]+|-)%?$")


def parse_top_saham(txt):
    out = []
    for baris in txt.split("\n"):
        m = RE_TOPSAHAM.match(baris.strip())
        if not m:
            continue
        g = m.groups()
        out.append({"kode": g[0], "nama": g[1].strip(), "syariah": g[2] == "S",
                    "bulan_ini": angka(g[3]), "persen_total": angka(g[4]),
                    "bulan_lalu": angka(g[5]), "mom": angka(g[6])})
    return out


# ─── hal 11/12 — top anggota bursa ───────────────────────────────
RE_TOPBROKER = re.compile(
    r"^([A-Z]{2})\s+(.+?)\s+([\d,]+)\s+([\d.]+)%\s+([\d,]+)\s+(-?[\d,.]+|-)%?$")


def parse_top_broker(txt):
    out = []
    for baris in txt.split("\n"):
        m = RE_TOPBROKER.match(baris.strip())
        if not m:
            continue
        g = m.groups()
        out.append({"kode": g[0], "nama": g[1].strip(), "bulan_ini": angka(g[2]),
                    "persen_total": angka(g[3]), "bulan_lalu": angka(g[4]),
                    "mom": angka(g[5])})
    return out


# ─── hal 13 — gainers/losers (dua kolom per baris) ───────────────
RE_GL = re.compile(r"([A-Z]{4})\s+([\d,]+)\s+([\d,]+)\s+(-?[\d.]+)%")


def parse_hal13(kiri, kanan):
    """Kiri = gainers, kanan = losers (dibelah per posisi x, lihat `dua_kolom`).
    Tiap sisi lalu dipotong lagi di judul 'Top LQ45 ...' jadi blok All & LQ45."""
    hasil = {}
    for sisi, nama_ruas in ((kiri, "top_gainers"), (kanan, "top_losers")):
        blok = re.split(r"Top LQ45 .*", sisi)
        for akhiran, isi in (("", blok[0]), ("_lq45", blok[1] if len(blok) > 1 else "")):
            hasil[f"{nama_ruas}{akhiran}"] = [
                {"kode": m.group(1), "sebelumnya": angka(m.group(2)),
                 "penutupan": angka(m.group(3)), "persen": angka(m.group(4))}
                for m in RE_GL.finditer(isi)]
    return hasil


# ─── hal 14 — index movers ───────────────────────────────────────
RE_MOVER = re.compile(r"([A-Z]{4})\s+(-?[\d.]+)%\s+([\d,.]+)\s+([+-][\d,.]+)")


def _movers(blok):
    out = []
    for m in RE_MOVER.finditer(blok):
        poin = angka(m.group(4))
        out.append({"kode": m.group(1), "persen": angka(m.group(2)),
                    "kapitalisasi_triliun_idr": angka(m.group(3)),
                    "poin": -abs(poin) if m.group(4).startswith("-") else poin})
    return out


def parse_hal14(kiri, kanan):
    """Kiri = leaders, kanan = laggards; tiap sisi dipotong di 'Top LQ45 ...'."""
    out = {"ihsg": {}, "lq45": {}}
    for sisi, ruas in ((kiri, "top_leaders"), (kanan, "top_laggards")):
        blok = re.split(r"Top LQ45 .*", sisi)
        out["ihsg"][ruas] = _movers(blok[0])
        out["lq45"][ruas] = _movers(blok[1] if len(blok) > 1 else "")
    return out


# ─── hal 19/20 — kinerja indeks multi-horizon ────────────────────
RE_INDEKS = re.compile(
    r"^([A-Z][A-Z0-9\-]{1,15})\s+(.+?)((?:\s+(?:-?[\d,]+\.\d+%|-)){8})$")
HORIZON = ["m1", "m3", "m6", "y1", "y3", "y5", "y10", "volatilitas"]


def parse_indeks(txt, kelompok_awal=""):
    out, kelompok = [], kelompok_awal
    for baris in txt.split("\n"):
        baris = baris.strip()
        if re.fullmatch(r"[A-Za-z ,&\-]+", baris) and baris:
            kelompok = baris
            continue
        m = RE_INDEKS.match(baris)
        if not m:
            continue
        nilai = m.group(3).split()
        rec = {"kode": m.group(1), "nama": m.group(2).strip(), "kelompok": kelompok}
        rec.update({h: angka(v) for h, v in zip(HORIZON, nilai)})
        out.append(rec)
    return out


# ─── perakit ─────────────────────────────────────────────────────
DIAMBIL = [2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 20]
DILEWATI = {1: "sampul", 5: "top-3 pemimpin sektor (nested, belum dipakai)",
            16: "grafik donat investor — tanpa angka",
            17: "grafik LQ45/IDX80 — tanpa angka",
            18: "grafik indeks sektor — tanpa angka",
            21: "grafik indeks global — tanpa angka (mingguan PUNYA angkanya)",
            22: "appendix"}


def parse(pdf_path: Path) -> dict:
    stem = pdf_path.stem                      # ms_2607
    yymm = stem.split("_")[-1]
    out = {"periode": f"20{yymm[:2]}-{yymm[2:]}"}

    with pdfplumber.open(pdf_path) as pdf:
        judul = teks(pdf, 0) or (pdf.pages[0].extract_text() or "")
        m = re.search(r"(" + "|".join(BULAN_ID) + r")\s+(\d{4})", pdf.pages[0].extract_text() or "")
        if m:
            out["periode_id"] = f"{BULAN_ID[m.group(1)]} {m.group(2)}"
            out["periode"] = f"{m.group(2)}-{BULAN_NO[m.group(1)]:02d}"
        elif True:
            out.setdefault("periode_id", None)

        # Tiap halaman ditangkap SENDIRI: satu halaman yang berubah layout
        # tak boleh menghapus 14 halaman lain dari berkas keluaran.
        rencana = [
            ("ringkasan_pasar",    1,  lambda t: tabel_banding(t)),
            ("rekap_transaksi",    2,  parse_hal3),
            ("sektor",             3,  parse_hal4),
            ("syariah",            5,  lambda t: tabel_banding(t)),
            ("sekuritas_tercatat", 6,  parse_hal7),
            ("_top_mcap",          7,  parse_top_saham),
            ("_top_value",         8,  parse_top_saham),
            ("_top_volume",        9,  parse_top_saham),
            ("_brk_value",        10,  parse_top_broker),
            ("_brk_volume",       11,  parse_top_broker),
            ("_gl",               12,  None),   # dua kolom — lihat `dua_kolom`
            ("index_movers",      13,  None),
            ("asing",             14,  lambda t: tabel_banding(t)),
            ("_idx1",             18,  lambda t: parse_indeks(t, "Featured")),
            ("_idx2",             19,  lambda t: parse_indeks(t, "Sharia")),
        ]
        dua = {"_gl": parse_hal13, "index_movers": parse_hal14}
        gagal = []
        for kunci, hal, fn in rencana:
            try:
                if kunci in dua:
                    out[kunci] = dua[kunci](*dua_kolom(pdf, hal))
                else:
                    out[kunci] = fn(teks(pdf, hal))
            except Exception as e:  # noqa: BLE001
                gagal.append(f"hal {hal + 1}: {type(e).__name__}: {e}")
                out[kunci] = None

    out["top_saham"] = {"kapitalisasi": out.pop("_top_mcap") or [],
                        "value": out.pop("_top_value") or [],
                        "volume": out.pop("_top_volume") or []}
    out["top_broker"] = {"value": out.pop("_brk_value") or [],
                         "volume": out.pop("_brk_volume") or []}
    out.update(out.pop("_gl") or {})
    # Baris sorot "Top/Worst Performing Index" mengulang indeks yang juga
    # muncul di daftar bawahnya -> dedup per kode, yang pertama menang.
    gabung, seen = [], set()
    for rec in (out.pop("_idx1") or []) + (out.pop("_idx2") or []):
        if rec["kode"] in seen:
            continue
        seen.add(rec["kode"])
        gabung.append(rec)
    out["indeks_kinerja"] = gabung

    out["_sumber_pdf"] = pdf_path.name
    out["_halaman_diambil"] = DIAMBIL
    out["_halaman_dilewati"] = [f"hal {k}: {v}" for k, v in DILEWATI.items()]
    if gagal:
        out["_gagal"] = gagal
    return out


def tulis_index():
    baris = []
    for f in sorted(OUTPUT_DIR.glob("ms_*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
            baris.append({"stem": f.stem, "periode": d.get("periode"),
                          "periode_id": d.get("periode_id")})
        except Exception as e:  # noqa: BLE001
            print(f"  [ERR] index melewati {f.name}: {e}")
    baris.sort(key=lambda b: b["periode"] or "")
    (OUTPUT_DIR / "index_monthly.json").write_text(
        json.dumps({"bulan": baris}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")
    print(f"index_monthly.json: {len(baris)} periode")


def periksa():
    """Swauji tanpa jaringan atas SELURUH ms_*.json yang sudah ada.

    Kuncinya satu invarian yang datang dari DUA halaman berbeda: jumlah nilai
    transaksi 11 sektor (hal 4) harus sama dengan total nilai pasar saham
    (hal 2 & 3). Kalau salah satu tabel salah baca — kolom bergeser, blok
    Waran ikut terhitung, sektor tercecer — angkanya langsung berpisah.
    Toleransi 0,01% menampung pembulatan PDF (nilainya dicetak bulat).
    """
    berkas = sorted(OUTPUT_DIR.glob("ms_*.json"))
    assert berkas, "belum ada ms_*.json — jalankan --semua dulu"
    for f in berkas:
        d = json.loads(f.read_text(encoding="utf-8"))
        sektor = d["sektor"]
        assert len(sektor) == 11, f"{f.name}: sektor {len(sektor)} != 11"
        jml = sum(s["nilai_miliar_idr"] for s in sektor)
        tot = d["rekap_transaksi"]["total"]["nilai"]["bulan"] / 1e9
        assert abs(jml - tot) / tot < 1e-4, f"{f.name}: sektor {jml} vs total {tot}"
        assert d["top_gainers"] and d["top_losers"], f"{f.name}: gainers/losers kosong"
        assert all(g["persen"] > 0 for g in d["top_gainers"]), f"{f.name}: gainer negatif — kolom tertukar"
        assert all(l["persen"] < 0 for l in d["top_losers"]), f"{f.name}: loser positif — kolom tertukar"
        assert all(m["poin"] > 0 for m in d["index_movers"]["ihsg"]["top_leaders"]), f"{f.name}: leader poin negatif"
        assert len(d["indeks_kinerja"]) > 30, f"{f.name}: indeks cuma {len(d['indeks_kinerja'])}"
        assert d["asing"], f"{f.name}: ruas asing kosong"
    print(f"parse_idx_monthly: swauji lolos — {len(berkas)} periode konsisten")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", nargs="?")
    ap.add_argument("--semua", action="store_true")
    ap.add_argument("--periksa", action="store_true", help="swauji invarian, tanpa parsing ulang")
    args = ap.parse_args()

    if args.periksa:
        periksa()
        return

    daftar = sorted(PDF_DIR.glob("ms_*.pdf")) if args.semua else [PDF_DIR / args.pdf]
    if not daftar:
        print("Tidak ada PDF bulanan di data-idx/monthly/")
        sys.exit(1)

    ok = 0
    for p in daftar:
        try:
            d = parse(p)
            out = OUTPUT_DIR / f"{p.stem}.json"
            out.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")),
                           encoding="utf-8")
            n = len(d.get("sektor") or []), len(d.get("indeks_kinerja") or [])
            print(f"  [OK]   {out.name} — {n[0]} sektor, {n[1]} indeks"
                  + (f" — CATATAN: {d['_gagal']}" if d.get("_gagal") else ""))
            ok += 1
        except Exception as e:  # noqa: BLE001 — satu PDF gagal != sisanya batal
            print(f"  [ERR]  {p.name}: {type(e).__name__}: {e}")
    tulis_index()
    print(f"\nSelesai: {ok}/{len(daftar)} PDF terparsing.")
    if daftar and ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
