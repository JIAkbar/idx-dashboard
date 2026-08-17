# -*- coding: utf-8 -*-
"""Pembantu bersama untuk mengarsipkan respons MENTAH tiap pemanen.

Dipakai oleh SEMUA pemanen `scripts/panen_*.py` dan `scripts/fetch_*.py` —
jangan menyalin logika ini ke tiap skrip, itu persis pola yang membuat
perbaikan berikutnya (mis. ganti direktori, ganti format) terlewat di
sebagian berkas.

Johan 17 Agu 2026: "jangan asal maen buang data yang sudah di panen, gini ini
jadi masalah kan harus unduh lagi, simpan backup saja sewaktu perlu kita
gunakan gini" — "tidak hanya tiap XLSX, tapi semua data yang berkaitan dengan
Papan simpan di folder itu". Yang mahal itu MENGAMBILNYA (endpoint IDX kena
403 kalau digedor, Yahoo memblokir sementara, IPOT cuma bisa dipanen dari IP
rumahan) — bukan menyimpannya. Simpan mentahnya, parse-nya boleh diulang
kapan saja tanpa satu pun permintaan jaringan baru.

Polanya dipinjam dari `panen_keuangan_idx.py` (`ARSIP_MENTAH`, `jalur_arsip`,
`ambil_xlsx`) — skrip pertama yang menerapkan aturan ini.

Tata letak: `_arsip-mentah/<sumber>/<bagian...>` — sengaja DI LUAR repo (lihat
.gitignore) supaya arsip yang bisa membengkak (ratusan MB) tak ikut tiap
kloning, tapi TETAP ADA di cakram.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

AKAR_ARSIP = Path(__file__).resolve().parent.parent / "_arsip-mentah"


def jalur(sumber: str, *bagian: str) -> Path:
    """mis. jalur('ohlc', '2026-08-17', 'BBCA.json')."""
    return AKAR_ARSIP.joinpath(sumber, *bagian)


def simpan(sumber: str, *bagian: str, data: bytes | str | dict | list) -> None:
    """Tulis arsip. `dict`/`list` ditulis sebagai JSON, `str` di-encode UTF-8,
    `bytes` ditulis apa adanya.

    Kegagalan menulis TIDAK BOLEH menggagalkan panen — cakram penuh atau izin
    ditolak dicetak sebagai catatan, panen lanjut. Panen yang batal karena
    arsipnya gagal ditulis itu kerugian dua kali (network call yang sudah
    dibayar, hasilnya pun tak tersimpan sama sekali).
    """
    if isinstance(data, (dict, list)):
        mentah = json.dumps(data, ensure_ascii=False).encode("utf-8")
    elif isinstance(data, str):
        mentah = data.encode("utf-8")
    elif isinstance(data, bytes):
        mentah = data
    else:
        raise TypeError(f"arsip_mentah.simpan: tipe data tak didukung: {type(data)!r}")

    p = jalur(sumber, *bagian)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(mentah)
    except OSError as e:
        print(f"  [arsip gagal: {sumber}/{'/'.join(bagian)}: {e}]")


def baca(sumber: str, *bagian: str) -> bytes | None:
    """Isi arsip, atau None kalau belum pernah disimpan / tak terbaca."""
    p = jalur(sumber, *bagian)
    if not p.exists():
        return None
    try:
        return p.read_bytes()
    except OSError:
        return None


def ambil_atau_unduh(sumber: str, *bagian: str, unduh: Callable[[], bytes]) -> bytes:
    """Baca arsip dulu; kalau kosong, panggil `unduh()` lalu simpan hasilnya.

    Ini yang membuat parse ulang (atau penambahan ruas baru di parser) tak
    berbiaya jaringan sama sekali — jalankan ulang, seluruh berkas dibaca
    dari cakram, `unduh()` tak pernah terpanggil.
    """
    isi = baca(sumber, *bagian)
    if isi is not None:
        return isi
    isi = unduh()
    simpan(sumber, *bagian, data=isi)
    return isi


def demo() -> None:
    """Swauji kecil — tanpa jaringan, tanpa framework."""
    import shutil
    import tempfile

    global AKAR_ARSIP
    asli, tmp = AKAR_ARSIP, Path(tempfile.mkdtemp())
    AKAR_ARSIP = tmp
    try:
        simpan("uji", "a", "b.json", data={"x": 1})
        assert json.loads(baca("uji", "a", "b.json")) == {"x": 1}, "simpan/baca dict tak konsisten"

        simpan("uji", "c.txt", data="halo")
        assert baca("uji", "c.txt") == b"halo", "simpan/baca str tak konsisten"

        assert baca("uji", "tak-ada.json") is None, "arsip yang belum ada harus None"

        panggilan = []

        def unduh() -> bytes:
            panggilan.append(1)
            return b"isi-mentah"

        r1 = ambil_atau_unduh("uji", "d.bin", unduh=unduh)
        r2 = ambil_atau_unduh("uji", "d.bin", unduh=unduh)
        assert r1 == r2 == b"isi-mentah"
        assert len(panggilan) == 1, "ambil_atau_unduh tak boleh memanggil unduh() dua kali"

        print("arsip_mentah: swauji lolos")
    finally:
        AKAR_ARSIP = asli
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    demo()
