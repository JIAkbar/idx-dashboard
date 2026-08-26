# -*- coding: utf-8 -*-
"""Bangun berkas OLAHAN intraday 1 JAM dari arsip mentah 1 menit.

Pola mentah → olahan yang sama dengan broker (broker-harian → broker_tahunan):
- MENTAH (kanon): `_arsip-mentah/intraday/<KODE>/<YYYY-MM>.json.gz` — bar 1 menit
  utuh, di luar git, TIDAK pernah dibaca halaman.
- OLAHAN (dibaca halaman): `data-idx/json/intraday_1h/<KODE>.json` — bar 1 JAM
  larik padat. 4H TIDAK disimpan — diagregasi klien dari 1H (paruh sesi:
  pagi <12:00, sore >=12:00 = tepat "2 bar 4H per hari bursa" spek §8.4).
  Menyimpan 1m ke repo mustahil (ratusan MB); menyimpan 1H+4H = berlipat.

Aturan ember 1 jam (spek `spek_rbs_gap_intraday.md` §3.4):
- Ember = jam pada `unix_timestamp` (WIB). Bar lelang pembuka (08:58-08:59)
  digabung ke ember 09:00; bar pasca-15:50 (lelang penutup, s.d. 16:14)
  digabung ke ember 15:00. Sesi Jumat 13:00 kosong → embernya memang tak ada.
- OHLC: open = bar menit pertama, close = terakhir, high/low = ekstrem;
  volume/value/frequency/foreign dijumlah.

Cek jujur yang DICETAK, bukan dipercaya:
- Per emiten sampel: Σ volume 1H == Σ volume 1m (wajib sama persis).
- `foreign_buy/sell` pada hari yang SUDAH TUTUP: terisi atau nol — temuan ❓
  di referensi yang harus dijawab dari data, bukan asumsi.

Pakai:
    python scripts/bangun_intraday_1h.py            # semua emiten berarsip
    python scripts/bangun_intraday_1h.py --hanya BBCA,BUMI
    python scripts/bangun_intraday_1h.py --uji      # swauji, nol jaringan/arsip
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
ARSIP = AKAR / "_arsip-mentah" / "intraday"
KELUARAN = AKAR / "data-idx" / "json" / "intraday_1h"
WIB = timezone(timedelta(hours=7))

KOLOM = ["epoch", "open", "high", "low", "close", "volume", "value", "frequency",
         "foreign_buy", "foreign_sell"]


def ember_epoch(ts: int) -> int:
    """Epoch awal ember 1 jam WIB untuk satu bar menit — 08:xx naik ke 09:00,
    >=16:00 turun ke 15:00."""
    d = datetime.fromtimestamp(ts, WIB)
    jam = d.hour
    if jam < 9:
        jam = 9
    elif jam >= 16:
        jam = 15
    return int(d.replace(hour=jam, minute=0, second=0, microsecond=0).timestamp())


def agregasi_1h(bar_menit: list[dict]) -> list[list]:
    """1m → 1H. Bar masuk TIDAK diasumsikan terurut."""
    ember: dict[int, list[dict]] = {}
    for b in bar_menit:
        ember.setdefault(ember_epoch(int(b["unix_timestamp"])), []).append(b)
    keluar = []
    for e in sorted(ember):
        isi = sorted(ember[e], key=lambda b: int(b["unix_timestamp"]))
        keluar.append([
            e,
            isi[0]["open"],
            max(b["high"] for b in isi),
            min(b["low"] for b in isi),
            isi[-1]["close"],
            sum(int(b["volume"]) for b in isi),
            sum(int(b["value"]) for b in isi),
            sum(int(b["frequency"]) for b in isi),
            sum(int(b["foreign_buy"]) for b in isi),
            sum(int(b["foreign_sell"]) for b in isi),
        ])
    return keluar


def baca_arsip(kode: str) -> list[dict]:
    d = ARSIP / kode
    bar: list[dict] = []
    for f in sorted(d.glob("*.json.gz")):
        bar.extend(json.loads(gzip.decompress(f.read_bytes()).decode("utf-8")))
    return bar


def swauji() -> int:
    e = lambda s: int(datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=WIB).timestamp())  # noqa: E731
    def m(ts, o, h, l, c, v):  # noqa: E306,E741
        return {"unix_timestamp": ts, "open": o, "high": h, "low": l, "close": c,
                "volume": str(v), "value": v * 100, "frequency": "1",
                "foreign_buy": 0, "foreign_sell": 0}
    bar = [
        m(e("2026-08-24 08:58"), 100, 101, 99, 100, 10),   # lelang buka → ember 09
        m(e("2026-08-24 09:30"), 100, 105, 100, 104, 20),
        m(e("2026-08-24 10:15"), 104, 106, 103, 105, 30),
        m(e("2026-08-24 16:10"), 105, 107, 105, 106, 40),  # lelang tutup → ember 15
    ]
    h = agregasi_1h(bar)
    assert len(h) == 3, h  # ember 09, 10, 15
    j9 = h[0]
    assert datetime.fromtimestamp(j9[0], WIB).hour == 9
    assert j9[1] == 100 and j9[4] == 104 and j9[2] == 105 and j9[3] == 99 and j9[5] == 30, j9
    j15 = h[2]
    assert datetime.fromtimestamp(j15[0], WIB).hour == 15 and j15[5] == 40
    assert sum(r[5] for r in h) == sum(int(b["volume"]) for b in bar)  # Σvol utuh
    print("swauji lolos")
    return 0


def utama() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hanya", default="")
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        return swauji()
    emiten = sorted(d.name for d in ARSIP.iterdir() if d.is_dir() and not d.name.startswith("_"))
    if a.hanya:
        pilih = {k.strip().upper() for k in a.hanya.split(",")}
        emiten = [k for k in emiten if k in pilih]
    KELUARAN.mkdir(parents=True, exist_ok=True)
    kini = datetime.now(WIB).isoformat(timespec="seconds")
    total_bar = 0
    cek_vol_beres = cek_asing_terisi = cek_asing_nol = 0
    for i, kode in enumerate(emiten, 1):
        menit = baca_arsip(kode)
        if not menit:
            continue
        jam = agregasi_1h(menit)
        total_bar += len(jam)
        # cek jujur: Σ volume harus utuh
        if sum(r[5] for r in jam) == sum(int(b["volume"]) for b in menit):
            cek_vol_beres += 1
        else:
            print(f"  ⚠ {kode}: Σ volume 1H != Σ volume 1m — JANGAN dipakai sebelum dicari sebabnya")
        if any(r[8] or r[9] for r in jam):
            cek_asing_terisi += 1
        else:
            cek_asing_nol += 1
        (KELUARAN / f"{kode}.json").write_text(json.dumps({
            "kode": kode, "dibangun": kini, "kolom": KOLOM, "bar": jam,
        }, separators=(",", ":")), encoding="utf-8")
        if i % 200 == 0:
            print(f"[{i}/{len(emiten)}] …", flush=True)
    print(f"SELESAI: {len(emiten)} emiten, {total_bar:,} bar 1H. "
          f"Σvolume utuh: {cek_vol_beres}/{len(emiten)}. "
          f"foreign_* hari-tutup: terisi di {cek_asing_terisi} emiten, "
          f"nol semua di {cek_asing_nol} — temuan ❓ referensi terjawab dari sini.")
    return 0


if __name__ == "__main__":
    raise SystemExit(utama())
