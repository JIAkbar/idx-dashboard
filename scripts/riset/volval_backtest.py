# -*- coding: utf-8 -*-
"""Backtest mundur metode volval Johan — bar 5 menit.

Metodenya (verbatim, `docs/spek-dev-papan/metode_johan_volval.md`):
  "lihat timeframe 5 menit kemudian, volval, volume terhadap value, jika
   volume tinggi dan value naik makan ada potensi naik"

CARA UJINYA, atas usul Johan sendiri: pura-pura buta tanggal 10 Agustus.
Bangun sinyal HANYA dari 3-7 Agustus, lalu buka 10 Agustus dan lihat hasilnya.
Jendela yang sudah tutup di masa lalu sama sahnya dengan menunggu masa depan —
yang menentukan bukan kapan datanya ada, melainkan apakah aturannya dipilih
sebelum hasilnya dilihat.

TIGA PENJAGA supaya "buta" itu nyata, bukan klaim:

1. **Berkas ini tak pernah membaca bar sesudah tanggal sinyal saat menyusun
   peringkat.** Fungsi penyusun (`fitur_volval`) dibatasi keras oleh parameter
   `sampai`; fungsi penilai (`hasil_maju`) dipanggil terpisah SESUDAHNYA.

2. **Ambang tidak ditebak lalu disetel.** Seluruh permukaan ambang disapu
   (volume 1,5x-5x, top-N 10/20/30) dan SEMUA hasilnya dicetak — termasuk yang
   jelek. Menyetel ambang sampai kasus favorit muncul adalah pola yang sudah
   dibayar di `kandidat_deepdive.py`; di sana BUMI & DSSA justru terbuang saat
   ambangnya dinaikkan.

3. **Bar pembukaan dibuang.** 30 menit pertama selalu bervolume raksasa dan
   akan memenuhi syarat "volume tinggi" tiap hari untuk hampir tiap emiten —
   ia menandai jam buka, bukan minat beli.

DUA PEMBACAAN diuji berdampingan, karena kalimat Johan menampung keduanya dan
mana yang ia maksud belum dipastikan:

  A_mentah  volume bar > ambang x rata-rata  DAN  value bar > value bar lalu
  B_hargarata  volume bar > ambang x rata-rata  DAN  (value/volume) naik

(A) lemah secara logika — `value = volume x harga`, jadi value hampir selalu
ikut naik saat volume naik, dan syarat keduanya nyaris menyebut satu hal dua
kali. (B) menuntut harga rata-rata yang DIBAYAR bergerak naik. Diuji dua-duanya
dan hasilnya dilaporkan apa adanya.

Jalankan dari akar repo:
    python scripts/riset/volval_backtest.py
    python scripts/riset/volval_backtest.py --uji
"""
from __future__ import annotations

import argparse
import gzip
import json
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
INTRA = AKAR / "_arsip-mentah" / "intraday"
OHLC = AKAR / "data-idx" / "json" / "ohlc"
KELUARAN = AKAR / "data-idx" / "json" / "volval_backtest.json"

# Jendela penyusun sinyal dan hari penilaian pertama. Keduanya hari bursa
# nyata (25 Agu 2026 libur mengajarkan: kalender masehi tak boleh dipakai).
JENDELA = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
MULAI_NILAI = "2026-08-10"
HORIZON = 5

# Bar pembukaan yang dibuang — penjaga (3).
JAM_MULAI = "09:30"

AMBANG_VOL = [1.5, 2.0, 3.0, 5.0]
TOP_N = [10, 20, 30]


def bar5(kode: str, tanggal: set[str]) -> dict[str, list[dict]]:
    """Bar 5 MENIT per tanggal, dijumlahkan dari bar 1 menit arsip.

    Volume dan value DIJUMLAHKAN (keduanya aditif); harga rata-rata bar
    dihitung ulang sebagai value/volume, bukan dirata-rata dari harga menit —
    merata-rata harga akan memberi bobot sama pada menit sepi dan menit ramai.
    """
    d = INTRA / kode
    if not d.is_dir():
        return {}
    ember: dict[str, dict[int, dict]] = defaultdict(dict)
    for p in sorted(d.glob("2026-*.json.gz")):
        try:
            isi = json.load(gzip.open(p, "rt", encoding="utf-8"))
        except Exception:
            continue
        for b in isi:
            dt = b.get("datetime") or ""
            tgl, jam = dt[:10], dt[11:16]
            if tgl not in tanggal or jam < JAM_MULAI:
                continue
            try:
                v = float(b["volume"])
                n = float(b["value"])
            except (KeyError, TypeError, ValueError):
                continue
            if v <= 0 or n <= 0:
                continue
            kunci = int(jam[:2]) * 12 + int(jam[3:5]) // 5      # ember 5 menit
            e = ember[tgl].setdefault(kunci, {"vol": 0.0, "val": 0.0, "k": kunci})
            e["vol"] += v
            e["val"] += n
    return {t: [v[k] for k in sorted(v)] for t, v in ember.items()}


def fitur_volval(kode: str, sampai: list[str], ambang: float) -> dict | None:
    """Skor volval dari bar 5 menit, HANYA atas tanggal di `sampai`.

    Dibatasi keras oleh `sampai` — penjaga (1). Fungsi ini tak punya akses ke
    tanggal lain, jadi tak ada jalan ia mengintip hasil.
    """
    per = bar5(kode, set(sampai))
    if len(per) < len(sampai):
        return None
    a = b = total = 0
    for tgl in sampai:
        bar = per.get(tgl) or []
        if len(bar) < 12:                       # hari terlalu bolong
            continue
        vols = [x["vol"] for x in bar]
        acuan = st.median(vols)
        if acuan <= 0:
            continue
        for i in range(1, len(bar)):
            total += 1
            if bar[i]["vol"] < ambang * acuan:
                continue
            if bar[i]["val"] > bar[i - 1]["val"]:
                a += 1
            hr_kini = bar[i]["val"] / bar[i]["vol"]
            hr_lalu = bar[i - 1]["val"] / bar[i - 1]["vol"]
            if hr_kini > hr_lalu:
                b += 1
    if total < 100:
        return None
    return {"kode": kode, "bar": total,
            "A_mentah": 100 * a / total, "B_hargarata": 100 * b / total}


def kalender() -> list[str]:
    hit: dict[str, int] = {}
    n = 0
    for p in OHLC.glob("*.json"):
        n += 1
        try:
            for x in json.loads(p.read_text(encoding="utf-8"))["d"][-90:]:
                hit[x[0]] = hit.get(x[0], 0) + 1
        except Exception:
            pass
    return sorted(t for t, c in hit.items() if c >= max(2, n // 2))


def tutup_harian() -> dict[str, dict[str, float]]:
    out = {}
    for p in OHLC.glob("*.json"):
        try:
            out[p.stem] = {x[0]: x[4] for x in json.loads(p.read_text(encoding="utf-8"))["d"][-90:]}
        except Exception:
            pass
    return out


def hasil_maju(kode: str, harga: dict, kal: list[str], hari: str, n: int) -> float | None:
    """Return dari tutup hari SEBELUM `hari` ke tutup n hari bursa sesudahnya.

    Dipanggil TERPISAH dari penyusun peringkat — penjaga (1).
    """
    pm = harga.get(kode) or {}
    try:
        i = kal.index(hari)
    except ValueError:
        return None
    awal, akhir = kal[i - 1], kal[min(i + n - 1, len(kal) - 1)]
    a, b = pm.get(awal), pm.get(akhir)
    if not a or not b:
        return None
    return 100 * (b - a) / a


def jalankan() -> dict:
    kal = kalender()
    harga = tutup_harian()
    kode_semua = sorted(p.name for p in INTRA.iterdir() if p.is_dir())
    print(f"  {len(kode_semua)} emiten punya arsip intraday")
    print(f"  jendela sinyal : {JENDELA[0]} .. {JENDELA[-1]}  (BUTA sesudah ini)")
    print(f"  hari penilaian : {MULAI_NILAI} (hari-1) sampai H+{HORIZON}\n")

    # ---- fitur, per ambang. Tak satu pun baris di sini menyentuh 10 Agustus.
    fitur: dict[float, list[dict]] = {}
    for amb in AMBANG_VOL:
        baris = []
        for k in kode_semua:
            f = fitur_volval(k, JENDELA, amb)
            if f:
                baris.append(f)
        fitur[amb] = baris
        print(f"  ambang {amb}x: {len(baris)} emiten berfitur")

    # ---- baru SEKARANG hasilnya dibuka.
    for n in (1, HORIZON):
        semua = [hasil_maju(k, harga, kal, MULAI_NILAI, n) for k in kode_semua]
        semua = [x for x in semua if x is not None]
        semua.sort()
        med = st.median(semua)
        print(f"\n  === HASIL H+{n} (mulai {MULAI_NILAI}) ===")
        print(f"  pasar: median {med:+.2f}%  ·  {len(semua)} emiten  ·  "
              f"naik {100*sum(1 for v in semua if v>0)/len(semua):.0f}%")
        print(f"  {'baca':12s} {'ambang':>7s} {'topN':>5s} {'n':>4s} "
              f"{'median':>8s} {'vs pasar':>9s} {'menang':>7s}")
        for baca in ("A_mentah", "B_hargarata"):
            for amb in AMBANG_VOL:
                bar = sorted(fitur[amb], key=lambda x: -x[baca])
                for topn in TOP_N:
                    pilih = bar[:topn]
                    r = [hasil_maju(x["kode"], harga, kal, MULAI_NILAI, n) for x in pilih]
                    r = [v for v in r if v is not None]
                    if not r:
                        continue
                    m = st.median(r)
                    print(f"  {baca:12s} {amb:6.1f}x {topn:5d} {len(r):4d} "
                          f"{m:+7.2f}% {m-med:+8.2f} "
                          f"{100*sum(1 for v in r if v>med)/len(r):6.0f}%")
    return {"jendela": JENDELA, "mulai_nilai": MULAI_NILAI,
            "fitur": {str(k): v for k, v in fitur.items()}}


def swauji() -> None:
    # Penjaga (1): fitur_volval tak boleh melihat tanggal di luar `sampai`.
    import inspect
    src = inspect.getsource(fitur_volval)
    assert "sampai" in src and "MULAI_NILAI" not in src, \
        "fitur_volval menyebut hari penilaian — kebutaannya bocor"
    src2 = inspect.getsource(bar5)
    assert "tanggal" in src2 and "MULAI_NILAI" not in src2

    # Penjaga (3): bar sebelum JAM_MULAI dibuang.
    assert JAM_MULAI > "09:00", "bar pembukaan tak dibuang"

    # Ember 5 menit: 09:30-09:34 satu ember, 09:35 ember berikutnya.
    def ember(j):
        return int(j[:2]) * 12 + int(j[3:5]) // 5
    assert ember("09:30") == ember("09:34") != ember("09:35"), "pengelompokan 5 menit salah"
    assert ember("10:00") - ember("09:55") == 1

    print("swauji volval_backtest: 4 penjaga lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)
    h = jalankan()
    KELUARAN.write_text(json.dumps(h, ensure_ascii=False), encoding="utf-8")
    print(f"\n  ditulis: {KELUARAN.relative_to(AKAR)}")
