# -*- coding: utf-8 -*-
"""Bangun berkas broker per emiten PER TAHUN dari arsip mentah — nol jaringan.

Johan 22 Agu 2026: *"bisa gak bangun pondasi koding nya"* sambil backfill
BUMI berjalan. Ini lapis turunannya: arsip -> berkas yang dibaca halaman.

## Kenapa per tahun

Berkas ringkas `broker_harian/<KODE>.json` sengaja hanya 20 hari (ukuran repo).
Halaman Broker Summary versi kita butuh rentang sembarang — 6 bulan untuk
"floor price", setahun untuk kumulatif — dan satu berkas riwayat penuh per
emiten (±2.350 hari x 5 KB ≈ 12 MB) terlalu berat dimuat sekali klik.
Per tahun ≈ 0,75 MB mentah / ±280 KB gzip (terukur BUMI 2017, 237 hari, tanpa kolom
avg), dimuat malas hanya untuk tahun yang rentangnya menyentuh.

## Sumber kebenaran tetap arsip mentah

Berkas ini DITURUNKAN dari `_arsip-mentah/broker-harian/<KODE>/<tgl>.json`
lewat `panen_broker_harian.padatkan()` — pemadat yang sama dengan berkas
ringkas, jadi keduanya tak mungkin berbeda definisi. Menambah ruas = ubah
pemadat, jalankan ulang, tanpa jaringan.

Aturan ukuran (belum diputuskan Johan, dicatat di antrean P5): 963 emiten x
10 tahun x 0,75 MB ≈ 7 GB — MUSTAHIL untuk git. Berkas tahunan hanya untuk
emiten yang di-backfill; daftarnya adalah folder yang ada di arsip.

Pakai:
    python scripts/bangun_broker_tahunan.py            # semua emiten di arsip
    python scripts/bangun_broker_tahunan.py BUMI       # satu emiten
    python scripts/bangun_broker_tahunan.py --uji
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

import panen_broker_harian as ph  # noqa: E402

KELUARAN = AKAR / "data-idx" / "json" / "broker_tahunan"

# Hanya tahun yang panennya SELESAI untuk seluruh bursa yang dibangun.
# Ketetapan Johan 24 Agu 2026: *"kita anggap saja masih ambil data penuh
# 2 tahun di 2025 dan 2026 tahun yang lain masih proses, maka dari itu
# kerjakan dengan 2 tahun itu saja dulu tahun sebelumnya d tutup saja"*.
#
# Alasannya terukur, bukan selera: 2025 dan 2026 punya 955 dan 962 emiten
# dengan enam varian GROSS penuh, sementara 2020-2024 cuma 18-20 emiten
# sisa gelombang backfill lama yang kedalaman variannya belum tentu sama.
# Membangunnya berarti memajang tahun yang isinya 2% bursa seolah setara
# dengan tahun yang isinya penuh — dan pembaca tak punya cara membedakannya
# dari layar. Menambah tahun = panen tahun itu sampai penuh dulu, lalu
# tambahkan di sini.
TAHUN_PENUH = ("2025", "2026")


def bangun_emiten(kode: str, tahun_boleh: tuple[str, ...] = TAHUN_PENUH) -> dict[str, int]:
    """Tulis <KODE>/<tahun>.json untuk tiap tahun panen-penuh yang ada di arsip.

    Kembalikan {tahun: jumlah hari}. Hari yang arsipnya rusak/kosong dilewati
    dan dihitung — bukan dibuang diam-diam. Tahun di luar `tahun_boleh`
    dilewati tanpa dibaca sama sekali (hemat: arsipnya tak disentuh).
    """
    folder = ph.ARSIP / kode
    per_tahun: dict[str, dict] = defaultdict(dict)
    rusak = 0
    for p in sorted(folder.glob("????-??-??.json")):
        tgl = p.stem
        if tgl[:4] not in tahun_boleh:
            continue
        mentah = ph.baca(p)
        baris, ringkas = ph.padatkan(mentah) if mentah else ([], {})
        if not baris:
            rusak += 1
            continue
        ringkas["cocok_volume"] = ph.cocok_volume(ringkas["total_lot"], ph.volume_idx(kode, tgl))
        isi = {"ringkas": ringkas, "broker": ph.padat_baris(baris)}
        # Varian asing/nego: berkas saudara `<tgl>.<varian>.json`. Yang ada saja
        # yang disertakan — halaman membedakan "nol transaksi" (ada, kosong)
        # dari "belum dipanen" (kunci tak ada).
        for varian in ("asing", "nego"):
            pv = folder / ph.nama_arsip(tgl, varian)
            if pv.exists():
                mv = ph.baca(pv)
                bv, rv = ph.padatkan(mv) if mv else ([], {})
                isi[varian] = {"ringkas": rv, "broker": ph.padat_baris(bv)}
        per_tahun[tgl[:4]][tgl] = isi
    hasil = {}
    for tahun, hari in per_tahun.items():
        out = KELUARAN / kode / f"{tahun}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({
            "kode": kode, "tahun": int(tahun), "kolom": ph.KOLOM,
            "sumber": "Stockbit marketdetectors — GROSS, reguler, semua investor",
            "dibangun": datetime.now(ph.WIB).isoformat(timespec="seconds"),
            "n_hari": len(hari),
            "hari": {t: hari[t] for t in sorted(hari)},
        }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        hasil[tahun] = len(hari)
    if rusak:
        print(f"  {kode}: {rusak} berkas arsip kosong/rusak dilewati")
    # Indeks kecil supaya halaman tahu tahun mana yang tersedia tanpa menebak.
    # mkdir di sini juga, BUKAN cuma di perulangan tahun di atas: emiten yang
    # seluruh harinya kosong (GAMA — 385 hari, semuanya HTTP 200 berisi nol
    # karena memang tak bertransaksi) tak pernah masuk perulangan itu, jadi
    # foldernya tak pernah lahir dan penulisan indeks jatuh FileNotFoundError.
    # Indeks bertahun kosong itu justru yang benar: ia membedakan "sudah
    # dibangun, memang tak ada isinya" dari "belum pernah dibangun".
    idx = KELUARAN / kode / "index.json"
    idx.parent.mkdir(parents=True, exist_ok=True)
    idx.write_text(json.dumps({"kode": kode, "tahun": sorted(int(t) for t in hasil),
                               "n_hari": sum(hasil.values()),
                               "dibangun": datetime.now(ph.WIB).isoformat(timespec="seconds")}),
                   encoding="utf-8")
    return hasil


def swauji() -> int:
    import tempfile
    global KELUARAN
    asli_arsip, asli_out = ph.ARSIP, KELUARAN
    try:
        with tempfile.TemporaryDirectory() as d:
            ph.ARSIP = Path(d) / "arsip"; KELUARAN = Path(d) / "out"
            f = ph.ARSIP / "UJI"; f.mkdir(parents=True)
            mentah = {"data": {"broker_summary": {
                "brokers_buy": [{"netbs_broker_code": "AK", "blot": 10, "bval": 1000, "netbs_buy_avg_price": 100}],
                "brokers_sell": [{"netbs_broker_code": "AK", "slot": -4, "sval": -400, "netbs_sell_avg_price": 100}],
            }, "bandar_detector": {"average": 100}}}
            for tgl in ("2025-12-30", "2026-01-02", "2026-01-05"):
                (f / f"{tgl}.json").write_text(json.dumps(mentah), encoding="utf-8")
            (f / "2026-01-06.json").write_text("{}", encoding="utf-8")  # rusak
            (f / "2026-01-05.asing.json").write_text(json.dumps(mentah), encoding="utf-8")
            hasil = bangun_emiten("UJI")
            assert hasil == {"2025": 1, "2026": 2}, hasil
            b = json.loads((KELUARAN / "UJI" / "2026.json").read_text(encoding="utf-8"))
            assert list(b["hari"]) == ["2026-01-02", "2026-01-05"] and b["n_hari"] == 2
            assert b["hari"]["2026-01-02"]["broker"][0][:3] == ["AK", 10, 1000]
            assert "asing" in b["hari"]["2026-01-05"] and "asing" not in b["hari"]["2026-01-02"]
            assert b["hari"]["2026-01-05"]["asing"]["broker"][0][0] == "AK"
            idx = json.loads((KELUARAN / "UJI" / "index.json").read_text(encoding="utf-8"))
            assert idx["tahun"] == [2025, 2026] and idx["n_hari"] == 3
    finally:
        ph.ARSIP, KELUARAN = asli_arsip, asli_out
    print("6/6 lulus")
    return 0


def main() -> int:
    arg = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "--uji" in sys.argv:
        return swauji()
    kode_semua = [a.upper() for a in arg] or sorted(p.name for p in ph.ARSIP.iterdir() if p.is_dir())
    for kode in kode_semua:
        hasil = bangun_emiten(kode)
        print(f"{kode}: " + ", ".join(f"{t}:{n}" for t, n in sorted(hasil.items())) if hasil else f"{kode}: arsip kosong")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
