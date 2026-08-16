# -*- coding: utf-8 -*-
"""Panen candle HARIAN IHSG (^JKSE) — #108.

Sebelum ini `ihsg_harian.json` cuma menyimpan PENUTUPAN, jadi lilin IHSG di
mana pun terpaksa digambar sebagai aproksimasi (buka = tutup kemarin). Skrip
ini menarik OHLCV penuh dan menulis dua berkas:

* `data-idx/json/ohlc/IHSG.json` — bentuknya SAMA PERSIS dengan berkas emiten
  keluaran `panen_ohlc.py`, jadi chart bisa memperlakukan IHSG seperti emiten
  biasa tanpa cabang khusus.
* `data-idx/json/ihsg_harian.json` — kunci `tutup` DIPERTAHANKAN apa adanya
  (SeasonalityHarian.tsx membacanya), ditambah kunci `buka`. Menghapus `tutup`
  demi bentuk yang lebih rapi akan mematikan halaman yang sudah jalan.

Mesin permintaannya (User-Agent, jeda, backoff yang menghormati Retry-After)
dipinjam dari `panen_ohlc.py` — bukan disalin. Satu-satunya beda: simbolnya
`%5EJKSE`, bukan `<KODE>.JK`.

RANGE=MAX TERLARANG
-------------------
`range=max` diam-diam menurunkan resolusi jadi BULANAN walau `interval=1d`
(ketahuan pada ^JKSE: 437 titik untuk 36 tahun). Riwayat penuh karena itu
ditarik per POTONGAN 5 TAHUN dengan period1/period2.

Cara pakai:
  python scripts/panen_ihsg.py --penuh     # riwayat 1990-sekarang (sekali)
  python scripts/panen_ihsg.py             # harian: tambah hari baru saja
  python scripts/panen_ihsg.py --swauji    # uji gabung, tanpa jaringan
"""
import argparse
import json
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from panen_ohlc import JEDA, Ditolak, ambil, ke_baris

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
OHLC = AKAR / "data-idx" / "json" / "ohlc" / "IHSG.json"
HARIAN = AKAR / "data-idx" / "json" / "ihsg_harian.json"
# Potongan ringkas untuk halaman depan: lilin hari ini cuma butuh SATU harga
# buka, dan memaksa pengunjung mengunduh 36 tahun riwayat (354 KB) demi satu
# angka itu tak sebanding. 250 hari bursa ≈ satu tahun, ±15 KB.
RINGKAS = AKAR / "data-idx" / "json" / "ihsg_ohlc_ringkas.json"
HARI_RINGKAS = 250
SIMBOL = "%5EJKSE"
MULAI = datetime(1990, 1, 1, tzinfo=timezone.utc)


def gabung(lama: list[list], baru: list[list]) -> list[list]:
    """Gabung menurut tanggal — hari yang sudah ada DITIMPA, bukan ditambahkan.
    Panen dua kali di hari yang sama tidak boleh menggandakan barisnya."""
    peta = {b[0]: b for b in lama}
    for b in baru:
        peta[b[0]] = b
    return [peta[k] for k in sorted(peta)]


def tarik_penuh() -> list[list]:
    """Potongan 5 tahun berturut-turut sampai hari ini."""
    baris: list[list] = []
    awal = MULAI
    kini = datetime.now(timezone.utc)
    while awal < kini:
        akhir = min(awal + timedelta(days=365 * 5 + 2), kini)
        print(f"  {awal:%Y-%m-%d} … {akhir:%Y-%m-%d}")
        potong = ke_baris(ambil(SIMBOL, int(awal.timestamp()), int(akhir.timestamp()), None))
        print(f"    {len(potong)} hari")
        baris = gabung(baris, potong)
        awal = akhir
        time.sleep(random.uniform(*JEDA))
    return baris


def tulis(baris: list[list]) -> None:
    OHLC.parent.mkdir(parents=True, exist_ok=True)
    OHLC.write_text(json.dumps({
        "kode": "IHSG", "mulai": baris[0][0], "akhir": baris[-1][0], "n": len(baris), "d": baris,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    HARIAN.write_text(json.dumps({
        "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sumber": "Yahoo Finance ^JKSE, OHLCV harian",
        "catatan": "Diminta per potongan 5 tahun: range=max menurunkan resolusi jadi bulanan walau interval=1d.",
        "mulai": baris[0][0], "akhir": baris[-1][0], "n": len(baris),
        "tutup": {b[0]: b[4] for b in baris},
        "buka": {b[0]: b[1] for b in baris},
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    ekor = baris[-HARI_RINGKAS:]
    RINGKAS.write_text(json.dumps({
        "kode": "IHSG", "mulai": ekor[0][0], "akhir": ekor[-1][0], "n": len(ekor), "d": ekor,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"\n{len(baris)} hari · {baris[0][0]} … {baris[-1][0]}")
    print(f"  {OHLC.name} {OHLC.stat().st_size/1024:.0f} KB · {HARIAN.name} {HARIAN.stat().st_size/1024:.0f} KB"
          f" · {RINGKAS.name} {RINGKAS.stat().st_size/1024:.0f} KB")


def swauji() -> None:
    a = [["2026-08-13", 1, 2, 0, 1, 10], ["2026-08-14", 2, 3, 1, 2, 20]]
    b = [["2026-08-14", 9, 9, 9, 9, 99], ["2026-08-17", 3, 4, 2, 3, 30]]
    g = gabung(a, b)
    assert [x[0] for x in g] == ["2026-08-13", "2026-08-14", "2026-08-17"], g
    assert g[1][4] == 9, "hari yang sama harus DITIMPA nilai baru"
    assert len(g) == 3, "penggabungan tidak boleh menggandakan baris"
    print("swauji lolos")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--penuh", action="store_true", help="tarik riwayat 1990-sekarang")
    ap.add_argument("--swauji", action="store_true", help="uji gabung saja, tanpa jaringan")
    arg = ap.parse_args()
    if arg.swauji:
        swauji()
        return

    lama = json.loads(OHLC.read_text(encoding="utf-8"))["d"] if OHLC.exists() else []
    try:
        baru = tarik_penuh() if (arg.penuh or not lama) else ke_baris(ambil(SIMBOL, None, None, "5d"))
    except Ditolak as e:
        print(f"Yahoo menolak ({e}) — tidak ada yang ditulis, coba lagi nanti.")
        sys.exit(1)
    if not baru:
        print("seri kosong — tidak ada yang ditulis.")
        sys.exit(1)
    tulis(gabung(lama, baru))


if __name__ == "__main__":
    main()
