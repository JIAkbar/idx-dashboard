# -*- coding: utf-8 -*-
"""Panen laporan keuangan RESMI IDX (XLSX ber-XBRL) -> data-idx/json/keuangan_idx/<TICKER>.json

Tugas #156. Kenapa: sumber lama (`fetch_keuangan.py`, yfinance) berlubang --
BBCA (bank terbesar di bursa) periode 2026-06-30 punya cogs/gross_profit/
operating_income/eps semuanya null, dan 313 dari 959 emiten tak punya berkas
sama sekali. XBRL IDX bertag tetap per baris dan mencakup 778 emiten TW2 2026.

SKEMA KELUARAN identik dengan `keuangan/<TICKER>.json` supaya bisa dipakai
tanpa mengubah pembacanya:

    {"ticker","currency","diperbarui","kuartal":{tanggal:{15 ruas}},"tahunan":{...}}

plus satu ruas tambahan `"sumber": "idx-xbrl"` supaya asalnya bisa dibedakan
dari berkas yfinance. Berkas ini TIDAK menimpa `keuangan/` -- direktori baru,
keputusan menggabungkan itu ada di Johan.

CARA KERJA
----------
1. `GetFinancialReport` (docs/sumber-fundamental-idx.md #6.1) sekali panggil
   dengan `kodeEmiten` kosong mengembalikan seluruh emiten untuk satu
   (year, periode) -- jauh lebih murah daripada memanggil per emiten.
2. Unduh lampiran `FinancialStatement-*.xlsx`, parse LANGSUNG DARI MEMORI
   (`io.BytesIO`, tanpa pernah ditulis ke disk) dengan openpyxl, lalu buang.
   Tidak ada cache yang perlu di-gitignore -- byte-nya tak pernah menyentuh
   filesystem.
3. Satu XLSX berisi puluhan sheet, kodenya BEDA per industri (mis. 1xxx=Umum,
   3xxx=Infrastruktur, 4xxx=Keuangan&Syariah) -- BUKAN nomor tetap, jadi
   skrip ini mengklasifikasikan sheet lewat JUDULnya (baris pertama kolom A):
   "statement of financial position" = neraca, "statement of profit or
   loss" = laba rugi, "statement of cash flow" = arus kas. Sheet catatan
   ("notes to the financial statements ...") sengaja DILEWATI supaya
   breakdown di catatan tak terhitung ganda dengan total di laporan utama.
4. Tiap baris laporan: kolom A = label Indonesia, B = nilai periode
   berjalan, C = nilai pembanding, D = label Inggris. Dicocokkan lewat
   daftar label Inggris berprioritas (lihat *_LABELS) karena nama baris
   beda antar template industri -- bank misalnya TAK PUNYA baris "Revenue"
   sama sekali (pendapatan bunga/premi/komisi terpisah, tanpa satu baris
   total yang setara). Itu ketiadaan konsep, bukan bug -- makanya null.
5. Skala & mata uang dibaca dari sheet `1000000` ruas "Level of rounding
   used in financial statements" dan "Description of presentation
   currency" -- BUKAN diasumsikan. Diuji: BBCA/TLKM/ASII/ACST semuanya
   "Jutaan / In Million" + "Rupiah / IDR", tapi emiten tambang/lain bisa
   melapor dalam USD atau satuan penuh, jadi dibaca per-berkas.

BATASAN YANG DISADARI (baca sebelum menambah periode)
-------------------------------------------------------
- **Nilai laba-rugi & arus kas di laporan interim IDX KUMULATIF** sejak awal
  tahun buku (mis. TW2 = Jan-Jun), BUKAN kuartal diskret seperti kebiasaan
  yfinance (yang mengurangi TW2 kumulatif dengan TW1 kumulatif). Neraca tidak
  terpengaruh -- itu titik waktu (instant), bukan kumulatif. Menghitung
  diskret perlu TW1 dan TW2 sama-sama dipanen lalu diselisihkan -- belum
  dikerjakan di sini.
- "tahunan" akan KOSONG kalau hanya `--periode tw2` yang pernah dijalankan --
  laporan interim tak berisi angka tahun penuh teraudit. Isinya baru terisi
  kalau skrip ini dijalankan lagi dengan `--periode audit` (lihat "MENAMBAH
  PERIODE" di bawah).
- revenue/cogs/gross_profit/operating_income sering NULL untuk bank &
  lembaga keuangan -- taksonomi XBRL "Financial and Sharia Industry" memang
  tak punya baris "Revenue" tunggal. Diverifikasi di BBCA.
- total_debt dijumlahkan dari baris pinjaman/obligasi/efek yang diterbitkan
  di NERACA UTAMA saja (bukan sheet catatan), supaya tak dobel hitung.
  Kalau strukturnya jauh beda dari yang diuji (BBCA/TLKM/ASII/ACST), bisa
  meleset atau kosong.
- free_cf = arus kas operasi - belanja modal ("acquisition of property and
  equipment/plant"). Kalau baris belanja modal tak ketemu, free_cf ikut
  null (bukan ditebak).

TIDAK BOLEH DIJALANKAN DARI GITHUB ACTIONS / RUNNER DATACENTER -- endpoint
IDX menjawab 403 dari sana, terverifikasi 16 Agu 2026
(docs/sumber-fundamental-idx.md). Hanya jalan dari IP rumahan
(JALANKAN_OTOMATIS.bat / manual).

PAKAI
-----
  python scripts/panen_keuangan_idx.py --tickers BBCA,TLKM,ASII
  python scripts/panen_keuangan_idx.py --semua                  # 778 emiten TW2 2026
  python scripts/panen_keuangan_idx.py --semua --paksa          # ulang walau sudah ada
  python scripts/panen_keuangan_idx.py --semua --periode tw1    # tambah TW1

Emiten yang berkasnya SUDAH punya data untuk (tanggal, bucket) yang diminta
dilewati otomatis -- resumable kalau 778 emiten putus di tengah jalan, dan
sekaligus jadi cara menambah periode lain (lihat di bawah).

MENAMBAH PERIODE LAIN (pekerjaan berikutnya)
---------------------------------------------
Jalankan lagi dengan `--periode`/`--tahun` berbeda. Skrip MENGGABUNG ke
berkas yang sudah ada (union per tanggal), bukan menimpa seluruh berkas --
jadi TW1+TW2+TW3+audit bisa ditumpuk dengan menjalankan berkali-kali.
`--periode audit` mengisi bucket "tahunan"; `tw1`/`tw2`/`tw3` mengisi
"kuartal". `--paksa` memaksa refetch walau tanggal itu sudah ada (mis. kalau
emiten merevisi laporan).
"""
from __future__ import annotations

import argparse
import io
import json
import random
import sys
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_fundamental import DEFAULT_TICKERS  # reuse -- lihat CLAUDE.md rung 2

AKAR = Path(__file__).resolve().parent.parent
KELUARAN_DIR = AKAR / "data-idx" / "json" / "keuangan_idx"
WIB = timezone(timedelta(hours=7))

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HEADER = {"User-Agent": UA, "Referer": "https://www.idx.co.id/id", "Accept": "application/json"}
# Unduhan xlsx GAGAL 406 kalau dikirim header "Accept: application/json" yang
# sama dengan panggilan API JSON -- perlu header terpisah tanpa itu.
HEADER_FILE = {"User-Agent": UA, "Referer": "https://www.idx.co.id/id"}
PEMANASAN = "https://www.idx.co.id/id"
LIST_URL = "https://www.idx.co.id/primary/ListedCompany/GetFinancialReport"
HOST = "https://www.idx.co.id"

JEDA = (1.0, 2.2)               # jeda acak antar unduhan xlsx, detik
TUNGGU_ULANG = (5, 15, 45)      # backoff kalau 403/429/gagal jaringan

PERIODE_AKHIR = {"tw1": "03-31", "tw2": "06-30", "tw3": "09-30", "audit": "12-31"}

ALL_KEYS = [
    "revenue", "cogs", "gross_profit", "operating_income", "net_income", "eps",
    "total_assets", "total_liabilities", "equity", "cash", "total_debt",
    "operating_cf", "investing_cf", "financing_cf", "free_cf",
]

# Label Inggris (XBRL StandardLabel), berprioritas -- yang pertama ketemu
# (dengan nilai bukan None) di sheet bertipe terkait yang menang.
LABARUGI_REVENUE = ["Sales and revenue", "Net revenue", "Revenue"]
LABARUGI_COGS = ["Cost of sales and revenue", "Cost of revenue"]
LABARUGI_GROSS = ["Total gross profit", "Gross profit"]
LABARUGI_OPINC = [
    "Total profit from operation", "Total profit (loss) from operation",
    "Profit (loss) from operation", "Operating profit (loss)",
]
LABARUGI_NETINC = ["Profit (loss) attributable to parent entity", "Total profit (loss)"]
LABARUGI_EPS = [
    "Basic earnings per share attributable to equity owners of the parent entity",
    "Basic earnings (loss) per share from continuing operations",
    "Earnings (loss) per share",
]
NERACA_ASET = ["Total assets"]
NERACA_LIAB = ["Total liabilities"]
NERACA_EKUITAS = ["Total equity"]
NERACA_KAS = ["Cash and cash equivalents"]
KAS_OPERASI = ["Total net cash flows received from (used in) operating activities"]
KAS_INVESTASI = ["Total net cash flows received from (used in) investing activities"]
KAS_PENDANAAN = ["Total net cash flows received from (used in) financing activities"]
KAS_AKHIR = ["Cash and cash equivalents cash flows, end of the period"]
KAS_CAPEX = [
    "Payments for acquisition of property and equipment",
    "Payments for acquisition of property, plant and equipment",
]
# Dijumlahkan (bukan diprioritaskan) -- baris-baris pinjaman/obligasi/efek
# berbunga di NERACA UTAMA. Aman dijumlahkan karena hanya SATU varian sheet
# neraca yang terisi per emiten (lihat cari_peta), jadi tak dobel hitung.
NERACA_DEBT_LABELS = [
    "Short term bank loans", "Long-term bank loans", "Current maturities of bank loans",
    "Bonds payable", "Long-term bonds payable", "Current maturities of bonds payable",
    "Other borrowings", "Long-term other borrowings", "Current maturities of other borrowings",
    "Borrowings third parties", "Borrowings related parties",
    "Others securities issued", "Bank securities issued",
    "Subordinated bonds", "Subordinated loans third parties", "Subordinated loans related parties",
    "Subordinated mudharabah sukuk",
]


class Ditolak(Exception):
    """IDX menolak berturut-turut (403/429) -- isyarat berhenti."""


def tanggal_akhir(tahun: int, periode: str) -> str:
    return f"{tahun}-{PERIODE_AKHIR[periode]}"


def klasifikasi_judul(judul: str) -> str | None:
    j = judul.lower()
    if "statement of financial position" in j:
        return "neraca"
    if "statement of profit or loss" in j:
        return "labarugi"
    if "statement of cash flow" in j:
        return "kas"
    return None


def peta_dari_tipe(wb, tipe: str) -> dict[str, float]:
    """Gabungkan seluruh sheet bertipe `tipe` jadi satu peta label_en(lower) -> nilai
    periode berjalan. Hanya sheet yang JUDULnya cocok yang disentuh (sheet
    catatan/"notes" otomatis terlewat). Kalau ada beberapa varian sheet untuk
    tipe yang sama (mis. "by function" vs "by nature"), hanya satu yang
    benar-benar terisi angka -- yang lain tetap None dan tak menimpa."""
    peta: dict[str, float] = {}
    for nama in wb.sheetnames:
        ws = wb[nama]
        baris_iter = ws.iter_rows(values_only=True)
        try:
            judul = next(baris_iter)[0]
        except StopIteration:
            continue
        if not isinstance(judul, str) or klasifikasi_judul(judul) != tipe:
            continue
        for row in baris_iter:
            if len(row) < 4:
                continue
            label_en, nilai = row[3], row[1]
            if isinstance(label_en, str) and nilai is not None:
                kunci = label_en.strip().lower()
                if kunci not in peta:
                    peta[kunci] = nilai
    return peta


def cari(peta: dict, kandidat: list[str]):
    for lbl in kandidat:
        v = peta.get(lbl.lower())
        if v is not None:
            return v
    return None


def info_umum(wb) -> tuple[str, int]:
    """(currency, skala) dari sheet 1000000 -- dibaca, bukan diasumsikan."""
    currency, skala = "IDR", 1_000_000
    if "1000000" not in wb.sheetnames:
        return currency, skala
    for row in wb["1000000"].iter_rows(values_only=True):
        if len(row) < 3 or not isinstance(row[2], str):
            continue
        label_en = row[2].lower()
        if "description of presentation currency" in label_en:
            val = str(row[1] or "")
            if "/" in val:
                currency = val.split("/")[-1].strip().upper() or "IDR"
        elif "level of rounding" in label_en:
            val = str(row[1] or "").lower()
            # Diuji: BBCA/ASII/ACST = "Jutaan/Million", TLKM = "Miliaran/Billion"
            # -- keduanya nyata dipakai, jangan asumsikan cuma satu.
            if "miliar" in val or "billion" in val:
                skala = 1_000_000_000
            elif "juta" in val or "million" in val:
                skala = 1_000_000
            elif "ribu" in val or "thousand" in val:
                skala = 1_000
            else:
                skala = 1
    return currency, skala


def ekstrak(wb) -> tuple[dict, str]:
    currency, skala = info_umum(wb)

    def rp(v):
        if v is None:
            return None
        try:
            return float(v) * skala
        except (TypeError, ValueError):
            return None

    def rp_eps(v):
        # ponytail: EPS seharusnya (spesifikasi XBRL) TIDAK ikut skala moneter
        # entitas -- elemen perShareItemType selalu dalam mata uang penuh per
        # lembar, beda dari monetaryItemType. Tapi diverifikasi: sebagian
        # emiten (BBCA/BMRI/ICBP) menandainya sudah dalam rupiah penuh,
        # sebagian lain (TLKM/ASII/ACST/ALKA/AKKU/ADES) tetap ikut skala
        # jutaan -- inkonsistensi di berkas sumber, bukan satu aturan yang
        # berlaku semua. Diputuskan pakai ambang plausibilitas: pilih varian
        # (mentah vs dikali skala) yang jatuh di rentang EPS wajar saham IDX.
        # Upgrade path kalau ini kurang -- baca "decimals" dari instance.zip
        # XBRL mentah per fakta, bukan dari nilai XLSX yang sudah dirender.
        if v is None:
            return None
        try:
            mentah = float(v)
        except (TypeError, ValueError):
            return None
        skalaan = mentah * skala
        PLAUSIBEL = (0.001, 1_000_000)
        if PLAUSIBEL[0] <= abs(mentah) <= PLAUSIBEL[1]:
            return mentah
        if PLAUSIBEL[0] <= abs(skalaan) <= PLAUSIBEL[1]:
            return skalaan
        return mentah  # tak satu pun wajar -- pakai mentah, lebih jujur dari menebak

    neraca = peta_dari_tipe(wb, "neraca")
    labarugi = peta_dari_tipe(wb, "labarugi")
    kas = peta_dari_tipe(wb, "kas")

    total_debt_raw = sum(
        v for v in (neraca.get(lbl.lower()) for lbl in NERACA_DEBT_LABELS) if v is not None
    )
    total_debt = rp(total_debt_raw) if total_debt_raw else None

    operating_cf = rp(cari(kas, KAS_OPERASI))
    investing_cf = rp(cari(kas, KAS_INVESTASI))
    financing_cf = rp(cari(kas, KAS_PENDANAAN))
    capex = rp(cari(kas, KAS_CAPEX))
    free_cf = (operating_cf - capex) if (operating_cf is not None and capex is not None) else None

    cash = rp(cari(neraca, NERACA_KAS))
    if cash is None:
        cash = rp(cari(kas, KAS_AKHIR))  # bank: tak ada baris neraca "cash and cash equivalents"

    data = {
        "revenue": rp(cari(labarugi, LABARUGI_REVENUE)),
        "cogs": rp(cari(labarugi, LABARUGI_COGS)),
        "gross_profit": rp(cari(labarugi, LABARUGI_GROSS)),
        "operating_income": rp(cari(labarugi, LABARUGI_OPINC)),
        "net_income": rp(cari(labarugi, LABARUGI_NETINC)),
        "eps": rp_eps(cari(labarugi, LABARUGI_EPS)),
        "total_assets": rp(cari(neraca, NERACA_ASET)),
        "total_liabilities": rp(cari(neraca, NERACA_LIAB)),
        "equity": rp(cari(neraca, NERACA_EKUITAS)),
        "cash": cash,
        "total_debt": total_debt,
        "operating_cf": operating_cf,
        "investing_cf": investing_cf,
        "financing_cf": financing_cf,
        "free_cf": free_cf,
    }
    return data, currency


def ambil_daftar(sesi: requests.Session, tahun: int, periode: str) -> dict:
    params = {
        "indexFrom": 1, "pageSize": 1000, "year": tahun, "reportType": "rdf",
        "EmitenType": "s", "periode": periode, "kodeEmiten": "",
        "SortColumn": "KodeEmiten", "SortOrder": "asc",
    }
    # 403 di endpoint ini TRANSIEN, bukan penolakan menetap. Terbukti 17 Agu
    # 2026: dalam satu proses yang sama, panen AUDIT 2020 lolos penuh (699
    # emiten), 2021 mulai tersendat (26 gagal), lalu 2022-2025 gagal SEMUA di
    # langkah pengambilan daftar ini. Diuji ulang beberapa menit kemudian dari
    # IP yang sama: tahun 2022 masih 403 tapi 2025 menjawab 200 dengan 882
    # hasil -- jadi yang terjadi pembatasan laju, bukan pemblokiran.
    #
    # Tanpa percobaan ulang, SATU 403 membatalkan seluruh tahun. Padahal
    # biayanya cuma menunggu: jeda menaik 5, 15, 30, 60 detik.
    jeda = [5, 15, 30, 60]
    galat_terakhir: Exception | None = None
    for percobaan in range(len(jeda) + 1):
        try:
            r = sesi.get(LIST_URL, params=params, headers=HEADER, timeout=60)
            r.raise_for_status()
            break
        except Exception as e:  # noqa: BLE001
            galat_terakhir = e
            if percobaan >= len(jeda):
                raise
            tunggu = jeda[percobaan]
            print(f"    daftar {periode.upper()} {tahun} ditolak ({e.__class__.__name__}) "
                  f"-- coba lagi dalam {tunggu} detik "
                  f"[{percobaan + 1}/{len(jeda)}]", flush=True)
            time.sleep(tunggu)
    else:  # pragma: no cover - dijaga `raise` di atas
        raise galat_terakhir or RuntimeError("daftar laporan tak terambil")
    hasil = {}
    for entri in (r.json().get("Results") or []):
        kode = (entri.get("KodeEmiten") or "").strip().upper()
        if kode:
            hasil[kode] = entri
    return hasil


def cari_xlsx(entri: dict) -> dict | None:
    for a in entri.get("Attachments") or []:
        nama = (a.get("File_Name") or "")
        if nama.lower().endswith(".xlsx") and nama.lower().startswith("financialstatement"):
            return a
    return None


# Arsip berkas MENTAH. Sengaja di luar repo (lihat .gitignore) supaya 200-an MB
# XLSX tak ikut tiap kloning, tapi TETAP ADA di cakram.
#
# Johan 17 Agu 2026: "jangan asal maen buang data yang sudah di panen, gini ini
# jadi masalah kan harus unduh lagi, simpan backup saja sewaktu perlu kita
# gunakan gini". Latar belakangnya nyata: versi pertama skrip ini memeras XLSX
# jadi 15 ruas lalu membuang berkasnya. Begitu muncul kebutuhan ruas lain
# (neraca saja 238 baris), satu-satunya jalan adalah mengunduh ulang seluruh
# 900-an emiten — padahal endpoint-nya sering menolak 403 dan panen penuh makan
# berjam-jam.
#
# Aturan yang berlaku sejak sekarang: yang mahal itu MENGAMBILNYA, bukan
# menyimpannya. Simpan mentahnya, parse-nya boleh diulang kapan saja.
ARSIP_MENTAH = AKAR / "_arsip-mentah" / "keuangan_idx"


def jalur_arsip(kode: str, tahun: int, periode: str) -> Path:
    return ARSIP_MENTAH / str(tahun) / periode / f"{kode}.xlsx"


def ambil_xlsx(sesi: requests.Session, file_path: str, kode: str,
               tahun: int, periode: str) -> bytes:
    """Isi XLSX — dari arsip cakram kalau ada, kalau tidak baru diunduh.

    Ini yang membuat penambahan ruas di kemudian hari tak berbiaya jaringan
    sama sekali: jalankan ulang dengan `--paksa`, seluruh berkas dibaca dari
    cakram, tak satu pun permintaan keluar.
    """
    berkas = jalur_arsip(kode, tahun, periode)
    if berkas.exists() and berkas.stat().st_size > 0:
        return berkas.read_bytes()
    konten = unduh_xlsx(sesi, file_path)
    try:
        berkas.parent.mkdir(parents=True, exist_ok=True)
        berkas.write_bytes(konten)
    except OSError as e:  # cakram penuh / izin -- panen JANGAN ikut gagal
        print(f" [arsip gagal: {e}]", end="")
    return konten


def unduh_xlsx(sesi: requests.Session, file_path: str) -> bytes:
    url = HOST + urllib.parse.quote(file_path)
    galat: Exception | None = None
    for n, jeda in enumerate((0, *TUNGGU_ULANG)):
        if jeda:
            time.sleep(jeda)
        try:
            r = sesi.get(url, headers=HEADER_FILE, timeout=60)
            if r.status_code in (403, 429):
                galat = Ditolak(f"HTTP {r.status_code}")
                continue
            r.raise_for_status()
            return r.content
        except requests.RequestException as e:
            galat = e
    raise galat or RuntimeError("gagal mengunduh tanpa alasan jelas")


def sudah_ada(kode: str, tanggal: str, bucket: str) -> bool:
    path = KELUARAN_DIR / f"{kode}.json"
    if not path.exists():
        return False
    try:
        isi = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return tanggal in (isi.get(bucket) or {})


def simpan(kode: str, tanggal: str, bucket: str, data_periode: dict, currency: str) -> None:
    KELUARAN_DIR.mkdir(parents=True, exist_ok=True)
    path = KELUARAN_DIR / f"{kode}.json"
    isi = {}
    if path.exists():
        try:
            isi = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            isi = {}
    isi["ticker"] = kode
    isi["currency"] = currency or isi.get("currency") or "IDR"
    isi["sumber"] = "idx-xbrl"
    isi.setdefault("kuartal", {})
    isi.setdefault("tahunan", {})
    isi[bucket][tanggal] = data_periode
    isi["diperbarui"] = datetime.now(WIB).strftime("%Y-%m-%d %H:%M")
    path.write_text(json.dumps(isi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen laporan keuangan resmi IDX (XBRL)")
    ap.add_argument("--tickers", help="Daftar kode dipisah koma, mis. BBCA,TLKM")
    ap.add_argument("--semua", action="store_true", help="Seluruh emiten (DEFAULT_TICKERS)")
    ap.add_argument("--paksa", action="store_true", help="Panen ulang walau periode sudah ada")
    ap.add_argument("--periode", default="tw2", choices=["tw1", "tw2", "tw3", "audit"])
    ap.add_argument("--tahun", type=int, default=2026)
    ap.add_argument("--batas", type=int, default=None, help="Batasi jumlah tiker (uji cepat)")
    args = ap.parse_args()

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    elif args.semua:
        tickers = list(DEFAULT_TICKERS)
    else:
        ap.error("Pakai --tickers AAA,BBB atau --semua")
        return 1

    if args.batas:
        tickers = tickers[: args.batas]

    bucket = "tahunan" if args.periode == "audit" else "kuartal"
    tanggal = tanggal_akhir(args.tahun, args.periode)

    sesi = requests.Session()
    try:
        sesi.get(PEMANASAN, headers={"User-Agent": UA}, timeout=30)
        print(f"Mengambil daftar laporan {args.periode.upper()} {args.tahun} ...")
        daftar = ambil_daftar(sesi, args.tahun, args.periode)
    except Exception as e:  # noqa: BLE001
        print(f"Gagal mengambil daftar laporan: {e}", file=sys.stderr)
        print("Ingat: endpoint IDX hanya terbuka dari IP rumahan, 403 dari datacenter.",
              file=sys.stderr)
        return 1
    print(f"  {len(daftar)} emiten punya laporan pada periode ini -> target {len(tickers)} tiker\n")

    ok = kosong = gagal = dilewati = 0
    for i, kode in enumerate(tickers, 1):
        print(f"  [{i:>3}/{len(tickers)}] {kode:<8}", end="", flush=True)

        if not args.paksa and sudah_ada(kode, tanggal, bucket):
            dilewati += 1
            print(" - dilewati (sudah ada)")
            continue

        entri = daftar.get(kode)
        if entri is None:
            kosong += 1
            print(" - kosong (tak ada laporan periode ini)")
            continue

        att = cari_xlsx(entri)
        if att is None:
            kosong += 1
            print(" - kosong (tak ada lampiran xlsx)")
            continue

        try:
            konten = ambil_xlsx(sesi, att["File_Path"], kode, args.tahun, args.periode)
            wb = load_workbook(io.BytesIO(konten), data_only=True, read_only=True)
            data_periode, currency = ekstrak(wb)
            wb.close()
        except Ditolak:
            gagal += 1
            print(" - GAGAL (ditolak berturut-turut) -- berhenti")
            break
        except Exception as e:  # noqa: BLE001
            gagal += 1
            print(f" - gagal ({e})")
            time.sleep(random.uniform(*JEDA))
            continue

        terisi = sum(1 for v in data_periode.values() if v is not None)
        if terisi == 0:
            kosong += 1
            print(" - kosong (semua ruas null)")
        else:
            simpan(kode, tanggal, bucket, data_periode, currency)
            ok += 1
            print(f" - ok ({currency}, {terisi}/{len(ALL_KEYS)} ruas terisi)")

        time.sleep(random.uniform(*JEDA))

    print(f"\nSelesai: {ok} berhasil, {kosong} kosong, {gagal} gagal, "
          f"{dilewati} dilewati dari {len(tickers)} emiten")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
