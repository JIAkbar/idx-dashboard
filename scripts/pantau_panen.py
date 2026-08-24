# -*- coding: utf-8 -*-
"""Satu tik pemantau panen broker — hari bursa, bukan jumlah berkas mentah.

KENAPA HARI, BUKAN BERKAS. Jumlah berkas mentah menyesatkan sejak varian
turun 12 -> 6 (23 Agu 2026): cakram memuat 465 ribu berkas varian NET dari
jalan sebelumnya yang tak lagi dipanen dan tak dibaca halaman mana pun, jadi
"1,2 juta berkas" terdengar hampir selesai padahal target sebenarnya 879 ribu
dengan 494 ribu terpenuhi. Menghitung HARI yang sudah lengkap (>= n varian)
kebal terhadap sisa varian lama.

KENAPA BUKAN "emiten tuntas": satu emiten butuh ~13 menit (153 hari x 5 detik),
dan 44 thread menyelesaikannya hampir bersamaan — angkanya melompat ~44
sekali tiap 13 menit dan terbaca MACET di antaranya. Johan menanyakannya dua
kali; itu cacat ukuran, bukan cacat panen.

Target dihitung sekali lalu disinggahkan (butuh membaca 962 berkas harga).

Pakai:
  python scripts/pantau_panen.py                       # sekali tik
  python scripts/pantau_panen.py --varian 6 --dari 2025-01-02 --sampai 2025-12-30
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
ARSIP = AKAR / "_arsip-mentah" / "broker-harian"
OHLC = AKAR / "data-idx" / "json" / "ohlc"
DAFTAR = AKAR / "data-idx" / "json" / "daftar_emiten.json"


def target(dari: str, sampai: str) -> tuple[dict[str, list[str]], int]:
    """kode -> hari bursa dalam rentang, dan totalnya. Disinggahkan per rentang."""
    cache = AKAR / f".papan_target_{dari}_{sampai}.json"
    if cache.exists():
        try:
            d = json.loads(cache.read_text(encoding="utf-8"))
            return d["hari"], d["total"]
        except Exception:  # noqa: BLE001
            pass
    emiten = (json.loads(DAFTAR.read_text(encoding="utf-8")) or {}).get("emiten") or []
    hari: dict[str, list[str]] = {}
    for e in emiten:
        k = e.get("kode") or e.get("Code")
        p = OHLC / f"{k}.json" if k else None
        if not p or not p.exists():
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        t = [r[0] for r in d.get("d") or [] if r and dari <= r[0] <= sampai]
        if t:
            hari[k] = t
    total = sum(len(v) for v in hari.values())
    cache.write_text(json.dumps({"hari": hari, "total": total}), encoding="utf-8")
    return hari, total


def main() -> int:
    ap = argparse.ArgumentParser(description="Satu tik pemantau panen broker")
    ap.add_argument("--dari", default="2026-01-02")
    ap.add_argument("--sampai", default="2026-08-21")
    ap.add_argument("--varian", type=int, default=6)
    ap.add_argument("--simpan", default=".papan_pantau_hari.json")
    a = ap.parse_args()

    hari, total_hari = target(a.dari, a.sampai)

    lengkap = 0
    emiten_penuh = 0
    for kode, tgls in hari.items():
        d = ARSIP / kode
        per: dict[str, int] = {}
        if d.is_dir():
            for f in os.listdir(d):
                t = f.split(".")[0]
                if a.dari <= t <= a.sampai:
                    per[t] = per.get(t, 0) + 1
        n = sum(1 for t in tgls if per.get(t, 0) >= a.varian)
        lengkap += n
        if n == len(tgls):
            emiten_penuh += 1

    simpan = AKAR / a.simpan
    lama = None
    if simpan.exists():
        try:
            lama = json.loads(simpan.read_text(encoding="utf-8")).get("lengkap")
        except Exception:  # noqa: BLE001
            lama = None
    simpan.write_text(json.dumps({"lengkap": lengkap}), encoding="utf-8")

    if lama is None:
        print(f"PANTAU MULAI: {lengkap:,}/{total_hari:,} hari lengkap "
              f"({lengkap/total_hari*100:.1f}%) · {emiten_penuh} emiten penuh")
        return 0
    delta = lengkap - lama
    sisa = total_hari - lengkap
    if delta <= 0:
        print(f"DIAM: {lengkap:,}/{total_hari:,} hari, nol pertambahan — periksa proses / token")
        return 0
    jam = sisa / delta / 60
    print(f"[{lengkap:,}/{total_hari:,} hari lengkap ({lengkap/total_hari*100:.1f}%) · "
          f"{emiten_penuh}/{len(hari)} emiten penuh · +{delta}/menit · sisa ~{jam:.1f} jam]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
