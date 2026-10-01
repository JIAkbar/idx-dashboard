"""Snapshot harian Pasardana - CADANGAN bila sumber IDX tertutup (#263 B).

Keputusan Johan 1 Okt 2026: *"kerjakan A + B"*. A = data IDX lewat
www.idx.id; B = Pasardana sebagai jaring kalau idx.id ikut ditutup.

`GET https://www.pasardana.id/api/StockSearchResult/GetAll` (publik, tanpa
login) memberi SATU hari - hari bursa terakhir - untuk +-978 emiten: OHLC
tersesuaikan, volume, nilai, frekuensi, sektor IDX-IC (nama Indonesia),
kapitalisasi, free float, PER/PBV/ROE. TIDAK ada net asing dan broker.
Uji silang riset #263 (1 Okt 2026): volume & penutupan cocok persis dengan
`ohlc/` di 828/828 emiten.

Riwayat TIDAK tersedia di endpoint publik, jadi snapshot WAJIB disimpan tiap
hari: mentahnya diarsipkan ke `_arsip-mentah/pasardana/<tanggal>.json`
(aturan "simpan mentah hasil panen"). Belum ada halaman yang membacanya -
ia cadangan; memakainya di halaman = keputusan Johan (aturan 3b).

Pakai:  python scripts/panen_pasardana.py
Uji:    python scripts/panen_pasardana.py --uji
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import arsip_mentah  # noqa: E402

URL = "https://www.pasardana.id/api/StockSearchResult/GetAll"


def tanggal_snapshot(baris: list[dict]) -> str | None:
    """Tanggal terbanyak di LastDate (beberapa emiten tersuspensi membawa tanggal lama)."""
    hit: dict[str, int] = {}
    for b in baris:
        t = (b.get("LastDate") or "")[:10]
        if t:
            hit[t] = hit.get(t, 0) + 1
    return max(hit, key=hit.get) if hit else None


def main() -> int:
    from curl_cffi import requests
    galat = ""
    for coba in range(3):
        try:
            r = requests.get(URL, impersonate="chrome124", timeout=60)
            if r.status_code == 200:
                baris = r.json()
                break
            galat = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            galat = f"{type(e).__name__}: {e}"
    else:
        print(f"Pasardana gagal 3x: {galat}")
        return 1
    tgl = tanggal_snapshot(baris)
    if not tgl or len(baris) < 500:
        print(f"Balasan janggal ({len(baris)} baris, tanggal {tgl}) - tidak disimpan")
        return 1
    arsip_mentah.simpan("pasardana", f"{tgl}.json", data=baris)
    print(f"Pasardana {tgl}: {len(baris)} emiten diarsipkan")
    return 0


def uji() -> int:
    b = [{"LastDate": "2026-10-01T00:00:00"}] * 3 + [{"LastDate": "2026-08-01T00:00:00"}]
    assert tanggal_snapshot(b) == "2026-10-01"
    assert tanggal_snapshot([]) is None
    print("uji panen_pasardana: LOLOS 2 kasus")
    return 0


if __name__ == "__main__":
    sys.exit(uji() if "--uji" in sys.argv else main())
