"""Pemilihan emiten Deep Dive dari SERAPAN broker (#268 A).

Johan 2 Okt 2026: *"masak hasil dari analisa nya dapat AALI, AMRT dan AYAM ?"*
lalu *"kerjakan #268 A+B"*. Pilihan #266 diurutkan menurut kelengkapan data
broker, bukan kekuatan sinyal, persis kesalahan analisa-papan-v1 bagian 6.
Aturan tertulis (analisa-papan-v1 bagian 8):

  populasi  emiten dengan arsip broker REGULER >= MIN_HARI dari JENDELA hari
            bursa terakhir, nilai transaksi jendela >= MIN_NILAI
  ukuran    serapan = jumlah net 3 penampung terbesar / nilai transaksi jendela
  syarat    gerak harga jendela di [GERAK_MIN, GERAK_MAKS]% - diserap, bukan diburu
  urutan    serapan menurun; kandidat screener ikut ditandai, tidak diutamakan

Belum diuji balik: ia PENYARING, bukan peringkat kelayakan. Cakupannya
(berapa emiten lolos populasi dari seluruh arsip) dicetak bersama hasilnya.

Pakai:  python scripts/riset/pindai_serapan.py [--teratas 15]
Keluar: data-idx/json/pindai_serapan.json
Uji:    python scripts/riset/pindai_serapan.py --uji
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
JSON = AKAR / "data-idx" / "json"
ARSIP = AKAR / "_arsip-mentah" / "broker-harian"

JENDELA, MIN_HARI = 10, 8
MIN_NILAI = 100e9
GERAK_MIN, GERAK_MAKS = -12.0, 3.0


def baca(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def serapan_satu(berkas: list[dict]) -> tuple[float, float, list]:
    """berkas = isi data arsip per hari -> (net 3 teratas, nilai total, [(kode, net)])."""
    net, nilai = {}, 0.0
    for d in berkas:
        nilai += (d.get("bandar_detector") or {}).get("value") or 0
        bs = d["broker_summary"]
        for r in bs.get("brokers_buy") or []:
            net[r["netbs_broker_code"]] = net.get(r["netbs_broker_code"], 0) + float(r["bval"])
        for r in bs.get("brokers_sell") or []:
            net[r["netbs_broker_code"]] = net.get(r["netbs_broker_code"], 0) - float(r["sval"])
    top = sorted(((k, v) for k, v in net.items() if v > 0), key=lambda x: -x[1])[:3]
    return sum(v for _, v in top), nilai, top


def main(teratas: int) -> int:
    ihsg = baca(JSON / "ohlc" / "IHSG.json")["d"]
    hari = [b[0] for b in ihsg[-JENDELA:]]
    kandidat = {e["kode"] for e in baca(JSON / "kandidat_deepdive.json")["emiten"]}
    semua = [p.name for p in ARSIP.iterdir() if p.is_dir()]
    lolos_hari, hasil = 0, []
    for kode in semua:
        ada = [t for t in hari if (ARSIP / kode / f"{t}.json").exists()]
        if len(ada) < MIN_HARI:
            continue
        lolos_hari += 1
        net3, nilai, top = serapan_satu([baca(ARSIP / kode / f"{t}.json")["data"] for t in ada])
        if nilai < MIN_NILAI:
            continue
        p = JSON / "ohlc" / f"{kode}.json"
        if not p.exists():
            continue
        d = [b for b in baca(p)["d"] if b[4]]
        i = {b[0]: k for k, b in enumerate(d)}
        if hari[0] not in i or d[-1][0] != hari[-1]:
            continue
        gerak = (d[-1][4] / d[i[hari[0]] - 1][4] - 1) * 100
        if not GERAK_MIN <= gerak <= GERAK_MAKS:
            continue
        hasil.append({"kode": kode, "serapan_pct": round(net3 / nilai * 100, 1), "nilai_m": round(nilai / 1e9),
                      "gerak_pct": round(gerak, 1), "penampung": [[k, round(v / 1e9, 1)] for k, v in top],
                      "hari_broker": len(ada), "kandidat_screener": kode in kandidat})
    hasil.sort(key=lambda r: -r["serapan_pct"])
    keluar = {"tanggal": hari[-1], "jendela": hari, "aturan": {
        "min_hari": MIN_HARI, "min_nilai_m": MIN_NILAI / 1e9, "gerak": [GERAK_MIN, GERAK_MAKS]},
        "cakupan": {"emiten_arsip": len(semua), "lolos_hari": lolos_hari, "lolos_semua": len(hasil)},
        "emiten": hasil}
    (JSON / "pindai_serapan.json").write_text(json.dumps(keluar, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"cakupan: {len(semua)} emiten di arsip, {lolos_hari} punya broker >= {MIN_HARI}/{JENDELA} hari, "
          f"{len(hasil)} lolos semua syarat")
    for n, r in enumerate(hasil[:teratas], 1):
        print(f"{n:2}. {r['kode']:5} serapan {r['serapan_pct']:5}%  nilai Rp{r['nilai_m']} M  gerak {r['gerak_pct']}%  "
              f"{' '.join(k for k, _ in r['penampung'])}{'  [screener]' if r['kandidat_screener'] else ''}")
    return 0


def uji() -> int:
    hari = {"bandar_detector": {"value": 100e9}, "broker_summary": {
        "brokers_buy": [{"netbs_broker_code": "AA", "bval": "30e9"}, {"netbs_broker_code": "BB", "bval": "10e9"}],
        "brokers_sell": [{"netbs_broker_code": "AA", "sval": "5e9"}, {"netbs_broker_code": "CC", "sval": "35e9"}]}}
    net3, nilai, top = serapan_satu([hari, hari])
    assert nilai == 200e9 and top[0] == ("AA", 50e9) and top[1] == ("BB", 20e9)
    assert net3 == 70e9 and len(top) == 2  # CC net jual tak pernah dihitung sebagai penampung
    print("uji pindai_serapan: LOLOS")
    return 0


if __name__ == "__main__":
    a = sys.argv[1:]
    sys.exit(uji() if "--uji" in a else main(int(a[a.index("--teratas") + 1]) if "--teratas" in a else 15))
