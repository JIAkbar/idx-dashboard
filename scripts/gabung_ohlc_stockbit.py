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


def gabung(bar_yahoo: list[list], peta_sb: dict[str, list]) -> tuple[list[list], dict]:
    hasil: dict[str, list] = {r[0]: list(r) for r in bar_yahoo}
    lama = set(hasil)
    for tgl, b in peta_sb.items():
        hasil[tgl] = list(b)
    baris = [hasil[t] for t in sorted(hasil)]
    return baris, {
        "sebelum": len(bar_yahoo),
        "sesudah": len(baris),
        "tambahan": len(baris) - len(bar_yahoo),
        "hanya_yahoo": len(lama - set(peta_sb)),
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
    print("swauji OK — 5/5 assert lulus")
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
    if a.kering:
        print("\n(kering — tidak menulis)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
