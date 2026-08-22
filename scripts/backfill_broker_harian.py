# -*- coding: utf-8 -*-
"""Backfill Broker Summary GROSS harian untuk SATU emiten, seluruh riwayat.

Johan 22 Agu 2026: *"coba fetch data dari emiten BUMI semua rentang waktu
yang tersedia"*.

Memakai mesin yang sama dengan panen harian (`panen_broker_harian.jalankan`)
supaya bentuk arsip dan berkas ringkasnya identik — hanya tanggalnya yang
diputar. Kalender bursanya diambil dari bar OHLC emiten itu sendiri (hari
yang ada barnya = hari bursa); API menjawab nol broker pada hari libur, dan
menebak libur dari nol adalah jebakan yang sudah tercatat.

Riwayat API terukur mulai 2017 (2015 kosong), jadi bawaan `--dari` 2017-01-01.
Berkas yang sudah ada di arsip dilewati — jalan ulang hanya menambal bolong.

Berkas ringkas per emiten memuat JENDELA_HARI terakhir saja; riwayat
penuhnya ada di `_arsip-mentah/broker-harian/<KODE>/` (di luar git).

Pakai:
    python scripts/backfill_broker_harian.py BUMI
    python scripts/backfill_broker_harian.py BUMI --dari 2024-01-01 --jeda 0.6
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from types import SimpleNamespace

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

import panen_broker_harian as ph  # noqa: E402


def hari_bursa(kode: str, dari: str, sampai: str) -> list[str]:
    d = ph.baca(ph.DIR_OHLC / f"{kode}.json") or {}
    return [b[0] for b in d.get("d", []) if b and dari <= b[0] <= sampai]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("kode")
    ap.add_argument("--dari", default="2017-01-01")
    ap.add_argument("--sampai", default=None, help="bawaan: bar OHLC terakhir")
    ap.add_argument("--jeda", type=float, default=0.8)
    a = ap.parse_args()
    kode = a.kode.upper()
    sampai = a.sampai or ph.tanggal_bawaan()
    tanggal = hari_bursa(kode, a.dari, sampai)
    sudah = {p.stem for p in (ph.ARSIP / kode).glob("*.json")} if (ph.ARSIP / kode).exists() else set()
    sisa = [t for t in tanggal if t not in sudah]
    print(f"{kode}: {len(tanggal)} hari bursa {a.dari}..{sampai}, {len(sudah)} sudah di arsip, {len(sisa)} akan diambil")
    mulai = time.time()
    ok = 0
    for i, t in enumerate(sisa, 1):
        rc = ph.jalankan(SimpleNamespace(tanggal=t, hanya=kode, batas=None, jeda=a.jeda, ulang=False))
        ok += 1 if rc == 0 else 0
        if i % 50 == 0:
            laju = (time.time() - mulai) / i
            print(f"--- {i}/{len(sisa)} · {laju:.2f}s/hari · sisa ±{laju*(len(sisa)-i)/60:.0f} menit", flush=True)
    print(f"SELESAI {kode}: {ok}/{len(sisa)} hari tersimpan dalam {(time.time()-mulai)/60:.1f} menit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
