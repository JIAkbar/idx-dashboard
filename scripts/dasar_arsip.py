# -*- coding: utf-8 -*-
"""Peta DASAR: nilai apa adanya hasil peras ulang `_arsip-mentah/keuangan_idx/`.

KENAPA ADA (19 Agu 2026)
-----------------------
`perbaiki_skala_keuangan.py` dulu menebak pembagi dari periode tetangga lalu
MENIMPA berkas di tempat. Dua akibat yang keduanya nyata:

1. Tebakannya bisa salah -- ZBRA 2019 dinaikkan 1000x dari nilai sumbernya.
2. Sesudah ditimpa, tak ada lagi yang bisa dibandingkan. Jalan berikutnya
   berjangkar pada angka yang sudah rusak, jadi kesalahannya permanen: mau
   dibetulkan tangan pun akan dirusak lagi oleh jalan berikutnya.

Peta ini menutup keduanya. XLSX mentahnya ada di cakram (6.679 berkas), jadi
nilai apa adanya SELALU bisa dihitung ulang tanpa satu pun permintaan
jaringan. Perbaikan skala tinggal jadi "dasar x pangkat 1000", dan berapa pun
kali dijalankan hasilnya sama -- termasuk kalau jalan sebelumnya salah.

Membaca 6.679 XLSX makan ~2 jam satu proses, jadi hasilnya disinggahkan di
`_arsip-mentah/keuangan_idx/_dasar.json` dan hanya berkas yang lebih baru dari
singgahan itu yang dibaca ulang.

Pakai:
    python scripts/dasar_arsip.py            # bangun/segarkan singgahan
    python scripts/dasar_arsip.py --paksa    # abaikan singgahan, baca semua
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from concurrent.futures import ProcessPoolExecutor

AKAR = pathlib.Path(__file__).resolve().parent.parent
ARSIP = AKAR / "_arsip-mentah" / "keuangan_idx"
SINGGAH = ARSIP / "_dasar.json"

PERIODE_AKHIR = {"tw1": "03-31", "tw2": "06-30", "tw3": "09-30", "audit": "12-31"}


def _baca(f: str) -> tuple[str, str, str, dict] | None:
    """(kode, bucket, tanggal, {nilai, skala, cur}) -- dijalankan di proses anak."""
    import openpyxl
    import warnings

    warnings.simplefilter("ignore")
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    import panen_keuangan_idx as P

    p = pathlib.Path(f)
    periode, tahun = p.parent.name, p.parent.parent.name
    if periode not in PERIODE_AKHIR:
        return None
    try:
        wb = openpyxl.load_workbook(p, data_only=True, read_only=True)
        nilai, cur, _ = P.ekstrak(wb)
        _, skala, _ = P.info_umum(wb)
        wb.close()
    except Exception:
        return None
    bucket = "tahunan" if periode == "audit" else "kuartal"
    tanggal = f"{tahun}-{PERIODE_AKHIR[periode]}"
    return p.stem, bucket, tanggal, {
        "nilai": {k: v for k, v in nilai.items() if v is not None},
        "skala": skala,
        "cur": cur,
    }


def muat(bangun: bool = True) -> dict:
    """Peta dasar dari singgahan; dibangun/disegarkan kalau perlu."""
    peta = {}
    if SINGGAH.exists():
        try:
            peta = json.loads(SINGGAH.read_text(encoding="utf-8"))
        except Exception:
            peta = {}
    if bangun:
        peta = segarkan(peta)
    return peta


def segarkan(peta: dict, paksa: bool = False) -> dict:
    berkas = sorted(ARSIP.glob("*/*/*.xlsx"))
    batas = 0.0 if paksa or not SINGGAH.exists() else SINGGAH.stat().st_mtime
    perlu = [str(f) for f in berkas if f.stat().st_mtime > batas]
    if not perlu:
        return peta
    print(f"membaca {len(perlu)} XLSX dari arsip ...", flush=True)
    with ProcessPoolExecutor(max_workers=12) as ex:
        for n, hasil in enumerate(ex.map(_baca, perlu, chunksize=8), 1):
            if n % 500 == 0:
                print(f"  {n}/{len(perlu)}", flush=True)
            if hasil is None:
                continue
            kode, bucket, tanggal, isi = hasil
            peta.setdefault(kode, {}).setdefault(bucket, {})[tanggal] = isi
    SINGGAH.write_text(
        json.dumps(peta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"singgahan ditulis: {SINGGAH}", flush=True)
    return peta


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--paksa", action="store_true", help="abaikan singgahan")
    a = ap.parse_args()
    peta = segarkan({} if a.paksa else muat(bangun=False), paksa=a.paksa)
    n = sum(len(v) for e in peta.values() for v in e.values())
    print(f"emiten: {len(peta)}   periode berdasar: {n}")
