# -*- coding: utf-8 -*-
"""Gerbang: emiten yang TIDAK ikut terpanen hari itu (#102 A).

Lahir dari kegagalan 8 September 2026 yang berlangsung tanpa satu pun jejak:
99 emiten benar-benar diambil dari sumber (arsip mentahnya ada, berisi bar hari
itu), olahnya lolos saat diputar ulang, tapi berkasnya tak pernah tertulis —
commit panen sore menyentuh 848 dari 963 berkas dan ke-99 itu masih berstempel
tanggal dua hari sebelumnya. Panen melaporkan sukses, log tak ada, dan yang
tersisa cuma stempel yang tertinggal.

Yang diperiksa di sini adalah pertanyaan yang seharusnya diajukan panen kepada
dirinya sendiri: emiten mana yang PUNYA bar hari bursa terakhir di arsip
gabungan, tapi berkas sumbernya berhenti sebelum tanggal itu.

Acuan tanggalnya diambil dari arsip gabungan (`ohlc/`), bukan dari jam dinding:
di hari libur, "hari ini" tak punya bar sama sekali dan gerbang yang memakai
tanggal sistem akan menuduh seluruh 963 emiten gagal.

Keluar 1 kalau ada yang tertinggal — dipanggil di ujung blok OHLCV kedua bat
panen, jadi lubang seperti ini terlihat pada menit yang sama, bukan berminggu
kemudian saat ada yang membaca angkanya dekat-dekat.

Cara pakai:
  python scripts/cek_panen_ohlcv.py            # periksa, keluar 1 bila ada
  python scripts/cek_panen_ohlcv.py --swauji   # uji logikanya, tanpa arsip
"""
import argparse
import io
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
JSON = AKAR / "data-idx" / "json"
GABUNG = JSON / "ohlc"
SUMBER = JSON / "ohlcv_stockbit"
ARSIP = AKAR / "_arsip-mentah" / "ohlcv-stockbit"
LAPORAN = AKAR / "logs" / "panen_tertinggal.txt"


def hari_terakhir_gabungan() -> str:
    """Tanggal bar terbaru di arsip gabungan, dibaca dari emiten paling likuid.

    BBCA diperdagangkan tiap hari bursa, jadi bar terakhirnya setara kalender
    bursa — dan membacanya dari satu berkas jauh lebih murah daripada membuka
    963 berkas hanya untuk tahu tanggalnya.
    """
    p = GABUNG / "BBCA.json"
    if not p.exists():
        raise SystemExit(f"acuan tanggal tak ada: {p}")
    d = json.loads(io.open(p, encoding="utf-8").read())
    bar = d.get("d") or []
    if not bar:
        raise SystemExit("acuan tanggal kosong")
    return str(bar[-1][0])[:10]


def tertinggal(acuan: str) -> list[tuple[str, str]]:
    """(kode, tanggal terakhir) untuk emiten yang bar terakhirnya < acuan.

    Emiten yang memang tak diperdagangkan hari itu TIDAK ikut: yang dibandingkan
    berkas sumber dengan arsip GABUNGAN emiten yang sama, jadi emiten yang
    sama-sama berhenti di tanggal lama tak dianggap tertinggal — ia memang sepi.
    """
    out = []
    for p in sorted(SUMBER.glob("*.json")):
        kode = p.stem
        pg = GABUNG / f"{kode}.json"
        if not pg.exists():
            continue
        try:
            g = json.loads(io.open(pg, encoding="utf-8").read()).get("d") or []
            s = json.loads(io.open(p, encoding="utf-8").read()).get("bar") or []
        except Exception:  # noqa: BLE001 - berkas rusak dilaporkan, bukan diam
            out.append((kode, "TAK TERBACA"))
            continue
        if not g or not s:
            continue
        tg = str(g[-1][0])[:10]
        ts = str(s[-1][0])[:10]
        # Hanya yang arsip gabungannya SUDAH sampai acuan: kalau keduanya
        # tertinggal, yang salah bukan panen emiten ini.
        if tg >= acuan and ts < acuan:
            out.append((kode, ts))
    return out


def bar_mentah_terakhir(kode: str, acuan: str) -> str | None:
    """Tanggal bar terakhir di arsip mentah emiten ini pada hari `acuan`.

    None kalau berkas mentahnya tak ada atau tak terbaca — yang berarti emiten
    ini memang tak diunduh hari itu, bukan diunduh lalu hilang.

    Berkas mentah berukuran ±2 MB per emiten, jadi ia TIDAK dibuka untuk semua
    963 emiten: pemanggil menyaring dulu jadi daftar tersangka yang biasanya
    kosong, dan hanya tersangka yang dibuka.
    """
    f = ARSIP / kode / f"{acuan}.json"
    if not f.exists():
        return None
    try:
        mentah = json.loads(io.open(f, encoding="utf-8").read())
    except Exception:  # noqa: BLE001 - mentah rusak = tak bisa jadi saksi
        return None
    bar = (mentah or {}).get("data", {}).get("chartbit") or []
    # Hanya bar BERISI yang dihitung — aturan yang sama dipakai penulisnya
    # (`buang_bar_hari_berjalan`), dan gerbang yang memakai aturan berbeda dari
    # penulis akan menuduh penulis melakukan hal yang benar. Terukur saat
    # gerbang ini pertama dijalankan: 131 emiten dituduh, dan keempat sampel
    # pertama (ABBA, ADHI, BATA, BTEL) ternyata bervolume 0 pada tanggal itu —
    # bar pra-pembukaan yang memang sengaja tak ditulis. Alarm yang mustahil
    # hijau bukan alarm.
    tgl = [str(b.get("date"))[:10] for b in bar
           if b and b.get("date") and (b.get("volume") or b.get("value") or b.get("frequency"))]
    return max(tgl) if tgl else None


def tertinggal_mentah(acuan: str) -> list[tuple[str, str, str]]:
    """(kode, tanggal berkas sumber, tanggal bar mentah) untuk emiten yang
    JELAS terunduh hari itu tapi berkas sumbernya tak ikut maju.

    Gerbang pertama membandingkan berkas sumber dengan arsip GABUNGAN, dan
    karena itu buta pada satu kelas kegagalan: emiten yang gabungannya ikut
    tertinggal (tak ada bar dari sumber kedua hari itu) terbaca "sepi", bukan
    "tertinggal". Persis kegagalan 8 September yang melahirkan berkas ini
    hanya tertangkap kalau gabungannya kebetulan terisi dari sumber lain.

    Saksi yang tak bisa dibantah adalah arsip mentahnya sendiri: kalau balasan
    hari itu tersimpan DAN memuat bar bertanggal `acuan`, maka emiten ini
    memang diperdagangkan dan memang diunduh — berkas sumber yang berhenti
    sebelum itu tidak punya alasan.
    """
    tersangka = []
    for f in sorted(SUMBER.glob("*.json")):
        kode = f.stem
        if not (ARSIP / kode / f"{acuan}.json").exists():
            continue
        try:
            bar = json.loads(io.open(f, encoding="utf-8").read()).get("bar") or []
        except Exception:  # noqa: BLE001
            tersangka.append((kode, "TAK TERBACA"))
            continue
        ts = str(bar[-1][0])[:10] if bar else ""
        if ts < acuan:
            tersangka.append((kode, ts or "KOSONG"))

    out = []
    for kode, ts in tersangka:
        tm = bar_mentah_terakhir(kode, acuan)
        # Mentah tak memuat bar `acuan` = emiten memang tak diperdagangkan
        # (suspensi, papan sepi). Berkas sumber yang berhenti lebih awal justru
        # BENAR di situ, dan menuduhnya membuat gerbang ini berbunyi tiap hari
        # sampai tak ada lagi yang membacanya.
        if tm == acuan:
            out.append((kode, ts, tm))
    return out


def swauji() -> int:
    kal = "2026-09-08"
    assert not tertinggal.__doc__ is None
    # Aturan intinya diuji lewat data kecil, bukan lewat arsip: yang gampang
    # salah adalah SIAPA yang dianggap tertinggal, bukan cara membaca berkas.
    kasus = [
        # (tgl arsip gabungan, tgl berkas sumber, tertinggal?)
        ("2026-09-08", "2026-09-08", False),  # sama-sama mutakhir
        ("2026-09-08", "2026-09-05", True),   # sumber berhenti lebih awal
        ("2026-09-05", "2026-09-05", False),  # emiten sepi - keduanya tertinggal
        ("2026-09-05", "2026-09-08", False),  # sumber justru lebih maju
    ]
    for tg, ts, harap in kasus:
        assert ((tg >= kal) and (ts < kal)) is harap, (tg, ts, harap)

    # Gerbang kedua (#146 A): aturannya "mentah memuat bar acuan TAPI berkas
    # sumber berhenti sebelumnya". Yang gampang salah di sini kasus ketiga —
    # tanpa memeriksa isi mentahnya, emiten tersuspensi dituduh tiap hari.
    # Bar mentah yang kosong (volume/value/frequency nol) TIDAK dihitung:
    # penulisnya membuangnya, jadi berkas sumber yang tak memuatnya benar.
    kosong = {"date": "2026-09-08", "volume": 0, "value": 0, "frequency": 0}
    berisi = {"date": "2026-09-08", "volume": 12300, "value": 4.1e6, "frequency": 7}
    saring = lambda bs: [b["date"] for b in bs if b.get("volume") or b.get("value") or b.get("frequency")]
    assert saring([kosong]) == [], "bar pra-pembukaan tak boleh dihitung sebagai bukti"
    assert saring([berisi]) == ["2026-09-08"]

    kasus2 = [
        # (tgl berkas sumber, tgl bar BERISI terakhir di mentah, tertinggal?)
        ("2026-09-08", "2026-09-08", False),  # sudah mutakhir
        ("2026-09-05", "2026-09-08", True),   # diunduh, tak tertulis - inilah 8 Sep
        ("2026-09-05", "2026-09-05", False),  # tak diperdagangkan hari itu
        ("2026-09-05", None, False),          # mentahnya tak ada/rusak: bukan saksi
    ]
    for ts, tm, harap in kasus2:
        assert ((tm == kal) and (ts < kal)) is harap, (ts, tm, harap)
    print("swauji lolos")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()

    acuan = hari_terakhir_gabungan()
    sisa = tertinggal(acuan)
    mentah = tertinggal_mentah(acuan) if ARSIP.exists() else []
    print(f"hari bursa terakhir (arsip gabungan): {acuan}")
    if not ARSIP.exists():
        print("arsip mentah tak ada di mesin ini - gerbang kedua dilewati")
    # Satu emiten bisa tertangkap dua gerbang; laporannya digabung supaya
    # hitungannya tidak dobel dan daftarnya tidak dibaca dua kali.
    gabung: dict[str, str] = {k: f"berhenti di {t}" for k, t in sisa}
    for k, ts, tm in mentah:
        gabung[k] = f"berhenti di {ts}, padahal arsip mentahnya memuat {tm}"
    if not gabung:
        print("panen OHLCV lengkap - tak ada emiten yang tertinggal")
        return 0
    LAPORAN.parent.mkdir(exist_ok=True)
    io.open(LAPORAN, "w", encoding="utf-8").write(
        f"acuan {acuan}\n" + "\n".join(f"{k}\t{v}" for k, v in sorted(gabung.items())) + "\n")
    print(f"::error::{len(gabung)} emiten TIDAK ikut panen OHLCV hari ini "
          f"(gerbang gabungan {len(sisa)}, gerbang arsip mentah {len(mentah)})")
    for k, v in sorted(gabung.items())[:20]:
        print(f"  {k}\t{v}")
    if len(gabung) > 20:
        print(f"  ... {len(gabung) - 20} lagi")
    print(f"daftar lengkap: {LAPORAN}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
