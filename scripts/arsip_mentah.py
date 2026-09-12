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
import os
from pathlib import Path
from typing import Callable

# Bawaannya `<akar repo>/_arsip-mentah` dan itu TIDAK berubah: belasan skrip
# memakai modul ini, dan di laptop Johan arsipnya sudah lama di sana.
# Penimpa lingkungan hanya untuk pemakai yang ruang kerjanya BUKAN rumah
# permanen — pola yang sama dengan `PAPAN_ENV_LOCAL` dan
# `PAPAN_STOCKBIT_TOKEN_FILE`.
#
# Kenapa perlu (#165, terukur 10 Sep 2026): TIGA alur kerja self-hosted
# berbagi SATU ruang kerja runner, dan tiap `actions/checkout@v4` menjalankan
# `git clean -ffdx` yang ikut menghapus berkas ter-gitignore. Log jalan
# 34368692222 baris 56 menuliskannya harfiah:
#
#     Run actions/checkout@v4 ... Removing _arsip-mentah/
#
# Jadi arsip yang ditulis langkah 3 pukul 22:38 disapu alur berikutnya pukul
# 23:48 — dan yang mahal justru MENGAMBILNYA, bukan menyimpannya. Arsip
# mentah memang bukan keadaan ruang kerja; ia singgahan cakram.
AKAR_ARSIP = Path(os.environ.get("PAPAN_ARSIP_AKAR")
                  or (Path(__file__).resolve().parent.parent / "_arsip-mentah"))


def jalur(sumber: str, *bagian: str) -> Path:
    """mis. jalur('ohlc', '2026-08-17', 'BBCA.json')."""
    return AKAR_ARSIP.joinpath(sumber, *bagian)


def simpan(sumber: str, *bagian: str, data: bytes | str | dict | list,
           timpa_lebih_kecil: bool = False) -> None:
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

    # ── D2: potret KOSONG tak boleh menimpa arsip yang sudah berisi ────────
    # D1 di bawah menyelesaikan berkas ROBEK. Ia tidak menyelesaikan berkas
    # UTUH yang isinya mundur, dan itu kelas kerusakan tersendiri:
    #
    #   1. panen malam menulis `asing/2026/20260910.json.gz` penuh (107 KB)
    #   2. panen pagi berikutnya menarik tanggal yang sama SEBELUM IDX
    #      menerbitkan, mendapat potret "belum terbit", lalu menimpanya
    #
    # Bukan hipotesis: berkas 64 byte untuk 20260910 memang ada di akar arsip
    # laptop pada 12 Sep 2026, sementara akar satunya memegang 107.580 byte
    # untuk tanggal yang sama. Selama dua akar terpisah kerusakan itu terkurung
    # di satu sisi; begitu akarnya disatukan (#172 D) ia bisa menimpa hasil
    # yang benar.
    #
    # Ambangnya SETENGAH, bukan "lebih kecil sedikit pun": ukuran gz bergerak
    # beberapa persen tiap hari secara wajar, dan gerbang yang menolak variasi
    # normal akan berbunyi tiap hari lalu berhenti dibaca orang. Yang dicegat
    # penyusutan drastis - potret kosong 64 byte lawan 107 KB itu 0,06%.
    #
    # Arah sebaliknya SENGAJA dibiarkan: arsip mungil (<1 KB) boleh ditimpa apa
    # pun, supaya potret kosong yang telanjur tersimpan bisa diganti data
    # sungguhan. Itu justru perbaikan yang kita mau.
    #
    # Jalan sadar untuk menimpa tetap ada lewat `timpa_lebih_kecil=True` -
    # dipakai kalau sumbernya memang mengoreksi data jadi lebih pendek.
    if not timpa_lebih_kecil and p.exists():
        try:
            lama = p.stat().st_size
        except OSError:
            lama = 0
        if lama >= 1024 and len(mentah) < lama * 0.5:
            print(f"::warning::arsip TIDAK ditimpa: {sumber}/{'/'.join(bagian)} "
                  f"- yang ada {lama} byte, yang baru cuma {len(mentah)} byte "
                  f"(<50%). Potret kosong tak boleh menghapus data. Pakai "
                  f"timpa_lebih_kecil=True kalau penyusutan ini memang benar.")
            return

    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        # ── D1: tulis ATOMIK ──────────────────────────────────────────────
        # `write_bytes` langsung membuka berkas tujuan lalu mengisinya, jadi
        # pembaca yang datang di tengah melihat berkas SEPARUH. Itu jadi nyata
        # begitu satu akar arsip dipakai bersama (#172 D): bat sore mulai 18:00
        # dan berjalan berjam-jam sementara tiga alur CI mulai 18:15, 18:30,
        # dan 19:30 - tumpang tindihnya by design, bukan kebetulan, dan
        # `.panen.lock` tak menolong karena ia milik bat saja.
        #
        # Tulis ke berkas sementara di direktori yang SAMA lalu `os.replace`:
        # atomik di satu volume NTFS, jadi pembaca selalu melihat berkas utuh -
        # yang lama atau yang baru, tak pernah campuran. Dua penulis yang
        # menulis isi yang sama jadi sekadar penulis-terakhir-menang.
        semen = p.with_name(p.name + f".tmp{os.getpid()}")
        try:
            semen.write_bytes(mentah)
            os.replace(semen, p)
        finally:
            if semen.exists():
                try:
                    semen.unlink()
                except OSError:
                    pass
    except OSError as e:
        # BERBUNYI, bukan cuma tercatat. Versi lama mencetak satu baris biasa
        # yang tenggelam di antara ribuan baris log panen — dan karena itu
        # arsip yang tak pernah tertulis butuh forensik untuk ketahuan (#165).
        # `::warning::` membuatnya muncul di ringkasan jalan GitHub Actions,
        # tanpa menggagalkan panen: panen yang batal karena arsipnya gagal
        # ditulis itu rugi dua kali (jaringan sudah dibayar, hasilnya hilang).
        # ASCII saja di baris ini, dan itu bukan selera: dua alur kerja
        # self-hosted (panen-kabar-rumah, update-rumah) TIDAK menyetel
        # PYTHONIOENCODING, dan di konsol Windows ber-encoding lama satu tanda
        # pisah Unicode MEMBUNUH skripnya - persis yang terjadi pada
        # panen_asing.py 5 Sep 2026. Jalur kegagalan tak boleh ikut gagal.
        print(f"::warning::arsip gagal ditulis: {sumber}/{'/'.join(bagian)} "
              f"di bawah {AKAR_ARSIP} -- {e}")


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
