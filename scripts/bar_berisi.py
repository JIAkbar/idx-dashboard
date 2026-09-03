# -*- coding: utf-8 -*-
"""Bar OHLC terakhir yang BENAR-BENAR berisi — satu tempat, dipakai bersama.

Masalahnya berulang dan selalu gagal senyap: berkas `ohlc/<KODE>.json`
memuat bar untuk hari BERJALAN sejak pagi, dan bar itu masih kosong —
buka = tinggi = rendah = tutup, volume 0. Siapa pun yang mengambil `d[-1]`
apa adanya mendapat harga kemarin dengan stempel tanggal hari ini, dan
perubahan harian 0,00%.

Terukur 3 Sep 2026 pukul 12:00: **963 dari 963 emiten** punya bar stub untuk
hari itu, dan seluruh 82 anggota grup konglomerat tampil 0,00% di layar.

`kartu_analisa.py` sudah memasang penjaga ini sejak lama (dengan komentar
yang menjelaskan kegagalannya persis), tapi penjaganya tak pernah disapu ke
konsumen lain — jadi tiga skrip lain tetap membaca bar stub. Modul ini
menutup celah itu: satu fungsi, dipanggil semua.

Aturan proyek yang sama sudah berlaku untuk arsip mentah (§WF-207): "arsip
0-baris bertanggal muda = belum terbit, dan KONSUMEN wajib memilih berkas
termuda YANG BERISI". Ini penerapannya untuk bar harian.
"""
from __future__ import annotations

# Indeks baku baris OHLC: [tanggal, buka, tinggi, rendah, tutup, volume]
I_TANGGAL, I_TUTUP, I_VOLUME = 0, 4, 5


def indeks_bar_berisi(bar: list, i_volume: int = I_VOLUME) -> int | None:
    """Indeks bar terakhir yang volumenya bukan nol, atau None kalau tak ada.

    Mundur dari ujung, bukan menyaring seluruh deret: yang kosong hampir
    selalu satu-dua bar terakhir, dan menyaring semuanya akan membuang bar
    lama yang memang bervolume nol karena disuspensi — padahal bar itu sah
    sebagai riwayat.
    """
    j = len(bar) - 1
    while j >= 0:
        b = bar[j]
        if b and len(b) > i_volume and b[i_volume]:
            return j
        j -= 1
    return None


def potong_ke_berisi(bar: list, i_volume: int = I_VOLUME) -> list:
    """Deret yang ujungnya dijamin bervolume. Deret asli dikembalikan apa
    adanya kalau tak satu pun bar berisi — pemanggil yang memutuskan artinya."""
    j = indeks_bar_berisi(bar, i_volume)
    return bar[: j + 1] if j is not None else bar


def bar_terakhir(bar: list, i_volume: int = I_VOLUME) -> list | None:
    """Bar terakhir yang berisi, atau None."""
    j = indeks_bar_berisi(bar, i_volume)
    return bar[j] if j is not None else None


def tanggal_terakhir(bar: list, i_volume: int = I_VOLUME) -> str | None:
    """Tanggal bar berisi terakhir — hari bursa terakhir yang datanya ADA."""
    b = bar_terakhir(bar, i_volume)
    return b[I_TANGGAL] if b else None


def tutup_dan_ubah(bar: list, i_volume: int = I_VOLUME) -> tuple[float | None, float | None, str | None]:
    """(tutup, %1D, tanggal) dari dua bar berisi TERAKHIR.

    Pembandingnya juga harus berisi: kalau hari kemarin libur dan barnya
    stub, membandingkan ke situ memberi 0,00% dengan cara yang sama.
    """
    j = indeks_bar_berisi(bar, i_volume)
    if j is None:
        return None, None, None
    kini = bar[j]
    k = indeks_bar_berisi(bar[:j], i_volume)
    if k is None:
        return kini[I_TUTUP], None, kini[I_TANGGAL]
    lalu = bar[k][I_TUTUP]
    ubah = round((kini[I_TUTUP] - lalu) * 100 / lalu, 2) if lalu else None
    return kini[I_TUTUP], ubah, kini[I_TANGGAL]


def swauji() -> int:
    lulus = gagal = 0

    def cek(nama, syarat):
        nonlocal lulus, gagal
        if syarat:
            lulus += 1
        else:
            gagal += 1
            print(f"  GAGAL: {nama}")

    penuh = [["2026-09-01", 10, 11, 9, 10, 100],
             ["2026-09-02", 10, 12, 10, 12, 200]]
    stub = penuh + [["2026-09-03", 12, 12, 12, 12, 0]]

    cek("tanpa stub: ujungnya sendiri", indeks_bar_berisi(penuh) == 1)
    cek("dengan stub: mundur satu", indeks_bar_berisi(stub) == 1)
    cek("dua stub beruntun", indeks_bar_berisi(stub + [["2026-09-04", 12, 12, 12, 12, 0]]) == 1)
    cek("semua stub → None", indeks_bar_berisi([["2026-09-03", 1, 1, 1, 1, 0]]) is None)
    cek("deret kosong → None", indeks_bar_berisi([]) is None)
    cek("tanggal melewati stub", tanggal_terakhir(stub) == "2026-09-02")
    cek("potong membuang stub", len(potong_ke_berisi(stub)) == 2)
    cek("potong tanpa stub tak mengubah", len(potong_ke_berisi(penuh)) == 2)
    cek("potong semua-stub kembalikan asli", len(potong_ke_berisi([["x", 1, 1, 1, 1, 0]])) == 1)

    tutup, ubah, tgl = tutup_dan_ubah(stub)
    cek("tutup dari bar berisi", tutup == 12)
    cek("ubah dihitung dari dua bar berisi", ubah == 20.0)
    cek("tanggal ikut bar berisi", tgl == "2026-09-02")
    # pembanding yang juga stub harus dilewati
    aneh = [["2026-08-28", 10, 10, 10, 10, 50],
            ["2026-08-31", 10, 10, 10, 10, 0],
            ["2026-09-01", 20, 20, 20, 20, 70]]
    t2, u2, _ = tutup_dan_ubah(aneh)
    cek("pembanding stub dilewati", t2 == 20 and u2 == 100.0)
    cek("satu bar saja: ubah None", tutup_dan_ubah([["x", 1, 1, 1, 5, 9]]) == (5, None, "x"))
    cek("nol bar: semua None", tutup_dan_ubah([]) == (None, None, None))
    cek("bar pendek tak meledak", indeks_bar_berisi([["x", 1]]) is None)

    print(f"{lulus}/{lulus + gagal} lulus")
    return 0 if not gagal else 1


if __name__ == "__main__":
    import sys
    sys.exit(swauji())
