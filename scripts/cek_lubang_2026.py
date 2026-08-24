# -*- coding: utf-8 -*-
"""Emiten mana yang belum lengkap arsip brokernya untuk satu rentang.

Membandingkan hari bursa (dari `ohlc/<KODE>.json`) dengan berkas arsip yang
benar-benar ada, per varian. Nol jaringan.

Dipakai sebagai palang antara panen 2026 dan 2025: jangan pindah tahun
selama tahun sebelumnya masih bolong.

Pakai:
  python scripts/cek_lubang_2026.py
  python scripts/cek_lubang_2026.py --dari 2025-01-02 --sampai 2025-12-30
  python scripts/cek_lubang_2026.py --daftar      # cetak kode saja, satu per baris
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
# Sejak 23 Agu 2026 hanya ENAM varian GROSS yang dipanen; yang enam lagi
# (net*) dihitung dari GROSS saat dibaca. Ambang lama 12 akan menandai
# SEMUA emiten sebagai bolong padahal lengkap.
VARIAN_BAWAAN = 6


def hari_bursa(kode: str, dari: str, sampai: str) -> set[str]:
    p = OHLC / f"{kode}.json"
    if not p.exists():
        return set()
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return set()
    return {r[0] for r in d.get("d") or [] if r and dari <= r[0] <= sampai}


def main() -> int:
    ap = argparse.ArgumentParser(description="Cek lubang arsip broker per emiten")
    ap.add_argument("--dari", default="2026-01-02")
    ap.add_argument("--sampai", default="2026-08-21")
    ap.add_argument("--daftar", action="store_true", help="cetak kode saja")
    ap.add_argument("--varian", type=int, default=VARIAN_BAWAAN, help="berkas minimal per hari")
    a = ap.parse_args()

    emiten = (json.loads(DAFTAR.read_text(encoding="utf-8")) or {}).get("emiten") or []
    kodes = [e.get("kode") or e.get("Code") for e in emiten]

    bolong: list[tuple[int, str, int, int]] = []
    tanpa_ohlc = 0
    lengkap = 0
    for kode in kodes:
        if not kode:
            continue
        bursa = hari_bursa(kode, a.dari, a.sampai)
        if not bursa:
            tanpa_ohlc += 1
            continue
        d = ARSIP / kode
        ada: dict[str, int] = {}
        if d.is_dir():
            for f in os.listdir(d):
                tgl = f.split(".")[0]
                if a.dari <= tgl <= a.sampai:
                    ada[tgl] = ada.get(tgl, 0) + 1
        kurang = sum(1 for t in bursa if ada.get(t, 0) < a.varian)
        if kurang:
            bolong.append((kurang, kode, len(bursa), len(ada)))
        else:
            lengkap += 1

    bolong.sort(reverse=True)
    if a.daftar:
        for _, kode, _, _ in bolong:
            print(kode)
        return 0

    print(f"rentang           : {a.dari} .. {a.sampai}")
    print(f"emiten lengkap    : {lengkap:,}")
    print(f"emiten bolong     : {len(bolong):,}")
    print(f"tanpa data harga  : {tanpa_ohlc:,}  (tak bisa dinilai)")
    if bolong:
        print()
        print(f"{'EMITEN':8}{'hari kurang':>13}{'hari bursa':>12}{'hari ada':>10}")
        for kurang, kode, n_bursa, n_ada in bolong[:25]:
            print(f"{kode:8}{kurang:>13,}{n_bursa:>12,}{n_ada:>10,}")
        if len(bolong) > 25:
            print(f"... dan {len(bolong)-25:,} emiten lain")
    return 0


if __name__ == "__main__":
    sys.exit(main())
