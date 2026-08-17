# -*- coding: utf-8 -*-
"""Harvester ringkasan broker harian dari endpoint internal idx.co.id.

Endpoint: /primary/TradingSummary/GetBrokerSummary?date=YYYYMMDD&start=0&length=10000
Agregat per broker (volume/nilai/frekuensi) — setara xlsx "Ringkasan Broker-*.xlsx"
yang selama ini didownload manual. Historis terverifikasi minimal s.d. Agu 2023.

Endpoint hanya menjawab kalau di-fetch DARI DALAM konteks halaman
ringkasan-perdagangan (Cloudflare menolak request non-browser: playwright
pg.request.get pun kena 403 — harus page.evaluate(fetch)).

Cara pakai:
  python scripts/fetch_broker_summary.py                      # hari ini
  python scripts/fetch_broker_summary.py --tanggal 20260812
  python scripts/fetch_broker_summary.py --hari 10            # backfill 10 hari bursa
  python scripts/fetch_broker_summary.py --hari 10 --paksa    # timpa yang sudah ada

Output: data-idx/json/broker/bs_YYMMDD.json + index.json (daftar tanggal).
"""
import argparse, json, sys, time
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402 — reuse, lihat CLAUDE.md rung 2

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "data-idx" / "json" / "broker"
HALAMAN = "https://www.idx.co.id/id/data-pasar/ringkasan-perdagangan"
ENDPOINT = ("https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary"
            "?date={tgl}&start=0&length=10000")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "Chrome/124.0.0.0 Safari/537.36")
JS_FETCH = """async (url) => {
  const r = await fetch(url, {headers: {"Accept": "application/json"}});
  return {status: r.status, body: await r.text()};
}"""


def ambil(pg, tgl_ymd):
    """Fetch satu tanggal. Return list record mentah, atau None kalau kosong/gagal."""
    res = pg.evaluate(JS_FETCH, ENDPOINT.format(tgl=tgl_ymd))
    if res["status"] != 200:
        print(f"  [ERR]  {tgl_ymd}: HTTP {res['status']}")
        return None
    j = json.loads(res["body"])
    data = j.get("data") or []
    if data:
        # Pembeda = tanggal yang DIMINTA (bukan tanggal panen) — satu tanggal
        # bursa cuma punya satu jawaban yang benar, jadi backfill/re-panen di
        # hari lain tetap menulis ke jalur yang sama (idempoten), bukan
        # menumpuk salinan.
        tgl_iso = f"{tgl_ymd[:4]}-{tgl_ymd[4:6]}-{tgl_ymd[6:8]}"
        arsip_mentah.simpan("broker-summary", f"{tgl_iso}.json", data=data)
    return data or None  # recordsTotal 0 = bukan hari bursa


def simpan(tgl_iso, data):
    """Tulis bs_YYMMDD.json format ringkas."""
    brokers = [{
        "kode": r["IDFirm"],
        "nama": r["FirmName"],
        "vol":  r["Volume"],
        "val":  r["Value"],
        "frek": r["Frequency"],
    } for r in data]
    brokers.sort(key=lambda b: -b["val"])
    out = OUT_DIR / f"bs_{tgl_iso[2:4]}{tgl_iso[5:7]}{tgl_iso[8:10]}.json"
    out.write_text(json.dumps({
        "date_iso": tgl_iso,
        "n_broker": len(brokers),
        "brokers": brokers,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  [OK]   {out.name} ({len(brokers)} broker)")


def tulis_index():
    tanggal = sorted(
        f"20{f.stem[3:5]}-{f.stem[5:7]}-{f.stem[7:9]}"
        for f in OUT_DIR.glob("bs_*.json")
    )
    (OUT_DIR / "index.json").write_text(
        json.dumps({"updated": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "dates": tanggal}, separators=(",", ":")), encoding="utf-8")
    print(f"index.json: {len(tanggal)} tanggal")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tanggal", help="YYYYMMDD (default: hari ini)")
    ap.add_argument("--hari", type=int, default=1,
                    help="mundur N hari bursa dari --tanggal (backfill)")
    ap.add_argument("--paksa", action="store_true", help="timpa file yang sudah ada")
    args = ap.parse_args()

    mulai = (datetime.strptime(args.tanggal, "%Y%m%d").date()
             if args.tanggal else date.today())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright
    dapat = 0
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_page(user_agent=UA)
        print("Membuka halaman ringkasan-perdagangan (bekal session)...")
        pg.goto(HALAMAN, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(5000)

        d = mulai
        sisa_coba = args.hari * 3 + 10  # pagar: libur/akhir pekan tak terduga
        while dapat < args.hari and sisa_coba > 0:
            sisa_coba -= 1
            if d.weekday() >= 5:  # akhir pekan pasti bukan hari bursa
                d -= timedelta(days=1)
                continue
            tgl_iso = d.isoformat()
            out = OUT_DIR / f"bs_{d.strftime('%y%m%d')}.json"
            if out.exists() and not args.paksa:
                print(f"  [SKIP] {out.name} sudah ada")
                dapat += 1
                d -= timedelta(days=1)
                continue
            try:
                data = ambil(pg, d.strftime("%Y%m%d"))
            except Exception as e:
                print(f"  [ERR]  {tgl_iso}: {type(e).__name__}: {e}")
                data = None
            if data:
                simpan(tgl_iso, data)
                dapat += 1
            else:
                print(f"  [--]   {tgl_iso}: kosong (libur bursa?)")
            d -= timedelta(days=1)
            time.sleep(1)  # sopan ke server
        b.close()

    tulis_index()
    if dapat == 0:
        print("GAGAL: tidak ada satu pun tanggal berhasil.")
        sys.exit(1)
    print(f"Selesai: {dapat}/{args.hari} hari bursa.")


if __name__ == "__main__":
    main()
