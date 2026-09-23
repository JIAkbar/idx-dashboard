"""Tanggal target panen broker harian (#194 A, keputusan Johan 15 Sep 2026).

Dulu bat dan CI memanen SATU tanggal - hari tuntas terakhir (`tgl_broker_aman.py`).
Jalan yang terlewat, ditolak gerbang jam, atau keluar karena kunci meninggalkan
satu hari broker kosong untuk selamanya: panen berikutnya sudah menarget hari
bursa sesudahnya. Terjadi 14 Sep 2026 (panen sore keluar karena kunci, lalu
ditolak gerbang 22:00).

Keluaran: satu tanggal per baris, urut naik - hari bursa dalam JENDELA_HARI hari
kalender terakhir yang arsipnya belum lengkap enam varian, lalu hari tuntas
terakhir (selalu ada, sama seperti dulu).

Lengkap = untuk TIAP varian, >= AMBANG_LENGKAP emiten punya berkas hari itu,
dibanding jumlah emiten yang dilaporkan bursa hari itu (`aliran_investor.json`,
ruas `emiten`). Dulu yang diperiksa cuma arsip BBCA (#233): sumber memberi jatah
panggilan per periode (#218), jadi panen berhenti di sekitar emiten ke-300 -
BBCA di awal abjad selalu kebagian, hari itu terbaca lengkap, dan 16-22 Sep
2026 bolong +-2/3 emiten tanpa pernah dipanen ulang. Pemanen melewati berkas yang sudah ada,
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
# Hari lengkap terukur 962 dari 963 emiten bursa (10-14 Sep 2026); hari bolong
# 192-379. 95% memberi ruang untuk emiten tersuspensi tanpa bar IDX.
AMBANG_LENGKAP = 0.95


def nama_arsip(tanggal: str, varian: str) -> str:
    # Sama dengan panen_broker_harian.nama_arsip; disalin supaya skrip ini tak
    # mengimpor pemanen berikut seluruh dependensi jaringannya.
    return f"{tanggal}.json" if varian == "reguler" else f"{tanggal}.{varian}.json"


def lengkap(t: str, hitung: dict[str, dict[str, int]], acuan: dict[str, int]) -> bool:
    """Hari `t` lengkap bila tiap varian punya berkas di >= AMBANG_LENGKAP x
    jumlah emiten bursa hari itu. Tanpa angka bursa untuk `t`, acuannya jumlah
    terbesar yang pernah tercatat di jendela (lebih longgar, tapi tak buta)."""
    n_bursa = acuan.get(t) or max((max(v.values(), default=0) for v in hitung.values()), default=0)
    if not n_bursa:
        return False
    per = hitung.get(t) or {}
    return all(per.get(v, 0) >= AMBANG_LENGKAP * n_bursa for v in VARIAN)


def target(bar: list[str], kini: datetime.datetime, hitung: dict[str, dict[str, int]],
           acuan: dict[str, int]) -> list[str]:
    hari_ini = str(kini.date())
    if (kini.hour, kini.minute) < (16, 30):
        bar = [t for t in bar if t < hari_ini]
    if not bar:
        return []
    aman = bar[-1]
    batas = str(kini.date() - datetime.timedelta(days=JENDELA_HARI))
    lubang = [t for t in bar if batas <= t < aman and not lengkap(t, hitung, acuan)]
    return lubang + [aman]


def uji() -> int:
    kini = datetime.datetime(2026, 9, 15, 18, 5)
    bar = ["2026-09-04", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14", "2026-09-15"]
    acuan = {t: 963 for t in bar}
    penuh = {v: 962 for v in VARIAN}

    def h(bolong: dict[str, dict[str, int]] | None = None, tanpa: tuple[str, ...] = ()) -> dict:
        d = {t: dict(penuh) for t in bar if t not in tanpa}
        for t, isi in (bolong or {}).items():
            d.setdefault(t, {}).update(isi)
        return d

    # 14 Sep tak dipanen sama sekali: masuk sebagai lubang.
    assert target(bar, kini, h(tanpa=("2026-09-14",)), acuan) == ["2026-09-14", "2026-09-15"]
    # Satu varian kurang di 10 Sep: ikut masuk.
    assert target(bar, kini, h({"2026-09-10": {"tunai-asing": 500}}), acuan) == ["2026-09-10", "2026-09-15"]
    # KASUS #233: BBCA lengkap tapi hanya 324 dari 963 emiten -> lubang.
    assert target(bar, kini, h({"2026-09-11": {v: 324 for v in VARIAN}}), acuan) == ["2026-09-11", "2026-09-15"]
    # 962/963 (satu emiten tersuspensi) tetap lengkap.
    assert target(bar, kini, h(), acuan) == ["2026-09-15"]
    # Di luar jendela 7 hari (4 Sep) tak dikejar walau bolong.
    assert "2026-09-04" not in target(bar, kini, h(tanpa=("2026-09-04",)), acuan)
    # Tanpa angka bursa: acuan = hitungan terbesar di jendela (962) -> 324 tetap lubang.
    assert "2026-09-11" in target(bar, kini, h({"2026-09-11": {v: 324 for v in VARIAN}}), {})
    # Sebelum 16:30 hari ini tak dianggap tuntas.
    assert target(bar, datetime.datetime(2026, 9, 15, 10, 0), h(), acuan) == ["2026-09-14"]
    assert target([], kini, {}, {}) == []
    print("uji tgl_broker_lubang: LOLOS 8 kasus")
    return 0


def main() -> int:
    if "--uji" in sys.argv:
        return uji()
    import os
    from arsip_mentah import AKAR_ARSIP
    d = json.load(open(AKAR / "data-idx" / "json" / "ohlc" / "BBCA.json", encoding="utf-8"))
    bar = [b[0] for b in d.get("d", []) if b]
    kini = datetime.datetime.now()
    batas = str(kini.date() - datetime.timedelta(days=JENDELA_HARI))
    jendela = [t for t in bar if t >= batas]
    akar = AKAR_ARSIP / "broker-harian"
    kode = [e.name for e in os.scandir(akar) if e.is_dir()] if akar.is_dir() else []
    # Cek keberadaan per berkas (bukan scandir tiap folder: +-25 ribu berkas per
    # emiten). 962 emiten x 7 hari x 6 varian terukur +-5 detik.
    hitung = {t: {v: sum(1 for k in kode if (akar / k / nama_arsip(t, v)).exists()) for v in VARIAN}
              for t in jendela}
    acuan: dict[str, int] = {}
    try:
        al = json.load(open(AKAR / "data-idx" / "json" / "aliran_investor.json", encoding="utf-8"))
        i_tgl, i_em = al["ruas"].index("tanggal"), al["ruas"].index("emiten")
        acuan = {r[i_tgl]: r[i_em] for r in al["d"] if r[i_tgl] >= batas}
    except (OSError, KeyError, ValueError):
        pass  # tanpa acuan bursa: lengkap() memakai hitungan terbesar di jendela
    for t in jendela if "--rinci" in sys.argv else []:
        n = acuan.get(t)
        print(f"  {t}: " + " ".join(f"{v}={hitung[t][v]}" for v in VARIAN) + (f" / bursa {n}" if n else ""),
              file=sys.stderr)
    for t in target(bar, kini, hitung, acuan):
        print(t)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
