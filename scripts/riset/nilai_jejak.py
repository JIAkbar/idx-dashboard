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
    """{tanggal: (open, high, low, close)} untuk satu emiten. Disinggahi — satu
    emiten muncul di banyak preset dan banyak tanggal.

    Dulu cuma (high, low): itu semua yang dibutuhkan TP/SL. Sejak 5 Sep 2026
    hakim juga menghitung dua definisi H+1 yang butuh buka dan tutup, jadi
    keempatnya disimpan sekaligus — satu bacaan berkas untuk tiga definisi."""
    if kode in singgahan:
        return singgahan[kode]
    p = OHLC_DIR / f"{kode}.json"
    peta: dict[str, tuple[float, float]] = {}
    if p.exists():
        try:
            for b in json.loads(p.read_text(encoding="utf-8"))["d"]:
                # d = [tanggal, open, high, low, close, volume]
                peta[b[0]] = (b[1], b[2], b[3], b[4])
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
        _, tinggi, rendah, _ = peta[t]
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


DEF_OPEN_TINGGI, DEF_TUTUP_TUTUP, DEF_TP_SL = "openTinggi", "tutupTutup", "tpSl"
TAK_TERUKUR = "tak_terukur"


def nilai_h1(sinyal: dict, tgl_sinyal: str, kalender: list[str],
             singgahan: dict) -> dict:
    """Dua definisi menang berhorizon SATU hari bursa.

    Keduanya sudah lama tayang di layar tapi dihitung di peramban; sejak 5 Sep
    2026 hakim yang menghitungnya, supaya satu metrik tak punya dua kalkulator.

    - `openTinggi` — menang bila TERTINGGI H+1 di atas PEMBUKAAN H+1 sendiri.
      Longgar dan sengaja begitu: ia tak peduli area beli kena atau tidak.
    - `tutupTutup` — menang bila PENUTUPAN H+1 di atas penutupan hari sinyal.
      Ketat, dan satu-satunya yang punya besaran (`persen`).

    Keputusan (1) hakim tetap berlaku di keduanya: hari sinyal tak dinilai,
    jendela mulai hari bursa BERIKUTNYA. `tak_terukur` berarti barnya memang
    belum ada — beda dari kalah.
    """
    kode = sinyal["kode"]
    try:
        i = kalender.index(tgl_sinyal)
    except ValueError:
        return {DEF_OPEN_TINGGI: TAK_TERUKUR, DEF_TUTUP_TUTUP: TAK_TERUKUR, "persen": None}
    peta = bar_per_tanggal(kode, singgahan)
    b0 = peta.get(tgl_sinyal)
    b1 = peta.get(kalender[i + 1]) if i + 1 < len(kalender) else None

    if b1 is None:
        ot = TAK_TERUKUR
    else:
        buka1, tinggi1, _, _ = b1
        ot = MENANG if (tinggi1 is not None and buka1 is not None and tinggi1 > buka1) else KALAH

    if b1 is None or b0 is None or not b0[3]:
        tt, persen = TAK_TERUKUR, None
    else:
        tutup0, tutup1 = b0[3], b1[3]
        tt = MENANG if tutup1 > tutup0 else KALAH
        persen = round(100 * (tutup1 / tutup0 - 1), 4)

    return {DEF_OPEN_TINGGI: ot, DEF_TUTUP_TUTUP: tt, "persen": persen}


def ringkas_h1(hasil: list[dict], kunci: str) -> dict:
    """Agregat satu definisi H+1. Penyebutnya menang+kalah; `tak_terukur`
    dilaporkan terpisah supaya besarnya kelihatan, bukan disembunyikan."""
    m = sum(1 for h in hasil if h[kunci] == MENANG)
    k = sum(1 for h in hasil if h[kunci] == KALAH)
    t = sum(1 for h in hasil if h[kunci] == TAK_TERUKUR)
    return {"menang": m, "kalah": k, "takTerukur": t,
            "winRate": round(100 * m / (m + k), 1) if (m + k) else None}


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


def gabung_definisi(per_preset: list[dict]) -> dict:
    """Jumlahkan ketiga definisi lintas preset untuk satu tanggal.

    Rata-rata persen ditimbang jumlah sinyal terukur, BUKAN rata-rata dari
    rata-rata: preset dengan 3 sinyal terukur tak boleh menimbang sama dengan
    preset yang 20."""
    keluar: dict = {}
    for d in (DEF_OPEN_TINGGI, DEF_TUTUP_TUTUP, DEF_TP_SL):
        potong = [x["definisi"][d] for x in per_preset]
        kunci = [k for k in potong[0] if isinstance(potong[0][k], int)] if potong else []
        gab = {k: sum(x[k] for x in potong) for k in kunci}
        if d == DEF_TP_SL:
            tuntas = gab["menang"] + gab["kalah"]
            n = tuntas + gab["gantung"] + gab["tak_masuk"]
            gab["menangDariTuntas"] = round(100 * gab["menang"] / tuntas, 1) if tuntas else None
            gab["menangDariSemua"] = round(100 * gab["menang"] / n, 1) if n else None
        else:
            tuntas = gab["menang"] + gab["kalah"]
            gab["winRate"] = round(100 * gab["menang"] / tuntas, 1) if tuntas else None
        if d == DEF_TUTUP_TUTUP:
            bobot = [(x["definisi"][d]["rataPersen"], x["definisi"][d]["menang"] + x["definisi"][d]["kalah"])
                     for x in per_preset if x["definisi"][d]["rataPersen"] is not None]
            tot_b = sum(w for _, w in bobot)
            gab["rataPersen"] = round(sum(v * w for v, w in bobot) / tot_b, 4) if tot_b else None
        keluar[d] = gab
    return keluar


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
            h1 = [nilai_h1(s, tgl, kalender, singgahan) for s in pr["saham"]]
            c = {k: sum(1 for h in hasil if h["hasil"] == k)
                 for k in (MENANG, KALAH, GANTUNG, TAK_MASUK)}
            tuntas = c[MENANG] + c[KALAH]
            persen = [x["persen"] for x in h1 if x["persen"] is not None]
            per_preset.append({
                "preset": pr["preset"], "n": len(hasil), **c,
                "ambigu": sum(1 for h in hasil if h.get("ambigu")),
                "menangDariTuntas": round(100 * c[MENANG] / tuntas, 1) if tuntas else None,
                "menangDariSemua": round(100 * c[MENANG] / len(hasil), 1) if hasil else None,
                # Tiga definisi berdampingan. `tpSl` mengulang angka di atas
                # dengan sengaja: halaman membaca satu bentuk untuk ketiganya,
                # dan ruas lama tetap ada supaya pembaca yang sudah ada tak
                # patah.
                # Vonis PER SAHAM ikut ditulis. Tanpa ini halaman masih harus
                # menghitung sendiri untuk daftar Menang/Kalah-nya, dan
                # kalkulator kedua yang mau dihapus itu hidup lagi lewat pintu
                # belakang. ~900 baris untuk seluruh berkas — murah dibanding
                # dua sumber kebenaran.
                "saham": [
                    {"kode": h["kode"], DEF_TP_SL: h["hasil"],
                     DEF_OPEN_TINGGI: x[DEF_OPEN_TINGGI],
                     DEF_TUTUP_TUTUP: x[DEF_TUTUP_TUTUP], "persen": x["persen"]}
                    for h, x in zip(hasil, h1)
                ],
                "definisi": {
                    DEF_OPEN_TINGGI: ringkas_h1(h1, DEF_OPEN_TINGGI),
                    DEF_TUTUP_TUTUP: {**ringkas_h1(h1, DEF_TUTUP_TUTUP),
                                      "rataPersen": round(sum(persen) / len(persen), 4) if persen else None},
                    DEF_TP_SL: {"menang": c[MENANG], "kalah": c[KALAH],
                                "gantung": c[GANTUNG], "tak_masuk": c[TAK_MASUK],
                                "ambigu": sum(1 for h in hasil if h.get("ambigu")),
                                "menangDariTuntas": round(100 * c[MENANG] / tuntas, 1) if tuntas else None,
                                "menangDariSemua": round(100 * c[MENANG] / len(hasil), 1) if hasil else None},
                },
            })

        tot = {k: sum(x[k] for x in per_preset) for k in (MENANG, KALAH, GANTUNG, TAK_MASUK)}
        n = sum(x["n"] for x in per_preset)
        tuntas = tot[MENANG] + tot[KALAH]
        per_tanggal.append({
            "tanggal": tgl,
            "kelasBukti": "REKONSTRUKSI" if d.get("backtest") else "CATATAN",
            # Dua ERA sampel yang tak boleh dijumlahkan jadi satu angka: sampai
            # 31 Agu 2026 pemutus peringkatnya ABJAD (4 dari 5 preset terbaca
            # alfabetis — cacat #2 di audit win rate), sejak 1 Sep pemutusnya
            # NILAI TRANSAKSI. Sampel era abjad bukan sampel aturan yang
            # sekarang dipakai; menggabungkannya membuat win rate hari ini
            # mengukur aturan yang sudah tak ada.
            "era": "abjad" if tgl <= "2026-08-31" else "nilai-transaksi",
            "dibangun": d.get("dibangun"),
            "hariBursaTersedia": min(sisa, HORIZON),
            "jendelaTutup": tuntas_penuh,
            "n": n, **tot,
            "ambigu": sum(x["ambigu"] for x in per_preset),
            "menangDariTuntas": round(100 * tot[MENANG] / tuntas, 1) if tuntas else None,
            "menangDariSemua": round(100 * tot[MENANG] / n, 1) if n else None,
            "definisi": gabung_definisi(per_preset),
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
    # (buka, tinggi, rendah, tutup) — empat, bukan dua, sejak hakim juga
    # menghitung dua definisi H+1 yang butuh buka dan tutup.
    singgahan = {"X": {
        "2026-08-24": (100, 104, 98, 100),
        "2026-08-26": (101, 110, 95, 106),
        "2026-08-27": (107, 120, 105, 108),
    }}

    # Hari sinyal tak ikut dinilai TP/SL. Bar 24 Agu sekarang ADA (definisi
    # tutup-ke-tutup membutuhkannya), jadi penjaganya dibuat eksplisit: tp1
    # 104 tepat tersentuh di hari sinyal, dan hasilnya tetap bukan menang
    # karena hari itu di luar jendela.
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

    # Keputusan (1) diuji langsung: tp1 104 = tinggi hari sinyal. Kalau hari
    # sinyal ikut dinilai, ini menang di 24 Agu.
    r = nilai_satu({"kode": "X", "tp1": 104, "sl": 1, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == MENANG and r["tglKeluar"] == "2026-08-26", r

    # ── Dua definisi H+1 ────────────────────────────────────────────────────
    # H+1 dari 24 Agu adalah 26 Agu: buka 101, tinggi 110, tutup 106.
    h = nilai_h1({"kode": "X"}, "2026-08-24", kal, singgahan)
    assert h[DEF_OPEN_TINGGI] == MENANG, h          # 110 > 101
    assert h[DEF_TUTUP_TUTUP] == MENANG, h          # 106 > 100
    assert h["persen"] == 6.0, h

    # H+1 dari 26 Agu adalah 27 Agu: buka 107, tinggi 120, tutup 108 vs 106.
    h = nilai_h1({"kode": "X"}, "2026-08-26", kal, singgahan)
    assert h[DEF_OPEN_TINGGI] == MENANG and h[DEF_TUTUP_TUTUP] == MENANG, h

    # Emiten tanpa bar sama sekali: tak_terukur, BUKAN kalah — membedakan
    # "belum ada datanya" dari "harganya turun" itu seluruh gunanya.
    h = nilai_h1({"kode": "KOSONG"}, "2026-08-24", kal, {"KOSONG": {}})
    assert h[DEF_OPEN_TINGGI] == TAK_TERUKUR and h[DEF_TUTUP_TUTUP] == TAK_TERUKUR, h
    assert h["persen"] is None, h

    # Agregat: penyebut winRate hanya menang+kalah; tak_terukur di luar.
    rk = ringkas_h1([{DEF_OPEN_TINGGI: MENANG}, {DEF_OPEN_TINGGI: KALAH},
                     {DEF_OPEN_TINGGI: TAK_TERUKUR}], DEF_OPEN_TINGGI)
    assert rk == {"menang": 1, "kalah": 1, "takTerukur": 1, "winRate": 50.0}, rk

    print("swauji nilai_jejak: 11 kasus lolos")


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

    # Berkas penilaian per tanggal, SEKALI TULIS — sifat yang sama dengan
    # rekomendasi/<tgl>.json (spek_sistem_winrate_produksi §1.2). Ditulis
    # hanya untuk tanggal yang jendelanya sudah TUTUP, dan tak pernah ditimpa:
    # angka yang sudah terbit tak boleh berubah diam-diam saat aturan
    # penilaiannya disunting kelak. Koreksi = berkas terpisah, bukan timpaan.
    # Agregat `nilai_jejak.json` di atas TETAP ditulis ulang tiap jalan — ia
    # ringkasan untuk halaman, bukan catatan.
    PENILAIAN = AKAR / "data-idx" / "json" / "penilaian"
    PENILAIAN.mkdir(parents=True, exist_ok=True)
    baru = lewat = 0
    for b in h["perTanggal"]:
        if not b["jendelaTutup"]:
            continue
        p = PENILAIAN / f"{b['tanggal']}.json"
        if p.exists():
            lewat += 1
            continue
        from datetime import datetime, timedelta, timezone
        p.write_text(json.dumps({
            "tanggal": b["tanggal"], "horizon": h["horizon"],
            "dinilaiPada": datetime.now(timezone(timedelta(hours=7))).isoformat(timespec="seconds"),
            "hariBursaTerakhirSaatDinilai": h["hariBursaTerakhir"],
            **{k: b[k] for k in ("kelasBukti", "era", "n", "menang", "kalah", "gantung",
                                  "tak_masuk", "ambigu", "menangDariTuntas", "menangDariSemua",
                                  "preset")},
        }, ensure_ascii=False, indent=1), encoding="utf-8")
        baru += 1
    print(f"  penilaian/: {baru} tanggal baru ditulis, {lewat} sudah ada (tak ditimpa)")
