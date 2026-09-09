# -*- coding: utf-8 -*-
"""Penanda sumber per bar — satu rumah untuk kedua pemanen harga.

`sumber_bar` di berkas harga berisi rentang beruntun `[dari, sampai, kode]`
(`sb` = sumber utama, `yh` = cadangan). Dua pemanen membacanya untuk menjawab
satu pertanyaan yang sama: **tanggal ini sudah milik siapa?**

Kenapa satu berkas, bukan salinan di masing-masing (#161 A): sampai 9 Sep 2026
`panen_ihsg.py` punya penjaga ini dan `panen_ohlc.py` tidak, jadi deret IHSG
aman sementara 963 emiten lain ditimpa cadangan tiap malam. Satu aturan yang
hidup di dua tempat akan menyimpang; satu aturan yang hidup di SATU tempat dan
dipakai dua tempat tidak bisa.

Yang TIDAK ikut pindah: `tanggal_sumber_utama()` di `panen_ihsg.py` — ia
mengembalikan string `"dari|sampai"` yang tak pernah dibaca siapa pun. Fungsi
mati yang ikut dipindah akan terbaca seperti bagian rancangan.
"""
from __future__ import annotations

#: Kode penanda untuk bar yang berasal dari sumber CADANGAN.
CADANGAN = "yh"


def kode_lama(tgl: str, rentang: list[list] | None) -> str | None:
    """Kode sumber sebuah tanggal menurut penanda LAMA, atau None.

    None berarti tanggal itu di luar seluruh rentang yang tercatat — bukan
    "cadangan". Pemanggil yang menyamakan keduanya akan menganggap hari baru
    sebagai milik sumber utama dan berhenti menulisnya sama sekali.
    """
    for dari, sampai, kode in (rentang or []):
        if dari <= tgl <= sampai:
            return kode
    return None


def milik_sumber_utama(tgl: str, sumber_lama: list[list] | None) -> bool:
    """Benar kalau tanggal ini sudah dipegang sumber utama.

    Inilah gerbang yang membuat berkas harga punya SATU penulis efektif.
    Terukur 9 Sep 2026 pada `ohlc/BBCA.json`, ditelusuri per commit: 7 Sep
    21:48 pemanen lokal menulis seluruhnya `sb`; 8 Sep 00:27 CI mengubah 1-7
    Sep jadi `yh`; diperbaiki tangan 15:17; 8 Sep 19:52 lokal menulis `sb`
    lagi; 8 Sep 23:09 CI mengubah 2-8 Sep jadi `yh` lagi. Pemanen cadangan
    menarik jendela lima hari tiap malam dan menandai apa pun yang ditulisnya
    sebagai miliknya.

    Kerusakan angkanya kecil dan itu perlu disebut jujur: harga tutup 2-8 Sep
    beda 0,00% di seluruh 15 baris sampel (BBCA/BBRI/BUMI), volume sama persis
    di 12 dari 15 — hanya hari TERTUA di jendela yang meleset (Yahoo 4-7% lebih
    rendah). Yang rusak terutama PELABELANNYA: arsip mengaku cadangan pada
    tanggal yang sumber utamanya ada, dan penanda yang berbohong persis yang
    diperingatkan aturan dua-konvensi di CLAUDE.md.

    Tanggal DI LUAR seluruh rentang penanda dianggap belum dimiliki siapa pun
    — hari bursa baru harus tetap bisa diisi cadangan sebelum sumber utama
    tiba, jika tidak berkasnya berhenti tumbuh.
    """
    return (kode_lama(tgl, sumber_lama) or CADANGAN) != CADANGAN


def swauji() -> None:
    """Aturan intinya diuji lewat data kecil, bukan lewat arsip."""
    penanda = [["1990-04-06", "1997-06-30", "yh"], ["1997-07-01", "2026-09-08", "sb"]]
    assert milik_sumber_utama("2026-09-08", penanda) is True
    assert milik_sumber_utama("1995-01-03", penanda) is False
    assert milik_sumber_utama("2026-09-09", penanda) is False, "hari di luar rentang = boleh diisi"
    assert milik_sumber_utama("2026-09-09", None) is False, "berkas tanpa penanda = perilaku lama"
    assert kode_lama("1999-01-01", penanda) == "sb"
    assert kode_lama("1980-01-01", penanda) is None, "di luar rentang harus None, bukan menebak"

    # Bentuk yang benar-benar dipakai pemanggil: menyaring tarikan cadangan.
    baru = ["1995-01-03", "2026-09-08", "2026-09-09"]
    sisa = [t for t in baru if not milik_sumber_utama(t, penanda)]
    assert sisa == ["1995-01-03", "2026-09-09"], sisa
    print("swauji penanda_sumber lolos")


if __name__ == "__main__":
    swauji()
