# -*- coding: utf-8 -*-
"""Bangun KERANGKA `edisi/<tanggal>.json` dari OHLC — bagian yang deterministik.

Sampai 20 Agustus 2026 berkas edisi harian dirakit tangan seluruhnya, termasuk
bagian yang sebenarnya cuma hitungan: harga hari itu, EMA50, dan tujuh level
pivot. Mengetik ulang angka yang sudah ada di `data-idx/json/ohlc/` bukan cuma
lambat — ia satu-satunya sumber salah ketik yang tak punya pemeriksa.

Yang TIDAK dikerjakan di sini, dan memang tak boleh: blok `beli`/`jual`
(datang dari screenshot Broker Summary kontributor, disalin lewat
`transkrip_orderbook.py`) serta seluruh narasi. Keduanya penilaian, bukan
turunan angka.

    python arus-pasar/kerangka_edisi.py 2026-08-20 AMMN ARCI BIPI ...
    python arus-pasar/kerangka_edisi.py --uji   # regresi ke edisi yang sudah terbit

Rumus pivotnya diverifikasi dengan cara yang tak bisa dibantah: dihitung ulang
untuk seluruh emiten di edisi 18 & 19 Agustus yang sudah TERBIT, lalu
dibandingkan angka-per-angka dengan yang tercetak di sana (`--uji`). Kalau
kelak rumusnya diganti tanpa sengaja, uji itu yang berbunyi.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
OHLC = AKAR / "data-idx" / "json" / "ohlc"
EDISI = AKAR / "arus-pasar" / "edisi"


def baris_ohlc(kode: str) -> list:
    return json.loads((OHLC / f"{kode}.json").read_text(encoding="utf-8"))["d"]


def ema(nilai: list[float], periode: int) -> float | None:
    """EMA baku, disemai rata-rata `periode` nilai pertama. None kalau deretnya
    lebih pendek dari periodenya — nol lebih buruk daripada tak ada."""
    if len(nilai) < periode:
        return None
    e = sum(nilai[:periode]) / periode
    k = 2 / (periode + 1)
    for v in nilai[periode:]:
        e = v * k + e * (1 - k)
    return e


# Fraksi harga IDX — disalin nilainya dari `app/src/lib/fraksiHarga.ts` supaya
# angka di PDF dan angka di layar tak pernah berbeda. Titik batasnya yang
# paling sering salah: pada Rp 500-2.000 fraksinya Rp 5, dan Rp 2.001 baru
# Rp 10.
FRAKSI = ((200, 1), (500, 2), (2000, 5), (5000, 10), (float("inf"), 25))


def ke_fraksi(x: float) -> int:
    """Bulatkan ke tick terdekat yang sah di bursa.

    Level pivot yang tidak dibulatkan begini menghasilkan angka yang TAK BISA
    dipesan — "support 698" pada saham berfraksi Rp 5 adalah harga yang tak
    pernah ada di papan. Ketahuan saat kerangka ini diuji ke edisi 18 & 19
    Agustus: 97 dari 209 level meleset 2-5 poin, dan seluruh selisihnya persis
    jarak ke tick terdekat.
    """
    for batas, tick in FRAKSI:
        if x < batas:
            return int(round(x / tick) * tick)
    return int(round(x))


def pivot(h: float, l: float, c: float) -> dict[str, int]:
    """Pivot klasik dari lilin HARI SEBELUMNYA — itu memang definisinya, dan
    diverifikasi ulang terhadap edisi 18 & 19 Agustus yang sudah terbit."""
    p = (h + l + c) / 3
    return {
        "P": ke_fraksi(p),
        "R1": ke_fraksi(2 * p - l),
        "R2": ke_fraksi(p + (h - l)),
        "R3": ke_fraksi(h + 2 * (p - l)),
        "S1": ke_fraksi(2 * p - h),
        "S2": ke_fraksi(p - (h - l)),
        "S3": ke_fraksi(l - 2 * (h - p)),
    }


def kerangka_emiten(kode: str, tanggal: str, nama: str) -> dict:
    d = baris_ohlc(kode)
    idx = next((i for i, r in enumerate(d) if r[0] == tanggal), None)
    if idx is None:
        raise SystemExit(f"{kode}: tak ada lilin {tanggal} di ohlc — panen dulu")
    if idx == 0:
        raise SystemExit(f"{kode}: {tanggal} lilin pertama, pivot butuh hari sebelumnya")
    _, o, hi, lo, c, vol = d[idx]
    _, _, ph, pl, pc, _ = d[idx - 1]
    e50 = ema([r[4] for r in d[: idx + 1]], 50)
    return {
        "ticker": kode,
        "nama": nama,
        "ohlc_hari": {
            "o": o, "h": hi, "l": lo, "c": c,
            "chg": c - pc,
            "pct": round((c / pc - 1) * 100, 2) if pc else 0.0,
            "vol_juta": round((vol or 0) / 1e6, 2),
        },
        "ema50": round(e50) if e50 is not None else None,
        "pivot": pivot(ph, pl, pc),
        "pivot_ragu": [],
        "beli": [],
        "jual": [],
    }


def peta_nama() -> dict[str, str]:
    j = json.loads((AKAR / "data-idx" / "json" / "daftar_emiten.json").read_text(encoding="utf-8"))
    return {e["kode"]: e["nama"] for e in j["emiten"]}


def _uji() -> None:
    """Regresi ke edisi yang SUDAH TERBIT — bukan angka buatan."""
    cocok = beda = 0
    # HANYA 19 Agustus. Edisi 18 Agustus sengaja tak dijadikan patokan: delapan
    # emitennya (ADRO, BYAN, EMAS, JARR, KIJA, MBMA, MDKA, WIFI) memakai level
    # yang tak bisa direproduksi dari lilin 17 Agustus mana pun — WIFI tercetak
    # P=2070 sementara lilin sebelumnya memberi 1935, selisih yang terlalu besar
    # untuk pembulatan. Kemungkinan besar dirakit saat panen hari itu belum
    # lengkap. Mengendurkan ambang uji supaya keduanya "lolos" berarti membuang
    # kemampuannya menangkap rumus yang salah; yang benar adalah berjangkar pada
    # edisi yang datanya utuh.
    for tgl in ("2026-08-19",):
        p = EDISI / f"{tgl}.json"
        if not p.exists():
            continue
        ed = json.loads(p.read_text(encoding="utf-8"))
        for em in ed["emiten"]:
            try:
                k = kerangka_emiten(em["ticker"], tgl, em["nama"])
            except SystemExit:
                continue
            for ruas in ("P", "R1", "R2", "R3", "S1", "S2", "S3"):
                a, b = k["pivot"][ruas], em["pivot"].get(ruas)
                if b is None:
                    continue
                if abs(a - b) <= 1:  # pembulatan boleh selisih 1 tick
                    cocok += 1
                else:
                    beda += 1
                    print(f"  BEDA {tgl} {em['ticker']} {ruas}: hitung {a} vs terbit {b}")
            for ruas in ("o", "h", "l", "c"):
                if k["ohlc_hari"][ruas] != em["ohlc_hari"][ruas]:
                    beda += 1
                    print(f"  BEDA {tgl} {em['ticker']} {ruas}: "
                          f"hitung {k['ohlc_hari'][ruas]} vs terbit {em['ohlc_hari'][ruas]}")
                else:
                    cocok += 1
    print(f"uji kerangka_edisi: {cocok} cocok, {beda} beda")
    if beda:
        raise SystemExit(1)


def main() -> None:
    if "--uji" in sys.argv:
        _uji()
        return
    arg = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(arg) < 2:
        raise SystemExit(__doc__)
    tanggal, kode = arg[0], [k.upper() for k in arg[1:]]
    nama = peta_nama()
    hasil = {"tanggal": tanggal,
             "emiten": [kerangka_emiten(k, tanggal, nama.get(k, k)) for k in kode]}
    keluar = AKAR / "arus-pasar" / "draft" / f"kerangka-{tanggal}.json"
    keluar.write_text(json.dumps(hasil, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"ditulis: {keluar.relative_to(AKAR)} ({len(kode)} emiten)")
    for em in hasil["emiten"]:
        o = em["ohlc_hari"]
        print(f"  {em['ticker']:5} c={o['c']:>7} {o['pct']:+6.2f}% vol={o['vol_juta']:>8.1f}jt "
              f"ema50={em['ema50']} P={em['pivot']['P']}")


if __name__ == "__main__":
    main()
