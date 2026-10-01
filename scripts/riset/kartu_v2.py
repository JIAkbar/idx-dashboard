"""Data Kartu Emiten v2: Tren, Level, Satu Sinyal (#269, docs/papan-v2-prioritas.md).

Johan 2 Okt 2026: *"kerjakan semua sesuai rekomendasimu dan push live"* (acuan
3 + 5 + 7: tangga level ringkas, skor kekuatan level, satu ringkasan + daftar
centang). Konsep dari Technical Analysis for Mega Profit:
  bab 4-5   tren dari urutan puncak/lembah di tiga horizon (harian 1 th,
            mingguan 3 th, bulanan 5 th)
  bab 7-8   support/resistance; kekuatan naik dengan jumlah sentuhan; angka bulat
  bab 9     tembus sah = CLOSE di luar level + toleransi 1,5% (horizon pendek),
            dikonfirmasi hari berikutnya
  bab 25,27 formasi MA dan ADX untuk menentukan pasar tren atau sideways
Peluang dari scripts/riset/peluang_naik.py (wajib jalan lebih dulu).

Pakai:  python scripts/riset/kartu_v2.py
Keluar: data-idx/json/kartu_v2/<KODE>.json + kartu_v2/_indeks.json
Uji:    python scripts/riset/kartu_v2.py --uji
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from peluang_naik import adx, ema, sma  # noqa: E402

AKAR = Path(__file__).resolve().parents[2]
JSON = AKAR / "data-idx" / "json"
KELUAR = JSON / "kartu_v2"
TOLERANSI = 0.015


def baca(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def agregasi(d, kunci):
    """Bar harian [t,o,h,l,c,v] -> bar per kunci(t) (minggu/bulan)."""
    out, cur, k0 = [], None, None
    for b in d:
        k = kunci(b[0])
        if k != k0:
            if cur:
                out.append(cur)
            cur, k0 = [b[0], b[1], b[2], b[3], b[4], b[5]], k
        else:
            cur[2], cur[3], cur[4], cur[5] = max(cur[2], b[2]), min(cur[3], b[3]), b[4], cur[5] + b[5]
    if cur:
        out.append(cur)
    return out


def minggu(t):
    y, w, _ = np.datetime64(t, "D").astype(object).isocalendar()
    return (y, w)


def swing(h, l, c, ambang):
    """Zigzag: titik balik bila harga berbalik >= ambang (desimal) dari ekstrem terakhir.
    -> list (indeks, harga, 'P'|'L')."""
    titik, arah, ext_i = [], 0, 0
    for i in range(1, len(c)):
        if arah == 0:
            if h[i] >= c[0] * (1 + ambang):
                arah, ext_i = 1, i
            elif l[i] <= c[0] * (1 - ambang):
                arah, ext_i = -1, i
            continue
        if arah == 1:
            if h[i] >= h[ext_i]:
                ext_i = i
            elif l[i] <= h[ext_i] * (1 - ambang):
                titik.append((ext_i, float(h[ext_i]), "P"))
                arah, ext_i = -1, i
        else:
            if l[i] <= l[ext_i]:
                ext_i = i
            elif h[i] >= l[ext_i] * (1 + ambang):
                titik.append((ext_i, float(l[ext_i]), "L"))
                arah, ext_i = 1, i
    return titik


def arah_tren(titik):
    """Dua puncak dan dua lembah terakhir: HH+HL naik, LH+LL turun, lainnya sideways."""
    P = [t for t in titik if t[2] == "P"][-2:]
    L = [t for t in titik if t[2] == "L"][-2:]
    if len(P) < 2 or len(L) < 2:
        return "belum jelas", None
    hh, hl = P[1][1] > P[0][1], L[1][1] > L[0][1]
    akhir = max(P[1][0], L[1][0])
    if hh and hl:
        return "naik", akhir
    if not hh and not hl:
        return "turun", akhir
    return "sideways", akhir


def tren_lapis(d, n_bar, ambang):
    d = d[-n_bar:]
    if len(d) < 20:
        return {"arah": "belum jelas", "sejak": None}
    h, l, c = (np.array([b[i] for b in d], float) for i in (2, 3, 4))
    a, i = arah_tren(swing(h, l, c, ambang))
    return {"arah": a, "sejak": d[i][0] if i is not None else None}


def skor_level(lv):
    """1-5 titik: sentuhan (maks 3) + 1 bila disentuh <= 60 hari terakhir + 1 bila dalam 1 ATR."""
    return int(min(5, min(lv.get("sentuhan", 1), 3) + (1 if lv.get("baru") else 0) + (1 if lv.get("dalam_atr") else 0)))


def angka_bulat(harga):
    step = 10 if harga < 200 else 50 if harga < 1000 else 100 if harga < 5000 else 500
    bawah = harga // step * step
    return [float(bawah), float(bawah + step)]


def satu_sinyal(c, ma50, ma200, r1, s1):
    """Keluarga sinyal (Mega Profit bab 9, 25): tembus level + toleransi dengan close,
    dikonfirmasi bila close kemarin juga sudah di luar; persilangan MA50/MA200 5 hari terakhir."""
    beli, jual = [], []
    if r1 and c[-1] > r1 * (1 + TOLERANSI):
        beli.append(("tembus resistance " + _fmt(r1), "terkonfirmasi" if c[-2] > r1 * (1 + TOLERANSI) else "menunggu konfirmasi besok"))
    if s1 and c[-1] < s1 * (1 - TOLERANSI):
        jual.append(("jebol support " + _fmt(s1), "terkonfirmasi" if c[-2] < s1 * (1 - TOLERANSI) else "menunggu konfirmasi besok"))
    for j in range(1, 6):
        if np.isnan(ma200[-j - 1]):
            break
        if ma50[-j] > ma200[-j] and ma50[-j - 1] <= ma200[-j - 1]:
            beli.append(("golden cross MA50/MA200", f"{j - 1} hari lalu" if j > 1 else "hari ini"))
        if ma50[-j] < ma200[-j] and ma50[-j - 1] >= ma200[-j - 1]:
            jual.append(("death cross MA50/MA200", f"{j - 1} hari lalu" if j > 1 else "hari ini"))
    if beli and jual:
        return {"status": "bertabrakan", "judul": "Sinyal bertabrakan, tunggu", "beli": beli, "jual": jual}
    if beli:
        return {"status": "beli", "judul": beli[0][0].capitalize(), "ket": beli[0][1], "beli": beli, "jual": []}
    if jual:
        return {"status": "jual", "judul": jual[0][0].capitalize(), "ket": jual[0][1], "beli": [], "jual": jual}
    return {"status": "tidak ada", "judul": "Tidak ada sinyal jelas", "beli": [], "jual": []}


def _fmt(x):
    return f"{x:,.0f}".replace(",", ".")


def kartu(kode, d, kv1, peluang, nama, rezim):
    h, l, c, v = (np.array([b[i] for b in d], float) for i in (2, 3, 4, 5))
    ma10, ma50, ma200 = sma(c, 10), sma(c, 50), sma(c, 200)
    ema30, ma60 = ema(c, 30), sma(c, 60)
    a, pdi, ndi, atr = adx(h, l, c)
    atr_pct = float(atr[-1] / c[-1])
    amb = max(0.05, 2.5 * atr_pct)
    mg, bl = agregasi(d, minggu), agregasi(d, lambda t: t[:7])
    tren = {
        "harian": tren_lapis(d, 252, amb),
        "mingguan": tren_lapis(mg, 156, amb * 2),
        "bulanan": tren_lapis(bl, 60, amb * 3.5),
    }
    t_akhir = np.datetime64(d[-1][0])
    def lv(x):
        out = dict(level=x["harga"], sentuhan=x["sentuhan"], terakhir=x["terakhir"], dalam_atr=x["dalam_atr"],
                   baru=bool((t_akhir - np.datetime64(x["terakhir"])).astype(int) <= 60) if x.get("terakhir") else False)
        out["skor"] = skor_level(out)
        return out
    res = sorted((lv(x) for x in kv1.get("resistance") or []), key=lambda x: x["level"])[:3]
    sup = sorted((lv(x) for x in kv1.get("support") or []), key=lambda x: -x["level"])[:3]
    r1 = res[0]["level"] if res else None
    s1 = sup[0]["level"] if sup else None
    sig = satu_sinyal(c, ma50, ma200, r1, s1)
    adx_k = float(a[-1])
    mode = "tren kuat" if adx_k >= 25 else "tren lemah" if adx_k >= 20 else "sideways"
    pl = peluang.get(kode)
    jebakan = pl[3] if pl else []
    cek = [
        {"teks": "Tren harian naik", "lulus": tren["harian"]["arah"] == "naik"},
        {"teks": "Tren mingguan naik", "lulus": tren["mingguan"]["arah"] == "naik"},
        {"teks": "Harga di atas rata-rata 200 hari", "lulus": bool(c[-1] > ma200[-1])},
        {"teks": "Pasar sedang tren dan arahnya naik (ADX)", "lulus": bool(adx_k >= 20 and pdi[-1] > ndi[-1])},
        {"teks": "Tidak ada sinyal penjebak di rezim pasar sekarang", "lulus": not jebakan},
        {"teks": "Ada sinyal beli yang terkonfirmasi", "lulus": sig["status"] == "beli" and sig.get("ket") == "terkonfirmasi"},
    ]
    jarak = lambda m: round(float((c[-1] / m - 1) * 100), 1) if not np.isnan(m) else None
    return {
        "kode": kode, "nama": nama, "tgl": d[-1][0], "harga": float(c[-1]),
        "chg": round(float((c[-1] / c[-2] - 1) * 100), 2), "kualitas": kv1.get("kualitas"),
        "tren": tren,
        "level": {"resistance": res, "support": sup, "angka_bulat": angka_bulat(float(c[-1])), "atr": round(float(atr[-1]), 2)},
        "mode": {"adx": round(adx_k, 1), "di_plus": round(float(pdi[-1]), 1), "di_min": round(float(ndi[-1]), 1), "label": mode,
                 "ma": {"MA10": jarak(ma10[-1]), "EMA30": jarak(ema30[-1]), "MA60": jarak(ma60[-1]), "MA200": jarak(ma200[-1])}},
        "sinyal": sig, "cek": cek, "skor": sum(x["lulus"] for x in cek),
        "peluang": {"rezim": rezim, "p": pl[1] if pl else None, "sinyal": pl[2] if pl else [], "jebakan": jebakan}
                   if pl else None,
    }


def main():
    KELUAR.mkdir(exist_ok=True)
    pn = baca(JSON / "peluang_naik.json")
    peluang, rezim = pn["peringkat_semua"], pn["rezim"]
    nama = {e["kode"]: e["nama"] for e in baca(JSON / "daftar_emiten.json")["emiten"]}
    indeks, n = [], 0
    for p in sorted((JSON / "ohlc").glob("*.json")):
        kode = p.stem
        if kode == "IHSG" or kode.startswith("_"):
            continue
        kv1p = JSON / "kartu" / f"{kode}.json"
        d = [[b[0], b[1] or b[4], b[2] or b[4], b[3] or b[4], b[4], b[5] or 0] for b in baca(p).get("d") or [] if b and b[4]]
        if len(d) < 260 or not kv1p.exists():
            continue
        k = kartu(kode, d, baca(kv1p), peluang, nama.get(kode, ""), rezim)
        (KELUAR / f"{kode}.json").write_text(json.dumps(k, ensure_ascii=False, separators=(",", ":"), default=float), encoding="utf-8")
        indeks.append([kode, k["nama"], k["skor"]])
        n += 1
    (KELUAR / "_indeks.json").write_text(json.dumps({"tgl": pn["tanggal"], "rezim": rezim, "emiten": indeks,
                                                    "nama_sinyal": {b["kunci"]: b["nama"] for b in pn["sinyal"]}},
                                                    ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"kartu_v2: {n} emiten")


def uji():
    c = np.array([100, 106, 112, 104, 98, 108, 118, 110, 103, 115, 125, 118], float)
    t = swing(c * 1.0, c * 1.0, c, 0.05)
    assert [x[2] for x in t] == ["P", "L", "P", "L", "P"], t
    assert arah_tren(t)[0] == "naik"
    ma = np.full(10, np.nan)
    s = satu_sinyal(np.array([100, 103.0]), ma, ma, 101, None)
    assert s["status"] == "beli" and s["ket"] == "menunggu konfirmasi besok"
    s = satu_sinyal(np.array([100, 100.0]), ma, ma, 101, None)
    assert s["status"] == "tidak ada"
    assert agregasi([["2026-01-05", 1, 2, 0.5, 1.5, 10], ["2026-01-06", 1.5, 3, 1, 2, 5], ["2026-01-12", 2, 2, 2, 2, 1]], minggu) == \
        [["2026-01-05", 1, 3, 0.5, 2, 15], ["2026-01-12", 2, 2, 2, 2, 1]]
    print("uji kartu_v2: LOLOS")


if __name__ == "__main__":
    uji() if "--uji" in sys.argv else main()
