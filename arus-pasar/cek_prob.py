"""Cek silang mesin probabilitas v2 (13 fitur, pool pasar) — tiga verifikasi
INDEPENDEN dari prob.py, masing-masing loop polos/rumus baku, bukan impor
fungsi hitung yang sedang diuji:

  (a) 3 fitur diskrit (zona pivot, beruntun, volume) dihitung ulang loop
      polos per bar, dicocokkan ke kolom 3/11/4 dari prob.fitur_seri, untuk
      satu ticker, bar >= 60 (pemanasan lewat).
  (b) n & p5 dihitung ulang NAIF dengan loop `for` atas pool KECIL
      (prob.bangun_pool atas cache/ohlc-<tanggal>.json — bukan pool pasar
      penuh), dicocokkan ke prob.prob_setup(pool, f): loop manual menghitung
      sum(F_row == f) >= k lalu rerata e5 pada baris yang lolos.
  (c) Interval Wilson dicek ke rumus baku (bukan diimpor dari prob.wilson).

Pakai: python cek_prob.py [tanggal] [ticker]     (default 2026-08-20 ARCI)
"""
import json, math, sys
from pathlib import Path

import prob

AKAR = Path(__file__).parent


# ───────────────────────── (a) fitur diskrit, loop polos ─────────────────────────

def zona_manual(seri, t):
    """Tangga pivot klasik dari bar t-1 -> zona 0..5 (sama definisi F[:,3])."""
    hp, lp, cp = seri[t - 1]["h"], seri[t - 1]["l"], seri[t - 1]["c"]
    P = (hp + lp + cp) / 3
    R1, S1 = 2 * P - lp, 2 * P - hp
    R2, S2 = P + (hp - lp), P - (hp - lp)
    c = seri[t]["c"]
    if c < S2: return 0
    if c < S1: return 1
    if c < P: return 2
    if c < R1: return 3
    if c < R2: return 4
    return 5


def beruntun_manual(seri, t):
    """Hari naik berturut ending di t, dibatasi 3 (sama definisi F[:,11])."""
    cnt, i = 0, t
    while i > 0 and seri[i]["c"] > seri[i - 1]["c"]:
        cnt += 1
        i -= 1
        if cnt >= 3:
            break
    return cnt


def volume_manual(seri, t):
    """Rasio volume vs rerata 20 hari SEBELUM t -> bin 0..3 (sama F[:,4])."""
    v20 = sum(b["v"] for b in seri[t - 20:t]) / 20
    r = seri[t]["v"] / v20 if v20 > 0 else 0.0
    if r <= 0.7: return 0
    if r <= 1.5: return 1
    if r <= 3.0: return 2
    return 3


def wilson_manual(p, n, z=1.96):
    """Rumus baku Wilson score interval — ditulis ulang independen, bukan
    dipanggil dari prob.wilson, supaya benar-benar cek rumus."""
    if not n or p is None:
        return (None, None)
    denom = 1 + z * z / n
    tengah = (p + z * z / (2 * n)) / denom
    jarak = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, tengah - jarak), min(1.0, tengah + jarak)


def main():
    tgl = sys.argv[1] if len(sys.argv) > 1 else "2026-08-20"
    tk = sys.argv[2] if len(sys.argv) > 2 else "ARCI"
    ohlc = json.loads((AKAR / "cache" / f"ohlc-{tgl}.json").read_text(encoding="utf-8"))
    if tk not in ohlc:
        sys.exit(f"{tk} tak ada di cache/ohlc-{tgl}.json — tickernya: {sorted(ohlc)}")
    seri = ohlc[tk]

    # ── (a) fitur diskrit vs prob.fitur_seri ──
    tgl_, o, h, l, c, v = prob._seri_ke_larik(seri)
    asing = prob._asing_net5(tk, tgl_)
    F, _ev = prob.fitur_seri(o, h, l, c, v, asing)
    n_cek = 0
    for t in range(60, len(seri)):
        zm, bm, vm = zona_manual(seri, t), beruntun_manual(seri, t), volume_manual(seri, t)
        assert zm == F[t][3], f"zona pivot beda @ t={t}: manual {zm} vs mesin {F[t][3]}"
        assert bm == F[t][11], f"beruntun beda @ t={t}: manual {bm} vs mesin {F[t][11]}"
        assert vm == F[t][4], f"volume beda @ t={t}: manual {vm} vs mesin {F[t][4]}"
        n_cek += 1
    print(f"OK  fitur zona-pivot/beruntun/volume {tk}: {n_cek} bar, manual == prob.fitur_seri")

    # ── (b) n & p5 vs prob.prob_setup, pool KECIL dari cache edisi ──
    pool = prob.bangun_pool(ohlc)
    assert pool is not None, "pool kosong dari cache edisi — cek data"
    t = len(seri) - 1
    f = F[t]
    hasil = prob.prob_setup(pool, f)
    k = hasil["cocok"]
    Fp, e5p = pool["F"], pool["e5"]
    n_manual = naik_manual = 0
    for i in range(len(Fp)):
        if sum(1 for j in range(13) if Fp[i][j] == f[j]) >= k:
            n_manual += 1
            naik_manual += float(e5p[i])
    p_manual = naik_manual / n_manual if n_manual else None
    assert n_manual == hasil["n"], f"n beda: manual {n_manual} vs mesin {hasil['n']}"
    if hasil["p5"] is None:
        assert p_manual is None, f"p5 mesin None tapi manual {p_manual}"
        print(f"i   {tk} cocok {k}/13 n={n_manual} — sampel 0, tak ada p5 utk dibandingkan")
    else:
        assert abs(p_manual - hasil["p5"]) < 1e-6, f"p5 beda: manual {p_manual} vs mesin {hasil['p5']}"
        print(f"OK  n & p5 {tk} (cocok {k}/13): manual n={n_manual} p5={p_manual:.4f} "
              f"== mesin n={hasil['n']} p5={hasil['p5']:.4f}")

    # ── (c) Wilson CI vs rumus baku ──
    if hasil["p5"] is not None:
        lo_m, hi_m = wilson_manual(hasil["p5"], hasil["n"])
        lo_e, hi_e = hasil["ci5"]
        assert abs(lo_m - lo_e) < 1e-9 and abs(hi_m - hi_e) < 1e-9, \
            f"CI beda: manual ({lo_m},{hi_m}) vs mesin ({lo_e},{hi_e})"
        print(f"OK  Wilson CI95 {tk}: manual [{lo_m:.4f},{hi_m:.4f}] "
              f"== mesin [{lo_e:.4f},{hi_e:.4f}]")
    # cek rumus baku sendiri jg thd contoh buku teks (p=0.5, n=100 -> CI lebar wajar)
    lo, hi = wilson_manual(0.5, 100)
    assert 0.40 < lo < 0.41 and 0.59 < hi < 0.60, f"Wilson sanity gagal: {lo},{hi}"
    print(f"OK  Wilson sanity p=0,5 n=100 -> [{lo:.4f},{hi:.4f}]")


if __name__ == "__main__":
    main()
