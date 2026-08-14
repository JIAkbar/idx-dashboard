# -*- coding: utf-8 -*-
"""Sinkronisasi daftar emiten dengan bursa nyata (deteksi IPO baru).

Endpoint: /primary/TradingSummary/GetStockSummary?date=YYYYMMDD&start=0&length=9999
(963+ saham, field StockCode/StockName) — sumber sama dgn fetch_broker_summary.py,
akses WAJIB page.evaluate(fetch) dari dalam halaman ringkasan-perdagangan (akses
langsung = 403 Cloudflare).

Alur: ambil daftar resmi IDX → diff dgn data-idx/json/fundamental/index.json →
ticker baru dipanen via `fetch_fundamental.py <TICKER> ...` (CLI itu sudah
menerima ticker spesifik sbg argumen positional — index.json & sector_avg
diperbarui otomatis dari SEMUA file di disk, tidak perlu flag baru).

Cara pakai:
  python scripts/sinkron_emiten.py

Output: data-idx/json/daftar_emiten.json + panen JSON fundamental utk ticker baru.
"""
import json, os, subprocess, sys, time
from datetime import date, datetime, timedelta
from pathlib import Path

# Konsol Windows default cp1252: tanda ✓/✗ di laporan akhir bikin
# UnicodeEncodeError setelah panen selesai — hasil aman, tapi laporannya hilang
# dan pipeline tampak gagal. Skrip ini sudah menyetel PYTHONIOENCODING untuk
# subprocess-nya; stdout sendiri ikut diamankan di sini.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
FUND_DIR = ROOT / "data-idx" / "json" / "fundamental"
OUT_FILE = ROOT / "data-idx" / "json" / "daftar_emiten.json"
HALAMAN = "https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan"
ENDPOINT = ("https://www.idx.co.id/primary/TradingSummary/GetStockSummary"
            "?date={tgl}&start=0&length=9999")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "Chrome/124.0.0.0 Safari/537.36")
JS_FETCH = """async (url) => {
  const r = await fetch(url, {headers: {"Accept": "application/json"}});
  return {status: r.status, body: await r.text()};
}"""
PYTHON = sys.executable  # panggil dgn interpreter yg sama (wajib py 3.14 + libs)


def ambil_daftar_resmi():
    """Coba mundur dari hari ini s.d. 7 hari — return (tgl_iso, [{kode,nama}])."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_page(user_agent=UA)
        pg.goto(HALAMAN, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(5000)

        d = date.today()
        for _ in range(7):
            if d.weekday() < 5:  # bukan akhir pekan
                tgl_ymd = d.strftime("%Y%m%d")
                res = pg.evaluate(JS_FETCH, ENDPOINT.format(tgl=tgl_ymd))
                if res["status"] == 200:
                    j = json.loads(res["body"])
                    data = j.get("data") or []
                    if data:
                        b.close()
                        emiten = sorted(
                            {(r["StockCode"], r["StockName"]) for r in data},
                            key=lambda x: x[0])
                        return d.isoformat(), [{"kode": k, "nama": n} for k, n in emiten]
                print(f"  [--] {tgl_ymd}: kosong/gagal (HTTP {res['status']})")
            d -= timedelta(days=1)
        b.close()
    return None, []


def main():
    print("Mengambil daftar resmi emiten dari IDX (GetStockSummary)...")
    tgl_iso, emiten = ambil_daftar_resmi()
    if not emiten:
        print("GAGAL: tidak dapat daftar emiten dari IDX (7 hari terakhir kosong).")
        sys.exit(1)
    print(f"  OK — {len(emiten)} emiten per {tgl_iso}")

    OUT_FILE.write_text(json.dumps({
        "date_iso": tgl_iso,
        "n": len(emiten),
        "emiten": emiten,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  Tersimpan: {OUT_FILE.relative_to(ROOT)}")

    # ── Diff dgn database fundamental ──────────────────────────────────────
    idx_path = FUND_DIR / "index.json"
    have = set()
    if idx_path.exists():
        have = {s["ticker"] for s in json.loads(idx_path.read_text(encoding="utf-8"))["stocks"]}
    resmi_kode = {e["kode"] for e in emiten}
    baru = sorted(resmi_kode - have)

    print(f"\nDatabase fundamental saat ini: {len(have)} saham.")
    print(f"Saham baru (belum ada di database): {len(baru)}")
    for k in baru:
        nama = next(e["nama"] for e in emiten if e["kode"] == k)
        print(f"  + {k:<8} {nama}")

    if not baru:
        print("\nTidak ada saham baru — sinkron selesai, tidak ada yang dipanen.")
        return

    # ── Panen subset via fetch_fundamental.py (CLI positional, sudah mendukung) ─
    print(f"\nMemanen {len(baru)} ticker baru via fetch_fundamental.py ...")
    # PYTHONIOENCODING: konsol Windows default cp1252 tercekik emoji di print()
    # fetch_fundamental.py (UnicodeEncodeError → crash sebelum sempat fetch apa pun).
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    r = subprocess.run([PYTHON, str(ROOT / "scripts" / "fetch_fundamental.py"), *baru],
                        cwd=str(ROOT), env=env)
    if r.returncode != 0:
        print(f"  ⚠ fetch_fundamental.py keluar dgn kode {r.returncode} (lihat log di atas)")

    # ── Laporan akhir: mana yang berhasil dapat JSON, mana yang tidak ──────
    print("\nHasil panen:")
    gagal = []
    for k in baru:
        if (FUND_DIR / f"{k}.json").exists():
            print(f"  ✓ {k}")
        else:
            print(f"  ✗ {k} (tidak dikenal Yahoo / gagal)")
            gagal.append(k)
    if gagal:
        print(f"\n{len(gagal)} ticker gagal dipanen (dicatat, bukan file kosong): {', '.join(gagal)}")


if __name__ == "__main__":
    main()
