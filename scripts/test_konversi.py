"""Jalankan: python scripts/test_konversi.py — nol framework, sesuai konvensi repo."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fetch_fundamental import konversi_ke_idr

def main():
    assert konversi_ke_idr(0.446, "USD", 16000) == 7136.0, "USD wajib dikali kurs"
    assert konversi_ke_idr(4460, "IDR", 16000) == 4460, "IDR tidak diubah"
    assert konversi_ke_idr(None, "USD", 16000) is None, "None tetap None"
    assert konversi_ke_idr(0.446, "USD", 0) is None, "kurs nol = tak bisa dihitung, bukan 0"
    print("OK")

if __name__ == "__main__":
    main()
