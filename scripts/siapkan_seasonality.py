# -*- coding: utf-8 -*-
"""Ubah hasil panen jadi berkas siap-unduh untuk halaman Seasonality.

Masukan : data-idx/json/seasonality/harga_bulanan.json (3,2 MB, semua emiten)
Keluaran: data-idx/json/seasonality/imbal_<HURUF>.json + indeks.json

DUA PEMANGKASAN
---------------
1. **Imbal (%) menggantikan harga.** Halaman menghitung persentase, bukan
   rupiah; menyimpan harga penuh berarti mengirim angka enam digit untuk
   melahirkan satu angka dua desimal. Bulan pertama tiap emiten hilang dengan
   sendirinya — tak ada bulan sebelumnya untuk dibandingkan.

2. **Dipecah per huruf awal kode.** Pengunjung mencari 1-5 emiten, bukan 962.
   Memecah per huruf membuat unduhan tinggal berkas yang memuat emiten yang
   dicari; sisanya tak pernah menyentuh jaringan.

`indeks.json` memuat daftar kode + nama + rentang datanya, supaya kotak
pencarian bisa menyarankan emiten TANPA mengunduh satu pun berkas imbal.

Jalankan setelah panen:
  python scripts/siapkan_seasonality.py
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
SUMBER = AKAR / "data-idx" / "json" / "seasonality" / "harga_bulanan.json"
DAFTAR = AKAR / "data-idx" / "json" / "daftar_emiten.json"
SEKTOR = AKAR / "data-idx" / "json" / "emiten_sektor.json"
KELUAR = AKAR / "data-idx" / "json" / "seasonality"
# Kalender bursa. Dipilih deret harian IHSG karena ia SATU berkas yang
# membentang 1990 -> hari bursa terakhir, jadi tiap hari bursa yang pernah ada
# terbaca tanpa memindai ribuan berkas harian — dan rentangnya menutupi
# seluruh rentang harga_bulanan.json (yang praktis baru mulai tahun 2000).
KALENDER = AKAR / "data-idx" / "json" / "ohlc" / "IHSG.json"


def bulan_tuntas_terakhir() -> str:
    """Bulan terakhir yang bursanya sudah TUTUP, menurut kalender bursa.

    Sebuah bulan dinyatakan tuntas hanya kalau kalender sudah memuat hari
    bursa di bulan BERIKUTNYA. Bulan berjalan karena itu tak pernah lolos:
    September 2026 pada 4 Sep baru 4 dari ~21 hari bursanya, dan imbal
    "sebulan" yang lahir dari 4 hari itu tersimpan seolah sebulan penuh —
    persis cacat yang membuat Agustus 2026 tersimpan salah di 91 dari 104
    emiten pembanding.

    Arah salahnya disengaja. Menahan bulan yang sebenarnya sudah selesai cuma
    menunda satu bulan sampai bar bursa berikutnya turun (paling lama beberapa
    hari); meloloskan bulan berjalan mencemari angka peluang yang tayang di
    layar dan yang diuji lawan pengacakan. Tanggal masehi hari ini TIDAK
    dipakai — bursa yang menentukan, bukan kalender dinding.
    """
    if not KALENDER.exists():
        raise SystemExit(f"Kalender bursa tak ditemukan: {KALENDER}")
    hari = json.loads(KALENDER.read_text(encoding="utf-8"))["d"]
    akhir = max(b[0] for b in hari)[:7]
    tahun, bulan = (int(x) for x in akhir.split("-"))
    batas = f"{tahun - 1}-12" if bulan == 1 else f"{tahun}-{bulan - 1:02d}"
    # Penjaga yang tak bisa jadi vakum. Penjaga di main() membandingkan keluaran
    # DENGAN batas ini, jadi batas yang salah membuatnya lolos tanpa memeriksa
    # apa pun — hijau karena buta, bukan karena benar. Yang di sini berpegang
    # pada kalender, bukan pada dirinya sendiri: batas wajib mendahului bulan
    # tempat hari bursa terakhir jatuh.
    assert batas < akhir, f"batas {batas} tidak mendahului bulan berjalan {akhir}"
    return batas


def imbal_bulanan(seri: dict[str, float], batas: str) -> dict[str, float]:
    """{'YYYY-MM': persen} — perubahan terhadap bulan SEBELUMNYA.

    `batas` = bulan tuntas terakhir; apa pun sesudahnya dibuang SEBELUM
    dihitung, jadi bulan berjalan tak bisa muncul — tidak sebagai imbal, tidak
    pula sebagai pembanding bulan lain.

    Bulan yang tidak berurutan (emiten disuspensi berbulan-bulan) tetap
    dihitung apa adanya: itu memang perubahan yang dialami pemegang sahamnya,
    dan menandainya sebagai lompatan justru menyembunyikan peristiwa nyata.
    """
    bulan = sorted(b for b in seri if b <= batas)
    keluar = {}
    for sebelum, kini in zip(bulan, bulan[1:]):
        h0, h1 = seri[sebelum], seri[kini]
        if h0 > 0:
            keluar[kini] = round((h1 - h0) / h0 * 100, 2)
    return keluar


def main() -> None:
    panen = json.loads(SUMBER.read_text(encoding="utf-8"))
    batas = bulan_tuntas_terakhir()
    nama = {e["kode"]: e["nama"] for e in json.loads(DAFTAR.read_text(encoding="utf-8"))["emiten"]}
    # Tanggal pencatatan tidak ada di daftar_emiten.json; ia hidup di
    # emiten_sektor.json (IDX-IC resmi). Dipakai supaya alasan "belum setahun"
    # bisa menyebut SEJAK KAPAN, bukan cuma "datanya kurang" -- pembaca yang
    # tahu emitennya baru IPO langsung mengerti, yang tidak tahu jadi tahu.
    _sektor = SEKTOR.read_text(encoding="utf-8") if SEKTOR.exists() else "{}"
    tercatat = {k: v.get("tercatat") for k, v in
                (json.loads(_sektor).get("emiten") or {}).items()}

    kelompok: dict[str, dict] = {}
    indeks = []
    belum = []
    for kode, seri in panen["seri"].items():
        imbal = imbal_bulanan(seri, batas)
        if len(imbal) < 12:
            # Kurang dari setahun penuh: tak ada satu pun bulan kalender yang
            # punya pembanding, jadi seasonality-nya belum berarti apa-apa.
            #
            # Emiten ini TETAP didaftarkan, di daftar terpisah `belum`. Tanpa
            # itu halaman diam sama sekali: Johan mencari EMAS (tercatat 23 Sep
            # 2025, baru 11 imbal) dan tak ada satu kata pun yang membedakan
            # "kami tak punya emitennya" dari "datanya belum cukup untuk
            # dihitung". Yang tahu alasannya justru langkah ini, jadi alasannya
            # dibawa ke datanya alih-alih ditebak ulang di layar.
            belum.append({
                "k": kode, "n": nama.get(kode, kode),
                "j": len(imbal), "t": tercatat.get(kode),
            })
            continue
        huruf = kode[0].upper()
        kelompok.setdefault(huruf, {})[kode] = imbal
        bulan = sorted(imbal)
        indeks.append({
            "k": kode, "n": nama.get(kode, kode),
            "m": bulan[0], "a": bulan[-1], "j": len(imbal),
        })

    # Penjaga: kalau satu bulan belum tuntas lolos sampai sini, berhenti —
    # jangan tulis berkas yang tampak wajar tapi angkanya cacat.
    lewat = sorted({b for isi in kelompok.values() for im in isi.values()
                    for b in im if b > batas})
    assert not lewat, f"bulan belum tuntas bocor ke keluaran: {lewat}"

    KELUAR.mkdir(parents=True, exist_ok=True)
    total = 0
    for huruf, isi in sorted(kelompok.items()):
        b = KELUAR / f"imbal_{huruf}.json"
        b.write_text(json.dumps(isi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        total += b.stat().st_size

    berkas_indeks = KELUAR / "indeks.json"
    berkas_indeks.write_text(json.dumps({
        # Stempel PANEN-nya, bukan jam jalannya skrip ini: umur data ditentukan
        # kapan harganya diambil, dan mengunci ke situ membuat dua jalan atas
        # masukan yang sama menghasilkan berkas yang identik byte demi byte.
        "dibuat": panen.get("dibuat"),
        # Bulan tuntas terakhir yang ikut dihitung. Apa pun sesudahnya dibuang.
        "tuntas": batas,
        "catatan": ("Rentang data BUKAN sejak IPO — Yahoo praktis mulai menyimpan IDX "
                    "sekitar tahun 2000, dan awalnya berbeda tiap emiten. Bulan "
                    "berjalan tidak dihitung: bulan baru ikut setelah bursa "
                    "menutupnya."),
        "emiten": sorted(indeks, key=lambda x: x["k"]),
        # Ada emitennya, datanya belum setahun penuh. Dipakai kotak pencarian
        # untuk menjawab, bukan diam.
        "belum": sorted(belum, key=lambda x: x["k"]),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # SENGAJA tidak menulis cermin ke folder statis app. Vite menyajikan
    # folder itu LEBIH DULU daripada middleware data hidup di vite.config.ts,
    # jadi salinan di situ membuat dev server selamanya menyajikan berkas
    # beku - tanpa satu pun galat. Sudah menggigit sekali (Beranda 20 Agu
    # 2026, tujuh ruas kosong); copy-static-data.mjs menghapus folder itu
    # tiap build justru karena ini, dan build produksi menyalin sendiri.

    besar = max(KELUAR.glob("imbal_*.json"), key=lambda p: p.stat().st_size)
    print(f"Bulan tuntas terakhir menurut kalender bursa: {batas}")
    print(f"{len(indeks)} emiten · {len(kelompok)} berkas huruf")
    print(f"Total {total/1024/1024:.2f} MB (dari {SUMBER.stat().st_size/1024/1024:.2f} MB)")
    print(f"Terbesar: {besar.name} {besar.stat().st_size/1024:.0f} KB")
    print(f"indeks.json {berkas_indeks.stat().st_size/1024:.0f} KB — cukup untuk kotak pencarian")


def swauji() -> None:
    """GAGAL kalau bulan berjalan bocor.  `python scripts/siapkan_seasonality.py --swauji`"""
    seri = {"2026-06": 100.0, "2026-07": 110.0, "2026-08": 121.0, "2026-09": 60.5}
    # 1. Bulan sesudah batas dibuang; bulan tuntas terakhir tetap terhitung.
    im = imbal_bulanan(seri, "2026-08")
    assert im == {"2026-07": 10.0, "2026-08": 10.0}, im
    # Dan tanpa batas ia MEMANG ikut — jadi ujinya membuktikan penjaganya yang
    # bekerja, bukan kebetulan bahwa datanya kosong.
    assert imbal_bulanan(seri, "2099-12")["2026-09"] == -50.0

    # 2. Batas datang dari kalender bursa, dan bulan hari-bursa-terakhir TIDAK ikut.
    batas = bulan_tuntas_terakhir()
    akhir = max(b[0] for b in json.loads(KALENDER.read_text(encoding="utf-8"))["d"])[:7]
    assert batas < akhir, (batas, akhir)

    # 3. Keluaran yang tergeletak di cakram pun tak boleh memuat bulan > batas.
    berkas = sorted(KELUAR.glob("imbal_*.json"))
    assert berkas, f"tak ada imbal_*.json di {KELUAR}"
    for b in berkas:
        bocor = sorted({m for imb in json.loads(b.read_text(encoding="utf-8")).values()
                        for m in imb if m > batas})
        assert not bocor, f"{b.name} memuat bulan belum tuntas: {bocor}"

    print(f"swauji LOLOS — batas {batas}, hari bursa terakhir jatuh di {akhir}, "
          f"{len(berkas)} berkas huruf bersih")


if __name__ == "__main__":
    swauji() if "--swauji" in sys.argv else main()
