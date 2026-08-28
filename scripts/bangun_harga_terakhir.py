"""Bangun `data-idx/json/harga_terakhir.json` — cadangan harga untuk
Kalkulator (Avg Down & Pemulihan) saat pengambilan harga langsung gagal.

Lahir 28 Agu 2026 dari audit rantai panen (keluhan Johan: "bnyk yang setelah
panen data, page-page itu tidak saling terhubung"): berkas ini SUDAH dibaca
`lib/hargaTerakhir.ts` tapi tak punya penulis satu pun di repo — isinya
buatan tangan 15 Agu dan akan basi selamanya. Kini: close bar TERAKHIR tiap
emiten dari `ohlc/` (nol jaringan), bentuk persis yang lama
(`{bulan, catatan, harga: {KODE: close}}`).

  python scripts/bangun_harga_terakhir.py
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
DIR_OHLC = AKAR / "data-idx" / "json" / "ohlc"
KELUAR = AKAR / "data-idx" / "json" / "harga_terakhir.json"


def main() -> int:
    harga: dict[str, float] = {}
    tgl_terakhir = ""
    for f in sorted(DIR_OHLC.glob("*.json")):
        kode = f.stem
        if not kode.isupper() or kode == "IHSG":
            continue
        try:
            d = json.load(open(f, encoding="utf-8"))
            bar = d["d"][-1]
        except Exception:
            continue
        harga[kode] = float(bar[4])
        if str(bar[0]) > tgl_terakhir:
            tgl_terakhir = str(bar[0])
    if len(harga) < 500:
        raise SystemExit(f"cuma {len(harga)} emiten terbaca — ohlc/ bermasalah, tidak menulis")
    KELUAR.write_text(json.dumps({
        "bulan": tgl_terakhir[:7] or date.today().strftime("%Y-%m"),
        "catatan": "Penutupan terakhir arsip harga — cadangan saat harga langsung tak bisa diambil.",
        "harga": harga,
    }, ensure_ascii=False), encoding="utf-8")
    print(f"ditulis: {KELUAR.name} — {len(harga)} emiten, bar terakhir {tgl_terakhir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
