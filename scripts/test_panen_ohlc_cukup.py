# -*- coding: utf-8 -*-
"""Uji kecil untuk cukup() di panen_ohlc.py — logika --lewati-cukup.

Jalankan langsung: py -3.14 scripts/test_panen_ohlc_cukup.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from panen_ohlc import cukup  # noqa: E402


def demo() -> None:
    # Berkas lama dari sebelum ruas th_full ada — belum tercatat, wajib ditarik.
    assert cukup({}, 10) is False
    # Pernah ditarik 5 tahun, target sekarang 10 tahun — belum cukup.
    assert cukup({"th_full": 5}, 10) is False
    # Pernah ditarik 10 tahun, target 10 tahun — cukup, jangan ditarik ulang.
    assert cukup({"th_full": 10}, 10) is True
    # Pernah ditarik lebih dalam (15) dari target (10) — tetap cukup.
    assert cukup({"th_full": 15}, 10) is True
    # th_full 0 = pernah ditarik SEMAKSIMAL Yahoo — selalu cukup berapa pun targetnya.
    assert cukup({"th_full": 0}, 10) is True
    assert cukup({"th_full": 0}, 999) is True
    print("OK — cukup() lolos semua kasus")


if __name__ == "__main__":
    demo()
