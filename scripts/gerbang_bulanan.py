"""Gerbang bulanan untuk panen snapshot Stockbit (#170, 13 Sep 2026).

Menjawab satu pertanyaan: sudahkah panen sebuah gudang lewat N hari?
Keluar 0 = jatuh tempo (panen), 1 = belum (lewati), 2 = galat (lewati).

Umurnya dibaca dari ISI berkas keluaran - ruas `dipanen_pada` yang ditulis
pemanennya sendiri - bukan dari berkas penanda. Penanda lama adalah berkas
tak-terlacak di akar repo; ruang kerja CI menyapunya tiap checkout, jadi di
sana gerbangnya selalu terbuka. Berkas keluaran dilacak git, jadi umurnya
ikut ke mana pun repo di-checkout.

Tanggal yang dipakai adalah tanggal TERBANYAK di seluruh berkas - pembaca
yang sama dengan gerbang kesegaran (`cek_kesegaran.dari_ruas_direktori`) -
bukan yang terbaru dan bukan yang tertua:
  * terbaru: panen yang mati sesudah 100 dari 963 emiten akan menutup
    gerbang 28 hari sementara 863 berkas tetap basi;
  * tertua: satu emiten yang selalu gagal membuka gerbang tiap hari
    (terukur 13 Sep 2026: satu berkas keystats bertanggal 23 Agu di tengah
    962 berkas bertanggal 12 Sep).
Seluruh berkas dibaca, bukan sampel 60 berkas pertama menurut abjad: sampel
itu tak bisa melihat panen yang berhenti di tengah daftar.

Galat dilewati, bukan dipanen: gerbang yang rusak tak boleh memicu panen
963 emiten.

    python scripts/gerbang_bulanan.py profil_stockbit 28
    python scripts/gerbang_bulanan.py --uji
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cek_kesegaran import JSON, dari_ruas_direktori  # noqa: E402

WIB = timezone(timedelta(hours=7))
SELURUH_BERKAS = 10 ** 6


def periksa(folder: Path, hari: int, hari_ini: date) -> tuple[bool, str | None, int | None]:
    """(jatuh_tempo, tanggal_terbanyak, umur_hari). Folder hilang = galat."""
    if not folder.is_dir():
        raise FileNotFoundError(folder)
    tgl = dari_ruas_direktori("dipanen_pada", n_sampel=SELURUH_BERKAS)(folder)
    if tgl is None:
        return True, None, None
    umur = (hari_ini - date.fromisoformat(tgl)).days
    return umur > hari, tgl, umur


def putuskan(folder: Path, hari: int, hari_ini: date) -> tuple[int, str]:
    """Kode keluar yang dibaca bat (`if errorlevel 1` = lewati) beserta pesannya."""
    nama = folder.name
    try:
        jatuh, tgl, umur = periksa(folder, hari, hari_ini)
    except FileNotFoundError:
        return 2, "gerbang bulanan %s: GALAT folder tak ada - dilewati" % nama
    except ValueError as e:
        return 2, "gerbang bulanan %s: GALAT tanggal tak terbaca (%s) - dilewati" % (nama, e)
    if tgl is None:
        return 0, "gerbang bulanan %s: tak ada berkas bertanggal - jatuh tempo, panen" % nama
    if jatuh:
        return 0, "gerbang bulanan %s: dipanen %s (%d hari) - lewat %d hari, jatuh tempo" % (nama, tgl, umur, hari)
    return 1, "gerbang bulanan %s: dipanen %s (%d hari) - belum %d hari, dilewati" % (nama, tgl, umur, hari)


def uji_bawaan() -> None:
    kini = date(2026, 9, 13)
    lalu = lambda n: (kini - timedelta(days=n)).isoformat()  # noqa: E731

    def buat(d: Path, tanggal: list[str | None], ekstra: dict[str, str] | None = None) -> Path:
        d.mkdir()
        for i, t in enumerate(tanggal):
            isi = {"kode": "K%03d" % i}
            if t is not None:
                isi["dipanen_pada"] = t
            (d / ("K%03d.json" % i)).write_text(json.dumps(isi), encoding="utf-8")
        for nama, teks in (ekstra or {}).items():
            (d / nama).write_text(teks, encoding="utf-8")
        return d

    with tempfile.TemporaryDirectory() as sementara:
        t = Path(sementara)
        # tepat di ambang = belum; gerbang terbuka hanya kalau LEWAT ambang
        assert periksa(buat(t / "a", [lalu(28)] * 5), 28, kini) == (False, lalu(28), 28)
        assert periksa(buat(t / "b", [lalu(29)] * 5), 28, kini) == (True, lalu(29), 29)
        # tak ada berkas bertanggal = jatuh tempo
        assert periksa(buat(t / "c", [None, None]), 28, kini) == (True, None, None)
        assert periksa(buat(t / "d", []), 28, kini) == (True, None, None)
        # satu berkas macet yang tua tidak membuka gerbang
        assert periksa(buat(t / "e", [lalu(1)] * 9 + [lalu(60)]), 28, kini)[0] is False
        # panen setengah jalan (minoritas berkas baru) tidak menutup gerbang
        assert periksa(buat(t / "f", [lalu(40)] * 9 + [lalu(0)]), 28, kini)[0] is True
        # berkas rusak diabaikan, bukan menjatuhkan gerbang
        assert periksa(buat(t / "g", [lalu(2)] * 3, {"rusak.json": "{bukan json"}), 28, kini)[0] is False
        # SELURUH berkas, bukan 60 pertama: 70 lama berabjad awal + 80 baru
        assert periksa(buat(t / "h", [lalu(40)] * 70 + [lalu(1)] * 80), 28, kini)[0] is False
        # folder hilang = galat, bukan jatuh tempo (salah ketik tak boleh memicu panen)
        try:
            periksa(t / "tak-ada", 28, kini)
        except FileNotFoundError:
            pass
        else:
            raise AssertionError("folder hilang harus galat")
        # kode keluar yang dibaca bat: 0 panen, 1 lewati, 2 galat (juga dilewati bat)
        assert putuskan(t / "a", 28, kini)[0] == 1
        assert putuskan(t / "b", 28, kini)[0] == 0
        assert putuskan(t / "c", 28, kini)[0] == 0
        assert putuskan(t / "tak-ada", 28, kini)[0] == 2
        kode, pesan = putuskan(buat(t / "i", ["2026-99-99"] * 3), 28, kini)
        assert kode == 2 and "tak terbaca" in pesan, (kode, pesan)


def main() -> int:
    ap = argparse.ArgumentParser(description="Gerbang bulanan panen snapshot Stockbit (#170)")
    ap.add_argument("gudang", nargs="?", help="folder di bawah data-idx/json, mis. profil_stockbit")
    ap.add_argument("hari", nargs="?", type=int, help="ambang umur dalam hari, mis. 28")
    ap.add_argument("--uji", action="store_true", help="jalankan uji bawaan lalu keluar")
    a = ap.parse_args()
    if a.uji:
        uji_bawaan()
        print("uji bawaan gerbang_bulanan: LOLOS")
        return 0
    if not a.gudang or a.hari is None:
        ap.print_usage()
        return 2
    kode, pesan = putuskan(JSON / a.gudang, a.hari, datetime.now(WIB).date())
    print(pesan)
    return kode


if __name__ == "__main__":
    sys.exit(main())
