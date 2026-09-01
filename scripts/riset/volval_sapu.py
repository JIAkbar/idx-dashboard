# -*- coding: utf-8 -*-
"""Volval disapu dua sumbu: ambang volume x LANTAI LIKUIDITAS.

Asal: Johan 1 Sep 2026, melihat sepuluh pilihan volval yang isinya HATM, WGSH,
SMLE, AYAM — *"jadi perlu ada filterisasi, dari saham-saham ini tidak likuid
karena transaksi di bawah berapa milyar atau diatas berapa milyar untuk
membedakan, dan perlu di backtest lagi dengan data mundur"*.

Dugaan yang diuji: keunggulan volval lenyap di 59 tanggal BUKAN karena
metodenya salah, melainkan karena ia memilih saham tipis. Di saham tipis bar 5
menitnya bolong, satu transaksi kecil menggeser harga rata-rata, dan "volume
tinggi" berarti dua lot bukan dua juta. Kalau dugaan ini benar, keunggulannya
akan muncul begitu lantai likuiditas dinaikkan — dan hilang lagi kalau
lantainya terlalu tinggi (saham raksasa tak digerakkan satu pembeli).

## Kenapa disinggahi

Membaca ulang seluruh arsip gz tiap kali menyapu memakan belasan menit dan
membuat sapuan mahal — lalu godaan berikutnya adalah menyapu sedikit saja dan
menyebutnya cukup. Fitur dihitung SEKALI ke `_arsip-mentah/volval_fitur.json`,
sesudah itu tiap sapuan cuma membaca berkas itu.

Singgahan menyimpan skor untuk SETIAP ambang sekaligus, bukan cuma yang
sedang dipakai — kalau tidak, mengganti ambang berarti menghitung ulang semua.

## Batas yang tak bisa ditembus, dan sebabnya bukan kemalasan

Johan benar bahwa kita punya riwayat panjang — tapi tidak untuk INI. Server
hanya menyimpan bar menit +/-90 hari; yang lebih tua sudah hilang sebelum
proyek ini menyentuhnya. Jadi 59 tanggal sinyal adalah SELURUH yang pernah
ada untuk volval, dan bertambah satu tiap hari bursa. Riwayat bertahun-tahun
yang kita punya itu HARIAN — ia tak bisa menjawab pertanyaan yang hidup di
dalam hari.

    python scripts/riset/volval_sapu.py --bangun   # pass mahal, sekali
    python scripts/riset/volval_sapu.py            # sapu dari singgahan
"""
from __future__ import annotations

import argparse
import gzip
import json
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
INTRA = AKAR / "_arsip-mentah" / "intraday"
OHLC = AKAR / "data-idx" / "json" / "ohlc"
SINGGAH = AKAR / "_arsip-mentah" / "volval_fitur.json"
KELUARAN = AKAR / "data-idx" / "json" / "volval_sapu.json"

JENDELA = 5
JAM_MULAI = "09:30"
MIN_BAR = 100
AMBANG = [1.5, 2.0, 3.0, 5.0]
# Lantai nilai transaksi harian (rupiah, median 20 hari). Rentangnya sengaja
# lebar: 0 sebagai kendali (tanpa saringan), lalu naik sampai papan atas.
LANTAI = [0, 1e8, 5e8, 1e9, 5e9, 1e10, 5e10]
TOP = 20


def bar5(kode: str) -> dict[str, list[dict]]:
    d = INTRA / kode
    if not d.is_dir():
        return {}
    ember: dict[str, dict[int, dict]] = defaultdict(dict)
    for p in sorted(d.glob("*.json.gz")):
        try:
            isi = json.loads(gzip.decompress(p.read_bytes()).decode("utf-8"))
        except Exception:
            continue
        for b in isi:
            dt = b.get("datetime") or ""
            jam = dt[11:16]
            if len(jam) < 5 or jam < JAM_MULAI:
                continue
            try:
                v, n = float(b["volume"]), float(b["value"])
            except (KeyError, TypeError, ValueError):
                continue
            if v <= 0 or n <= 0:
                continue
            k = int(jam[:2]) * 12 + int(jam[3:5]) // 5
            e = ember[dt[:10]].setdefault(k, {"v": 0.0, "n": 0.0})
            e["v"] += v
            e["n"] += n
    return {t: [x[k] for k in sorted(x)] for t, x in ember.items()}


def bangun() -> dict:
    """Pass mahal: skor tiap emiten x tanggal x ambang + nilai transaksi."""
    kode_semua = sorted(p.name for p in INTRA.iterdir() if p.is_dir())
    out: dict[str, dict] = {}
    for j, kode in enumerate(kode_semua, 1):
        per = bar5(kode)
        if not per:
            continue
        punya = sorted(per)
        # nilai transaksi harian = jumlah value seluruh bar hari itu
        nilai = {t: sum(x["n"] for x in per[t]) for t in punya}
        rec = {}
        for i in range(JENDELA - 1, len(punya)):
            jd = punya[i - JENDELA + 1: i + 1]
            skor = {}
            for amb in AMBANG:
                dor = gel = total = 0
                for t in jd:
                    bar = per[t]
                    if len(bar) < 12:
                        continue
                    acuan = st.median([x["v"] for x in bar])
                    if acuan <= 0:
                        continue
                    for k in range(1, len(bar)):
                        total += 1
                        if bar[k]["v"] < amb * acuan:
                            continue
                        if bar[k]["n"] > bar[k - 1]["n"]:
                            gel += 1
                        if bar[k]["n"] / bar[k]["v"] > bar[k - 1]["n"] / bar[k - 1]["v"]:
                            dor += 1
                if total >= MIN_BAR:
                    skor[str(amb)] = [round(100 * dor / total, 3), round(100 * gel / total, 3)]
            if skor:
                # likuiditas = median nilai transaksi selama jendela, jadi ia
                # ikut "buta": tak menyentuh hari yang akan dinilai.
                rec[jd[-1]] = {"s": skor, "lik": st.median([nilai[t] for t in jd])}
        if rec:
            out[kode] = rec
        if j % 200 == 0:
            print(f"    {j}/{len(kode_semua)}")
    return out


def kalender_dan_harga():
    harga, hit, n = {}, {}, 0
    for p in OHLC.glob("*.json"):
        n += 1
        try:
            d = json.loads(p.read_text(encoding="utf-8"))["d"][-120:]
        except Exception:
            continue
        harga[p.stem] = {x[0]: (x[4], x[5] if len(x) > 5 else 0) for x in d}
        for x in d:
            hit[x[0]] = hit.get(x[0], 0) + 1
    return sorted(t for t, c in hit.items() if c >= max(2, n // 2)), harga


def sapu(fitur: dict) -> dict:
    kal, harga = kalender_dan_harga()
    idx = {t: i for i, t in enumerate(kal)}

    # baseline pasar per (tanggal, horizon) — dihitung sekali
    dasar: dict[tuple, float] = {}
    for t, i in idx.items():
        for n in (1, 5):
            if i + n >= len(kal):
                continue
            a, b = kal[i], kal[i + n]
            r = []
            for kode, pm in harga.items():
                if kode == "IHSG":
                    continue
                pa, pb = pm.get(a), pm.get(b)
                if pa and pb and pa[0] and pb[1]:
                    r.append(100 * (pb[0] - pa[0]) / pa[0])
            if r:
                dasar[(t, n)] = st.median(r)

    def ret(kode, t, n):
        pm = harga.get(kode) or {}
        i = idx.get(t)
        if i is None or i + n >= len(kal):
            return None
        a, b = pm.get(kal[i]), pm.get(kal[i + n])
        return 100 * (b[0] - a[0]) / a[0] if a and b and a[0] else None

    per_tgl: dict[str, list] = defaultdict(list)
    for kode, rec in fitur.items():
        for t, v in rec.items():
            per_tgl[t].append((kode, v))

    hasil = []
    for amb in AMBANG:
        ak = str(amb)
        for lantai in LANTAI:
            for gaya, kol in (("dorongan", 0), ("gelombang", 1)):
                for n in (1, 5):
                    sel, menang, tot = [], 0, 0
                    for t in sorted(per_tgl):
                        if (t, n) not in dasar:
                            continue
                        kand = [(k, v) for k, v in per_tgl[t]
                                if ak in v["s"] and v["lik"] >= lantai]
                        if len(kand) < TOP:
                            continue
                        kand.sort(key=lambda x: -x[1]["s"][ak][kol])
                        r = [ret(k, t, n) for k, _ in kand[:TOP]]
                        r = [x for x in r if x is not None]
                        if len(r) < TOP // 2:
                            continue
                        d = dasar[(t, n)]
                        sel.append(st.median(r) - d)
                        menang += sum(1 for x in r if x > d)
                        tot += len(r)
                    if len(sel) >= 20:
                        hasil.append({
                            "gaya": gaya, "ambang": amb, "lantai": lantai, "H": n,
                            "hari": len(sel),
                            "medianSelisih": round(st.median(sel), 3),
                            "hariUnggul": sum(1 for v in sel if v > 0),
                            "hariUnggulPct": round(100 * sum(1 for v in sel if v > 0) / len(sel), 1),
                            "sahamUnggulPct": round(100 * menang / tot, 1),
                        })
    return {"hasil": hasil, "top": TOP, "jendela": JENDELA}


def cetak(h: dict) -> None:
    from math import comb

    def p_koin(k, n):
        atas = sum(comb(n, i) * 0.5 ** n for i in range(k, n + 1))
        bawah = sum(comb(n, i) * 0.5 ** n for i in range(0, k + 1))
        return min(atas, bawah)

    for n in (1, 5):
        print(f"\n  === HORIZON H+{n} ===")
        print(f"  {'gaya':10s} {'ambang':>7s} {'lantai nilai':>14s} {'hari':>5s} "
              f"{'selisih':>8s} {'unggul':>7s} {'p':>7s}")
        baris = [x for x in h["hasil"] if x["H"] == n]
        baris.sort(key=lambda x: -x["medianSelisih"])
        for x in baris[:18]:
            lb = "tanpa" if x["lantai"] == 0 else f"{x['lantai']/1e9:g} M"
            p = p_koin(x["hariUnggul"], x["hari"])
            tanda = " <<<" if p < 0.05 and x["medianSelisih"] > 0 else ""
            print(f"  {x['gaya']:10s} {x['ambang']:6.1f}x {lb:>14s} {x['hari']:5d} "
                  f"{x['medianSelisih']:+7.3f} {x['hariUnggulPct']:6.1f}% {p:7.3f}{tanda}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--bangun", action="store_true")
    a = ap.parse_args()
    if a.bangun or not SINGGAH.exists():
        print("  membangun singgahan fitur (pass mahal, sekali)...")
        f = bangun()
        SINGGAH.write_text(json.dumps(f, separators=(",", ":")), encoding="utf-8")
        print(f"  singgahan: {len(f)} emiten -> {SINGGAH.name}")
    else:
        f = json.loads(SINGGAH.read_text(encoding="utf-8"))
        print(f"  singgahan dibaca: {len(f)} emiten")
    h = sapu(f)
    cetak(h)
    KELUARAN.write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n  {len(h['hasil'])} kombinasi · ditulis {KELUARAN.relative_to(AKAR)}")
