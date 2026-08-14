"""Arus Pasar — mesin PCD (Price of Construction Distribution).

METODE (label jujur, wajib ikut tercetak di output produk):
APROKSIMASI DARI OHLCV — BUKAN DATA DONE PER HARGA. Volume tiap bar disebar
merata di rentang low..high bar itu pada bin kelipatan tick size wajar IDX,
lalu dibobot peluruhan waktu half-life 60 hari bursa (bar terbaru bobot 1,
bar 60 hari lalu bobot 0,5, dst). Hasil:
  kurva      : distribusi volume(tertimbang) x harga, terurut harga
  pcd        : rata-rata harga tertimbang volume ("harga konstruksi" rerata)
  p25/p50/p75: persentil kumulatif volume (zona modal)
  diatas_air : porsi volume tertimbang dengan harga bin <= close terakhir
               (aproksimasi % float yang posisinya untung/impas)
"""

HALF_LIFE = 60


def tick_size(harga):
    """Fraksi harga wajar IDX."""
    if harga < 200:   return 1
    if harga < 500:   return 2
    if harga < 2000:  return 5
    if harga < 5000:  return 10
    return 25


def hitung_pcd(seri, half_life=HALF_LIFE):
    """seri = list bar {'l','h','c','v'} terurut waktu. -> dict hasil PCD.

    Bar boleh membawa 'umur' (usia dalam HARI BURSA, float) — dipakai bar
    intraday (beberapa bar berbagi umur hari yang sama) supaya bobot peluruhan
    tetap berbasis hari, bukan posisi indeks. Tanpa 'umur', fallback posisi
    indeks (perilaku lama, seri harian murni)."""
    bins = {}
    n = len(seri)
    for i, b in enumerate(seri):
        if not b["v"]:
            continue
        umur = b.get("umur", n - 1 - i)
        w = 0.5 ** (umur / half_life)
        lo, hi = b["l"], b["h"]
        t = tick_size((lo + hi) / 2)
        # level kelipatan tick di [lo, hi]; bar tanpa rentang -> 1 level di lo
        p0 = -(-lo // t) * t          # ceil ke kelipatan tick
        levels = []
        p = p0
        while p <= hi + 1e-9:
            levels.append(p)
            p += t
        if not levels:
            levels = [round(lo / t) * t]
        per = b["v"] * w / len(levels)
        for p in levels:
            bins[p] = bins.get(p, 0.0) + per

    kurva = sorted(bins.items())
    total = sum(v for _, v in kurva)
    pcd = sum(p * v for p, v in kurva) / total

    def persentil(q):
        ambang = q * total
        kum = 0.0
        for p, v in kurva:
            kum += v
            if kum >= ambang - 1e-9:
                return p
        return kurva[-1][0]

    close = seri[-1]["c"]
    diatas_air = sum(v for p, v in kurva if p <= close + 1e-9) / total
    return {
        "kurva": kurva, "pcd": pcd,
        "p25": persentil(0.25), "p50": persentil(0.50), "p75": persentil(0.75),
        "diatas_air": diatas_air, "close": close, "n_bar": n,
        "half_life": half_life,
        "metode": "aproksimasi OHLCV (volume disebar merata low–high per bar, "
                  f"peluruhan half-life {half_life} hari bursa) — bukan data done per harga",
    }


def _demo():
    """Cek tangan 1: satu bar 100–104 (tick 1) vol 500 -> 5 bin x 100.
    PCD 102; p25 di 101 (kum 200 >= 125), p50 di 102, p75 di 103; close 104
    -> 100% di atas air."""
    r = hitung_pcd([{"l": 100, "h": 104, "c": 104, "v": 500}])
    assert [p for p, _ in r["kurva"]] == [100, 101, 102, 103, 104]
    assert all(abs(v - 100) < 1e-9 for _, v in r["kurva"])
    assert abs(r["pcd"] - 102) < 1e-9
    assert (r["p25"], r["p50"], r["p75"]) == (101, 102, 103)
    assert abs(r["diatas_air"] - 1.0) < 1e-9

    """Cek tangan 2: bar umur 60 hari (bobot 0,5) di level 100 vol 1000
    (-> 500) + bar terbaru level 200 vol 250 (-> 250). Umur diisi 59 bar
    kosong (v=0) di antaranya. PCD = (500x100 + 250x200)/750 = 133,33;
    close 150 -> di atas air 500/750 = 66,7%."""
    seri = ([{"l": 100, "h": 100, "c": 100, "v": 1000}]
            + [{"l": 150, "h": 150, "c": 150, "v": 0}] * 59
            + [{"l": 200, "h": 200, "c": 150, "v": 250}])
    r = hitung_pcd(seri)
    assert abs(r["pcd"] - 400 / 3) < 1e-9, r["pcd"]
    assert abs(r["diatas_air"] - 2 / 3) < 1e-9
    assert (r["p25"], r["p50"], r["p75"]) == (100, 100, 200)
    print("OK  2 distribusi buatan cocok hitungan tangan")


if __name__ == "__main__":
    _demo()
