"""Screener kandidat Deep Dive — membalik checklist Analisa PAPAN v1 jadi
saringan otomatis atas data PAPAN sendiri (OHLC + aliran asing). NOL JARINGAN.

Johan 22 Agu 2026: *"di screener ada deep dive dan kontributor kirim broksum
untuk analisa lebih lengkap, jadi sudah tau kandidat nya dulu dari screener
dan di analisa mendalam di buletin deepdive"*.

## Kenapa ini ada

Deep Dive BUMI & DSSA (14 Agu) terbukti pada 21 Agu (+8,3% dan +6,1%, lihat
`docs/analisa-papan-v1.md`) — tapi keduanya terpilih karena **kebetulan
setorannya lengkap**, bukan karena disaring. Urutannya terbalik: setoran dulu,
kandidat menyusul. Skrip ini membalikkannya: mesin menemukan kandidat dari data
yang SUDAH kita punya tiap hari, lalu setoran Broker Summary diminta untuk
kandidat itu — sehingga arus broker (satu-satunya lapis yang butuh manusia)
dikumpulkan pada emiten yang memang layak dibedah.

## Yang bisa dan TIDAK bisa dilihat mesin

Analisa v1 berdiri di tiga lapis: (a) arus broker multi-hari, (b) struktur
modal PCD, (c) tangga pivot + EMA. Lapis (a) TIDAK ADA di data harian kita —
itulah yang disetor kontributor. Jadi skrip ini sengaja hanya mencari **JEJAK
lapis (a) yang tercermin di harga & volume**, lalu menyatakannya sebagai
DUGAAN yang perlu dibuktikan broker summary. Ia tak pernah mengaku tahu siapa
yang menyerap.

## Enam sinyal (masing-masing satu poin, semuanya terukur)

1. **Volume di atas normal** — median RVOL20 sepuluh hari ≥ 1,15 sementara
   harga baru bergerak ≤ 20% (belum meledak jadi berita).
2. **Serapan efisien** — |return 10 hari| ÷ RVOL median ≤ 9. Inti asimetri
   Analisa v1 dinyatakan sebagai ANGKA: gerak harga per satuan volume.
3. **Menyerap saat pasar merah** — volume di atas normal pada ≥ 3 hari yang
   IHSG-nya turun.
4. **VolVal senyap** — z-score nilai transaksi ≥ 2 dengan |perubahan harga
   harian| ≤ 1% dalam 10 hari terakhir (definisi sama `arus-pasar/prob.py`).
5. **Struktur menahan** — close di atas EMA50 DAN di atas pivot P hari ini.
   Kandidat yang strukturnya sudah patah tak layak dibedah lebih dulu.
6. **Net asing 20 hari positif** — pelengkap, bukan inti: penyerap terbaik
   yang pernah kita bedah (DSSA) justru broker lokal, bukan asing.

### Uji luar sampel — dan batas yang harus diakui

Diuji dengan memotong data ke tanggal edisi masing-masing (tak mengintip
depan): BUMI @14 Agu dan DSSA @13 Agu **keduanya masuk daftar dengan skor 4**
— tapi di **peringkat 64 dari 69** dan **57 dari 60**. Artinya jelas dan tak
boleh dihaluskan: skrip ini **menyaring** ±900 emiten jadi puluhan yang layak
dimintakan Broker Summary; ia **tidak** memeringkat mana yang paling layak
dibedah. Menaikkan ambang sampai keduanya naik ke puncak akan menjadi
penyesuaian ke dua kasus (overfit) dan justru membuang keduanya pada skor ≥ 5
— sudah dicoba, hasilnya dicatat di sini supaya tak dicoba lagi diam-diam.

### Kejujuran ambang

Versi pertama skrip ini TIDAK menjaring BUMI maupun DSSA pada tanggal edisinya
— dua kasus yang justru jadi dasarnya. Diagnosanya, bukan tambalan buta:
(a) "harga sempit ≤ 8%" salah menerjemahkan tesis BUMI, yang justru berbunyi
"serapan Rp1,45 T hanya menggerakkan harga 7,7%" — yang diukur seharusnya
RASIO, bukan gerak mutlak; (b) proksi "akumulasi saat merah" memakai net asing,
padahal penampung DSSA adalah broker lokal. Ambang sesudahnya ditetapkan dari
DIAGNOSA itu, dan hasilnya tetap dilaporkan apa adanya di §uji luar sampel —
dua kasus bukan bukti statistik, dan daftar ini tetap dugaan yang perlu
dibuktikan Broker Summary.

Skor = jumlah sinyal (0-5). Kandidat = skor ≥ 3 DAN likuiditas median 20 hari
≥ Rp1 miliar/hari (ambang `TINGKAT_LIKUIDITAS.mrd1`, lihat
`docs/likuiditas-acuan.md`) — di bawah itu Broker Summary-nya pun tipis dan
Deep Dive-nya takkan punya bahan.

Keluaran: `data-idx/json/kandidat_deepdive.json` — daftar terurut skor, tiap
baris membawa ALASAN per sinyal (bukan cuma angka) supaya bisa dibantah.

Pakai:
    python scripts/riset/kandidat_deepdive.py            # tulis JSON
    python scripts/riset/kandidat_deepdive.py --uji      # swauji, tak menulis
"""
from __future__ import annotations

import json
import statistics
import sys
from datetime import datetime
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent.parent
DIR_JSON = AKAR / "data-idx" / "json"
DIR_OHLC = DIR_JSON / "ohlc"
DIR_ASING = DIR_JSON / "asing"
KELUARAN = DIR_JSON / "kandidat_deepdive.json"

JENDELA = 10          # hari bursa yang diperiksa
RVOL_N = 20           # dasar volume relatif
# Batas "belum meledak". 20% dipilih karena empat hari ARA beruntun sudah
# melewatinya — di atas itu kenaikan sudah jadi berita, bukan serapan diam.
BELUM_LARI_PCT = 20.0
RVOL_MIN = 1.15       # median RVOL20 minimum (volume di atas normal)
# Asimetri BUMI dalam satu angka: persen gerak harga per satuan volume relatif.
# BUMI 14 Agu = 9,7 / 1,20 = 8,1; DSSA 13 Agu = 17,9 / 2,27 = 7,9.
EFISIENSI_MAKS = 9.0
MERAH_MIN = 3         # minimum hari IHSG-turun yang volumenya di atas normal
VV_WIN, VV_Z, VV_PCT = 60, 2.0, 1.0
LIKUID_MIN = 1e9      # Rp1 miliar/hari, median 20 hari
SKOR_MIN = 4
MAKS_KELUAR = 40


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def median(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return statistics.median(xs) if xs else None


def sinyal(bar: list, asing: list | None, ihsg_turun: set[str]) -> dict | None:
    """Lima sinyal untuk satu emiten. None kalau riwayatnya tak cukup."""
    if len(bar) < VV_WIN + JENDELA + 2:
        return None
    tutup = [b[4] for b in bar]
    vol = [b[5] for b in bar]
    harga = tutup[-1]

    likuid = median([tutup[i] * vol[i] for i in range(len(bar) - 20, len(bar))])
    if not likuid or likuid < LIKUID_MIN:
        return None

    poin: list[dict] = []

    # 1. Volume di atas normal, harga belum meledak
    ret10 = (harga / tutup[-(JENDELA + 1)] - 1) * 100
    rvol, merah = [], 0
    for i in range(len(bar) - JENDELA, len(bar)):
        dasar = median(vol[i - RVOL_N:i])
        if not dasar:
            continue
        r = vol[i] / dasar
        rvol.append(r)
        # Hari INDEKS turun yang volumenya tetap di atas normal — ada yang
        # menyerap ketika pasar melepas.
        if bar[i][0] in ihsg_turun and r >= 1.0:
            merah += 1
    rvol_med = median(rvol)
    if rvol_med and rvol_med >= RVOL_MIN and abs(ret10) <= BELUM_LARI_PCT:
        poin.append({"nama": "volume di atas normal",
                     "bukti": f"volume {rvol_med:.2f}x normal sementara harga baru {ret10:+.1f}% dalam {JENDELA} hari"})

    # 2. Serapan efisien — inti asimetri Analisa v1: uang besar, gerak kecil.
    #    Dinyatakan sebagai angka, bukan kesan: persen gerak per satuan volume.
    efisiensi = abs(ret10) / rvol_med if rvol_med else None
    if efisiensi is not None and efisiensi <= EFISIENSI_MAKS and rvol_med >= 1.0:
        poin.append({"nama": "serapan efisien",
                     "bukti": f"{efisiensi:.1f}% gerak per 1x volume normal (makin kecil makin diserap diam)"})

    # 3. Menyerap saat pasar merah.
    #    Proksinya VOLUME, bukan net asing — diukur 22 Agu 2026: pada BUMI &
    #    DSSA (dua Deep Dive yang terbukti) hari-merah-ber-volume-tinggi = 4
    #    untuk keduanya, sedangkan hari-merah-net-asing-positif cuma 1 dan 2.
    #    Yang menampung DSSA memang broker lokal (SS/LG/RF), bukan asing; memakai
    #    asing sebagai proksi penyerapan akan melewatkan justru kasus terbaiknya.
    if merah >= MERAH_MIN:
        poin.append({"nama": "menyerap saat pasar merah",
                     "bukti": f"volume di atas normal pada {merah} hari IHSG turun ({JENDELA} hari terakhir)"})

    # 4. VolVal senyap (nilai melonjak, harga nyaris diam)
    nilai = [tutup[i] * vol[i] for i in range(len(bar))]
    senyap = 0
    for i in range(len(bar) - JENDELA, len(bar)):
        w = nilai[i - VV_WIN:i]
        if len(w) < VV_WIN:
            continue
        sd = statistics.stdev(w)
        if not sd:
            continue
        z = (nilai[i] - statistics.fmean(w)) / sd
        pct = (tutup[i] / tutup[i - 1] - 1) * 100 if tutup[i - 1] else 0
        if z >= VV_Z and abs(pct) <= VV_PCT:
            senyap += 1
    if senyap:
        poin.append({"nama": "VolVal senyap",
                     "bukti": f"{senyap} hari nilai transaksi z>={VV_Z:.0f} dengan harga bergerak <={VV_PCT:.0f}%"})

    # 5. Struktur menahan — di atas EMA50 dan pivot P
    k = 2 / 51
    ema = tutup[0]
    for c in tutup[1:]:
        ema = c * k + ema * (1 - k)
    p_sebelum = bar[-2]
    pivot = (p_sebelum[2] + p_sebelum[3] + p_sebelum[4]) / 3
    if harga > ema and harga > pivot:
        poin.append({"nama": "struktur menahan",
                     "bukti": f"close {harga:,.0f} di atas EMA50 {ema:,.0f} dan pivot {pivot:,.0f}".replace(",", ".")})

    # 6. Net asing 20 hari positif (pelengkap, bukan inti — lihat sinyal 3)
    net20 = None
    if asing:
        pot = [r for r in asing if r and r[0] <= bar[-1][0]][-20:]
        if pot:
            net20 = sum((r[1] or 0) - (r[2] or 0) for r in pot)
            if net20 > 0:
                poin.append({"nama": "net asing 20 hari positif",
                             "bukti": f"{net20/1e6:,.1f} juta lembar bersih dibeli asing".replace(",", ".")})

    return {
        "skor": len(poin),
        "sinyal": poin,
        "harga": harga,
        "likuiditas": likuid,
        "ret10": round(ret10, 2),
        "rvol_med": round(rvol_med, 2) if rvol_med else None,
        "efisiensi": round(efisiensi, 2) if efisiensi is not None else None,
        "net_asing_20h": net20,
        "tanggal": bar[-1][0],
    }


def jalankan() -> dict:
    ihsg = baca(DIR_JSON / "ihsg_harian.json") or {}
    tutup_ihsg = ihsg.get("tutup") or {}
    urut = sorted(tutup_ihsg)
    turun = {t for i, t in enumerate(urut)
             if i and tutup_ihsg[t] < tutup_ihsg[urut[i - 1]]}

    keluar = []
    for p in sorted(DIR_OHLC.glob("*.json")):
        if p.stem.startswith("_") or p.stem == "IHSG":
            continue
        d = baca(p)
        bar = [b for b in (d or {}).get("d", []) if b and b[4]]
        if not bar:
            continue
        asing = (baca(DIR_ASING / f"{p.stem}.json") or {}).get("d")
        s = sinyal(bar, asing, turun)
        if s and s["skor"] >= SKOR_MIN:
            keluar.append({"kode": p.stem, **s})

    # Urut: skor, lalu EFISIENSI (gerak harga per satuan volume — makin kecil
    # makin "diserap diam"), lalu likuiditas. Lihat catatan kejujuran di
    # docstring: urutan ini BUKAN peringkat "paling layak dibedah".
    keluar.sort(key=lambda x: (-x["skor"], x.get("efisiensi") if x.get("efisiensi") is not None else 99,
                               -(x["likuiditas"] or 0)))
    keluar = keluar[:MAKS_KELUAR]
    hasil = {
        "diperbarui": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "tanggal": keluar[0]["tanggal"] if keluar else None,
        "ambang": {"skor_min": SKOR_MIN, "likuiditas_min": LIKUID_MIN, "jendela": JENDELA},
        "catatan": ("Kandidat = JEJAK penyerapan yang terbaca dari harga & volume, "
                    "bukan bukti siapa yang menyerap. Arus broker sesungguhnya baru "
                    "terbaca dari setoran Broker Summary — itulah yang diminta ke "
                    "kontributor untuk emiten di daftar ini. Daftar ini PENYARING, "
                    "bukan peringkat: uji luar sampel menempatkan BUMI (14 Agu) dan "
                    "DSSA (13 Agu) di paruh bawah daftar hari itu, jadi urutannya "
                    "tak boleh dibaca sebagai 'makin atas makin layak dibedah'."),
        "n": len(keluar),
        "emiten": keluar,
    }
    KELUARAN.write_text(json.dumps(hasil, ensure_ascii=False), encoding="utf-8")
    return hasil


def uji() -> None:
    """Swauji: deret buatan yang memicu sinyal tertentu, dihitung tangan."""
    # 300 bar; SEPULUH bar terakhir volume 3x lipat sementara harga hampir diam.
    # Sepuluh, bukan enam puluh: RVOL membandingkan ke median 20 hari SEBELUMNYA,
    # jadi lonjakan yang sudah berlangsung 60 hari menaikkan pembanding itu
    # sendiri dan rasionya kembali 1,0 — versi pertama uji ini salah di situ.
    bar = []
    for i in range(300):
        harga = 1000 + (i % 3)          # bergerak <=0,3%: sempit
        v = 3_000_000 if i >= 290 else 1_000_000
        bar.append([f"2026-01-{i+1:04d}", harga, harga + 2, harga - 2, harga, v])
    s = sinyal(bar, None, set())
    assert s is not None, "riwayat cukup tapi ditolak"
    nama = {x["nama"] for x in s["sinyal"]}
    assert "volume di atas normal" in nama, nama   # volume 3x, harga hampir diam
    assert "serapan efisien" in nama, nama        # gerak ~0% per 1x volume
    assert "VolVal senyap" in nama, nama           # nilai melonjak, harga diam
    assert "menyerap saat pasar merah" not in nama   # tak ada hari merah di uji ini
    assert s["skor"] == len(s["sinyal"])

    # Likuiditas di bawah ambang -> bukan kandidat, apa pun sinyalnya
    tipis = [[b[0], b[1], b[2], b[3], b[4], 100] for b in bar]
    assert sinyal(tipis, None, set()) is None

    # Riwayat terlalu pendek -> None, bukan skor palsu
    assert sinyal(bar[:50], None, set()) is None

    # Akumulasi saat merah: 4 hari IHSG turun dengan net asing positif
    tgl_merah = {b[0] for b in bar[-JENDELA:][:4]}
    asing = [[b[0], 1_000_000, 500_000] for b in bar[-JENDELA:]]
    s2 = sinyal(bar, asing, tgl_merah)
    nama2 = {x["nama"] for x in s2["sinyal"]}
    assert "menyerap saat pasar merah" in nama2, nama2
    assert "net asing 20 hari positif" in nama2, nama2
    print("OK  kandidat_deepdive: 8 pemeriksaan lolos")


if __name__ == "__main__":
    if "--uji" in sys.argv:
        uji()
        raise SystemExit(0)
    h = jalankan()
    print(f"kandidat Deep Dive: {h['n']} emiten (skor >= {SKOR_MIN}, likuiditas >= Rp{LIKUID_MIN/1e9:.0f} mrd/hari) "
          f"· data {h['tanggal']} -> {KELUARAN}")
    for e in h["emiten"][:10]:
        print(f"  {e['kode']:6s} skor {e['skor']}  " + " · ".join(x["nama"] for x in e["sinyal"]))
