# -*- coding: utf-8 -*-
"""Bangun ihsg_bulanan.json — baris pembanding IHSG di halaman Seasonality.

Sebelum ini berkasnya TIDAK PUNYA PENULIS: ia ada di repo, dibaca halaman,
tapi tak satu pun perintah bisa menyegarkannya. Isinya berhenti di 2026-08 dan
Agustusnya pun separuh bulan (tercatat +2,66% padahal bulan penuhnya +4,64%).

Masukan : data-idx/json/ohlc/IHSG.json
Keluaran: data-idx/json/seasonality/ihsg_bulanan.json

KENAPA ohlc/ DAN BUKAN ohlcv_stockbit/ — diukur 6 Sep 2026, bukan ditebak:

  ohlc/IHSG.json            8.870 bar · 1990-04-06 → 2026-09-04 · 6 ruas
                            (tanggal, buka, tinggi, rendah, tutup, volume)
  ohlcv_stockbit/IHSG.json  7.059 bar · 1997-07-01 → 2026-09-04 · 17 ruas
                            (+ nilai, frekuensi, aliran asing, dividen, dst.)

  Imbal bulanan cuma butuh harga TUTUP, jadi 11 ruas tambahan yang lebih kaya
  itu tak terpakai sama sekali — sementara riwayat yang lebih panjang langsung
  jadi 87 bulan tambahan (1990-05 s.d. 1997-07), tepat periode yang paling
  jarang dimiliki sumber mana pun. Diuji ulang terhadap berkas lama: hitungan
  dari ohlc/ mencocokkan 433 dari 436 bulan, dari ohlcv_stockbit/ hanya 343
  (87 bulan awal memang tak ada di sana). Jadi ohlc/ juga sumber aslinya.

BULAN BELUM TUNTAS DIBUANG. Syaratnya sengaja tidak memakai kalender bursa:
sebuah bulan dianggap tuntas hanya kalau arsipnya sudah memuat bar di bulan
BERIKUTNYA. Deterministik, nol jaringan, dan tak bisa salah menebak hari libur
— ongkosnya cuma satu: bulan penuh terakhir baru muncul di hari bursa pertama
bulan sesudahnya. Karena berkas ini dibangun ulang tiap arsip harian disegarkan,
jeda itu paling lama satu hari.

Jalankan:
  C:/Python314/python.exe scripts/bangun_ihsg_bulanan.py
  C:/Python314/python.exe scripts/bangun_ihsg_bulanan.py --swauji
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
SUMBER = AKAR / "data-idx" / "json" / "ohlc" / "IHSG.json"
KELUAR = AKAR / "data-idx" / "json" / "seasonality" / "ihsg_bulanan.json"


def tutup_bulanan(bar: list) -> dict[str, float]:
    """{'YYYY-MM': harga tutup bar TERAKHIR bulan itu}, bulan berjalan dibuang.

    `bar` = larik `d` apa adanya: [tanggal, buka, tinggi, rendah, tutup, volume].
    """
    tutup: dict[str, float] = {}
    for baris in sorted(bar, key=lambda r: r[0]):
        tutup[baris[0][:7]] = baris[4]
    if tutup:
        del tutup[max(tutup)]  # bulan terakhir belum punya penerus = belum tuntas
    return tutup


def imbal_bulanan(tutup: dict[str, float]) -> dict[str, float]:
    """{'YYYY-MM': persen} terhadap bulan sebelumnya — sama persis dengan
    aturan `siapkan_seasonality.py`, termasuk membiarkan bulan yang bolong
    dihitung apa adanya (itu memang perubahan yang dialami pemegangnya)."""
    bulan = sorted(tutup)
    return {kini: round((tutup[kini] - tutup[lalu]) / tutup[lalu] * 100, 2)
            for lalu, kini in zip(bulan, bulan[1:]) if tutup[lalu] > 0}


def swauji() -> None:
    bar = [["2026-06-30", 0, 0, 0, 100.0, 0],
           ["2026-07-15", 0, 0, 0, 999.0, 0],
           ["2026-07-31", 0, 0, 0, 110.0, 0],
           ["2026-08-03", 0, 0, 0, 555.0, 0]]  # Agustus baru sehari = belum tuntas
    t = tutup_bulanan(bar)
    assert t == {"2026-06": 100.0, "2026-07": 110.0}, t
    assert imbal_bulanan(t) == {"2026-07": 10.0}
    assert tutup_bulanan(list(reversed(bar))) == t          # urutan masukan tak berpengaruh
    satu = json.dumps({"mulai": min(t), "akhir": max(imbal_bulanan(t)), "imbal": imbal_bulanan(t)})
    dua = json.dumps({"mulai": min(t), "akhir": max(imbal_bulanan(t)), "imbal": imbal_bulanan(t)})
    assert satu == dua, "keluaran tidak idempoten"
    assert imbal_bulanan({"2026-06": 0.0, "2026-07": 5.0}) == {}        # pembagi nol dilewati
    assert tutup_bulanan([]) == {} and imbal_bulanan({}) == {}
    print("swauji lolos")


def main() -> None:
    if "--swauji" in sys.argv:
        return swauji()
    sumber = json.loads(SUMBER.read_text(encoding="utf-8"))
    tutup = tutup_bulanan(sumber["d"])
    imbal = imbal_bulanan(tutup)
    if not imbal:
        raise SystemExit("Arsip IHSG tak menghasilkan satu pun imbal bulanan — berhenti.")

    lama = json.loads(KELUAR.read_text(encoding="utf-8")) if KELUAR.exists() else {}
    isi = {"mulai": min(tutup), "akhir": max(imbal), "imbal": imbal}
    KELUAR.parent.mkdir(parents=True, exist_ok=True)
    KELUAR.write_text(json.dumps(isi, ensure_ascii=False, separators=(",", ":")),
                      encoding="utf-8")
    print(f"akhir: {lama.get('akhir', '(belum ada)')} -> {isi['akhir']}"
          f"  ({len(lama.get('imbal', {}))} -> {len(imbal)} bulan)")
    print(f"mulai: {isi['mulai']} · bar terakhir arsip {sumber['akhir']}"
          f" · bulan berjalan {max(r[0][:7] for r in sumber['d'])} dibuang")


if __name__ == "__main__":
    main()
