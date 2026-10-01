"""Peluang Naik: sinyal dari 13 ebook KOMINSA + riset, diuji di seluruh IDX per rezim (#270).

Johan 2 Okt 2026: *"modal itu hasil kmu belajar dari buku dan deep research biar
jadi metode baru mengukur probabilitas baik dari sisi market bulllish dan
bearish yang memiliki kemungkinan terbesar saham akan naik"*.

KEJADIAN (yang diukur): dari close hari t, harga menyentuh +5% SEBELUM
menyentuh -5% dalam 20 hari bursa. Hari yang menyentuh keduanya dihitung kalah
(konservatif). Ini lebih jujur daripada "close lebih tinggi" karena memaksa
target dan batas rugi yang sama besar, persis aturan Mega Profit bab 10.

REZIM: IHSG close di atas MA200 = bullish, di bawah = bearish (per tanggal t).

UJI: tiga periode. Latih 2015 s.d. 30 hari sebelum 2023-01-01 (jeda supaya
jendela kejadian tak menembus periode berikutnya); VALIDASI 2023-01-01 s.d.
2024-06-30; KUNCI >= 2024-07-01. Sinyal LOLOS di satu rezim bila di data latih
lift > 0 dengan batas bawah CI 95% di atas angka dasar, DAN di data validasi
lift-nya tetap positif dengan n >= 200. Skor emiten = jumlah sinyal lolos yang
aktif; peluangnya dibaca dari tabel kalibrasi periode KUNCI, yang tak dipakai
memilih apa pun (sanggahan pemeriksa akhir 2 Okt 2026).
Observasi bertumpuk (hari berurutan), jadi CI terlalu sempit: angka ini peta,
bukan janji. Emiten yang sudah delisting tak ada di data (bias survivor).

Pakai:  python scripts/riset/peluang_naik.py
Keluar: data-idx/json/peluang_naik.json
Uji:    python scripts/riset/peluang_naik.py --uji
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

AKAR = Path(__file__).resolve().parents[2]
JSON = AKAR / "data-idx" / "json"
TARGET, BATAS, H = 0.05, 0.05, 20
MULAI, BELAH, KUNCI = np.datetime64("2015-01-01"), np.datetime64("2023-01-01"), np.datetime64("2024-07-01")
JEDA = np.timedelta64(30, "D")  # latih berhenti 30 hari sebelum BELAH: jendela kejadian 20 hari bursa tak menembus uji
NILAI_MIN = 2e9  # nilai transaksi rata-rata 20 hari, rupiah
MIN_N_UJI = 200


def sma(x, n):
    c = np.cumsum(np.insert(x, 0, 0.0))
    out = np.full(len(x), np.nan)
    out[n - 1:] = (c[n:] - c[:-n]) / n
    return out


def ema(x, n):
    a, out = 2 / (n + 1), np.empty(len(x))
    out[0] = x[0]
    for i in range(1, len(x)):
        out[i] = a * x[i] + (1 - a) * out[i - 1]
    return out


def rsi(c, n=14):
    d = np.diff(c, prepend=c[0])
    up, dn = ema(np.clip(d, 0, None), 2 * n - 1), ema(np.clip(-d, 0, None), 2 * n - 1)
    return 100 - 100 / (1 + up / np.where(dn == 0, 1e-9, dn))


def roll_max(x, n):
    out = np.full(len(x), np.nan)
    if len(x) >= n:
        out[n - 1:] = sliding_window_view(x, n).max(axis=1)
    return out


def adx(h, l, c, n=14):
    tr = np.maximum(h - l, np.maximum(abs(h - np.roll(c, 1)), abs(l - np.roll(c, 1))))
    up, dn = h - np.roll(h, 1), np.roll(l, 1) - l
    pdm = np.where((up > dn) & (up > 0), up, 0.0)
    ndm = np.where((dn > up) & (dn > 0), dn, 0.0)
    tr[0] = pdm[0] = ndm[0] = 0
    atr = ema(tr, 2 * n - 1)
    pdi = 100 * ema(pdm, 2 * n - 1) / np.where(atr == 0, 1e-9, atr)
    ndi = 100 * ema(ndm, 2 * n - 1) / np.where(atr == 0, 1e-9, atr)
    dx = 100 * abs(pdi - ndi) / np.where(pdi + ndi == 0, 1e-9, pdi + ndi)
    return ema(dx, 2 * n - 1), pdi, ndi, atr


def kejadian(h, l, c):
    """1 = +TARGET tersentuh sebelum -BATAS dalam H hari; 0 = tidak; nan = jendela belum lengkap."""
    n = len(c)
    out = np.full(n, np.nan)
    if n <= H:
        return out
    hw = sliding_window_view(h[1:], H)[: n - H]
    lw = sliding_window_view(l[1:], H)[: n - H]
    base = c[: n - H, None]
    naik = hw >= base * (1 + TARGET)
    turun = lw <= base * (1 - BATAS)
    i_naik = np.where(naik.any(1), naik.argmax(1), H + 1)
    i_turun = np.where(turun.any(1), turun.argmax(1), H + 1)
    out[: n - H] = (i_naik < i_turun).astype(float)
    return out


# (kunci, nama tampil, asal) - definisi dihitung di sinyal_seri()
SINYAL = [
    ("formasi_ma", "Formasi MA naik: close > MA50 > MA200", "Mega Profit bab 25 (formasi moving average)"),
    ("dekat_puncak", "Dekat puncak 52 minggu: close >= 90% tertinggi setahun", "riset momentum 52-week high"),
    ("tembus_vol", "Tembus tertinggi 20 hari + toleransi 1,5%, volume >= 1,5x rata-rata", "Mega Profit bab 9 (toleransi) dan bab 18 (volume)"),
    ("pullback_tren", "Koreksi di tren naik: close > MA200 dan RSI14 < 40", "Mega Profit bab 27 (RSI di tren)"),
    ("jenuh_jual", "Jenuh jual: RSI14 < 30", "Mega Profit bab 27; riset pembalikan jangka pendek"),
    ("jatuh_dalam", "Jatuh dalam: turun > 15% dalam 20 hari", "riset pembalikan jangka pendek"),
    ("adx_naik", "Tren kuat naik: ADX14 > 25 dan DI+ > DI-", "Mega Profit bab 27 (ADX)"),
    ("asing_20", "Asing net beli 20 hari", "Bandarmology; riset aliran asing pasar berkembang"),
    ("asing_serap", "Asing net beli 5 hari saat harga 5 hari turun", "Analisa PAPAN v1 (menyerap saat merah)"),
    ("sempit", "Volatilitas menyempit (ATR% di 20% terbawah setahun) dan close > MA50", "Mega Profit bab 21 (segitiga/apex)"),
    ("golden_cross", "Golden cross: MA50 memotong ke atas MA200 dalam 10 hari", "Mega Profit bab 25"),
    ("palu_support", "Candle palu di dekat terendah 20 hari", "Mega Profit bab 26 (candlestick)"),
    # Tambahan dari riset web (2 Okt 2026), ditetapkan SEBELUM diuji; antar-emiten = peringkat per tanggal.
    ("pembalikan_xs", "Paling jatuh 5 hari: 10% terbawah antar-emiten", "Jegadeesh 1990; Lehmann 1990 (pembalikan jangka pendek)"),
    ("momentum_12_1", "Momentum 12-1 bulan: 30% teratas antar-emiten", "Jegadeesh & Titman 1993"),
    ("puncak_95", "Sangat dekat puncak 52 minggu: close >= 95% tertinggi setahun", "George & Hwang 2004"),
    ("volume_ekstrem", "Volume ekstrem: >= 2x rata-rata 20 hari", "Gervais, Kaniel & Mingelgrin 2001"),
    ("asing_kuat", "Asing net beli 20 hari terbesar relatif volume: 20% teratas antar-emiten", "Froot dkk. 1998; studi IDX 2024"),
    ("kuat_relatif", "Kuat relatif: naik 20 hari >= 10 poin di atas IHSG", "kekuatan relatif (pemimpin saat pasar turun)"),
]
XS = {"pembalikan_xs": ("r5", 0.10, "bawah"), "momentum_12_1": ("mom", 0.30, "atas"), "asing_kuat": ("asr", 0.20, "atas")}


def sinyal_seri(o, h, l, c, v, asing, ihsg_ret20=None):
    ma50, ma200 = sma(c, 50), sma(c, 200)
    r = rsi(c)
    hi252, hi20 = roll_max(h, 252), np.roll(roll_max(h, 20), 1)
    lo20 = -roll_max(-l, 20)
    v20 = np.roll(sma(v, 20), 1)
    a, pdi, ndi, atr = adx(h, l, c)
    atrp = atr / c
    lo_q = np.full(len(c), np.nan)
    if len(c) >= 252:
        w = sliding_window_view(atrp, 252)
        lo_q[251:] = np.nanquantile(w, 0.2, axis=1)
    ret20 = c / np.roll(c, 20) - 1
    ret5 = c / np.roll(c, 5) - 1
    body = abs(c - o)
    bawah = np.minimum(o, c) - l
    cross = (ma50 > ma200) & (np.roll(ma50, 1) <= np.roll(ma200, 1))
    cross10 = sliding_window_view(np.pad(cross.astype(int), (9, 0)), 10).max(axis=1).astype(bool)
    s = {
        "formasi_ma": (c > ma50) & (ma50 > ma200),
        "dekat_puncak": c >= 0.9 * hi252,
        "tembus_vol": (c > hi20 * 1.015) & (v >= 1.5 * v20),
        "pullback_tren": (c > ma200) & (r < 40),
        "jenuh_jual": r < 30,
        "jatuh_dalam": ret20 < -0.15,
        "adx_naik": (a > 25) & (pdi > ndi),
        "asing_20": np.zeros(len(c), bool) if asing is None else np.nan_to_num(asing[1]) > 0,
        "asing_serap": np.zeros(len(c), bool) if asing is None else (np.nan_to_num(asing[0]) > 0) & (ret5 < 0),
        "sempit": (atrp <= lo_q) & (c > ma50),
        "golden_cross": cross10,
        "palu_support": (bawah >= 2 * np.maximum(body, 1e-9)) & (c >= l + 0.66 * (h - l)) & (l <= lo20 * 1.02) & (h > l),
        "puncak_95": c >= 0.95 * hi252,
        "volume_ekstrem": v >= 2 * v20,
        "kuat_relatif": np.zeros(len(c), bool) if ihsg_ret20 is None else (ret20 - ihsg_ret20) >= 0.10,
    }
    for k in s:
        s[k] = np.nan_to_num(s[k]).astype(bool)
    # nilai mentah untuk peringkat antar-emiten (dihitung sesudah semua emiten terkumpul)
    mom = np.roll(c, 21) / np.roll(c, 252) - 1
    mom[:252] = np.nan
    asr = np.full(len(c), np.nan) if asing is None else asing[1] / np.where(v20 * 20 == 0, np.nan, v20 * 20)
    return s, {"r5": ret5, "mom": mom, "asr": asr}


def baca(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def asing_seri(kode, tgl):
    p = JSON / "asing" / f"{kode}.json"
    if not p.exists():
        return None
    net = {r[0]: (r[1] or 0) - (r[2] or 0) for r in baca(p).get("d") or [] if r and len(r) >= 3}
    x = np.array([net.get(t, np.nan) for t in tgl], float)
    z = np.nan_to_num(x)
    return sma(z, 5) * 5, sma(z, 20) * 20


def wilson(p, n, z=1.96):
    if n == 0:
        return (None, None)
    d = 1 + z * z / n
    m = (p + z * z / (2 * n)) / d
    s = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (m - s, m + s)


def ringkas(e, m):
    n = int(m.sum())
    if n == 0:
        return {"n": 0, "p": None}
    p = float(e[m].mean())
    lo, hi = wilson(p, n)
    return {"n": n, "p": round(p, 4), "ci": [round(lo, 4), round(hi, 4)]}


def main():
    ihsg = baca(JSON / "ohlc" / "IHSG.json")["d"]
    it = np.array([b[0] for b in ihsg], dtype="datetime64[D]")
    ic = np.array([b[4] for b in ihsg], float)
    bull_map = dict(zip(it, ic > sma(ic, 200)))
    iret20 = dict(zip(it, ic / np.roll(ic, 20) - 1))
    rezim_kini = "bullish" if bull_map[it[-1]] else "bearish"
    E, R, T, K, S = [], [], [], [], {k: [] for k, *_ in SINYAL if k not in XS}
    MENTAH = {m: [] for m in ("r5", "mom", "asr")}
    hari_ini = []
    for p in sorted((JSON / "ohlc").glob("*.json")):
        if p.stem == "IHSG" or p.stem.startswith("_"):
            continue
        d = [b for b in baca(p).get("d") or [] if b and b[4]]
        if len(d) < 300:
            continue
        tgl = [b[0] for b in d]
        o, h, l, c, v = (np.array([b[i] or b[4] for b in d], float) for i in (1, 2, 3, 4, 5))
        v = np.array([b[5] or 0 for b in d], float)
        t64 = np.array(tgl, dtype="datetime64[D]")
        s, mentah = sinyal_seri(o, h, l, c, v, asing_seri(p.stem, tgl),
                                np.array([iret20.get(t, np.nan) for t in t64]))
        e = kejadian(h, l, c)
        nilai20 = sma(c * v, 20)
        ok = (~np.isnan(e)) & (t64 >= MULAI) & (np.nan_to_num(nilai20) >= NILAI_MIN)
        ok[:252] = False
        kini = (t64 == it[-1]) & (np.nan_to_num(nilai20) >= NILAI_MIN)
        ok = ok | kini  # bar hari ini ikut dikumpulkan untuk peringkat antar-emiten (kejadiannya nan)
        reg = np.array([bull_map.get(t, False) for t in t64])
        E.append(e[ok]); R.append(reg[ok]); T.append(t64[ok]); K.append(np.full(ok.sum(), p.stem))
        for k in S:
            S[k].append(s[k][ok])
        for m in MENTAH:
            MENTAH[m].append(mentah[m][ok])
        if kini[-1]:
            hari_ini.append({"kode": p.stem, "harga": float(c[-1]), "nilai20": float(nilai20[-1])})
    e, reg, t = np.concatenate(E), np.concatenate(R), np.concatenate(T)
    kode = np.concatenate(K)
    S = {k: np.concatenate(x) for k, x in S.items()}
    import pandas as pd
    for k, (m, q, arah) in XS.items():
        x = pd.Series(np.concatenate(MENTAH[m]))
        pct = x.groupby(t).rank(pct=True)
        S[k] = ((pct <= q) if arah == "bawah" else (pct > 1 - q)).fillna(False).to_numpy()
    akhir = t == it[-1]
    for x in hari_ini:
        i = np.where(akhir & (kode == x["kode"]))[0][0]
        x["aktif"] = [k for k in S if S[k][i]]
    nyata = ~np.isnan(e)
    e, reg, t, kode = e[nyata], reg[nyata], t[nyata], kode[nyata]
    S = {k: v[nyata] for k, v in S.items()}
    latih, uji, kunci = t < BELAH - JEDA, (t >= BELAH) & (t < KUNCI), t >= KUNCI
    hasil, lolos, jebakan = [], {"bullish": [], "bearish": []}, {"bullish": [], "bearish": []}
    for k, nama, asal in SINYAL:
        if k not in S:
            continue
        baris = {"kunci": k, "nama": nama, "asal": asal}
        for rz, mr in (("bullish", reg), ("bearish", ~reg)):
            dl, du = latih & mr, uji & mr
            bl, bu = ringkas(e, dl), ringkas(e, du)
            sl, su = ringkas(e, dl & S[k]), ringkas(e, du & S[k])
            ok = (sl["n"] > 0 and su["n"] >= MIN_N_UJI and sl["ci"][0] > bl["p"] and su["p"] > bu["p"])
            # JEBAKAN: cermin aturan lolos - peluang di bawah dasar di latih (CI atas < dasar) DAN di uji.
            jb = (sl["n"] > 0 and su["n"] >= MIN_N_UJI and sl["ci"][1] < bl["p"] and su["p"] < bu["p"])
            baris[rz] = {"latih": sl, "uji": su, "dasar_latih": bl, "dasar_uji": bu,
                         "lift_uji_pp": round((su["p"] - bu["p"]) * 100, 1) if su["n"] else None,
                         "lolos": bool(ok), "jebakan": bool(jb)}
            if ok:
                lolos[rz].append(k)
            if jb:
                jebakan[rz].append(k)
        hasil.append(baris)
    kalibrasi = {}
    for rz, mr in (("bullish", reg), ("bearish", ~reg)):
        skor = sum(S[k].astype(int) for k in lolos[rz]) if lolos[rz] else np.zeros(len(e), int)
        tab = []
        for sk in range(0, len(lolos[rz]) + 1):
            m = kunci & mr & (skor == sk) if sk < 3 else kunci & mr & (skor >= 3)
            r = ringkas(e, m)
            tab.append({"skor": sk if sk < 3 else "3+", **r})
            if sk >= 3:
                break
        kalibrasi[rz] = tab
        jb = sum(S[k].astype(int) for k in jebakan[rz]) if jebakan[rz] else np.zeros(len(e), int)
        kalibrasi[rz + "_jebakan"] = [{"jebakan": j if j < 2 else "2+", **ringkas(e, kunci & mr & ((jb == j) if j < 2 else (jb >= 2)))}
                                      for j in range(3)]
    # Sinyal lolos baru dipakai memeringkat bila periode KUNCI menegaskannya: tiap skor >= 1
    # berpeluang lebih tinggi daripada skor 0. Kalau tidak, peringkat memakai tabel jebakan saja.
    terkonfirmasi = {}
    for rz in ("bullish", "bearish"):
        tb = [b for b in kalibrasi[rz] if b["p"] is not None]
        terkonfirmasi[rz] = bool(lolos[rz]) and len(tb) > 1 and all(b["p"] > tb[0]["p"] for b in tb[1:])
    tab_kini = {str(b["skor"]): b for b in kalibrasi[rezim_kini]}
    tab_jb = {str(b["jebakan"]): b for b in kalibrasi[rezim_kini + "_jebakan"]}
    peringkat = []
    for x in hari_ini:
        ak = [k for k in x["aktif"] if k in lolos[rezim_kini]]
        jk = [k for k in x["aktif"] if k in jebakan[rezim_kini]]
        sk = len(ak)
        b = tab_kini.get(str(sk) if sk < 3 else "3+", {})
        bj = tab_jb.get(str(len(jk)) if len(jk) < 2 else "2+", {})
        # Peluang dari tabel yang relevan: di rezim tanpa sinyal lolos, tabel jebakan yang membedakan.
        pb = b if terkonfirmasi[rezim_kini] else bj
        if not terkonfirmasi[rezim_kini]:
            ak, sk = [], 0
        peringkat.append({"kode": x["kode"], "harga": x["harga"], "nilai20_m": round(x["nilai20"] / 1e9, 1), "skor": sk, "sinyal": ak, "jebakan": jk,
                          "p": pb.get("p"), "ci": pb.get("ci")})
    peringkat.sort(key=lambda r: (-r["skor"], len(r["jebakan"]), -(r["p"] or 0), -r["nilai20_m"]))
    keluar = {
        "tanggal": str(it[-1]), "rezim": rezim_kini,
        "ihsg": {"close": float(ic[-1]), "ma200": round(float(sma(ic, 200)[-1]), 2)},
        "definisi": {"target_pct": TARGET * 100, "batas_pct": BATAS * 100, "hari": H,
                     "latih": f"{MULAI} s.d. {BELAH - JEDA - 1}", "validasi": f"{BELAH} s.d. {KUNCI - 1}",
                     "uji": f"{KUNCI} s.d. {t.max()}",
                     "nilai_min": NILAI_MIN},
        "cakupan": {"observasi": int(len(e)), "emiten": int(len(set(kode))), "sinyal_diuji": len(SINYAL),
                    "emiten_hari_ini": len(hari_ini)},
        "sinyal": hasil, "lolos": lolos, "jebakan": jebakan, "kalibrasi": kalibrasi, "terkonfirmasi": terkonfirmasi,
        "peringkat": peringkat[:30],
        "hindari": sorted([r for r in peringkat if len(r["jebakan"]) >= 2], key=lambda r: (-len(r["jebakan"]), r["kode"]))[:30],
        # Siaga: skor bullish hari ini, dibaca dari kalibrasi bullish - berguna bila rezim berbalik.
        "siaga_bullish": sorted(
            [{"kode": x["kode"], "harga": x["harga"], "sinyal": [k for k in x["aktif"] if k in lolos["bullish"]],
              "jebakan_kini": [k for k in x["aktif"] if k in jebakan[rezim_kini]]} for x in hari_ini],
            key=lambda r: (-len(r["sinyal"]), len(r["jebakan_kini"]), r["kode"]))[:20],
        "peringkat_semua": {r["kode"]: [r["skor"], r["p"], r["sinyal"], r["jebakan"]] for r in peringkat},
    }
    (JSON / "peluang_naik.json").write_text(json.dumps(keluar, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(f"rezim {rezim_kini} | observasi {len(e):,} | emiten hari ini {len(hari_ini)}")
    for b in hasil:
        print(f"{b['kunci']:14} " + " | ".join(
            f"{rz[:4]} uji n={b[rz]['uji']['n']:6} p={b[rz]['uji']['p']} dasar={b[rz]['dasar_uji']['p']} "
            f"lift={b[rz]['lift_uji_pp']} {'LOLOS' if b[rz]['lolos'] else '-'}" for rz in ("bullish", "bearish")))
    print("kalibrasi", json.dumps(kalibrasi))
    print("jebakan", jebakan)
    print("teratas", [(r["kode"], r["skor"], len(r["jebakan"]), r["p"]) for r in peringkat[:12]])
    print("hindari", len(keluar["hindari"]), [r["kode"] for r in keluar["hindari"][:12]])


def uji():
    h = np.array([10, 10.6, 10, 10, 10] + [10] * 25, float)
    l = np.array([10, 10, 9.4, 10, 10] + [10] * 25, float)
    c = np.full(30, 10.0)
    e = kejadian(h, l, c)
    assert e[0] == 1.0  # +5% di hari ke-1, -5% di hari ke-2: naik lebih dulu
    assert e[1] == 0.0  # dari hari 1 (close 10): -5% di hari 2 lebih dulu
    assert np.isnan(e[-1])
    assert abs(sma(np.arange(5.0), 2)[-1] - 3.5) < 1e-9
    print("uji peluang_naik: LOLOS")


if __name__ == "__main__":
    uji() if "--uji" in sys.argv else main()
