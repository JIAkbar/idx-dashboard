"""Arus Pasar — mesin probabilitas historis (backtest setup diskrit + VolVal).

Setup diskrit per (ticker, hari t) dari OHLCV:
  1. posisi close vs EMA50 (riwayat penuh sampai t)      -> ema+ / ema-
  2. close vs pivot P harian (P=(H+L+C)/3 bar t-1)       -> piv+ / piv-
  3. rasio volume vs rerata 20 hari sebelumnya           -> <0,7 / 0,7-1,5 / 1,5-3 / >3
  4. posisi close di rentang high-low 20 hari (tercile)  -> bawah / tengah / atas

Event:
  e5  = close[t+5] > close[t]
  e3  = max(high[t+1..t+5]) >= close[t] x 1,03

Pool: seluruh seri di cache edisi yang punya volume (JKSE — indeks, volume 0 —
dikecualikan; fitur volume tak bermakna di sana). Probabilitas SELALU dilaporkan
bersama n. Kalau n < 30 untuk setup 4-fitur, mundur bertahap: drop fitur yang
nilainya paling jarang muncul di pool, dilabeli "cocok 3/4" dst.

VolVal: z-score value (close x vol) vs 60 hari sebelumnya. Sinyal "akumulasi
senyap" = z >= 2 dan |pct hari itu| <= 1%. Hit-rate pool: P(naik >=3% dalam
10 hari | sinyal) + n.
"""
from statistics import fmean, stdev

MIN_N = 30
HORIZON = 5          # hari event
TARGET = 1.03        # +3%
VV_WIN = 60          # jendela z-score value
VV_Z = 2.0
VV_PCT = 1.0         # |pct| maks utk "senyap"
VV_H = 10            # horizon hit-rate VolVal

NAMA_FITUR = ("EMA50", "pivot", "volume", "rentang20")


def ema_jalur(closes, n):
    """Jalur EMA penuh (nilai per bar), pemanasan dari bar pertama."""
    k = 2 / (n + 1)
    e = closes[0]
    out = [e]
    for c in closes[1:]:
        e = c * k + e * (1 - k)
        out.append(e)
    return out


def fitur(seri, t, ema50):
    """Tuple 4 fitur diskrit di bar t. Butuh t >= 20."""
    b = seri[t]
    pv = seri[t - 1]
    P = (pv["h"] + pv["l"] + pv["c"]) / 3
    v20 = fmean(x["v"] for x in seri[t - 20:t])
    r = b["v"] / v20 if v20 else 0.0
    if r < 0.7:    vb = "v<0,7"
    elif r <= 1.5: vb = "v0,7-1,5"
    elif r <= 3:   vb = "v1,5-3"
    else:          vb = "v>3"
    hi = max(x["h"] for x in seri[t - 19:t + 1])
    lo = min(x["l"] for x in seri[t - 19:t + 1])
    pos = (b["c"] - lo) / (hi - lo) if hi > lo else 0.5
    ter = "bawah" if pos < 1 / 3 else ("tengah" if pos < 2 / 3 else "atas")
    return ("ema+" if b["c"] > ema50[t] else "ema-",
            "piv+" if b["c"] > P else "piv-", vb, ter)


def bangun_pool(ohlc):
    """[(fitur4, e5, e3)] utk semua seri ber-volume di cache."""
    obs = []
    for tk, seri in ohlc.items():
        if not any(b["v"] > 0 for b in seri):
            continue  # JKSE / seri indeks
        e50 = ema_jalur([b["c"] for b in seri], 50)
        for t in range(20, len(seri) - HORIZON):
            f = fitur(seri, t, e50)
            e5 = seri[t + HORIZON]["c"] > seri[t]["c"]
            e3 = max(x["h"] for x in seri[t + 1:t + HORIZON + 1]) >= seri[t]["c"] * TARGET
            obs.append((f, e5, e3))
    return obs


def prob_setup(pool, f):
    """P(e5|setup), P(e3|setup) + n. Fallback longgar kalau n < MIN_N."""
    aktif = list(range(4))
    while True:
        cocok = [o for o in pool if all(o[0][i] == f[i] for i in aktif)]
        n = len(cocok)
        if n >= MIN_N or len(aktif) == 1:
            return {"p5": sum(o[1] for o in cocok) / n if n else None,
                    "p3": sum(o[2] for o in cocok) / n if n else None,
                    "n": n, "cocok": len(aktif)}
        # drop fitur yang NILAInya paling jarang di pool (pencocokan paling ketat)
        jarang = min(aktif, key=lambda i: sum(1 for o in pool if o[0][i] == f[i]))
        aktif.remove(jarang)


def volval(seri, t):
    """(z, pct, sinyal) di bar t; None kalau riwayat < VV_WIN."""
    if t < VV_WIN:
        return None
    vals = [b["c"] * b["v"] for b in seri[t - VV_WIN:t]]
    sd = stdev(vals)
    z = (seri[t]["c"] * seri[t]["v"] - fmean(vals)) / sd if sd else 0.0
    pct = (seri[t]["c"] - seri[t - 1]["c"]) / seri[t - 1]["c"] * 100
    return {"z": z, "pct": pct, "sinyal": z >= VV_Z and abs(pct) <= VV_PCT}


def hitrate_volval(ohlc):
    """(hit_rate, n) sinyal akumulasi-senyap di seluruh pool; naik >=3% / 10 hari."""
    hit = n = 0
    for tk, seri in ohlc.items():
        if not any(b["v"] > 0 for b in seri):
            continue
        for t in range(VV_WIN, len(seri) - VV_H):
            vv = volval(seri, t)
            if vv and vv["sinyal"]:
                n += 1
                if max(x["h"] for x in seri[t + 1:t + VV_H + 1]) >= seri[t]["c"] * TARGET:
                    hit += 1
    return (hit / n if n else None), n


def analisa_edisi(ohlc, tickers):
    """Peta ticker -> hasil prob utk build.py. Ticker tanpa seri memadai -> None."""
    pool = bangun_pool(ohlc)
    hr, hr_n = hitrate_volval(ohlc)
    out = {}
    for tk in tickers:
        seri = ohlc.get(tk)
        if not seri or len(seri) < VV_WIN + 2:
            out[tk] = None
            continue
        e50 = ema_jalur([b["c"] for b in seri], 50)
        t = len(seri) - 1
        hasil = prob_setup(pool, fitur(seri, t, e50))
        hasil["volval"] = volval(seri, t)
        hasil["vv_hit"] = hr
        hasil["vv_n"] = hr_n
        out[tk] = hasil
    return out
