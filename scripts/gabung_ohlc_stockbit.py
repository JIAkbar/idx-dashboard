"""Jadikan `data-idx/json/ohlc/` lengkap: riwayat penuh Stockbit + sisa Yahoo.

Johan 23 Agu 2026: *"kalau mau saya yang lengkap saja dari sumber yang lengkap
juga"*.

Sebelum ini `ohlc/` hanya ditukar VOLUME-nya (`ganti_volume_ohlc.py`), rentang
tanggalnya tetap milik Yahoo. Skrip ini melangkah lebih jauh: menggabungkan
seluruh riwayat kedua sumber per tanggal.

    tanggal ada di Stockbit  -> pakai Stockbit (o/h/l/c/v)
    tanggal hanya di Yahoo   -> pakai Yahoo apa adanya

Kenapa union, bukan "pakai Stockbit saja": Yahoo memuat hari bursa yang tak ada
di Stockbit (pada IHSG terukur 38 hari, semuanya bervolume nyata). Membuang
Yahoo berarti membuang hari-hari itu.

Kenapa TIDAK ada penyeragaman satuan di sini, padahal `jahit_ihsg.py` punya:
untuk EMITEN rasio volume Stockbit/Yahoo terukur median 1,0000 dengan p10 dan
p90 juga 1,0000 atas 345.454 bar — satuannya memang sama (lembar). Yang berbeda
satuan hanya INDEKS (Yahoo melapor IHSG dalam lot), dan indeks diurus
`jahit_ihsg.py` sendiri. Karena itu skrip ini MELEWATI IHSG.

Berjangkar pada dua sumber terpisah — cadangan Yahoo asli di
`_arsip-mentah/ohlc-yahoo-sebelum-ganti-volume/` dan `ohlcv_stockbit/` — jadi
idempoten dan bisa dibatalkan. Aturan proyek: penambal yang menimpa sumbernya
sendiri tak bisa dicabut.

Pakai:
  python scripts/gabung_ohlc_stockbit.py --kering
  python scripts/gabung_ohlc_stockbit.py
  python scripts/gabung_ohlc_stockbit.py --swauji
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DIR_OHLC = AKAR / "data-idx" / "json" / "ohlc"
DIR_SB = AKAR / "data-idx" / "json" / "ohlcv_stockbit"
DIR_YAHOO = AKAR / "_arsip-mentah" / "ohlc-yahoo-sebelum-ganti-volume"

# Diurus jahit_ihsg.py — satuan volumenya beda (Yahoo lot, Stockbit lembar).
LEWATI = {"IHSG"}


def baca(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def peta_stockbit(sb: dict) -> dict[str, list]:
    kolom = sb.get("kolom") or []
    try:
        i = {k: kolom.index(k) for k in
             ("tanggal", "open", "high", "low", "close", "volume")}
    except ValueError:
        return {}
    return {
        b[i["tanggal"]]: [b[i["tanggal"]], b[i["open"]], b[i["high"]],
                          b[i["low"]], b[i["close"]], b[i["volume"]]]
        for b in sb.get("bar") or []
    }


# Lompatan harga sehari yang MUSTAHIL menurut aturan bursa. Batas ARA/ARB
# harian IDX paling longgar pun jauh di bawah 100%, jadi >300% cuma punya dua
# sebab — dan MEMBEDAKANNYA adalah seluruh inti fungsi di bawah:
#
#   (a) BAR RUSAK dari hulu — harga melonjak lalu KEMBALI ke level semula.
#       BCIC 2006-07-11: close 560 -> 5.500.000 (volume 26 lot) selama
#       beberapa hari, lalu balik 560. Terbukti ada di `ohlcv_stockbit/`
#       sendiri, bukan lahir dari penggabungan ini.
#   (b) REVERSE SPLIT yang tak tersesuaikan — harga melonjak lalu MENETAP.
#       BNLI 2004-06-08: 24 -> 518 dan tak pernah kembali. Ini angka SAH.
#
# Versi pertama pagar ini cuma mengukur besar lompatan, dan itu SALAH TOTAL:
# diukur sebelum dijalankan, ia akan membuang 93-98% riwayat BNGA, BNLI,
# SIPD, APIC — seluruh bar sesudah titik reverse split, karena tiap bar
# dibandingkan dengan bar sah terakhir yang tertinggal di level lama.
# 28.588 bar dari 33 emiten akan lenyap tanpa satu pun galat. Pengukuran
# sebelum-jalan itu yang menyelamatkannya, bukan review kode.
MAKS_LOMPATAN = 3.0
# Berapa bar sesudah lompatan yang dipakai memutuskan (a) atau (b).
JENDELA_PERIKSA = 20
# Level dianggap "kembali" bila median jendela itu lebih dekat ke level LAMA
# daripada ke level baru, dengan margin ini.
AMBANG_KEMBALI = 0.5
# Hari bursa dianggap sah bila SEKIAN emiten Stockbit punya bar di tanggal itu.
# 30 dari ~960: cukup rendah untuk memasukkan hari sepi, cukup tinggi untuk
# menolak tanggal yang cuma dimiliki segelintir berkas (bar hantu hari libur).
MIN_EMITEN_HARI_BURSA = 30
# Di atas harga ini, satu lembar saham praktis mustahil di IDX — hampir pasti
# nominal lama yang tak tersesuaikan. DILAPORKAN, tidak ditambal.
HARGA_MUSTAHIL = 1_000_000
# Beku selama ini (hari bursa berturut, close tak bergerak) baru layak
# dilaporkan. Ambang 200 dicoba lebih dulu dan MEMBANJIR — belasan emiten
# muncul cuma karena suspensi 1-2 tahun, yang di IDX biasa saja; laporan yang
# membanjir sama saja dengan laporan yang diabaikan. 1.500 hari bursa ~ enam
# tahun: cukup luar biasa untuk pantas dilihat manusia.
BEKU_LAYAK_LAPOR = 1500


def _median(v: list[float]) -> float:
    s = sorted(v)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def buang_lompatan_mustahil(baris: list[list]) -> tuple[list[list], list[str]]:
    """Buang bar RUSAK (lonjakan yang kembali), pertahankan reverse split.

    Untuk tiap lompatan >MAKS_LOMPATAN pada bar i, lihat ke mana level
    menetap sesudahnya: kalau median JENDELA_PERIKSA bar berikutnya lebih
    dekat ke level SEBELUM lompatan, seluruh sisipan itu bar rusak dan
    dibuang; kalau menetap di level baru, itu aksi korporasi dan
    DIPERTAHANKAN apa adanya.
    """
    if len(baris) < 3:
        return baris, []
    keluar: list[list] = [baris[0]]
    dibuang: list[str] = []
    i = 1
    while i < len(baris):
        b = baris[i]
        c0, c1 = keluar[-1][4], b[4]
        try:
            lompat = c0 and c1 and abs(float(c1) / float(c0) - 1) > MAKS_LOMPATAN
        except (TypeError, ValueError, ZeroDivisionError):
            lompat = False
        if not lompat:
            keluar.append(b)
            i += 1
            continue

        # Ke mana level menetap? Median bar-bar sesudah titik lompatan.
        # Jendela dimulai dari i+1: bar yang sedang DIADILI tak boleh ikut
        # menentukan vonisnya sendiri. Versi pertama memasukkannya, dan
        # median jadi tertarik ke nilai rusak sehingga spike terbaca sebagai
        # "level baru" dan lolos — swauji yang menangkapnya.
        depan = [float(x[4]) for x in baris[i + 1:i + 1 + JENDELA_PERIKSA] if x[4]]
        if not depan:
            keluar.append(b)
            i += 1
            continue
        med = _median(depan)
        lama, baru_ = float(c0), float(c1)
        jarak_lama = abs(med / lama - 1) if lama else 9e9
        jarak_baru = abs(med / baru_ - 1) if baru_ else 9e9

        if jarak_baru <= jarak_lama + AMBANG_KEMBALI:
            # Menetap di level baru -> aksi korporasi. Pertahankan, dan
            # jadikan bar ini acuan berikutnya supaya sisa riwayat aman.
            keluar.append(b)
            i += 1
            continue

        # Kembali ke level lama -> rusak. Buang bar ini dan lanjutannya
        # selama masih jauh dari level lama.
        while i < len(baris):
            cx = baris[i][4]
            try:
                masih = cx and abs(float(cx) / lama - 1) > MAKS_LOMPATAN
            except (TypeError, ValueError, ZeroDivisionError):
                masih = False
            if not masih:
                break
            dibuang.append(baris[i][0])
            i += 1
    return keluar, dibuang


def kalender_bursa(dir_sb: Path) -> tuple[set[str], str]:
    """Himpunan hari bursa + tanggal termuda, dibangun dari arsip Stockbit.

    KENAPA ADA: Yahoo menciptakan bar di HARI LIBUR BURSA dengan harga
    carry-forward, dan penggabungan ini menyisipkannya ke `ohlc/` karena
    "Stockbit tak punya hari itu". Terukur 28 Agu 2026: 29.970 bar hantu di
    914 emiten — 385 emiten sekaligus punya bar 2026-05-14, dan tanggal
    lain yang menumpuk semuanya libur nasional (2019-04-17 Pemilu,
    2019-05-01 Hari Buruh, 2019-05-30 Kenaikan Isa).

    Bar hantu itu bukan cuma mubazir: harganya berskala Yahoo sementara
    tetangganya berskala Stockbit, jadi ia melahirkan PATAHAN PALSU yang
    terbaca seperti aksi korporasi. FISH 2017-01-02 tercatat 4.000 di antara
    360 dan 480 — dan sempat kudiagnosis sebagai "bar rusak dari hulu"
    padahal Stockbit tak pernah punya tanggal itu sama sekali.

    Kalendernya dibangun dari data, bukan daftar libur yang harus dirawat
    tangan: hari yang dimiliki >=MIN_EMITEN_HARI_BURSA emiten adalah hari
    bursa. Libur nasional otomatis absen karena tak seorang pun berdagang.
    """
    hitung: dict[str, int] = {}
    termuda = "9999-99-99"
    for p_sb in dir_sb.glob("*.json"):
        if p_sb.stem.startswith("_"):
            continue
        try:
            bar = json.loads(p_sb.read_text(encoding="utf-8")).get("bar") or []
        except (json.JSONDecodeError, OSError):
            continue
        for b in bar:
            hitung[b[0]] = hitung.get(b[0], 0) + 1
        if bar and bar[0][0] < termuda:
            termuda = bar[0][0]
    return {t for t, n in hitung.items() if n >= MIN_EMITEN_HARI_BURSA}, termuda



def endus_anomali(baris: list[list]) -> dict:
    """Laporkan ANOMALI riwayat harga — dan sebutkan JENISnya, jangan memvonis.

    Versi pertama fungsi ini (`endus_bimodal`) menghitung bar yang harganya
    >100x median seumur hidup dan melaporkannya sebagai "kerusakan sistemik".
    Itu SALAH, dan hampir berujung menimpa data yang benar:

    - MLPT tertandai 23 bar "rusak"; dibandingkan ke cadangan Yahoo, arsip
      kita 5.250 dan Yahoo 5.241 — arsipnya BENAR. Yang salah pengendusnya:
      emiten yang harganya memang melonjak ratusan kali (median seumur hidup
      45, harga kini 5.250) selalu tertandai.
    - BCIC tertandai 2.065 bar. Diperiksa per tahun: 2000-2008 berharga 6-35
      JUTA per lembar, 2009-2020 tepat 560 selama 12 tahun, 2021+ normal
      78-965. Itu bukan bar acak melainkan riwayat emiten yang kolaps lalu
      disuspensi bertahun-tahun lalu relisting — pola yang butuh mata manusia,
      bukan ambang.

    Jadi fungsi ini sekarang MELAPORKAN dua jenis anomali apa adanya dan tak
    menyebut satu pun "rusak":

    - `harga_ekstrem`: bar di atas HARGA_MUSTAHIL. Batas atas fraksi IDX jauh
      di bawah ini; harga sebesar itu hampir pasti nominal lama yang tak
      tersesuaikan, tapi keputusannya tetap milik pemilik data.
    - `beku_terpanjang`: berapa hari BERTURUT closenya tak bergerak sama
      sekali. Suspensi panjang sah dan sering; angkanya dilaporkan supaya
      terlihat, bukan supaya dibuang.
    """
    harga = [(b[0], float(b[4])) for b in baris if b[4]]
    if len(harga) < 50:
        return {"harga_ekstrem": 0, "beku_terpanjang": 0}

    ekstrem = sum(1 for _, h in harga if h > HARGA_MUSTAHIL)

    beku = terpanjang = 1
    for i in range(1, len(harga)):
        if harga[i][1] == harga[i - 1][1]:
            beku += 1
            terpanjang = max(terpanjang, beku)
        else:
            beku = 1
    return {"harga_ekstrem": ekstrem, "beku_terpanjang": terpanjang if terpanjang > 1 else 0}


def rentang_sumber(baris: list[list], peta_sb: dict[str, list]) -> list[list]:
    """Penanda sumber PER BAR, disimpan sebagai rentang beruntun.

    Keputusan Johan 5 Sep 2026: *"pakai penanda sumber per bar, riwayat lama
    jangan dipotong"*. Sebelum ini berkas hanya membawa satu kalimat `sumber`
    untuk SELURUH deret, jadi tujuh pembaca di antarmuka — termasuk
    rekomendasi dan win rate — tak bisa tahu bar mana berasal dari mana.

    Disimpan sebagai rentang, bukan satu bendera per baris, dan itu bukan
    penyederhanaan: sumbernya datang dalam blok beruntun (riwayat tua hanya
    ada di cadangan, hari-hari baru selalu di sumber utama), jadi rentang
    menjawab pertanyaan per-bar dengan tepat sambil menambah beberapa puluh
    bita alih-alih ribuan. Bar yang tanggalnya ada di sumber utama SELALU
    dimenangkan sumber utama (lihat `gabung`), jadi penandanya diturunkan
    dari keputusan yang sama — bukan ditebak ulang.

    Bentuk: [[dari, sampai, kode]] dengan kode "sb" (utama) atau "yh"
    (cadangan). Pembacanya: `sumberBar()` di `lib/dasbor/sumberBar.ts`.
    """
    return padatkan_rentang(baris, lambda tgl: "sb" if tgl in peta_sb else "yh")


def padatkan_rentang(baris: list[list], kode_untuk) -> list[list]:
    """Padatkan kode per bar jadi rentang beruntun [[dari, sampai, kode]].

    Dipisah dari `rentang_sumber` supaya penulis LAIN arsip harga bisa memakai
    pemadatan yang sama tanpa menyalin ulang. Arsip `ohlc/` punya lebih dari
    satu penulis di rantai yang tak bisa diurutkan satu sama lain — pemanen
    dijalankan CI di awan, penggabung dan penjahit dijalankan panen lokal —
    dan tiap penulis wajib menyatakan kebenaran tentang apa yang IA tulis.

    Terukur 5 Sep 2026 kenapa ini perlu: CI menulis `ohlc/IHSG.json` sesudah
    penjahit, dari nol dengan lima ruas saja, dan penanda 26 blok (1.811 bar
    cadangan) terhapus tanpa satu pun galat.

    `kode_untuk(tanggal) -> "sb" | "yh"`.
    """
    out: list[list] = []
    for b in baris:
        tgl = b[0]
        kode = kode_untuk(tgl)
        if out and out[-1][2] == kode:
            out[-1][1] = tgl
        else:
            out.append([tgl, tgl, kode])
    return out


def gabung(bar_yahoo: list[list], peta_sb: dict[str, list],
           hari_bursa: set[str] | None = None, sejak: str | None = None) -> tuple[list[list], dict]:
    hasil: dict[str, list] = {r[0]: list(r) for r in bar_yahoo}
    lama = set(hasil)
    for tgl, b in peta_sb.items():
        hasil[tgl] = list(b)
    # Bar Yahoo yang jatuh DI DALAM jangkauan Stockbit tapi bukan hari
    # bursa = bar hantu hari libur. Di luar jangkauan Stockbit (riwayat
    # tua) Yahoo satu-satunya sumber, jadi tak disaring di sana.
    hantu = 0
    if hari_bursa and sejak:
        buang = [t for t in hasil
                 if t >= sejak and t not in peta_sb and t not in hari_bursa]
        for t in buang:
            del hasil[t]
        hantu = len(buang)
    baris = [hasil[t] for t in sorted(hasil)]
    baris, dibuang = buang_lompatan_mustahil(baris)
    return baris, {
        "sumber_bar": rentang_sumber(baris, peta_sb),
        "sebelum": len(bar_yahoo),
        "sesudah": len(baris),
        "tambahan": len(baris) - len(bar_yahoo),
        "hanya_yahoo": len(lama - set(peta_sb)),
        "bar_mustahil": len(dibuang),
        "tgl_mustahil": dibuang[:5],
        "anomali": endus_anomali(baris),
        "bar_hantu": hantu,
    }


def swauji() -> int:
    y = [["2016-08-10", 1, 2, 1, 2, 100], ["2016-08-11", 2, 3, 2, 3, 200]]
    sb = {"2004-01-02": ["2004-01-02", 9, 9, 9, 9, 50],
          "2016-08-10": ["2016-08-10", 1, 2, 1, 2, 111]}
    baris, st = gabung(y, sb)
    assert [r[0] for r in baris] == ["2004-01-02", "2016-08-10", "2016-08-11"]
    assert baris[1][5] == 111, "Stockbit menang di tanggal yang tumpang tindih"
    assert baris[2][5] == 200, "bar yang hanya ada di Yahoo wajib bertahan"
    assert st["tambahan"] == 1 and st["hanya_yahoo"] == 1
    ulang, _ = gabung(y, sb)
    assert ulang == baris, "gabung dari sumber sama harus idempoten"

    # Penanda sumber per bar (Johan 5 Sep 2026) — rentang beruntun, dan
    # yang diuji bukan cuma bentuknya melainkan KEBENARANNYA: tiap bar
    # harus menjawab sumber yang sama dengan aturan `gabung` (tanggal yang
    # ada di sumber utama selalu dimenangkan sumber utama).
    rs = st["sumber_bar"]
    assert rs == [["2004-01-02", "2016-08-10", "sb"], ["2016-08-11", "2016-08-11", "yh"]], rs
    for b in baris:
        cocok = [r for r in rs if r[0] <= b[0] <= r[1]]
        assert len(cocok) == 1, f"bar {b[0]} harus jatuh di TEPAT satu rentang"
        assert cocok[0][2] == ("sb" if b[0] in sb else "yh"), f"sumber {b[0]} salah"
    # deret satu sumber = satu rentang, bukan satu per bar
    hy, _ = gabung(y, {})
    assert _["sumber_bar"] == [["2016-08-10", "2016-08-11", "yh"]], _["sumber_bar"]
    # deret kosong tak meledak
    assert gabung([], {})[1]["sumber_bar"] == []

    # Pagar bar mustahil (28 Agu 2026): bar 5.500.000 di tengah deret 560
    # WAJIB terbuang, dan bar sehat sesudahnya WAJIB bertahan — pembanding
    # memakai bar sah terakhir, bukan bar rusak.
    rusak = [["2006-07-10", 560, 560, 560, 560, 181],
             ["2006-07-11", 5500000, 5500000, 5000000, 5500000, 26],
             ["2006-07-12", 560, 560, 560, 560, 13]]
    bersih, dibuang = buang_lompatan_mustahil(rusak)
    assert [r[0] for r in bersih] == ["2006-07-10", "2006-07-12"], bersih
    assert dibuang == ["2006-07-11"], dibuang
    # Gerak besar yang MASIH mungkin (ARA beruntun, +250%) tak boleh terbuang.
    wajar = [["2020-01-02", 100, 100, 100, 100, 1], ["2020-01-03", 350, 350, 350, 350, 1]]
    assert buang_lompatan_mustahil(wajar)[1] == [], "gerak 250% bukan bar rusak"
    print("swauji OK — 8/8 assert lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Gabung ohlc/ dengan riwayat penuh Stockbit")
    ap.add_argument("--kering", action="store_true")
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()
    if not DIR_YAHOO.exists():
        raise SystemExit(f"cadangan Yahoo tak ada: {DIR_YAHOO}")

    hari_bursa, _termuda = kalender_bursa(DIR_SB)
    print(f"kalender bursa       : {len(hari_bursa):,} hari (>= {MIN_EMITEN_HARI_BURSA} emiten/hari)")

    n_tulis = n_lewat = 0
    tot_sebelum = tot_sesudah = tot_hanya_yahoo = 0
    terpanjang: list[tuple[int, str]] = []
    tot_mustahil = 0
    tot_hantu = 0
    rusak_berat: list[tuple[str, int, int]] = []
    for p_sb in sorted(DIR_SB.glob("*.json")):
        kode = p_sb.stem
        if kode in LEWATI:
            n_lewat += 1
            continue
        p_y = DIR_YAHOO / f"{kode}.json"
        p_out = DIR_OHLC / f"{kode}.json"
        oh = baca(p_y) or baca(p_out)
        if not oh or not isinstance(oh.get("d"), list):
            n_lewat += 1
            continue
        peta = peta_stockbit(baca(p_sb) or {})
        if not peta:
            n_lewat += 1
            continue
        sejak = min(peta) if peta else None
        baris, st = gabung(oh["d"], peta, hari_bursa, sejak)
        tot_sebelum += st["sebelum"]
        tot_sesudah += st["sesudah"]
        tot_hanya_yahoo += st["hanya_yahoo"]
        if st["tambahan"]:
            terpanjang.append((st["tambahan"], kode))
        tot_mustahil += st["bar_mustahil"]
        tot_hantu += st["bar_hantu"]
        an = st["anomali"]
        if an["harga_ekstrem"] or an["beku_terpanjang"] >= BEKU_LAYAK_LAPOR:
            rusak_berat.append((kode, an, st["sesudah"]))
        if not a.kering:
            oh["d"] = baris
            oh["n"] = len(baris)
            oh["mulai"] = baris[0][0]
            oh["akhir"] = baris[-1][0]
            oh["sumber"] = "Stockbit chartbit (utama) + Yahoo (hari yang tak ada di Stockbit)"
            # Penanda sumber PER BAR (Johan 5 Sep 2026) — rentang beruntun,
            # lihat `rentang_sumber`. Ruas `sumber` di atas tetap ada sebagai
            # kalimat ringkas; yang ini yang bisa ditanyai per tanggal.
            oh["sumber_bar"] = st["sumber_bar"]
            p_out.write_text(json.dumps(oh, ensure_ascii=False, separators=(",", ":")),
                             encoding="utf-8")
        n_tulis += 1

    terpanjang.sort(reverse=True)
    print(f"emiten diproses      : {n_tulis:,}   (dilewati {n_lewat})")
    print(f"bar sebelum          : {tot_sebelum:,}")
    print(f"bar sesudah          : {tot_sesudah:,}  (+{tot_sesudah - tot_sebelum:,})")
    print(f"bar hanya ada di Yahoo (diselamatkan): {tot_hanya_yahoo:,}")
    print("tambahan terbanyak   : " + ", ".join(f"{k} +{n:,}" for n, k in terpanjang[:8]))
    if tot_hantu:
        print(f"bar hantu Yahoo dibuang: {tot_hantu:,} (tanggalnya bukan hari bursa)")
    if tot_mustahil:
        print(f"bar rusak dibuang    : {tot_mustahil:,} (lonjakan yang kembali ke level semula)")
    if rusak_berat:
        # Dilaporkan, TIDAK ditambal — lihat docstring endus_bimodal().
        print()
        print("ANOMALI riwayat harga — DILAPORKAN, tidak ditambal (butuh mata manusia):")
        for k, an, m in sorted(rusak_berat, key=lambda x: -x[1]["harga_ekstrem"])[:12]:
            bag = []
            if an["harga_ekstrem"]:
                bag.append(f"{an['harga_ekstrem']:,} bar di atas Rp {HARGA_MUSTAHIL:,}/lembar")
            if an["beku_terpanjang"] >= BEKU_LAYAK_LAPOR:
                bag.append(f"beku {an['beku_terpanjang']:,} hari berturut")
            print(f"   {k} (dari {m:,} bar): " + "; ".join(bag))
    if a.kering:
        print("\n(kering — tidak menulis)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
