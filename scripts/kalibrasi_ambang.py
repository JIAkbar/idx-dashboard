"""Kalibrasi ambang narasi harian dari sejarah IHSG.

MASALAH YANG DIPERBAIKI: ambang di `app/src/lib/dasbor/ringkasHarian.ts`
awalnya ditebak — "menguat kuat" dipatok ≥1,0% karena angka itu terdengar
wajar, bukan karena dihitung. Padahal kita menyimpan penutupan IHSG harian
sejak 1990 (`data-idx/json/ihsg_harian.json`), jadi pertanyaannya bisa
dijawab dengan data sendiri: kenaikan 1,59% itu masuk persentil berapa dari
seluruh hari bursa yang pernah ada?

Keluarannya `app/src/lib/dasbor/ambangPasar.json` — diimpor langsung oleh
mesin narasi (bukan di-fetch), supaya fungsi rangkumHari() tetap MURNI dan
bisa diuji tanpa jaringan.

Dijalankan berkala (bulanan/kuartalan), bukan harian: watak pasar bergeser
pelan, dan ambang yang berubah tiap hari membuat kalimat kemarin tak bisa
dibandingkan dengan kalimat hari ini.

Pakai:
  python scripts/kalibrasi_ambang.py
  python scripts/kalibrasi_ambang.py --tahun 10   # batasi jendela sejarah
"""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
SUMBER = AKAR / "data-idx" / "json" / "ihsg_harian.json"
KELUARAN = AKAR / "app" / "src" / "lib" / "dasbor" / "ambangPasar.json"
WIB = timezone(timedelta(hours=7))


def persentil(urut: list[float], p: float) -> float:
    """Persentil dengan interpolasi linear — cukup untuk ribuan titik, dan
    menghindari menarik numpy hanya untuk satu fungsi."""
    if not urut:
        return 0.0
    k = (len(urut) - 1) * p
    bawah = int(k)
    atas = min(bawah + 1, len(urut) - 1)
    return urut[bawah] + (urut[atas] - urut[bawah]) * (k - bawah)


def main() -> int:
    ap = argparse.ArgumentParser(description="Kalibrasi ambang narasi dari sejarah IHSG")
    ap.add_argument("--tahun", type=int, default=10,
                    help="jendela sejarah dalam tahun (default 10; 0 = seluruh riwayat)")
    args = ap.parse_args()

    if not SUMBER.exists():
        raise SystemExit(f"Tidak ada {SUMBER} — jalankan panen IHSG dulu.")
    tutup: dict[str, float] = json.loads(SUMBER.read_text(encoding="utf-8"))["tutup"]

    tanggal = sorted(tutup)
    if args.tahun:
        batas = (date.today() - timedelta(days=args.tahun * 365)).isoformat()
        tanggal = [t for t in tanggal if t >= batas]
    if len(tanggal) < 200:
        raise SystemExit(f"Cuma {len(tanggal)} hari bursa dalam jendela itu — terlalu sedikit untuk kalibrasi.")

    # Perubahan harian dalam persen, dari penutupan ke penutupan.
    gerak = []
    for kemarin, ini in zip(tanggal, tanggal[1:]):
        a, b = tutup[kemarin], tutup[ini]
        if a:
            gerak.append((b - a) * 100 / a)

    mutlak = sorted(abs(g) for g in gerak)
    naik = [g for g in gerak if g > 0]
    turun = [g for g in gerak if g < 0]

    ambang = {
        "dihitung": datetime.now(WIB).isoformat(timespec="seconds"),
        "sumber": "data-idx/json/ihsg_harian.json",
        "jendela_tahun": args.tahun or None,
        "hari_bursa": len(gerak),
        "mulai": tanggal[0],
        "akhir": tanggal[-1],
        # "menguat kuat" = besaran gerak yang cuma terjadi di 15% hari teratas.
        # Dipilih 0,85 (bukan 0,95) supaya sebutan itu tetap muncul beberapa
        # kali sebulan — kata yang tak pernah dipakai sama tak bergunanya
        # dengan kata yang dipakai tiap hari.
        "gerakBesar": round(persentil(mutlak, 0.85), 2),
        # "nyaris datar" = 30% hari paling adem.
        "gerakTipis": round(persentil(mutlak, 0.30), 2),
        # Konteks yang ikut disimpan supaya angka di atas bisa diperiksa
        # tanpa menjalankan ulang skrip ini.
        "rerata_naik": round(sum(naik) / len(naik), 2) if naik else 0,
        "rerata_turun": round(sum(turun) / len(turun), 2) if turun else 0,
        "hari_naik_persen": round(len(naik) * 100 / len(gerak), 1),
    }

    KELUARAN.write_text(json.dumps(ambang, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK -> {KELUARAN}")
    print(f"  {ambang['hari_bursa']} hari bursa ({ambang['mulai']} … {ambang['akhir']})")
    print(f"  gerakBesar (p85) = {ambang['gerakBesar']}%   gerakTipis (p30) = {ambang['gerakTipis']}%")
    print(f"  hari naik {ambang['hari_naik_persen']}% · rerata naik +{ambang['rerata_naik']}% · "
          f"rerata turun {ambang['rerata_turun']}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
