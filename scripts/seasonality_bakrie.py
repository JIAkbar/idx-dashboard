# -*- coding: utf-8 -*-
"""Seasonality bulanan saham grup Bakrie — sejauh data Yahoo menyimpan.

Menarik candle BULANAN (interval=1mo, range=max) untuk tiap emiten, menghitung
imbal hasil bulan-ke-bulan, lalu merangkumnya per bulan kalender: berapa kali
bulan itu naik, seberapa besar kenaikannya, dan seberapa dalam penurunannya.

Yang perlu diingat saat membaca hasilnya:

* Dipakai `adjclose` kalau tersedia — harga yang sudah disesuaikan terhadap
  aksi korporasi. Saham grup ini sering right issue dan reverse split; memakai
  close mentah akan memunculkan "penurunan" 90% yang sebenarnya cuma
  penyesuaian rasio saham, bukan kerugian pemegangnya.
* MEDIAN dilaporkan berdampingan dengan rata-rata. Untuk saham yang pernah
  bergerak +200% dalam sebulan, rata-rata ditarik jauh oleh segelintir bulan
  ekstrem; median memberi tahu bulan yang "biasa".
* Persentase bulan naik BUKAN probabilitas masa depan. Ini frekuensi historis
  pada rezim pasar yang sudah lewat (booming batu bara 2005-2008, krisis 2008,
  penurunan panjang 2012-2015). Dipakai untuk melihat pola, bukan meramal.

Cara pakai:
  python scripts/seasonality_bakrie.py              # semua emiten daftar bawaan
  python scripts/seasonality_bakrie.py BUMI ENRG    # emiten tertentu

Keluaran: data-idx/json/seasonality/bakrie.json + ringkasan di layar.
"""
import json
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "seasonality"

# Emiten grup Bakrie yang tercatat di BEI. Beberapa sudah berpindah kendali
# (mis. BUMI setelah restrukturisasi 2022) — tetap disertakan karena riwayat
# harganya bagian dari cerita grup ini. Kode yang datanya tidak ada di Yahoo
# akan dilaporkan, bukan didiamkan.
EMITEN = {
    "BUMI": "Bumi Resources",
    "BNBR": "Bakrie & Brothers",
    "ELTY": "Bakrieland Development",
    "ENRG": "Energi Mega Persada",
    "UNSP": "Bakrie Sumatera Plantations",
    "BTEL": "Bakrie Telecom",
    "DEWA": "Darma Henwa",
    "BRMS": "Bumi Resources Minerals",
    "VIVA": "Visi Media Asia",
    "MDIA": "Intermedia Capital",
}

BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
         "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def ambil_bulanan(kode: str, percobaan: int = 3) -> list[tuple[str, float]]:
    """[(YYYY-MM, harga)] terurut naik. Bulan tanpa harga dibuang."""
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{kode}.JK"
           f"?interval=1mo&range=max")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    galat = None
    for n in range(percobaan):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            break
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            galat = e
            time.sleep(2 * (n + 1))
    else:
        raise RuntimeError(f"gagal setelah {percobaan} percobaan: {galat}")

    hasil = data.get("chart", {}).get("result")
    if not hasil:
        raise RuntimeError("Yahoo tidak mengembalikan seri harga")
    res = hasil[0]
    stempel = res.get("timestamp") or []
    kutipan = res["indicators"]["quote"][0]
    # adjclose menyerap aksi korporasi; tanpa itu right issue terbaca sebagai
    # kerugian besar yang tidak pernah dialami pemegang saham.
    adj = res.get("indicators", {}).get("adjclose")
    harga = adj[0]["adjclose"] if adj else kutipan["close"]

    seri = []
    for t, h in zip(stempel, harga):
        if h is None:
            continue
        bulan = datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m")
        seri.append((bulan, float(h)))
    return seri


def imbal_bulanan(seri: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """[(YYYY-MM, persen)] — perubahan terhadap harga bulan sebelumnya."""
    keluar = []
    for (_, sebelum), (bulan, kini) in zip(seri, seri[1:]):
        if sebelum > 0:
            keluar.append((bulan, (kini - sebelum) / sebelum * 100))
    return keluar


def rangkum(imbal: list[tuple[str, float]]) -> dict:
    """Ringkasan per bulan kalender."""
    ember: dict[int, list[float]] = {i: [] for i in range(1, 13)}
    for bulan, pct in imbal:
        ember[int(bulan.split("-")[1])].append(pct)

    per_bulan = {}
    for i in range(1, 13):
        nilai = ember[i]
        if not nilai:
            per_bulan[BULAN[i - 1]] = None
            continue
        naik = sum(1 for v in nilai if v > 0)
        per_bulan[BULAN[i - 1]] = {
            "n": len(nilai),
            "naik": naik,
            "persen_naik": round(naik / len(nilai) * 100, 1),
            "rata2": round(statistics.fmean(nilai), 2),
            "median": round(statistics.median(nilai), 2),
            "terbaik": round(max(nilai), 2),
            "terburuk": round(min(nilai), 2),
        }
    return per_bulan


def main() -> None:
    pilih = [k.upper() for k in sys.argv[1:]] or list(EMITEN)
    KELUARAN.mkdir(parents=True, exist_ok=True)

    kumpulan, gagal = {}, {}
    semua_imbal: list[tuple[str, float]] = []

    for kode in pilih:
        nama = EMITEN.get(kode, kode)
        try:
            seri = ambil_bulanan(kode)
        except Exception as e:  # noqa: BLE001 — dilaporkan, tidak ditelan
            gagal[kode] = str(e)
            print(f"  ✗ {kode:<6} {nama} — {e}")
            continue

        if len(seri) < 24:
            gagal[kode] = f"cuma {len(seri)} bulan data, terlalu pendek"
            print(f"  ✗ {kode:<6} {nama} — {gagal[kode]}")
            continue

        imbal = imbal_bulanan(seri)
        semua_imbal += imbal
        kumpulan[kode] = {
            "nama": nama,
            "mulai": seri[0][0],
            "akhir": seri[-1][0],
            "bulan_data": len(seri),
            "per_bulan": rangkum(imbal),
        }
        print(f"  ✓ {kode:<6} {nama:<28} {seri[0][0]} → {seri[-1][0]}  ({len(seri)} bulan)")
        time.sleep(1)  # jangan menggedor Yahoo

    keluaran = {
        "dibuat": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sumber": "Yahoo Finance, candle bulanan (adjclose), range=max",
        "catatan": ("Frekuensi historis, bukan probabilitas masa depan. "
                    "Median dilaporkan berdampingan dengan rata-rata karena "
                    "beberapa bulan ekstrem menarik rata-rata jauh."),
        "emiten": kumpulan,
        "gabungan_grup": rangkum(semua_imbal) if semua_imbal else {},
        "gagal": gagal,
    }
    berkas = KELUARAN / "bakrie.json"
    berkas.write_text(json.dumps(keluaran, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nTersimpan: {berkas.relative_to(AKAR)}")
    print(f"{len(kumpulan)} emiten berhasil, {len(gagal)} gagal, "
          f"{len(semua_imbal)} observasi bulan-emiten.\n")

    if semua_imbal:
        print("GABUNGAN GRUP — peluang bulan positif (historis):")
        print(f"  {'Bulan':<11} {'n':>4} {'naik':>6} {'median':>8} {'rata2':>8}")
        for nama_bulan in BULAN:
            b = keluaran["gabungan_grup"][nama_bulan]
            if not b:
                continue
            print(f"  {nama_bulan:<11} {b['n']:>4} {b['persen_naik']:>5.1f}% "
                  f"{b['median']:>7.2f}% {b['rata2']:>7.2f}%")


if __name__ == "__main__":
    main()
