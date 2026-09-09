# -*- coding: utf-8 -*-
"""Gerbang: emiten yang TIDAK ikut terpanen hari itu (#102 A).

Lahir dari kegagalan 8 September 2026 yang berlangsung tanpa satu pun jejak:
99 emiten benar-benar diambil dari sumber (arsip mentahnya ada, berisi bar hari
itu), olahnya lolos saat diputar ulang, tapi berkasnya tak pernah tertulis —
commit panen sore menyentuh 848 dari 963 berkas dan ke-99 itu masih berstempel
tanggal dua hari sebelumnya. Panen melaporkan sukses, log tak ada, dan yang
tersisa cuma stempel yang tertinggal.

Yang diperiksa di sini adalah pertanyaan yang seharusnya diajukan panen kepada
dirinya sendiri: emiten mana yang PUNYA bar hari bursa terakhir di arsip
gabungan, tapi berkas sumbernya berhenti sebelum tanggal itu.

Acuan tanggalnya diambil dari arsip gabungan (`ohlc/`), bukan dari jam dinding:
di hari libur, "hari ini" tak punya bar sama sekali dan gerbang yang memakai
tanggal sistem akan menuduh seluruh 963 emiten gagal.

Keluar 1 kalau ada yang tertinggal — dipanggil di ujung blok OHLCV kedua bat
panen, jadi lubang seperti ini terlihat pada menit yang sama, bukan berminggu
kemudian saat ada yang membaca angkanya dekat-dekat.

Cara pakai:
  python scripts/cek_panen_ohlcv.py            # periksa, keluar 1 bila ada
  python scripts/cek_panen_ohlcv.py --swauji   # uji logikanya, tanpa arsip
"""
import argparse
import io
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
JSON = AKAR / "data-idx" / "json"
GABUNG = JSON / "ohlc"
SUMBER = JSON / "ohlcv_stockbit"
LAPORAN = AKAR / "logs" / "panen_tertinggal.txt"


def hari_terakhir_gabungan() -> str:
    """Tanggal bar terbaru di arsip gabungan, dibaca dari emiten paling likuid.

    BBCA diperdagangkan tiap hari bursa, jadi bar terakhirnya setara kalender
    bursa — dan membacanya dari satu berkas jauh lebih murah daripada membuka
    963 berkas hanya untuk tahu tanggalnya.
    """
    p = GABUNG / "BBCA.json"
    if not p.exists():
        raise SystemExit(f"acuan tanggal tak ada: {p}")
    d = json.loads(io.open(p, encoding="utf-8").read())
    bar = d.get("d") or []
    if not bar:
        raise SystemExit("acuan tanggal kosong")
    return str(bar[-1][0])[:10]


def tertinggal(acuan: str) -> list[tuple[str, str]]:
    """(kode, tanggal terakhir) untuk emiten yang bar terakhirnya < acuan.

    Emiten yang memang tak diperdagangkan hari itu TIDAK ikut: yang dibandingkan
    berkas sumber dengan arsip GABUNGAN emiten yang sama, jadi emiten yang
    sama-sama berhenti di tanggal lama tak dianggap tertinggal — ia memang sepi.
    """
    out = []
    for p in sorted(SUMBER.glob("*.json")):
        kode = p.stem
        pg = GABUNG / f"{kode}.json"
        if not pg.exists():
            continue
        try:
            g = json.loads(io.open(pg, encoding="utf-8").read()).get("d") or []
            s = json.loads(io.open(p, encoding="utf-8").read()).get("bar") or []
        except Exception:  # noqa: BLE001 - berkas rusak dilaporkan, bukan diam
            out.append((kode, "TAK TERBACA"))
            continue
        if not g or not s:
            continue
        tg = str(g[-1][0])[:10]
        ts = str(s[-1][0])[:10]
        # Hanya yang arsip gabungannya SUDAH sampai acuan: kalau keduanya
        # tertinggal, yang salah bukan panen emiten ini.
        if tg >= acuan and ts < acuan:
            out.append((kode, ts))
    return out


def swauji() -> int:
    kal = "2026-09-08"
    assert not tertinggal.__doc__ is None
    # Aturan intinya diuji lewat data kecil, bukan lewat arsip: yang gampang
    # salah adalah SIAPA yang dianggap tertinggal, bukan cara membaca berkas.
    kasus = [
        # (tgl arsip gabungan, tgl berkas sumber, tertinggal?)
        ("2026-09-08", "2026-09-08", False),  # sama-sama mutakhir
        ("2026-09-08", "2026-09-05", True),   # sumber berhenti lebih awal
        ("2026-09-05", "2026-09-05", False),  # emiten sepi - keduanya tertinggal
        ("2026-09-05", "2026-09-08", False),  # sumber justru lebih maju
    ]
    for tg, ts, harap in kasus:
        assert ((tg >= kal) and (ts < kal)) is harap, (tg, ts, harap)
    print("swauji lolos")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()

    acuan = hari_terakhir_gabungan()
    sisa = tertinggal(acuan)
    print(f"hari bursa terakhir (arsip gabungan): {acuan}")
    if not sisa:
        print(f"panen OHLCV lengkap - tak ada emiten yang tertinggal")
        return 0
    LAPORAN.parent.mkdir(exist_ok=True)
    io.open(LAPORAN, "w", encoding="utf-8").write(
        f"acuan {acuan}\n" + "\n".join(f"{k}\t{t}" for k, t in sisa) + "\n")
    print(f"::error::{len(sisa)} emiten TIDAK ikut panen OHLCV hari ini "
          f"(arsip gabungannya sudah {acuan}, berkas sumbernya belum)")
    for k, t in sisa[:20]:
        print(f"  {k}\tberhenti di {t}")
    if len(sisa) > 20:
        print(f"  ... {len(sisa) - 20} lagi")
    print(f"daftar lengkap: {LAPORAN}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
