# -*- coding: utf-8 -*-
"""Menilai TESIS kontributor dengan hakim yang sama persis dengan rekomendasi.

Antrean #3, pemicu Johan *"kerjakan #3"* (6 Sep 2026). Spek:
`docs/spek-dev-papan/tesis-kontributor.md`.

**Nol jaringan.** Masukan: `data-idx/json/tesis_masuk.json` (salinan tabel
`tesis`, ditarik `scripts/tarik_tesis.py`) + `ohlc/<KODE>.json`. Pemisahan itu
disengaja: hakim yang menyentuh jaringan tak bisa dijalankan ulang untuk
memeriksa angkanya, dan angka yang tak bisa diperiksa ulang bukan catatan.

**Aturannya bukan aturan baru.** Keempat keputusan `nilai_jejak.py` berlaku apa
adanya — hari sinyal tak dinilai, target & stop di hari yang sama = kalah
(ditandai `ambigu`), harga yang tak pernah masuk area = `tak_masuk` dan tetap
jadi penyebut, dua win rate dilaporkan berdampingan. Yang ditambah cuma dua hal
yang memang milik tesis: **arah** (`turun` dicerminkan, bukan dicabangkan) dan
**horizon per sinyal** (5/10/20). Keduanya hidup di `nilai_satu()` yang sama,
bukan di salinan kedua.

Keluaran:

| Berkas | Sifat | Isi |
|---|---|---|
| `penilaian_tesis/<tgl>.json` | **sekali tulis** | vonis tesis bertanggal sinyal itu, hanya kalau horizonnya sudah lewat DAN datanya sudah mengendap |
| `tesis_vonis.json` | ditulis ulang tiap jalan | ringkasan untuk halaman: vonis per tesis + agregat per penyetor |

Jalankan dari akar repo:
    python scripts/riset/nilai_tesis.py
    python scripts/riset/nilai_tesis.py --uji     # swauji, nol I/O
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nilai_jejak import (  # noqa: E402 — satu hakim, bukan salinan kedua
    GANTUNG, KALAH, MENANG, TAK_MASUK, bar_per_tanggal, kalender_bursa, nilai_satu,
)

AKAR = Path(__file__).resolve().parents[2]
MASUK = AKAR / "data-idx" / "json" / "tesis_masuk.json"
PENILAIAN = AKAR / "data-idx" / "json" / "penilaian_tesis"
KELUARAN = AKAR / "data-idx" / "json" / "tesis_vonis.json"
WIB = timezone(timedelta(hours=7))

# Status tesis yang sudah TUNTAS — penyebut akurasi jenjang (keputusan Johan #3:
# yang masih berjalan tidak menghukum penyetor yang rajin).
TUNTAS = (MENANG, KALAH, TAK_MASUK)


def ke_sinyal(t: dict) -> dict:
    """Baris tabel `tesis` → bentuk sinyal yang dimengerti hakim.

    Area masuk selalu dikirim sebagai [bawah, atas] walau penyetor memilih satu
    harga (bawah == atas): satu bentuk untuk hakim, bukan dua cabang."""
    return {
        "kode": t["kode"],
        "arah": t.get("arah", "naik"),
        "tp1": t["target"],
        "sl": t["stop"],
        "entry": [t["masuk_bawah"], t["masuk_atas"]],
    }


def nilai_tesis(t: dict, kalender: list[str], singgahan: dict) -> dict:
    """Vonis satu tesis + jejak secukupnya untuk diperiksa ulang orang lain."""
    horizon = int(t["horizon_hari"])
    r = nilai_satu(ke_sinyal(t), t["tanggal_sinyal"], kalender, singgahan, horizon=horizon)

    # Berapa hari bursa yang benar-benar sudah lewat sesudah hari sinyal. Ini
    # yang memutuskan "menggantung" vs "belum waktunya dinilai" — dua hal yang
    # gampang tertukar dan artinya berlawanan.
    try:
        i = kalender.index(t["tanggal_sinyal"])
        sesudah = len(kalender) - 1 - i
    except ValueError:
        sesudah = 0

    hasil = r["hasil"]
    # Jendela yang BELUM tutup tak boleh melahirkan vonis yang sifatnya final
    # ke bawah. `menang` dan `kalah` boleh jatuh lebih awal — target atau stop
    # memang sudah tersentuh, dan hari berikutnya tak bisa membatalkannya.
    # `tak_masuk` TIDAK: harga masih punya sisa hari untuk masuk area, dan
    # menguncinya sekarang memasukkan tesis yang belum selesai ke penyebut
    # akurasi. Itu menghukum penyetor atas hari yang belum terjadi.
    if sesudah < horizon and hasil in (TAK_MASUK, GANTUNG):
        hasil = GANTUNG

    peta = bar_per_tanggal(t["kode"], singgahan)
    keluar = r.get("tglKeluar")
    return {
        "id": t.get("id"),
        "penyetor": t.get("penyetor"),
        "kode": t["kode"],
        "arah": t.get("arah", "naik"),
        "tanggalSinyal": t["tanggal_sinyal"],
        "horizonHari": horizon,
        "status": hasil,
        "ambigu": bool(r.get("ambigu")),
        "sebab": r["sebab"],
        "tglKeluar": keluar,
        "hariTerpakai": (kalender.index(keluar) - kalender.index(t["tanggal_sinyal"]))
                        if keluar and keluar in kalender else None,
        "hargaAkhir": peta.get(keluar, (None, None, None, None))[3] if keluar else None,
        "hariBursaSesudah": sesudah,
        "jendelaTutup": sesudah >= horizon,
    }


def ringkas(vonis: list[dict]) -> dict:
    """Agregat per penyetor — dasar jenjang.

    Penyebut akurasi = tesis yang horizonnya sudah LEWAT (menang + kalah +
    tak_masuk). Yang masih menggantung tidak dihitung: memakainya sebagai
    penyebut menghukum keaktifan, bukan ketepatan (keputusan Johan #3)."""
    per: dict[str, dict] = {}
    for v in vonis:
        p = per.setdefault(v["penyetor"], {k: 0 for k in (MENANG, KALAH, TAK_MASUK, GANTUNG)})
        p[v["status"]] = p.get(v["status"], 0) + 1
    for p in per.values():
        tuntas = p[MENANG] + p[KALAH] + p[TAK_MASUK]
        p["tuntas"] = tuntas
        p["akurasi"] = round(100 * p[MENANG] / tuntas, 1) if tuntas else None
        # Dilaporkan berdampingan, tak pernah satu — sama seperti hakim jejak.
        selesai = p[MENANG] + p[KALAH]
        p["menangDariTuntas"] = round(100 * p[MENANG] / selesai, 1) if selesai else None
    return per


def jalankan() -> dict:
    if not MASUK.exists():
        print(f"Tak ada {MASUK.relative_to(AKAR)} — jalankan scripts/tarik_tesis.py dulu.")
        return {"tesis": [], "perPenyetor": {}, "hariBursaTerakhir": None}

    isi = json.loads(MASUK.read_text(encoding="utf-8"))
    daftar = [t for t in (isi.get("tesis") or isi if isinstance(isi, list) else [])
              if t.get("status") != "batal"]
    kalender = kalender_bursa()
    singgahan: dict = {}
    vonis = [nilai_tesis(t, kalender, singgahan) for t in daftar]
    return {
        "dibangun": datetime.now(WIB).isoformat(timespec="seconds"),
        "hariBursaTerakhir": kalender[-1] if kalender else None,
        "tesis": vonis,
        "perPenyetor": ringkas(vonis),
    }


def segel(hasil: dict) -> dict:
    """Catatan sekali tulis per tanggal sinyal.

    Aturan jeda yang sama dengan `nilai_jejak.py` (#408): jendela tutup saja
    tak cukup, butuh satu hari bursa JEDA sesudahnya supaya barnya sempat
    mengendap. Yang sudah ada TIDAK ditimpa."""
    PENILAIAN.mkdir(parents=True, exist_ok=True)
    per_tanggal: dict[str, list[dict]] = {}
    for v in hasil["tesis"]:
        if v["hariBursaSesudah"] >= v["horizonHari"] + 1:
            per_tanggal.setdefault(v["tanggalSinyal"], []).append(v)

    n = {"baru": 0, "lewat": 0}
    for tgl, isi in sorted(per_tanggal.items()):
        p = PENILAIAN / f"{tgl}.json"
        if p.exists():
            n["lewat"] += 1
            continue
        p.write_text(json.dumps({
            "tanggal": tgl,
            "dinilaiPada": hasil["dibangun"],
            "hariBursaTerakhirSaatDinilai": hasil["hariBursaTerakhir"],
            "n": len(isi),
            **{k: sum(1 for v in isi if v["status"] == k) for k in (MENANG, KALAH, TAK_MASUK, GANTUNG)},
            "tesis": isi,
        }, ensure_ascii=False, indent=1), encoding="utf-8")
        n["baru"] += 1
    return n


def swauji() -> None:
    kal = ["2026-08-24", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-31",
           "2026-09-01", "2026-09-02"]
    singgahan = {"X": {
        "2026-08-24": (100, 104, 98, 100),
        "2026-08-26": (101, 110, 95, 106),
        "2026-08-27": (107, 120, 105, 108),
    }}
    dasar = {"id": "t1", "penyetor": "u1", "kode": "X", "tanggal_sinyal": "2026-08-24",
             "masuk_bawah": 98, "masuk_atas": 102, "horizon_hari": 5}

    v = nilai_tesis({**dasar, "arah": "naik", "target": 118, "stop": 90}, kal, singgahan)
    assert v["status"] == MENANG and v["tglKeluar"] == "2026-08-27", v
    assert v["hariTerpakai"] == 2, v          # 26 & 27 Agu = dua hari bursa
    assert v["hargaAkhir"] == 108, v

    v = nilai_tesis({**dasar, "arah": "turun", "target": 96, "stop": 130}, kal, singgahan)
    assert v["status"] == MENANG and v["tglKeluar"] == "2026-08-26", v

    # Horizon 5 dari 24 Agu butuh 5 hari bursa sesudahnya; kalender uji cuma
    # punya 6, jadi jendelanya tutup — tapi tesis bertanggal 1 Sep belum.
    v = nilai_tesis({**dasar, "tanggal_sinyal": "2026-09-01", "arah": "naik",
                     "target": 999, "stop": 1}, kal, singgahan)
    assert v["status"] == GANTUNG and v["jendelaTutup"] is False, v

    # Area masuk yang tak pernah tersentuh = tak_masuk, dan ia TETAP dihitung.
    v = nilai_tesis({**dasar, "arah": "naik", "masuk_bawah": 50, "masuk_atas": 60,
                     "target": 118, "stop": 40}, kal, singgahan)
    assert v["status"] == TAK_MASUK, v

    r = ringkas([
        {"penyetor": "u1", "status": MENANG}, {"penyetor": "u1", "status": KALAH},
        {"penyetor": "u1", "status": TAK_MASUK}, {"penyetor": "u1", "status": GANTUNG},
    ])["u1"]
    assert r["tuntas"] == 3, r                       # menggantung di luar penyebut
    assert r["akurasi"] == round(100 / 3, 1), r      # 1 menang dari 3 tuntas
    assert r["menangDariTuntas"] == 50.0, r          # 1 dari (1 menang + 1 kalah)

    # Penyetor tanpa tesis tuntas: akurasi None, BUKAN 0 — belum terukur beda
    # dari selalu salah.
    r = ringkas([{"penyetor": "u2", "status": GANTUNG}])["u2"]
    assert r["tuntas"] == 0 and r["akurasi"] is None, r

    print("swauji nilai_tesis: 10 kasus lolos")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        swauji()
        sys.exit(0)

    h = jalankan()
    if not h["tesis"]:
        print("Belum ada tesis untuk dinilai.")
        sys.exit(0)
    n = segel(h)
    KELUARAN.write_text(json.dumps(h, ensure_ascii=False, indent=1), encoding="utf-8")
    hitung = {k: sum(1 for v in h["tesis"] if v["status"] == k)
              for k in (MENANG, KALAH, TAK_MASUK, GANTUNG)}
    print(f"{len(h['tesis'])} tesis: " + " · ".join(f"{k} {v}" for k, v in hitung.items()))
    print(f"  ditulis: {KELUARAN.relative_to(AKAR)}")
    print(f"  penilaian_tesis/: {n['baru']} tanggal baru, {n['lewat']} sudah ada (tak ditimpa)")
