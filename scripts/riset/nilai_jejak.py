# -*- coding: utf-8 -*-
"""Menilai jejak rekomendasi terhadap harga yang benar-benar terjadi.

Nol jaringan. Masukan: `data-idx/json/rekomendasi/<tgl>.json` (sinyal yang
ditulis sekali, tak pernah disunting) + `ohlc/<KODE>.json` (harga nyata).

KENAPA ADA: angka 90,7% yang beredar dihitung ad hoc, sekali, di dalam satu
sesi — tak ada berkas yang bisa dijalankan ulang untuk memeriksanya, dan
aturan penilaiannya cuma hidup di kepala yang menghitungnya. Begitu jendela
sinyalnya menutup dan angkanya perlu diperbarui, satu-satunya jalan adalah
menulis aturannya lagi dari ingatan — dan aturan yang ditulis ulang dari
ingatan tak pernah persis sama.

Empat keputusan yang menentukan angkanya, ditulis di sini supaya bisa
dibantah alih-alih diasumsikan:

1. **Hari sinyal TIDAK ikut dinilai.** Jendela mulai hari bursa BERIKUTNYA.
   Memasukkan hari sinyal berarti menilai aturan atas data yang dipakai
   membuatnya — win rate naik tanpa satu pun kemenangan nyata bertambah.

2. **Kalau TP dan SL tersentuh di hari yang sama, dihitung KALAH.** Data
   harian cuma menyimpan tinggi dan rendah, bukan urutannya, jadi mana yang
   lebih dulu tak bisa diketahui. Memilih menang di situ berarti memilih
   asumsi yang menguntungkan diri sendiri di setiap kasus yang ambigu.
   Berapa sering ini terjadi ikut dilaporkan (`ambigu`) supaya besarnya
   pilihan ini kelihatan, bukan tersembunyi di dalam angka akhir.

3. **Sinyal yang harganya tak pernah masuk area beli = TAK MASUK, bukan
   kalah dan bukan menang.** Ia tak pernah jadi posisi. Menghitungnya
   sebagai kalah menghukum aturan atas transaksi yang tak terjadi;
   membuangnya diam-diam justru lebih buruk — itu persis penyaringan
   sesudah-hasil-diketahui yang membuat 90,7% jadi angka yang menyesatkan.
   Jadi ia dihitung, dilaporkan terpisah, dan ikut jadi penyebut di ukuran
   kedua.

4. **Dua win rate dilaporkan berdampingan, tak pernah satu.**
   - `menangDariTuntas` — dari yang benar-benar selesai (menang+kalah).
     Ini yang dulu dibaca sebagai 90,7%.
   - `menangDariSemua` — dari SELURUH sinyal, termasuk yang menggantung dan
     tak masuk. Lebih kecil, dan ini yang jujur dipakai memutuskan.
   Melaporkan yang pertama sendirian membuat aturan yang sering menggantung
   terlihat lebih baik daripada aturan yang selalu tuntas dan kadang kalah.

Jalankan dari akar repo:
    python scripts/riset/nilai_jejak.py            # semua tanggal, tabel + JSON
    python scripts/riset/nilai_jejak.py --uji      # swauji, nol I/O
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
REKOMENDASI_DIR = AKAR / "data-idx" / "json" / "rekomendasi"
OHLC_DIR = AKAR / "data-idx" / "json" / "ohlc"
KELUARAN = AKAR / "data-idx" / "json" / "nilai_jejak.json"

# Jendela penilaian, dalam HARI BURSA sesudah hari sinyal.
HORIZON = 5

MENANG, KALAH, GANTUNG, TAK_MASUK = "menang", "kalah", "gantung", "tak_masuk"


def bar_per_tanggal(kode: str, singgahan: dict) -> dict:
    """{tanggal: (high, low)} untuk satu emiten. Disinggahi — satu emiten
    muncul di banyak preset dan banyak tanggal."""
    if kode in singgahan:
        return singgahan[kode]
    p = OHLC_DIR / f"{kode}.json"
    peta: dict[str, tuple[float, float]] = {}
    if p.exists():
        try:
            for b in json.loads(p.read_text(encoding="utf-8"))["d"]:
                # d = [tanggal, open, high, low, close, volume]
                peta[b[0]] = (b[2], b[3])
        except (KeyError, ValueError, IndexError):
            pass
    singgahan[kode] = peta
    return peta


def nilai_satu(sinyal: dict, tgl_sinyal: str, kalender: list[str],
               singgahan: dict) -> dict:
    """Satu sinyal terhadap harga nyata. Mengembalikan hasil + kenapa."""
    kode = sinyal["kode"]
    tp1, sl, entry = sinyal.get("tp1"), sinyal.get("sl"), sinyal.get("entry")
    if tp1 is None or sl is None:
        return {"kode": kode, "hasil": TAK_MASUK, "sebab": "tanpa tp/sl"}

    # Hari bursa SESUDAH hari sinyal — keputusan (1) di docstring.
    try:
        i = kalender.index(tgl_sinyal)
    except ValueError:
        return {"kode": kode, "hasil": TAK_MASUK, "sebab": "tanggal di luar kalender"}
    jendela = kalender[i + 1: i + 1 + HORIZON]

    peta = bar_per_tanggal(kode, singgahan)
    # Bar yang benar-benar ada untuk emiten ini di dalam jendela. Emiten yang
    # disuspensi punya jendela lebih pendek — itu fakta, bukan kekurangan
    # data, dan dilaporkan lewat `hariTerukur`.
    hari = [t for t in jendela if t in peta]

    # Batas atas area beli. `entry` bisa None (sinyal tanpa area — masuk di
    # harga berapa pun) atau [bawah, atas].
    batas = entry[1] if isinstance(entry, list) and len(entry) == 2 else None

    masuk = batas is None
    for t in hari:
        tinggi, rendah = peta[t]
        if not masuk:
            # Terisi kalau harga turun menyentuh area beli.
            if rendah <= batas:
                masuk = True
            else:
                continue
        kena_tp = tinggi >= tp1
        kena_sl = rendah <= sl
        if kena_tp and kena_sl:
            # Keputusan (2): ambigu dihitung kalah, dan dihitung berapa kali.
            return {"kode": kode, "hasil": KALAH, "sebab": "tp & sl hari sama",
                    "ambigu": True, "hariTerukur": len(hari), "tglKeluar": t}
        if kena_sl:
            return {"kode": kode, "hasil": KALAH, "sebab": "sl",
                    "hariTerukur": len(hari), "tglKeluar": t}
        if kena_tp:
            return {"kode": kode, "hasil": MENANG, "sebab": "tp1",
                    "hariTerukur": len(hari), "tglKeluar": t}

    if not masuk:
        return {"kode": kode, "hasil": TAK_MASUK, "sebab": "harga tak pernah masuk area beli",
                "hariTerukur": len(hari)}
    return {"kode": kode, "hasil": GANTUNG, "sebab": "jendela habis tanpa tp/sl",
            "hariTerukur": len(hari)}


def kalender_bursa() -> list[str]:
    """Hari bursa dibangun dari DATA, bukan daftar libur yang harus dirawat —
    sama seperti `gabung_ohlc_stockbit.py`. Sebuah tanggal dianggap hari
    bursa kalau mayoritas emiten punya bar di situ; tanggal yang cuma dimiliki
    segelintir berkas itu bar hantu, bukan hari bursa.

    Ini bukan kehalusan: 25 Agustus 2026 kosong di 963 dari 963 emiten (libur
    Maulid Nabi). Menghitung jendela dengan kalender masehi memasukkannya
    sebagai hari bursa, dan SETIAP jendela yang melewatinya jadi meleset satu
    hari — ke arah yang membuat hasil terlihat lebih tuntas dari kenyataan.
    """
    hitung: dict[str, int] = {}
    n = 0
    for p in OHLC_DIR.glob("*.json"):
        n += 1
        try:
            for b in json.loads(p.read_text(encoding="utf-8"))["d"][-400:]:
                hitung[b[0]] = hitung.get(b[0], 0) + 1
        except (KeyError, ValueError, IndexError):
            pass
    ambang = max(2, n // 2)
    return sorted(t for t, c in hitung.items() if c >= ambang)


def jalankan() -> dict:
    kalender = kalender_bursa()
    singgahan: dict = {}
    per_tanggal = []

    for p in sorted(REKOMENDASI_DIR.glob("2026-*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        tgl = d["tanggal"]
        try:
            sisa = len(kalender) - 1 - kalender.index(tgl)
        except ValueError:
            sisa = 0
        tuntas_penuh = sisa >= HORIZON

        per_preset = []
        for pr in d["presets"]:
            hasil = [nilai_satu(s, tgl, kalender, singgahan) for s in pr["saham"]]
            c = {k: sum(1 for h in hasil if h["hasil"] == k)
                 for k in (MENANG, KALAH, GANTUNG, TAK_MASUK)}
            tuntas = c[MENANG] + c[KALAH]
            per_preset.append({
                "preset": pr["preset"], "n": len(hasil), **c,
                "ambigu": sum(1 for h in hasil if h.get("ambigu")),
                "menangDariTuntas": round(100 * c[MENANG] / tuntas, 1) if tuntas else None,
                "menangDariSemua": round(100 * c[MENANG] / len(hasil), 1) if hasil else None,
            })

        tot = {k: sum(x[k] for x in per_preset) for k in (MENANG, KALAH, GANTUNG, TAK_MASUK)}
        n = sum(x["n"] for x in per_preset)
        tuntas = tot[MENANG] + tot[KALAH]
        per_tanggal.append({
            "tanggal": tgl,
            "kelasBukti": "REKONSTRUKSI" if d.get("backtest") else "CATATAN",
            "dibangun": d.get("dibangun"),
            "hariBursaTersedia": min(sisa, HORIZON),
            "jendelaTutup": tuntas_penuh,
            "n": n, **tot,
            "ambigu": sum(x["ambigu"] for x in per_preset),
            "menangDariTuntas": round(100 * tot[MENANG] / tuntas, 1) if tuntas else None,
            "menangDariSemua": round(100 * tot[MENANG] / n, 1) if n else None,
            "preset": per_preset,
        })

    return {"horizon": HORIZON, "hariBursaTerakhir": kalender[-1] if kalender else None,
            "perTanggal": per_tanggal}


def cetak(hasil: dict) -> None:
    print(f"\nJendela {hasil['horizon']} hari bursa. "
          f"Hari bursa terakhir yang ada datanya: {hasil['hariBursaTerakhir']}\n")
    print(f"  {'tanggal':11s} {'kelas':13s} {'jendela':9s} {'n':>4s} "
          f"{'menang':>7s} {'kalah':>6s} {'gantung':>8s} {'tak masuk':>10s} "
          f"{'dari tuntas':>12s} {'dari semua':>11s}")
    for b in hasil["perTanggal"]:
        j = "TUTUP" if b["jendelaTutup"] else f"{b['hariBursaTersedia']}/{hasil['horizon']}"
        dt = f"{b['menangDariTuntas']}%" if b["menangDariTuntas"] is not None else "-"
        ds = f"{b['menangDariSemua']}%" if b["menangDariSemua"] is not None else "-"
        print(f"  {b['tanggal']:11s} {b['kelasBukti']:13s} {j:9s} {b['n']:4d} "
              f"{b['menang']:7d} {b['kalah']:6d} {b['gantung']:8d} {b['tak_masuk']:10d} "
              f"{dt:>12s} {ds:>11s}")

    tutup = [b for b in hasil["perTanggal"] if b["jendelaTutup"]]
    if tutup:
        m = sum(b["menang"] for b in tutup)
        k = sum(b["kalah"] for b in tutup)
        n = sum(b["n"] for b in tutup)
        a = sum(b["ambigu"] for b in tutup)
        print(f"\n  Hanya tanggal berjendela TUTUP ({len(tutup)}): {n} sinyal, "
              f"{m} menang, {k} kalah")
        print(f"  dari tuntas {100*m/(m+k):.1f}%  ·  dari semua {100*m/n:.1f}%"
              f"  ·  {a} kasus tp & sl di hari sama (dihitung kalah)")
    else:
        print("\n  Belum ada tanggal yang jendelanya tutup penuh.")


def swauji() -> None:
    kal = ["2026-08-24", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-31",
           "2026-09-01", "2026-09-02"]
    singgahan = {"X": {"2026-08-26": (110, 95), "2026-08-27": (120, 105)}}

    # Hari sinyal tak ikut: bar 24 Agu sengaja TIDAK ada di singgahan, jadi
    # kalau ia terbaca hasilnya akan berubah.
    r = nilai_satu({"kode": "X", "tp1": 118, "sl": 90, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == MENANG and r["tglKeluar"] == "2026-08-27", r

    # SL lebih dulu (26 Agu rendah 95 <= 96) menang atas TP di 27.
    r = nilai_satu({"kode": "X", "tp1": 118, "sl": 96, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == KALAH and r["tglKeluar"] == "2026-08-26", r

    # Ambigu: 26 Agu menyentuh tp 108 DAN sl 96 — dihitung kalah, ditandai.
    r = nilai_satu({"kode": "X", "tp1": 108, "sl": 96, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == KALAH and r.get("ambigu") is True, r

    # Area beli tak pernah tersentuh (rendah terendah 95 > 90).
    r = nilai_satu({"kode": "X", "tp1": 118, "sl": 80, "entry": [70, 90]},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == TAK_MASUK, r

    # Masuk di 26 Agu (rendah 95 <= 100), lalu tp di 27.
    r = nilai_satu({"kode": "X", "tp1": 118, "sl": 80, "entry": [90, 100]},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == MENANG, r

    # Jendela habis tanpa tp/sl.
    r = nilai_satu({"kode": "X", "tp1": 999, "sl": 1, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == GANTUNG, r

    print("swauji nilai_jejak: 6 kasus lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)
    h = jalankan()
    cetak(h)
    KELUARAN.write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n  ditulis: {KELUARAN.relative_to(AKAR)}")
