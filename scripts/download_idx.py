"""
IDX Daily Statistics Downloader
================================
Download otomatis IDX Daily Statistics dari idx.co.id
Simpan ke folder: data/pdf/

Cara pakai:
  python scripts/download_idx.py --hari-ini
  python scripts/download_idx.py --bulan 6
  python scripts/download_idx.py --semua
"""

import argparse, os, re, time
from datetime import datetime
from pathlib import Path

# Output PDF ke data/pdf/ (relatif dari root repo)
ROOT_DIR   = Path(__file__).parent.parent
OUTPUT_DIR = ROOT_DIR / "data" / "pdf"
IDX_URL    = "https://www.idx.co.id/id/data-pasar/laporan-statistik/statistik"
HEADERS    = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://www.idx.co.id/",
}


def get_links_playwright(bulan=None, tahun=None):
    from playwright.sync_api import sync_playwright
    links = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=HEADERS["User-Agent"])
        print("Membuka halaman IDX Statistics...")
        page.goto(IDX_URL, wait_until="networkidle", timeout=60000)
        time.sleep(3)
        try:
            page.select_option("select", "-1")
            time.sleep(2)
        except Exception:
            pass
        anchors = page.query_selector_all("a[href*='.pdf']")
        for a in anchors:
            href = a.get_attribute("href") or ""
            if "ds_" in href.lower() and href.endswith(".pdf"):
                if href.startswith("/"):
                    href = "https://www.idx.co.id" + href
                links.append(href)
        browser.close()

    if bulan or tahun:
        filtered = []
        for url in links:
            m = re.search(r"ds_(\d{2})(\d{2})(\d{2})\.pdf", url, re.I)
            if m:
                yy, mm, dd = m.groups()
                if bulan and int(mm) != bulan: continue
                if tahun and (2000+int(yy)) != tahun: continue
                filtered.append(url)
        return filtered
    return links


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
    args = ap.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.hari_ini:
        bulan, tahun = datetime.now().month, datetime.now().year
    elif args.semua:
        bulan, tahun = None, None
    else:
        bulan = args.bulan or datetime.now().month
        tahun = args.tahun

    print(f"\nDownload IDX Statistics" + (f" — Bulan {bulan}/{tahun}" if bulan else " — Semua"))
    try:
        links = get_links_playwright(bulan=bulan, tahun=tahun)
    except ImportError:
        print("ERROR: Playwright tidak terinstall. Jalankan: pip install playwright && playwright install chromium")
        return

    if not links:
        print("Tidak ada file ditemukan (mungkin bursa libur hari ini).")
        return

    print(f"Ditemukan {len(links)} file. Download ke: {OUTPUT_DIR}")
    ok = sum(download_file(u, OUTPUT_DIR) for u in links)
    print(f"\nSelesai: {ok}/{len(links)} file berhasil.")


if __name__ == "__main__":
    main()
