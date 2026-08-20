# -*- coding: utf-8 -*-
"""Katalog periode yang CACAT DI SUMBER IDX -- ditulis ke `keuangan_idx/*.json`.

KENAPA ADA (20 Agu 2026, tugas D8)
----------------------------------
Sapuan `sapu_regresi_keuangan.py` menemukan 19 lompatan neraca >=50x yang
bukan pergantian mata uang. Diperiksa satu per satu, dan mayoritasnya ternyata
PERISTIWA NYATA -- injeksi aset PANI 2022, aksi korporasi ZBRA 2021, ekuitas
BEEF yang terkikis 2020, ekuitas MPPA/SAFE/CASH/AIMS yang melintas nol.
Menandainya cacat justru akan menyembunyikan kejadian yang sungguhan.

Yang benar-benar cacat tinggal DUA emiten, EMPAT periode, dan ketiganya lolos
setiap gerbang mekanis yang kita punya:

- `perbaiki_skala_keuangan.py` diam karena periodenya tak punya arsip mentah,
  jadi tak ada dasar untuk membandingkan;
- identitas neraca `total_assets == total_liabilities + equity` TETAP LOLOS
  0,0% di keempatnya -- ekuitas memang pos penyeimbang, jadi uji itu tak
  pernah bisa menangkap laporan yang ketiga posnya salah bersamaan;
- penaksir mata uang juga tak terganggu.

Jadi satu-satunya jalan yang jujur adalah MENCATATNYA, bukan berpura-pura
gerbang berikutnya akan menangkapnya. Angkanya sengaja TIDAK diubah: kita tak
punya nilai benarnya (arsip mentahnya tak ada), dan menebak lalu menuliskannya
persis kesalahan yang membuat ZBRA 2019 rusak permanen.

Kalau periode-periode ini nanti dipanen ulang (mentahnya MASIH DISAJIKAN IDX
-- lihat `panen_keuangan_idx.py --periksa-ketersediaan`), tandanya wajib
ditinjau ulang: dua dari empat kemungkinan besar sembuh sendiri.

PAKAI
-----
    python scripts/cacat_sumber.py --uji      # swauji, tak menyentuh data
    python scripts/cacat_sumber.py --tandai   # tulis ruas `cacat` ke JSON

Idempoten: menulis peta yang sama berkali-kali tak mengubah apa pun, dan
menghapus satu baris dari katalog akan MENCABUT tandanya di jalan berikutnya.
Jalankan ulang SESUDAH tiap panen `keuangan_idx` -- panen menulis ulang berkas
dan bisa membuang ruas ini.
"""
from __future__ import annotations

import argparse
import json
import pathlib

AKAR = pathlib.Path(__file__).resolve().parent.parent
KELUARAN_DIR = AKAR / "data-idx" / "json" / "keuangan_idx"

# {kode: {tanggal: alasan}} -- alasan ditulis untuk MANUSIA, tampil apa adanya
# sebagai judul lencana `!` di panel Laporan Keuangan Stock Detail.
KATALOG: dict[str, dict[str, str]] = {
    "LAPD": {
        "2021-12-31":
            "Laporan menyebut liabilitas Rp 248,8 TRILIUN dan ekuitas minus "
            "Rp 248,7 triliun di atas aset Rp 77,9 miliar. Tahun sebelumnya "
            "liabilitasnya Rp 259,2 miliar, tahun sesudahnya Rp 15,5 miliar "
            "— naik ~960x lalu turun lagi. Nilai benarnya tak diketahui: "
            "berkas mentah 2021 tak terarsip.",
        "2022-12-31":
            "Total aset tercatat Rp 64,5 JUTA — perusahaan yang setahun "
            "sebelumnya beraset Rp 77,9 miliar dan setahun sesudahnya "
            "Rp 203,6 miliar. Angkanya terkonfirmasi ada di berkas resmi IDX "
            "(arsip mentah 2022 cocok), jadi cacatnya di laporan itu sendiri, "
            "bukan di pembacaan kita.",
    },
    "ARGO": {
        "2020-12-31":
            "Tersimpan 1.000x terlalu besar: aset USD 80,19 MILIAR untuk Argo "
            "Pantes. Nilai benarnya USD 80,19 juta — disilangkan ke 2019 "
            "(USD 85,03 juta, terkonfirmasi arsip) dan 2022 (Rp 1,13 triliun "
            "= USD ~80 juta). Tak ditambal karena berkas mentah 2020 tak "
            "terarsip; menebak pembaginya lalu menuliskannya membuat "
            "kesalahannya permanen.",
        "2021-12-31":
            "Sama seperti 2020 — tersimpan 1.000x terlalu besar, dan label "
            "mata uangnya sendiri ditaksir (IDR) bukan terbaca. Berkas mentah "
            "2021 tak terarsip.",
    },
}


def tandai(tulis: bool = True) -> int:
    """Tulis/segarkan ruas `cacat` di tiap berkas. Kembalikan jumlah berubah."""
    berubah = 0
    for p in sorted(KELUARAN_DIR.glob("*.json")):
        isi = json.loads(p.read_text(encoding="utf-8"))
        baru = KATALOG.get(p.stem) or {}
        lama = isi.get("cacat") or {}
        if baru == lama:
            continue
        if baru:
            isi["cacat"] = baru
        else:
            isi.pop("cacat", None)
        if tulis:
            p.write_text(json.dumps(isi, ensure_ascii=False, separators=(",", ":")),
                         encoding="utf-8")
        berubah += 1
        print(f"  {p.stem}: {sorted(lama)} -> {sorted(baru)}")
    return berubah


def _uji() -> None:
    """Katalog harus menunjuk periode yang BENAR-BENAR ada. Baris yang salah
    ketik tanggalnya akan diam-diam tak pernah berlaku — dan tanda yang tak
    pernah muncul sama saja dengan tak ditandai sama sekali."""
    for kode, periode in KATALOG.items():
        p = KELUARAN_DIR / f"{kode}.json"
        assert p.exists(), f"{kode}: berkas keuangan_idx tak ada"
        isi = json.loads(p.read_text(encoding="utf-8"))
        punya = set(isi.get("tahunan") or {}) | set(isi.get("kuartal") or {})
        for t, alasan in periode.items():
            assert t in punya, f"{kode} {t}: periode itu tak ada di berkasnya"
            assert len(alasan) > 40, f"{kode} {t}: alasannya terlalu pendek"
    print(f"uji cacat_sumber: LOLOS ({sum(len(v) for v in KATALOG.values())} periode)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tandai", action="store_true", help="tulis ke berkas")
    ap.add_argument("--uji", action="store_true", help="swauji saja")
    a = ap.parse_args()
    _uji()
    if a.tandai:
        n = tandai()
        print(f"{n} berkas berubah")
    elif not a.uji:
        n = tandai(tulis=False)
        print(f"{n} berkas AKAN berubah (jalankan dengan --tandai untuk menulis)")
