# -*- coding: utf-8 -*-
"""BT Papan — mesin backtest untuk pola RBS, pola Gap, dan preset Screener.

Spek: docs/spek-dev-papan/spek_rbs_gap_intraday.md §4 (algoritme RBS/Gap di
§1/§2). Angka acuan validasi: docs/spek-dev-papan/riset_rbs_gap_hasil.md.

Baca SAJA data-idx/json/ohlcv_stockbit/<KODE>.json (17 kolom Stockbit chartbit
harian). Tulis data-idx/json/bt/<strategi>-<hash8>.json (+ .json.gz kalau
>5MB) dan bt/index.json. NOL jaringan, NOL token, NOL git.

Jalankan dari akar repo:
    python scripts/riset/bt_papan.py --uji                 # swauji sintetis
    python scripts/riset/bt_papan.py --semesta-hari-ini     # validasi vs riset_rbs_gap_hasil.md
    python scripts/riset/bt_papan.py --resmi                 # run beku (rbs, rbs-tpsl, gap, preset-scalping, preset-swing)

## Dua sistem peringkat, jangan tertukar
1. **Universe likuiditas** (anti-bias run resmi): rata-rata `value` 60 bar
   SEBELUM tanggal sinyal, per tanggal, lintas seluruh emiten — menentukan
   apakah sinyal itu ikut dihitung dalam top-N.
2. **`peringkat_value` preset** (kriteria "50 besar nilai transaksi hari
   ini"): rank `value` HARI ITU JUGA (bukan trailing), sama seperti
   `kartu_analisa.py`. Ini bagian dari preset itu sendiri, bukan gerbang
   universe.
Keduanya dihitung lintas SELURUH emiten (bukan cuma top-N run), karena
begitulah presetScreener.ts dipakai di produk (kartu harian, bukan hasil
sudah disaring).

## Kenapa Ichimoku/regresi ditulis ulang di sini, bukan impor kartu_analisa
`ka.ichimoku()`/`ka.regresi60()` HANYA menghitung titik TERAKHIR sebuah
deret — pas untuk kartu harian (satu snapshot), salah untuk backtest yang
butuh nilai itu di SETIAP bar historis. Dipanggil dalam loop dengan slice
`c[i-59:i+1]` per bar akan lambat (ratusan ribu panggilan Python) dan gampang
salah offset. Jadi dipakai ULANG rumusnya, DIVEKTORKAN dengan
pandas .rolling()/.shift() — hasilnya wajib sama persis dengan versi kartu
per titik, dibuktikan di --uji (`_uji_vektor_cocok_kartu`).
`ma()`, `bollinger()` sendiri dipakai APA ADANYA (ka.ma/ka.bollinger) karena
di situ tak ada loop mahal — dipanggil sekali per titik yang dibutuhkan.
`ka.pivot_idx()` dan `ka.fraksi()` dipakai apa adanya (RBS pivot & tick gap).
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kartu_analisa as ka  # noqa: E402  (ma/bollinger/pivot_idx/fraksi — lihat docstring)

AKAR = Path(__file__).resolve().parents[2]
STOCKBIT = AKAR / "data-idx" / "json" / "ohlcv_stockbit"
BT_DIR = AKAR / "data-idx" / "json" / "bt"
BIAYA_DEFAULT = 0.003  # 0,3% pulang-pergi, wajib selalu tercatat di hasil


# =========================================================== muat data mentah
def num(v) -> bool:
    return v is not None and isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v))


def muat_emiten(kode_saja: set[str] | None = None) -> dict[str, dict]:
    """kode -> array kolom (list python, bukan numpy — dipakai loop RBS/Gap
    yang butuh indeks bar biasa). IHSG dikecualikan (dibaca terpisah)."""
    out: dict[str, dict] = {}
    for p in sorted(STOCKBIT.glob("*.json")):
        kode = p.stem
        if kode == "IHSG" or (kode_saja is not None and kode not in kode_saja):
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        kolom, bar = d.get("kolom"), d.get("bar")
        if not kolom or not bar:
            continue
        idx = {k: i for i, k in enumerate(kolom)}
        req = ["tanggal", "open", "high", "low", "close", "value", "frequency", "foreignbuy", "foreignsell", "lot"]
        if any(r not in idx for r in req):
            continue
        bar = sorted(bar, key=lambda r: r[idx["tanggal"]])
        out[kode] = {
            "kode": kode,
            "tgl": [r[idx["tanggal"]] for r in bar],
            "o": [float(r[idx["open"]]) for r in bar],
            "h": [float(r[idx["high"]]) for r in bar],
            "l": [float(r[idx["low"]]) for r in bar],
            "c": [float(r[idx["close"]]) for r in bar],
            "value": [float(r[idx["value"]]) for r in bar],
            "freq": [float(r[idx["frequency"]]) for r in bar],
            "fb": [float(r[idx["foreignbuy"]]) for r in bar],
            "fs": [float(r[idx["foreignsell"]]) for r in bar],
            "lot": [float(r[idx["lot"]]) for r in bar],
        }
    return out


def muat_ihsg() -> dict | None:
    p = STOCKBIT / "IHSG.json"
    if not p.exists():
        return None
    d = json.loads(p.read_text(encoding="utf-8"))
    idx = {k: i for i, k in enumerate(d["kolom"])}
    bar = sorted(d["bar"], key=lambda r: r[idx["tanggal"]])
    return {"tgl": [r[idx["tanggal"]] for r in bar], "c": [float(r[idx["close"]]) for r in bar]}


def potong_periode(d: dict, mulai: str | None, akhir: str | None) -> dict:
    tgl = d["tgl"]
    lo = 0 if not mulai else next((i for i, t in enumerate(tgl) if t >= mulai), len(tgl))
    hi = len(tgl) if not akhir else next((i for i, t in enumerate(tgl) if t > akhir), len(tgl))
    return {k: (v[lo:hi] if isinstance(v, list) else v) for k, v in d.items()}


# =============================================================== pola RBS v1
class ParamRBS:
    def __init__(self, **kw):
        self.pivot_k = kw.get("pivot_k", 5)
        self.tol = kw.get("tol", 0.015)
        self.jendela = kw.get("jendela", 120)
        self.sentuh_min = kw.get("sentuh_min", 2)
        self.breakout_pct = kw.get("breakout_pct", 0.01)
        self.breakout_max_bar = kw.get("breakout_max_bar", 500)  # ponytail: batas cari breakout, resistance >2th tanpa breakout dianggap tak actionable
        self.cek_belum_tutup_bar = kw.get("cek_belum_tutup_bar", 500)  # jendela "belum ditutup di atasnya", sama seperti sr(lihat=500) kartu_analisa.py
        self.retest_tol = kw.get("retest_tol", 0.015)
        self.retest_bar = kw.get("retest_bar", 40)
        self.konfirmasi_pct = kw.get("konfirmasi_pct", 0.02)
        self.konfirmasi_bar = kw.get("konfirmasi_bar", 3)
        self.sl_pct = kw.get("sl_pct", 0.03)
        self.tpsl_horizon = kw.get("tpsl_horizon", 20)

    def dict(self) -> dict:
        return {k: v for k, v in vars(self).items()}


def _klaster_rbs(h: list[float], c: list[float], p: ParamRBS) -> list[dict]:
    """Klaster pivot high jadi level resistance, KAUSAL (tak mengintip masa
    depan). Greedy first-match: pivot baru bergabung ke klaster tercocok
    pertama dalam toleransi & jendela; kalau tak ada, klaster baru.
    ponytail: greedy, bukan optimal-global — cukup untuk mesin backtest,
    upgrade ke pencocokan Hungarian kalau nanti perlu presisi klaster lebih."""
    piv = ka.pivot_idx(h, p.pivot_k, rendah=False)
    n = len(c)
    c_np = np.asarray(c, dtype=float)
    klaster: list[dict] = []
    lahir: list[dict] = []
    for i in piv:
        conf_t = i + p.pivot_k
        if conf_t >= n:
            continue
        lvl = h[i]
        # buang klaster yang jendelanya sudah lewat — tak mungkin dipakai lagi
        klaster = [kl for kl in klaster if i - kl["idxs"][0] <= p.jendela]
        cocok = None
        for kl in klaster:
            if abs(lvl - kl["level"]) / kl["level"] <= p.tol:
                cocok = kl
                break
        if cocok is None:
            klaster.append({"idxs": [i], "level": lvl, "lahir": False})
            continue
        cocok["idxs"].append(i)
        cocok["level"] = sum(h[x] for x in cocok["idxs"]) / len(cocok["idxs"])
        if len(cocok["idxs"]) >= p.sentuh_min and not cocok["lahir"]:
            # "belum PERNAH ditutup di atasnya" (riset_rbs_gap_hasil.md) — diperiksa
            # atas jendela lookback yang sama dengan konvensi S/R lain di repo ini
            # (`sr(..., lihat=500)` kartu_analisa.py), bukan cuma rentang klaster
            # sendiri (longgar, over-count) atau seluruh riwayat sejak IPO (terlalu
            # ketat untuk saham yang sudah naik berkali lipat — under-count).
            cek_mulai = max(0, conf_t - p.cek_belum_tutup_bar)
            if not np.any(c_np[cek_mulai: conf_t + 1] > cocok["level"]):
                lahir.append({"level": cocok["level"], "lahir_idx": conf_t, "sentuhan": len(cocok["idxs"])})
            cocok["lahir"] = True
    return lahir


def deteksi_rbs(d: dict, p: ParamRBS) -> list[dict]:
    """Untuk satu emiten: daftar level yang LAHIR lalu jalani tahapannya
    (breakout -> retest -> bertahan/gagal -> konfirmasi). Satu entri per
    level yang lahir dan sempat breakout; level yang lahir tapi tak pernah
    breakout dalam `breakout_max_bar` diabaikan (bukan sinyal)."""
    h, c, l, tgl = d["h"], d["c"], d["l"], d["tgl"]
    n = len(c)
    hasil = []
    for lv in _klaster_rbs(h, c, p):
        level, start = lv["level"], lv["lahir_idx"]
        bo_th = level * (1 + p.breakout_pct)
        batas_bo = min(n, start + p.breakout_max_bar)
        t_bo = next((t for t in range(start, batas_bo) if c[t] > bo_th), None)
        if t_bo is None:
            continue
        rec = {
            "level": level, "sentuhan": lv["sentuhan"], "lahir_idx": start,
            "breakout_idx": t_bo, "tgl_breakout": tgl[t_bo], "status": "breakout",
        }
        lo_b, hi_b = level * (1 - p.retest_tol), level * (1 + p.retest_tol)
        batas_rt = min(n, t_bo + 1 + p.retest_bar)
        t_rt = next((t for t in range(t_bo + 1, batas_rt) if lo_b <= l[t] <= hi_b), None)
        if t_rt is None:
            hasil.append(rec)
            continue
        bertahan = c[t_rt] >= level
        rec.update({"retest_idx": t_rt, "tgl_retest": tgl[t_rt], "bertahan": bertahan,
                    "status": "sah" if bertahan else "gagal"})
        if bertahan:
            konf_th = level * (1 + p.konfirmasi_pct)
            batas_k = min(n, t_rt + 1 + p.konfirmasi_bar)
            t_k = next((t for t in range(t_rt + 1, batas_k) if c[t] >= konf_th), None)
            if t_k is not None:
                rec.update({"konfirmasi_idx": t_k, "tgl_konfirmasi": tgl[t_k], "status": "konfirmasi"})
        hasil.append(rec)
    return hasil


# =============================================================== pola Gap v1
def deteksi_gap(d: dict, arah: str, tol_pct: float = 0.01) -> list[dict]:
    o, h, l, c, tgl = d["o"], d["h"], d["l"], d["c"], d["tgl"]
    n = len(c)
    out = []
    for t in range(1, n):
        if arah == "naik":
            acu = h[t - 1]
            amb = acu + max(2 * ka.fraksi(acu), tol_pct * acu)
            if o[t] < amb:
                continue
            t_isi = next((j for j in range(t, n) if l[j] <= acu), None)
        else:
            acu = l[t - 1]
            amb = acu - max(2 * ka.fraksi(acu), tol_pct * acu)
            if o[t] > amb:
                continue
            t_isi = next((j for j in range(t, n) if h[j] >= acu), None)
        out.append({
            "idx": t, "tgl": tgl[t], "acuan": acu, "gap_pct": (o[t] - acu) / acu,
            "terisi_idx": t_isi, "hari_terisi": (t_isi - t) if t_isi is not None else None,
        })
    return out


# ======================================================== indikator preset v1
def _regresi_vect(c: np.ndarray, n: int = 60) -> np.ndarray:
    """Regresi linear 60-bar bergulir, tervektorkan. Rumus identik
    `ka.regresi60()`: x=0..n-1, posisi = (close_terakhir - fitted) / sigma
    residu populasi. Kesamaan dibuktikan di --uji."""
    m = len(c)
    out = np.full(m, np.nan)
    if m < n:
        return out
    win = np.lib.stride_tricks.sliding_window_view(c, n)  # (m-n+1, n)
    x = np.arange(n, dtype=float)
    xbar = (n - 1) / 2
    xc = x - xbar
    sxx = float((xc ** 2).sum())
    ybar = win.mean(axis=1)
    sxy = win @ xc
    slope = sxy / sxx
    intersep = ybar - slope * xbar
    fitted = intersep[:, None] + slope[:, None] * x[None, :]
    sigma_r = np.sqrt(((win - fitted) ** 2).mean(axis=1))
    tengah = intersep + slope * (n - 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        posisi = np.where(sigma_r > 0, (win[:, -1] - tengah) / sigma_r, np.nan)
    out[n - 1:] = posisi
    return out


def hitung_indikator_preset(d: dict) -> pd.DataFrame:
    """Ruas presetScreener.ts per bar, tervektorkan dengan pandas. Kolom
    market-wide (`peringkat_value`, `ukuranOrderP25`, `net_asing_rp` sudah
    ada di sini via fb/fs) ditempel belakangan oleh pemanggil."""
    c = pd.Series(d["c"], dtype=float)
    h = pd.Series(d["h"], dtype=float)
    l = pd.Series(d["l"], dtype=float)
    ma20 = c.rolling(20).mean()
    sigma20 = c.rolling(20).std(ddof=0)  # populasi, sama seperti ka.bollinger
    tenkan = (h.rolling(9).max() + l.rolling(9).min()) / 2
    kijun = (h.rolling(26).max() + l.rolling(26).min()) / 2
    senkou_a_aktif = ((tenkan + kijun) / 2).shift(26)
    senkou_b_aktif = ((h.rolling(52).max() + l.rolling(52).min()) / 2).shift(26)
    di_atas_kumo = pd.Series(np.where(c > np.maximum(senkou_a_aktif, senkou_b_aktif), True, False), index=c.index)
    di_atas_kumo = di_atas_kumo.where(senkou_a_aktif.notna() & senkou_b_aktif.notna())
    freq = pd.Series(d["freq"], dtype=float)
    lot = pd.Series(d["lot"], dtype=float)
    ukuran_order = (lot / freq).replace([np.inf, -np.inf], np.nan)
    return pd.DataFrame({
        "tanggal": d["tgl"],
        "harga": c,
        "ma5": c.rolling(5).mean(),
        "ma20": ma20,
        "ma50": c.rolling(50).mean(),
        "posisi_bb": (c - ma20) / (2 * sigma20),
        "di_atas_kumo": di_atas_kumo,
        "posisi_regresi": _regresi_vect(c.to_numpy(), 60),
        "freq": freq,
        "ukuran_order": ukuran_order,
        "net_asing_rp": pd.Series(d["fb"], dtype=float) - pd.Series(d["fs"], dtype=float),
    })


def bangun_pasar_harian(bars: dict[str, dict]) -> dict[str, pd.DataFrame]:
    """kode -> DataFrame selaras d['tgl'] berisi `peringkat_value` (rank
    `value` HARI ITU lintas SELURUH emiten) dan `ukuranOrderP25` (persentil
    25 `ukuran_order` HARI ITU). Kriteria preset ini relatif-pasar-hari-itu,
    BUKAN trailing — beda dari universe likuiditas run resmi."""
    frames = []
    for kode, d in bars.items():
        lot = pd.Series(d["lot"], dtype=float)
        freq = pd.Series(d["freq"], dtype=float)
        frames.append(pd.DataFrame({
            "kode": kode, "tanggal": d["tgl"], "value": d["value"],
            "ukuran_order": (lot / freq).replace([np.inf, -np.inf], np.nan),
        }))
    m = pd.concat(frames, ignore_index=True)
    m["peringkat_value"] = m.groupby("tanggal")["value"].rank(ascending=False, method="first")
    m["p25"] = m.groupby("tanggal")["ukuran_order"].transform(lambda s: s.quantile(0.25))
    out = {}
    for kode, g in m.groupby("kode", sort=False):
        out[kode] = g[["peringkat_value", "p25"]].reset_index(drop=True)
    return out


PRESET_KRITERIA = {
    # id -> (v_i lambda df->Series bool valid, c_i lambda df->Series bool lolos)
    "scalping": [
        (lambda df: df.peringkat_value.notna(), lambda df: df.peringkat_value <= 50),
        (lambda df: df.freq.notna(), lambda df: df.freq >= 10_000),
        (lambda df: df.ukuran_order.notna() & df.ukuranOrderP25.notna(), lambda df: df.ukuran_order <= df.ukuranOrderP25),
        (lambda df: df.ma5.notna() & df.ma20.notna(), lambda df: df.ma5 > df.ma20),
        (lambda df: df.posisi_bb.notna(), lambda df: df.posisi_bb >= 0.5),
        (lambda df: df.harga.notna(), lambda df: df.harga > 50),
        # arus-broker (label_accdist) sengaja TAK ADA di sini — data broker
        # belum tersedia untuk backtest historis; kriteria itu SELALU
        # 'tak-terukur', persis spek: "JANGAN dianggap gagal".
    ],
    "swing": [
        (lambda df: df.harga.notna() & df.ma20.notna() & df.ma50.notna(), lambda df: (df.harga > df.ma20) & (df.ma20 > df.ma50)),
        (lambda df: df.di_atas_kumo.notna(), lambda df: df.di_atas_kumo.astype(bool)),
        (lambda df: df.posisi_regresi.notna(), lambda df: df.posisi_regresi >= 0),
        (lambda df: df.net_asing_rp.notna(), lambda df: df.net_asing_rp > 0),
    ],
}


def sinyal_preset(df: pd.DataFrame, preset_id: str) -> pd.Series:
    """True pada tanggal-bar yang SEMUA kriteria terukur lolos (skor=1,0),
    dan minimal satu kriteria terukur — persis `jalankanPreset()` presetScreener.ts
    dengan implikasi 'sinyal bawaan = seluruh kriteria TERUKUR lolos'."""
    gagal_any = pd.Series(False, index=df.index)
    ada_terukur = pd.Series(False, index=df.index)
    for v_fn, c_fn in PRESET_KRITERIA[preset_id]:
        v, c = v_fn(df), c_fn(df)
        gagal_any = gagal_any | (v & ~c)
        ada_terukur = ada_terukur | v
    return ada_terukur & ~gagal_any


# ==================================================== universe likuiditas
def universe_partanggal(bars: dict[str, dict], n_bar_trailing: int = 60) -> dict[str, pd.Series]:
    """kode -> Series `rank_lik` selaras d['tgl'] (rank rata2 `value` 60 bar
    SEBELUM tanggal itu, lintas seluruh emiten, per tanggal). NaN = belum
    cukup riwayat (<60 bar) -> tak pernah masuk top-N mana pun."""
    frames = []
    for kode, d in bars.items():
        v = pd.Series(d["value"], dtype=float)
        trail = v.shift(1).rolling(n_bar_trailing, min_periods=n_bar_trailing).mean()
        frames.append(pd.DataFrame({"kode": kode, "tanggal": d["tgl"], "trail": trail.values}))
    m = pd.concat(frames, ignore_index=True)
    m["rank_lik"] = m.groupby("tanggal")["trail"].rank(ascending=False, method="first")
    out = {}
    for kode, g in m.groupby("kode", sort=False):
        out[kode] = g["rank_lik"].reset_index(drop=True)
    return out


def universe_terkini(bars: dict[str, dict], n: int = 100, n_bar_trailing: int = 60) -> list[str]:
    """100 kode teratas berdasar rata2 value 60 bar TERAKHIR (tanggal
    terkini bersama) — dipakai --semesta-hari-ini, sengaja sama seperti
    riset manual (bukan anti-bias per-tanggal)."""
    baris = []
    for kode, d in bars.items():
        if len(d["value"]) < n_bar_trailing:
            continue
        baris.append((kode, sum(d["value"][-n_bar_trailing:]) / n_bar_trailing, d["tgl"][-1]))
    if not baris:
        return []
    dominan = statistics.mode([b[2] for b in baris])
    baris = [b for b in baris if b[2] == dominan]
    baris.sort(key=lambda b: -b[1])
    return [b[0] for b in baris[:n]]


# ============================================================== simulasi trade
def simulasi_trade(d: dict, idx_sinyal: int, model_masuk: str, model_keluar: str,
                    biaya: float, level: float | None = None, sl_pct: float | None = None,
                    tpsl_horizon: int = 20) -> dict | None:
    o, h, l, c, tgl = d["o"], d["h"], d["l"], d["c"], d["tgl"]
    n = len(c)
    if model_masuk == "open_h1":
        idx_masuk = idx_sinyal + 1
        if idx_masuk >= n:
            return None
        harga_masuk = o[idx_masuk]
    else:  # close_sinyal
        idx_masuk = idx_sinyal
        if idx_masuk >= n:
            return None
        harga_masuk = c[idx_masuk]

    if model_keluar == "tp_sl":
        if level is None or sl_pct is None:
            raise ValueError("tp_sl butuh level & sl_pct")
        sl_harga = level * (1 - sl_pct)
        batas = min(n - 1, idx_masuk + tpsl_horizon)
        idx_keluar, harga_keluar, alasan = None, None, "horizon"
        for t in range(idx_masuk + 1, batas + 1):
            if l[t] <= sl_harga:
                idx_keluar, harga_keluar, alasan = t, sl_harga, "SL"
                break
        if idx_keluar is None:
            idx_keluar, harga_keluar = batas, c[batas]
    else:
        hz = {"h1": 1, "h5": 5, "h20": 20}[model_keluar]
        idx_keluar = idx_masuk + hz
        if idx_keluar >= n:
            return None
        harga_keluar, alasan = c[idx_keluar], f"H+{hz}"

    if idx_keluar <= idx_masuk or harga_masuk <= 0:
        return None
    ret = (harga_keluar - harga_masuk) / harga_masuk - biaya
    return {
        "tgl_masuk": tgl[idx_masuk], "tgl_keluar": tgl[idx_keluar],
        "harga_masuk": harga_masuk, "harga_keluar": harga_keluar,
        "return": ret, "alasan_keluar": alasan,
    }


# =========================================================== agregasi hasil
def _tahun(tgl: str) -> int:
    return int(tgl[:4])


def ringkas_trades(trades: list[dict], ihsg_ret: float | None, biaya: float, params: dict) -> dict:
    n = len(trades)
    ret = [t["return"] for t in trades]
    menang = [r for r in ret if r > 0]
    kalah = [r for r in ret if r <= 0]
    hist: dict[str, int] = {}
    for r in ret:
        b = int(math.floor(r * 100))
        b = max(-30, min(30, b))
        label = f"{b}% s.d. {b+1}%"
        hist[label] = hist.get(label, 0) + 1
    per_tahun: dict[str, dict] = {}
    for t in trades:
        y = str(_tahun(t["tgl_sinyal"]))
        py = per_tahun.setdefault(y, {"n": 0, "menang": 0, "ret": []})
        py["n"] += 1
        py["menang"] += 1 if t["return"] > 0 else 0
        py["ret"].append(t["return"])
    for y, py in per_tahun.items():
        py["win_rate"] = py["menang"] / py["n"] if py["n"] else None
        py["median_return"] = statistics.median(py["ret"]) if py["ret"] else None
        del py["ret"]
    per_tier: dict[str, dict] = {}
    for t in trades:
        tier = t.get("tier_likuiditas", "?")
        pt = per_tier.setdefault(tier, {"n": 0, "menang": 0, "ret": []})
        pt["n"] += 1
        pt["menang"] += 1 if t["return"] > 0 else 0
        pt["ret"].append(t["return"])
    for tr, pt in per_tier.items():
        pt["win_rate"] = pt["menang"] / pt["n"] if pt["n"] else None
        pt["median_return"] = statistics.median(pt["ret"]) if pt["ret"] else None
        del pt["ret"]
    gross_win = sum(menang)
    gross_loss = abs(sum(kalah))
    return {
        "n_trade": n,
        "win_rate": (len(menang) / n) if n else None,
        "median_return": statistics.median(ret) if ret else None,
        "rata_rata_return": statistics.mean(ret) if ret else None,
        "profit_factor": (gross_win / gross_loss) if gross_loss else None,
        "max_drawdown_per_trade": min(ret) if ret else None,
        "histogram_return_1pct": hist,
        "per_tahun": per_tahun,
        "per_tier_likuiditas": per_tier,
        "return_ihsg_periode_sama": ihsg_ret,
        "biaya_roundtrip": biaya,
    }


def tulis_hasil(strategi: str, params: dict, ringkasan: dict, trades: list[dict], akhir_data: str | None) -> Path | None:
    """`akhir_data` = tanggal bar TERAKHIR yang benar-benar dipakai run ini
    (beda dari `params['akhir']`, yang `None` kalau run tak diberi batas atas
    — BadgeRapor & UI lain butuh tanggal konkret, bukan `null`, untuk
    menampilkan 'rentang data')."""
    BT_DIR.mkdir(parents=True, exist_ok=True)
    h8 = hashlib.sha256(json.dumps(params, sort_keys=True, default=str).encode()).hexdigest()[:8]
    nama = f"{strategi}-{h8}"
    for ext in (".json", ".json.gz"):
        if (BT_DIR / (nama + ext)).exists():
            print(f"  [lewati] {nama}{ext} sudah ada — berkas hasil tak pernah ditimpa")
            return BT_DIR / (nama + ext)
    isi = {
        "strategi": strategi, "hash": h8, "parameter": params, "akhir_data": akhir_data,
        "dibuat": datetime.now().isoformat(timespec="seconds"),
        "ringkasan": ringkasan, "trades": trades,
    }
    mentah = json.dumps(isi, ensure_ascii=False, default=str).encode("utf-8")
    if len(mentah) > 5 * 1024 * 1024:
        jalur = BT_DIR / (nama + ".json.gz")
        with gzip.open(jalur, "wb") as f:
            f.write(mentah)
    else:
        jalur = BT_DIR / (nama + ".json")
        jalur.write_bytes(mentah)
    perbarui_index(strategi, h8, jalur.name, params, ringkasan, akhir_data)
    return jalur


def perbarui_index(strategi: str, h8: str, nama_berkas: str, params: dict, ringkasan: dict, akhir_data: str | None) -> None:
    idx_path = BT_DIR / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {"run": []}
    if any(r["hash"] == h8 and r["strategi"] == strategi for r in idx["run"]):
        return
    idx["run"].append({
        "strategi": strategi, "hash": h8, "berkas": nama_berkas,
        "dibuat": datetime.now().isoformat(timespec="seconds"), "akhir_data": akhir_data,
        "n_trade": ringkasan["n_trade"], "win_rate": ringkasan["win_rate"],
        "median_return": ringkasan["median_return"], "profit_factor": ringkasan["profit_factor"],
        "parameter_ringkas": {k: params[k] for k in ("strategi", "top_n", "mulai", "akhir", "model_masuk", "model_keluar") if k in params},
    })
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")


# ==================================================================== run
def ihsg_return(ihsg: dict | None, mulai: str, akhir: str | None) -> float | None:
    if not ihsg:
        return None
    tgl, c = ihsg["tgl"], ihsg["c"]
    idx_mulai = next((i for i, t in enumerate(tgl) if t >= mulai), None)
    idx_akhir = max((i for i, t in enumerate(tgl) if not akhir or t <= akhir), default=None)
    if idx_mulai is None or idx_akhir is None or idx_akhir <= idx_mulai:
        return None
    return (c[idx_akhir] - c[idx_mulai]) / c[idx_mulai]


def run_rbs(bars: dict[str, dict], top_n: int, mulai: str, akhir: str | None,
            model_masuk: str, model_keluar: str, biaya: float, p: ParamRBS,
            rank_lookup: dict[str, pd.Series] | None, universe_tetap: set[str] | None,
            konfirmasi_saja: bool = False) -> tuple[list[dict], dict]:
    """konfirmasi_saja=True -> mode TP/SL Trade RBS (entri di bar konfirmasi,
    keluar SL=level-3% atau 20 hari) — mereplikasi 'Trade RBS: beli di
    konfirmasi' riset_rbs_gap_hasil.md, BUKAN default `Sinyal trade = retest-sah`
    yang dipakai run H+1/H+5 biasa. Dua populasi berbeda, dicatat di parameter."""
    trades = []
    ringkas_deteksi = {"breakout": 0, "retest": 0, "bertahan": 0, "konfirmasi": 0}
    for kode, d in bars.items():
        dp = potong_periode(d, None, akhir)  # deteksi butuh histori SEBELUM mulai juga
        for rec in deteksi_rbs(dp, p):
            ringkas_deteksi["breakout"] += 1
            if "retest_idx" not in rec:
                continue
            ringkas_deteksi["retest"] += 1
            if not rec["bertahan"]:
                continue
            ringkas_deteksi["bertahan"] += 1
            if "konfirmasi_idx" in rec:
                ringkas_deteksi["konfirmasi"] += 1
            if konfirmasi_saja and "konfirmasi_idx" not in rec:
                continue
            idx_sinyal = rec["konfirmasi_idx"] if konfirmasi_saja else rec["retest_idx"]
            tgl_sinyal = dp["tgl"][idx_sinyal]
            if tgl_sinyal < mulai:
                continue
            rank = _cari_rank(rank_lookup, kode, dp, idx_sinyal) if rank_lookup else None
            if universe_tetap is not None:
                if kode not in universe_tetap:
                    continue
            elif rank_lookup is not None:
                if rank is None or rank > top_n:
                    continue
            if konfirmasi_saja:
                tr = simulasi_trade(dp, idx_sinyal, model_masuk, "tp_sl", biaya,
                                     level=rec["level"], sl_pct=p.sl_pct, tpsl_horizon=p.tpsl_horizon)
            else:
                tr = simulasi_trade(dp, idx_sinyal, model_masuk, model_keluar, biaya)
            if tr is None:
                continue
            tr.update({"kode": kode, "tgl_sinyal": tgl_sinyal, "level_rbs": rec["level"],
                       "tier_likuiditas": _tier(rank, top_n)})
            trades.append(tr)
    return trades, ringkas_deteksi


def _tier(rank: float | None, top_n: int) -> str:
    if rank is None:
        return "?"
    tengah = math.ceil(top_n / 2)
    return f"1-{tengah}" if rank <= tengah else f"{tengah+1}-{top_n}"


def _cari_rank(rank_lookup: dict[str, pd.Series], kode: str, d: dict, idx: int) -> float | None:
    s = rank_lookup.get(kode)
    if s is None or idx >= len(s):
        return None
    v = s.iloc[idx]
    return None if pd.isna(v) else float(v)


def run_gap(bars: dict[str, dict], arah: str, top_n: int, mulai: str, akhir: str | None,
            model_masuk: str, model_keluar: str, biaya: float,
            rank_lookup: dict[str, pd.Series] | None, universe_tetap: set[str] | None) -> tuple[list[dict], dict]:
    trades = []
    ringkas_deteksi = {"kejadian": 0, "terisi_5": 0, "terisi_20": 0}
    for kode, d in bars.items():
        dp = potong_periode(d, None, akhir)
        for g in deteksi_gap(dp, arah):
            tgl_sinyal = g["tgl"]
            if tgl_sinyal < mulai:
                continue
            ringkas_deteksi["kejadian"] += 1
            if g["hari_terisi"] is not None and g["hari_terisi"] <= 5:
                ringkas_deteksi["terisi_5"] += 1
            if g["hari_terisi"] is not None and g["hari_terisi"] <= 20:
                ringkas_deteksi["terisi_20"] += 1
            rank = _cari_rank(rank_lookup, kode, dp, g["idx"]) if rank_lookup else None
            if universe_tetap is not None:
                if kode not in universe_tetap:
                    continue
            elif rank_lookup is not None:
                if rank is None or rank > top_n:
                    continue
            tr = simulasi_trade(dp, g["idx"], model_masuk, model_keluar, biaya)
            if tr is None:
                continue
            tr.update({"kode": kode, "tgl_sinyal": tgl_sinyal, "gap_pct": g["gap_pct"],
                       "tier_likuiditas": _tier(rank, top_n)})
            trades.append(tr)
    return trades, ringkas_deteksi


def run_preset(bars: dict[str, dict], preset_id: str, top_n: int, mulai: str, akhir: str | None,
               model_masuk: str, model_keluar: str, biaya: float,
               pasar_harian: dict[str, pd.DataFrame],
               rank_lookup: dict[str, pd.Series] | None, universe_tetap: set[str] | None) -> tuple[list[dict], dict]:
    trades = []
    n_sinyal = 0
    for kode, d in bars.items():
        dp_full = potong_periode(d, None, akhir)
        ind = hitung_indikator_preset(dp_full)
        pop = pasar_harian.get(kode)
        if pop is None or len(pop) != len(ind):
            continue
        ind["peringkat_value"] = pop["peringkat_value"].values
        ind["ukuranOrderP25"] = pop["p25"].values
        sinyal = sinyal_preset(ind, preset_id)
        idxs = np.flatnonzero(sinyal.values & (ind["tanggal"].values >= mulai))
        for idx_sinyal in idxs:
            idx_sinyal = int(idx_sinyal)
            n_sinyal += 1
            rank = _cari_rank(rank_lookup, kode, dp_full, idx_sinyal) if rank_lookup else None
            if universe_tetap is not None:
                if kode not in universe_tetap:
                    continue
            elif rank_lookup is not None:
                if rank is None or rank > top_n:
                    continue
            tr = simulasi_trade(dp_full, idx_sinyal, model_masuk, model_keluar, biaya)
            if tr is None:
                continue
            tr.update({"kode": kode, "tgl_sinyal": dp_full["tgl"][idx_sinyal],
                       "tier_likuiditas": _tier(rank, top_n)})
            trades.append(tr)
    return trades, {"sinyal_semua_kriteria_terukur_lolos": n_sinyal}


# ============================================================= orkestrasi CLI
def jalankan(strategi: str, bars: dict[str, dict], ihsg: dict | None, *,
             top_n: int = 100, mulai: str = "2018-01-01", akhir: str | None = None,
             model_masuk: str = "open_h1", model_keluar: str = "h5", biaya: float = BIAYA_DEFAULT,
             semesta_mode: str = "per-tanggal", pasar_harian=None, universe_pt=None, universe_tk=None,
             tulis: bool = True) -> dict:
    universe_tetap = set(universe_tk) if semesta_mode == "terkini" else None
    rank_lookup = universe_pt if semesta_mode == "per-tanggal" else None

    if strategi in ("rbs", "rbs-tpsl"):
        p = ParamRBS()
        trades, deteksi = run_rbs(bars, top_n, mulai, akhir, model_masuk, model_keluar, biaya, p,
                                   rank_lookup, universe_tetap, konfirmasi_saja=(strategi == "rbs-tpsl"))
        param_strategi = p.dict()
    elif strategi in ("gap-naik", "gap-turun", "gap"):
        arah = "turun" if strategi == "gap-turun" else "naik"
        trades, deteksi = run_gap(bars, arah, top_n, mulai, akhir, model_masuk, model_keluar, biaya,
                                   rank_lookup, universe_tetap)
        param_strategi = {"arah": arah, "tol_pct": 0.01}
    elif strategi in ("preset-scalping", "preset-swing"):
        preset_id = strategi.split("-", 1)[1]
        trades, deteksi = run_preset(bars, preset_id, top_n, mulai, akhir, model_masuk, model_keluar, biaya,
                                      pasar_harian, rank_lookup, universe_tetap)
        param_strategi = {"preset_id": preset_id, "aturan_sinyal": "semua-kriteria-terukur-lolos"}
    else:
        raise ValueError(f"strategi tak dikenal: {strategi}")

    params = {
        "strategi": strategi, "top_n": top_n, "semesta_mode": semesta_mode,
        "mulai": mulai, "akhir": akhir, "model_masuk": model_masuk, "model_keluar": model_keluar,
        "biaya_roundtrip": biaya, **param_strategi,
    }
    ret_ihsg = ihsg_return(ihsg, mulai, akhir)
    ringkasan = ringkas_trades(trades, ret_ihsg, biaya, params)
    ringkasan["deteksi"] = deteksi
    # tanggal bar TERAKHIR yang benar-benar dipakai run ini: `akhir` param kalau
    # dibatasi, else bar terakhir yang tersedia lintas seluruh emiten yang dimuat
    akhir_data = akhir or (max((d["tgl"][-1] for d in bars.values() if d["tgl"]), default=None))
    if tulis:
        jalur = tulis_hasil(strategi, params, ringkasan, trades, akhir_data)
        print(f"  -> {jalur.name if jalur else '(gagal tulis)'} | sinyal={sum(deteksi.values()) if deteksi else 0} trade={len(trades)} "
              f"win={ringkasan['win_rate']} median={ringkasan['median_return']}")
    return {"params": params, "ringkasan": ringkasan, "trades": trades}


# =================================================================== validasi
ACUAN = {
    "breakout": 617, "retest_pct": 0.79, "bertahan_pct": 0.71,
    "sl_pct": 0.52, "median_lolos_sl": 0.0389, "win_lolos_sl": 0.72,
    "gap_naik": 3897, "terisi5_pct": 0.80, "terisi20_pct": 0.88,
}


def cek_toleransi(label: str, hasil: float | None, acuan: float, rel: float = 0.10) -> str:
    if hasil is None:
        return f"  {label:<28} acuan={acuan!s:<10} hasil=None                TOLOK UKUR GAGAL (tak ada trade)"
    dev = (hasil - acuan) / acuan if acuan else 0
    status = "OK" if abs(dev) <= rel else "MELESET"
    return f"  {label:<28} acuan={acuan!s:<10} hasil={hasil!s:<10} deviasi={dev*100:+.1f}%  {status}"


def validasi_semesta_hari_ini(strategi: str) -> None:
    print(f"\n=== Validasi --semesta-hari-ini: {strategi} ===")
    bars_semua = muat_emiten()
    kode100 = universe_terkini(bars_semua, 100)
    print(f"  top-100 likuiditas terkini: {len(kode100)} emiten")
    bars = {k: bars_semua[k] for k in kode100}
    if strategi == "rbs":
        p = ParamRBS()
        semua_rekam = []
        for kode, d in bars.items():
            dp = potong_periode(d, "2018-01-01", None)
            semua_rekam.extend(deteksi_rbs(dp, p))
        n_bo = len(semua_rekam)
        n_rt = sum(1 for r in semua_rekam if "retest_idx" in r)
        n_bt = sum(1 for r in semua_rekam if r.get("bertahan"))
        n_kf = sum(1 for r in semua_rekam if "konfirmasi_idx" in r)
        print(cek_toleransi("breakout (n)", n_bo, ACUAN["breakout"]))
        print(cek_toleransi("retest / breakout", n_rt / n_bo if n_bo else None, ACUAN["retest_pct"]))
        print(cek_toleransi("bertahan / retest", n_bt / n_rt if n_rt else None, ACUAN["bertahan_pct"]))
        # trade SL: entri di konfirmasi (n_kf), SL=level-3%, 20 hari — replikasi "Trade RBS" riset doc
        hasil = jalankan("rbs-tpsl", bars, None, top_n=100, mulai="2018-01-01",
                          semesta_mode="terkini", universe_tk=kode100, tulis=False)
        ret = [t["return"] + hasil["params"]["biaya_roundtrip"] for t in hasil["trades"]]  # tanpa biaya utk banding apel-ke-apel
        kena_sl = sum(1 for t in hasil["trades"] if t["alasan_keluar"] == "SL")
        lolos = [t["return"] + hasil["params"]["biaya_roundtrip"] for t in hasil["trades"] if t["alasan_keluar"] != "SL"]
        n_trade = len(hasil["trades"])
        print(f"  (trade SL n={n_trade}, acuan n=248)")
        print(cek_toleransi("SL kena / trade", kena_sl / n_trade if n_trade else None, ACUAN["sl_pct"]))
        print(cek_toleransi("median return (lolos SL)", statistics.median(lolos) if lolos else None, ACUAN["median_lolos_sl"]))
        print(cek_toleransi("win rate (lolos SL)", (sum(1 for r in lolos if r > 0) / len(lolos)) if lolos else None, ACUAN["win_lolos_sl"]))
    elif strategi == "gap":
        semua = []
        for kode, d in bars.items():
            dp = potong_periode(d, "2018-01-01", None)
            semua.extend(deteksi_gap(dp, "naik"))
        n = len(semua)
        t5 = sum(1 for g in semua if g["hari_terisi"] is not None and g["hari_terisi"] <= 5)
        t20 = sum(1 for g in semua if g["hari_terisi"] is not None and g["hari_terisi"] <= 20)
        print(cek_toleransi("gap naik (n)", n, ACUAN["gap_naik"]))
        print(cek_toleransi("terisi <=5 hari", t5 / n if n else None, ACUAN["terisi5_pct"]))
        print(cek_toleransi("terisi <=20 hari", t20 / n if n else None, ACUAN["terisi20_pct"]))
        # "beli di open hari gap -> close hari itu" — statistik intraday langsung, bukan lewat mesin trade H+1
        rets = []
        for kode, d in bars.items():
            dp = potong_periode(d, "2018-01-01", None)
            for g in deteksi_gap(dp, "naik"):
                o, c = dp["o"][g["idx"]], dp["c"][g["idx"]]
                rets.append((c - o) / o)
        if rets:
            print(cek_toleransi("median open->close hari gap", statistics.median(rets), -0.0071))
            print(f"  {'persen hijau':<28} acuan=0.29       hasil={sum(1 for r in rets if r>0)/len(rets):.4f}")


# ====================================================================== uji
def _uji_vektor_cocok_kartu() -> None:
    """Bukti bahwa _regresi_vect() dan indikator kumo tervektorkan cocok
    dengan ka.regresi60()/ka.ichimoku() (perhitungan SATU-TITIK yang sudah
    dipakai produksi)."""
    rng = np.random.default_rng(7)
    c = 100 + np.cumsum(rng.normal(0, 1.5, 200))
    h = c + rng.uniform(0.1, 2, 200)
    l = c - rng.uniform(0.1, 2, 200)
    vec = _regresi_vect(c, 60)
    for i in (59, 120, 199):
        acu = ka.regresi60(list(c[: i + 1]), 60)
        assert acu is not None
        assert abs(vec[i] - acu["posisi"]) < 1e-3, (i, vec[i], acu["posisi"])  # acu dibulatkan 4 desimal

    d = {"tgl": [f"2020-01-{i:02d}" for i in range(1, 201)], "o": list(c), "h": list(h), "l": list(l),
         "c": list(c), "value": [1.0] * 200, "freq": [100.0] * 200, "fb": [0.0] * 200, "fs": [0.0] * 200,
         "lot": [10.0] * 200}
    ind = hitung_indikator_preset(d)
    for i in (99, 150, 199):
        acu_i = ka.ichimoku(list(h[: i + 1]), list(l[: i + 1]), list(c[: i + 1]))
        if acu_i is None:
            continue
        assert bool(ind["di_atas_kumo"].iloc[i]) == acu_i["di_atas_kumo"], i
    bb_acu = ka.bollinger(list(c[:100]))
    posisi_bb_acu = (c[99] - bb_acu["mid"]) / (2 * bb_acu["sigma"])
    assert abs(ind["posisi_bb"].iloc[99] - posisi_bb_acu) < 1e-9
    print("  [ok] indikator tervektorkan cocok dengan kartu_analisa (regresi60/ichimoku/bollinger)")


def _uji_rbs() -> None:
    """Deret sintetis: dua sentuhan resistance ~100, breakout, retest
    bertahan, konfirmasi — deteksi_rbs() wajib menangkap semuanya."""
    n = 200
    c = [90.0] * n
    h = [90.0] * n
    l = [88.0] * n
    # baseline naik landai supaya pivot_idx tak dibanjiri dataran
    for i in range(n):
        base = 85 + i * 0.02
        c[i] = base
        h[i] = base + 0.3
        l[i] = base - 0.3
    # pivot 1 di i=30 -> 100
    for i in (30,):
        h[i] = 100.0
        c[i] = 99.5
    # pivot 2 di i=60 -> 100.3 (dalam toleransi 1.5%)
    for i in (60,):
        h[i] = 100.3
        c[i] = 99.8
    # breakout di i=70: close > 101.3-ish (level+1%)
    level_est = (100.0 + 100.3) / 2
    c[70] = level_est * 1.02
    h[70] = c[70] + 0.3
    # turun lagi, retest di i=75: low masuk pita, close bertahan >= level
    l[75] = level_est * 1.0
    c[75] = level_est * 1.001
    h[75] = c[75] + 0.2
    # konfirmasi di i=77: close >= level+2%
    c[77] = level_est * 1.025
    h[77] = c[77] + 0.2
    tgl = [f"2020-{(1+i//28):02d}-{(1+i%28):02d}" for i in range(n)]
    d = {"tgl": tgl, "o": c, "h": h, "l": l, "c": c}
    p = ParamRBS()
    hasil = deteksi_rbs(d, p)
    assert hasil, "RBS gagal mendeteksi level sintetis sama sekali"
    r = min(hasil, key=lambda r: abs(r["level"] - level_est))
    assert abs(r["level"] - level_est) / level_est < 0.02, r
    assert r["status"] == "konfirmasi", r
    assert r.get("bertahan") is True
    print("  [ok] RBS: level/breakout/retest/bertahan/konfirmasi terdeteksi pada deret sintetis")


def _uji_gap() -> None:
    n = 20
    o = [100.0] * n
    h = [101.0] * n
    l = [99.0] * n
    c = [100.0] * n
    # hari 5: gap naik >=1% dari high hari 4 (101), lalu terisi hari 8
    h[4] = 101.0
    o[5] = 101.0 * 1.02
    h[5] = o[5] + 1
    l[5] = o[5] - 0.5
    c[5] = o[5] + 0.2
    for j in (6, 7):
        l[j] = o[5] * 1.01  # belum terisi
    l[8] = 100.5  # <= h[4]=101 -> terisi
    tgl = [f"2020-01-{i+1:02d}" for i in range(n)]
    d = {"tgl": tgl, "o": o, "h": h, "l": l, "c": c}
    gaps = deteksi_gap(d, "naik")
    assert len(gaps) == 1, gaps
    g = gaps[0]
    assert g["idx"] == 5 and g["terisi_idx"] == 8 and g["hari_terisi"] == 3, g
    print("  [ok] Gap: gap naik + terisi terdeteksi pada deret sintetis")


def _uji_preset() -> None:
    n = 80
    tgl = [f"2020-{(1+i//28):02d}-{(1+i%28):02d}" for i in range(n)]
    c = [100 + i * 0.5 for i in range(n)]  # tren naik -> ma5>ma20, posisi_bb tinggi
    h = [x + 1 for x in c]
    l = [x - 1 for x in c]
    freq = [20_000.0] * n
    lot = [100.0] * n  # ukuran_order kecil
    fb = [0.0] * n
    fs = [0.0] * n
    d = {"tgl": tgl, "o": c, "h": h, "l": l, "c": c, "freq": freq, "lot": lot, "fb": fb, "fs": fs,
         "value": [1e9] * n}
    ind = hitung_indikator_preset(d)
    pop = pd.DataFrame({"peringkat_value": [1.0] * n, "p25": [50.0] * n})  # ukuran_order=1 <= p25=50 -> lolos
    ind["peringkat_value"] = pop["peringkat_value"].values
    ind["ukuranOrderP25"] = pop["p25"].values
    sinyal = sinyal_preset(ind, "scalping")
    assert sinyal.iloc[-1] == True, ind.iloc[-1]  # noqa: E712
    print("  [ok] preset-scalping: baris yang memenuhi semua kriteria terukur -> sinyal True")


def swauji() -> None:
    print("=== Swauji bt_papan.py ===")
    _uji_vektor_cocok_kartu()
    _uji_rbs()
    _uji_gap()
    _uji_preset()
    print("=== Semua swauji lolos ===")


# ======================================================================= cli
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--uji", action="store_true")
    ap.add_argument("--semesta-hari-ini", nargs="?", const="semua", choices=["semua", "rbs", "gap"])
    ap.add_argument("--resmi", action="store_true")
    ap.add_argument("--top-n", type=int, default=100)
    ap.add_argument("--mulai", default="2018-01-01")
    args = ap.parse_args()

    if args.uji:
        swauji()
        return

    if args.semesta_hari_ini:
        for s in (["rbs", "gap"] if args.semesta_hari_ini == "semua" else [args.semesta_hari_ini]):
            validasi_semesta_hari_ini(s)
        return

    if args.resmi:
        t0 = time.time()
        print("Memuat data ohlcv_stockbit ...")
        bars = muat_emiten()
        ihsg = muat_ihsg()
        print(f"  {len(bars)} emiten, {time.time()-t0:.1f}s")

        print("Membangun universe likuiditas per-tanggal (anti-bias) ...")
        universe_pt = universe_partanggal(bars)
        print(f"  {time.time()-t0:.1f}s")

        print("Membangun peringkat pasar harian (untuk kriteria preset) ...")
        pasar_harian = bangun_pasar_harian(bars)
        print(f"  {time.time()-t0:.1f}s")

        for strategi in ("rbs", "rbs-tpsl", "gap-naik", "preset-scalping", "preset-swing"):
            model_keluar = "h5" if strategi not in ("rbs-tpsl",) else "tp_sl"
            print(f"\n[run resmi] {strategi} (top-{args.top_n}, {args.mulai}->akhir, masuk open H+1, keluar {model_keluar})")
            jalankan(strategi, bars, ihsg, top_n=args.top_n, mulai=args.mulai,
                     model_masuk="open_h1", model_keluar=model_keluar,
                     semesta_mode="per-tanggal", pasar_harian=pasar_harian, universe_pt=universe_pt)
        print(f"\nSelesai, {time.time()-t0:.1f}s total")
        return

    ap.print_help()


if __name__ == "__main__":
    main()
