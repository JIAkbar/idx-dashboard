# -*- coding: utf-8 -*-
"""Antrean PENUTUPAN level terbaik per emiten -> data-idx/json/bidoffer.json.

Dipakai halaman Kuli Papan (kalkulator Target Realistis) sebagai nilai awal
Bid/Offer. Sumbernya arsip mentah statistik harian IDX yang sudah kita simpan
(`_arsip-mentah/asing/<tahun>/<YYYYMMDD>.json.gz`) — jadi nol jaringan.

YANG PENTING DAN GAMPANG SALAH DIBACA: `BidVolume`/`OfferVolume` di sini adalah
volume pada level harga TERBAIK saja, bukan total antrean seluruh orderbook.
Rumus Target Realistis butuh TOTAL bid & offer, dan itu tak tersedia di sumber
gratis mana pun — karena itu halaman memberi keduanya sebagai isian manual
berlabel jelas, dan angka dari sini hanya mengisi harga Bid/Offer-nya.

Pakai:
  python scripts/bangun_bidoffer.py
  python scripts/bangun_bidoffer.py --swauji
"""
from __future__ import annotations

import argparse
import glob
import gzip
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
ARSIP = AKAR / "_arsip-mentah" / "asing"
KELUAR = AKAR / "data-idx" / "json" / "bidoffer.json"


def baris_terakhir() -> tuple[str, list]:
    """(tanggal YYYY-MM-DD, baris) dari arsip harian IDX termuda YANG BERISI.

    Termuda saja tidak cukup (insiden 28 Agu 2026): panen pagi mengarsipkan
    tanggal berjalan yang balasannya masih 0 baris (IDX belum terbit), dan
    skrip ini lalu menulis bidoffer.json kosong — Kuli Papan kehilangan
    seluruh bid/offer tanpa satu pun galat. Mundur maksimal 10 arsip sampai
    ketemu yang berisi (libur/akhir pekan juga 0 baris, jadi batasnya wajar).
    """
    fs = sorted(glob.glob(str(ARSIP / "*" / "*.json.gz")))
    if not fs:
        raise SystemExit(f"arsip harian tak ada di {ARSIP}")
    for f in reversed(fs[-10:]):
        with gzip.open(f, "rt", encoding="utf-8") as fh:
            g = json.load(fh)
        rows = g.get("data") if isinstance(g, dict) else g
        if rows:
            nama = Path(f).name[:8]
            return f"{nama[:4]}-{nama[4:6]}-{nama[6:8]}", rows
    raise SystemExit("10 arsip termuda semuanya kosong — periksa pemanen asing")


def padatkan(rows: list) -> dict[str, list]:
    """kode -> [bid, bid_lot, offer, offer_lot, close, prev]; lot = lembar/100."""
    out: dict[str, list] = {}
    for r in rows:
        kode = r.get("StockCode")
        if not kode:
            continue
        bid, off = r.get("Bid") or 0, r.get("Offer") or 0
        if not bid and not off:
            continue
        out[kode] = [
            round(bid), round((r.get("BidVolume") or 0) / 100),
            round(off), round((r.get("OfferVolume") or 0) / 100),
            round(r.get("Close") or 0), round(r.get("Previous") or 0),
        ]
    return out


def swauji() -> int:
    rows = [
        {"StockCode": "BUMI", "Bid": 195.0, "BidVolume": 95073200.0,
         "Offer": 196.0, "OfferVolume": 66205700.0, "Close": 196.0, "Previous": 190.0},
        {"StockCode": "KOSONG", "Bid": 0, "BidVolume": 0, "Offer": 0, "OfferVolume": 0},
    ]
    p = padatkan(rows)
    assert p["BUMI"] == [195, 950732, 196, 662057, 196, 190], p["BUMI"]
    assert "KOSONG" not in p, "emiten tanpa antrean tak boleh masuk"
    print("swauji OK — 2/2 assert lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Bangun bidoffer.json dari arsip harian IDX")
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()

    tgl, rows = baris_terakhir()
    data = padatkan(rows)
    KELUAR.write_text(json.dumps({
        "tanggal": tgl,
        "kolom": ["bid", "bid_lot", "offer", "offer_lot", "close", "prev"],
        "catatan": "antrean penutupan level harga terbaik saja, bukan total orderbook",
        "d": data,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(data):,} emiten · {tgl} -> {KELUAR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
