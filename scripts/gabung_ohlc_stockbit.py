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


def endus_bimodal(baris: list[list]) -> int:
    """Berapa bar yang harganya >100x MEDIAN riwayat emiten ini.

    Pagar spike di atas menangani lonjakan yang KEMBALI. Ada kerusakan lain
    yang tak tertangani olehnya dan sengaja TIDAK ditambal di sini: harga
    yang BOLAK-BALIK antara dua level ratusan kali lipat selama bertahun-
    tahun. BCIC: 2.065 dari 6.406 bar berselang-seling 560 <-> 5.500.000
    sepanjang 2006-2010 -- median jendela jadi campuran, jadi pagar spike tak
    bisa memutuskan mana yang sah.

    Membuang 32% riwayat satu emiten adalah keputusan pemilik data, bukan
    keputusan skrip. Fungsi ini hanya MENGHITUNG dan pemanggilnya MELAPOR,
    supaya kerusakan yang tak bisa ditambal otomatis tetap terlihat tiap
    panen alih-alih tenggelam.
    """
    harga = [float(b[4]) for b in baris if b[4]]
    if len(harga) < 50:
        return 0
    s = sorted(harga)
    med = s[len(s) // 2]
    if med <= 0:
        return 0
    return sum(1 for h in harga if h > med * 100)


def gabung(bar_yahoo: list[list], peta_sb: dict[str, list]) -> tuple[list[list], dict]:
    hasil: dict[str, list] = {r[0]: list(r) for r in bar_yahoo}
    lama = set(hasil)
    for tgl, b in peta_sb.items():
        hasil[tgl] = list(b)
    baris = [hasil[t] for t in sorted(hasil)]
    baris, dibuang = buang_lompatan_mustahil(baris)
    return baris, {
        "sebelum": len(bar_yahoo),
        "sesudah": len(baris),
        "tambahan": len(baris) - len(bar_yahoo),
        "hanya_yahoo": len(lama - set(peta_sb)),
        "bar_mustahil": len(dibuang),
        "tgl_mustahil": dibuang[:5],
        "bar_bimodal": endus_bimodal(baris),
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

    n_tulis = n_lewat = 0
    tot_sebelum = tot_sesudah = tot_hanya_yahoo = 0
    terpanjang: list[tuple[int, str]] = []
    tot_mustahil = 0
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
        baris, st = gabung(oh["d"], peta)
        tot_sebelum += st["sebelum"]
        tot_sesudah += st["sesudah"]
        tot_hanya_yahoo += st["hanya_yahoo"]
        if st["tambahan"]:
            terpanjang.append((st["tambahan"], kode))
        tot_mustahil += st["bar_mustahil"]
        if st["bar_bimodal"]:
            rusak_berat.append((kode, st["bar_bimodal"], st["sesudah"]))
        if not a.kering:
            oh["d"] = baris
            oh["n"] = len(baris)
            oh["mulai"] = baris[0][0]
            oh["akhir"] = baris[-1][0]
            oh["sumber"] = "Stockbit chartbit (utama) + Yahoo (hari yang tak ada di Stockbit)"
            p_out.write_text(json.dumps(oh, ensure_ascii=False, separators=(",", ":")),
                             encoding="utf-8")
        n_tulis += 1

    terpanjang.sort(reverse=True)
    print(f"emiten diproses      : {n_tulis:,}   (dilewati {n_lewat})")
    print(f"bar sebelum          : {tot_sebelum:,}")
    print(f"bar sesudah          : {tot_sesudah:,}  (+{tot_sesudah - tot_sebelum:,})")
    print(f"bar hanya ada di Yahoo (diselamatkan): {tot_hanya_yahoo:,}")
    print("tambahan terbanyak   : " + ", ".join(f"{k} +{n:,}" for n, k in terpanjang[:8]))
    if tot_mustahil:
        print(f"bar rusak dibuang    : {tot_mustahil:,} (lonjakan yang kembali ke level semula)")
    if rusak_berat:
        # Dilaporkan, TIDAK ditambal — lihat docstring endus_bimodal().
        print()
        print("!! KERUSAKAN SISTEMIK yang TIDAK ditambal (keputusan pemilik data):")
        for k, n, m in sorted(rusak_berat, key=lambda x: -x[1])[:10]:
            print(f"   {k}: {n:,} dari {m:,} bar berharga >100x median riwayatnya")
    if a.kering:
        print("\n(kering — tidak menulis)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
