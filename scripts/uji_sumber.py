"""Uji jangkauan tiap sumber data, TIGA kali, sebelum panen.

Standar kerja (Johan 1 Okt 2026): *"sebelum di panen ujicoba lagi apakah data
bisa di unduh bukan pakai 2x tapi 3x selalu dicoba seperti itu untuk
memastikan dan jadikan standar pekerjaan"*.

Satu percobaan tak membedakan "sumber mati" dari "gangguan sesaat": IDX
pernah menjawab 403 di satu permintaan lalu 200 di permintaan berikutnya, dan
Stockbit bisa menjawab 200 tanpa isi saat jatahnya habis. Tiga percobaan
berjeda memberi vonis yang bisa dipercaya:

  TERBUKA     3/3 berhasil
  TAK STABIL  1-2 dari 3 berhasil - panen jalan, tapi siapkan susulan
  TERBLOKIR   0/3 berhasil - jangan panen sumber itu sekarang; lapor

"Berhasil" = DATA terbaca, bukan sekadar status 200 (pelajaran #2 Sep 2026:
200 dengan nol broker = token mati diam-diam).

Tidak pernah memutar token Stockbit: hanya MEMBACA access lewat token_segar().
Keluar 0 selalu; vonis dicetak (dan baris ::warning:: untuk CI).

Pakai:  python scripts/uji_sumber.py [--jeda 5]
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

COBA = 3


def _idx(url: str, params: dict | None = None):
    def f():
        import idx_net
        r = idx_net.get(url, params=params)
        teks = r.text if hasattr(r, "text") else str(r)
        return len(teks) > 200, f"{len(teks)} byte"
    return f


def _yahoo():
    import requests
    r = requests.get("https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE",
                     params={"range": "5d", "interval": "1d"},
                     headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    n = len(((r.json().get("chart") or {}).get("result") or [{}])[0].get("timestamp") or []) if r.status_code == 200 else 0
    return n > 0, f"HTTP {r.status_code}, {n} bar"


def _stockbit():
    from stockbit_token import token_segar
    from cek_token import uji_hidup
    kode, pesan = uji_hidup(token_segar())
    return kode == 200, pesan


SUMBER = [
    ("Stockbit broker (token panen)", _stockbit),
    ("Yahoo IHSG harian", _yahoo),
    ("IDX statistik harian (daftar PDF)", _idx("https://www.idx.co.id/primary/Statistic/GetStatistic",
                                              {"Year": "2026", "Month": "10", "Prefix": "ds"})),
    ("IDX ringkasan saham", _idx("https://www.idx.co.id/primary/TradingSummary/GetStockSummary",
                                 {"length": "5", "start": "0"})),
]


def vonis(hasil: list[bool]) -> str:
    n = sum(hasil)
    return "TERBUKA" if n == COBA else ("TERBLOKIR" if n == 0 else "TAK STABIL")


def main(jeda: float) -> int:
    print(f"Uji sumber {COBA}x, jeda {jeda:g} dtk")
    for nama, fn in SUMBER:
        hasil, catatan = [], []
        for i in range(COBA):
            try:
                ok, pesan = fn()
            except Exception as e:  # galat jaringan/penguraian = gagal, bukan berhenti
                ok, pesan = False, f"{type(e).__name__}: {str(e)[:80]}"
            hasil.append(bool(ok))
            catatan.append(pesan)
            if i < COBA - 1:
                time.sleep(jeda)
        v = vonis(hasil)
        print(f"  {v:10} {sum(hasil)}/{COBA}  {nama}  | {catatan[-1]}")
        if v != "TERBUKA":
            print(f"::warning::{nama}: {v} ({sum(hasil)}/{COBA})")
    return 0


def uji() -> int:
    assert vonis([True, True, True]) == "TERBUKA"
    assert vonis([False, False, False]) == "TERBLOKIR"
    assert vonis([True, False, True]) == "TAK STABIL"
    print("uji uji_sumber: LOLOS 3 kasus")
    return 0


if __name__ == "__main__":
    if "--uji" in sys.argv:
        sys.exit(uji())
    j = 5.0
    if "--jeda" in sys.argv:
        j = float(sys.argv[sys.argv.index("--jeda") + 1])
    sys.exit(main(j))
