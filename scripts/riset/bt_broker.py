# -*- coding: utf-8 -*-
"""BT Broker — backtest fitur arus broker (#217).

Menumpang mesin `bt_papan.py`: `simulasi_trade`, `ringkas_trades`,
`tulis_hasil`, `ihsg_return`, `muat_emiten`, `muat_ihsg`, `universe_partanggal`
diimpor APA ADANYA — satu mesin return/biaya, sama seperti `bt_indikator.py`.

Data broker: `data-idx/json/broker_tahunan/<KODE>/<TAHUN>.json`, papan
REGULER, SEMUA investor, GROSS. Diringkas ke lima angka per (emiten,tanggal):
`net_nonritel` (asing+bumn+smart), `net_asing`, `net_ritel`, `gross`,
`top3_beli_share`. Kelompok broker dari salinan STATIS `KURASI`
(app/src/lib/dasbor/kelompokBroker.ts, kode->kelompok saja) — bukan
`kategori_broker.json` (dihitung dari jendela terkini, bocor masa depan).

    python scripts/riset/bt_broker.py --uji
    python scripts/riset/bt_broker.py --resmi

## Aturan sinyal (ditetapkan SEBELUM hasil dilihat, spek_bt_broker.md #217)

Ambang = desil teratas rasio LINTAS EMITEN per tanggal, dihitung HANYA dari
populasi di dalam universe (rank_lik <= 150, trailing 60 bar, anti-bias).
- S1: rasio_nonritel_N desil teratas DAN rasio_ritel_N < 0
- S2: rasio_asing_N desil teratas
- S3: rasio_nonritel_N desil teratas DAN close > ema20
Satu posisi per emiten pada satu waktu. Masuk open_h1. Keluar h5/h20/tp_sl
(level=harga masuk, sl_pct=1,5x ATR14%, horizon 20). Biaya 0,0 dan 0,004,
keduanya dilaporkan. 27 varian (S x N x keluar) x 2 biaya.
"""
from __future__ import annotations

import argparse
import bisect
import concurrent.futures as cf
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

from bt_papan import (  # noqa: E402
    BT_DIR, ihsg_return, muat_emiten, muat_ihsg, ringkas_trades,
    simulasi_trade, tulis_hasil, universe_partanggal,
)

BROKER_DIR = AKAR / "data-idx" / "json" / "broker_tahunan"

# Kelompok identitas broker — salinan kode->kelompok dari `KURASI`
# (app/src/lib/dasbor/kelompokBroker.ts, kurasi 22+23 Agu 2026). Hanya
# kode->kelompok disalin, bukan nama sekuritas (tak dipakai di sini).
KELOMPOK: dict[str, str] = {
    # asing
    "AK": "asing", "BK": "asing", "KZ": "asing", "RX": "asing", "ZP": "asing",
    "YU": "asing", "TP": "asing", "AI": "asing", "DR": "asing", "BQ": "asing",
    "XA": "asing", "AG": "asing", "HD": "asing", "GA": "asing", "DP": "asing",
    "RB": "asing", "FS": "asing",
    # bumn
    "CC": "bumn", "NI": "bumn", "OD": "bumn", "DX": "bumn",
    # smart (institusi lokal)
    "LG": "smart", "SQ": "smart", "AZ": "smart", "SS": "smart", "HP": "smart",
    "MG": "smart", "AT": "smart", "PO": "smart", "RF": "smart", "YJ": "smart",
    "GR": "smart", "KI": "smart", "DH": "smart", "EP": "smart", "CD": "smart",
    "LS": "smart", "ES": "smart", "MU": "smart", "MI": "smart", "AO": "smart",
    "TF": "smart", "BR": "smart", "FZ": "smart", "IT": "smart", "SH": "smart",
    "PC": "smart", "ID": "smart", "YB": "smart", "ZR": "smart", "EL": "smart",
    "RS": "smart", "PG": "smart", "SF": "smart", "AF": "smart", "AP": "smart",
    # ritel
    "PD": "ritel", "YP": "ritel", "XC": "ritel", "XL": "ritel", "CP": "ritel",
    "KK": "ritel",
    # lain (golongan Lokal tak dibedakan smart/ritel di sumbernya — kurasi 23 Agu)
    "AR": "lain", "BB": "lain", "BS": "lain", "IF": "lain", "IU": "lain",
    "JB": "lain", "PI": "lain", "QA": "lain", "RG": "lain", "RO": "lain",
    "TS": "lain",
}
NONRITEL = {"asing", "bumn", "smart"}

GROUPS = ("nonritel", "asing", "ritel")
NS = (5, 10, 20)
SS = ("S1", "S2", "S3")
EXITS = ("h5", "h20", "tp_sl")
RATIO_COLS = [f"rasio_{g}_{n}" for n in NS for g in GROUPS]
RANK_MAKS_DEFAULT = 150
BIAYA_LIST = (0.0, 0.004)


def kelompok(kode: str) -> str:
    return KELOMPOK.get(kode, "lain")


# ===================================================================== data broker
def _ringkas_hari_broker(ix: dict[str, int], daftar: list[list]) -> tuple[float, float, float, float, float]:
    ik, ibn, ijn = ix["broker"], ix["beli_nilai"], ix["jual_nilai"]
    net_nonritel = net_asing = net_ritel = gross = 0.0
    beli = []
    for row in daftar:
        bn, jn = float(row[ibn]), float(row[ijn])
        net = bn - jn
        gross += bn
        beli.append(bn)
        grp = kelompok(row[ik])
        if grp in NONRITEL:
            net_nonritel += net
        if grp == "asing":
            net_asing += net
        if grp == "ritel":
            net_ritel += net
    top3 = (sum(sorted(beli, reverse=True)[:3]) / gross) if gross > 0 else 0.0
    return net_nonritel, net_asing, net_ritel, gross, top3


def _muat_broker_satu(kode: str) -> tuple[str, dict[str, tuple]]:
    out: dict[str, tuple] = {}
    d = BROKER_DIR / kode
    if not d.is_dir():
        return kode, out
    for p in sorted(d.glob("*.json")):
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        kolom, hari = j.get("kolom"), j.get("hari")
        if not kolom or not hari:
            continue
        ix = {k: i for i, k in enumerate(kolom)}
        if any(r not in ix for r in ("broker", "beli_nilai", "jual_nilai")):
            continue
        for tgl, isi in hari.items():
            daftar = isi.get("broker") if isinstance(isi, dict) else None
            if daftar:
                out[tgl] = _ringkas_hari_broker(ix, daftar)
    return kode, out


def muat_broker(kode_saja: set[str], proses: int = 8) -> dict[str, dict[str, tuple]]:
    out: dict[str, dict[str, tuple]] = {}
    with cf.ProcessPoolExecutor(max_workers=proses) as ex:
        for kode, hasil in ex.map(_muat_broker_satu, sorted(kode_saja)):
            if hasil:
                out[kode] = hasil
    return out


# ======================================================================== fitur
def fitur_kode(d: dict, bd: dict[str, tuple]) -> pd.DataFrame:
    """Fitur per bar untuk satu emiten — kausal (rolling window ≤ t saja)."""
    n = len(d["tgl"])
    net_nonritel = np.full(n, np.nan)
    net_asing = np.full(n, np.nan)
    net_ritel = np.full(n, np.nan)
    gross = np.full(n, np.nan)
    top3 = np.full(n, np.nan)
    for i, t in enumerate(d["tgl"]):
        v = bd.get(t)
        if v is not None:
            net_nonritel[i], net_asing[i], net_ritel[i], gross[i], top3[i] = v
    c = pd.Series(d["c"], dtype=float)
    h = pd.Series(d["h"], dtype=float)
    l = pd.Series(d["l"], dtype=float)
    feat = pd.DataFrame({
        "tanggal": d["tgl"], "close": c,
        "ema20": c.ewm(span=20, adjust=False).mean(),
        "top3_beli_share": top3,
    })
    s_gross = pd.Series(gross)
    for g, arr in (("nonritel", net_nonritel), ("asing", net_asing), ("ritel", net_ritel)):
        s = pd.Series(arr)
        for N in NS:
            g_sum = s_gross.rolling(N, min_periods=N).sum()
            v_sum = s.rolling(N, min_periods=N).sum()
            rasio = (v_sum / g_sum).where(g_sum != 0)
            feat[f"rasio_{g}_{N}"] = rasio.clip(-1, 1)
    # ATR14 sederhana (rata-rata biasa, bukan Wilder) — "hitung sendiri, sederhana"
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    atr14 = tr.rolling(14, min_periods=14).mean()
    feat["atr_pct"] = (atr14 / c).replace([np.inf, -np.inf], np.nan)
    return feat


def tandai_sinyal(feats: dict[str, pd.DataFrame], di_universe: dict[str, np.ndarray]) -> None:
    """In-place: tambah kolom S1_N/S2_N/S3_N. Ambang desil (quantile 0,9)
    dihitung PER TANGGAL hanya dari baris di_universe True, dikumpulkan
    lintas emiten — persis spek "peringkat lintas emiten di dalam universe"."""
    populasi = [feat.loc[di_universe[kode], ["tanggal"] + RATIO_COLS]
                for kode, feat in feats.items() if di_universe[kode].any()]
    if populasi:
        pop = pd.concat(populasi, ignore_index=True)
        thr = pop.groupby("tanggal")[RATIO_COLS].quantile(0.9)
    else:
        thr = pd.DataFrame(columns=RATIO_COLS)
    thr_map = {col: thr[col].to_dict() for col in RATIO_COLS}
    for kode, feat in feats.items():
        mask = di_universe[kode]
        for col in RATIO_COLS:
            feat[col + "_amb"] = feat["tanggal"].map(thr_map[col])
        for N in NS:
            top_nonritel = feat[f"rasio_nonritel_{N}"] >= feat[f"rasio_nonritel_{N}_amb"]
            top_asing = feat[f"rasio_asing_{N}"] >= feat[f"rasio_asing_{N}_amb"]
            feat[f"S1_{N}"] = top_nonritel & (feat[f"rasio_ritel_{N}"] < 0) & mask
            feat[f"S2_{N}"] = top_asing & mask
            feat[f"S3_{N}"] = top_nonritel & (feat["close"] > feat["ema20"]) & mask


# =================================================================== simulasi
def _hasilkan_trade(d: dict, sinyal_bool: np.ndarray, model_keluar: str,
                     atr_pct: np.ndarray | None, tgl2idx: dict[str, int]) -> list[dict]:
    """Satu posisi per emiten: sinyal diabaikan selama posisi (idx < idx_tutup) masih terbuka."""
    trades: list[dict] = []
    idx_tutup = -1
    for i in range(len(sinyal_bool)):
        if not sinyal_bool[i] or i < idx_tutup:
            continue
        if model_keluar == "tp_sl":
            idx_masuk = i + 1
            if idx_masuk >= len(d["o"]):
                continue
            harga_masuk = d["o"][idx_masuk]
            ap = atr_pct[i] if atr_pct is not None else float("nan")
            if not (ap == ap) or harga_masuk <= 0:  # ap != ap <=> NaN
                continue
            t = simulasi_trade(d, i, "open_h1", "tp_sl", 0.0, level=harga_masuk,
                                sl_pct=1.5 * ap, tpsl_horizon=20)
        else:
            t = simulasi_trade(d, i, "open_h1", model_keluar, 0.0)
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


def dengan_biaya(trades: list[dict], biaya: float) -> list[dict]:
    return [{**t, "return": t["return"] - biaya} for t in trades]


def _pf(trades: list[dict]) -> float | None:
    menang = sum(t["return"] for t in trades if t["return"] > 0)
    kalah = abs(sum(t["return"] for t in trades if t["return"] <= 0))
    return (menang / kalah) if kalah else None


def _simulasi_acak(candidates: list[tuple[str, int]], n: int, exit_: str, biaya: float,
                    bars: dict[str, dict], atr_lookup: dict[str, np.ndarray],
                    rng: random.Random) -> list[dict]:
    trades: list[dict] = []
    tries, batas = 0, n * 50 + 200
    while len(trades) < n and tries < batas and candidates:
        tries += 1
        kode, i = rng.choice(candidates)
        d = bars[kode]
        if exit_ == "tp_sl":
            idx_masuk = i + 1
            if idx_masuk >= len(d["o"]):
                continue
            harga_masuk = d["o"][idx_masuk]
            ap = atr_lookup[kode][i]
            if not (ap == ap) or harga_masuk <= 0:
                continue
            t = simulasi_trade(d, i, "open_h1", "tp_sl", biaya, level=harga_masuk,
                                sl_pct=1.5 * ap, tpsl_horizon=20)
        else:
            t = simulasi_trade(d, i, "open_h1", exit_, biaya)
        if t is not None:
            trades.append(t)
    return trades


# ==================================================================== orkestrasi
def label_varian(s: str, n: int, exit_: str) -> str:
    return f"broker-{s.lower()}-n{n}-{exit_}"


def jalankan_resmi(rank_maks: int = RANK_MAKS_DEFAULT) -> dict:
    t0 = time.time()
    log: list[str] = []

    def cetak(msg: str) -> None:
        s = f"[{time.time()-t0:6.1f}s] {msg}"
        print(s)
        log.append(s)

    cetak("Memuat OHLCV ...")
    bars = muat_emiten()
    ihsg = muat_ihsg()
    cetak(f"  {len(bars)} emiten")

    cetak("Memuat broker_tahunan (8 proses) ...")
    broker_raw = muat_broker(set(bars))
    cetak(f"  {len(broker_raw)} emiten punya data broker")

    cetak("Menghitung fitur per emiten ...")
    feats = {kode: fitur_kode(d, broker_raw.get(kode, {})) for kode, d in bars.items()}

    cetak("Universe (rank_lik trailing 60 bar, rank <= %d) ..." % rank_maks)
    rank = universe_partanggal(bars, 60)
    di_universe: dict[str, np.ndarray] = {}
    for kode, d in bars.items():
        r = rank.get(kode)
        if r is None:
            di_universe[kode] = np.zeros(len(d["tgl"]), dtype=bool)
        else:
            di_universe[kode] = (r.notna() & (r <= rank_maks)).to_numpy()

    cetak("Menandai ambang desil & sinyal S1/S2/S3 ...")
    tandai_sinyal(feats, di_universe)

    cetak("tgl->idx per emiten ...")
    tgl2idx = {kode: {t: i for i, t in enumerate(d["tgl"])} for kode, d in bars.items()}
    atr_lookup = {kode: feats[kode]["atr_pct"].to_numpy() for kode in bars}

    cetak("Menjalankan 27 varian (biaya 0,0) ...")
    hasil0: dict[tuple[str, int, str], list[dict]] = {}
    for s in SS:
        for n in NS:
            for exit_ in EXITS:
                trades: list[dict] = []
                for kode, d in bars.items():
                    feat = feats[kode]
                    sinyal_bool = feat[f"{s}_{n}"].to_numpy()
                    ap = atr_lookup[kode] if exit_ == "tp_sl" else None
                    trades.extend(_hasilkan_trade(d, sinyal_bool, exit_, ap, tgl2idx[kode]))
                hasil0[(s, n, exit_)] = trades
    cetak(f"  {sum(len(v) for v in hasil0.values())} trade total (biaya 0)")

    cetak("Menulis 27 hasil (biaya 0) ke data-idx/json/bt/ ...")
    for (s, n, exit_), trades in hasil0.items():
        strategi = label_varian(s, n, exit_)
        params = {
            "strategi": strategi, "kelompok_sinyal": s, "n_jendela": n,
            "model_masuk": "open_h1", "model_keluar": exit_,
            "rank_maks": rank_maks, "biaya_roundtrip": 0.0,
            "mulai": "2016-01-01", "akhir": None,
        }
        akhir_data = max((t["tgl_keluar"] for t in trades), default=None)
        ring = ringkas_trades(trades, ihsg_return(ihsg, "2016-01-01", None), 0.0, params)
        tulis_hasil(strategi, params, ring, trades, akhir_data)

    hasil_biaya = {0.0: hasil0, 0.004: {k: dengan_biaya(v, 0.004) for k, v in hasil0.items()}}

    cetak("Membangun kandidat acak per tahun (universe) ...")
    candidates_by_year: dict[int, list[tuple[str, int]]] = {}
    for kode, d in bars.items():
        mask = di_universe[kode]
        for i, t in enumerate(d["tgl"]):
            if mask[i]:
                candidates_by_year.setdefault(int(t[:4]), []).append((kode, i))

    cetak("Menghitung walk-forward + pembanding acak per biaya ...")
    laporan: dict[float, dict] = {}
    rng = random.Random(217)
    for biaya in BIAYA_LIST:
        hasil = hasil_biaya[biaya]
        per_combo_year: dict[tuple, dict[int, dict]] = {}
        for combo, trades in hasil.items():
            by_year: dict[int, list[dict]] = {}
            for t in trades:
                by_year.setdefault(int(t["tgl_sinyal"][:4]), []).append(t)
            stat = {}
            for y, ts in by_year.items():
                n_ = len(ts)
                stat[y] = {
                    "n": n_, "pf": _pf(ts),
                    "win_rate": (sum(1 for t in ts if t["return"] > 0) / n_) if n_ else None,
                    "ekspektansi": statistics.mean(t["return"] for t in ts) if ts else None,
                }
            per_combo_year[combo] = stat

        baris_wf = []
        for y in range(2018, 2027):
            prev = y - 1
            kandidat = [(combo, per_combo_year[combo].get(prev)) for combo in per_combo_year]
            kandidat = [(c, st) for c, st in kandidat if st and st["n"] >= 30 and st["pf"] is not None]
            if not kandidat:
                baris_wf.append({"tahun": y, "varian": None, "n": 0, "win_rate": None, "pf": None,
                                  "ekspektansi": None, "pf_acak_rata": None, "pf_acak_p95": None,
                                  "ihsg": ihsg_return(ihsg, f"{y}-01-01", f"{y}-12-31")})
                continue
            combo_pilih = max(kandidat, key=lambda x: x[1]["pf"])[0]
            st_y = per_combo_year[combo_pilih].get(y, {"n": 0, "pf": None, "win_rate": None, "ekspektansi": None})
            n_y = st_y["n"]
            pf_acak_rata = pf_acak_p95 = None
            if n_y > 0:
                s_, n_j, exit_ = combo_pilih
                pfs = []
                for _ in range(20):
                    tr_acak = _simulasi_acak(candidates_by_year.get(y, []), n_y, exit_, biaya,
                                              bars, atr_lookup, rng)
                    pf_ = _pf(tr_acak)
                    if pf_ is not None:
                        pfs.append(pf_)
                if pfs:
                    pf_acak_rata = statistics.mean(pfs)
                    pf_acak_p95 = float(np.percentile(pfs, 95))
            baris_wf.append({
                "tahun": y, "varian": label_varian(*combo_pilih), "n": n_y,
                "win_rate": st_y["win_rate"], "pf": st_y["pf"], "ekspektansi": st_y["ekspektansi"],
                "pf_acak_rata": pf_acak_rata, "pf_acak_p95": pf_acak_p95,
                "ihsg": ihsg_return(ihsg, f"{y}-01-01", f"{y}-12-31"),
            })

        lolos = 0
        for row in baris_wf:
            if row["tahun"] in range(2022, 2027) and row["pf"] is not None and row["pf"] > 1.3 \
                    and row["pf_acak_p95"] is not None and row["pf"] > row["pf_acak_p95"]:
                lolos += 1
        vonis = lolos >= 3

        # kunci tuple (S,N,exit) -> label string, JSON tak bisa kunci tuple
        per_combo_year_str = {label_varian(*combo): stat for combo, stat in per_combo_year.items()}
        laporan[biaya] = {"per_combo_year": per_combo_year_str, "walk_forward": baris_wf,
                           "lolos_kriteria": lolos, "vonis": vonis}

    durasi = time.time() - t0
    cetak(f"Selesai --resmi, {durasi/60:.1f} menit")
    return {"bars_n": len(bars), "rank_maks": rank_maks, "durasi_detik": durasi,
            "laporan": laporan, "log": log}


# ========================================================================= uji
def _sintetis_dasar(n: int = 120, kode: str = "TEST") -> dict:
    tgl = [f"2020-{1+i//28:02d}-{1+i%28:02d}" for i in range(n)]
    o = [100.0] * n
    h = [101.0] * n
    l = [99.0] * n
    c = [100.0] * n
    for i in range(50, min(61, n)):
        c[i] = 100.0 + (i - 49) * 2.0
        o[i] = c[i] - 1
        h[i] = c[i] + 0.5
        l[i] = c[i] - 1.5
    return {"kode": kode, "tgl": tgl, "o": o, "h": h, "l": l, "c": c}


def _sintetis_broker(n: int = 120) -> dict[str, tuple]:
    out: dict[str, tuple] = {}
    tgl = [f"2020-{1+i//28:02d}-{1+i%28:02d}" for i in range(n)]
    ix = {"broker": 0, "beli_lot": 1, "beli_nilai": 2, "jual_lot": 3, "jual_nilai": 4}
    for i in range(n):
        if 40 <= i <= 49:
            # AK (asing) beli besar, YP (ritel) jual besar
            daftar = [["AK", 1000, 100_000_000, 0, 0, 5, 0, "A"],
                      ["YP", 0, 0, 900, 90_000_000, 0, 30, "A"]]
        else:
            daftar = [["AK", 10, 1_000_000, 10, 1_000_000, 1, 1, "A"],
                      ["YP", 10, 1_000_000, 10, 1_000_000, 1, 1, "A"]]
        out[tgl[i]] = _ringkas_hari_broker(ix, daftar)
    return out


def _sintetis_broker_latar(n: int, level: float) -> dict[str, tuple]:
    """Emiten latar belakang tanpa lonjakan — konstan setiap hari, dipakai
    supaya populasi desil di uji tak cuma 1 anggota (populasi 1 anggota
    membuat 'top decile' trivial benar setiap saat, lihat catatan uji 1)."""
    out: dict[str, tuple] = {}
    tgl = [f"2020-{1+i//28:02d}-{1+i%28:02d}" for i in range(n)]
    ix = {"broker": 0, "beli_lot": 1, "beli_nilai": 2, "jual_lot": 3, "jual_nilai": 4}
    lot = int(level)
    daftar = [["AK", lot, lot * 1000, 0, 0, 1, 0, "A"], ["YP", lot, lot * 1000, 0, 0, 1, 0, "A"]]
    for t in tgl:
        out[t] = _ringkas_hari_broker(ix, daftar)
    return out


def uji_bawaan() -> int:
    n_ok = n_total = 0

    # 1. Sintetis: S1 & S2 N=10 harus menyala di hari 44-49, tak sebelum hari 40.
    #    Populasi desil butuh >1 anggota (lihat _sintetis_broker_latar) — dengan
    #    1 emiten saja, quantile(0,9) dari satu nilai = nilai itu sendiri, jadi
    #    "top decile" selalu benar tanpa syarat (bukan tes yang berarti).
    n_total += 1
    n_hari = 120
    d = _sintetis_dasar(n_hari, "TEST")
    bd = _sintetis_broker(n_hari)
    feats_uji = {"TEST": fitur_kode(d, bd)}
    di_uji = {"TEST": np.ones(n_hari, dtype=bool)}
    for k in range(1, 6):  # 5 emiten latar, level konstan jauh di bawah lonjakan TEST
        kode_bg = f"BG{k}"
        d_bg = _sintetis_dasar(n_hari, kode_bg)
        bd_bg = _sintetis_broker_latar(n_hari, level=1000.0 * k)
        feats_uji[kode_bg] = fitur_kode(d_bg, bd_bg)
        di_uji[kode_bg] = np.ones(n_hari, dtype=bool)
    tandai_sinyal(feats_uji, di_uji)
    feat = feats_uji["TEST"]
    s1 = feat["S1_10"].to_numpy()
    s2 = feat["S2_10"].to_numpy()
    ok = (not s1[:40].any()) and (not s2[:40].any()) and s1[44:50].any() and s2[44:50].any()
    print(("  [ok]" if ok else "  [GAGAL]") + " S1/S2 N=10 menyala hari 44-49, diam sebelum hari 40"
          f" (S1 nyala di: {list(np.flatnonzero(s1))}, S2 nyala di: {list(np.flatnonzero(s2))})")
    n_ok += 1 if ok else 0

    # 2. Rasio dalam [-1,1]; gross 0 -> NaN.
    n_total += 1
    kolom_ix = {"broker": 0, "beli_lot": 1, "beli_nilai": 2, "jual_lot": 3, "jual_nilai": 4}
    bd2 = {}
    tgl2 = [f"2021-01-{i+1:02d}" for i in range(30)]
    for i, t in enumerate(tgl2):
        if i < 15:
            bd2[t] = _ringkas_hari_broker(kolom_ix, [])  # gross 0
        else:
            bd2[t] = _ringkas_hari_broker(kolom_ix, [["AK", 100, 10_000_000, 10, 1_000_000, 5, 1, "A"]])
    d2 = {"kode": "T2", "tgl": tgl2, "o": [100.0]*30, "h": [101.0]*30, "l": [99.0]*30, "c": [100.0]*30}
    feat2 = fitur_kode(d2, bd2)
    r = feat2["rasio_asing_5"]
    # Jendela 5-hari (window mundur) ber-gross-0 total selesai di baris 0..14
    # (window terakhir yang seluruhnya di dalam 15 hari gross-0 pertama);
    # baris 15 dst window-nya sudah menyentuh hari ber-gross > 0.
    ok2 = bool(r.iloc[:15].isna().all()) and bool(r.iloc[15:].notna().all()) \
        and bool(r.dropna().between(-1, 1).all())
    print(("  [ok]" if ok2 else "  [GAGAL]") + " rasio dalam [-1,1]; jendela ber-gross-0 -> NaN")
    n_ok += 1 if ok2 else 0

    # 3. Anti-bocor: fitur di bar t sama bila data sesudah t dipotong.
    n_total += 1
    d3 = _sintetis_dasar(80)
    bd3 = _sintetis_broker(80)
    feat_full = fitur_kode(d3, bd3)
    cocok = True
    for t in (30, 45, 60):
        d3_potong = {k: (v[: t + 1] if isinstance(v, list) else v) for k, v in d3.items()}
        bd3_potong = {tgl: v for tgl, v in bd3.items() if tgl <= d3["tgl"][t]}
        feat_potong = fitur_kode(d3_potong, bd3_potong)
        for col in ["ema20", "atr_pct"] + RATIO_COLS:
            a, b = feat_full[col].iloc[t], feat_potong[col].iloc[t]
            sama = (pd.isna(a) and pd.isna(b)) or abs(a - b) < 1e-9
            cocok = cocok and sama
    print(("  [ok]" if cocok else "  [GAGAL]") + " anti-bocor: fitur bar t identik walau data sesudahnya dipotong")
    n_ok += 1 if cocok else 0

    # 4. Satu posisi per emiten: dua sinyal dalam 5 hari (keluar h5) -> 1 trade.
    n_total += 1
    d4 = _sintetis_dasar(60)
    tgl2idx4 = {t: i for i, t in enumerate(d4["tgl"])}
    sinyal4 = np.zeros(60, dtype=bool)
    sinyal4[10] = True
    sinyal4[13] = True  # dalam 5 hari dari sinyal pertama (keluar h5 -> idx_tutup=10+1+5=16)
    trades4 = _hasilkan_trade(d4, sinyal4, "h5", None, tgl2idx4)
    ok4 = len(trades4) == 1 and trades4[0]["tgl_sinyal"] == d4["tgl"][10]
    print(("  [ok]" if ok4 else "  [GAGAL]") + f" satu posisi per emiten: 2 sinyal dlm 5 hari -> {len(trades4)} trade")
    n_ok += 1 if ok4 else 0

    print(f"{n_ok}/{n_total} lulus")
    return 0 if n_ok == n_total else 1


# ============================================================================ cli
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--uji", action="store_true")
    ap.add_argument("--resmi", action="store_true")
    ap.add_argument("--rank-maks", type=int, default=RANK_MAKS_DEFAULT)
    ap.add_argument("--keluaran", default=None, help="tulis ringkasan JSON hasil --resmi ke path ini")
    a = ap.parse_args()
    if a.uji:
        return uji_bawaan()
    if a.resmi:
        hasil = jalankan_resmi(a.rank_maks)
        if a.keluaran:
            Path(a.keluaran).write_text(
                json.dumps(hasil, ensure_ascii=False, default=str, indent=1), encoding="utf-8")
            print(f"  ringkasan ditulis ke {a.keluaran}")
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
