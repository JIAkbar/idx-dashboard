# -*- coding: utf-8 -*-
"""Perbaiki nilai keuangan XBRL yang berskala salah kelipatan 1000.

KENAPA ADA (19 Agu 2026)
-----------------------
`data-idx/json/keuangan_idx/*.json` memuat angka yang meleset SEJUTA sampai
SEMILIAR kali pada 35 emiten, seluruhnya di tahun buku 2023. Contoh terukur:

    BBCA tahunan.net_income
        2022  4,07e13   (40,7 T   -- benar)
        2023  4,86e19   (48,6 kuintiliun -- seharusnya 48,6 T)
        2024  5,48e13   (54,8 T   -- benar)

AKARNYA BUKAN PEMERAS KITA. `panen_keuangan_idx.py` sudah MEMBACA skala dari
sheet `1000000` ruas "Level of rounding" -- rancangan yang benar. Masalahnya
keterangan itu BERBOHONG di sebagian berkas: BBCA 2022 dan BBCA 2023 sama-sama
menyatakan "Jutaan / In Million", padahal nilai di dalam berkas 2023 sudah
rupiah penuh. Sebagian penerbit -- kebanyakan emiten besar: AALI, ASII, BBCA,
BBNI, BBRI, BMRI -- menulis satuan penuh tanpa memperbarui labelnya.

APA YANG BERUBAH 19 AGU 2026 -- DARI PENEBAK JADI PEMERIKSA
-----------------------------------------------------------
Versi sebelumnya menebak pembagi dari periode tetangga lalu MENIMPA berkas di
tempat. Ia membetulkan 35 emiten yang memang salah, tapi juga MERUSAK yang
sudah benar. Kasus yang membayarnya, ZBRA tahun buku 2019:

    arsip mentah  _arsip-mentah/keuangan_idx/2019/audit/ZBRA.xlsx
        "Level of rounding" = Satuan penuh  (skala 1, bukan jutaan)
        total_assets  5.577.552.029        equity  -9.086.335.053

    tetangga terdekat (semuanya SESUDAH restrukturisasi 2021):
        2020  6,686e9   2021  3,174e12   2022  3,156e12   2023  3,283e12
        median = 3,165e12

        jangkar total_assets : 5,578e9 / 3,165e12 = 0,001762
                               -> di bawah 1/AMBANG, dan 0,001762/0,001 =
                                  1,762 masih lolos TOLERANSI 2,0
                               -> MENUDUH "1000x terlalu kecil"
        jangkar equity       : 9,086e9 / 1,187e12 = 0,007654
                               -> di atas 1/AMBANG -> "wajar", TAK MENUDUH

    `suara = [-1000]`; `len(set(suara)) == 1` dibaca sebagai SEPAKAT, padahal
    yang terjadi cuma SATU jangkar bicara dan satunya diam. ZBRA 2019 ditulis
    1000x nilai sumbernya sendiri. Dugaan awal "median seluruh riwayat" TIDAK
    terbukti -- jangkarnya memang sudah dari tetangga terdekat; yang salah
    adalah menerima satu suara tanpa penyanggah, diperparah karena 2019 ada di
    ujung deret (tetangganya sesisi, semuanya sesudah restrukturisasi 2021).

Tiga cacat, dan ketiganya ditutup di sini:

1. **Jangkar punya PERAN, bukan suara sama rata.** `total_assets` yang
   memutuskan; `equity` cuma boleh MEMBATALKAN, tak pernah memutuskan sendiri.
   Diukur atas 6.574 periode berarsip: di tiga koreksi yang benar (LPPF 2023,
   PKPK 2023, PURE 2019) `total_assets` menuduh bersih sementara `equity` diam
   -- ekuitas memang berayun jauh lebih liar daripada aset (LPPF 2023 turun
   ~15x karena pembagian dividen), jadi mewajibkan ekuitas ikut bersuara
   MEMBUANG koreksi yang benar. Sebaliknya di tiga korban (ZBRA 2019, ARGO
   2019, SGER 2023) justru `total_assets` yang tak menuduh. Aset yang
   memutuskan, ekuitas yang menyanggah.
2. **Arah NAIK butuh bukti lebih kuat daripada arah TURUN.** Bukan karena
   arah naik mustahil -- versi pertama tambalan ini SEMPAT melarangnya, dan
   sapuan atas 6.574 periode berarsip langsung menjatuhkannya: IMJS 2024 dan
   TINS 2025-TW1 dua-duanya menyatakan "Satuan penuh" padahal isinya JUTAAN
   (IMJS `total_assets` tercatat 29.410.622 untuk perusahaan beraset Rp 29,4
   T). Larangan arah naik akan mengembalikan keduanya ke angka yang mustahil.

   Yang benar: arah naik lebih JARANG, jadi ambang buktinya lebih tinggi. Di
   dua kasus naik yang sah, KEDUA jangkar menuduh 1e6 dengan sisa rasio rapat
   (IMJS 1,18 & 1,23; TINS 0,91 & 1,00). Di tiga kasus naik yang PALSU,
   jangkarnya selalu sendirian: ZBRA cuma aset (dan itu pun sisa 1,76), ARGO
   cuma ekuitas, SGER tak satu pun. Jadi turun boleh diputuskan aset sendiri,
   naik wajib disepakati keduanya.
3. **Ditimpa di tempat = kesalahan jadi permanen.** Sesudah ZBRA 2019 ditulis
   1000x, jalan berikutnya berjangkar pada angka yang sudah rusak, jadi
   membetulkannya tangan pun percuma. Sekarang nilai acuannya SELALU dihitung
   ulang dari XLSX di `_arsip-mentah/` (`dasar_arsip.py`, nol jaringan), bukan
   dari isi berkas JSON yang mungkin sudah ditimpa jalan sebelumnya. Skrip ini
   jadi idempoten: berapa pun kali dijalankan hasilnya sama, dan jalan yang
   salah bisa dibatalkan jalan berikutnya.

Perbedaan pemeriksa vs penebak, ringkasnya: untuk periode yang mentahnya
terarsip, nilai benarnya WAJIB `dasar x pangkat 1000` -- dan `dasar` itu bukan
taksiran, itu isi berkas sumbernya sendiri. Yang ditebak tinggal pangkatnya,
dan pangkat 1 (tak dikoreksi) adalah bawaannya.

CADANGAN UNTUK PERIODE YANG MENTAHNYA TAK TERARSIP
--------------------------------------------------
~2.300 catatan tak punya XLSX di cakram (2020/2021 cuma 2 berkas, 2025/audit
belum terbit, interim 2024 diperah dari kolom C berkas 2025). Di situ heuristik
tetangga tetap dipakai, tapi ambangnya LEBIH KETAT daripada jalur berarsip:
butuh 4 pembanding (bukan 3) dan toleransi 1,35 (bukan 1,5). Alasannya lurus:
tak ada dasar untuk membatalkan kalau tebakannya salah.

ponytail: kolom C (pembanding) berkas tahun berikutnya sebetulnya bisa jadi
dasar untuk sebagian periode tak terarsip itu -- lihat `panen_pembanding.py`.
Belum dipasang karena satuannya ikut deklarasi berkas induknya, jadi ia
menambah satu jalur yang bisa berbohong dengan cara yang sama. Pasang kalau
jumlah periode tanpa dasar jadi masalah nyata.

PENGAMAN YANG SUDAH ADA SEBELUMNYA DAN TETAP BERLAKU
----------------------------------------------------
- Jangkarnya ruas NERACA saja (`total_assets`, `equity`). Ruas ARUS tak pernah
  jadi jangkar justru karena ia BOLEH nyaris nol: `financing_cf` AALI 2026-Q1
  -4,02e8 vs kuartal lain -4,02e11 itu wajar, dan versi pertama skrip ini
  "membetulkannya" jadi seribu kali lebih besar.
- Skala salah itu sifat BERKAS, bukan sifat satu ruas. Pembaginya ditentukan
  SEKALI per periode lalu diterapkan ke seluruh ruas moneter periode itu.
- Hanya pangkat 1000 yang diterima. Emiten yang benar-benar tumbuh 40x tak
  tersentuh karena 40 bukan pangkat 1000.
- Jangkar dari periode TERDEKAT, bukan seluruh riwayat (kasus PANI: aset 2019
  120 miliar, 2025 50 triliun).
- Tetangga yang MATA UANGnya berbeda dilewati. Rupiah<->dolar itu lompatan
  ~1,6e4; ia lolos AMBANG dan cuma tak jadi pangkat 1000 karena beruntung.
- Ruas non-moneter (lembar saham, EPS, rasio) tak pernah disentuh: ABAIKAN.

Pakai:
    python scripts/perbaiki_skala_keuangan.py --uji      # swauji, tak menulis
    python scripts/perbaiki_skala_keuangan.py --pindai   # laporkan saja
    python scripts/perbaiki_skala_keuangan.py --tulis    # perbaiki berkas
"""
from __future__ import annotations

import argparse
import glob
import json
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import dasar_arsip

AKAR = pathlib.Path(__file__).resolve().parent.parent
SUMBER = AKAR / "data-idx" / "json" / "keuangan_idx"

# Ruas yang BUKAN nilai moneter -- skalanya tak mengikuti satuan berkas, jadi
# perbandingan antar-tahun di sini tak berarti apa-apa.
ABAIKAN = {"shares", "eps", "eps_dasar", "eps_dilusian", "der", "roe", "npm"}

PANGKAT = (1_000, 1_000_000, 1_000_000_000)

# Rasio serendah ini terhadap median periode lain sudah mustahil sebagai
# pertumbuhan. Diukur: p99 rasio antar-tahun yang sehat masih di bawah 10x.
AMBANG = 500

# Rasio hasil bagi harus jatuh dekat 1. Turun dari 2,0 ke 1,5: ZBRA 2019 jatuh
# di 1,762 dan itu lolos di 2,0 -- padahal 1,762 bukan kesalahan satuan, itu
# perubahan ukuran perusahaan yang nyata. Kesalahan satuan yang benar-benar
# ada jatuh jauh lebih dekat ke 1 (BBCA 2023: 1,02).
TOLERANSI = 1.5
TOLERANSI_CADANGAN = 1.35

MIN_PEMBANDING = 3
MIN_PEMBANDING_CADANGAN = 4

# Ruas jangkar penentu skala: NERACA saja. Posisi pada satu tanggal, bergerak
# lambat, tak pernah mendekati nol pada emiten yang masih tercatat.
#
# PERANNYA BEDA, dan itu disengaja. `total_assets` yang MEMUTUSKAN: ia paling
# stabil antar-periode. `equity` cuma MENYANGGAH -- ia bergerak jauh lebih
# liar (dividen, restatement, ekuitas melintasi nol), jadi menunggu ia ikut
# menuduh membuang koreksi yang benar, sementara membiarkannya menuduh sendiri
# adalah persis cara ARGO 2019 nyaris ikut dinaikkan 1000x.
JANGKAR_UTAMA = "total_assets"
JANGKAR_SANGGAH = "equity"
JANGKAR = (JANGKAR_UTAMA, JANGKAR_SANGGAH)

# Beda sekecil ini dianggap pembulatan, bukan kesalahan skala.
EPS_SAMA = 0.01


def _angka(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def cari_pangkat(nilai: float, jangkar: float, toleransi: float = TOLERANSI) -> float | None:
    """Pengali pangkat 1000 yang membuat `nilai` masuk akal terhadap `jangkar`.

    Mengembalikan None kalau nilainya memang wajar, atau kalau selisihnya
    bukan kelipatan seribu (berarti bukan kesalahan satuan -- jangan disentuh).
    """
    if not jangkar or not nilai:
        return None
    rasio = abs(nilai) / abs(jangkar)
    if 1 / AMBANG < rasio < AMBANG:
        return None
    for p in PANGKAT:
        for kandidat in (float(p), 1.0 / p):
            if 1 / toleransi <= rasio / kandidat <= toleransi:
                return 1.0 / kandidat
    return None


def _pangkat_1000(rasio: float) -> float | None:
    """Kalau `rasio` itu pangkat 1000 (selain 1), kembalikan pangkatnya."""
    for p in PANGKAT:
        for kandidat in (float(p), 1.0 / p):
            if abs(rasio / kandidat - 1) < EPS_SAMA:
                return kandidat
    return None


def putuskan(
    kerja: dict[str, dict],
    periode: str,
    mata_uang: dict[str, str] | None = None,
    berdasar: bool = True,
) -> float:
    """Pengali yang harus dikenakan pada nilai `periode`; 1.0 = tak dikoreksi.

    `total_assets` memutuskan, `equity` menyanggah, dan koreksi cuma boleh
    MENGECILKAN. Ketiganya lahir dari enam periode yang terukur -- lihat
    docstring modul.
    """
    urut = sorted(kerja)
    toleransi = TOLERANSI if berdasar else TOLERANSI_CADANGAN
    minimal = MIN_PEMBANDING if berdasar else MIN_PEMBANDING_CADANGAN
    mata_uang = mata_uang or {}
    cur = mata_uang.get(periode)

    try:
        i = urut.index(periode)
    except ValueError:
        return 1.0

    def median_lain(ruas: str) -> float | None:
        """Jangkar dari periode TERDEKAT, bukan dari seluruh riwayat.

        Median seluruh riwayat gagal pada emiten yang berubah ukuran drastis
        (PANI: aset 2019 120 miliar, 2025 50 triliun).
        """
        dekat: list[float] = []
        for jarak in range(1, len(urut)):
            for j in (i - jarak, i + jarak):
                if not 0 <= j < len(urut):
                    continue
                lain = urut[j]
                # Mata uang berbeda tak bisa dibandingkan besarnya.
                if cur and mata_uang.get(lain) and mata_uang[lain] != cur:
                    continue
                v = kerja[lain].get(ruas)
                if _angka(v) and v:
                    dekat.append(abs(v))
            if len(dekat) >= minimal + 1:
                break
        return statistics.median(dekat) if len(dekat) >= minimal else None

    isi = kerja[periode]

    def suara(ruas: str) -> tuple[bool, float | None]:
        """(jangkarnya bisa dinilai, tuduhannya)."""
        v = isi.get(ruas)
        if not _angka(v) or not v:
            return False, None
        med = median_lain(ruas)
        if med is None:
            return False, None
        return True, cari_pangkat(v, med, toleransi)

    bisa_utama, tuduhan = suara(JANGKAR_UTAMA)
    if not bisa_utama or tuduhan is None:
        return 1.0

    # Penyanggah wajib BISA dinilai -- kalau ia bahkan tak punya pembanding,
    # tak ada yang mengawasi keputusan `total_assets` dan itu terlalu sepi.
    bisa_sanggah, sanggahan = suara(JANGKAR_SANGGAH)
    if not bisa_sanggah:
        return 1.0
    if sanggahan is not None and sanggahan != tuduhan:
        return 1.0  # dua jangkar menuduh besaran berbeda -> diam lebih aman

    # Arah NAIK lebih jarang, jadi buktinya wajib lebih kuat: ekuitas harus
    # ikut menuduh, bukan sekadar tidak menyanggah. ZBRA/ARGO/SGER tiga-tiganya
    # naik atas satu jangkar sendirian dan tiga-tiganya salah; IMJS 2024 dan
    # TINS 2025-TW1 naik dengan kedua jangkar sepakat dan dua-duanya benar.
    if tuduhan > 1 and sanggahan != tuduhan:
        return 1.0
    return tuduhan


def periksa_bucket(
    stored: dict,
    dasar: dict | None = None,
    mata_uang: dict[str, str] | None = None,
) -> list[tuple[str, str, float, float, str]]:
    """Daftar (periode, ruas, lama, baru, sebab) yang perlu dibetulkan.

    `dasar` = {tanggal: {"nilai": {...}}} hasil peras ulang arsip mentah.
    Periode yang ada di `dasar` diperiksa (nilai benarnya `dasar x pangkat`);
    yang tidak ada hanya bisa ditebak dari tetangga (jalur cadangan).
    """
    if not isinstance(stored, dict):
        return []
    dasar = dasar or {}

    # Meja kerja: nilai APA ADANYA dari arsip kalau ada, kalau tidak yang
    # tersimpan. Ini yang membuat skrip idempoten -- jangkarnya tak ikut
    # tergeser oleh tulisan jalan sebelumnya.
    kerja: dict[str, dict] = {}
    for periode, isi in stored.items():
        if not isinstance(isi, dict):
            continue
        d = dasar.get(periode)
        kerja[periode] = dict(d["nilai"]) if d else dict(isi)

    perbaikan = []
    for periode, isi in stored.items():
        if not isinstance(isi, dict):
            continue
        d = dasar.get(periode)
        faktor = putuskan(kerja, periode, mata_uang, berdasar=bool(d))

        for ruas, lama in isi.items():
            if ruas in ABAIKAN or not _angka(lama) or not lama:
                continue
            if d:
                acuan = d["nilai"].get(ruas)
                if not _angka(acuan) or not acuan:
                    continue
                baru = acuan * faktor
                if abs(lama / baru - 1) < EPS_SAMA:
                    continue
                # Cuma beda berskala pangkat 1000 yang dibetulkan. Beda lain
                # (ruas ditambal sumber lain, restatement) bukan urusan skrip
                # ini -- menimpanya berarti membuang pekerjaan orang lain.
                if _pangkat_1000(lama / baru) is None:
                    continue
                sebab = "arsip" if faktor == 1.0 else f"arsip x{faktor:g}"
                perbaikan.append((periode, ruas, lama, baru, sebab))
            else:
                if faktor == 1.0:
                    continue
                perbaikan.append((periode, ruas, lama, lama * faktor, f"tetangga x{faktor:g}"))
    return perbaikan


def jalankan(tulis: bool, dasar_peta: dict | None = None) -> int:
    peta = dasar_arsip.muat() if dasar_peta is None else dasar_peta
    total_berkas = total_nilai = 0
    per_sebab: dict[str, int] = {}
    per_tahun: dict[str, int] = {}
    contoh: list[str] = []

    for f in sorted(glob.glob(str(SUMBER / "*.json"))):
        p = pathlib.Path(f)
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        kode = p.stem
        mu = j.get("mata_uang") or {}
        berubah = False
        for nama_bucket in ("tahunan", "kuartal"):
            bucket = j.get(nama_bucket)
            if not bucket:
                continue
            dasar_b = (peta.get(kode) or {}).get(nama_bucket) or {}
            for periode, ruas, lama, baru, sebab in periksa_bucket(bucket, dasar_b, mu):
                bucket[periode][ruas] = baru
                berubah = True
                total_nilai += 1
                per_sebab[sebab] = per_sebab.get(sebab, 0) + 1
                th = periode[:4]
                per_tahun[th] = per_tahun.get(th, 0) + 1
                if len(contoh) < 15:
                    contoh.append(
                        f"  {kode:6} {nama_bucket:8} {periode} {ruas:16} "
                        f"{lama:.3e} -> {baru:.3e}  [{sebab}]"
                    )
        if berubah:
            total_berkas += 1
            if tulis:
                p.write_text(
                    json.dumps(j, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8",
                )

    print(f"berkas tersentuh : {total_berkas}")
    print(f"nilai dibetulkan : {total_nilai}")
    print("per sebab        :", dict(sorted(per_sebab.items())))
    print("per tahun        :", dict(sorted(per_tahun.items())))
    if contoh:
        print("contoh:")
        print("\n".join(contoh))
    if not tulis:
        print("\n(mode pindai -- tak ada berkas ditulis; pakai --tulis untuk menerapkan)")
    return total_nilai


def uji() -> None:
    """Swauji: kasus yang HARUS dibetulkan dan yang HARUS dibiarkan."""

    def dasar_dari(bucket: dict) -> dict:
        return {k: {"nilai": v} for k, v in bucket.items()}

    def sehat(n, e):
        return {"total_assets": n, "equity": e}

    kasus = [
        (
            "LPPF 2023: aset menuduh 1e6, ekuitas DIAM (ayunan nyata) -> dibetulkan",
            {
                "2019-12-31": sehat(4.8329e12, 1.7466e12),
                "2020-12-31": sehat(6.3191e12, 5.8112e11),
                "2021-12-31": sehat(5.8512e12, 1.0060e12),
                "2022-12-31": sehat(5.7502e12, 5.8016e11),
                "2023-12-31": sehat(5.8804e18, 3.0738e16),
                "2024-12-31": sehat(5.1408e12, 3.2579e11),
                "2025-12-31": sehat(5.1386e12, 2.7291e11),
            },
            None,
            [("2023-12-31", "total_assets", 5.8804e12),
             ("2023-12-31", "equity", 3.0738e10)],
        ),
        (
            "ARGO 2019: ekuitas menuduh SENDIRIAN, aset diam -> DIBIARKAN",
            {
                "2019-12-31": sehat(8.5033e7, -8.6633e7),
                "2020-12-31": sehat(8.0185e10, -9.1996e10),
                "2021-12-31": sehat(7.8705e10, -9.3128e10),
                "2022-12-31": sehat(1.1295e12, -1.3824e12),
                "2023-12-31": sehat(1.0915e12, 1.3056e11),
                "2024-12-31": sehat(1.1203e12, 1.2188e11),
            },
            None,
            [],
        ),
        (
            "IMJS 2024: arah NAIK dengan KEDUA jangkar sepakat -> dibetulkan",
            {
                "2019-12-31": sehat(2.4296e13, 3.2819e12),
                "2020-12-31": sehat(2.3640e13, 3.6044e12),
                "2021-12-31": sehat(2.4715e13, 3.8101e12),
                "2022-12-31": sehat(2.6929e13, 4.4230e12),
                "2023-12-31": sehat(2.8712e13, 4.7378e12),
                "2024-12-31": sehat(2.9411e7, 4.6969e6),
                "2025-12-31": sehat(3.2902e13, 5.0934e12),
            },
            None,
            [("2024-12-31", "total_assets", 2.9411e13),
             ("2024-12-31", "equity", 4.6969e12)],
        ),
        (
            "arah NAIK atas SATU jangkar saja -> DIBIARKAN (pola ZBRA/ARGO)",
            {
                "2020": sehat(1.0e15, 4.0e8), "2021": sehat(1.1e15, 4.1e8),
                "2022": sehat(1.2e15, 4.2e8), "2023": sehat(1.2e9, 4.2e8),
                "2024": sehat(1.3e15, 4.3e8),
            },
            None,
            [],
        ),
        (
            "1e6 terlalu besar, KEDUA jangkar sepakat -> dibetulkan",
            {
                "2020": sehat(1.0e12, 4.0e11), "2021": sehat(1.1e12, 4.1e11),
                "2022": sehat(1.2e12, 4.2e11), "2023": sehat(1.3e18, 4.3e17),
                "2024": sehat(1.4e12, 4.4e11),
            },
            None,
            [("2023", "total_assets", 1.3e12), ("2023", "equity", 4.3e11)],
        ),
        (
            "1e9 terlalu besar, kedua jangkar sepakat -> dibetulkan",
            {
                "2020": sehat(4.0e14, 1.0e14), "2021": sehat(4.1e14, 1.1e14),
                "2022": sehat(4.2e14, 1.2e14), "2023": sehat(4.4e23, 1.3e23),
                "2024": sehat(4.5e14, 1.4e14),
            },
            None,
            [("2023", "total_assets", 4.4e14), ("2023", "equity", 1.3e14)],
        ),
        (
            "REGRESI ZBRA 2019: sisa rasio 1,76 lewat TOLERANSI dan arahnya naik -> DIBIARKAN",
            {
                "2019-12-31": sehat(5.5776e9, -9.0863e9),
                "2020-12-31": sehat(6.686e9, -1.062e10),
                "2021-12-31": sehat(3.174e12, 1.369e12),
                "2022-12-31": sehat(3.156e12, 1.260e12),
                "2023-12-31": sehat(3.283e12, 1.114e12),
            },
            None,
            [],
        ),
        (
            "ZBRA sudah TERLANJUR 1000x tapi arsip punya dasarnya -> DIKEMBALIKAN",
            {
                "2019-12-31": sehat(5.5776e12, -9.0863e12),
                "2020-12-31": sehat(6.686e9, -1.062e10),
                "2021-12-31": sehat(3.174e12, 1.369e12),
                "2022-12-31": sehat(3.156e12, 1.260e12),
                "2023-12-31": sehat(3.283e12, 1.114e12),
            },
            dasar_dari({"2019-12-31": sehat(5.5776e9, -9.0863e9)}),
            [("2019-12-31", "total_assets", 5.5776e9),
             ("2019-12-31", "equity", -9.0863e9)],
        ),
        (
            "pertumbuhan wajar 5x -> DIBIARKAN",
            {
                "2020": sehat(1.0e12, 4e11), "2021": sehat(1.5e12, 5e11),
                "2022": sehat(2.0e12, 6e11), "2023": sehat(5.0e12, 2e12),
                "2024": sehat(6.0e12, 2.4e12),
            },
            None,
            [],
        ),
        (
            "lonjakan 5000x -- bukan pangkat 1000 -> DIBIARKAN",
            {
                "2020": sehat(1.0e9, 4e8), "2021": sehat(1.1e9, 4.1e8),
                "2022": sehat(1.2e9, 4.2e8), "2023": sehat(5.0e12, 2.0e12),
                "2024": sehat(1.3e9, 4.3e8),
            },
            None,
            [],
        ),
        (
            "pembanding kurang dari 3 -> DIBIARKAN (median tak bisa dipercaya)",
            {"2022": sehat(1.0e12, 4e11), "2023": sehat(1.0e18, 4e17)},
            None,
            [],
        ),
        (
            "arus nyaris nol di satu periode -> DIBIARKAN (kasus AALI financing_cf)",
            {
                "2025-03": {**sehat(1.0e13, 4e12), "financing_cf": -4.0e11},
                "2025-06": {**sehat(1.0e13, 4e12), "financing_cf": -4.1e11},
                "2025-09": {**sehat(1.0e13, 4e12), "financing_cf": -4.2e11},
                "2026-03": {**sehat(1.0e13, 4e12), "financing_cf": -4.0e8},
            },
            None,
            [],
        ),
        (
            "tetangga beda MATA UANG dilewati -> DIBIARKAN",
            {
                "2023": sehat(1.0e8, 4e7), "2024": sehat(1.1e8, 4.1e7),
                "2025": sehat(1.6e12, 6.4e11), "2026": sehat(1.7e12, 6.8e11),
            },
            None,
            [],
            {"2023": "USD", "2024": "USD", "2025": "IDR", "2026": "IDR"},
        ),
    ]
    gagal = 0
    for k in kasus:
        nama, bucket, dasar, harap = k[:4]
        mu = k[4] if len(k) > 4 else None
        dapat = [(p, r, baru) for p, r, _, baru, _ in periksa_bucket(bucket, dasar, mu)]
        cocok = len(dapat) == len(harap) and all(
            any(p == hp and r == hr and abs(b - hb) / abs(hb) < 0.01 for p, r, b in dapat)
            for hp, hr, hb in harap
        )
        print(f"  {'OK  ' if cocok else 'GAGAL'} {nama}")
        if not cocok:
            gagal += 1
            print(f"        harap={harap} dapat={dapat}")
    print(f"\n{len(kasus) - gagal}/{len(kasus)} lolos")
    sys.exit(1 if gagal else 0)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--uji", action="store_true", help="swauji, tak menyentuh data")
    ap.add_argument("--pindai", action="store_true", help="laporkan tanpa menulis")
    ap.add_argument("--tulis", action="store_true", help="terapkan perbaikan")
    a = ap.parse_args()
    if a.uji:
        uji()
    elif a.tulis:
        jalankan(tulis=True)
    else:
        jalankan(tulis=False)
