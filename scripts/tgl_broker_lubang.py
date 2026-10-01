"""Tanggal target panen broker harian (#194 A, keputusan Johan 15 Sep 2026).

Dulu bat dan CI memanen SATU tanggal - hari tuntas terakhir (`tgl_broker_aman.py`).
Jalan yang terlewat, ditolak gerbang jam, atau keluar karena kunci meninggalkan
satu hari broker kosong untuk selamanya: panen berikutnya sudah menarget hari
bursa sesudahnya. Terjadi 14 Sep 2026 (panen sore keluar karena kunci, lalu
ditolak gerbang 22:00).

Keluaran: satu tanggal per baris - hari tuntas terakhir DULU (selalu ada), lalu
hari bursa dalam JENDELA_HARI hari kalender terakhir yang arsipnya belum lengkap
enam varian: lubang termuda dulu, lalu sisanya dari yang paling bolong (#258).
Jatah sumber (#218) sering habis di tengah jalan, jadi urutan menentukan apa yang
kebagian: data hari ini lebih dulu, lalu hari terbaru, lalu lubang terparah.

#240 (27 Sep 2026): jendela 7 -> 30 hari. Dengan 7 hari, lubang yang belum tertutup
dalam seminggu jatuh keluar jendela dan tak pernah dikejar lagi - 18 Sep 2026
(360/963 emiten) terlewat begitu 26 Sep.

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
JENDELA_HARI = 30
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
    if not lubang:
        return [aman]
    # #258 (1 Okt 2026): hari tuntas dulu, lalu lubang TERMUDA, lalu sisanya
    # dari yang PALING BOLONG. Urutan murni "termuda dulu" membuat jatah
    # sumber dan batas 45 menit selalu habis di hari-hari baru: 18, 22, 23
    # Sep 2026 tak bergerak dari 27 Sep sampai 1 Okt (35-45%) sementara
    # 28-30 Sep yang sudah 86-90% terus didahulukan.
    def isi(t: str) -> float:
        n = acuan.get(t) or max((max(v.values(), default=0) for v in hitung.values()), default=0) or 1
        per = hitung.get(t) or {}
        return min(per.get(v, 0) for v in VARIAN) / n
    termuda = lubang[-1]
    sisa = sorted(lubang[:-1], key=lambda t: (isi(t), t))
    return [aman, termuda] + sisa


def uji() -> int:
    kini = datetime.datetime(2026, 9, 15, 18, 5)
    bar = ["2026-08-10", "2026-09-04", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14", "2026-09-15"]
    acuan = {t: 963 for t in bar}
    penuh = {v: 962 for v in VARIAN}

    def h(bolong: dict[str, dict[str, int]] | None = None, tanpa: tuple[str, ...] = ()) -> dict:
        d = {t: dict(penuh) for t in bar if t not in tanpa}
        for t, isi in (bolong or {}).items():
            d.setdefault(t, {}).update(isi)
        return d

    # 14 Sep tak dipanen sama sekali: masuk sebagai lubang.
    assert target(bar, kini, h(tanpa=("2026-09-14",)), acuan) == ["2026-09-15", "2026-09-14"]
    # Satu varian kurang di 10 Sep: ikut masuk.
    assert target(bar, kini, h({"2026-09-10": {"tunai-asing": 500}}), acuan) == ["2026-09-15", "2026-09-10"]
    # KASUS #233: BBCA lengkap tapi hanya 324 dari 963 emiten -> lubang.
    assert target(bar, kini, h({"2026-09-11": {v: 324 for v in VARIAN}}), acuan) == ["2026-09-15", "2026-09-11"]
    # 962/963 (satu emiten tersuspensi) tetap lengkap.
    assert target(bar, kini, h(), acuan) == ["2026-09-15"]
    # #240: 4 Sep (11 hari lalu) kini masih dikejar; 10 Agu (36 hari) tidak.
    assert "2026-09-04" in target(bar, kini, h(tanpa=("2026-09-04",)), acuan)
    assert "2026-08-10" not in target(bar, kini, h(tanpa=("2026-08-10",)), acuan)
    # Beberapa lubang: hari tuntas dulu, lalu lubang termuda dulu.
    assert target(bar, kini, h(tanpa=("2026-09-04", "2026-09-10")), acuan) == ["2026-09-15", "2026-09-10", "2026-09-04"]
    # #258: sesudah lubang termuda, sisanya dari yang PALING BOLONG (9 Sep 40%
    # didahulukan atas 11 Sep 80%), bukan dari tanggal termuda.
    b258 = h({"2026-09-14": {v: 860 for v in VARIAN}, "2026-09-11": {v: 770 for v in VARIAN},
              "2026-09-09": {v: 385 for v in VARIAN}})
    assert target(bar, kini, b258, acuan) == ["2026-09-15", "2026-09-14", "2026-09-09", "2026-09-11"]
    # Tanpa angka bursa: acuan = hitungan terbesar di jendela (962) -> 324 tetap lubang.
    assert "2026-09-11" in target(bar, kini, h({"2026-09-11": {v: 324 for v in VARIAN}}), {})
    # Sebelum 16:30 hari ini tak dianggap tuntas.
    assert target(bar, datetime.datetime(2026, 9, 15, 10, 0), h(), acuan) == ["2026-09-14"]
    assert target([], kini, {}, {}) == []
    print("uji tgl_broker_lubang: LOLOS 11 kasus")
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
