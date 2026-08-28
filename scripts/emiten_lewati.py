"""Kode bursa yang SENGAJA tidak diperlakukan sebagai emiten biasa.

Satu rumah untuk seluruh pemanen dan pembangun. Sebelum berkas ini ada,
pengecualian ditulis per-skrip: keputusan Johan 28 Agu 2026 ("untuk GOTOM itu
di hapus saja") hanya mendarat di `fetch_fundamental.py`, dan GOTOM tetap
muncul di daftar emiten, Harian Papan, Jago Papan, serta arsip harga — satu
baris kosong yang lolos ke layar karena tambalannya per-instance, bukan di
hulu. Ini pola yang sama dengan pelajaran "fix instance bukan sistemik" yang
sudah tercatat di memori proyek.

Kenapa dilewati, bukan disembunyikan di tampilan: kode-kode ini memang
tercatat di bursa (jadi ikut terbawa `GetStockSummary`), tapi bukan saham
biasa yang bisa dianalisis dengan alat yang sama — tak punya harga wajar,
tak diperdagangkan seperti saham lain, dan setiap statistik tentangnya
menghasilkan baris kosong yang terlihat seperti bug.
"""
from __future__ import annotations

# GOTOM — saham multi-voting (MVS) GoTo Gojek Tokopedia. Hak suaranya berbeda,
# bukan kelas saham yang diperdagangkan publik seperti GOTO.
LEWATI: frozenset[str] = frozenset({"GOTOM"})


def dilewati(kode: str) -> bool:
    return kode.upper() in LEWATI


def saring(kode_kode):
    """Buang kode yang dilewati dari iterable apa pun (str atau dict ber-'kode')."""
    for k in kode_kode:
        kode = k.get("kode") if isinstance(k, dict) else k
        if kode and str(kode).upper() in LEWATI:
            continue
        yield k
