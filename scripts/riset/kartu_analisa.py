# -*- coding: utf-8 -*-
"""Hitung angka NYATA untuk purwarupa Kartu Analisa Emiten (docs/riset/kartu-analisa.html).

Sekali pakai — tidak dipanggil pipeline mana pun. Tujuannya satu: memastikan
tiap angka di kartu purwarupa punya asal-usul yang bisa diulang, bukan
karangan. Jalankan dari akar repo:

    python scripts/riset/kartu_analisa.py ARCI WIFI BUMI

Yang dihitung, dan dari mana:

| Blok kartu            | Sumber                        | Metode                                   |
|-----------------------|-------------------------------|------------------------------------------|
| Harga & perubahan     | data-idx/json/ohlc/<KODE>.json| lilin harian terakhir                    |
| Struktur (MA/ATR)     | idem                          | MA20/50/200, ATR14 (Wilder)              |
| Support & resistance  | idem                          | klaster pivot fraktal k=5, toleransi ATR |
| Karakter emiten       | idem + 964 emiten lain        | Efficiency Ratio 20 hari + persentil     |
| Waktu ke target       | idem                          | first-passage empiris (target vs stop)   |
| Musiman bulan berjalan| idem                          | imbal bulanan + Wilson + susut ALFA=6    |
| Likuiditas            | idem                          | median nilai transaksi 20 hari           |
| Sektor / papan        | data-idx/json/emiten_sektor.json | apa adanya                            |
| Fundamental ringkas   | data-idx/json/fundamental/<KODE>.json | apa adanya                      |
| Aliran asing (ringkas)| data-idx/json/asing/<KODE>.json | net beli/jual LEMBAR + porsi thd volume pasar, 5h & 20h |

Aliran asing per emiten dipanen sejak 18 Agu 2026 (989 emiten, commit
5793317d) — beli/jual dalam LEMBAR, bukan rupiah (IDX tidak melaporkan aliran
asing dalam rupiah). Blok ini SENGAJA cuma ringkasan (net + porsi terhadap
volume pasar); panel lengkap ada di Stock Detail, bukan di kartu ini.
`asing_ringkas()`/`ringkas_asing_dari()` di bawah, berkas yang tak ada
mengembalikan `None` — pembaca kartu WAJIB menampilkan "belum tersedia",
bukan 0 (nol berarti asing tak bertransaksi, itu klaim berbeda).

Swauji: `python scripts/riset/kartu_analisa.py --uji`.
"""
from __future__ import annotations

import json
import math
import os
import statistics
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
OHLC = AKAR / "data-idx" / "json" / "ohlc"
ASING = AKAR / "data-idx" / "json" / "asing"
KARTU_DIR = AKAR / "data-idx" / "json" / "kartu"

# ---------------------------------------------------------------- fraksi BEI
JENJANG = [(200, 1), (500, 2), (2000, 5), (5000, 10), (math.inf, 25)]


def fraksi(harga: float) -> int:
    for batas, f in JENJANG:
        if harga <= batas:
            return f
    return 25


def ke_fraksi(harga: float, arah: str = "dekat") -> float:
    """Port dari app/src/lib/fraksiHarga.ts — level yang tak bisa dipesan di
    bursa adalah level palsu."""
    if not math.isfinite(harga) or harga <= 0:
        return 0
    f = fraksi(harga)
    bagi = harga / f
    if abs(round(bagi) - bagi) < 1e-9:
        bagi = round(bagi)
    n = math.ceil(bagi) if arah == "atas" else math.floor(bagi) if arah == "bawah" else round(bagi)
    hasil = n * f
    return hasil if fraksi(hasil) == f else ke_fraksi(hasil, arah)


# ---------------------------------------------------------------- muat data
def muat(kode: str) -> dict:
    d = json.loads((OHLC / f"{kode}.json").read_text(encoding="utf-8"))
    baris = d["d"]
    return {
        "kode": kode,
        "tgl": [r[0] for r in baris],
        "o": [float(r[1]) for r in baris],
        "h": [float(r[2]) for r in baris],
        "l": [float(r[3]) for r in baris],
        "c": [float(r[4]) for r in baris],
        "v": [float(r[5]) for r in baris],
        "mulai": d["mulai"],
        "akhir": d["akhir"],
        "n": d["n"],
    }


# ---------------------------------------------------------------- indikator
def ma(x: list[float], n: int) -> float | None:
    return sum(x[-n:]) / n if len(x) >= n else None


def atr(h: list[float], l: list[float], c: list[float], n: int = 14) -> float | None:
    """ATR Wilder. Dipakai sebagai satuan toleransi klaster S/R — dua level
    yang berjarak kurang dari 0,5 ATR bukan dua level berbeda bagi pasar."""
    if len(c) < n + 1:
        return None
    tr = [max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1])) for i in range(1, len(c))]
    a = sum(tr[:n]) / n
    for x in tr[n:]:
        a = (a * (n - 1) + x) / n
    return a


def rsi(c: list[float], n: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(c)
    if len(c) < n + 1:
        return out
    naik = tur = 0.0
    for i in range(1, n + 1):
        d = c[i] - c[i - 1]
        naik += max(d, 0)
        tur += max(-d, 0)
    naik /= n
    tur /= n
    out[n] = 100 - 100 / (1 + naik / tur) if tur else 100.0
    for i in range(n + 1, len(c)):
        d = c[i] - c[i - 1]
        naik = (naik * (n - 1) + max(d, 0)) / n
        tur = (tur * (n - 1) + max(-d, 0)) / n
        out[i] = 100 - 100 / (1 + naik / tur) if tur else 100.0
    return out


def stoch_rsi(c: list[float], n: int = 14, m: int = 14, k: int = 3) -> tuple[float, float] | None:
    r = [x for x in rsi(c, n) if x is not None]
    if len(r) < m + k:
        return None
    mentah = []
    for i in range(m - 1, len(r)):
        jendela = r[i - m + 1: i + 1]
        lo, hi = min(jendela), max(jendela)
        mentah.append(0.0 if hi == lo else (r[i] - lo) / (hi - lo) * 100)
    kk = sum(mentah[-k:]) / k
    dd = sum(mentah[-k - 2:-2]) / k if len(mentah) >= k + 2 else kk
    return kk, (kk + dd + sum(mentah[-k - 1:-1]) / k) / 3 if len(mentah) >= k + 2 else kk


# ------------------------------------------------------- support/resistance
def pivot_idx(arr: list[float], k: int, rendah: bool) -> list[int]:
    """Pivot fraktal: titik yang jadi ekstrem lokal dalam jendela ±k.
    Sejalan dengan cariPivotRendah/cariPivotTinggi di lib/dasbor/grafikEmiten.ts."""
    out = []
    for i in range(k, len(arr) - k):
        jendela = arr[i - k: i + k + 1]
        if (arr[i] <= min(jendela)) if rendah else (arr[i] >= max(jendela)):
            out.append(i)
    return out


def klaster_level(nilai_tgl: list[tuple[float, str]], tol: float) -> list[dict]:
    """Gabung pivot yang berdekatan (< tol) jadi satu level. Jumlah anggota =
    berapa kali pasar benar-benar berbalik di situ — itulah 'n sentuhan'."""
    if not nilai_tgl:
        return []
    urut = sorted(nilai_tgl)
    kel: list[list[tuple[float, str]]] = [[urut[0]]]
    for nilai, tgl in urut[1:]:
        if nilai - kel[-1][-1][0] <= tol:
            kel[-1].append((nilai, tgl))
        else:
            kel.append([(nilai, tgl)])
    return [
        {
            "level": sum(x[0] for x in g) / len(g),
            "sentuhan": len(g),
            "terakhir": max(x[1] for x in g),
        }
        for g in kel
    ]


def sr(d: dict, k: int = 5, lihat: int = 500) -> tuple[list[dict], list[dict]]:
    """Support/resistance dari klaster pivot pada `lihat` lilin terakhir.

    Level yang jaraknya < 0,5 ATR dari harga sekarang DIBUANG: itu bukan level
    tersendiri, itu rentang hari ini. Tanpa saringan ini ARCI 18 Agu 2026
    memberi 'resistance 1.330' yang cuma +0,76% dari harga — angka yang
    terlihat presisi tapi tak mengandung informasi apa pun.
    """
    a = atr(d["h"], d["l"], d["c"]) or (d["c"][-1] * 0.02)
    tol = a * 0.75
    h, l, t = d["h"][-lihat:], d["l"][-lihat:], d["tgl"][-lihat:]
    sup = klaster_level([(l[i], t[i]) for i in pivot_idx(l, k, True)], tol)
    res = klaster_level([(h[i], t[i]) for i in pivot_idx(h, k, False)], tol)
    harga = d["c"][-1]
    minim = a * 0.5
    sup = sorted([x for x in sup if x["level"] < harga - minim], key=lambda x: -x["level"])
    res = sorted([x for x in res if x["level"] > harga + minim], key=lambda x: x["level"])
    for x in sup + res:
        # < 1 ATR = masih di dalam ayunan harian; stop di situ rawan tersapu noise.
        x["dalam_atr"] = abs(x["level"] - harga) < a
    for x in sup:
        x["harga"] = ke_fraksi(x["level"], "bawah")
    for x in res:
        x["harga"] = ke_fraksi(x["level"], "atas")
    return sup, res


# ------------------------------------------------------- first passage time
def first_passage(d: dict, naik_pct: float, turun_pct: float, horizon: int = 20) -> dict:
    """Dari SETIAP hari historis: dalam `horizon` hari bursa berikutnya, mana
    yang tersentuh lebih dulu — target (+naik_pct) atau stop (-turun_pct)?

    Inilah yang membuat 'ekspektasi waktu ke target' bukan tebakan. Kalau
    keduanya tersentuh di hari yang sama, dihitung sebagai STOP (konservatif —
    dari data harian kita tak tahu urutan intraday-nya).
    """
    c, h, l = d["c"], d["h"], d["l"]
    n = len(c)
    total = kena = stop = 0
    hari_kena: list[int] = []
    for t in range(n - horizon - 1):
        atas = c[t] * (1 + naik_pct / 100)
        bawah = c[t] * (1 - turun_pct / 100)
        total += 1
        for j in range(t + 1, t + 1 + horizon):
            kena_bawah = l[j] <= bawah
            kena_atas = h[j] >= atas
            if kena_bawah:
                stop += 1
                break
            if kena_atas:
                kena += 1
                hari_kena.append(j - t)
                break
    if total == 0:
        return {"n": 0}
    hari_kena.sort()
    q = lambda p: hari_kena[min(len(hari_kena) - 1, int(p * len(hari_kena)))] if hari_kena else None
    return {
        "n": total,
        # `n` conta hari MULAI, dan jendela `horizon` hari yang beruntun saling
        # beririsan (hari t & t+1 berbagi 19/20 harinya kalau horizon=20) — jadi
        # `n` bukan bukti bebas sebanyak itu. n_efektif ~= jumlah jendela yang
        # TAK beririsan yang muat di rentang yang sama, perkiraan kasar tapi
        # jujur (n / horizon). Dipakai di kartu ringkas supaya angka yang
        # ditonjolkan bukan yang paling melebih-lebihkan.
        "n_efektif": round(total / horizon),
        "kena": kena,
        "stop": stop,
        "lewat": total - kena - stop,
        "p_kena": kena / total * 100,
        "p_stop": stop / total * 100,
        "median_hari": statistics.median(hari_kena) if hari_kena else None,
        "q1": q(0.25),
        "q3": q(0.75),
        "harapan": (kena / total) * naik_pct - (stop / total) * turun_pct,
    }


# ----------------------------------------------------------- efficiency ratio
def er(c: list[float], n: int = 20) -> float | None:
    """Kaufman Efficiency Ratio: |perubahan bersih| / total jarak tempuh.
    Mendekati 0 = bolak-balik (sideways); mendekati 1 = tren bersih.
    Dipakai supaya label 'suka sideways' punya angka, bukan firasat."""
    if len(c) < n + 1:
        return None
    nilai = []
    for i in range(n, len(c)):
        jarak = sum(abs(c[j] - c[j - 1]) for j in range(i - n + 1, i + 1))
        if jarak:
            nilai.append(abs(c[i] - c[i - n]) / jarak)
    return statistics.median(nilai) if nilai else None


def er_populasi(min_n: int = 250) -> list[tuple[str, float]]:
    """ER median tiap emiten — dasar persentil. Sekali jalan ±1 menit."""
    out = []
    for p in sorted(OHLC.glob("*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if d.get("n", 0) < min_n:
            continue
        c = [float(r[4]) for r in d["d"]]
        e = er(c)
        if e is not None:
            out.append((d["kode"], e))
    return out


# ------------------------------------------------------------------ musiman
ALFA = 6  # sama dengan app/src/lib/seasonality.ts


def wilson(naik: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n <= 0:
        return 0.0, 100.0
    p = naik / n
    d = 1 + z * z / n
    tengah = p + z * z / (2 * n)
    sebar = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return max(0, (tengah - sebar) / d * 100), min(100, (tengah + sebar) / d * 100)


def musiman_bulan(d: dict, bulan: int) -> dict:
    """Imbal bulan kalender tertentu, dengan selang Wilson dan penyusutan ke
    peluang dasar emiten — meniru lib/seasonality.ts, bukan tabel '80% naik'."""
    tutup: dict[str, float] = {}
    for tgl, c in zip(d["tgl"], d["c"]):
        tutup[tgl[:7]] = c
    kunci = sorted(tutup)
    imbal = [(kunci[i], (tutup[kunci[i]] / tutup[kunci[i - 1]] - 1) * 100) for i in range(1, len(kunci))]
    semua = [x[1] for x in imbal]
    dasar = sum(1 for x in semua if x > 0) / len(semua) * 100 if semua else 50
    ini = [(k, v) for k, v in imbal if int(k[5:7]) == bulan]
    n = len(ini)
    naik = sum(1 for _, v in ini if v > 0)
    bawah, atas = wilson(naik, n)
    return {
        "n": n,
        "naik": naik,
        "mentah": naik / n * 100 if n else None,
        "tersusut": (naik + ALFA * dasar / 100) / (n + ALFA) * 100 if n else dasar,
        "bawah": bawah,
        "atas": atas,
        "median": statistics.median([v for _, v in ini]) if ini else None,
        "dasar": dasar,
        "total_bulan": len(semua),
    }


# ----------------------------------------------------- sektor & fundamental
def sektor(kode: str) -> dict:
    p = AKAR / "data-idx" / "json" / "emiten_sektor.json"
    e = json.loads(p.read_text(encoding="utf-8"))["emiten"].get(kode, {})
    return {k: e.get(k) for k in ("nama", "sektor", "subsektor", "subindustri", "papan", "tercatat")}


def fundamental(kode: str) -> dict:
    p = AKAR / "data-idx" / "json" / "fundamental" / f"{kode}.json"
    if not p.exists():
        return {}
    f = json.loads(p.read_text(encoding="utf-8"))
    return {k: f.get(k) for k in (
        "name", "updated", "pe", "pb", "eps", "roe", "der", "npm", "rev_yoy", "ni_yoy",
        "dividend_yield", "beta", "shares", "float_pct", "week52_high", "week52_low",
    )}


# --------------------------------------------------------------------- asing
def ringkas_asing_dari(baris: list[list], hari: int) -> dict:
    """Jumlah `hari` baris TERAKHIR dari deret [tgl,beli,jual,volume,value,frek]
    (data-idx/json/asing/<KODE>.json — 'volume' di situ adalah volume PASAR
    hari itu, sama dengan ruas V di ohlc/<KODE>.json, terverifikasi 18 Agu 2026).
    Porsi = jumlah beli (atau jual) periode dibagi jumlah volume pasar periode
    yang SAMA — dijumlah dulu baru dibagi, bukan rata-rata porsi harian,
    supaya hari sepi tak membobot sama besar dengan hari ramai."""
    slc = baris[-hari:]
    beli = sum(r[1] for r in slc)
    jual = sum(r[2] for r in slc)
    vol = sum(r[3] for r in slc)
    return {
        "n": len(slc),
        "beli": beli,
        "jual": jual,
        "net": beli - jual,
        "porsi_beli_pct": (beli / vol * 100) if vol else None,
        "porsi_jual_pct": (jual / vol * 100) if vol else None,
    }


def asing_ringkas(kode: str, hari_list: tuple[int, ...] = (5, 20)) -> dict | None:
    """None kalau emiten belum punya berkas asing — pembaca WAJIB menampilkan
    'belum tersedia', bukan 0 (lihat catatan modul)."""
    p = ASING / f"{kode}.json"
    if not p.exists():
        return None
    a = json.loads(p.read_text(encoding="utf-8"))
    baris = a.get("d") or []
    if not baris:
        return None
    return {
        "satuan": a.get("satuan", {}),
        "mulai": a.get("mulai"),
        "akhir": a.get("akhir"),
        "n_total": len(baris),
        "periode": {str(h): ringkas_asing_dari(baris, h) for h in hari_list},
    }


# ------------------------------------------------------------------ perakit
def kartu(kode: str, peringkat_er: dict[str, float] | None = None) -> dict:
    d = muat(kode)
    c, h, l, v, t = d["c"], d["h"], d["l"], d["v"], d["tgl"]
    a = atr(h, l, c)
    sup, res = sr(d)
    harga = c[-1]
    stop = sup[0]["harga"] if sup else ke_fraksi(harga * 0.95, "bawah")
    turun_pct = (harga - stop) / harga * 100
    target = []
    for r in res[:3]:
        naik_pct = (r["harga"] - harga) / harga * 100
        target.append({
            "harga": r["harga"],
            "pct": naik_pct,
            "sentuhan": r["sentuhan"],
            "terakhir": r["terakhir"],
            "fp": first_passage(d, naik_pct, turun_pct, 20),
            "fp60": first_passage(d, naik_pct, turun_pct, 60),
        })
    e = er(c)
    sr_now = stoch_rsi(c)
    nilai = sorted(c[i] * v[i] for i in range(len(c) - 20, len(c)))
    return {
        "kode": kode,
        "tgl": t[-1],
        "harga": harga,
        "prev": c[-2],
        "chg": (c[-1] / c[-2] - 1) * 100,
        "n": d["n"],
        "mulai": d["mulai"],
        "ma20": ma(c, 20), "ma50": ma(c, 50), "ma200": ma(c, 200),
        "atr": a,
        "atr_pct": a / harga * 100 if a else None,
        "rsi": rsi(c)[-1],
        "stochrsi": sr_now,
        "support": sup[:3],
        "resistance": res[:3],
        "stop": stop,
        "stop_pct": turun_pct,
        "target": target,
        "er": e,
        "er_persentil": (
            sum(1 for x in peringkat_er.values() if x < e) / len(peringkat_er) * 100
            if peringkat_er and e is not None else None
        ),
        "er_n_populasi": len(peringkat_er) if peringkat_er else None,
        "likuiditas_median20": statistics.median(nilai),
        "musiman": musiman_bulan(d, int(t[-1][5:7])),
        "sektor": sektor(kode),
        "fundamental": fundamental(kode),
        "asing": asing_ringkas(kode),
        "dihitung": t[-1],
    }


def cetak(k: dict) -> None:
    p = print
    p(f"\n{'='*72}\n{k['kode']}  {k['tgl']}  close {k['harga']:,.0f}  ({k['chg']:+.2f}%)")
    p(f"  riwayat {k['mulai']} .. n={k['n']} lilin harian")
    p(f"  MA20 {k['ma20']:,.1f} | MA50 {k['ma50']:,.1f} | MA200 {k['ma200'] and k['ma200']:,.1f}")
    p(f"  ATR14 {k['atr']:,.1f} ({k['atr_pct']:.2f}%)  RSI14 {k['rsi']:.1f}  StochRSI K {k['stochrsi'][0]:.0f} D {k['stochrsi'][1]:.0f}")
    p(f"  ER20 median {k['er']:.3f} — persentil {k['er_persentil']:.0f} dari {k['er_n_populasi']} emiten")
    p(f"  likuiditas median 20h  Rp {k['likuiditas_median20']/1e9:,.1f} miliar/hari")
    p("  SUPPORT  " + " · ".join(f"{s['harga']:,.0f} (n={s['sentuhan']}, {s['terakhir']})" for s in k["support"]))
    p("  RESIST   " + " · ".join(f"{r['harga']:,.0f} (n={r['sentuhan']}, {r['terakhir']})" for r in k["resistance"]))
    rawan = k["support"] and k["support"][0]["dalam_atr"]
    p(f"  PEMBATAL close < {k['stop']:,.0f}  (-{k['stop_pct']:.2f}%)"
      + ("  [< 1 ATR — rawan tersapu ayunan harian]" if rawan else ""))
    s = k["sektor"]
    p(f"  SEKTOR {s['sektor']} / {s['subindustri']} — papan {s['papan']}, tercatat {s['tercatat']}")
    f = k["fundamental"]
    p(f"  FUNDAMENTAL PER {f.get('pe')} PBV {f.get('pb')} ROE {f.get('roe')} DER {f.get('der')} "
      f"rev_yoy {f.get('rev_yoy')} ni_yoy {f.get('ni_yoy')} (diperbarui {f.get('updated')})")
    for i, tg in enumerate(k["target"], 1):
        f = tg["fp"]; f6 = tg["fp60"]
        p(f"  TP{i} {tg['harga']:,.0f} (+{tg['pct']:.2f}%)  n={f['n']}  "
          f"target-dulu {f['p_kena']:.1f}% · stop-dulu {f['p_stop']:.1f}% · tak keduanya {100-f['p_kena']-f['p_stop']:.1f}%")
        p(f"       median {f['median_hari']} hari bursa (Q1 {f['q1']} · Q3 {f['q3']}), "
          f"harapan {f['harapan']:+.2f}% | horizon 60h: target-dulu {f6['p_kena']:.1f}%, median {f6['median_hari']}")
    m = k["musiman"]
    p(f"  MUSIMAN bulan ini: {m['naik']}/{m['n']} naik = {m['mentah']:.0f}% mentah, "
      f"tersusut {m['tersusut']:.0f}%, Wilson 95% {m['bawah']:.0f}-{m['atas']:.0f}%, "
      f"median {m['median']:+.2f}% (dasar emiten {m['dasar']:.0f}% dari {m['total_bulan']} bulan)")
    asg = k.get("asing")
    if not asg:
        p("  ASING belum tersedia untuk emiten ini")
    else:
        for h in ("5", "20"):
            pr = asg["periode"].get(h)
            if not pr:
                continue
            p(f"  ASING {h}h  beli {pr['beli']:,.0f} lbr ({pr['porsi_beli_pct']:.1f}% vol pasar) · "
              f"jual {pr['jual']:,.0f} lbr ({pr['porsi_jual_pct']:.1f}%) · net {pr['net']:+,.0f} lbr (n={pr['n']})")


def uji() -> None:
    assert ke_fraksi(1237, "atas") == 1240 and ke_fraksi(1237, "bawah") == 1235
    assert ke_fraksi(2000, "dekat") == 2000 and fraksi(2001) == 10
    # pivot fraktal: puncak tunggal di tengah
    assert pivot_idx([1, 2, 3, 9, 3, 2, 1], 3, False) == [3]
    assert pivot_idx([9, 8, 7, 1, 7, 8, 9], 3, True) == [3]
    # klaster: dua nilai berdekatan jadi satu level bersentuhan 2
    kl = klaster_level([(100, "a"), (101, "b"), (140, "c")], 5)
    assert len(kl) == 2 and kl[0]["sentuhan"] == 2 and kl[0]["terakhir"] == "b"
    # first passage pada deret naik lurus: target pasti kena, stop tak pernah
    lurus = {"c": [100 + i for i in range(60)], "h": [100 + i for i in range(60)],
             "l": [100 + i for i in range(60)], "tgl": [""] * 60}
    f = first_passage(lurus, 3.0, 50.0, 20)
    assert f["p_stop"] == 0 and f["p_kena"] > 99, f
    assert f["n_efektif"] == round(f["n"] / 20), f  # n dibagi horizon, bukan disalin dari n
    # ER deret naik lurus = 1; deret bolak-balik ≈ 0
    assert er([100 + i for i in range(40)]) > 0.99
    assert er([100 + (i % 2) for i in range(40)]) < 0.05
    # Wilson 5/5 tak boleh 100-100
    b, a = wilson(5, 5)
    assert b < 60 and a > 99
    # asing: 3 hari, porsi dijumlah dulu baru dibagi (bukan rata-rata harian)
    b3 = [["d1", 10, 5, 100, 0, 0], ["d2", 20, 20, 200, 0, 0], ["d3", 5, 25, 50, 0, 0]]
    r = ringkas_asing_dari(b3, 3)
    assert r["n"] == 3 and r["beli"] == 35 and r["jual"] == 50 and r["net"] == -15
    assert abs(r["porsi_beli_pct"] - 35 / 350 * 100) < 1e-9
    assert abs(r["porsi_jual_pct"] - 50 / 350 * 100) < 1e-9
    # volume nol -> porsi None, bukan ZeroDivisionError
    r0 = ringkas_asing_dari([["d1", 1, 1, 0, 0, 0]], 1)
    assert r0["porsi_beli_pct"] is None and r0["porsi_jual_pct"] is None
    print("kartu_analisa: swauji lolos")


def kode_populasi(min_n: int = 250) -> list[str]:
    """Kode emiten dengan riwayat >= min_n lilin — sumber daftar untuk --semua."""
    out = []
    for p in sorted(OHLC.glob("*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if d.get("n", 0) >= min_n:
            out.append(d["kode"])
    return out


def tulis_berkas_kartu(hasil: dict[str, dict]) -> None:
    """Tulis data-idx/json/kartu/<KODE>.json (satu per emiten) + index.json
    (daftar kode + tanggal hitung, supaya halaman tahu apa yang tersedia tanpa
    menebak nama berkas). Dipanggil dari --tulis, bukan otomatis tiap run —
    menjalankan skrip riset ini tanpa flag itu TIDAK mengubah berkas apa pun."""
    KARTU_DIR.mkdir(parents=True, exist_ok=True)
    daftar = []
    for kd, h in sorted(hasil.items()):
        (KARTU_DIR / f"{kd}.json").write_text(json.dumps(h, indent=1, default=str), encoding="utf-8")
        daftar.append({"kode": kd, "dihitung": h["dihitung"]})
    idx = {
        "diperbarui": __import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M"),
        "emiten": daftar,
    }
    (KARTU_DIR / "index.json").write_text(json.dumps(idx, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\ntersimpan: {len(daftar)} berkas kartu + index.json -> {KARTU_DIR}")


if __name__ == "__main__":
    arg = sys.argv[1:]
    if "--uji" in arg:
        uji()
        raise SystemExit(0)
    tulis = "--tulis" in arg
    semua = "--semua" in arg
    maks = None
    if "--maks" in arg:
        i_maks = arg.index("--maks")
        maks = int(arg[i_maks + 1])
    else:
        i_maks = None
    positional = [a for i, a in enumerate(arg) if not a.startswith("--") and i - 1 != i_maks]

    if semua:
        kode = kode_populasi()
        if maks:
            kode = kode[:maks]
        print(f"mode --semua: {len(kode)} emiten (riwayat >=250 lilin){f', dibatasi --maks {maks}' if maks else ''}")
    else:
        kode = positional or ["ARCI", "WIFI", "BUMI"]

    print("menghitung Efficiency Ratio seluruh emiten (dasar persentil)...", flush=True)
    pop = dict(er_populasi())
    nilai_pop = sorted(pop.values())
    kuartil = lambda p: nilai_pop[int(p * len(nilai_pop))]
    print(f"  {len(pop)} emiten ber-riwayat >=250 lilin — ER20 median pasar {statistics.median(nilai_pop):.3f}, "
          f"P25 {kuartil(0.25):.3f}, P75 {kuartil(0.75):.3f}")

    hasil: dict[str, dict] = {}
    gagal: list[str] = []
    ringkas_saja = len(kode) > 10  # cetak() penuh cuma buat daftar pendek — ratusan emiten bikin log tak terbaca
    for i, kd in enumerate(kode, 1):
        try:
            h = kartu(kd, pop)
        except Exception as e:  # emiten dengan riwayat aneh/pendek tak boleh menghentikan seluruh batch
            gagal.append(kd)
            print(f"  [{i}/{len(kode)}] {kd}: GAGAL — {e}")
            continue
        hasil[kd] = h
        if ringkas_saja:
            if i % 50 == 0 or i == len(kode):
                print(f"  [{i}/{len(kode)}] ...")
        else:
            cetak(h)
    if gagal:
        print(f"\n{len(gagal)} emiten gagal dihitung: {', '.join(gagal)}")

    if tulis:
        tulis_berkas_kartu(hasil)

    tujuan = os.environ.get("KARTU_OUT")
    if tujuan:
        Path(tujuan).write_text(json.dumps(hasil, indent=1, default=str), encoding="utf-8")
        print(f"\ntersimpan: {tujuan}")
