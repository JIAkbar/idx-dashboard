"""
IDX Statistics Downloader (harian + mingguan)
==============================================
Download otomatis IDX Daily Statistics (ds_*.pdf) dan Weekly Statistics
(ws_*.pdf) dari idx.co.id.

Simpan ke: data-idx/daily/ (ds_) dan data-idx/weekly/ (ws_)

Cara pakai:
  python scripts/download_idx.py --hari-ini                  # daily bulan berjalan
  python scripts/download_idx.py --hari-ini --jenis semua    # daily + weekly
  python scripts/download_idx.py --jenis mingguan --semua    # semua weekly yang terlisting
  python scripts/download_idx.py --bulan 6                   # daily bulan tertentu

Catatan blokir bot (riwayat nyata, Agustus 2026): halaman IDX kerap TIMEOUT
dari IP datacenter (GitHub Actions runner) — `wait_until="networkidle"` tidak
pernah tercapai. Dari IP rumahan biasanya lancar. Mitigasi di file ini:
goto pakai "domcontentloaded" + tunggu selector anchor PDF (bukan networkidle),
retry 3x, dan exit code != 0 kalau gagal total supaya workflow CI menandai
gagal dengan jujur (bukan sukses semu).
"""

import argparse, re, sys, time
from datetime import datetime
from pathlib import Path

ROOT_DIR   = Path(__file__).parent.parent
DAILY_DIR  = ROOT_DIR / "data-idx" / "daily"
WEEKLY_DIR = ROOT_DIR / "data-idx" / "weekly"
IDX_URL    = "https://www.idx.co.id/id/data-pasar/laporan-statistik/statistik"
HEADERS    = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://www.idx.co.id/",
}

# prefix nama file -> folder tujuan
JENIS_MAP = {"ds": DAILY_DIR, "ws": WEEKLY_DIR}


# halaman statistik punya tab teks: Harian | Mingguan | Bulanan | Triwulan |
# Tahunan — default "Harian" (ds_). File ws_ baru muncul setelah tab
# "Mingguan" diklik (render client-side, URL tidak berubah).
TAB_LABEL = {"ds": "Harian", "ws": "Mingguan"}


def _kumpul_link(page, prefix):
    out = []
    for a in page.query_selector_all("a[href*='.pdf']"):
        href = (a.get_attribute("href") or "").strip()
        nama = href.lower().rsplit("/", 1)[-1]
        if not re.match(rf"{prefix}_\d{{6}}\.pdf$", nama):
            continue
        if href.startswith("/"):
            href = "https://www.idx.co.id" + href
        out.append(href)
    return out


def get_links_playwright(jenis_aktif, retry=3):
    """Scrape link PDF dari halaman statistik IDX per jenis yang diminta.

    jenis_aktif: subset dari ["ds","ws"]. Return {"ds": [...], "ws": [...]}.
    Raise kalau gagal total setelah `retry` percobaan.
    """
    from playwright.sync_api import sync_playwright

    galat_terakhir = None
    for percobaan in range(1, retry + 1):
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(user_agent=HEADERS["User-Agent"])
                print(f"Membuka halaman IDX Statistics... (percobaan {percobaan}/{retry})")
                # "domcontentloaded" bukan "networkidle": halaman IDX terus
                # streaming analytics sehingga networkidle sering tak pernah
                # tercapai dari IP datacenter -> timeout semu padahal konten ada.
                page.goto(IDX_URL, wait_until="domcontentloaded", timeout=45000)
                # tunggu anchor PDF pertama muncul (render client-side)
                page.wait_for_selector("a[href*='.pdf']", timeout=30000)
                out = {"ds": [], "ws": []}
                for jenis in jenis_aktif:
                    if jenis != "ds":   # tab default = Harian, lainnya perlu klik
                        page.get_by_text(TAB_LABEL[jenis], exact=True).first.click()
                        page.wait_for_timeout(3000)
                    # tampilkan semua baris kalau ada dropdown page-size
                    try:
                        page.select_option("select", "-1")
                        page.wait_for_timeout(2000)
                    except Exception:
                        pass
                    out[jenis] = _kumpul_link(page, jenis)
                browser.close()
                return out
        except Exception as e:
            galat_terakhir = e
            print(f"  gagal: {type(e).__name__}: {e}")
            if percobaan < retry:
                time.sleep(5 * percobaan)
    raise RuntimeError(f"Gagal scrape halaman IDX setelah {retry}x: {galat_terakhir}")


def filter_links(links, bulan=None, tahun=None):
    if not (bulan or tahun):
        return links
    hasil = []
    for url in links:
        m = re.search(r"(?:ds|ws)_(\d{2})(\d{2})(\d{2})\.pdf", url, re.I)
        if m:
            yy, mm, _dd = m.groups()
            if bulan and int(mm) != bulan:
                continue
            if tahun and (2000 + int(yy)) != tahun:
                continue
            hasil.append(url)
    return hasil


def download_file(url, output_dir):
    import requests
    filename = url.split("/")[-1].lower()
    out = output_dir / filename
    if out.exists() and out.stat().st_size > 10000:
        print(f"  [SKIP] {filename} sudah ada ({out.stat().st_size//1024} KB)")
        return True
    try:
        r = requests.get(url, headers=HEADERS, timeout=60, stream=True)
        r.raise_for_status()
        with open(out, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        print(f"  [OK]   {filename} ({out.stat().st_size//1024} KB)")
        return True
    except Exception as e:
        print(f"  [ERR]  {filename}: {e}")
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bulan",    type=int)
    ap.add_argument("--tahun",    type=int, default=datetime.now().year)
    ap.add_argument("--semua",    action="store_true")
    ap.add_argument("--hari-ini", action="store_true")
    ap.add_argument("--jenis",    choices=["harian", "mingguan", "semua"],
                    default="harian",
                    help="harian=ds_ saja (default, kompatibel lama), "
                         "mingguan=ws_ saja, semua=keduanya")
    args = ap.parse_args()

    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    WEEKLY_DIR.mkdir(parents=True, exist_ok=True)

    if args.hari_ini:
        bulan, tahun = datetime.now().month, datetime.now().year
    elif args.semua:
        bulan, tahun = None, None
    else:
        bulan = args.bulan or datetime.now().month
        tahun = args.tahun

    jenis_aktif = ["ds", "ws"] if args.jenis == "semua" else \
                  (["ws"] if args.jenis == "mingguan" else ["ds"])

    print(f"\nDownload IDX Statistics ({args.jenis})"
          + (f" — Bulan {bulan}/{tahun}" if bulan else " — Semua"))
    try:
        semua_link = get_links_playwright(jenis_aktif)
    except ImportError:
        print("ERROR: Playwright tidak terinstall. "
              "Jalankan: pip install playwright && playwright install chromium")
        sys.exit(2)
    except RuntimeError as e:
        print(f"ERROR: {e}")
        sys.exit(1)   # kegagalan jaringan/blokir HARUS kelihatan di CI

    total_ok = total = 0
    for jenis in jenis_aktif:
        links = filter_links(semua_link[jenis], bulan=bulan, tahun=tahun)
        if not links:
            print(f"[{jenis}] tidak ada file cocok (mungkin belum terbit).")
            continue
        tujuan = JENIS_MAP[jenis]
        print(f"[{jenis}] {len(links)} file -> {tujuan}")
        total += len(links)
        total_ok += sum(download_file(u, tujuan) for u in links)

    print(f"\nSelesai: {total_ok}/{total} file berhasil.")
    if total and total_ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
