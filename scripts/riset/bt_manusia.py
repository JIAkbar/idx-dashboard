# -*- coding: utf-8 -*-
"""BT Manusia — baseline pilihan manusia vs backtest sistematis (#217, bagian B).

Sumber pilihan: `arus-pasar/edisi/*.json` (kecuali `_tahan.json`) ->
`tanggal` + `emiten[].ticker`, ditambah `data-idx/json/tinjauan_deepdive.json`
`terbitan[]` (kode, tanggal). Digabung tanpa duplikat (kode, tanggal).

Mesin trade SAMA dengan `bt_broker.py`/`bt_papan.py`: `simulasi_trade`
diimpor apa adanya dari `bt_papan`. ATR14 dihitung dengan rumus IDENTIK
`bt_broker.fitur_kode` (disalin, bukan diimpor — modul ini sengaja tak
memuat data broker sama sekali). Masuk open_h1, keluar h5/h20/tp_sl
(level=harga masuk, sl_pct=1,5x ATR14%, horizon 20). Biaya 0,0 dan 0,004.

    python scripts/riset/bt_manusia.py --uji
    python scripts/riset/bt_manusia.py --resmi

n kecil (Agustus 2026 saja) — baseline informal, BUKAN bukti kuat. Angkanya
tetap dilaporkan apa adanya.
"""
from __future__ import annotations

import argparse
import bisect
import json
import random
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

AKAR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from bt_papan import muat_emiten, simulasi_trade, universe_partanggal  # noqa: E402

EDISI_DIR = AKAR / "arus-pasar" / "edisi"
TINJAUAN = AKAR / "data-idx" / "json" / "tinjauan_deepdive.json"
EXITS = ("h5", "h20", "tp_sl")
BIAYA_LIST = (0.0, 0.004)


def atr_pct_kode(d: dict) -> np.ndarray:
    """ATR14 sederhana (rata-rata biasa) / close — definisi identik
    `bt_broker.fitur_kode` (disalin, bukan diimpor, supaya bt_manusia.py
    tak butuh memuat data broker sama sekali)."""
    c = pd.Series(d["c"], dtype=float)
    h = pd.Series(d["h"], dtype=float)
    l = pd.Series(d["l"], dtype=float)
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    atr14 = tr.rolling(14, min_periods=14).mean()
    return (atr14 / c).replace([np.inf, -np.inf], np.nan).to_numpy()


def muat_pilihan_manusia() -> list[tuple[str, str]]:
    out: set[tuple[str, str]] = set()
    for p in sorted(EDISI_DIR.glob("*.json")):
        if p.name == "_tahan.json":
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        tgl = d.get("tanggal")
        if not tgl:
            continue
        for e in d.get("emiten", []):
            tk = e.get("ticker")
            if tk:
                out.add((tk, tgl))
    if TINJAUAN.exists():
        tdd = json.loads(TINJAUAN.read_text(encoding="utf-8"))
        for t in tdd.get("terbitan", []):
            kode, tgl = t.get("kode"), t.get("tanggal")
            if kode and tgl:
                out.add((kode, tgl))
    return sorted(out)


def _idx_pada(d: dict, tgl: str) -> int | None:
    tl = d["tgl"]
    i = bisect.bisect_left(tl, tgl)
    return i if i < len(tl) and tl[i] == tgl else None


def _trade_satu(d: dict, idx_sinyal: int, exit_: str, biaya: float, atr_pct: np.ndarray) -> dict | None:
    if exit_ == "tp_sl":
        idx_masuk = idx_sinyal + 1
        if idx_masuk >= len(d["o"]):
            return None
        harga_masuk = d["o"][idx_masuk]
        ap = atr_pct[idx_sinyal]
        if not (ap == ap) or harga_masuk <= 0:
            return None
        return simulasi_trade(d, idx_sinyal, "open_h1", "tp_sl", biaya, level=harga_masuk,
                               sl_pct=1.5 * ap, tpsl_horizon=20)
    return simulasi_trade(d, idx_sinyal, "open_h1", exit_, biaya)


def _pf(trades: list[dict]) -> float | None:
    menang = sum(t["return"] for t in trades if t["return"] > 0)
    kalah = abs(sum(t["return"] for t in trades if t["return"] <= 0))
    return (menang / kalah) if kalah else None


def _ringkas(trades: list[dict]) -> dict:
    n = len(trades)
    return {
        "n": n,
        "win_rate": (sum(1 for t in trades if t["return"] > 0) / n) if n else None,
        "pf": _pf(trades),
        "ekspektansi": statistics.mean(t["return"] for t in trades) if trades else None,
    }


def jalankan_resmi() -> dict:
    t0 = time.time()
    log: list[str] = []

    def cetak(msg: str) -> None:
        s = f"[{time.time()-t0:6.1f}s] {msg}"
        print(s)
        log.append(s)

    pilihan = muat_pilihan_manusia()
    cetak(f"{len(pilihan)} pilihan manusia unik (kode,tanggal) dari arus-pasar/edisi + tinjauan_deepdive")

    cetak("Memuat OHLCV + universe (rank<=150, trailing 60 bar) ...")
    bars = muat_emiten()
    rank = universe_partanggal(bars, 60)
    atr_cache: dict[str, np.ndarray] = {}

    # Kandidat acak per tanggal: kode di universe (rank<=150) PADA tanggal itu.
    cetak("Membangun kandidat acak per tanggal (universe) ...")
    kandidat_per_tanggal: dict[str, list[str]] = {}
    for kode, d in bars.items():
        r = rank.get(kode)
        if r is None:
            continue
        r = r.to_numpy()
        for i, t in enumerate(d["tgl"]):
            if not np.isnan(r[i]) and r[i] <= 150:
                kandidat_per_tanggal.setdefault(t, []).append(kode)

    def atr(kode: str) -> np.ndarray:
        if kode not in atr_cache:
            atr_cache[kode] = atr_pct_kode(bars[kode])
        return atr_cache[kode]

    trade_nyata: dict[str, list[dict]] = {e: [] for e in EXITS}
    dilewati = 0
    for kode, tgl in pilihan:
        d = bars.get(kode)
        if d is None:
            dilewati += 1
            continue
        idx = _idx_pada(d, tgl)
        if idx is None:
            dilewati += 1
            continue
        for exit_ in EXITS:
            t = _trade_satu(d, idx, exit_, 0.0, atr(kode))
            if t is not None:
                t["kode"], t["tgl_sinyal"] = kode, tgl
                trade_nyata[exit_].append(t)
    cetak(f"{dilewati} pilihan dilewati (kode/tanggal tak ada di data), sisanya disimulasikan")

    rng = random.Random(217)
    hasil: dict[float, dict] = {}
    for biaya in BIAYA_LIST:
        per_exit = {}
        for exit_ in EXITS:
            trades = [{**t, "return": t["return"] - biaya} for t in trade_nyata[exit_]]
            ring = _ringkas(trades)
            n = ring["n"]
            pfs = []
            if n > 0:
                for _ in range(20):
                    acak_trades = []
                    for kode, tgl in pilihan:
                        kand = kandidat_per_tanggal.get(tgl)
                        if not kand:
                            continue
                        kode_r = rng.choice(kand)
                        d_r = bars[kode_r]
                        idx_r = _idx_pada(d_r, tgl)
                        if idx_r is None:
                            continue
                        t_r = _trade_satu(d_r, idx_r, exit_, biaya, atr(kode_r))
                        if t_r is not None:
                            acak_trades.append(t_r)
                    pf_ = _pf(acak_trades)
                    if pf_ is not None:
                        pfs.append(pf_)
            per_exit[exit_] = {
                **ring,
                "pf_acak_rata": statistics.mean(pfs) if pfs else None,
                "pf_acak_p95": float(np.percentile(pfs, 95)) if pfs else None,
            }
        hasil[biaya] = per_exit

    durasi = time.time() - t0
    cetak(f"Selesai --resmi, {durasi:.1f}s")
    return {"n_pilihan": len(pilihan), "n_dilewati": dilewati, "hasil": hasil,
            "durasi_detik": durasi, "log": log}


# ========================================================================= uji
def uji_bawaan() -> int:
    n_ok = n_total = 0
    n_total += 1
    tgl = [f"2021-01-{1+i:02d}" if i < 31 else f"2021-02-{1+i-31:02d}" for i in range(60)]
    c = [100.0 + i * 0.3 for i in range(60)]
    d = {"kode": "TST", "tgl": tgl, "o": c, "h": [x + 1 for x in c], "l": [x - 1 for x in c], "c": c}
    ap = atr_pct_kode(d)
    idx = _idx_pada(d, tgl[20])
    ok = idx == 20
    t = _trade_satu(d, idx, "h5", 0.0, ap)
    ok = ok and t is not None and t["tgl_masuk"] == tgl[21] and t["tgl_keluar"] == tgl[26]
    t2 = _trade_satu(d, idx, "tp_sl", 0.0, ap)
    ok = ok and (t2 is not None) == (not np.isnan(ap[20]))
    print(("  [ok]" if ok else "  [GAGAL]") + " 1 kasus sintetis: idx tanggal, trade h5 & tp_sl konsisten")
    n_ok += 1 if ok else 0
    print(f"{n_ok}/{n_total} lulus")
    return 0 if n_ok == n_total else 1


# ============================================================================ cli
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--uji", action="store_true")
    ap.add_argument("--resmi", action="store_true")
    ap.add_argument("--keluaran", default=None)
    a = ap.parse_args()
    if a.uji:
        return uji_bawaan()
    if a.resmi:
        hasil = jalankan_resmi()
        if a.keluaran:
            Path(a.keluaran).write_text(json.dumps(hasil, ensure_ascii=False, default=str, indent=1),
                                         encoding="utf-8")
            print(f"  ringkasan ditulis ke {a.keluaran}")
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
