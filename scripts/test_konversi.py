"""Jalankan: python scripts/test_konversi.py — nol framework, sesuai konvensi repo."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fetch_fundamental import konversi_ke_idr, konversi_dict_ke_idr

def main():
    assert konversi_ke_idr(0.446, "USD", 16000) == 7136.0, "USD wajib dikali kurs"
    assert konversi_ke_idr(4460, "IDR", 16000) == 4460, "IDR tidak diubah"
    assert konversi_ke_idr(None, "USD", 16000) is None, "None tetap None"
    assert konversi_ke_idr(0.446, "USD", 0) is None, "kurs nol = tak bisa dihitung, bukan 0"

    # hist_fcf/hist_bv (Task 20): dict {year: value} flat, harus dikonversi per nilai
    flat = {"2023": 0.446, "2024": None}
    assert konversi_dict_ke_idr(flat, "USD", 16000) == {"2023": 7136.0, "2024": None}
    assert konversi_dict_ke_idr(flat, "IDR", 16000) == flat, "IDR tidak diubah"
    # q_* pakai nested {year: {quarter: value}}
    nested = {"2024": {"Q1": 1.0, "Q2": None}}
    assert konversi_dict_ke_idr(nested, "USD", 16000) == {"2024": {"Q1": 16000.0, "Q2": None}}
    assert konversi_dict_ke_idr({}, "USD", 16000) == {}, "dict kosong tetap kosong"
    print("OK")

if __name__ == "__main__":
    main()
