# -*- coding: utf-8 -*-
"""Sinkronisasi daftar emiten dengan bursa nyata (deteksi IPO baru).

Endpoint: /primary/TradingSummary/GetStockSummary?date=YYYYMMDD&start=0&length=9999
(963+ saham, field StockCode/StockName) — sumber sama dgn fetch_broker_summary.py.
Dulu akses WAJIB lewat page.evaluate(fetch) dari dalam halaman; sejak 18 Agu
2026 tidak lagi. Yang ditolak SIDIK JARI TLS, bukan asal permintaannya:
`curl_cffi` impersonate=chrome124 (lewat `idx_net`) menjawab 200 dari Python
biasa — terukur 20260818 -> 200, 963 baris. Playwright dibuang.

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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import idx_net  # noqa: E402 — satu pintu jaringan IDX (curl_cffi)

ROOT = Path(__file__).parent.parent
FUND_DIR = ROOT / "data-idx" / "json" / "fundamental"
from emiten_lewati import dilewati

OUT_FILE = ROOT / "data-idx" / "json" / "daftar_emiten.json"
HALAMAN = "https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan"
ENDPOINT = ("https://www.idx.co.id/primary/TradingSummary/GetStockSummary"
            "?date={tgl}&start=0&length=9999")
PYTHON = sys.executable  # panggil dgn interpreter yg sama (wajib py 3.14 + libs)


def ambil_daftar_resmi():
    """Coba mundur dari hari ini s.d. 7 hari — return (tgl_iso, [{kode,nama,saham}])."""
    d = date.today()
    for _ in range(7):
        if d.weekday() < 5:  # bukan akhir pekan
            tgl_ymd = d.strftime("%Y%m%d")
            # Satu tanggal gagal BUKAN alasan berhenti — hari berikutnya masih
            # boleh dicoba; yang fatal cuma kalau tujuh-tujuhnya kosong.
            try:
                data = idx_net.get(ENDPOINT.format(tgl=tgl_ymd),
                                   referer=HALAMAN).json().get("data") or []
            except Exception as e:  # noqa: BLE001
                print(f"  [--] {tgl_ymd}: {type(e).__name__}: {e}")
                data = []
            if data:
                # `ListedShares` ikut disimpan sebagai `saham`. Payload ini sudah
                # diambil untuk daftar emiten, jadi ongkos jaringannya NOL — tapi
                # isinya menutup lubang mahal: `sharesOutstanding` yfinance
                # ketinggalan aksi korporasi di 43 emiten (BBNI tersimpan 578,7
                # juta, resmi IDX 36,92 MILIAR; MSKY justru 5x KEBESARAN karena
                # reverse split), dan SETIAP ruas per-saham membaginya.
                # Pembacanya: `fetch_fundamental.py` (`saham_idx`).
                emiten = {}
                for r in data:
                    s = r.get("ListedShares")
                    emiten[r["StockCode"]] = {
                        "kode": r["StockCode"],
                        "nama": r["StockName"],
                        "saham": int(s) if isinstance(s, (int, float)) and s > 0 else None,
                    }
                # Kode yang sengaja dilewati dibuang DI HULU (emiten_lewati.py),
            # bukan di tiap pembangun turunan: GOTOM sempat lolos ke Harian
            # Papan & Jago Papan sebagai baris kosong karena pengecualiannya
            # cuma ada di satu pemanen.
                # `return` HARUS di dalam `if data:`. Sebelum 4 Sep 2026 ia
                # sejajar dengan `if`, jadi saat IDX menjawab kosong `emiten`
                # tak pernah dibuat tapi baris ini tetap dijalankan —
                # UnboundLocalError, dan mundur-sehari di bawahnya tak pernah
                # tercapai. Baris `print` di bawahnya pun kode mati (sesudah
                # `return`). Gejalanya: skrip mati total di hari yang datanya
                # belum terbit, bukan mundur ke hari bursa sebelumnya seperti
                # yang seluruh loop ini dirancang untuk lakukan.
                return d.isoformat(), [emiten[k] for k in sorted(emiten) if not dilewati(k)]
            print(f"  [--] {tgl_ymd}: kosong (libur bursa?)")
        d -= timedelta(days=1)
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
