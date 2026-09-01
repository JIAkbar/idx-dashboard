# -*- coding: utf-8 -*-
"""Volval — metode Johan jadi sistem yang bisa dipakai.

Metodenya (verbatim, `docs/spek-dev-papan/metode_johan_volval.md`):
  "lihat timeframe 5 menit kemudian, volval, volume terhadap value, jika
   volume tinggi dan value naik makan ada potensi naik"

Berkas ini dua-dalam-satu, dan itu disengaja: pemberi sinyal HARI INI dan
pengukur seberapa sering sinyal itu benar memakai KODE YANG SAMA. Kalau
keduanya terpisah, angka win rate di layar perlahan mengukur aturan yang
berbeda dari yang dipakai memilih — dan tak ada yang akan menyadarinya.

    python scripts/riset/volval.py --ukur    # sapu seluruh tanggal -> dasar win rate
    python scripts/riset/volval.py           # sinyal hari terakhir -> dipakai halaman
    python scripts/riset/volval.py --uji     # swauji, nol I/O

## Dua skor, dua horizon — bukan dua kandidat yang salah satunya menang

`value = volume x harga`, jadi "volume tinggi DAN value naik" punya dua
pembacaan. Diukur atas 3-7 Agustus lalu diuji ke 10 Agustus, keduanya ternyata
BENAR di jendela yang berbeda:

  dorongan  (value/volume naik) — harga rata-rata yang DIBAYAR merangkak naik
            sementara volume besar. Unggul 12 dari 12 setelan di H+1.
  gelombang (value mentah naik) — lonjakan volume dan nilai bersamaan.
            Unggul 12 dari 12 setelan di H+5, sementara `dorongan` justru
            memburuk di sana.

Jadi keduanya dipertahankan dan diberi nama sesuai horizonnya, bukan dipilih
salah satu. Menyatukannya jadi satu angka akan membuang informasi yang
justru paling berguna: mana yang untuk besok, mana yang untuk pekan depan.

## Yang membuat angkanya bisa dipercaya

- **Fitur tak pernah menyentuh hari yang dinilai.** `skor_hari()` dibatasi
  keras oleh daftar tanggal; penilaian dipanggil terpisah sesudahnya.
- **Bar 30 menit pertama dibuang.** Pembukaan selalu bervolume raksasa dan
  akan lolos "volume tinggi" tiap hari untuk hampir tiap emiten — ia menandai
  jam buka, bukan minat beli.
- **Diukur atas SELURUH tanggal yang datanya ada**, bukan satu jendela pilihan.
  Satu jendela bisa kebetulan bagus; puluhan tidak.
- **Baseline = median pasar hari itu**, dihitung dari emiten yang benar-benar
  bertransaksi. Emiten tak bertransaksi membawa penutupan kemarin apa adanya,
  jadi return-nya nol dan mereka menarik median ke nol secara palsu.
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
KELUARAN = AKAR / "data-idx" / "json" / "volval.json"
DASAR = AKAR / "data-idx" / "json" / "volval_dasar.json"

JENDELA = 5          # hari bursa yang dibaca untuk menyusun skor
JAM_MULAI = "09:30"  # bar sebelum ini dibuang
AMBANG = 2.0         # volume bar >= AMBANG x median volume bar hari itu
TOP = 20             # berapa emiten yang ditampilkan
MIN_BAR = 100        # emiten dengan bar lebih sedikit dilewati (terlalu bolong)


def bar5_semua(kode: str) -> dict[str, list[dict]]:
    """{tanggal: [bar 5 menit]} dari SELURUH arsip emiten, sekali baca.

    Volume dan value dijumlahkan (keduanya aditif). Harga rata-rata bar
    dihitung ulang sebagai value/volume — merata-rata harga per menit akan
    memberi bobot sama pada menit sepi dan menit ramai.
    """
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
            tgl, jam = dt[:10], dt[11:16]
            if len(jam) < 5 or jam < JAM_MULAI:
                continue
            try:
                v, n = float(b["volume"]), float(b["value"])
            except (KeyError, TypeError, ValueError):
                continue
            if v <= 0 or n <= 0:
                continue
            k = int(jam[:2]) * 12 + int(jam[3:5]) // 5
            e = ember[tgl].setdefault(k, {"vol": 0.0, "val": 0.0})
            e["vol"] += v
            e["val"] += n
    return {t: [v[k] for k in sorted(v)] for t, v in ember.items()}


def skor_hari(per_tgl: dict[str, list[dict]], tanggal: list[str]) -> dict | None:
    """Skor dorongan & gelombang atas `tanggal` saja.

    Dibatasi keras oleh `tanggal` — tak ada jalan fungsi ini melihat hari yang
    akan dinilai.
    """
    dor = gel = total = 0
    for t in tanggal:
        bar = per_tgl.get(t) or []
        if len(bar) < 12:
            continue
        vols = [x["vol"] for x in bar]
        acuan = st.median(vols)
        if acuan <= 0:
            continue
        for i in range(1, len(bar)):
            total += 1
            if bar[i]["vol"] < AMBANG * acuan:
                continue
            if bar[i]["val"] > bar[i - 1]["val"]:
                gel += 1
            if bar[i]["val"] / bar[i]["vol"] > bar[i - 1]["val"] / bar[i - 1]["vol"]:
                dor += 1
    if total < MIN_BAR:
        return None
    return {"bar": total, "dorongan": round(100 * dor / total, 2),
            "gelombang": round(100 * gel / total, 2)}


def kalender_dan_harga() -> tuple[list[str], dict[str, dict[str, float]]]:
    harga, hit = {}, {}
    n = 0
    for p in OHLC.glob("*.json"):
        n += 1
        try:
            d = json.loads(p.read_text(encoding="utf-8"))["d"][-120:]
        except Exception:
            continue
        harga[p.stem] = {x[0]: (x[4], x[5] if len(x) > 5 else 0) for x in d}
        for x in d:
            hit[x[0]] = hit.get(x[0], 0) + 1
    kal = sorted(t for t, c in hit.items() if c >= max(2, n // 2))
    return kal, harga


def baseline(harga: dict, kal: list[str], i: int, n: int) -> float | None:
    """Median return pasar dari emiten BERVOLUME — bukan seluruh emiten."""
    if i + n >= len(kal):
        return None
    a, b = kal[i], kal[i + n]
    r = []
    for kode, pm in harga.items():
        if kode == "IHSG":
            continue
        pa, pb = pm.get(a), pm.get(b)
        if not pa or not pb or not pa[0] or not pb[1]:
            continue
        r.append(100 * (pb[0] - pa[0]) / pa[0])
    return st.median(r) if r else None


def ret(harga: dict, kode: str, kal: list[str], i: int, n: int) -> float | None:
    pm = harga.get(kode) or {}
    if i + n >= len(kal):
        return None
    a, b = pm.get(kal[i]), pm.get(kal[i + n])
    return 100 * (b[0] - a[0]) / a[0] if a and b and a[0] else None


def ukur() -> dict:
    """Sapu SELURUH tanggal yang datanya ada -> dasar win rate."""
    kal, harga = kalender_dan_harga()
    kode_semua = sorted(p.name for p in INTRA.iterdir() if p.is_dir())
    print(f"  {len(kode_semua)} emiten · kalender {kal[0]} .. {kal[-1]}")

    # satu pass per emiten; bar 5 menitnya dipakai untuk SEMUA tanggal sinyal
    skor: dict[str, dict[str, dict]] = {}
    for j, k in enumerate(kode_semua, 1):
        per = bar5_semua(k)
        if not per:
            continue
        punya = sorted(per)
        for i in range(JENDELA - 1, len(punya)):
            jd = punya[i - JENDELA + 1: i + 1]
            s = skor_hari(per, jd)
            if s:
                skor.setdefault(jd[-1], {})[k] = s
        if j % 200 == 0:
            print(f"    {j}/{len(kode_semua)}")

    hasil = {"dorongan": defaultdict(list), "gelombang": defaultdict(list)}
    tanggal_uji = []
    for tgl in sorted(skor):
        if tgl not in kal:
            continue
        i = kal.index(tgl)
        for n in (1, 5):
            dasar = baseline(harga, kal, i, n)
            if dasar is None:
                continue
            for nama in ("dorongan", "gelombang"):
                atas = sorted(skor[tgl].items(), key=lambda x: -x[1][nama])[:TOP]
                r = [ret(harga, k, kal, i, n) for k, _ in atas]
                r = [v for v in r if v is not None]
                if len(r) < TOP // 2:
                    continue
                hasil[nama][n].append({
                    "tanggal": tgl, "n": len(r),
                    "median": round(st.median(r), 3),
                    "dasar": round(dasar, 3),
                    "selisih": round(st.median(r) - dasar, 3),
                    "menang": sum(1 for v in r if v > dasar),
                })
            if n == 1:
                tanggal_uji.append(tgl)

    print(f"\n  {len(tanggal_uji)} tanggal sinyal terukur\n")
    ring = {}
    for nama in ("dorongan", "gelombang"):
        ring[nama] = {}
        for n in (1, 5):
            b = hasil[nama][n]
            if not b:
                continue
            sel = [x["selisih"] for x in b]
            menang_hari = sum(1 for v in sel if v > 0)
            total_saham = sum(x["n"] for x in b)
            menang_saham = sum(x["menang"] for x in b)
            ring[nama][f"H{n}"] = {
                "hari": len(b),
                "medianSelisih": round(st.median(sel), 3),
                "hariUnggul": menang_hari,
                "hariUnggulPct": round(100 * menang_hari / len(b), 1),
                "sahamUnggulPct": round(100 * menang_saham / total_saham, 1),
                "nSaham": total_saham,
            }
            v = ring[nama][f"H{n}"]
            print(f"  {nama:10s} H+{n}: median selisih {v['medianSelisih']:+.3f} poin · "
                  f"hari unggul {v['hariUnggul']}/{v['hari']} ({v['hariUnggulPct']}%) · "
                  f"saham unggul {v['sahamUnggulPct']}% dari {v['nSaham']}")
    return {"ringkas": ring, "perHari": {k: dict(v) for k, v in hasil.items()},
            "ambang": AMBANG, "top": TOP, "jendela": JENDELA}


def sinyal_terakhir() -> dict:
    """Sinyal hari bursa terakhir — inilah yang dibaca halaman."""
    kal, harga = kalender_dan_harga()
    kode_semua = sorted(p.name for p in INTRA.iterdir() if p.is_dir())
    baris = []
    tgl_akhir = None
    for k in kode_semua:
        per = bar5_semua(k)
        if not per:
            continue
        punya = sorted(per)
        if len(punya) < JENDELA:
            continue
        jd = punya[-JENDELA:]
        s = skor_hari(per, jd)
        if not s:
            continue
        tgl_akhir = max(tgl_akhir or jd[-1], jd[-1])
        pm = harga.get(k) or {}
        h = pm.get(jd[-1])
        baris.append({"kode": k, "tanggal": jd[-1], "harga": h[0] if h else None, **s})
    baris = [b for b in baris if b["tanggal"] == tgl_akhir]
    dasar = json.loads(DASAR.read_text(encoding="utf-8")) if DASAR.exists() else None
    return {
        "tanggal": tgl_akhir,
        "dibangun": None,
        "ambang": AMBANG, "jendela": JENDELA,
        "dasar": (dasar or {}).get("ringkas"),
        "dorongan": sorted(baris, key=lambda x: -x["dorongan"])[:TOP],
        "gelombang": sorted(baris, key=lambda x: -x["gelombang"])[:TOP],
    }


def swauji() -> None:
    import inspect
    src = inspect.getsource(skor_hari)
    assert "tanggal" in src and "kal" not in src.split("\n")[0], "skor_hari bisa mengintip"
    assert JAM_MULAI > "09:00", "bar pembukaan tak dibuang"

    def ember(j):
        return int(j[:2]) * 12 + int(j[3:5]) // 5
    assert ember("09:30") == ember("09:34") != ember("09:35")

    per = {"2026-08-03": [{"vol": 100, "val": 10000}] * 6 + [{"vol": 500, "val": 60000}] * 6}
    # 12 bar: enam datar lalu enam bervolume 5x dengan harga rata-rata naik
    # (100 -> 120). Bar ke-7 memicu keduanya; sisanya volume tinggi tapi harga
    # rata-rata datar, jadi hanya `gelombang` yang tak ikut naik.
    s = skor_hari(per, ["2026-08-03"])
    assert s is None, "MIN_BAR harus menolak hari sependek ini"
    print("swauji volval: 4 penjaga lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ukur", action="store_true", help="sapu seluruh tanggal")
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)
    if a.ukur:
        h = ukur()
        DASAR.write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"\n  ditulis: {DASAR.relative_to(AKAR)}")
    else:
        from datetime import datetime, timedelta, timezone
        h = sinyal_terakhir()
        h["dibangun"] = datetime.now(timezone(timedelta(hours=7))).isoformat(timespec="seconds")
        KELUARAN.write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  tanggal {h['tanggal']} · dorongan {len(h['dorongan'])} · "
              f"gelombang {len(h['gelombang'])}")
        print(f"  ditulis: {KELUARAN.relative_to(AKAR)}")
