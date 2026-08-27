"""Jahit IHSG: kerangka Yahoo (1990→) + volume Stockbit (2000→).

Kenapa dijahit, bukan pilih salah satu — keduanya punya bagian yang tak dimiliki
yang lain, terukur 23 Agu 2026:

    Yahoo    : 8.853 bar sejak 1990-04-06, tapi 1.268 bar volumenya 0
               (termasuk hari-hari terbaru — Yahoo tak melaporkan volume indeks)
    Stockbit : 7.050 bar sejak 1997-07-01, hanya 1 bar volume 0

ANGKA STOCKBIT DI ATAS SUDAH DIKOREKSI (23 Agu 2026). Versi pertama catatan ini
menulis "6.426 bar sejak 2000-01-04" — itu hasil tarikan saat TO_TERLAMA masih
"2000-01-01", batas yang kita pasang sendiri dan tak pernah diuji. Sesudah
diturunkan ke 1980, Stockbit menjawab sampai 1997-07-01. Catatan yang basi
sempat membuat sesi lain mengira jahitan ini memakai Yahoo sampai 1999 padahal
tidak: terukur atas berkas yang sekarang, dari 1.811 bar milik Yahoo saja,
1.773 ada SEBELUM 1997-07-01 dan hanya 38 sesudahnya (semuanya Juli 2001, hari
bursa yang Stockbit memang tak punya).

Volume Stockbit terbukti sahih lewat wasit independen: jumlah volume 962 emiten
pada 21 Agu 2026 = 37.826.904.800 sementara IHSG Stockbit = 39.161.460.400,
rasio 1,0353 (selisihnya emiten yang belum ikut dipanen). Yahoo untuk hari yang
sama: 0.

JEBAKAN yang hampir membuat data hilang: potong-tempel di 2000-01-04 (Yahoo
sebelum, Stockbit sesudah) MENGHILANGKAN 38 hari bursa yang ada di Yahoo tapi
tak ada di Stockbit — dan bar-bar itu bervolume nyata (2001-07-24: 22.755.300).
Karena itu penggabungannya UNION per tanggal, bukan pemotongan:

    tanggal ada di Stockbit  -> pakai Stockbit (harga + volume, satuan lembar)
    tanggal hanya di Yahoo   -> pakai Yahoo, volumenya dikali 100 (lihat
                                LOT_KE_LEMBAR — Yahoo melapor dalam lot)

Hasilnya lebih banyak dari kedua sumber: 8.858 bar.

Berjangkar pada dua sumber terpisah (`ohlc/IHSG.json` cadangan +
`ohlcv_stockbit/IHSG.json`), jadi idempoten dan bisa dibatalkan — aturan proyek
soal penambal yang menimpa sumbernya sendiri.

Pakai:
  python scripts/jahit_ihsg.py --kering    # hitung saja, TIDAK menulis
  python scripts/jahit_ihsg.py             # tulis (cadangan dulu)
  python scripts/jahit_ihsg.py --swauji
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
P_OHLC = AKAR / "data-idx" / "json" / "ohlc" / "IHSG.json"
P_SB = AKAR / "data-idx" / "json" / "ohlcv_stockbit" / "IHSG.json"
DIR_CADANGAN = AKAR / "_arsip-mentah" / "ihsg-sebelum-jahit"


def baca(p: Path) -> dict | None:
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def peta_stockbit(sb: dict) -> dict[str, list]:
    """tanggal -> [tgl, open, high, low, close, volume] dari berkas Stockbit."""
    kolom = sb.get("kolom") or []
    try:
        i = {k: kolom.index(k) for k in
             ("tanggal", "open", "high", "low", "close", "volume")}
    except ValueError:
        return {}
    out: dict[str, list] = {}
    for b in sb.get("bar") or []:
        out[b[i["tanggal"]]] = [
            b[i["tanggal"]], b[i["open"]], b[i["high"]],
            b[i["low"]], b[i["close"]], b[i["volume"]],
        ]
    return out


# Yahoo melaporkan volume IHSG dalam LOT, Stockbit dalam LEMBAR — terukur
# 23 Agu 2026 atas 6.412 bar yang tumpang tindih: rasio Stockbit/Yahoo median
# tepat 100,00 (p10 97,55 · p90 116,65). Tanpa penyeragaman ini grafik volume
# IHSG melompat 100x di 2000-01-04, tepat di sambungan — cacat yang tak
# terlihat dari bar mana pun secara sendiri-sendiri.
LOT_KE_LEMBAR = 100


def jahit(bar_yahoo: list[list], peta_sb: dict[str, list]) -> tuple[list[list], dict]:
    """UNION per tanggal — Stockbit menang kalau ada, Yahoo mengisi sisanya.

    Bar yang datang dari Yahoo volumenya dikali 100 supaya satu satuan
    (lembar) berlaku sepanjang deret.
    """
    hasil: dict[str, list] = {}
    dari_yahoo = dari_sb = 0
    for r in bar_yahoo:
        b = list(r)
        b[5] = (b[5] or 0) * LOT_KE_LEMBAR
        hasil[r[0]] = b
        dari_yahoo += 1
    for tgl, b in peta_sb.items():
        if tgl in hasil:
            dari_yahoo -= 1
        hasil[tgl] = list(b)
        dari_sb += 1
    baris = [hasil[t] for t in sorted(hasil)]
    nol_sebelum = sum(1 for r in bar_yahoo if r[5] == 0)
    nol_sesudah = sum(1 for r in baris if r[5] == 0)
    stat = {
        "bar_sebelum": len(bar_yahoo), "bar_sesudah": len(baris),
        "dari_stockbit": dari_sb, "hanya_yahoo": dari_yahoo,
        "volume_nol_sebelum": nol_sebelum, "volume_nol_sesudah": nol_sesudah,
    }
    return baris, stat


def swauji() -> int:
    y = [["1999-12-30", 1, 2, 0.5, 1.5, 0],
         ["2000-01-04", 10, 12, 9, 11, 0],
         ["2001-07-24", 20, 22, 19, 21, 22755300]]  # hanya ada di Yahoo
    sb = {"2000-01-04": ["2000-01-04", 10, 12, 9, 11, 1125350016]}
    baris, st = jahit(y, sb)
    assert len(baris) == 3, "union tak boleh menghilangkan bar"
    assert baris[1][5] == 1125350016, "volume Stockbit harus menang"
    assert baris[2][5] == 22755300 * 100, "bar Yahoo wajib bertahan DAN diseragamkan ke lembar"
    assert st["volume_nol_sebelum"] == 2 and st["volume_nol_sesudah"] == 1
    # idempoten diuji dari SUMBER yang sama, bukan dari hasil — menjahit ulang
    # keluaran akan mengali 100 lagi, dan itu memang benar: jangkarnya sumber.
    ulang, _ = jahit(y, sb)
    assert ulang == baris, "jahit dari sumber yang sama harus menghasilkan sama"
    print("swauji OK — 5/5 assert lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Jahit IHSG Yahoo + volume Stockbit")
    ap.add_argument("--kering", action="store_true", help="hitung saja, tidak menulis")
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()

    oh = baca(P_OHLC)
    sb = baca(P_SB)
    if not oh or not sb:
        raise SystemExit("IHSG.json (ohlc/ atau ohlcv_stockbit/) tak terbaca")

    peta = peta_stockbit(sb)
    if not peta:
        raise SystemExit("kolom Stockbit tak dikenali")

    baris, st = jahit(oh.get("d") or [], peta)
    print(f"bar sebelum          : {st['bar_sebelum']:,}")
    print(f"bar sesudah          : {st['bar_sesudah']:,}  (+{st['bar_sesudah']-st['bar_sebelum']})")
    print(f"  dari Stockbit      : {st['dari_stockbit']:,}")
    print(f"  hanya ada di Yahoo : {st['hanya_yahoo']:,}  <- inilah yang hilang kalau dipotong-tempel")
    print(f"volume 0 sebelum     : {st['volume_nol_sebelum']:,}")
    print(f"volume 0 sesudah     : {st['volume_nol_sesudah']:,}")
    if a.kering:
        print("\n(kering — tidak menulis)")
        return 0

    DIR_CADANGAN.mkdir(parents=True, exist_ok=True)
    shutil.copy2(P_OHLC, DIR_CADANGAN / "IHSG.json")
    oh["d"] = baris
    oh["n"] = len(baris)
    oh["mulai"] = baris[0][0]
    oh["akhir"] = baris[-1][0]
    oh["sumber"] = "Yahoo (kerangka 1990-1999) + Stockbit chartbit (harga & volume 2000->)"
    P_OHLC.write_text(json.dumps(oh, ensure_ascii=False, separators=(",", ":")),
                      encoding="utf-8")
    # Ringkas 250 bar ikut ditulis DI SINI (temuan Johan 27 Agu: caption chart
    # YTD Beranda macet di tanggal Yahoo) — sebelum ini ihsg_ohlc_ringkas.json
    # hanya lahir dari panen_ihsg (gudang Yahoo), jadi SELALU ikut telatnya
    # Yahoo walau hasil jahitan sudah lebih baru. Penulis TERAKHIR gabunganlah
    # yang berhak menulis ringkasnya.
    p_ringkas = P_OHLC.parent.parent / "ihsg_ohlc_ringkas.json"
    ekor = [b[:6] for b in baris[-250:]]
    p_ringkas.write_text(json.dumps({
        "kode": "IHSG", "mulai": ekor[0][0], "akhir": ekor[-1][0],
        "n": len(ekor), "d": ekor,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nDitulis: {P_OHLC}")
    print(f"Ringkas: {p_ringkas} ({ekor[0][0]} .. {ekor[-1][0]})")
    print(f"Cadangan: {DIR_CADANGAN / 'IHSG.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
