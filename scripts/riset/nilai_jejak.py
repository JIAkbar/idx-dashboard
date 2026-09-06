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
PENILAIAN = AKAR / "data-idx" / "json" / "penilaian"

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
               singgahan: dict, horizon: int | None = None) -> dict:
    """Satu sinyal terhadap harga nyata. Mengembalikan hasil + kenapa.

    Dua ruas opsional di `sinyal`, keduanya berbawaan perilaku lama supaya
    pemanggil yang sudah ada tak berubah:

    - `arah` — `naik` (bawaan) atau `turun`. Tesis kontributor boleh menebak
      arah turun; hakimnya sama persis, dicerminkan.
    - `horizon` lewat parameter — tesis memilih 5/10/20 hari bursa sendiri.

    **Arah turun dikerjakan dengan MENCERMINKAN harga, bukan dengan cabang
    perbandingan kedua.** Menulis `if turun: rendah <= target else: tinggi >=
    target` di setiap tempat berarti dua aturan yang harus dijaga tetap sama
    selamanya; membalik tanda harga membuat keduanya satu jalur kode. Bar
    (buka, tinggi, rendah, tutup) jadi (−buka, −rendah, −tinggi, −tutup):
    yang tertinggi jadi yang terendah, dan seluruh logika di bawah berlaku apa
    adanya.
    """
    kode = sinyal["kode"]
    tp1, sl, entry = sinyal.get("tp1"), sinyal.get("sl"), sinyal.get("entry")
    if tp1 is None or sl is None:
        return {"kode": kode, "hasil": TAK_MASUK, "sebab": "tanpa tp/sl"}

    naik = sinyal.get("arah", "naik") != "turun"
    if not naik:
        tp1, sl = -tp1, -sl
        if isinstance(entry, list) and len(entry) == 2:
            entry = [-entry[1], -entry[0]]

    horizon = horizon or HORIZON

    # Hari bursa SESUDAH hari sinyal — keputusan (1) di docstring.
    try:
        i = kalender.index(tgl_sinyal)
    except ValueError:
        return {"kode": kode, "hasil": TAK_MASUK, "sebab": "tanggal di luar kalender"}
    jendela = kalender[i + 1: i + 1 + horizon]

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
        if not naik:
            # Cermin dibuat saat membaca, BUKAN di singgahan: peta bar itu
            # dipakai bersama seluruh preset dan tesis lain, dan membalik
            # isinya akan merusak penilaian sinyal di sebelahnya.
            tinggi, rendah = -rendah, -tinggi
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
                # `tglKeluar` = hari bursa saat vonis TP/SL jatuh (None kalau
                # menggantung/tak masuk). Dipakai koreksi segel: sinyal yang
                # vonisnya jatuh TEPAT di hari segel dibuat adalah sinyal yang
                # datanya paling mungkin belum mengendap saat itu.
                "saham": [
                    {"kode": h["kode"], DEF_TP_SL: h["hasil"],
                     DEF_OPEN_TINGGI: x[DEF_OPEN_TINGGI],
                     DEF_TUTUP_TUTUP: x[DEF_TUTUP_TUTUP], "persen": x["persen"],
                     "tglKeluar": h.get("tglKeluar")}
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
            # Sisa MENTAH, tak dipotong HORIZON. Yang dipotong tak bisa
            # membedakan "jendelanya baru saja tutup hari ini" dari "sudah
            # tutup seminggu lalu" — padahal justru beda itu yang menentukan
            # apakah datanya sudah mengendap (lihat aturan segel di bawah).
            "hariBursaSesudah": sisa,
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


# ── Catatan tersegel dan koreksinya ─────────────────────────────────────────
# `penilaian/<tgl>.json` SEKALI TULIS (spek_sistem_winrate_produksi §1.2). Ia
# tak pernah ditimpa: angka yang sudah terbit tak boleh berubah diam-diam saat
# aturan penilaiannya disunting kelak. Koreksi karena itu berupa BERKAS
# TERPISAH, `<tgl>.koreksi.json` — aturan yang sama dengan J14.
#
# Kenapa koreksi dibutuhkan sama sekali: sampai 5 Sep 2026 segel ditulis
# begitu jendelanya tutup, termasuk kalau hari penutupnya adalah hari bursa
# terakhir yang datanya baru masuk. `2026-08-27.json` disegel 3 Sep pukul
# 08.25 — hari terakhir jendelanya sendiri — dan mencatat 41 menang / 29
# menggantung; dihitung ulang sesudah data hari itu lengkap, angkanya 42 / 28.
# Penyebabnya sudah ditutup (jeda satu hari bursa di bawah), tapi berkas yang
# telanjur terbit tetap perlu dikoreksi, dan koreksinya tak boleh berbentuk
# timpaan.
#
# Koreksi hanya SEKALI per tanggal. Catatan yang bisa dikoreksi berulang kali
# bukan catatan lagi — dan nama berkasnya sendiri yang menegakkan aturan itu:
# hanya ada satu `<tgl>.koreksi.json`.

RUAS_SEGEL = ("n", "menang", "kalah", "gantung", "tak_masuk", "ambigu")

ALASAN_PRA_JEDA = (
    "Segel dibuat pada hari penutup jendelanya sendiri, sebelum bar hari itu "
    "mengendap; aturan jeda satu hari bursa belum berlaku saat itu."
)


def beda_segel(segel: dict, kini: dict) -> dict:
    """Ruas yang berbeda antara catatan tersegel dan hitungan hari ini.

    Kosong berarti cocok. Sengaja cuma ruas HITUNGAN — `dinilaiPada` dan
    kawan-kawannya memang berbeda tiap jalan dan bukan penyimpangan."""
    return {k: [segel.get(k), kini.get(k)] for k in RUAS_SEGEL
            if segel.get(k) != kini.get(k)}


def berkas_penilaian(tanggal: str, dir_=None):
    """Catatan yang BERLAKU untuk satu tanggal: koreksi menang atas segel asli.

    Tiap pembaca segel memanggil ini alih-alih menyusun nama berkasnya sendiri.
    Pembaca yang menebak namanya akan membaca angka yang sudah diketahui salah."""
    d = dir_ or PENILAIAN
    k = d / f"{tanggal}.koreksi.json"
    if k.exists():
        return k
    asli = d / f"{tanggal}.json"
    return asli if asli.exists() else None


def saham_berubah(b: dict, segel: dict) -> dict:
    """Emiten yang vonisnya bergeser sesudah segel dibuat.

    Dua jalan, dan yang kedua sengaja menyebut dirinya tebakan:

    - Segel yang MEMBAWA vonis per emiten → diff persis, ditandai `diff`.
    - Segel lama (sebelum 5 Sep 2026 vonis per emiten belum ikut dicatat) tak
      bisa didiff sama sekali. Yang bisa ditunjuk cuma tersangkanya: sinyal
      yang vonisnya jatuh TEPAT di hari segel dibuat — satu-satunya hari yang
      datanya belum mengendap saat itu.
    """
    lama = {(pr["preset"], s["kode"]): s[DEF_TP_SL]
            for pr in segel.get("preset", []) for s in pr.get("saham", [])}
    if lama:
        return {"cara": "diff", "saham": [
            {"preset": pr["preset"], "kode": s["kode"],
             "sebelum": lama[(pr["preset"], s["kode"])], "sesudah": s[DEF_TP_SL]}
            for pr in b["preset"] for s in pr["saham"]
            if (pr["preset"], s["kode"]) in lama
            and lama[(pr["preset"], s["kode"])] != s[DEF_TP_SL]]}
    hari = segel.get("hariBursaTerakhirSaatDinilai")
    return {"cara": "tersangka-hari-segel", "saham": [
        {"preset": pr["preset"], "kode": s["kode"], "sesudah": s[DEF_TP_SL],
         "tglKeluar": s.get("tglKeluar")}
        for pr in b["preset"] for s in pr["saham"] if s.get("tglKeluar") == hari]}


def _catatan_segel(b: dict, hasil: dict, sekarang: str) -> dict:
    """Isi baku sebuah catatan penilaian — bentuk yang SAMA untuk segel asli
    dan koreksinya, supaya pembaca tak perlu tahu ia sedang membaca yang mana."""
    return {
        "tanggal": b["tanggal"], "horizon": hasil["horizon"],
        "dinilaiPada": sekarang,
        "hariBursaTerakhirSaatDinilai": hasil["hariBursaTerakhir"],
        **{k: b[k] for k in ("kelasBukti", "era", "n", "menang", "kalah", "gantung",
                             "tak_masuk", "ambigu", "menangDariTuntas",
                             "menangDariSemua", "preset")},
    }


def segel_dan_koreksi(hasil: dict, dir_=None, sekarang: str | None = None) -> dict:
    """Tulis segel untuk tanggal yang datanya sudah mengendap, lalu koreksi
    untuk segel yang terbukti menyimpang. Ringkasan koreksinya ditempelkan ke
    `perTanggal` supaya halaman bisa menandai angka mana yang hasil koreksi.

    Jendela tutup SAJA tidak cukup untuk menyegel: butuh satu hari bursa JEDA
    sesudahnya (`hariBursaSesudah >= HORIZON + 1`). Sisa yang dipakai di sini
    sengaja yang MENTAH — yang sudah dipotong horizon tak bisa membedakan
    "jendelanya baru tutup hari ini" dari "sudah tutup seminggu lalu", padahal
    justru beda itu yang menentukan apakah datanya sudah mengendap.
    """
    from datetime import datetime, timedelta, timezone
    d = dir_ or PENILAIAN
    d.mkdir(parents=True, exist_ok=True)
    sekarang = sekarang or datetime.now(timezone(timedelta(hours=7))).isoformat(timespec="seconds")
    n = {"baru": 0, "lewat": 0, "koreksi": 0, "koreksiDitolak": 0}

    for b in hasil["perTanggal"]:
        mengendap = b.get("hariBursaSesudah", 0) >= HORIZON + 1
        asli = d / f"{b['tanggal']}.json"

        if not asli.exists():
            if mengendap:
                asli.write_text(json.dumps(_catatan_segel(b, hasil, sekarang),
                                           ensure_ascii=False, indent=1), encoding="utf-8")
                n["baru"] += 1
            continue

        n["lewat"] += 1
        segel = json.loads(asli.read_text(encoding="utf-8"))
        beda = beda_segel(segel, b)
        p_kor = d / f"{b['tanggal']}.koreksi.json"

        if p_kor.exists():
            kor = json.loads(p_kor.read_text(encoding="utf-8"))
            b["koreksi"] = {k: kor[k] for k in ("dikoreksiPada", "alasan", "berubah")}
            # Koreksi KEDUA ditolak — sekali koreksi, dan itu batasnya. Kalau
            # angkanya bergeser lagi sesudah dikoreksi, yang salah bukan
            # berkasnya melainkan aturannya, dan itu perlu keputusan manusia.
            if beda_segel(kor, b):
                n["koreksiDitolak"] += 1
            continue

        if not beda or not mengendap:
            continue

        kor = {**_catatan_segel(b, hasil, sekarang),
               "jenis": "koreksi",
               "mengoreksi": asli.name,
               "dikoreksiPada": sekarang,
               "alasan": ALASAN_PRA_JEDA,
               "segelDinilaiPada": segel.get("dinilaiPada"),
               "segelHariBursaTerakhir": segel.get("hariBursaTerakhirSaatDinilai"),
               "sebelum": {k: segel.get(k) for k in RUAS_SEGEL},
               "berubah": beda,
               "sahamBerubah": saham_berubah(b, segel)}
        del kor["dinilaiPada"]
        p_kor.write_text(json.dumps(kor, ensure_ascii=False, indent=1), encoding="utf-8")
        b["koreksi"] = {k: kor[k] for k in ("dikoreksiPada", "alasan", "berubah")}
        n["koreksi"] += 1

    return n


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

    # ── Arah TURUN (cermin) dan horizon per sinyal ──────────────────────────
    # Bar X: 24 Agu (100,104,98,100) · 26 Agu (101,110,95,106) · 27 Agu
    # (107,120,105,108). Jendela sinyal 24 Agu = 26 & 27 Agu.

    # Menang turun: harga JATUH menyentuh target 96 di 26 Agu (rendah 95).
    r = nilai_satu({"kode": "X", "arah": "turun", "tp1": 96, "sl": 121, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == MENANG and r["tglKeluar"] == "2026-08-26", r

    # Kalah turun: stop 108 tersentuh (tinggi 110) sementara target 90 tidak.
    r = nilai_satu({"kode": "X", "arah": "turun", "tp1": 90, "sl": 108, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == KALAH and r["tglKeluar"] == "2026-08-26", r

    # Ambigu turun: target 96 DAN stop 108 tersentuh di hari yang sama —
    # dihitung kalah dan ditandai, sama seperti arah naik.
    r = nilai_satu({"kode": "X", "arah": "turun", "tp1": 96, "sl": 108, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == KALAH and r.get("ambigu") is True, r

    # Tak masuk turun: area jual [200,210] tak pernah tersentuh dari bawah.
    r = nilai_satu({"kode": "X", "arah": "turun", "tp1": 90, "sl": 250, "entry": [200, 210]},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == TAK_MASUK, r

    # Masuk turun lalu menang: area [105,115] tersentuh 26 Agu (tinggi 110),
    # target 96 kena di hari yang sama (rendah 95).
    r = nilai_satu({"kode": "X", "arah": "turun", "tp1": 96, "sl": 130, "entry": [105, 115]},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == MENANG, r

    # Cermin tidak merusak singgahan: sinyal NAIK sesudahnya tetap benar.
    r = nilai_satu({"kode": "X", "tp1": 118, "sl": 90, "entry": None},
                   "2026-08-24", kal, singgahan)
    assert r["hasil"] == MENANG and r["tglKeluar"] == "2026-08-27", r

    # Horizon per sinyal: tp1 118 baru kena 27 Agu, jadi dengan horizon 1
    # (jendela cuma 26 Agu) hasilnya MENGGANTUNG, bukan menang.
    r = nilai_satu({"kode": "X", "tp1": 118, "sl": 90, "entry": None},
                   "2026-08-24", kal, singgahan, horizon=1)
    assert r["hasil"] == GANTUNG, r
    r = nilai_satu({"kode": "X", "tp1": 118, "sl": 90, "entry": None},
                   "2026-08-24", kal, singgahan, horizon=2)
    assert r["hasil"] == MENANG, r

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

    # ── Segel dan koreksinya ────────────────────────────────────────────────
    import tempfile

    def _hasil(menang, gantung, keluar=None, vonis_b=GANTUNG):
        """Satu tanggal palsu berjendela tutup: satu preset, dua saham."""
        return {"horizon": HORIZON, "hariBursaTerakhir": "2026-09-04", "perTanggal": [{
            "tanggal": "2026-08-27", "kelasBukti": "CATATAN", "era": "abjad",
            "hariBursaSesudah": HORIZON + 1, "jendelaTutup": True,
            "n": 2, "menang": menang, "kalah": 0, "gantung": gantung,
            "tak_masuk": 0, "ambigu": 0,
            "menangDariTuntas": 100.0, "menangDariSemua": 50.0,
            "preset": [{"preset": "scalping", "n": 2, "saham": [
                {"kode": "AAAA", DEF_TP_SL: MENANG, "tglKeluar": "2026-09-02"},
                {"kode": "BBBB", DEF_TP_SL: vonis_b, "tglKeluar": keluar}]}],
        }]}

    with tempfile.TemporaryDirectory() as td:
        d = Path(td)

        # Jalan pertama: disegel.
        n = segel_dan_koreksi(_hasil(1, 1), d, "2026-09-03T08:25:51+07:00")
        assert n == {"baru": 1, "lewat": 0, "koreksi": 0, "koreksiDitolak": 0}, n
        asli = (d / "2026-08-27.json").read_text(encoding="utf-8")

        # Jendela tutup SAJA tak cukup — tanpa jeda satu hari bursa, tak disegel.
        # Aturan ini lahir 5 Sep 2026; tanpa penjaga di sini ia gampang hilang lagi.
        h = _hasil(1, 1)
        h["perTanggal"][0]["tanggal"] = "2026-08-28"
        h["perTanggal"][0]["hariBursaSesudah"] = HORIZON
        segel_dan_koreksi(h, d, "2026-09-03T08:25:51+07:00")
        assert not (d / "2026-08-28.json").exists()

        # Jalan kedua, vonis satu emiten bergeser: koreksi lahir sebagai BERKAS
        # TERPISAH dan segel aslinya tak tersentuh satu bita pun.
        h = _hasil(2, 0, keluar="2026-09-03", vonis_b=MENANG)
        n = segel_dan_koreksi(h, d, "2026-09-06T10:00:00+07:00")
        assert n["koreksi"] == 1 and n["baru"] == 0, n
        assert (d / "2026-08-27.json").read_text(encoding="utf-8") == asli, "segel asli TERTIMPA"
        kor = json.loads((d / "2026-08-27.koreksi.json").read_text(encoding="utf-8"))
        assert kor["sebelum"]["menang"] == 1 and kor["menang"] == 2, kor
        assert kor["berubah"]["gantung"] == [1, 0], kor
        # Segel yang membawa vonis per emiten bisa didiff persis.
        assert kor["sahamBerubah"] == {"cara": "diff", "saham": [
            {"preset": "scalping", "kode": "BBBB", "sebelum": GANTUNG, "sesudah": MENANG}]}, kor
        # Ringkasannya menempel ke perTanggal supaya halaman bisa menandainya.
        assert h["perTanggal"][0]["koreksi"]["dikoreksiPada"] == "2026-09-06T10:00:00+07:00"

        # Pembaca memilih koreksi, bukan segel asli.
        assert berkas_penilaian("2026-08-27", d).name == "2026-08-27.koreksi.json"
        assert berkas_penilaian("2026-08-99", d) is None

        # Jalan ketiga, angka bergeser LAGI: koreksi kedua DITOLAK, isinya tetap.
        n = segel_dan_koreksi(_hasil(2, 5), d, "2026-09-07T10:00:00+07:00")
        assert n["koreksiDitolak"] == 1 and n["koreksi"] == 0, n
        assert json.loads((d / "2026-08-27.koreksi.json").read_text(encoding="utf-8")) == kor

        # Angka cocok dengan koreksinya = tak ada penolakan, tak ada berkas baru.
        n = segel_dan_koreksi(_hasil(2, 0, keluar="2026-09-03", vonis_b=MENANG), d,
                              "2026-09-08T10:00:00+07:00")
        assert n["koreksi"] == 0 and n["koreksiDitolak"] == 0, n

    with tempfile.TemporaryDirectory() as td:
        # Segel LAMA — dibuat sebelum vonis per emiten ikut dicatat (5 Sep 2026).
        # Tak bisa didiff; yang bisa ditunjuk cuma tersangkanya, dan berkasnya
        # wajib mengatakan bahwa itu tersangka, bukan temuan.
        d = Path(td)
        (d / "2026-08-27.json").write_text(json.dumps({
            "tanggal": "2026-08-27", "menang": 1, "kalah": 0, "gantung": 1,
            "tak_masuk": 0, "ambigu": 0, "n": 2,
            "dinilaiPada": "2026-09-03T08:25:51+07:00",
            "hariBursaTerakhirSaatDinilai": "2026-09-03",
            "preset": [{"preset": "scalping", "n": 2}],
        }), encoding="utf-8")
        segel_dan_koreksi(_hasil(2, 0, keluar="2026-09-03", vonis_b=MENANG), d,
                          "2026-09-06T10:00:00+07:00")
        kor = json.loads((d / "2026-08-27.koreksi.json").read_text(encoding="utf-8"))
        assert kor["sahamBerubah"]["cara"] == "tersangka-hari-segel", kor
        assert [x["kode"] for x in kor["sahamBerubah"]["saham"]] == ["BBBB"], kor

    nol = {k: 0 for k in RUAS_SEGEL}
    assert beda_segel(nol, nol) == {}
    assert beda_segel(nol, {**nol, "kalah": 3}) == {"kalah": [0, 3]}
    # Stempel waktu BUKAN penyimpangan — ia memang berbeda tiap jalan.
    assert beda_segel({**nol, "dinilaiPada": "a"}, {**nol, "dinilaiPada": "b"}) == {}

    print("swauji nilai_jejak: 40 kasus lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)
    h = jalankan()
    # Segel & koreksi DULUAN: keduanya menempelkan ruas `koreksi` ke perTanggal,
    # dan ruas itu harus ikut terbawa ke berkas yang dibaca halaman.
    n = segel_dan_koreksi(h)
    cetak(h)
    KELUARAN.write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n  ditulis: {KELUARAN.relative_to(AKAR)}")
    print(f"  penilaian/: {n['baru']} segel baru, {n['lewat']} sudah ada (tak ditimpa), "
          f"{n['koreksi']} koreksi ditulis, {n['koreksiDitolak']} koreksi kedua ditolak")
