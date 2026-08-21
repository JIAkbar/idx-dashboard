"""Swauji prob.py v2 — deret sintetis dengan jawaban yang dihitung tangan.

Jalankan: C:\\Python314\\python.exe test_prob.py   (dari folder arus-pasar/)
Tiap blok memeriksa SATU hal yang kalau salah akan gagal senyap di terbitan
(zona pivot meleset satu tangga, streak kelebihan satu, cutoff bocor ke
masa depan). Angka acuannya dari kasus BUMI 20–21 Agu 2026 yang sudah
dicocokkan manual di obrolan: H191 L183 C190 → P188 R1 193 R2 196 S1 185 S2 180.
"""
import numpy as np

import prob


def deret(closes, hi=None, lo=None, op=None, vol=None):
    c = np.array(closes, float)
    h = np.array(hi, float) if hi is not None else c + 1
    l = np.array(lo, float) if lo is not None else c - 1
    o = np.array(op, float) if op is not None else c.copy()
    v = np.array(vol, float) if vol is not None else np.full(len(c), 1e6)
    return o, h, l, c, v


def uji_zona_pivot():
    # bar 0 = "kemarin" BUMI; bar 1..6 = close yang diuji terhadap tangga itu
    closes = [190, 196, 194, 190, 187, 183, 179]
    hi = [191] + [c + 0.5 for c in closes[1:]]
    lo = [183] + [c - 0.5 for c in closes[1:]]
    # bar 1..6 harus membaca pivot dari bar SEBELUMNYA masing-masing; untuk
    # menguji tangga BUMI persis, tiap bar uji dibuat berdiri sendiri:
    for c_uji, zona_harap in ((196, 5), (194, 4), (190, 3), (187, 2), (183, 1), (179, 0)):
        o, h, l, c, v = deret([190, c_uji], hi=[191, c_uji + .5], lo=[183, c_uji - .5])
        F, _ = prob.fitur_seri(o, h, l, c, v)
        assert F[1, 3] == zona_harap, f"close {c_uji}: zona {F[1,3]} ≠ {zona_harap}"
    print("OK  zona pivot: 6 tangga BUMI cocok (196→>R2 … 179→<S2)")


def uji_streak_dan_gap():
    o, h, l, c, v = deret([1, 2, 3, 4, 5, 4, 5], op=[1, 2, 3.5, 3.01, 5, 3.9, 5.2])
    F, _ = prob.fitur_seri(o, h, l, c, v)
    assert list(F[:, 11]) == [0, 1, 2, 3, 3, 0, 1], list(F[:, 11])
    # gap: open vs close kemarin; 3.5 vs 2 = +75% → naik(2); 3.9 vs 5 = −22% → turun(0)
    assert F[2, 10] == 2 and F[5, 10] == 0 and F[3, 10] == 1, list(F[:, 10])
    print("OK  beruntun (0,1,2,3,3+,0,1) & gap (naik/datar/turun)")


def uji_kejadian():
    # close naik 1/hari: e5 benar untuk semua t yang punya t+5; e3 (+3%) tergantung level
    c = np.array([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110], float)
    o, h, l, cc, v = deret(c, hi=c, lo=c)
    F, ev = prob.fitur_seri(o, h, l, cc, v)
    assert all(ev["e5"][:6] == 1) and np.isnan(ev["e5"][6:]).all()
    # dari 100: max high t+1..t+5 = 105 ≥ 103 → e3 benar; dari 105: 110 ≥ 108,15 → benar
    assert ev["e3"][0] == 1 and abs(ev["fmax"][0] - 0.05) < 1e-9 and abs(ev["ret5"][0] - 0.05) < 1e-9
    print("OK  kejadian e5/e3/fmax/ret5 di deret naik tetap")


def uji_wilson():
    lo, hi = prob.wilson(0.5, 100)
    assert abs(lo - 0.4038) < 1e-3 and abs(hi - 0.5962) < 1e-3, (lo, hi)
    assert prob.wilson(None, 0) == (None, None)
    print("OK  Wilson 95% (p=0,5 n=100 → 0,404–0,596)")


def uji_prob_setup_dan_mundur():
    rng = np.random.default_rng(0)
    F = rng.integers(0, 2, size=(2000, prob.N_FITUR)).astype(np.int8)
    e5 = rng.random(2000) < 0.4
    pool = {"F": F, "e5": e5.astype(np.float32), "e3": e5.astype(np.float32),
            "fmax": np.full(2000, 0.02, np.float32), "fmin": np.full(2000, -0.02, np.float32),
            "ret5": np.zeros(2000, np.float32)}
    f = F[0]
    h = prob.prob_setup(pool, f, min_n=50)
    m = (F == f).sum(axis=1)
    # n yang dilaporkan harus = jumlah baris dengan cocok ≥ k, dan k adalah yang
    # pertama (dari 13 turun) yang memenuhi min_n
    k = prob.N_FITUR
    while k > 1 and (m >= k).sum() < 50:
        k -= 1
    assert h["cocok"] == k and h["n"] == int((m >= k).sum()), (h["cocok"], h["n"], k)
    assert abs(h["p5"] - e5[m >= k].mean()) < 1e-6  # e5 float32
    assert abs(h["base5"] - e5.mean()) < 1e-6
    # pR1: fmax 2% ≥ jarak 1% → 1,0; jarak 3% → 0,0
    assert prob.prob_setup(pool, f, {"R1": 0.01}, min_n=50)["pR1"] == 1.0
    assert prob.prob_setup(pool, f, {"R1": 0.03}, min_n=50)["pR1"] == 0.0
    print(f"OK  prob_setup: mundur bertahap ke k={k}, n & p5 & dasar cocok loop manual")


def uji_cutoff_tidak_bocor():
    T = 120
    tgl = [str(np.datetime64("2026-01-01") + np.timedelta64(i, "D")) for i in range(T)]
    c = 100 + np.cumsum(np.ones(T))
    seri = [{"d": tgl[i], "o": c[i], "h": c[i] + 1, "l": c[i] - 1, "c": c[i], "v": 1e7} for i in range(T)]
    penuh = prob.bangun_pool({"UJI": seri}, pakai_asing=False)
    potong = prob.bangun_pool({"UJI": seri}, cutoff=tgl[90], pakai_asing=False)
    assert potong["tgl"].max() <= np.datetime64(tgl[90])
    assert len(potong["e5"]) < len(penuh["e5"])
    # observasi t terakhir yang lolos: t+5 ≤ indeks 90 → t ≤ 85 → jumlah = 85−60+1
    assert len(potong["e5"]) == 85 - prob.T0 + 1, len(potong["e5"])
    print("OK  cutoff: observasi yang jendelanya melewati tanggal edisi dibuang")


if __name__ == "__main__":
    uji_zona_pivot()
    uji_streak_dan_gap()
    uji_kejadian()
    uji_wilson()
    uji_prob_setup_dan_mundur()
    uji_cutoff_tidak_bocor()
    print("SEMUA OK")
