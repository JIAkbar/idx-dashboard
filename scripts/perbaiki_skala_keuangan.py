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

    ASII tahunan.total_assets 2023 = 4,457e23  (meleset 1e9, bukan 1e6)

AKARNYA BUKAN PEMERAS KITA. `panen_keuangan_idx.py` sudah MEMBACA skala dari
sheet `1000000` ruas "Level of rounding" -- rancangan yang benar. Masalahnya
keterangan itu BERBOHONG di sebagian berkas: BBCA 2022 dan BBCA 2023 sama-sama
menyatakan "Jutaan / In Million", padahal nilai di dalam berkas 2023 sudah
rupiah penuh (Kas 21.701.514.000.000) sementara 2022 memang jutaan
(Kas 21.359.509). Sebagian penerbit -- kebanyakan emiten besar: AALI, ASII,
BBCA, BBNI, BBRI, BMRI -- menulis satuan penuh tanpa memperbarui labelnya.

Penanda struktural TIDAK bisa dipakai. Sudah diuji: kelompok rusak dan
kelompok sehat sama-sama punya sheet ber-akhiran `PY`, dan header ber-token
(`CurrentYearInstant`) muncul di kedua kelompok. Jadi ini inkonsistensi
per-penerbit, bukan per-tahun dan bukan per-versi format.

CARA PERBAIKANNYA
-----------------
Skala salah itu sifat BERKAS, bukan sifat satu ruas. Jadi pembaginya
ditentukan SEKALI per periode dari ruas jangkar, lalu diterapkan ke seluruh
ruas moneter periode itu.

Empat pengaman, ketiganya lahir dari kesalahan nyata versi sebelumnya:

1. Jangkarnya ruas NERACA saja (`total_assets`, `equity`) -- posisi pada satu
   tanggal, bergerak lambat, tak pernah mendekati nol. Ruas ARUS tak pernah
   jadi jangkar justru karena ia BOLEH nyaris nol: `financing_cf` AALI 2026-Q1
   -4,02e8 vs kuartal lain -4,02e11 itu wajar (tak menarik utang kuartal itu),
   dan versi pertama skrip ini "membetulkannya" jadi seribu kali lebih besar.
2. Kalau kedua jangkar tak sepakat besarnya, TIDAK dikoreksi. Nilai salah yang
   dibiarkan masih bisa ditemukan nanti; nilai yang salah "dibetulkan" tidak.
3. Jangkarnya periode TERDEKAT, bukan seluruh riwayat. Median seluruh riwayat
   gagal pada emiten yang berubah ukuran drastis -- PANI aset 2019 cuma 120
   miliar dan 2025 sudah 50 triliun, sehingga rasio 2023 jatuh di 4.188 dan
   nilainya yang meleset seribu kali lolos tanpa terkoreksi.
4. Hanya pangkat 1000 yang diterima. Kesalahan satuan selalu kelipatan seribu;
   emiten yang benar-benar tumbuh 40x tak tersentuh karena 40 bukan pangkat
   1000.

Ambangnya diukur, bukan ditebak: dari 9.665 catatan `total_assets`, yang wajar
tertinggi BMRI 2,83e15 dan seluruh 35 catatan di atas 1e16 bertanggal
2023-12-31. Sesudah skrip ini dijalankan, catatan di atas 1e16 tersisa NOL.

Yang TIDAK boleh disentuh: ruas non-moneter (jumlah lembar saham, EPS, rasio),
didaftarkan di ABAIKAN -- skalanya tak mengikuti satuan berkas.

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

AKAR = pathlib.Path(__file__).resolve().parent.parent
SUMBER = AKAR / "data-idx" / "json" / "keuangan_idx"

# Ruas yang BUKAN nilai moneter -- skalanya tak mengikuti satuan berkas, jadi
# perbandingan antar-tahun di sini tak berarti apa-apa.
ABAIKAN = {"shares", "eps", "eps_dasar", "eps_dilusian", "der", "roe", "npm"}

PANGKAT = (1_000, 1_000_000, 1_000_000_000)

# Rasio serendah ini terhadap median periode lain sudah mustahil sebagai
# pertumbuhan. Diukur: p99 rasio antar-tahun yang sehat masih di bawah 10x.
AMBANG = 500

# Rasio hasil bagi harus jatuh dekat 1. 2.0 (bukan 3.0): dengan 3.0, rentang
# yang diterima sebagai "1000x" membentang 333-3000, sehingga lonjakan 800x
# yang nyata ikut "dibetulkan". Kesalahan satuan selalu TEPAT pangkat 1000;
# yang melebarkan rasio cuma pertumbuhan nyata antar-periode, dan itu jauh di
# bawah 2x pada ruas jangkar yang stabil.
TOLERANSI = 2.0

MIN_PEMBANDING = 3

# Ruas jangkar penentu skala: NERACA saja. Posisi pada satu tanggal, bergerak
# lambat, tak pernah mendekati nol pada emiten yang masih tercatat.
JANGKAR = ("total_assets", "equity")


def _angka(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def cari_pangkat(nilai: float, jangkar: float) -> int | None:
    """Pangkat 1000 yang membuat `nilai` masuk akal terhadap `jangkar`.

    Mengembalikan None kalau nilainya memang wajar, atau kalau selisihnya
    bukan kelipatan seribu (berarti bukan kesalahan satuan -- jangan disentuh).
    """
    if not jangkar or not nilai:
        return None
    rasio = abs(nilai) / abs(jangkar)
    if rasio < AMBANG and rasio > 1 / AMBANG:
        return None
    for p in PANGKAT:
        for kandidat in (p, 1 / p):
            sesudah = rasio / kandidat
            if 1 / TOLERANSI <= sesudah <= TOLERANSI:
                return int(kandidat) if kandidat >= 1 else -int(1 / kandidat)
    return None


def periksa_bucket(bucket: dict) -> list[tuple[str, str, float, float, int]]:
    """Kembalikan daftar (periode, ruas, lama, baru, pembagi) yang perlu dibetulkan.

    Kesalahan skala adalah sifat BERKAS, bukan sifat satu ruas: kalau satu
    laporan salah menyatakan satuannya, SELURUH nilai moneternya ikut salah
    bersamaan. Karena itu pembaginya ditentukan sekali per periode dari ruas
    JANGKAR yang stabil, lalu diterapkan ke semua ruas moneter periode itu.

    Menilai tiap ruas sendiri-sendiri terbukti berbahaya: `financing_cf` AALI
    2026-Q1 bernilai -4,02e8 sementara kuartal lain -4,02e11, dan itu WAJAR --
    perusahaan tak selalu menarik atau membayar utang tiap kuartal. Versi
    pertama skrip ini "membetulkannya" jadi seribu kali lebih besar, yakni
    mengarang angka yang tak pernah ada.

    Jangkarnya ruas NERACA (`total_assets`, `equity`): posisi pada satu
    tanggal, bergerak lambat, dan tak pernah mendekati nol pada emiten yang
    masih tercatat. Ruas ARUS tak pernah dipakai sebagai jangkar justru karena
    ia boleh nyaris nol.
    """
    if not isinstance(bucket, dict):
        return []

    urut = sorted(bucket)

    def median_lain(ruas: str, kecuali: str) -> float | None:
        """Jangkar dari periode TERDEKAT, bukan dari seluruh riwayat.

        Median seluruh riwayat gagal pada emiten yang berubah ukuran drastis.
        PANI: aset 2019 cuma 120 miliar, 2025 sudah 50 triliun. Median seluruh
        tahun tertarik ke bawah oleh tahun-tahun sebelum transformasi, sehingga
        rasio 2023 jatuh di 4.188 -- bukan pangkat 1000 yang bersih, jadi
        nilainya yang meleset seribu kali lolos tanpa terkoreksi. Tetangga
        langsungnya menjawab telak: 2022 15,9 T dan 2024 45,4 T, sehingga 2023
        yang benar 33,7 T.
        """
        try:
            i = urut.index(kecuali)
        except ValueError:
            return None
        dekat: list[float] = []
        for jarak in range(1, len(urut)):
            for j in (i - jarak, i + jarak):
                if 0 <= j < len(urut):
                    v = bucket[urut[j]]
                    if isinstance(v, dict) and _angka(v.get(ruas)) and v[ruas]:
                        dekat.append(abs(v[ruas]))
            if len(dekat) >= MIN_PEMBANDING + 1:
                break
        return statistics.median(dekat) if len(dekat) >= MIN_PEMBANDING else None

    perbaikan = []
    for periode, isi in bucket.items():
        if not isinstance(isi, dict):
            continue

        # Pembagi ditentukan dari jangkar; butuh KESEPAKATAN kalau ada dua.
        suara: list[int] = []
        for jangkar in JANGKAR:
            if not _angka(isi.get(jangkar)) or not isi.get(jangkar):
                continue
            med = median_lain(jangkar, periode)
            if med is None:
                continue
            bagi = cari_pangkat(isi[jangkar], med)
            if bagi:
                suara.append(bagi)
        if not suara or len(set(suara)) != 1:
            # Tak ada jangkar yang menuduh, atau keduanya tak sepakat besarnya.
            # Diam lebih baik daripada menebak: nilai salah yang dibiarkan masih
            # bisa ditemukan nanti, nilai yang salah "dibetulkan" tidak.
            continue
        bagi = suara[0]

        for ruas, val in isi.items():
            if ruas in ABAIKAN or not _angka(val) or not val:
                continue
            baru = val / bagi if bagi > 0 else val * -bagi
            perbaikan.append((periode, ruas, val, baru, bagi))
    return perbaikan


def jalankan(tulis: bool) -> int:
    total_berkas = total_nilai = 0
    per_tahun: dict[str, int] = {}
    contoh: list[str] = []

    for f in sorted(glob.glob(str(SUMBER / "*.json"))):
        p = pathlib.Path(f)
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        kode = p.stem
        berubah = False
        for nama_bucket in ("tahunan", "kuartal"):
            bucket = j.get(nama_bucket)
            for periode, ruas, lama, baru, bagi in periksa_bucket(bucket or {}):
                bucket[periode][ruas] = baru
                berubah = True
                total_nilai += 1
                th = periode[:4]
                per_tahun[th] = per_tahun.get(th, 0) + 1
                if len(contoh) < 12:
                    contoh.append(
                        f"  {kode:6} {nama_bucket:8} {periode} {ruas:16} "
                        f"{lama:.3e} -> {baru:.3e}  (/{bagi:,})"
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
    print("per tahun        :", dict(sorted(per_tahun.items())))
    if contoh:
        print("contoh:")
        print("\n".join(contoh))
    if not tulis:
        print("\n(mode pindai -- tak ada berkas ditulis; pakai --tulis untuk menerapkan)")
    return total_nilai


def uji() -> None:
    """Swauji: kasus yang HARUS dibetulkan dan yang HARUS dibiarkan."""
    kasus = [
        (
            "1e6 terlalu besar -> dibetulkan",
            {
                "2020": {"total_assets": 1.0e12}, "2021": {"total_assets": 1.1e12},
                "2022": {"total_assets": 1.2e12}, "2023": {"total_assets": 1.3e18},
                "2024": {"total_assets": 1.4e12},
            },
            [("2023", 1.3e12)],
        ),
        (
            "1e9 terlalu besar -> dibetulkan",
            {
                "2020": {"total_assets": 4.0e14}, "2021": {"total_assets": 4.1e14},
                "2022": {"total_assets": 4.2e14}, "2023": {"total_assets": 4.4e23},
                "2024": {"total_assets": 4.5e14},
            },
            [("2023", 4.4e14)],
        ),
        (
            "1e6 terlalu KECIL -> dibetulkan (arah sebaliknya nyata: ALMI 2019)",
            {
                "2019": {"total_assets": 6.2e7}, "2020": {"total_assets": 6.5e13},
                "2021": {"total_assets": 6.8e13}, "2022": {"total_assets": 7.0e13},
                "2023": {"total_assets": 7.2e13},
            },
            [("2019", 6.2e13)],
        ),
        (
            "pertumbuhan wajar 5x -> DIBIARKAN",
            {
                "2020": {"total_assets": 1.0e12}, "2021": {"total_assets": 1.5e12},
                "2022": {"total_assets": 2.0e12}, "2023": {"total_assets": 5.0e12},
                "2024": {"total_assets": 6.0e12},
            },
            [],
        ),
        (
            "lonjakan 5000x -- bukan pangkat 1000 -> DIBIARKAN",
            {
                "2020": {"total_assets": 1.0e9}, "2021": {"total_assets": 1.1e9},
                "2022": {"total_assets": 1.2e9}, "2023": {"total_assets": 5.0e12},
                "2024": {"total_assets": 1.3e9},
            },
            [],
        ),
        (
            "pembanding kurang dari 3 -> DIBIARKAN (median tak bisa dipercaya)",
            {"2022": {"total_assets": 1.0e12}, "2023": {"total_assets": 1.0e18}},
            [],
        ),
        (
            "arus nyaris nol di satu periode -> DIBIARKAN (kasus AALI financing_cf)",
            {
                "2025-03": {"total_assets": 1.0e13, "financing_cf": -4.0e11},
                "2025-06": {"total_assets": 1.0e13, "financing_cf": -4.1e11},
                "2025-09": {"total_assets": 1.0e13, "financing_cf": -4.2e11},
                "2026-03": {"total_assets": 1.0e13, "financing_cf": -4.0e8},
            },
            [],
        ),
    ]
    gagal = 0
    for nama, bucket, harap in kasus:
        dapat = [(p, baru) for p, _, _, baru, _ in periksa_bucket(bucket)]
        cocok = len(dapat) == len(harap) and all(
            any(p == hp and abs(b - hb) / hb < 0.01 for p, b in dapat) for hp, hb in harap
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
