"""Arus Pasar — mesin probabilitas historis v2 (B39, 21 Agu 2026).

Johan: "bukan probabilitas abal-abal tapi mempertimbangkan banyak faktor di
teknikalnya". Versi 1 (4 fitur, pool 12 emiten cache edisi, tanpa angka dasar,
tak pernah diuji di luar sampel) memang tak bisa dibedakan dari koin. Yang
berubah di v2, dan masing-masing alasannya:

POOL = SELURUH PASAR, bukan cache edisi.
  `data-idx/json/ohlc/*.json` (±960 emiten × ±1.600 hari bursa ≈ 1,5 juta
  observasi), nol jaringan, disinggahkan ke `cache/prob-pool-<cutoff>.npz`.
  Cutoff = bar terakhir seri edisi; observasi yang JENDELA KEJADIANNYA
  (t+HORIZON) melewati cutoff dibuang — membangun ulang edisi lama tidak
  boleh "mengintip" hari yang belum terjadi saat edisi itu terbit.

13 FAKTOR diskrit per (emiten, hari t) — semuanya dari OHLCV + arus asing:
   0 EMA20   close vs EMA20                       (bawah/atas)
   1 EMA50   close vs EMA50
   2 EMA200  close vs EMA200
   3 zona pivot — tangga pivot klasik dari bar t-1: <S2 · S2–S1 · S1–P ·
     P–R1 · R1–R2 · >R2  (ini kerangka yang dipakai Johan membaca BUMI/DSSA)
   4 volume  rasio vs rerata 20 hari:  <0,7 · 0,7–1,5 · 1,5–3 · >3
   5 rentang 20 hari, tercile posisi close (bawah/tengah/atas)
   6 breakout  close ≥ high 20 hari sebelumnya (tidak/ya)
   7 RSI14     <30 · 30–50 · 50–70 · >70
   8 MACD      histogram (12,26,9) negatif/positif
   9 volatilitas ATR14/close, tercile vs 250 hari emiten sendiri
  10 gap       buka vs close kemarin: turun >1% · datar · naik >1%
  11 beruntun  hari naik berturut: 0 · 1 · 2 · 3+
  12 asing     net beli asing 5 hari: n/a · jual · beli

KEJADIAN per observasi (t → t+1..t+5):
  e5   close[t+5] > close[t]
  e3   max high ≥ close × 1,03
  fmax max high / close − 1   (dipakai P(capai R1), P(capai R2) emiten ybs)
  fmin min low  / close − 1   (P(sentuh S1))
  ret5 close[t+5] / close[t] − 1 (rentang wajar: p25/p50/p75)

PENAKSIR: pencocokan tetangga dengan mundur bertahap. Hitung berapa faktor
yang cocok (0..13) untuk SETIAP observasi pool, ambil yang cocok ≥ k dengan k
diturunkan dari 13 sampai n ≥ MIN_N. Dilaporkan bersama n, "cocok k/13",
ANGKA DASAR pool, lift, dan CI Wilson 95% — tanpa ketiganya, 62% tak berarti.

FAKTOR PENDUKUNG/PENEKAN: untuk tiap faktor, P(e5 | nilai faktor) − dasar,
dari seluruh pool. Ini yang membuat "banyak faktor" terbaca, bukan diklaim.

UJI LUAR SAMPEL (walk-forward): 120 hari bursa terakhir pool jadi uji, sisanya
latih; contoh acak N_UJI titik uji. Dilaporkan akurasi arah & Brier penaksir
vs angka dasar. Kalau tak lebih baik dari dasar, angkanya akan bilang begitu.

VolVal (akumulasi senyap) dipertahankan, kini dihitung atas pool penuh.
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view

AKAR = Path(__file__).parent
DIR_OHLC = AKAR.parent / "data-idx" / "json" / "ohlc"
DIR_ASING = AKAR.parent / "data-idx" / "json" / "asing"
DIR_CACHE = AKAR / "cache"

MIN_N = 300          # tetangga minimum sebelum mundur ke k yang lebih longgar
HORIZON = 5
TARGET = 1.03
T0 = 60              # bar pertama yang diamati (pemanasan EMA/RSI/ATR)
VV_WIN = 60
VV_Z = 2.0
VV_PCT = 1.0
VV_H = 10
UJI_HARI = 120
N_UJI = 400
N_FITUR = 13
NILAI_MIN = 5e8      # Rp 500 juta/hari rerata 20h — batas "saham yang bergerak"

NAMA_FITUR = ("EMA20", "EMA50", "EMA200", "zona pivot", "volume", "rentang 20h",
              "breakout 20h", "RSI14", "MACD", "volatilitas", "gap", "beruntun", "asing 5h")
LABEL_NILAI = (
    ("di bawah", "di atas"),
    ("di bawah", "di atas"),
    ("di bawah", "di atas"),
    ("<S2", "S2–S1", "S1–P", "P–R1", "R1–R2", ">R2"),
    ("<0,7×", "0,7–1,5×", "1,5–3×", ">3×"),
    ("bawah", "tengah", "atas"),
    ("tidak", "ya"),
    ("<30", "30–50", "50–70", ">70"),
    ("negatif", "positif"),
    ("rendah", "sedang", "tinggi"),
    ("turun", "datar", "naik"),
    ("0", "1", "2", "3+"),
    ("n/a", "jual", "beli"),
)


# ───────────────────────── indikator dasar (numpy) ─────────────────────────

def ema_jalur(closes, n):
    """Jalur EMA penuh, pemanasan dari bar pertama (kompatibel v1)."""
    # pandas ewm(adjust=False) = rekursi e = x·k + e·(1−k) mulai dari c[0] —
    # identik dengan loop v1, tapi C-cepat (915 emiten × 6 EMA × 1.600 bar).
    c = np.asarray(closes, dtype=np.float64)
    return pd.Series(c).ewm(alpha=2.0 / (n + 1), adjust=False).mean().to_numpy()


def _rsi14(c):
    d = np.diff(c, prepend=c[0])
    up = np.where(d > 0, d, 0.0)
    dn = np.where(d < 0, -d, 0.0)
    # Wilder = EMA alpha 1/14 mulai dari nilai pertama (adjust=False)
    au = pd.Series(up).ewm(alpha=1 / 14, adjust=False).mean().to_numpy()
    ad = pd.Series(dn).ewm(alpha=1 / 14, adjust=False).mean().to_numpy()
    with np.errstate(divide="ignore", invalid="ignore"):
        rs = np.where(ad > 0, au / ad, np.inf)
    return 100 - 100 / (1 + rs)


def _roll_mean(x, n):
    """Rerata bergulir n bar BERAKHIR di i (inklusif); NaN sebelum cukup."""
    cs = np.cumsum(np.insert(x, 0, 0.0))
    out = np.full(len(x), np.nan)
    if len(x) >= n:
        out[n - 1:] = (cs[n:] - cs[:-n]) / n
    return out


def _roll_max(x, n):
    out = np.full(len(x), np.nan)
    if len(x) >= n:
        out[n - 1:] = sliding_window_view(x, n).max(axis=1)
    return out


def _roll_min(x, n):
    out = np.full(len(x), np.nan)
    if len(x) >= n:
        out[n - 1:] = sliding_window_view(x, n).min(axis=1)
    return out


def _tercile_vs_riwayat(x, n):
    """0/1/2: posisi x[i] terhadap tercile x pada n bar sebelumnya (min 30)."""
    s = pd.Series(x)
    r = s.shift(1).rolling(n, min_periods=30)     # n bar SEBELUM i
    q1 = r.quantile(1 / 3).to_numpy(); q2 = r.quantile(2 / 3).to_numpy()
    out = np.ones(len(x), dtype=np.int8)
    ok = ~np.isnan(q1) & ~np.isnan(x)
    out[ok & (x < q1)] = 0
    out[ok & (x >= q2)] = 2
    return out


# ───────────────────────── fitur & kejadian satu seri ─────────────────────────

def fitur_seri(o, h, l, c, v, asing_net5=None):
    """Matriks fitur (T×13, int8) + kejadian untuk satu seri.

    Kejadian NaN di bar yang jendela t+HORIZON-nya belum ada. `asing_net5`:
    larik net beli asing 5 hari sejajar bar (NaN = tak ada data)."""
    o, h, l, c, v = (np.asarray(a, dtype=np.float64) for a in (o, h, l, c, v))
    T = len(c)
    F = np.zeros((T, N_FITUR), dtype=np.int8)

    e20, e50, e200 = ema_jalur(c, 20), ema_jalur(c, 50), ema_jalur(c, 200)
    F[:, 0] = c > e20
    F[:, 1] = c > e50
    F[:, 2] = c > e200

    # tangga pivot dari bar SEBELUMNYA
    hp, lp, cp = np.roll(h, 1), np.roll(l, 1), np.roll(c, 1)
    P = (hp + lp + cp) / 3
    R1 = 2 * P - lp; S1 = 2 * P - hp
    R2 = P + (hp - lp); S2 = P - (hp - lp)
    zona = np.full(T, 3, dtype=np.int8)          # P–R1 sebagai bawaan
    zona[c < S2] = 0
    zona[(c >= S2) & (c < S1)] = 1
    zona[(c >= S1) & (c < P)] = 2
    zona[(c >= R1) & (c < R2)] = 4
    zona[c >= R2] = 5
    F[:, 3] = zona

    v20 = np.roll(_roll_mean(v, 20), 1)          # 20 hari SEBELUM t
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.where(v20 > 0, v / v20, 0.0)
    F[:, 4] = np.digitize(np.nan_to_num(r), (0.7, 1.5, 3.0), right=True)

    hi20 = _roll_max(h, 20); lo20 = _roll_min(l, 20)
    with np.errstate(divide="ignore", invalid="ignore"):
        pos = np.where(hi20 > lo20, (c - lo20) / (hi20 - lo20), 0.5)
    F[:, 5] = np.digitize(np.nan_to_num(pos, nan=0.5), (1 / 3, 2 / 3))

    hi20_sebelum = np.roll(hi20, 1)
    with np.errstate(invalid="ignore"):
        F[:, 6] = np.nan_to_num((c >= hi20_sebelum).astype(float), nan=0)

    F[:, 7] = np.digitize(np.nan_to_num(_rsi14(c), nan=50), (30, 50, 70))

    macd = ema_jalur(c, 12) - ema_jalur(c, 26)
    F[:, 8] = (macd - ema_jalur(macd, 9)) > 0

    tr = np.maximum(h - l, np.maximum(np.abs(h - cp), np.abs(l - cp)))
    tr[0] = h[0] - l[0]
    atr = _roll_mean(tr, 14)
    with np.errstate(divide="ignore", invalid="ignore"):
        atrp = np.where(c > 0, atr / c, np.nan)
    F[:, 9] = _tercile_vs_riwayat(atrp, 250)

    with np.errstate(divide="ignore", invalid="ignore"):
        gap = np.where(cp > 0, (o - cp) / cp * 100, 0.0)
    gap[0] = 0.0
    F[:, 10] = np.digitize(np.nan_to_num(gap), (-1.0, 1.0), right=False)   # <-1:0, [-1,1):1, >=1:2

    naik = (c > cp); naik[0] = False
    idx = np.arange(T)
    nol_terakhir = np.maximum.accumulate(np.where(naik, 0, idx))   # indeks hari tak-naik terakhir
    F[:, 11] = np.minimum(idx - nol_terakhir, 3)

    if asing_net5 is not None:
        a = np.asarray(asing_net5, dtype=np.float64)
        F[:, 12] = np.where(np.isnan(a), 0, np.where(a > 0, 2, 1))

    # kejadian
    e5 = np.full(T, np.nan); e3 = np.full(T, np.nan)
    fmax = np.full(T, np.nan); fmin = np.full(T, np.nan); ret5 = np.full(T, np.nan)
    if T > HORIZON:
        hmax = sliding_window_view(h[1:], HORIZON).max(axis=1)   # t+1..t+5
        lmin = sliding_window_view(l[1:], HORIZON).min(axis=1)
        n = len(hmax)                                           # = T-HORIZON
        cc = c[:n]
        with np.errstate(divide="ignore", invalid="ignore"):
            fmax[:n] = hmax / cc - 1
            fmin[:n] = lmin / cc - 1
            ret5[:n] = c[HORIZON:HORIZON + n] / cc - 1
        e5[:n] = c[HORIZON:HORIZON + n] > cc
        e3[:n] = hmax >= cc * TARGET
    return F, {"e5": e5, "e3": e3, "fmax": fmax, "fmin": fmin, "ret5": ret5}


def volval_seri(c, v):
    """(z, pct, sinyal) per bar — NaN/False sebelum VV_WIN. Rumus = v1:
    z-score value (close×vol) terhadap 60 bar SEBELUM t, stdev sampel."""
    val = c * v
    T = len(c)
    m = np.roll(_roll_mean(val, VV_WIN), 1)
    m2 = np.roll(_roll_mean(val * val, VV_WIN), 1)
    with np.errstate(invalid="ignore", divide="ignore"):
        var = (m2 - m * m) * VV_WIN / (VV_WIN - 1)
        sd = np.sqrt(np.maximum(var, 0))
        z = np.where(sd > 0, (val - m) / sd, 0.0)
        cp = np.roll(c, 1)
        pct = np.where(cp > 0, (c - cp) / cp * 100, 0.0)
    z[:VV_WIN] = np.nan
    pct[0] = 0.0
    sinyal = (z >= VV_Z) & (np.abs(pct) <= VV_PCT)
    sinyal[:VV_WIN] = False
    return z, pct, sinyal


# ───────────────────────── pool pasar ─────────────────────────

def _baca_ohlc_idx(path):
    try:
        d = json.loads(path.read_text(encoding="utf-8")).get("d") or []
    except Exception:
        return None
    d = [b for b in d if b and b[4] not in (None, 0)]
    if len(d) < T0 + HORIZON + 2:
        return None
    return d


def _asing_net5(kode, tanggal):
    """Net beli asing 5 hari sejajar `tanggal` (NaN bila tak ada)."""
    p = DIR_ASING / f"{kode}.json"
    if not p.exists():
        return None
    try:
        rows = json.loads(p.read_text(encoding="utf-8")).get("d") or []
    except Exception:
        return None
    net = {r[0]: (r[1] or 0) - (r[2] or 0) for r in rows if r and len(r) >= 3}
    out = np.full(len(tanggal), np.nan)
    jendela = []
    for i, t in enumerate(tanggal):
        if t in net:
            jendela.append(net[t])
            if len(jendela) > 5:
                jendela.pop(0)
            out[i] = sum(jendela)
    return out


def _seri_ke_larik(seri):
    """Seri bentuk edisi ([{d,o,h,l,c,v}]) atau data-idx ([[d,o,h,l,c,v]])."""
    if not seri:
        return None
    if isinstance(seri[0], dict):
        return ([b["d"] for b in seri], [b["o"] for b in seri], [b["h"] for b in seri],
                [b["l"] for b in seri], [b["c"] for b in seri], [b["v"] for b in seri])
    return ([b[0] for b in seri], [b[1] for b in seri], [b[2] for b in seri],
            [b[3] for b in seri], [b[4] for b in seri], [b[5] for b in seri])


def bangun_pool(ohlc, cutoff=None, pakai_asing=True):
    """Pool dari peta kode→seri. Observasi disimpan dengan tanggal AKHIR
    jendelanya (bar t+HORIZON); `cutoff` membuang yang melewatinya."""
    F_all, tgl_akhir, kode_idx = [], [], []
    E = {k: [] for k in ("e5", "e3", "fmax", "fmin", "ret5")}
    vv_sinyal, vv_hit = [], []
    cut64 = np.datetime64(cutoff) if cutoff else None
    for ki, (kode, seri) in enumerate(sorted(ohlc.items())):
        lar = _seri_ke_larik(seri)
        if lar is None:
            continue
        tgl, o, h, l, c, v = lar
        if not any((x or 0) > 0 for x in v):
            continue   # indeks (JKSE) — volume nol, fitur volume tak bermakna
        if len(c) < T0 + HORIZON + 2:
            continue
        asing = _asing_net5(kode, tgl) if pakai_asing else None
        F, ev = fitur_seri(o, h, l, c, v, asing)
        T = len(c)
        tgl64 = np.array(tgl, dtype="datetime64[D]")
        idx = np.arange(T0, T - HORIZON)
        # SARING LIKUIDITAS: rerata nilai transaksi 20 hari SEBELUM t ≥ NILAI_MIN.
        # Tanpa ini 19,4% observasi pool adalah close yang tak bergerak 5 hari
        # (saham tidur) — mereka menyeret angka dasar ke 37% dan mengajari
        # penaksir perilaku yang tak relevan bagi emiten yang dibedah.
        ca, va, ha = np.asarray(c, float), np.asarray(v, float), np.asarray(h, float)
        nilai20 = np.roll(_roll_mean(ca * va, 20), 1)
        likuid = np.nan_to_num(nilai20[idx]) >= NILAI_MIN
        idx = idx[likuid]
        akhir = tgl64[idx + HORIZON]
        if cut64 is not None:
            ok = akhir <= cut64
            idx, akhir = idx[ok], akhir[ok]
        if len(idx) == 0:
            continue
        F_all.append(F[idx])
        for k in E:
            E[k].append(ev[k][idx])
        tgl_akhir.append(akhir)
        kode_idx.append(np.full(len(idx), ki, dtype=np.int32))
        # VolVal: sinyal di t, hit = high t+1..t+VV_H ≥ close×TARGET
        _, _, sig = volval_seri(ca, va)
        if T > VV_H:
            hm = sliding_window_view(ha[1:], VV_H).max(axis=1)
            n = len(hm)
            hit = hm >= ca[:n] * TARGET
            tt = np.arange(VV_WIN, n)
            if cut64 is not None:
                tt = tt[tgl64[tt + VV_H] <= cut64]
            vv_sinyal.append(sig[tt]); vv_hit.append(hit[tt])
    if not F_all:
        return None
    pool = {
        "F": np.concatenate(F_all),
        "tgl": np.concatenate(tgl_akhir),
        "kode": np.concatenate(kode_idx),
        "vv_sinyal": np.concatenate(vv_sinyal) if vv_sinyal else np.zeros(0, bool),
        "vv_hit": np.concatenate(vv_hit) if vv_hit else np.zeros(0, bool),
    }
    for k in E:
        pool[k] = np.concatenate(E[k]).astype(np.float32)
    return pool


def muat_pool_pasar(cutoff):
    """Pool seluruh pasar dari data-idx, disinggahkan per cutoff. None kalau
    data-idx tak ada (jalankan dari mesin lain) — pemanggil jatuh balik ke
    cache edisi."""
    if not DIR_OHLC.exists():
        return None
    DIR_CACHE.mkdir(exist_ok=True)
    p = DIR_CACHE / f"prob-pool-{cutoff}.npz"
    if p.exists():
        z = np.load(p, allow_pickle=False)
        return {k: z[k] for k in z.files}
    ohlc = {}
    for f in sorted(DIR_OHLC.glob("*.json")):
        if f.name.startswith("_") or f.stem == "IHSG":
            continue
        d = _baca_ohlc_idx(f)
        if d:
            ohlc[f.stem] = d
    pool = bangun_pool(ohlc, cutoff)
    if pool is None:
        return None
    np.savez_compressed(p, **pool)
    return pool


# ───────────────────────── penaksir ─────────────────────────

def wilson(p, n, z=1.96):
    if not n or p is None:
        return (None, None)
    den = 1 + z * z / n
    mid = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (max(0.0, mid - half), min(1.0, mid + half))


def prob_setup(pool, f, jarak=None, min_n=MIN_N, faktor=True):
    """Taksiran untuk setup `f` (13 int). `jarak` = {"R1":pct,"R2":pct,"S1":pct}
    jarak level pivot emiten ybs dari close (desimal, S1 positif ke bawah)."""
    F = pool["F"]
    m = (F == np.asarray(f, dtype=np.int8)).sum(axis=1)
    k = N_FITUR
    while k > 1 and (m >= k).sum() < min_n:
        k -= 1
    sel = m >= k
    n = int(sel.sum())
    e5 = pool["e5"]; e3 = pool["e3"]
    base5 = float(np.nanmean(e5)); base3 = float(np.nanmean(e3))
    if n == 0:
        return {"p5": None, "p3": None, "n": 0, "cocok": k, "total_fitur": N_FITUR,
                "base5": base5, "base3": base3, "lift5": None, "ci5": (None, None),
                "faktor": [], "pR1": None, "pR2": None, "pS1": None}
    p5 = float(np.nanmean(e5[sel])); p3 = float(np.nanmean(e3[sel]))
    r5 = pool["ret5"][sel]
    hasil = {
        "p5": p5, "p3": p3, "n": n, "cocok": k, "total_fitur": N_FITUR,
        "base5": base5, "base3": base3, "lift5": p5 - base5,
        "ci5": wilson(p5, n),
        "ret_p25": float(np.nanpercentile(r5, 25)), "ret_p50": float(np.nanpercentile(r5, 50)),
        "ret_p75": float(np.nanpercentile(r5, 75)),
        "pR1": None, "pR2": None, "pS1": None, "faktor": [],
    }
    if jarak:
        fmax = pool["fmax"][sel]; fmin = pool["fmin"][sel]
        if jarak.get("R1") is not None and jarak["R1"] > 0:
            hasil["pR1"] = float(np.nanmean(fmax >= jarak["R1"]))
        if jarak.get("R2") is not None and jarak["R2"] > 0:
            hasil["pR2"] = float(np.nanmean(fmax >= jarak["R2"]))
        if jarak.get("S1") is not None and jarak["S1"] > 0:
            hasil["pS1"] = float(np.nanmean(fmin <= -jarak["S1"]))
    if faktor:
        # faktor pendukung/penekan: P(e5 | nilai faktor i) − dasar, atas SELURUH pool
        daftar = []
        for i in range(N_FITUR):
            sel_i = F[:, i] == f[i]
            ni = int(sel_i.sum())
            if ni < 30:
                continue
            pi = float(np.nanmean(e5[sel_i]))
            daftar.append({"nama": NAMA_FITUR[i], "nilai": LABEL_NILAI[i][int(f[i])],
                           "delta_pp": (pi - base5) * 100, "n": ni})
        daftar.sort(key=lambda x: -abs(x["delta_pp"]))
        hasil["faktor"] = daftar
    return hasil


def evaluasi(pool, n_uji=N_UJI, hari_uji=UJI_HARI, seed=7):
    """Uji walk-forward: latih = observasi sebelum batas, uji = sesudahnya."""
    tgl = pool["tgl"]
    hari = np.unique(tgl)
    if len(hari) < hari_uji + 60:
        return None
    batas = hari[-hari_uji]
    latih = tgl < batas
    uji = ~latih & ~np.isnan(pool["e5"])
    idx_uji = np.flatnonzero(uji)
    if len(idx_uji) == 0:
        return None
    rng = np.random.default_rng(seed)
    if len(idx_uji) > n_uji:
        idx_uji = rng.choice(idx_uji, n_uji, replace=False)
    sub = {k: pool[k][latih] for k in ("F", "e5", "e3", "fmax", "fmin", "ret5")}
    base = float(np.nanmean(sub["e5"]))
    p_hat, y = [], []
    for i in idx_uji:
        h = prob_setup(sub, pool["F"][i], faktor=False)
        if h["p5"] is None:
            continue
        p_hat.append(h["p5"]); y.append(pool["e5"][i])
    p_hat = np.array(p_hat); y = np.array(y)
    if len(y) == 0:
        return None
    brier = float(np.mean((p_hat - y) ** 2))
    brier_dasar = float(np.mean((base - y) ** 2))
    yakin = p_hat > 0.5
    return {
        "n_uji": int(len(y)),
        "mulai_uji": str(batas),
        # Skor Brier = ukuran kalibrasi yang adil untuk probabilitas; "skill"
        # = seberapa jauh lebih baik dari selalu menjawab angka dasar.
        "brier": brier,
        "brier_dasar": brier_dasar,
        "skill": 1 - brier / brier_dasar if brier_dasar > 0 else None,
        # Saat model berani bilang >50%: berapa yang benar-benar naik, vs dasar.
        "presisi_naik": float(np.mean(y[yakin])) if yakin.any() else None,
        "n_yakin": int(yakin.sum()),
        "base": base,
    }


def _evaluasi_cache(pool, cutoff):
    p = DIR_CACHE / f"prob-eval-{cutoff}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    ev = evaluasi(pool)
    DIR_CACHE.mkdir(exist_ok=True)
    p.write_text(json.dumps(ev), encoding="utf-8")
    return ev


# ───────────────────────── antarmuka build.py / build_bedah.py ─────────────────────────

def volval(seri, t):
    """Kompatibel v1: (z, pct, sinyal) satu bar dari seri edisi."""
    if t < VV_WIN:
        return None
    lar = _seri_ke_larik(seri)
    c = np.asarray(lar[4], float); v = np.asarray(lar[5], float)
    z, pct, sig = volval_seri(c, v)
    return {"z": float(z[t]), "pct": float(pct[t]), "sinyal": bool(sig[t])}


def analisa_edisi(ohlc, tickers, pool=None):
    """Peta ticker → hasil. Kunci v1 (p5/p3/n/cocok/volval/vv_hit/vv_n) tetap
    ada supaya build.py & build_bedah.py tak perlu berubah; kunci baru:
    total_fitur, base5, lift5, ci5, pR1/pR2/pS1, ret_p25/50/75, faktor,
    pivot (tangga), fitur (13 label), evaluasi, pool_n, pool_emiten."""
    cutoff = max((_seri_ke_larik(s)[0][-1] for s in ohlc.values() if s), default=None)
    sumber = "pasar"
    if pool is None:
        pool = muat_pool_pasar(cutoff) if cutoff else None
    if pool is None:
        pool = bangun_pool(ohlc, cutoff)
        sumber = "edisi"
    if pool is None:
        return {tk: None for tk in tickers}
    hr = float(pool["vv_hit"][pool["vv_sinyal"]].mean()) if pool["vv_sinyal"].any() else None
    hr_n = int(pool["vv_sinyal"].sum())
    ev = _evaluasi_cache(pool, cutoff) if sumber == "pasar" else evaluasi(pool)
    out = {}
    for tk in tickers:
        seri = ohlc.get(tk)
        if not seri or len(seri) < VV_WIN + 2:
            out[tk] = None
            continue
        tgl, o, h, l, c, v = _seri_ke_larik(seri)
        asing = _asing_net5(tk, tgl)
        F, _ = fitur_seri(o, h, l, c, v, asing)
        t = len(c) - 1
        f = F[t]
        # tangga pivot dari bar terakhir → level yang berlaku BESOK (yang
        # dicetak di halaman teknikal), jaraknya dari close terakhir
        P = (h[t] + l[t] + c[t]) / 3
        piv = {"P": P, "R1": 2 * P - l[t], "R2": P + (h[t] - l[t]),
               "R3": h[t] + 2 * (P - l[t]), "S1": 2 * P - h[t],
               "S2": P - (h[t] - l[t]), "S3": l[t] - 2 * (h[t] - P)}
        jarak = {"R1": piv["R1"] / c[t] - 1, "R2": piv["R2"] / c[t] - 1,
                 "S1": 1 - piv["S1"] / c[t]}
        hasil = prob_setup(pool, f, jarak)
        hasil["volval"] = volval(seri, t)
        hasil["vv_hit"] = hr
        hasil["vv_n"] = hr_n
        hasil["pivot"] = piv
        hasil["jarak"] = jarak
        hasil["fitur"] = [(NAMA_FITUR[i], LABEL_NILAI[i][int(f[i])]) for i in range(N_FITUR)]
        hasil["evaluasi"] = ev
        hasil["pool_n"] = int(len(pool["e5"]))
        hasil["pool_emiten"] = int(len(np.unique(pool["kode"])))
        hasil["pool_sumber"] = sumber
        out[tk] = hasil
    return out
