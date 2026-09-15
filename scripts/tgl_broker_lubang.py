"""Tanggal target panen broker harian (#194 A, keputusan Johan 15 Sep 2026).

Dulu bat dan CI memanen SATU tanggal - hari tuntas terakhir (`tgl_broker_aman.py`).
Jalan yang terlewat, ditolak gerbang jam, atau keluar karena kunci meninggalkan
satu hari broker kosong untuk selamanya: panen berikutnya sudah menarget hari
bursa sesudahnya. Terjadi 14 Sep 2026 (panen sore keluar karena kunci, lalu
ditolak gerbang 22:00).

Keluaran: satu tanggal per baris, urut naik - hari bursa dalam JENDELA_HARI hari
kalender terakhir yang arsip BBCA-nya belum lengkap enam varian, lalu hari tuntas
terakhir (selalu ada, sama seperti dulu). Pemanen melewati berkas yang sudah ada,
jadi tanggal yang ternyata lengkap untuk emiten lain hanya berbiaya pemeriksaan
arsip, bukan permintaan jaringan.

Aturan hari tuntas sama dengan `tgl_broker_aman.py`: sebelum 16:30 WIB hari ini
dikecualikan supaya broker setengah hari tak diarsip.

Pakai:
    python scripts/tgl_broker_lubang.py
    python scripts/tgl_broker_lubang.py --uji
"""
from __future__ import annotations

import datetime
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

VARIAN = ("reguler", "asing", "nego", "nego-asing", "tunai", "tunai-asing")
JENDELA_HARI = 7


def nama_arsip(tanggal: str, varian: str) -> str:
    # Sama dengan panen_broker_harian.nama_arsip; disalin supaya skrip ini tak
    # mengimpor pemanen berikut seluruh dependensi jaringannya.
    return f"{tanggal}.json" if varian == "reguler" else f"{tanggal}.{varian}.json"


def target(bar: list[str], kini: datetime.datetime, isi_arsip: set[str]) -> list[str]:
    # ponytail: kelengkapan dinilai dari arsip BBCA saja. Emiten lain yang bolong
    # pada hari BBCA lengkap tak terdeteksi; naikkan ke hitungan seluruh folder
    # broker-harian kalau kasus itu muncul.
    hari_ini = str(kini.date())
    if (kini.hour, kini.minute) < (16, 30):
        bar = [t for t in bar if t < hari_ini]
    if not bar:
        return []
    aman = bar[-1]
    batas = str(kini.date() - datetime.timedelta(days=JENDELA_HARI))
    lubang = [t for t in bar if batas <= t < aman
              and any(nama_arsip(t, v) not in isi_arsip for v in VARIAN)]
    return lubang + [aman]


def uji() -> int:
    kini = datetime.datetime(2026, 9, 15, 18, 5)
    bar = ["2026-09-04", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14", "2026-09-15"]
    lengkap = {nama_arsip(t, v) for t in bar[:6] for v in VARIAN}
    # 14 Sep tak dipanen sama sekali: masuk sebagai lubang.
    assert target(bar, kini, lengkap) == ["2026-09-14", "2026-09-15"], target(bar, kini, lengkap)
    # Satu varian hilang di 10 Sep: ikut masuk.
    kurang = lengkap - {nama_arsip("2026-09-10", "tunai-asing")}
    assert target(bar, kini, kurang) == ["2026-09-10", "2026-09-14", "2026-09-15"]
    # Di luar jendela 7 hari (4 Sep) tak dikejar walau bolong.
    assert "2026-09-04" not in target(bar, kini, set())
    # Semua lengkap: sama persis dengan perilaku lama, satu tanggal.
    penuh = lengkap | {nama_arsip("2026-09-14", v) for v in VARIAN}
    assert target(bar, kini, penuh) == ["2026-09-15"]
    # Sebelum 16:30 hari ini tak dianggap tuntas.
    pagi = datetime.datetime(2026, 9, 15, 10, 0)
    assert target(bar, pagi, penuh) == ["2026-09-14"]
    assert target([], kini, set()) == []
    print("uji tgl_broker_lubang: LOLOS 6 kasus")
    return 0


def main() -> int:
    if "--uji" in sys.argv:
        return uji()
    from arsip_mentah import AKAR_ARSIP
    d = json.load(open(AKAR / "data-idx" / "json" / "ohlc" / "BBCA.json", encoding="utf-8"))
    bar = [b[0] for b in d.get("d", []) if b]
    folder = AKAR_ARSIP / "broker-harian" / "BBCA"
    isi = {p.name for p in folder.iterdir()} if folder.is_dir() else set()
    for t in target(bar, datetime.datetime.now(), isi):
        print(t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
