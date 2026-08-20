# -*- coding: utf-8 -*-
"""Sapuan REGRESI atas seluruh `data-idx/json/keuangan_idx/` + `..._diskret/`.

KENAPA ADA (20 Agu 2026)
------------------------
CLAUDE.md mewajibkan: "Membetulkan ruas HULU wajib disertai sapuan regresi
atas SELURUH berkas, bukan cuma yang diperiksa tangan." Sampai hari ini
sapuannya selalu ditulis ulang ad-hoc tiap sesi, jadi angkanya tak pernah
bisa diadu lurus antar sesi -- "lompatan neraca >50x" pernah dilaporkan 15,
18, 19, dan 20 dalam tiga catatan berbeda karena definisinya ikut berubah.

Skrip ini MENGUNCI definisinya. Nol jaringan, ~10 detik.

    python scripts/sapu_regresi_keuangan.py            # ringkasan
    python scripts/sapu_regresi_keuangan.py --rinci    # + daftar tiap temuan
    python scripts/sapu_regresi_keuangan.py --json x.json

DEFINISI (jangan diubah tanpa mencatat alasannya di sini)
---------------------------------------------------------
- **Lompatan neraca**: dua periode BERURUTAN dalam bucket yang sama
  (`tahunan` atau `kuartal`), ruas `total_assets` atau `equity`, keduanya
  bukan nol/None, rasio `max/min` >= 50. Tiap (kode, bucket, ruas, pasangan
  tanggal) dihitung SATU lompatan.
- Tiap lompatan diberi satu **vonis**, urut (yang pertama cocok menang):
  1. `ditandai-cacat` -- salah satu periodenya ada di `scripts/cacat_sumber.py`
     dan tercatat di ruas `cacat` berkasnya. Sudah diperiksa tangan, sudah
     ditulis alasannya, dan pembacanya sudah diberi tahu.
  2. `ganti-mata-uang` -- `mata_uang` kedua periode beda. Rupiah<->dolar itu
     ~4,2 dekade besaran; lompatannya wajar dan bukan cacat.
  3. `ekuitas-melintasi-nol` -- ruas `equity` dan tandanya berbalik. Ekuitas
     yang lewat nol memberi rasio sembarang besar; itu peristiwa nyata.
  4. `ekuitas-dekat-nol` -- ruas `equity`, sisi yang kecil di bawah 1% total
     aset periodenya. Pembagi yang hampir nol membuat rasio meledak walau
     selisih rupiahnya biasa saja: MPPA -596 juta di atas aset Rp 3,2 T
     (0,019%) berpindah ke -35,9 miliar dan terbaca "60x". Yang terjadi
     perusahaan rugi satu kuartal, bukan data rusak.
  5. `nyata-terperiksa` -- ada di daftar `NYATA` di bawah: sudah diperiksa
     tangan dan terbukti peristiwa sungguhan (aksi korporasi, ekuitas yang
     terkikis). Datanya tak diapa-apakan; yang dicatat cuma bahwa seseorang
     sudah melihatnya.
  6. `sesuai-berkas-resmi` -- ada di `_arsip-mentah/` DAN nilai tersimpan sama
     dengan nilai arsipnya (toleransi 1%): lompatannya memang ada di berkas
     resmi IDX, bukan lahir dari pengolahan kita. Ini BUKAN vonis "benar" --
     hanya "bukan kita yang membuatnya", dan ia menunggu diperiksa tangan.
  7. `tak-terjelaskan` -- sisanya. Inilah satu-satunya angka yang boleh naik
     tanpa penjelasan tertulis.
- **Revenue diskret negatif**: `keuangan_idx_diskret/` -> `kuartal[*].revenue < 0`.
- **Mata uang**: `mata_uang` terbaca (`mata_uang_laporan`) vs ditaksir.
"""
from __future__ import annotations

import argparse
import json
import pathlib
from collections import Counter

AKAR = pathlib.Path(__file__).resolve().parent.parent
IDX = AKAR / "data-idx" / "json" / "keuangan_idx"
DISKRET = AKAR / "data-idx" / "json" / "keuangan_idx_diskret"
DASAR = AKAR / "_arsip-mentah" / "keuangan_idx" / "_dasar.json"

AMBANG = 50.0
RUAS_NERACA = ("total_assets", "equity")

# Lompatan yang SUDAH diperiksa satu per satu (20 Agu 2026, D8) dan terbukti
# peristiwa NYATA, bukan cacat. Datanya tak diapa-apakan -- yang dicatat cuma
# bahwa seseorang sudah melihatnya. Gunanya supaya `tak-terjelaskan` benar-benar
# berarti "belum ada yang memeriksa", sehingga temuan BARU langsung menonjol.
# Menambah baris di sini WAJIB disertai buktinya, bukan kesan.
NYATA: dict[tuple[str, str, str], str] = {
    ("ZBRA", "2020-12-31", "2021-12-31"):
        "Aksi korporasi 2021. Kedua sisi ujung terkonfirmasi arsip mentah: 2019 "
        "Rp 5,58 miliar dan 2022 Rp 3,16 triliun. Lompatannya di 2021, bukan di "
        "pembacaan kita.",
    ("MKNT", "2024-12-31", "2025-12-31"):
        "Arus investasi -Rp 822,925 miliar diimbangi arus pendanaan +Rp 822,925 "
        "miliar (angkanya sama persis), dan aset naik sebesar itu. Terkonfirmasi "
        "arsip di periode tetangga: 2026-03-31 mencatat aset Rp 826,09 miliar "
        "dengan liabilitas Rp 835,19 miliar.",
    ("PANI", "2021-12-31", "2022-12-31"):
        "Injeksi aset 2022 — aset Rp 163,9 miliar menjadi Rp 15,94 triliun, "
        "ekuitas Rp 41,98 miliar menjadi Rp 7,38 triliun. 2022 terkonfirmasi "
        "arsip mentah; 2023-2026 melanjutkan tren yang sama tanpa lompatan lagi.",
    ("BEEF", "2019-12-31", "2020-12-31"):
        "Ekuitas terkikis Rp 385,9 miliar menjadi Rp 7,25 miliar lalu MINUS "
        "Rp 174,4 miliar di 2021 — satu arah, tiga tahun. Aset & liabilitas ikut "
        "bergerak sewajarnya (2019 & 2022 terkonfirmasi arsip).",
}


def _muat_dasar() -> dict:
    if not DASAR.exists():
        return {}
    try:
        return json.loads(DASAR.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _nilai_arsip(dasar: dict, kode: str, bucket: str, tanggal: str, ruas: str):
    d = (((dasar.get(kode) or {}).get(bucket) or {}).get(tanggal) or {})
    return (d.get("nilai") or {}).get(ruas)


def _sama(a, b, tol=0.01) -> bool:
    if a is None or b is None or a == 0:
        return False
    return abs(abs(a) - abs(b)) / abs(a) <= tol


def _dekat_nol(per: dict, t1: str, v1: float, t2: str, v2: float) -> bool:
    """Sisi yang kecil di bawah 1% total aset periodenya sendiri. Ekuitas yang
    hampir nol adalah PEMBAGI yang hampir nol: rasionya meledak walau selisih
    rupiahnya biasa saja. Diukur terhadap total aset, bukan terhadap ekuitas
    lain, supaya "kecil" berarti kecil bagi perusahaan itu."""
    t, v = (t1, v1) if abs(v1) <= abs(v2) else (t2, v2)
    aset = (per.get(t) or {}).get("total_assets")
    return isinstance(aset, (int, float)) and bool(aset) and abs(v) / abs(aset) < 0.01


def lompatan_neraca(dasar: dict) -> list[dict]:
    out: list[dict] = []
    for p in sorted(IDX.glob("*.json")):
        isi = json.loads(p.read_text(encoding="utf-8"))
        kode = isi.get("ticker") or p.stem
        mu = isi.get("mata_uang") or {}
        cacat = isi.get("cacat") or {}
        bawaan = isi.get("currency") or "IDR"
        for bucket in ("tahunan", "kuartal"):
            per = isi.get(bucket) or {}
            tgl = sorted(per.keys())
            for ruas in RUAS_NERACA:
                pts = [(t, per[t].get(ruas)) for t in tgl]
                pts = [(t, v) for t, v in pts if isinstance(v, (int, float)) and v]
                for (t1, v1), (t2, v2) in zip(pts, pts[1:]):
                    hi, lo = max(abs(v1), abs(v2)), min(abs(v1), abs(v2))
                    if lo == 0 or hi / lo < AMBANG:
                        continue
                    c1, c2 = mu.get(t1, bawaan), mu.get(t2, bawaan)
                    if t1 in cacat or t2 in cacat:
                        vonis = "ditandai-cacat"
                    elif c1 != c2:
                        vonis = "ganti-mata-uang"
                    elif ruas == "equity" and (v1 < 0) != (v2 < 0):
                        vonis = "ekuitas-melintasi-nol"
                    elif ruas == "equity" and _dekat_nol(per, t1, v1, t2, v2):
                        vonis = "ekuitas-dekat-nol"
                    elif (kode, t1, t2) in NYATA:
                        vonis = "nyata-terperiksa"
                    elif (_sama(_nilai_arsip(dasar, kode, bucket, t1, ruas), v1)
                          and _sama(_nilai_arsip(dasar, kode, bucket, t2, ruas), v2)):
                        vonis = "sesuai-berkas-resmi"
                    else:
                        vonis = "tak-terjelaskan"
                    out.append({"kode": kode, "bucket": bucket, "ruas": ruas,
                                "dari": t1, "ke": t2, "v1": v1, "v2": v2,
                                "rasio": round(hi / lo, 1), "cur": f"{c1}->{c2}",
                                "vonis": vonis})
    return out


def revenue_negatif() -> tuple[int, int, list[str]]:
    neg, total, daftar = 0, 0, []
    for p in sorted(DISKRET.glob("*.json")):
        isi = json.loads(p.read_text(encoding="utf-8"))
        for t, d in (isi.get("kuartal_diskret") or {}).items():
            v = (d.get("nilai") or {}).get("revenue")
            if not isinstance(v, (int, float)):
                continue
            total += 1
            if v < 0:
                neg += 1
                daftar.append(f"{isi.get('ticker') or p.stem} {t}")
    return neg, total, daftar


def mata_uang() -> dict:
    terbaca = ditaksir = 0
    non_idr_berkas = 0
    for p in sorted(IDX.glob("*.json")):
        isi = json.loads(p.read_text(encoding="utf-8"))
        lap = isi.get("mata_uang_laporan") or {}
        for t in (isi.get("mata_uang") or {}):
            if t in lap:
                terbaca += 1
            else:
                ditaksir += 1
        if (isi.get("currency") or "IDR") != "IDR":
            non_idr_berkas += 1
    return {"terbaca": terbaca, "ditaksir": ditaksir,
            "total": terbaca + ditaksir, "berkas_non_idr": non_idr_berkas}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rinci", action="store_true")
    ap.add_argument("--json", help="tulis hasil lengkap ke berkas")
    a = ap.parse_args()

    dasar = _muat_dasar()
    lomp = lompatan_neraca(dasar)
    c = Counter(x["vonis"] for x in lomp)
    neg, tot_rev, daftar_neg = revenue_negatif()
    mu = mata_uang()

    print(f"lompatan neraca >={AMBANG:.0f}x : {len(lomp)}")
    for v in ("ditandai-cacat", "ganti-mata-uang", "ekuitas-melintasi-nol",
              "ekuitas-dekat-nol", "nyata-terperiksa", "sesuai-berkas-resmi",
              "tak-terjelaskan"):
        print(f"    {v:<24}: {c.get(v, 0)}")
    print(f"revenue diskret negatif  : {neg} dari {tot_rev}")
    print(f"mata uang                : {mu['terbaca']} terbaca + {mu['ditaksir']} ditaksir"
          f" = {mu['total']}  ({mu['berkas_non_idr']} berkas non-IDR)")

    if a.rinci:
        print("\n-- lompatan --")
        for x in sorted(lomp, key=lambda y: (y["vonis"], -y["rasio"])):
            print(f"  {x['vonis']:<22} {x['kode']:<6} {x['bucket']:<7} {x['ruas']:<13}"
                  f" {x['dari']}->{x['ke']}  {x['rasio']}x  {x['cur']}"
                  f"  {x['v1']:.4g} -> {x['v2']:.4g}")
        if daftar_neg:
            print("\n-- revenue diskret negatif --")
            for s in daftar_neg:
                print("  " + s)

    if a.json:
        pathlib.Path(a.json).write_text(json.dumps(
            {"lompatan": lomp, "revenue_negatif": daftar_neg, "mata_uang": mu},
            ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
