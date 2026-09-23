# -*- coding: utf-8 -*-
"""BT Lanjutan — riset #221, lanjutan #217 (spek_riset_221.md, DIKUNCI 23 Sep 2026).

Menumpang mesin yang sudah ada, IMPOR APA ADANYA:
`bt_papan.py` (muat_emiten, muat_ihsg, simulasi_trade, ringkas_trades,
universe_partanggal, deteksi_rbs, ParamRBS), `bt_broker.py` (muat_broker,
fitur_kode, tandai_sinyal, _simulasi_acak, _pf), `bt_indikator.sinyal('obv')`.
NOL perubahan ke tiga berkas itu. Keluaran HANYA ke `data-idx/json/bt_riset/`
(folder baru) — BUKAN `bt/` dan BUKAN `bt/index.json`.

    python scripts/riset/bt_lanjutan.py --uji
    python scripts/riset/bt_lanjutan.py --resmi

## Dua penyimpangan dari "impor apa adanya", dicatat di sini (bukan diam-diam)

1. **Keluar h40/h60 (Arah 2) tak didukung `simulasi_trade`** — dict
   internalnya cuma `{"h1":1,"h5":5,"h20":20}`. Ditulis ulang lokal
   (`simulasi_satu`), replikasi PERSIS cabang h-exit `simulasi_trade`
   (masuk open_h1, keluar close bar ke-N, `return = (keluar-masuk)/masuk -
   biaya`) — bukan mesin baru, cuma horizon yang lebih panjang.
2. **Pembanding acak h40/h60** — `bt_broker._simulasi_acak` memanggil
   `simulasi_trade` langsung untuk exit non-tp_sl, jadi ikut kena batasan
   di atas. `simulasi_acak_lanjutan` di sini punya struktur IDENTIK
   (kandidat, batas percobaan n*50+200, `rng.choice`) tapi dispatch lewat
   `simulasi_satu` lokal. Untuk h5/h20/tp_sl, `_simulasi_acak` bt_broker
   dipakai APA ADANYA seperti diminta spek.

## Pembanding acak — "TANGGAL SAMA DENGAN SINYAL"

Beda dari mesin #217 (kandidat = seluruh tahun): di sini kandidat dibangun
dari HANYA tanggal-tanggal yang benar-benar jadi tanggal sinyal trade luar
sampel tahun itu (union anggota universe pada tanggal-tanggal itu), baru
`_simulasi_acak`/`simulasi_acak_lanjutan` menarik n sampel dari kandidat itu.
Ini pembacaan spek "emiten acak dari universe pada TANGGAL yang sama dengan
sinyal" — bukan tanggal acak sepanjang tahun seperti #217.

## Arah 1 — gerbang tambahan

Varian ber-penyaring (F1/F2) yang TERPILIH di suatu tahun uji hanya
dihitung LULUS tahun itu bila PF luar sampelnya JUGA mengalahkan varian F0
(basis sinyal + keluar sama) di tahun uji yang SAMA — sesuai "varian
terpilih ber-penyaring harus mengalahkan F0 dasar yang sama". Pembacaan ini
digabung dengan kriteria umum (PF>1,3 DAN >p95 acak) sebagai SATU gerbang
per tahun, dicatat terpisah di kolom `menang_vs_f0` supaya bisa diperiksa.
"""
from __future__ import annotations

import argparse
import bisect
import json
import random
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

AKAR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from bt_papan import (  # noqa: E402
    ParamRBS, deteksi_rbs, muat_emiten, muat_ihsg, ringkas_trades,
    simulasi_trade, universe_partanggal,
)
from bt_broker import _pf, _simulasi_acak, fitur_kode, muat_broker, tandai_sinyal  # noqa: E402
from bt_indikator import sinyal as ind_sinyal  # noqa: E402

BT_RISET_DIR = AKAR / "data-idx" / "json" / "bt_riset"
RANK_MAKS = 150
FILTERS = ("F0", "F1n5", "F1n10", "F2n5", "F2n10")
EXITS1 = ("h5", "h20", "tp_sl")
EXITS2 = ("h20", "h40", "h60")
TAHUN_UJI = tuple(range(2022, 2027))
TAHUN_SAMPEL_MULAI = 2018
MIN_N_INSAMPLE = 100
CONTOH_TRADE = 200
HZ_LANJUTAN = {"h40": 40, "h60": 60}


# ============================================================== fitur & sinyal
def bangun_universe(bars: dict[str, dict]) -> dict[str, np.ndarray]:
    rank = universe_partanggal(bars, 60)
    out: dict[str, np.ndarray] = {}
    for kode, d in bars.items():
        r = rank.get(kode)
        if r is None:
            out[kode] = np.zeros(len(d["tgl"]), dtype=bool)
        else:
            out[kode] = (r.notna() & (r <= RANK_MAKS)).to_numpy()
    return out


def net_nonritel_roll(d: dict, bd: dict[str, tuple], N: int) -> pd.Series:
    """Jumlah net_nonritel N-hari bergulir — dipakai F2. `bd` = keluaran
    `muat_broker()[kode]`, tuple index 0 = net_nonritel (lihat bt_broker)."""
    n = len(d["tgl"])
    net = np.full(n, np.nan)
    for i, t in enumerate(d["tgl"]):
        v = bd.get(t)
        if v is not None:
            net[i] = v[0]
    return pd.Series(net).rolling(N, min_periods=N).sum()


def ambang_bawah(feats: dict[str, pd.DataFrame], di_universe: dict[str, np.ndarray],
                  cols: list[str]) -> dict[str, dict]:
    """Ambang desil BAWAH (quantile 0,1) per tanggal, lintas emiten DI DALAM
    universe — cermin `tandai_sinyal` bt_broker tapi arah bawah, dipakai F1."""
    populasi = [feat.loc[di_universe[kode], ["tanggal"] + cols]
                for kode, feat in feats.items() if di_universe[kode].any()]
    if populasi:
        pop = pd.concat(populasi, ignore_index=True)
        thr = pop.groupby("tanggal")[cols].quantile(0.1)
    else:
        thr = pd.DataFrame(columns=cols)
    return {col: thr[col].to_dict() for col in cols}


def obv_bool_kode(d: dict) -> np.ndarray:
    df = pd.DataFrame({"o": d["o"], "h": d["h"], "l": d["l"], "c": d["c"], "v": d["lot"]})
    return ind_sinyal("obv", df).to_numpy()


def rbs_bool_kode(d: dict, p: ParamRBS) -> np.ndarray:
    """Sinyal RBS = bar retest yang BERTAHAN (definisi default `run_rbs`
    bt_papan — "Sinyal trade = retest-sah" yang dipakai jalur h5/h20)."""
    arr = np.zeros(len(d["tgl"]), dtype=bool)
    for rec in deteksi_rbs(d, p):
        if rec.get("bertahan") and "retest_idx" in rec:
            arr[rec["retest_idx"]] = True
    return arr


# ==================================================================== simulasi
def simulasi_satu(d: dict, i: int, exit_: str, atr_pct: np.ndarray | None, biaya: float) -> dict | None:
    if exit_ == "tp_sl":
        idx_masuk = i + 1
        if idx_masuk >= len(d["o"]):
            return None
        harga_masuk = d["o"][idx_masuk]
        ap = atr_pct[i] if atr_pct is not None else float("nan")
        if not (ap == ap) or harga_masuk <= 0:
            return None
        return simulasi_trade(d, i, "open_h1", "tp_sl", biaya, level=harga_masuk,
                               sl_pct=1.5 * ap, tpsl_horizon=20)
    if exit_ in ("h5", "h20"):
        return simulasi_trade(d, i, "open_h1", exit_, biaya)
    if exit_ in HZ_LANJUTAN:
        hz = HZ_LANJUTAN[exit_]
        idx_masuk = i + 1
        if idx_masuk >= len(d["c"]):
            return None
        harga_masuk = d["o"][idx_masuk]
        idx_keluar = idx_masuk + hz
        if idx_keluar >= len(d["c"]):
            return None
        harga_keluar = d["c"][idx_keluar]
        if harga_masuk <= 0:
            return None
        return {"tgl_masuk": d["tgl"][idx_masuk], "tgl_keluar": d["tgl"][idx_keluar],
                "harga_masuk": harga_masuk, "harga_keluar": harga_keluar,
                "return": (harga_keluar - harga_masuk) / harga_masuk - biaya,
                "alasan_keluar": f"H+{hz}"}
    raise ValueError(f"exit tak dikenal: {exit_}")


def hasilkan_trade(d: dict, sinyal_bool: np.ndarray, exit_: str,
                    atr_pct: np.ndarray | None, tgl2idx: dict[str, int], biaya: float = 0.0) -> list[dict]:
    """Satu posisi per emiten: sinyal diabaikan selama posisi masih terbuka."""
    trades: list[dict] = []
    idx_tutup = -1
    for i in range(len(sinyal_bool)):
        if not sinyal_bool[i] or i < idx_tutup:
            continue
        t = simulasi_satu(d, i, exit_, atr_pct, biaya)
        if t is None:
            continue
        idx_keluar = tgl2idx.get(t["tgl_keluar"])
        if idx_keluar is None:
            continue
        idx_tutup = idx_keluar
        t["kode"] = d["kode"]
        t["tgl_sinyal"] = d["tgl"][i]
        trades.append(t)
    return trades


def simulasi_acak_lanjutan(candidates: list[tuple[str, int]], n: int, exit_: str, biaya: float,
                            bars: dict[str, dict], rng: random.Random) -> list[dict]:
    """Struktur identik `bt_broker._simulasi_acak`, dispatch lewat
    `simulasi_satu` lokal — dipakai HANYA untuk h40/h60 (lihat catatan modul)."""
    trades: list[dict] = []
    tries, batas = 0, n * 50 + 200
    while len(trades) < n and tries < batas and candidates:
        tries += 1
        kode, i = rng.choice(candidates)
        t = simulasi_satu(bars[kode], i, exit_, None, biaya)
        if t is not None:
            trades.append(t)
    return trades


def dengan_biaya(trades: list[dict], biaya: float) -> list[dict]:
    return [{**t, "return": t["return"] - biaya} for t in trades]


def kandidat_tanggal_multi(bars: dict[str, dict], di_universe: dict[str, np.ndarray],
                            tgl2idx: dict[str, dict[str, int]], tanggal_list: list[str]) -> list[tuple[str, int]]:
    out: list[tuple[str, int]] = []
    for tanggal in set(tanggal_list):
        for kode, d in bars.items():
            i = tgl2idx[kode].get(tanggal)
            if i is not None and di_universe[kode][i]:
                out.append((kode, i))
    return out


def drawdown_maks(trades: list[dict]) -> float | None:
    if not trades:
        return None
    ts = sorted(trades, key=lambda t: t["tgl_keluar"])
    equity = peak = dd = 0.0
    for t in ts:
        equity += t["return"]
        peak = max(peak, equity)
        dd = max(dd, peak - equity)
    return dd


def bangun_ihsg_ret_window(ihsg: dict | None):
    if not ihsg:
        return None
    by_date = dict(zip(ihsg["tgl"], ihsg["c"]))
    tgl_sorted = ihsg["tgl"]

    def cari(tanggal: str) -> float | None:
        c = by_date.get(tanggal)
        if c is not None:
            return c
        i = bisect.bisect_left(tgl_sorted, tanggal)
        return ihsg["c"][i] if i < len(tgl_sorted) else None

    def ret_window(masuk: str, keluar: str) -> float | None:
        c1, c2 = cari(masuk), cari(keluar)
        if c1 is None or c2 is None or c1 <= 0:
            return None
        return (c2 - c1) / c1

    return ret_window


# ============================================================== per-tahun & WF
def per_tahun(trades: list[dict]) -> tuple[dict, dict]:
    by_year: dict[int, list[dict]] = {}
    for t in trades:
        by_year.setdefault(int(t["tgl_sinyal"][:4]), []).append(t)
    stat = {}
    for y, ts in by_year.items():
        n_ = len(ts)
        stat[y] = {"n": n_, "pf": _pf(ts),
                   "win_rate": (sum(1 for t in ts if t["return"] > 0) / n_) if n_ else None,
                   "ekspektansi": statistics.mean(t["return"] for t in ts) if ts else None}
    return stat, by_year


def walk_forward(by_year_per_combo: dict, label_fn, exit_of_combo, bars, di_universe, tgl2idx,
                  atr_lookup, ihsg_ret_window, biaya: float, rng: random.Random,
                  extra_gate=None) -> list[dict]:
    baris = []
    for t in TAHUN_UJI:
        kandidat = []
        for combo, by_year in by_year_per_combo.items():
            pooled: list[dict] = []
            for y in range(TAHUN_SAMPEL_MULAI, t):
                pooled.extend(by_year.get(y, []))
            if len(pooled) >= MIN_N_INSAMPLE:
                pf = _pf(pooled)
                if pf is not None:
                    kandidat.append((combo, pf, len(pooled)))
        if not kandidat:
            baris.append({"tahun": t, "varian": None, "n": 0, "win_rate": None, "pf": None,
                          "ekspektansi": None, "drawdown_maks": None, "pf_acak_p50": None,
                          "pf_acak_p95": None, "ihsg_rata_per_trade": None, "n_sampel_insample": 0,
                          "pf_insample": None, "lulus_dasar": False, "menang_vs_f0": None,
                          "lulus_tahun": False})
            continue
        combo_pilih, pf_insample, n_insample = max(kandidat, key=lambda x: x[1])
        ts_y = by_year_per_combo[combo_pilih].get(t, [])
        n_y = len(ts_y)
        pf_y = _pf(ts_y)
        win = (sum(1 for tr in ts_y if tr["return"] > 0) / n_y) if n_y else None
        eksp = statistics.mean(tr["return"] for tr in ts_y) if ts_y else None
        dd = drawdown_maks(ts_y)
        ihsg_list = [r for r in (ihsg_ret_window(tr["tgl_masuk"], tr["tgl_keluar"]) for tr in ts_y)
                     if r is not None] if ihsg_ret_window else []
        ihsg_avg = statistics.mean(ihsg_list) if ihsg_list else None
        exit_ = exit_of_combo(combo_pilih)
        pf_acak_p50 = pf_acak_p95 = None
        if n_y > 0:
            kand = kandidat_tanggal_multi(bars, di_universe, tgl2idx, [tr["tgl_sinyal"] for tr in ts_y])
            if kand:
                pfs = []
                for _ in range(20):
                    if exit_ in HZ_LANJUTAN:
                        tr_acak = simulasi_acak_lanjutan(kand, n_y, exit_, biaya, bars, rng)
                    else:
                        tr_acak = _simulasi_acak(kand, n_y, exit_, biaya, bars, atr_lookup, rng)
                    pf_ = _pf(tr_acak)
                    if pf_ is not None:
                        pfs.append(pf_)
                if pfs:
                    pf_acak_p50 = float(np.percentile(pfs, 50))
                    pf_acak_p95 = float(np.percentile(pfs, 95))
        lulus_dasar = pf_y is not None and pf_y > 1.3 and pf_acak_p95 is not None and pf_y > pf_acak_p95
        beat_f0 = None
        lulus_tahun = lulus_dasar
        if extra_gate is not None:
            beat_f0 = extra_gate(combo_pilih, t, pf_y)
            lulus_tahun = lulus_dasar and beat_f0
        baris.append({
            "tahun": t, "varian": label_fn(combo_pilih), "n": n_y, "win_rate": win, "pf": pf_y,
            "ekspektansi": eksp, "drawdown_maks": dd, "pf_acak_p50": pf_acak_p50,
            "pf_acak_p95": pf_acak_p95, "ihsg_rata_per_trade": ihsg_avg,
            "n_sampel_insample": n_insample, "pf_insample": pf_insample,
            "lulus_dasar": lulus_dasar, "menang_vs_f0": beat_f0, "lulus_tahun": lulus_tahun,
        })
    return baris


def buat_extra_gate_arah1(by_year_per_combo: dict):
    def gate(combo, tahun, pf_y):
        base, filt, exit_ = combo
        if filt == "F0":
            return True
        f0_trades = by_year_per_combo.get((base, "F0", exit_), {}).get(tahun, [])
        pf_f0 = _pf(f0_trades)
        if pf_y is None or pf_f0 is None:
            return False
        return pf_y > pf_f0
    return gate


# =================================================================== keluaran
def tulis_hasil_riset(nama: str, params: dict, ringkasan: dict, trades: list[dict],
                       akhir_data: str | None) -> None:
    BT_RISET_DIR.mkdir(parents=True, exist_ok=True)
    jalur = BT_RISET_DIR / f"{nama}.json"
    isi = {
        "strategi": nama, "parameter": params, "akhir_data": akhir_data,
        "dibuat": datetime.now().isoformat(timespec="seconds"),
        "ringkasan": ringkasan, "n_trade_total": len(trades),
        "trades_contoh": trades[:CONTOH_TRADE],
    }
    jalur.write_text(json.dumps(isi, ensure_ascii=False, default=str), encoding="utf-8")
    perbarui_index_riset(nama, params, ringkasan, akhir_data)


def perbarui_index_riset(nama: str, params: dict, ringkasan: dict, akhir_data: str | None) -> None:
    idx_path = BT_RISET_DIR / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {"run": []}
    idx["run"] = [r for r in idx["run"] if r["strategi"] != nama]
    idx["run"].append({
        "strategi": nama, "dibuat": datetime.now().isoformat(timespec="seconds"),
        "akhir_data": akhir_data, "n_trade": ringkasan["n_trade"],
        "win_rate": ringkasan["win_rate"], "profit_factor": ringkasan["profit_factor"],
    })
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")


def label_arah1(combo: tuple) -> str:
    base, filt, exit_ = combo
    return f"{base}-{filt.lower()}-{exit_}"


def label_arah2(combo: tuple) -> str:
    base, exit_ = combo
    return f"{base}-{exit_}"


# ==================================================================== orkestrasi
def jalankan_resmi() -> dict:
    t0 = time.time()
    log: list[str] = []

    def cetak(msg: str) -> None:
        s = f"[{time.time()-t0:6.1f}s] {msg}"
        print(s)
        log.append(s)

    cetak("Memuat OHLCV ...")
    bars = muat_emiten()
    ihsg = muat_ihsg()
    ihsg_ret_window = bangun_ihsg_ret_window(ihsg)
    cetak(f"  {len(bars)} emiten")

    cetak("Memuat broker_tahunan (8 proses) ...")
    broker_raw = muat_broker(set(bars))
    cetak(f"  {len(broker_raw)} emiten punya data broker")

    cetak(f"Universe (rank_lik trailing 60 bar, rank <= {RANK_MAKS}) ...")
    di_universe = bangun_universe(bars)

    cetak("Fitur broker per emiten (fitur_kode, rasio_nonritel_5/10 + atr_pct) ...")
    feats = {kode: fitur_kode(d, broker_raw.get(kode, {})) for kode, d in bars.items()}

    cetak("Menandai S1/S2/S3 (tandai_sinyal — dipakai S3_10 arah 2) ...")
    tandai_sinyal(feats, di_universe)

    cetak("Ambang desil BAWAH rasio_nonritel_5/10 (F1) ...")
    thr_bawah = ambang_bawah(feats, di_universe, ["rasio_nonritel_5", "rasio_nonritel_10"])
    for kode, feat in feats.items():
        for col in ("rasio_nonritel_5", "rasio_nonritel_10"):
            feat[col + "_amb10"] = feat["tanggal"].map(thr_bawah[col])

    cetak("net_nonritel_N bergulir (F2) ...")
    net_n = {kode: {N: net_nonritel_roll(d, broker_raw.get(kode, {}), N) for N in (5, 10)}
             for kode, d in bars.items()}

    cetak("Sinyal OBV (bt_indikator.sinyal('obv')) ...")
    obv_raw = {kode: obv_bool_kode(d) for kode, d in bars.items()}

    cetak("Sinyal RBS (deteksi_rbs — retest bertahan) ...")
    p_rbs = ParamRBS()
    rbs_raw = {kode: rbs_bool_kode(d, p_rbs) for kode, d in bars.items()}

    obv_bool = {kode: obv_raw[kode] & di_universe[kode] for kode in bars}
    rbs_bool = {kode: rbs_raw[kode] & di_universe[kode] for kode in bars}
    s3_10_bool = {kode: feats[kode]["S3_10"].fillna(False).to_numpy().astype(bool) for kode in bars}

    cetak("tgl->idx, atr_pct lookup ...")
    tgl2idx = {kode: {t: i for i, t in enumerate(d["tgl"])} for kode, d in bars.items()}
    atr_lookup = {kode: feats[kode]["atr_pct"].to_numpy() for kode in bars}

    def sinyal_terfilter(base_arr: np.ndarray, kode: str, filt: str) -> np.ndarray:
        if filt == "F0":
            return base_arr
        feat = feats[kode]
        if filt.startswith("F1"):
            N = 5 if filt.endswith("5") else 10
            ok = (feat[f"rasio_nonritel_{N}"] > feat[f"rasio_nonritel_{N}_amb10"]).to_numpy()
            return base_arr & ok
        N = 5 if filt.endswith("5") else 10
        ok = (net_n[kode][N] > 0).to_numpy()
        return base_arr & ok

    # ============================================================== Arah 1
    cetak("Arah 1: broker sebagai penyaring — 30 varian ...")
    bases1 = {"obv": obv_bool, "rbs": rbs_bool}
    hasil1: dict[tuple, list[dict]] = {}
    for base_nama, base_dict in bases1.items():
        for filt in FILTERS:
            for exit_ in EXITS1:
                trades: list[dict] = []
                for kode, d in bars.items():
                    sinyal_bool = sinyal_terfilter(base_dict[kode], kode, filt)
                    ap = atr_lookup[kode] if exit_ == "tp_sl" else None
                    trades.extend(hasilkan_trade(d, sinyal_bool, exit_, ap, tgl2idx[kode]))
                hasil1[(base_nama, filt, exit_)] = trades
    cetak(f"  {sum(len(v) for v in hasil1.values())} trade arah 1 (biaya 0)")

    # ============================================================== Arah 2
    cetak("Arah 2: horizon panjang — 9 varian ...")
    bases2 = {"obv": obv_bool, "rbs": rbs_bool, "broker_s3": s3_10_bool}
    hasil2: dict[tuple, list[dict]] = {}
    for base_nama, base_dict in bases2.items():
        for exit_ in EXITS2:
            trades = []
            for kode, d in bars.items():
                trades.extend(hasilkan_trade(d, base_dict[kode], exit_, None, tgl2idx[kode]))
            hasil2[(base_nama, exit_)] = trades
    cetak(f"  {sum(len(v) for v in hasil2.values())} trade arah 2 (biaya 0)")

    cetak("Menulis 39 hasil (biaya 0) ke data-idx/json/bt_riset/ ...")
    per_combo_year1, by_year1 = {}, {}
    for combo, trades in hasil1.items():
        stat, by_year = per_tahun(trades)
        per_combo_year1[combo], by_year1[combo] = stat, by_year
        base_nama, filt, exit_ = combo
        params = {"strategi": f"riset221-arah1-{label_arah1(combo)}", "arah": 1, "base_sinyal": base_nama,
                   "penyaring": filt, "model_masuk": "open_h1", "model_keluar": exit_,
                   "rank_maks": RANK_MAKS, "biaya_roundtrip": 0.0}
        akhir_data = max((t["tgl_keluar"] for t in trades), default=None)
        ring = ringkas_trades(trades, None, 0.0, params)
        tulis_hasil_riset(f"riset221-arah1-{label_arah1(combo)}", params, ring, trades, akhir_data)
    per_combo_year2, by_year2 = {}, {}
    for combo, trades in hasil2.items():
        stat, by_year = per_tahun(trades)
        per_combo_year2[combo], by_year2[combo] = stat, by_year
        base_nama, exit_ = combo
        params = {"strategi": f"riset221-arah2-{label_arah2(combo)}", "arah": 2, "base_sinyal": base_nama,
                   "model_masuk": "open_h1", "model_keluar": exit_,
                   "rank_maks": RANK_MAKS, "biaya_roundtrip": 0.0}
        akhir_data = max((t["tgl_keluar"] for t in trades), default=None)
        ring = ringkas_trades(trades, None, 0.0, params)
        tulis_hasil_riset(f"riset221-arah2-{label_arah2(combo)}", params, ring, trades, akhir_data)

    cetak("Walk-forward Arah 1 & 2, biaya 0,0 dan 0,004 ...")
    wf = {}
    for biaya in (0.0, 0.004):
        by_year1_b = {c: {y: (ts if biaya == 0.0 else dengan_biaya(ts, biaya)) for y, ts in by_year.items()}
                      for c, by_year in by_year1.items()}
        by_year2_b = {c: {y: (ts if biaya == 0.0 else dengan_biaya(ts, biaya)) for y, ts in by_year.items()}
                      for c, by_year in by_year2.items()}
        gate1 = buat_extra_gate_arah1(by_year1_b)
        rng1 = random.Random(221)
        baris1 = walk_forward(by_year1_b, label_arah1, lambda c: c[2], bars, di_universe, tgl2idx,
                               atr_lookup, ihsg_ret_window, biaya, rng1, extra_gate=gate1)
        rng2 = random.Random(221)
        baris2 = walk_forward(by_year2_b, label_arah2, lambda c: c[1], bars, di_universe, tgl2idx,
                               atr_lookup, ihsg_ret_window, biaya, rng2, extra_gate=None)
        lolos1 = sum(1 for r in baris1 if r["lulus_tahun"])
        lolos2 = sum(1 for r in baris2 if r["lulus_tahun"])
        wf[biaya] = {"arah1": baris1, "arah2": baris2,
                     "vonis_arah1": lolos1 >= 3, "lolos_arah1": lolos1,
                     "vonis_arah2": lolos2 >= 3, "lolos_arah2": lolos2}
        cetak(f"  biaya {biaya}: arah1 lolos {lolos1}/5, arah2 lolos {lolos2}/5")

    durasi = time.time() - t0
    cetak(f"Selesai --resmi, {durasi/60:.1f} menit")
    return {"bars_n": len(bars), "durasi_detik": durasi, "wf": wf,
            "per_combo_year1": per_combo_year1, "per_combo_year2": per_combo_year2, "log": log}


# ====================================================================== laporan
def _fmt(x, nd=3):
    return "-" if x is None else f"{x:.{nd}f}"


def tulis_laporan(hasil: dict) -> None:
    biaya0 = hasil["wf"][0.0]
    biaya4 = hasil["wf"][0.004]
    L = []
    L.append("# Riset #221 — lanjutan #217 (broker sebagai penyaring & horizon panjang)\n")
    L.append(f"Sumber perintah: `docs/spek-dev-papan/spek_riset_221.md`. Mesin: "
             f"`scripts/riset/bt_lanjutan.py`, impor apa adanya dari `bt_papan.py` "
             f"(muat_emiten, muat_ihsg, simulasi_trade, ringkas_trades, universe_partanggal, "
             f"deteksi_rbs, ParamRBS) dan `bt_broker.py` (muat_broker, fitur_kode, tandai_sinyal, "
             f"_simulasi_acak, _pf); OBV = `bt_indikator.sinyal('obv', df)`. "
             f"Kriteria lulus dihitung pada biaya 0 (keputusan Johan 23 Sep 2026); biaya 0,4% "
             f"dicetak sebagai catatan.\n")
    L.append(f"Emiten OHLCV: {hasil['bars_n']}. Durasi `--resmi`: {hasil['durasi_detik']/60:.1f} menit.\n")

    for arah, judul, kolomnya in ((1, "Arah 1 — broker sebagai PENYARING", "arah1"),
                                    (2, "Arah 2 — horizon panjang", "arah2")):
        L.append(f"\n## {judul}\n")
        for label_biaya, wf in (("biaya 0,0", biaya0), ("biaya 0,004 (catatan)", biaya4)):
            baris = wf[kolomnya]
            L.append(f"\n### Walk-forward — {label_biaya}\n")
            if arah == 1:
                L.append("| Tahun | Varian terpilih | n | Win rate | PF | Ekspektansi | Drawdown maks | "
                          "PF acak p50 | PF acak p95 | IHSG per-trade | Menang vs F0 | Lulus tahun |")
                L.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
                for r in baris:
                    L.append(f"| {r['tahun']} | {r['varian'] or '-'} | {r['n']} | "
                              f"{_fmt(r['win_rate'],3)} | {_fmt(r['pf'])} | {_fmt(r['ekspektansi'],4)} | "
                              f"{_fmt(r['drawdown_maks'],4)} | {_fmt(r['pf_acak_p50'])} | "
                              f"{_fmt(r['pf_acak_p95'])} | {_fmt(r['ihsg_rata_per_trade'],4)} | "
                              f"{r['menang_vs_f0']} | {r['lulus_tahun']} |")
            else:
                L.append("| Tahun | Varian terpilih | n | Win rate | PF | Ekspektansi | Drawdown maks | "
                          "PF acak p50 | PF acak p95 | IHSG per-trade | Lulus tahun |")
                L.append("|---|---|---|---|---|---|---|---|---|---|---|")
                for r in baris:
                    L.append(f"| {r['tahun']} | {r['varian'] or '-'} | {r['n']} | "
                              f"{_fmt(r['win_rate'],3)} | {_fmt(r['pf'])} | {_fmt(r['ekspektansi'],4)} | "
                              f"{_fmt(r['drawdown_maks'],4)} | {_fmt(r['pf_acak_p50'])} | "
                              f"{_fmt(r['pf_acak_p95'])} | {_fmt(r['ihsg_rata_per_trade'],4)} | "
                              f"{r['lulus_tahun']} |")
            lolos = wf[f"lolos_{kolomnya}"]
            vonis = "LULUS" if wf[f"vonis_{kolomnya}"] else "GAGAL"
            L.append(f"\n**Vonis ({label_biaya}): {vonis}** — {lolos} dari 5 tahun (2022-2026) "
                     f"memenuhi kriteria." +
                     (" Arah 1: kriteria termasuk gerbang tambahan (varian ber-penyaring harus "
                      "mengalahkan F0 di tahun yang sama)." if arah == 1 else ""))

    # tabel dalam sampel semua varian (biaya 0,0 saja, ringkas)
    for arah, per_combo_year, label_fn in ((1, hasil["per_combo_year1"], label_arah1),
                                             (2, hasil["per_combo_year2"], label_arah2)):
        L.append(f"\n## Arah {arah} — tabel dalam sampel semua varian (biaya 0,0)\n")
        tahun_semua = sorted({y for stat in per_combo_year.values() for y in stat})
        header = "| Varian | " + " | ".join(f"{y} (n/pf)" for y in tahun_semua) + " |"
        L.append(header)
        L.append("|" + "---|" * (len(tahun_semua) + 1))
        for combo in sorted(per_combo_year, key=label_fn):
            stat = per_combo_year[combo]
            sel = []
            for y in tahun_semua:
                s = stat.get(y)
                sel.append(f"{s['n']}/{s['pf']:.2f}" if s and s["pf"] is not None else
                            (f"{s['n']}/-" if s else "-"))
            L.append(f"| {label_fn(combo)} | " + " | ".join(sel) + " |")

    L.append("\n## Catatan penutup\n")
    L.append("Angka apa adanya, tak ditafsirkan lebih jauh dari yang tertulis. Aturan sinyal, "
             "penyaring, keluar, dan kriteria vonis ditetapkan di `spek_riset_221.md` SEBELUM run "
             "ini dijalankan, tidak diubah sesudah angka terlihat. Dua penyimpangan teknis "
             "(keluar h40/h60 dan pembanding acaknya tak bisa lewat `simulasi_trade`/`_simulasi_acak` "
             "apa adanya) dicatat di docstring `bt_lanjutan.py`.\n")

    jalur = AKAR / "docs" / "spek-dev-papan" / "riset_221_hasil.md"
    jalur.write_text("\n".join(L), encoding="utf-8")
    print(f"  laporan ditulis ke {jalur}")


def tulis_ringkas_json(hasil: dict) -> None:
    biaya0 = hasil["wf"][0.0]

    def kalimat(kolomnya: str, judul: str) -> str:
        lolos = biaya0[f"lolos_{kolomnya}"]
        return (f"{judul}: profit factor luar sampel mengalahkan ambang 1,3 dan pembanding acak "
                f"pada {lolos} dari 5 tahun uji (2022-2026).")

    isi = {
        "diperbarui": datetime.now().isoformat(timespec="seconds"),
        "arah": [
            {"nama": "Broker sebagai penyaring OBV/RBS", "lulus": bool(biaya0["vonis_arah1"]),
             "tahun_lulus": biaya0["lolos_arah1"], "tahun_uji": 5,
             "kalimat": kalimat("arah1", "Penyaringan broker")},
            {"nama": "Tahan 20-60 hari", "lulus": bool(biaya0["vonis_arah2"]),
             "tahun_lulus": biaya0["lolos_arah2"], "tahun_uji": 5,
             "kalimat": kalimat("arah2", "Menahan posisi lebih lama")},
        ],
        "riset_sebelumnya": {
            "nama": "Arus broker sebagai sinyal (#217)", "lulus": False,
            "tahun_lulus": 0, "tahun_uji": 5,
            "kalimat": "Sinyal arus broker berdiri sendiri lulus 0 dari 5 tahun uji (2022-2026).",
        },
    }
    BT_RISET_DIR.mkdir(parents=True, exist_ok=True)
    jalur = BT_RISET_DIR / "ringkas.json"
    jalur.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  ringkas ditulis ke {jalur}")


# ========================================================================= uji
def _sintetis_dasar(n: int = 140, kode: str = "TEST") -> dict:
    tgl = [f"2020-{1+i//28:02d}-{1+i%28:02d}" for i in range(n)]
    o = [100.0] * n
    h = [101.0] * n
    l = [99.0] * n
    c = [100.0] * n
    lot = [1000.0] * n
    for i in range(50, min(61, n)):
        c[i] = 100.0 + (i - 49) * 2.0
        o[i] = c[i] - 1
        h[i] = c[i] + 0.5
        l[i] = c[i] - 1.5
        lot[i] = 5000.0
    return {"kode": kode, "tgl": tgl, "o": o, "h": h, "l": l, "c": c, "lot": lot,
            "value": [x * 1000 for x in lot], "freq": [10.0] * n, "fb": [0.0] * n, "fs": [0.0] * n}


def uji_bawaan() -> int:
    n_ok = n_total = 0

    # 1. hasilkan_trade h40/h60: keluar TEPAT N bar sesudah masuk, return cocok manual.
    n_total += 1
    d = _sintetis_dasar(140)
    tgl2idx = {t: i for i, t in enumerate(d["tgl"])}
    sinyal = np.zeros(140, dtype=bool)
    sinyal[10] = True
    trades = hasilkan_trade(d, sinyal, "h40", None, tgl2idx)
    ok = len(trades) == 1
    if ok:
        t = trades[0]
        idx_masuk = 11
        idx_keluar = idx_masuk + 40
        ret_manual = (d["c"][idx_keluar] - d["o"][idx_masuk]) / d["o"][idx_masuk]
        ok = (t["tgl_keluar"] == d["tgl"][idx_keluar]) and abs(t["return"] - ret_manual) < 1e-9
    print(("  [ok]" if ok else "  [GAGAL]") + f" h40: keluar tepat 40 bar sesudah masuk, return cocok manual ({trades})")
    n_ok += 1 if ok else 0

    # 2. Satu posisi per emiten: sinyal kedua dalam window h20 tak buka posisi baru.
    n_total += 1
    sinyal2 = np.zeros(140, dtype=bool)
    sinyal2[10] = True
    sinyal2[15] = True  # dalam window h20 (tutup di idx_masuk+20 = 11+20 = 31)
    trades2 = hasilkan_trade(d, sinyal2, "h20", None, tgl2idx)
    ok2 = len(trades2) == 1 and trades2[0]["tgl_sinyal"] == d["tgl"][10]
    print(("  [ok]" if ok2 else "  [GAGAL]") + f" satu posisi per emiten: 2 sinyal dlm window -> {len(trades2)} trade")
    n_ok += 1 if ok2 else 0

    # 3. F1 (desil bawah): emiten dengan rasio nonritel sangat negatif dibuang,
    #    emiten netral (di tengah populasi) tak dibuang.
    n_total += 1
    n_hari = 90
    tgl3 = [f"2021-{1+i//28:02d}-{1+i%28:02d}" for i in range(n_hari)]
    ix = {"broker": 0, "beli_lot": 1, "beli_nilai": 2, "jual_lot": 3, "jual_nilai": 4}

    def bd_konstan(net_ratio: float) -> dict:
        # AK (asing->nonritel) beli/jual sedemikian rupa rasio net/gross = net_ratio.
        beli = 1_000_000.0 * (1 + net_ratio) / 2
        jual = 1_000_000.0 * (1 - net_ratio) / 2
        out = {}
        for t in tgl3:
            out[t] = (beli - jual, 0.0, 0.0, beli + jual, 0.5)
        return out

    bars3 = {}
    feats3 = {}
    di_uni3 = {}
    from bt_broker import fitur_kode as _fk  # sudah diimpor global; alias lokal utk kejelasan
    kode_neg = "NEG"
    d_neg = {"kode": kode_neg, "tgl": tgl3, "o": [100.0] * n_hari, "h": [101.0] * n_hari,
              "l": [99.0] * n_hari, "c": [100.0] * n_hari}
    bars3[kode_neg] = d_neg
    feats3[kode_neg] = _fk(d_neg, bd_konstan(-0.9))
    di_uni3[kode_neg] = np.ones(n_hari, dtype=bool)
    for k in range(1, 6):
        kode_bg = f"BG{k}"
        d_bg = {"kode": kode_bg, "tgl": tgl3, "o": [100.0] * n_hari, "h": [101.0] * n_hari,
                "l": [99.0] * n_hari, "c": [100.0] * n_hari}
        bars3[kode_bg] = d_bg
        feats3[kode_bg] = _fk(d_bg, bd_konstan(0.05 * k))
        di_uni3[kode_bg] = np.ones(n_hari, dtype=bool)
    thr3 = ambang_bawah(feats3, di_uni3, ["rasio_nonritel_5", "rasio_nonritel_10"])
    for kode, feat in feats3.items():
        for col in ("rasio_nonritel_5", "rasio_nonritel_10"):
            feat[col + "_amb10"] = feat["tanggal"].map(thr3[col])
    ok3 = bool((feats3[kode_neg]["rasio_nonritel_5"] <= feats3[kode_neg]["rasio_nonritel_5_amb10"]).iloc[-1])
    ok3 = ok3 and bool((feats3["BG5"]["rasio_nonritel_5"] > feats3["BG5"]["rasio_nonritel_5_amb10"]).iloc[-1])
    print(("  [ok]" if ok3 else "  [GAGAL]") + " F1: emiten rasio nonritel paling negatif jatuh di desil bawah, yang positif tidak")
    n_ok += 1 if ok3 else 0

    # 4. F2 (net_nonritel_N > 0): window net positif vs negatif.
    n_total += 1
    bd_pos = bd_konstan(0.5)   # net positif tiap hari
    bd_neg = bd_konstan(-0.5)  # net negatif tiap hari
    net5_pos = net_nonritel_roll(d_neg, bd_pos, 5)
    net5_neg = net_nonritel_roll(d_neg, bd_neg, 5)
    ok4 = bool((net5_pos.dropna() > 0).all()) and bool((net5_neg.dropna() < 0).all())
    print(("  [ok]" if ok4 else "  [GAGAL]") + " F2: net_nonritel_5 positif utk arus net positif, negatif utk arus net negatif")
    n_ok += 1 if ok4 else 0

    # 5. RBS: bar retest-bertahan tertangkap sebagai True, sisanya False (pola sama bt_papan._uji_rbs).
    n_total += 1
    n5 = 200
    c5 = [85 + i * 0.02 for i in range(n5)]
    h5 = [x + 0.3 for x in c5]
    l5 = [x - 0.3 for x in c5]
    h5[30], c5[30] = 100.0, 99.5
    h5[60], c5[60] = 100.3, 99.8
    level_est = (100.0 + 100.3) / 2
    c5[70] = level_est * 1.02
    h5[70] = c5[70] + 0.3
    l5[75] = level_est * 1.0
    c5[75] = level_est * 1.001
    h5[75] = c5[75] + 0.2
    tgl5 = [f"2020-{1+i//28:02d}-{1+i%28:02d}" for i in range(n5)]
    d5 = {"tgl": tgl5, "o": c5, "h": h5, "l": l5, "c": c5}
    arr5 = rbs_bool_kode(d5, ParamRBS())
    ok5 = bool(arr5[75]) and not bool(arr5[:75].any())
    print(("  [ok]" if ok5 else "  [GAGAL]") + f" RBS: retest bertahan tertangkap di idx 75, diam sebelumnya (nyala: {list(np.flatnonzero(arr5))})")
    n_ok += 1 if ok5 else 0

    # 6. Gerbang tambahan Arah 1: varian F1 mengalahkan F0 -> lulus; F1 kalah dari F0 -> gagal walau PF>1,3.
    n_total += 1
    # trades campuran menang/kalah supaya PF terdefinisi (kalah=0 -> _pf None)
    tr_f0_lemah = [{"return": 0.10}] * 100 + [{"return": -0.10}] * 100   # pf=1.0
    tr_f1_kuat = [{"return": 0.20}] * 100 + [{"return": -0.10}] * 100     # pf=2.0
    by_year_fake = {
        ("obv", "F0", "h5"): {2022: tr_f0_lemah},
        ("obv", "F1n5", "h5"): {2022: tr_f1_kuat},  # menang vs F0
    }
    gate = buat_extra_gate_arah1(by_year_fake)
    menang = gate(("obv", "F1n5", "h5"), 2022, _pf(tr_f1_kuat))
    tr_f0_kuat = [{"return": 0.30}] * 100 + [{"return": -0.10}] * 100      # pf=3.0
    by_year_fake2 = {
        ("obv", "F0", "h5"): {2022: tr_f0_kuat},
        ("obv", "F1n5", "h5"): {2022: tr_f1_kuat},  # kalah dari F0
    }
    gate2 = buat_extra_gate_arah1(by_year_fake2)
    kalah = gate2(("obv", "F1n5", "h5"), 2022, _pf(tr_f1_kuat))
    ok6 = menang is True and kalah is False
    print(("  [ok]" if ok6 else "  [GAGAL]") + f" gerbang F1 vs F0: menang={menang} (harus True), kalah={kalah} (harus False)")
    n_ok += 1 if ok6 else 0

    # 7. ihsg_ret_window: tanggal persis & fallback bisect ke tanggal berikutnya.
    n_total += 1
    ihsg7 = {"tgl": ["2020-01-01", "2020-01-03", "2020-01-06"], "c": [100.0, 110.0, 121.0]}
    fn7 = bangun_ihsg_ret_window(ihsg7)
    r_persis = fn7("2020-01-01", "2020-01-06")
    r_fallback = fn7("2020-01-02", "2020-01-06")  # 01-02 tak ada -> jatuh ke bisect_left -> 01-03
    ok7 = r_persis is not None and abs(r_persis - 0.21) < 1e-9 and r_fallback is not None \
        and abs(r_fallback - (121.0 - 110.0) / 110.0) < 1e-9
    print(("  [ok]" if ok7 else "  [GAGAL]") + f" ihsg_ret_window: persis={r_persis}, fallback={r_fallback}")
    n_ok += 1 if ok7 else 0

    # 8. drawdown_maks: naik terus -> 0; turun lalu naik -> selisih puncak-lembah.
    n_total += 1
    dd_naik = drawdown_maks([{"tgl_keluar": "2020-01-01", "return": 0.05},
                              {"tgl_keluar": "2020-01-02", "return": 0.05}])
    dd_turun = drawdown_maks([{"tgl_keluar": "2020-01-01", "return": 0.10},
                               {"tgl_keluar": "2020-01-02", "return": -0.30},
                               {"tgl_keluar": "2020-01-03", "return": 0.05}])
    ok8 = abs(dd_naik - 0.0) < 1e-9 and abs(dd_turun - 0.30) < 1e-9
    print(("  [ok]" if ok8 else "  [GAGAL]") + f" drawdown_maks: naik={dd_naik} (harus 0), turun={dd_turun} (harus 0,30)")
    n_ok += 1 if ok8 else 0

    print(f"{n_ok}/{n_total} lulus")
    return 0 if n_ok == n_total else 1


# ============================================================================ cli
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--uji", action="store_true")
    ap.add_argument("--resmi", action="store_true")
    a = ap.parse_args()
    if a.uji:
        return uji_bawaan()
    if a.resmi:
        hasil = jalankan_resmi()
        tulis_laporan(hasil)
        tulis_ringkas_json(hasil)
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
