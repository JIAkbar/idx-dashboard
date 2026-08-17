"""Jalankan: python scripts/test_arsip_yf.py — nol framework, sesuai konvensi repo.

Membuktikan `_arsip_yf()` (fetch_fundamental.py, dipakai ulang fetch_keuangan.py)
menulis arsip yang benar UNTUK KEDUA TIPE objek yfinance (dict `info` dan
DataFrame laporan keuangan) — TANPA memanggil yfinance/jaringan sama sekali.

Kenapa lewat unit test, bukan panen sungguhan: fetch_fundamental.py dan
fetch_keuangan.py punya efek samping menghitung ulang median sektor untuk
SELURUH ~960 emiten begitu main() jalan (lihat "Sector fields diperbarui ke
semua saham JSON") — menjalankan salah satunya walau cuma 1 tiker menulis
ribuan berkas data-idx/json/ yang bukan bagian tugas arsip ini.
"""
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah
import pandas as pd

import fetch_fundamental as ff


def test_arsip_dict():
    ff._arsip_yf("ZTEST", "info", {"longName": "PT Uji Tbk", "sector": "Uji"})
    mentah = arsip_mentah.baca("fundamental", "ZTEST", "info.json")
    assert mentah is not None, "arsip dict tak tertulis"
    import json
    assert json.loads(mentah) == {"longName": "PT Uji Tbk", "sector": "Uji"}


def test_arsip_dataframe():
    df = pd.DataFrame({pd.Timestamp("2026-06-30"): [100.0]}, index=["Total Revenue"])
    ff._arsip_yf("ZTEST", "financials", df)
    mentah = arsip_mentah.baca("fundamental", "ZTEST", "financials.json")
    assert mentah is not None, "arsip DataFrame tak tertulis"
    assert b"Total Revenue" in mentah


def test_arsip_none_dan_kosong_dilewati():
    # None (fetch gagal) dan DataFrame kosong tidak boleh menulis apa pun —
    # bukan galat, cuma tak ada yang diarsipkan.
    ff._arsip_yf("ZTEST", "tak-ada", None)
    assert arsip_mentah.baca("fundamental", "ZTEST", "tak-ada.json") is None

    ff._arsip_yf("ZTEST", "kosong", pd.DataFrame())
    assert arsip_mentah.baca("fundamental", "ZTEST", "kosong.json") is None


def test_arsip_gagal_serialisasi_tak_menggagalkan_panen():
    # Objek yang tak bisa di-JSON-kan (mis. dict berisi objek custom tanpa
    # __str__ jelas) tidak boleh melempar — dicatat, panen lanjut.
    class TakBisaDiserialisasi:
        def __repr__(self):
            raise RuntimeError("sengaja rusak")

    ff._arsip_yf("ZTEST", "rusak", {"x": TakBisaDiserialisasi()})
    # Tak boleh crash sampai baris ini — itu buktinya.


def main():
    global arsip_mentah
    asli = arsip_mentah.AKAR_ARSIP
    tmp = Path(tempfile.mkdtemp())
    arsip_mentah.AKAR_ARSIP = tmp
    try:
        test_arsip_dict()
        test_arsip_dataframe()
        test_arsip_none_dan_kosong_dilewati()
        test_arsip_gagal_serialisasi_tak_menggagalkan_panen()
        print("OK — _arsip_yf lolos tanpa satu pun panggilan jaringan/yfinance")
    finally:
        arsip_mentah.AKAR_ARSIP = asli
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
