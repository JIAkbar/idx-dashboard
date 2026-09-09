# -*- coding: utf-8 -*-
"""Dedup kabar per tautan, dengan pengumuman resmi dikecualikan (#142 B).

Gerbang lama cuma menimbang JUDUL (70 karakter pertama, dinormalkan). Terukur
9 Sep 2026 pada berkas nyata: 1.409 item, 68 di antaranya menunjuk artikel
yang sama tetapi lolos karena agregator menulis ulang kepala beritanya. Yang
tampak di layar: satu berita dua kali, dan satu dari delapan slot panel emiten
terbuang untuk salinan.

Tautan pun tak bisa dipakai rata. Pengumuman resmi bursa TANPA LAMPIRAN jatuh
ke satu URL generik (halaman keterbukaan informasi), jadi dedup per tautan akan
meringkas belasan pengumuman berbeda jadi satu baris — tanpa galat, cuma daftar
yang menyusut diam-diam.

Pada berkas hari ini jalur cadangan itu KOSONG: seluruh pengumuman sudah
membawa tautan lampirannya sendiri, jadi pengecualian ini tak mengubah satu
angka pun di sana. Ia menjaga jalur yang jarang dilewati, dan justru karena
jarang, kerusakannya baru ketahuan lama sesudah terjadi — jadi ia diuji dengan
data buatan, bukan dengan berkas hari ini.
"""
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

import panen_kabar as pk  # noqa: E402

GENERIK = "https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi"


def uji_berita_kembar_tautan_dibuang():
    a = {"jenis": "berita", "tautan": "https://x.id/a", "judul": "Satu", "waktu": "2026-09-09T10:00:00+07:00"}
    b = {"jenis": "berita", "tautan": "https://x.id/a", "judul": "Dua", "waktu": "2026-09-09T10:00:00+07:00"}
    assert pk.kunci_tautan(a) == pk.kunci_tautan(b), "dua judul, satu artikel: kuncinya harus sama"


def uji_pengumuman_bertautan_generik_tidak_saling_membunuh():
    # Tiga pengumuman berbeda, satu URL — inilah yang dedup rata akan hancurkan.
    p = [
        {"jenis": "pengumuman", "tautan": GENERIK, "judul": f"Pengumuman {i}", "waktu": f"2026-09-09T0{i}:00:00+07:00"}
        for i in (1, 2, 3)
    ]
    kunci = {pk.kunci_tautan(x) for x in p}
    assert len(kunci) == 3, f"pengumuman berbeda menyusut jadi {len(kunci)} baris"


def uji_pengumuman_yang_benar_benar_kembar_tetap_dibuang():
    a = {"jenis": "pengumuman", "tautan": GENERIK, "judul": "Sama", "waktu": "2026-09-09T01:00:00+07:00"}
    b = dict(a)
    assert pk.kunci_tautan(a) == pk.kunci_tautan(b), "kembar sejati harus tetap satu"


def uji_berkas_nyata_tidak_kehilangan_pengumuman():
    """Berkas hari ini: dedup boleh membuang salinan, tak boleh memangkas
    pengumuman. Dilewati kalau berkasnya belum ada (mesin bersih)."""
    berkas = AKAR / "data-idx" / "json" / "kabar.json"
    if not berkas.exists():
        return
    item = json.loads(berkas.read_text(encoding="utf-8"))["item"]
    sebelum = sum(1 for i in item if i.get("jenis") == "pengumuman")
    terlihat, sesudah = set(), 0
    for i in item:
        k = pk.kunci_tautan(i)
        if k in terlihat:
            continue
        terlihat.add(k)
        if i.get("jenis") == "pengumuman":
            sesudah += 1
    assert sesudah == sebelum, f"pengumuman menyusut {sebelum} -> {sesudah}"


if __name__ == "__main__":
    uji_berita_kembar_tautan_dibuang()
    uji_pengumuman_bertautan_generik_tidak_saling_membunuh()
    uji_pengumuman_yang_benar_benar_kembar_tetap_dibuang()
    uji_berkas_nyata_tidak_kehilangan_pengumuman()
    print("4/4 lulus")
