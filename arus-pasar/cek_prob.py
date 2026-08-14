"""Cek silang mesin probabilitas: hitung ulang 2 angka secara naif & cocokkan.

Implementasi ulang independen (loop polos, tanpa impor fungsi hitung prob.py
kecuali konstanta) untuk dua probabilitas edisi 2026-08-13:
  1. P(naik 5 hari | setup EXCL hari terakhir)
  2. Hit-rate VolVal pool (naik >=3% dalam 10 hari | sinyal akumulasi senyap)

Pakai: python cek_prob.py [tanggal] [ticker]
"""
import json, sys
from pathlib import Path

import prob

AKAR = Path(__file__).parent


def ema50_manual(closes):
    k = 2 / 51
    e = closes[0]
    jalur = [e]
    for c in closes[1:]:
        e = c * k + (1 - k) * e
        jalur.append(e)
    return jalur


def fitur_manual(seri, t):
    c = seri[t]["c"]
    f = []
    f.append("ema+" if c > ema50_manual([b["c"] for b in seri])[t] else "ema-")
    p = (seri[t-1]["h"] + seri[t-1]["l"] + seri[t-1]["c"]) / 3
    f.append("piv+" if c > p else "piv-")
    rer = sum(b["v"] for b in seri[t-20:t]) / 20
    r = seri[t]["v"] / rer if rer else 0
    f.append("v<0,7" if r < 0.7 else "v0,7-1,5" if r <= 1.5 else "v1,5-3" if r <= 3 else "v>3")
    hi = max(b["h"] for b in seri[t-19:t+1]); lo = min(b["l"] for b in seri[t-19:t+1])
    pos = (c - lo) / (hi - lo) if hi > lo else 0.5
    f.append("bawah" if pos < 1/3 else "tengah" if pos < 2/3 else "atas")
    return tuple(f)


def main():
    tgl = sys.argv[1] if len(sys.argv) > 1 else "2026-08-13"
    tk = sys.argv[2] if len(sys.argv) > 2 else "EXCL"
    ohlc = json.loads((AKAR / "cache" / f"ohlc-{tgl}.json").read_text(encoding="utf-8"))

    # ── 1. P(naik 5 hari | setup tk terakhir), loop naif ──
    seri = ohlc[tk]
    f_target = fitur_manual(seri, len(seri) - 1)
    hasil = prob.analisa_edisi(ohlc, [tk])[tk]

    # cocokkan hanya kalau mesin pakai 4/4 fitur; kalau fallback, cek subset sama
    naik = tot = 0
    for kode, s in ohlc.items():
        if not any(b["v"] > 0 for b in s):
            continue
        for t in range(20, len(s) - 5):
            if fitur_manual(s, t) == f_target:
                tot += 1
                naik += s[t+5]["c"] > s[t]["c"]
    if hasil["cocok"] == 4:
        p_manual = naik / tot if tot else None
        assert tot == hasil["n"], f"n beda: manual {tot} vs mesin {hasil['n']}"
        assert abs(p_manual - hasil["p5"]) < 1e-12, f"p5 beda: {p_manual} vs {hasil['p5']}"
        print(f"OK  P(naik 5h | setup {tk}) = {p_manual:.4f} (n={tot}) — manual == mesin")
    else:
        print(f"i   setup {tk} pakai fallback {hasil['cocok']}/4 fitur "
              f"(4/4 hanya n={tot}); p5 mesin {hasil['p5']:.4f} n={hasil['n']}")

    # ── 2. Hit-rate VolVal pool, loop naif ──
    from statistics import fmean, pstdev, stdev
    hit = n = 0
    for kode, s in ohlc.items():
        if not any(b["v"] > 0 for b in s):
            continue
        vals = [b["c"] * b["v"] for b in s]
        for t in range(60, len(s) - 10):
            win = vals[t-60:t]
            sd = stdev(win)
            z = (vals[t] - fmean(win)) / sd if sd else 0
            pct = (s[t]["c"] - s[t-1]["c"]) / s[t-1]["c"] * 100
            if z >= 2 and abs(pct) <= 1:
                n += 1
                hit += max(b["h"] for b in s[t+1:t+11]) >= s[t]["c"] * 1.03
    hr_manual = hit / n if n else None
    assert n == hasil["vv_n"], f"n VolVal beda: manual {n} vs mesin {hasil['vv_n']}"
    assert abs(hr_manual - hasil["vv_hit"]) < 1e-12, \
        f"hit-rate beda: {hr_manual} vs {hasil['vv_hit']}"
    print(f"OK  hit-rate VolVal pool = {hr_manual:.4f} (n={n}) — manual == mesin")


if __name__ == "__main__":
    main()
