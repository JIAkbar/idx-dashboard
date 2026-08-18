"""
IDX Statistics Downloader (harian + mingguan + BULANAN)
========================================================
Unduh IDX Daily (ds_), Weekly (ws_) dan Monthly Equity (ms_) Statistics dari
idx.co.id.

Simpan ke: data-idx/daily/ (ds_), data-idx/weekly/ (ws_), data-idx/monthly/ (ms_)
Mentahnya diarsipkan ke `_arsip-mentah/statistik/` dan DIBACA DULU sebelum
menembak jaringan (aturan keras proyek: yang mahal mengambilnya, bukan
menyimpannya).

Cara pakai:
  python scripts/download_idx.py --hari-ini                  # daily bulan berjalan
  python scripts/download_idx.py --hari-ini --jenis semua    # daily + weekly + monthly
  python scripts/download_idx.py --jenis mingguan --semua    # semua weekly tahun ini
  python scripts/download_idx.py --jenis bulanan --mundur 12 # 12 bulan terakhir
  python scripts/download_idx.py --bulan 6                   # daily bulan tertentu

DUA PERUBAHAN BESAR, 18 Agustus 2026
------------------------------------
1. **Playwright dibuang.** Halaman statistik itu Nuxt; daftar PDF-nya diambil
   JavaScript dari `/primary/Statistic/GetStatistic` (ditemukan dengan membaca
   bundel `_nuxt/*.js`, bukan menebak URL). Memanggil endpoint itu langsung
   membalas JSON berisi `number`/`description`/`file` — tak perlu meluncurkan
   Chromium, tak perlu mengklik tab, tak perlu `wait_until` yang sering timeout
   dari IP datacenter. Parameternya persis yang dikirim halaman aslinya:
       harian    : type=daily&StartDate=..&EndDate=..&keyword=
       mingguan  : type=weekly&year=YYYY
       bulanan   : type=monthly&year=YYYY
   (juga ada quarterly & yearly — belum dipakai.)
2. **`requests` -> `curl_cffi`** lewat `idx_net`. Terukur hari ini: endpoint
   IDX menolak `requests` dengan 403 walau headernya lengkap, dan menerima
   `curl_cffi impersonate=chrome124`. Pembedanya sidik jari TLS, bukan header
   dan bukan alamat IP.

BULANAN: yang diambil hanya varian **-E (Equity)**. Tiap bulan IDX menerbitkan
tiga berkas dengan nomor `MS<YYMM>-E` (Equity), `-B` (Bond) dan `-SW`
(Structured Warrant). Yang sebanding dengan ds_/ws_ — dan satu-satunya yang
isinya saham — cuma Equity. Bond & Structured Warrant sengaja dilewati sampai
ada yang memakainya; mengunduh yang tak dibaca cuma menambah berkas.

Satu berkas gagal TIDAK membunuh sisa panen: tiap item ditangkap sendiri,
dihitung sebagai gagal, panen lanjut.
"""

import argparse
import re
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2
import idx_net  # noqa: E402

ROOT_DIR    = Path(__file__).parent.parent
DAILY_DIR   = ROOT_DIR / "data-idx" / "daily"
WEEKLY_DIR  = ROOT_DIR / "data-idx" / "weekly"
MONTHLY_DIR = ROOT_DIR / "data-idx" / "monthly"

HALAMAN  = "https://www.idx.co.id/id/data-pasar/laporan-statistik/statistik"
API      = "https://www.idx.co.id/primary/Statistic/GetStatistic"

# prefix nama file -> (folder tujuan, tipe di API)
JENIS = {
    "ds": (DAILY_DIR,   "daily"),
    "ws": (WEEKLY_DIR,  "weekly"),
    "ms": (MONTHLY_DIR, "monthly"),
}
ARG2PREFIX = {"harian": ["ds"], "mingguan": ["ws"], "bulanan": ["ms"],
              "semua": ["ds", "ws", "ms"]}

# Varian bulanan yang dipanen. "E" = Equity. Lihat catatan modul.
MS_VARIAN = "E"


def _nama_berkas(prefix: str, nomor: str) -> str | None:
    """`DS260818` -> ds_260818.pdf · `WS260814` -> ws_260814.pdf ·
    `MS2607-E` -> ms_2607.pdf (varian -B/-SW dilewati -> None).

    Nama dibangun dari ruas `number`, BUKAN dari nama berkas di URL: URL
    bulanan berbentuk `/Media/<hash>/ms_equity_2607.pdf` sehingga penamaan
    ikut-URL menghasilkan tiga pola berbeda untuk tiga jenis yang sama.
    """
    nomor = (nomor or "").strip().upper()
    if prefix == "ms":
        m = re.fullmatch(r"MS(\d{4})-([A-Z]+)", nomor)
        if not m or m.group(2) != MS_VARIAN:
            return None
        return f"ms_{m.group(1)}.pdf"
    m = re.fullmatch(rf"{prefix.upper()}(\d{{6}})", nomor)
    return f"{prefix}_{m.group(1)}.pdf" if m else None


def daftar(prefix: str, *, tahun: int | None, mulai: str | None, sampai: str | None) -> list[tuple[str, str]]:
    """Panggil GetStatistic -> [(nama_berkas, url_pdf)].

    Melempar RuntimeError kalau endpointnya tak menjawab — kegagalan jaringan
    harus kelihatan (exit code != 0), bukan terbaca sebagai "belum terbit".
    """
    tipe = JENIS[prefix][1]
    if tipe == "daily":
        params = {"type": "daily", "lang": "id", "keyword": "",
                  "StartDate": mulai or "", "EndDate": sampai or ""}
    else:
        params = {"type": tipe, "lang": "id", "year": tahun or date.today().year}
    r = idx_net.get(API, params=params, referer=HALAMAN)
    out = []
    for baris in (r.json() or []):
        try:
            nama = _nama_berkas(prefix, baris.get("number", ""))
            if not nama:
                continue
            url = (baris.get("file") or "").strip()
            if not url:
                continue
            if url.startswith("/"):
                url = "https://www.idx.co.id" + url
            out.append((nama, url))
        except Exception as e:  # noqa: BLE001 — satu baris rusak != daftar gagal
            print(f"  [SKIP] baris tak terbaca: {e}")
    return out


def unduh(nama: str, url: str, tujuan: Path, prefix: str) -> bool:
    """Simpan satu PDF. Arsip mentah dibaca DULU; jaringan cuma kalau perlu."""
    out = tujuan / nama
    if out.exists() and out.stat().st_size > 10000:
        print(f"  [SKIP] {nama} sudah ada ({out.stat().st_size // 1024} KB)")
        return True
    try:
        isi = arsip_mentah.ambil_atau_unduh(
            "statistik", prefix, nama,
            unduh=lambda: idx_net.get(url, headers=idx_net.HDR_FILE,
                                      referer=HALAMAN, timeout=120).content)
        if len(isi) < 10000 or not isi.startswith(b"%PDF"):
            raise ValueError(f"bukan PDF utuh ({len(isi)} byte)")
        out.write_bytes(isi)
        print(f"  [OK]   {nama} ({len(isi) // 1024} KB)")
        return True
    except Exception as e:  # noqa: BLE001 — satu berkas gagal != panen mati
        print(f"  [ERR]  {nama}: {e}")
        return False


def _batas_yymm(mundur: int) -> str:
    """YYMM periode terlama yang masih diterima untuk `--mundur N` bulan."""
    t = date.today()
    m, y = t.month - mundur + 1, t.year
    while m <= 0:
        m += 12
        y -= 1
    return f"{y % 100:02d}{m:02d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bulan", type=int)
    ap.add_argument("--tahun", type=int, default=datetime.now().year)
    ap.add_argument("--semua", action="store_true")
    ap.add_argument("--hari-ini", action="store_true")
    ap.add_argument("--mundur", type=int, default=0,
                    help="mingguan/bulanan: berapa bulan ke belakang (boleh lintas tahun)")
    ap.add_argument("--jenis", choices=list(ARG2PREFIX), default="harian",
                    help="harian=ds_ (default), mingguan=ws_, bulanan=ms_ (Equity), semua=ketiganya")
    args = ap.parse_args()

    if args.hari_ini:
        bulan, tahun = datetime.now().month, datetime.now().year
    elif args.semua:
        bulan, tahun = None, args.tahun
    else:
        bulan, tahun = args.bulan or datetime.now().month, args.tahun

    # Mingguan/bulanan dikunci PER TAHUN di API, jadi "12 bulan terakhir"
    # hampir selalu perlu dua tahun ditanyakan lalu dipotong di sisi kita.
    batas_ms = _batas_yymm(args.mundur) if args.mundur else None
    tahun_list = [tahun]
    if batas_ms:
        tahun_list = list(range(2000 + int(batas_ms[:2]), tahun + 1))

    prefixes = ARG2PREFIX[args.jenis]
    print(f"\nUnduh IDX Statistics ({args.jenis})"
          + (f" — bulan {bulan}/{tahun}" if bulan and "ds" in prefixes else "")
          + (f" — mundur {args.mundur} bulan (>= {batas_ms})" if batas_ms else ""))

    total = total_ok = gagal_daftar = 0
    for prefix in prefixes:
        tujuan = JENIS[prefix][0]
        tujuan.mkdir(parents=True, exist_ok=True)
        item: list[tuple[str, str]] = []
        try:
            if prefix == "ds":
                # API harian dikunci rentang tanggal, persis seperti halamannya.
                if bulan:
                    mulai = date(tahun, bulan, 1).isoformat()
                    akhir = date(tahun + bulan // 12, bulan % 12 + 1, 1)
                    sampai = min(akhir, date.today()).isoformat()
                else:
                    mulai = sampai = None   # kosong = seluruh yang terlisting
                item = daftar("ds", tahun=tahun, mulai=mulai, sampai=sampai)
            else:
                for t in tahun_list:
                    item += daftar(prefix, tahun=t, mulai=None, sampai=None)
                if batas_ms:
                    # ds_/ws_ pakai YYMMDD, ms_ pakai YYMM — potong sama-sama
                    # di 4 digit pertama supaya perbandingannya setara.
                    item = [(n, u) for n, u in item if n[3:7] >= batas_ms]
        except Exception as e:  # noqa: BLE001 — satu jenis gagal != jenis lain batal
            print(f"[{prefix}] GAGAL mengambil daftar: {e}")
            gagal_daftar += 1
            continue

        if not item:
            print(f"[{prefix}] tidak ada berkas cocok (mungkin belum terbit).")
            continue
        print(f"[{prefix}] {len(item)} berkas -> {tujuan}")
        total += len(item)
        for nama, url in item:
            total_ok += unduh(nama, url, tujuan, prefix)

    print(f"\nSelesai: {total_ok}/{total} berkas berhasil.")
    if gagal_daftar == len(prefixes) or (total and total_ok == 0):
        sys.exit(1)   # blokir/jaringan HARUS terbaca gagal di CI


if __name__ == "__main__":
    main()
