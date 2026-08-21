# -*- coding: utf-8 -*-
"""Bangun `data-idx/json/aliran_investor.json` — belahan asing/domestik pasar.

B36. Johan 21 Agu 2026 menaruh tangkapan layar "Investor Chart" RTI Business
di `data ide/` dan meminta: *"B36 kerjakan, bangun agregasi FBuy/FSell nya"*.

## Dari mana angkanya — dan kenapa arsip, bukan jaringan

Seluruhnya dari `_arsip-mentah/asing/<tahun>/<yyyymmdd>.json.gz`, salinan
mentah `GetStockSummary` yang sudah dipanen `panen_asing.py`. **Nol
permintaan jaringan**: 1.731 tanggal (2020-01-02 s/d sekarang) sudah ada di
cakram, dan itu persis alasan aturan "jangan buang berkas mentah hasil panen"
dibuat — menambah ruas baru jadi tak berbiaya sama sekali.

Berkas per-emiten `data-idx/json/asing/*.json` TIDAK dipakai walau isinya
mirip: ia cuma menyimpan lima ruas, dan tiga ruas yang justru dibutuhkan di
sini (`NonRegularVolume`/`Value`/`Frequency`) tak pernah ikut disalin.

## Temuan yang mengubah bentuk panel ini — dan wajib dibaca sebelum menyunting

IDX melaporkan DUA PASAR di baris yang sama, dan selama ini kita cuma
memakai satu:

    Volume / Value / Frequency          -> pasar REGULER
    NonRegularVolume/Value/Frequency    -> pasar NEGOSIASI + TUNAI

Terbukti 20 Agu 2026 pada GOTO: reguler 10.633.300 lembar, non-reguler
41.426.989.813 — dijumlah tepat 41.438 juta lembar, angka yang tercetak di
statistik harian IDX. Selama ini agregat kita berhenti di 34,95 miliar lembar
sementara IDX menyebut 77,09 miliar; **seluruh selisihnya pasar non-reguler**,
dan hari itu 96% dari selisih itu satu emiten saja.

Sesudah keduanya dijumlah, agregat ini cocok dengan statistik resmi IDX
sampai dua angka di belakang koma: volume 77,09 miliar lembar (IDX 77,09) dan
nilai 15,78 triliun (IDX 15,78).

## Yang BISA dan TIDAK bisa dijawab berkas ini

- **Volume asing/domestik — BISA, dan nyata.** `ForeignBuy`/`ForeignSell`
  dalam LEMBAR. Diuji ke seluruh 963 baris: tak satu pun emiten punya
  ForeignBuy melebihi volumenya sendiri, jadi ruas itu memang lembar dan
  memang bagian dari volume — bukan rupiah yang tertukar satuan.
- **Nilai rupiah asing — TAKSIRAN, dan ditandai begitu.** IDX tak melaporkan
  aliran asing dalam rupiah sama sekali. Taksirannya `lembar x harga rata-rata
  emiten itu` (Value/Volume), dihitung PER EMITEN lalu dijumlah — bukan sekali
  di tingkat pasar, yang akan memberi bobot salah ke emiten murah bervolume
  raksasa.

  Seberapa jauh melesetnya, diukur bukan ditebak (21 Agu 2026, 138 hari yang
  punya angka resmi): arah cocok **91%** hari, median harian **0,94x** angka
  resmi — tapi dijumlah, kumulatifnya **1,33x**. Galatnya MIRING, bukan acak:
  beberapa hari meleset jauh ke satu arah dan itu menumpuk. Karena itu ruas
  `nf_resmi` ikut disimpan, dan panel memakai angka RESMI untuk net periode
  panjang; taksiran menyisakan tugasnya yang memang tak tergantikan —
  BELAHAN beli/jual, yang tak pernah dilaporkan IDX dalam rupiah.
- **Frekuensi asing/domestik — TIDAK ADA, dan tak ditaksir.** IDX tak
  membelah frekuensi sama sekali. Panel menampilkan totalnya saja dan
  mengatakannya; menaksir belahannya berarti mengarang.

    python scripts/bangun_aliran_investor.py            # seluruh arsip
    python scripts/bangun_aliran_investor.py --hari 400 # 400 tanggal terakhir
    python scripts/bangun_aliran_investor.py --uji      # swauji, tanpa tulis
"""
from __future__ import annotations

import glob
import gzip
import json
import os
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
ARSIP = AKAR / "_arsip-mentah" / "asing"
KELUAR = AKAR / "data-idx" / "json" / "aliran_investor.json"


def _bil(v) -> float:
    """Ruas numerik IDX kadang None, kadang teks kosong. Tak terbaca = 0,
    bukan melempar — satu sel rusak tak boleh membunuh satu tanggal penuh."""
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def ringkas_hari(baris: list[dict]) -> dict | None:
    """Satu tanggal -> satu ringkasan pasar.

    Satuan keluaran: volume LEMBAR, nilai RUPIAH, frekuensi KALI. Tak
    dinormalkan jadi juta/miliar di sini — pembulatan satuan lebih baik
    dilakukan di tempat yang tahu ia sedang mencetak apa.
    """
    if not baris:
        return None
    rg_vol = rg_val = rg_frek = 0.0
    nr_vol = nr_val = nr_frek = 0.0
    fbeli = fjual = 0.0
    n_fbeli = n_fjual = 0.0
    emiten = 0
    for r in baris:
        vol = _bil(r.get("Volume"))
        val = _bil(r.get("Value"))
        rg_vol += vol
        rg_val += val
        rg_frek += _bil(r.get("Frequency"))
        nr_vol += _bil(r.get("NonRegularVolume"))
        nr_val += _bil(r.get("NonRegularValue"))
        nr_frek += _bil(r.get("NonRegularFrequency"))
        # Lembar tak pernah negatif; sel negatif itu rusak, dinolkan.
        fb = max(_bil(r.get("ForeignBuy")), 0.0)
        fj = max(_bil(r.get("ForeignSell")), 0.0)
        fbeli += fb
        fjual += fj
        # Taksiran rupiah dihitung PER EMITEN, dengan harga rata-rata emiten
        # itu sendiri. Sekali di tingkat pasar, satu emiten Rp50 bervolume
        # raksasa akan menyeret harga rata-rata seluruh papan ke bawah.
        if vol > 0:
            harga = val / vol
            n_fbeli += fb * harga
            n_fjual += fj * harga
        emiten += 1
    if emiten == 0 or rg_vol <= 0:
        return None
    return {
        "emiten": emiten,
        "rg_vol": round(rg_vol),
        "rg_val": round(rg_val),
        "rg_frek": round(rg_frek),
        "nr_vol": round(nr_vol),
        "nr_val": round(nr_val),
        "nr_frek": round(nr_frek),
        "f_beli": round(fbeli),
        "f_jual": round(fjual),
        "f_beli_rp": round(n_fbeli),
        "f_jual_rp": round(n_fjual),
    }


def net_resmi_per_tanggal() -> dict[str, float]:
    """Net asing RESMI IDX (miliar rupiah) per tanggal, dari berkas harian.

    Ada gunanya walau kita sudah punya taksiran sendiri, dan alasannya
    terukur: taksiran per-hari memang dekat (median 0,94x angka resmi, arah
    cocok 91% hari), tapi galatnya MIRING — dijumlah 138 hari ia jadi 1,33x.
    Untuk periode panjang, angka resmi inilah yang dipakai sebagai net; yang
    tetap dari taksiran cuma BELAHAN beli/jual-nya, yang memang tak pernah
    dilaporkan IDX dalam rupiah.

    Cakupannya lebih pendek daripada arsip (berkas harian mulai 2026), jadi
    tanggal tanpa angka resmi diberi `None` — bukan diisi taksiran diam-diam.
    """
    peta: dict[str, float] = {}
    p = AKAR / "data-idx" / "json" / "index.json"
    if not p.exists():
        return peta
    for t in json.loads(p.read_text(encoding="utf-8")).get("dates", []):
        f = AKAR / "data-idx" / "json" / f"{t['stem']}.json"
        if not f.exists():
            continue
        try:
            nf = json.loads(f.read_text(encoding="utf-8")).get("nf_today_idr")
        except Exception:
            continue
        if nf is not None:
            peta[t["date_iso"]] = float(nf)
    return peta


def muat_tanggal(path: str) -> list[dict]:
    with open(path, "rb") as fh:
        return json.loads(gzip.decompress(fh.read())).get("data") or []


def bangun(batas: int | None = None) -> dict:
    berkas = sorted(glob.glob(str(ARSIP / "*" / "*.json.gz")))
    if batas:
        berkas = berkas[-batas:]
    resmi = net_resmi_per_tanggal()
    hari: list[list] = []
    for p in berkas:
        stem = os.path.basename(p)[:8]
        tgl = f"{stem[:4]}-{stem[4:6]}-{stem[6:8]}"
        r = ringkas_hari(muat_tanggal(p))
        if r is None:
            continue
        hari.append([
            tgl, r["emiten"], r["rg_vol"], r["rg_val"], r["rg_frek"],
            r["nr_vol"], r["nr_val"], r["nr_frek"],
            r["f_beli"], r["f_jual"], r["f_beli_rp"], r["f_jual_rp"],
            # Net asing RESMI (miliar rupiah) — None kalau tanggalnya tak
            # punya berkas harian, dan itu tidak ditambal taksiran.
            resmi.get(tgl),
        ])
    return {
        "sumber": "IDX GetStockSummary (arsip mentah) — dijumlah per tanggal",
        "ruas": ["tanggal", "emiten", "rg_vol", "rg_val", "rg_frek",
                 "nr_vol", "nr_val", "nr_frek",
                 "f_beli", "f_jual", "f_beli_rp", "f_jual_rp", "nf_resmi"],
        "satuan": {
            "rg_*/nr_*": "vol lembar, val rupiah, frek kali",
            "f_beli/f_jual": "lembar (pasar reguler)",
            "f_beli_rp/f_jual_rp": "TAKSIRAN rupiah = lembar x (Value/Volume) per emiten",
            "nf_resmi": "net asing RESMI IDX, MILIAR rupiah (null kalau tak ada berkas hariannya)",
        },
        "catatan": (
            "rg = pasar reguler, nr = non-reguler (negosiasi + tunai). IDX TIDAK "
            "melaporkan aliran asing dalam rupiah maupun belahan frekuensi "
            "asing/domestik; ruas *_rp adalah taksiran kami, dan frekuensi "
            "hanya tersedia sebagai total."
        ),
        "mulai": hari[0][0] if hari else None,
        "akhir": hari[-1][0] if hari else None,
        "n": len(hari),
        "d": hari,
    }


def _uji() -> None:
    """Swauji ke ANGKA RESMI IDX, bukan ke angka buatan sendiri."""
    p = ARSIP / "2026" / "20260820.json.gz"
    if not p.exists():
        print("uji dilewati: arsip 2026-08-20 tak ada")
        return
    r = ringkas_hari(muat_tanggal(str(p)))
    assert r is not None
    ds = json.loads((AKAR / "data-idx" / "json" / "ds_260820.json").read_text(encoding="utf-8"))

    # Statistik harian IDX: vol juta lembar, val miliar rupiah, frek ribu kali.
    vol_total = (r["rg_vol"] + r["nr_vol"]) / 1e6
    val_total = (r["rg_val"] + r["nr_val"]) / 1e9
    frek_total = (r["rg_frek"] + r["nr_frek"]) / 1e3
    for nama, kita, resmi, toleransi in (
        ("volume", vol_total, ds["vol_today"], 0.01),
        ("nilai", val_total, ds["val_idr_today"], 0.01),
        ("frekuensi", frek_total, ds["freq_today"], 0.02),
    ):
        selisih = abs(kita - resmi) / resmi
        print(f"  {nama:10} kita {kita:>12,.1f}  IDX {resmi:>12,.1f}  selisih {selisih*100:5.2f}%")
        assert selisih <= toleransi, f"{nama} meleset {selisih*100:.2f}% dari angka resmi IDX"

    # Taksiran rupiah: diperiksa ARAH-nya, bukan kesamaan persis — ia memang
    # taksiran, dan menuntutnya sama persis berarti berpura-pura punya data
    # yang tak kita punya.
    net_taksir = (r["f_beli_rp"] - r["f_jual_rp"]) / 1e9
    net_resmi = ds["nf_today_idr"]
    assert net_taksir * net_resmi > 0, "arah net asing taksiran berlawanan dengan angka resmi"
    beda = abs(net_taksir - net_resmi) / abs(net_resmi)
    print(f"  net asing  taksir {net_taksir:>10,.1f} M  IDX {net_resmi:>10,.1f} M  beda {beda*100:5.1f}%")

    # Dan yang JAUH lebih penting daripada satu hari: seberapa jauh taksiran
    # itu menyimpang kalau DIJUMLAH. Diukur 21 Agu 2026 atas 138 hari — arah
    # cocok 91%, median harian 0,94x, tapi kumulatifnya 1,33x. Galatnya
    # miring, bukan acak; itu sebabnya panel memakai angka RESMI untuk net
    # periode panjang dan menyisakan taksiran hanya untuk belahannya.
    resmi = net_resmi_per_tanggal()
    if len(resmi) > 100:
        kita = jum_resmi = 0.0
        cocok = n = 0
        for p2 in sorted(glob.glob(str(ARSIP / "*" / "*.json.gz")))[-len(resmi) * 2:]:
            stem = os.path.basename(p2)[:8]
            tgl = f"{stem[:4]}-{stem[4:6]}-{stem[6:8]}"
            if tgl not in resmi:
                continue
            rr = ringkas_hari(muat_tanggal(p2))
            if rr is None:
                continue
            t = (rr["f_beli_rp"] - rr["f_jual_rp"]) / 1e9
            kita += t
            jum_resmi += resmi[tgl]
            n += 1
            if t * resmi[tgl] > 0:
                cocok += 1
        rasio = kita / jum_resmi if jum_resmi else 0
        print(f"  kumulatif  taksir {kita:>10,.0f} M  IDX {jum_resmi:>10,.0f} M  rasio {rasio:4.2f}x"
              f"  | arah cocok {cocok}/{n} = {cocok / n * 100:.0f}%")
        assert 0.5 <= rasio <= 2.0, "taksiran kumulatif menyimpang lebih dari 2x — rumusnya berubah?"
        assert cocok / n >= 0.8, "arah taksiran cocok di bawah 80% hari — rumusnya berubah?"

    # Belahan asing tak boleh melebihi pasarnya sendiri.
    assert r["f_beli"] <= r["rg_vol"] and r["f_jual"] <= r["rg_vol"]
    assert ringkas_hari([]) is None
    assert ringkas_hari([{"Volume": 0}]) is None
    print("uji bangun_aliran_investor: LOLOS")


def main() -> None:
    if "--uji" in sys.argv:
        _uji()
        return
    batas = None
    for a in sys.argv[1:]:
        if a.startswith("--hari"):
            i = sys.argv.index(a)
            batas = int(sys.argv[i + 1]) if "=" not in a else int(a.split("=")[1])
    hasil = bangun(batas)
    KELUAR.parent.mkdir(parents=True, exist_ok=True)
    KELUAR.write_text(json.dumps(hasil, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kb = KELUAR.stat().st_size / 1024
    print(f"ditulis: {KELUAR.relative_to(AKAR)} — {hasil['n']} tanggal, {kb:,.0f} KB")
    if hasil["d"]:
        a = hasil["d"][-1]
        print(f"  terakhir {a[0]}: reguler {a[2]/1e9:.2f} B lembar, non-reguler {a[5]/1e9:.2f} B, "
              f"asing beli {a[8]/1e9:.2f} B / jual {a[9]/1e9:.2f} B lembar")


if __name__ == "__main__":
    main()
