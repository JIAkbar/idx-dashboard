"""Bahan angka Deep Dive (Analisa PAPAN v1) dari data milik sendiri.

#266 B (Johan 1 Okt 2026: "kerjakan #266 A+B"). Tiga lapis v1 dihitung dari
berkas yang sudah dipanen, nol jaringan:
  1. arus broker 10 hari  - arsip broker harian Stockbit, varian REGULER (NET)
  2. PCD                  - arus-pasar/pcd.py atas OHLCV harian
  3. tangga pivot + EMA50 - plus probabilitas v2 (arus-pasar/prob.py)
Narasi TIDAK dibuat di sini; skrip ini hanya mencetak angka yang dibaca analis.

Pakai:  python scripts/riset/draf_deepdive.py AALI AMRT AYAM [--hari 10]
Keluar: arus-pasar/draft/angka-<KODE>-<tanggal>.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(AKAR / "arus-pasar"))
import pcd as PCD  # noqa: E402
import prob  # noqa: E402

JSON = AKAR / "data-idx" / "json"
ARSIP = AKAR / "_arsip-mentah" / "broker-harian"


def baca(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def ema(c, n):
    k, e = 2 / (n + 1), c[0]
    for x in c[1:]:
        e = x * k + e * (1 - k)
    return e


def broker(kode, hari):
    agg, per_hari, hilang = {}, [], []
    for t in hari:
        p = ARSIP / kode / f"{t}.json"
        if not p.exists():
            hilang.append(t)
            continue
        d = baca(p)["data"]
        bs = d["broker_summary"]
        for r in bs.get("brokers_buy") or []:
            a = agg.setdefault(r["netbs_broker_code"], {"bv": 0.0, "bl": 0.0, "sv": 0.0, "sl": 0.0, "hb": 0, "hs": 0, "tipe": r.get("type")})
            a["bv"] += float(r["bval"]); a["bl"] += float(r["blot"]); a["hb"] += 1
        for r in bs.get("brokers_sell") or []:
            a = agg.setdefault(r["netbs_broker_code"], {"bv": 0.0, "bl": 0.0, "sv": 0.0, "sl": 0.0, "hb": 0, "hs": 0, "tipe": r.get("type")})
            a["sv"] += float(r["sval"]); a["sl"] += float(r["slot"]); a["hs"] += 1
        bd = d.get("bandar_detector") or {}
        per_hari.append({"t": t, "label": (bd.get("avg") or {}).get("accdist"),
                         "top5_pct": (bd.get("top5") or {}).get("percent"),
                         "nilai": bd.get("value"), "rata2": bd.get("average")})
    rows = []
    for k, a in agg.items():
        rows.append({"kode": k, "tipe": a["tipe"], "net_rp": a["bv"] - a["sv"],
                     "avg_beli": a["bv"] / (a["bl"] * 100) if a["bl"] else None,
                     "avg_jual": a["sv"] / (a["sl"] * 100) if a["sl"] else None,
                     "hari_beli": a["hb"], "hari_jual": a["hs"]})
    rows.sort(key=lambda r: -r["net_rp"])
    return {"akumulator": rows[:5], "distributor": rows[::-1][:5], "per_hari": per_hari, "hari_hilang": hilang}


def main(kode_list, n_hari):
    ihsg = baca(JSON / "ohlc" / "IHSG.json")["d"]
    hari = [b[0] for b in ihsg[-n_hari:]]
    ihsg_pct = {ihsg[i][0]: ihsg[i][4] / ihsg[i - 1][4] - 1 for i in range(len(ihsg) - n_hari, len(ihsg))}
    out_dir = AKAR / "arus-pasar" / "draft"
    for kode in kode_list:
        d = [b for b in baca(JSON / "ohlc" / f"{kode}.json")["d"] if b[4]]
        assert d[-1][0] == hari[-1], f"{kode}: bar terakhir {d[-1][0]} != {hari[-1]}"
        c = [b[4] for b in d]
        idx = {b[0]: i for i, b in enumerate(d)}
        pct = {t: c[idx[t]] / c[idx[t] - 1] - 1 for t in hari if t in idx}
        br = broker(kode, hari)
        for h in br["per_hari"]:
            h["ihsg_pct"] = round(ihsg_pct[h["t"]] * 100, 2)
            h["emiten_pct"] = round(pct.get(h["t"], 0) * 100, 2)
        seri = [{"l": b[3], "h": b[2], "c": b[4], "v": b[5]} for b in d[-250:]]
        p = PCD.hitung_pcd(seri)
        p.pop("kurva", None)
        pr = prob.analisa_edisi({kode: d}, [kode])[kode]
        asing = {r[0]: (r[1] or 0) - (r[2] or 0) for r in baca(JSON / "asing" / f"{kode}.json")["d"]}
        hasil = {
            "kode": kode, "tanggal": hari[-1], "hari": hari,
            "close": c[-1], "close_awal": c[idx[hari[0]] - 1],
            "gerak_pct": round((c[-1] / c[idx[hari[0]] - 1] - 1) * 100, 2),
            "ema50": round(ema(c[-300:], 50), 1), "ema20": round(ema(c[-300:], 20), 1),
            "asing_net_lembar": sum(asing.get(t, 0) for t in hari),
            "broker": br, "pcd": p,
            "pivot": {k: round(v, 1) for k, v in pr["pivot"].items()},
            "prob": {k: pr[k] for k in ("pR1", "pR2", "pS1", "p3", "base3", "n", "cocok", "total_fitur",
                                        "ret_p25", "ret_p50", "ret_p75", "ci5", "evaluasi")},
            "faktor": pr["faktor"][:6],
        }
        f = out_dir / f"angka-{kode}-{hari[-1]}.json"
        f.write_text(json.dumps(hasil, ensure_ascii=False, indent=1, default=float), encoding="utf-8")
        print(f"{kode}: {f.name}  hilang {br['hari_hilang']}")


if __name__ == "__main__":
    a = sys.argv[1:]
    n = 10
    if "--hari" in a:
        i = a.index("--hari"); n = int(a[i + 1]); del a[i:i + 2]
    main(a, n)
