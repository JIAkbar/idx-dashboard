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
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
SUMBER = AKAR / "data-idx" / "json" / "seasonality" / "harga_bulanan.json"
DAFTAR = AKAR / "data-idx" / "json" / "daftar_emiten.json"
SEKTOR = AKAR / "data-idx" / "json" / "emiten_sektor.json"
KELUAR = AKAR / "data-idx" / "json" / "seasonality"
CERMIN = AKAR / "app" / "public" / "data-idx" / "json" / "seasonality"


def imbal_bulanan(seri: dict[str, float]) -> dict[str, float]:
    """{'YYYY-MM': persen} — perubahan terhadap bulan SEBELUMNYA.

    Bulan yang tidak berurutan (emiten disuspensi berbulan-bulan) tetap
    dihitung apa adanya: itu memang perubahan yang dialami pemegang sahamnya,
    dan menandainya sebagai lompatan justru menyembunyikan peristiwa nyata.
    """
    bulan = sorted(seri)
    keluar = {}
    for sebelum, kini in zip(bulan, bulan[1:]):
        h0, h1 = seri[sebelum], seri[kini]
        if h0 > 0:
            keluar[kini] = round((h1 - h0) / h0 * 100, 2)
    return keluar


def main() -> None:
    panen = json.loads(SUMBER.read_text(encoding="utf-8"))
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
        imbal = imbal_bulanan(seri)
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

    KELUAR.mkdir(parents=True, exist_ok=True)
    total = 0
    for huruf, isi in sorted(kelompok.items()):
        b = KELUAR / f"imbal_{huruf}.json"
        b.write_text(json.dumps(isi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        total += b.stat().st_size

    berkas_indeks = KELUAR / "indeks.json"
    berkas_indeks.write_text(json.dumps({
        "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "catatan": ("Rentang data BUKAN sejak IPO — Yahoo praktis mulai menyimpan IDX "
                    "sekitar tahun 2000, dan awalnya berbeda tiap emiten."),
        "emiten": sorted(indeks, key=lambda x: x["k"]),
        # Ada emitennya, datanya belum setahun penuh. Dipakai kotak pencarian
        # untuk menjawab, bukan diam.
        "belum": sorted(belum, key=lambda x: x["k"]),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    CERMIN.mkdir(parents=True, exist_ok=True)
    for b in list(KELUAR.glob("imbal_*.json")) + [berkas_indeks]:
        (CERMIN / b.name).write_bytes(b.read_bytes())

    besar = max(KELUAR.glob("imbal_*.json"), key=lambda p: p.stat().st_size)
    print(f"{len(indeks)} emiten · {len(kelompok)} berkas huruf")
    print(f"Total {total/1024/1024:.2f} MB (dari {SUMBER.stat().st_size/1024/1024:.2f} MB)")
    print(f"Terbesar: {besar.name} {besar.stat().st_size/1024:.0f} KB")
    print(f"indeks.json {berkas_indeks.stat().st_size/1024:.0f} KB — cukup untuk kotak pencarian")


if __name__ == "__main__":
    main()
