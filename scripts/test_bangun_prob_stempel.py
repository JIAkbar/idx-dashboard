# -*- coding: utf-8 -*-
"""Swauji stempel `data-idx/json/prob/` — dua stempel, bukan satu.

Menguji bagian yang ditambahkan ke `bangun_prob.py` saja (pembacaan tanggal
bar terakhir), BUKAN matematika peluangnya: pool-nya mahal dibangun dan
menjalankannya di sini akan menimpa 956 berkas dengan angka baru.

Pakai:  python scripts/test_bangun_prob_stempel.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

JSON = AKAR / "data-idx" / "json"
PROB, OHLC = JSON / "prob", JSON / "ohlc"


def uji_ekspresi_stempel() -> None:
    """`ohlc[kode][-1][0]` benar-benar tanggal bar terakhir yang dipakai mesin."""
    import bangun_prob

    contoh = ["AADI", "BBCA", "TLKM"]
    ohlc = bangun_prob.muat_ohlc(contoh)
    assert ohlc, "muat_ohlc mengembalikan kosong"
    for kode, seri in ohlc.items():
        bar = seri[-1]
        # Bentuk seri WAJIB list-of-list; mesin juga menerima list-of-dict dan
        # kalau muat_ohlc suatu hari berpindah ke bentuk itu, [-1][0] akan
        # menghasilkan KeyError — uji ini yang menangkapnya, bukan produksi.
        assert isinstance(bar, list), f"{kode}: bar bukan list, stempel akan salah"
        tgl = bar[0]
        assert isinstance(tgl, str) and len(tgl) == 10 and tgl[4] == "-", f"{kode}: {tgl!r}"
        mentah = json.loads((OHLC / f"{kode}.json").read_text(encoding="utf-8"))["d"]
        sah = [b[0] for b in mentah if b and b[4] not in (None, 0)]
        assert tgl == sah[-1], f"{kode}: {tgl} bukan bar tersaring terakhir ({sah[-1]})"
    print(f"  ekspresi stempel OK atas {len(ohlc)} emiten")


def uji_keluaran_lengkap() -> None:
    """Tiap berkas terbit punya KEDUA stempel, dan harga_pada bukan karangan."""
    berkas = [p for p in sorted(PROB.glob("*.json")) if p.stem != "index"]
    assert berkas, "belum ada keluaran prob"
    tanpa, palsu = [], []
    for p in berkas:
        d = json.loads(p.read_text(encoding="utf-8"))
        if not d.get("dibangun") or not d.get("harga_pada"):
            tanpa.append(p.stem)
            continue
        # harga_pada harus tanggal yang BENAR-BENAR ada di arsip harga emiten
        # itu — stempel yang tak bisa ditelusuri sama tak bergunanya dengan
        # tak ada stempel.
        mentah = json.loads((OHLC / f"{p.stem}.json").read_text(encoding="utf-8"))["d"]
        if d["harga_pada"] not in {b[0] for b in mentah if b}:
            palsu.append((p.stem, d["harga_pada"]))
        assert d["harga_pada"] <= d["dibangun"][:10], f"{p.stem}: dihitung sebelum datanya ada"
    assert not tanpa, f"{len(tanpa)} berkas tanpa stempel lengkap: {tanpa[:8]}"
    assert not palsu, f"harga_pada tak ada di arsip harga: {palsu[:8]}"

    idx = json.loads((PROB / "index.json").read_text(encoding="utf-8"))
    assert idx.get("dibangun") and idx.get("harga_pada"), "index.json tanpa stempel lengkap"
    print(f"  {len(berkas)} berkas + index bertanggal · pasar sampai {idx['harga_pada']}")


if __name__ == "__main__":
    uji_ekspresi_stempel()
    uji_keluaran_lengkap()
    print("OK")
