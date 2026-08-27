# -*- coding: utf-8 -*-
"""Bangun kategori PERILAKU broker (bukan identitas) — nol jaringan.

Spek `docs/spek-dev-papan/spek_bandarmologi_c2.md` §A. Keputusan Johan 27 Agu
2026 (AskUserQuestion): kategori broker dihitung dari PERILAKU TERUKUR (porsi
nilai pasar, directionality, konsistensi arah) atas jendela 120 hari bursa
terakhir — bukan daftar tetap. Kurasi identitas (`kelompokBroker.ts`, warna)
tetap hidup terpisah — dua sumbu berbeda, jangan digabung.

Sumber: `data-idx/json/broker_tahunan/<KODE>/<tahun>.json` (padatan
`panen_broker_harian`), varian REGULER saja (ruas 'broker'). Kalender bursa
dari `data-idx/json/ohlc/IHSG.json` (pola sama `cek_radar_basi.py`).

Pakai:
    python scripts/bangun_kategori_broker.py            # bangun penuh
    python scripts/bangun_kategori_broker.py --uji       # swauji
"""
from __future__ import annotations

import json
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
BROKER_TAHUNAN = AKAR / "data-idx" / "json" / "broker_tahunan"
KALENDER = AKAR / "data-idx" / "json" / "ohlc" / "IHSG.json"
KELUARAN = AKAR / "data-idx" / "json" / "kategori_broker.json"
WIB = timezone(timedelta(hours=7))
JENDELA_HARI = 120
JENDELA_FLIP = 20


def tulis_retry(path: Path, teks: str) -> None:
    """Windows: berkas yang sedang dibaca proses lain sesekali menolak tulis
    (pola sama `bangun_broker_tahunan.py`). Coba ulang singkat."""
    import time
    for percobaan in range(5):
        try:
            path.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if percobaan == 4:
                raise
            time.sleep(0.3 * (percobaan + 1))


def kalender_tahun(tahun: str) -> list[str]:
    """Tanggal bursa (ASC) untuk satu tahun, dari kalender OHLC IHSG."""
    d = json.loads(KALENDER.read_text(encoding="utf-8"))
    return sorted(r[0] for r in d["d"] if r[0].startswith(tahun))


BUFFER_KALENDER = 15  # kalender OHLC (IHSG) berjalan 1-2 hari di depan panen
# broker (arsip belum sempat dipanen buat hari terbaru) — kandidat dilebihkan
# supaya jendela AKHIR tetap genap 120 hari yang NYATA berisi data, bukan
# menyusut ikut lubang di ekor kalender.


def jendela_kandidat() -> list[str]:
    """(JENDELA_HARI + buffer) tanggal kalender terakhir (ASC), 2026 dulu lalu
    ekor 2025 kalau kurang — kandidat, BUKAN jendela akhir (lihat `bangun()`,
    yang menyaring ke tanggal yang benar-benar berisi arsip)."""
    n = JENDELA_HARI + BUFFER_KALENDER
    tgl = kalender_tahun("2026")
    if len(tgl) < n:
        tgl = kalender_tahun("2025") + tgl
    return tgl[-n:]


def kumpulkan(kandidat: set[str]) -> dict[str, dict[str, list[float]]]:
    """Jumlahkan baris broker REGULER lintas emiten, per tanggal kandidat.

    Kembalikan {tanggal: {kode_broker: [beli_lot, beli_nilai, jual_lot, jual_nilai]}}.
    Hanya tanggal yang benar-benar ada di arsip (nyata dipakai untuk jendela
    akhir) yang muncul sebagai kunci.
    """
    agregat: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0.0, 0.0]))
    tahun_dipakai = {t[:4] for t in kandidat}
    kode_semua = sorted(p.name for p in BROKER_TAHUNAN.iterdir() if p.is_dir())
    for kode in kode_semua:
        for tahun in tahun_dipakai:
            p = BROKER_TAHUNAN / kode / f"{tahun}.json"
            if not p.exists():
                continue
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            for tgl, isi in d.get("hari", {}).items():
                if tgl not in kandidat:
                    continue
                for baris in isi.get("broker", []):
                    kb, bl, bn, jl, jn = baris[0], baris[1], baris[2], baris[3], baris[4]
                    a = agregat[tgl][kb]
                    a[0] += bl; a[1] += bn; a[2] += jl; a[3] += jn
    return agregat


def tanda(x: float) -> int:
    return 1 if x > 0 else (-1 if x < 0 else 0)


def bangun() -> dict:
    tgl_kandidat = jendela_kandidat()
    agregat = kumpulkan(set(tgl_kandidat))
    # Jendela AKHIR = tanggal yang nyata berisi data, 120 terbaru. Kalender
    # boleh menyebut tanggal yang arsipnya kosong (mis. baru dipanen sebagian).
    tgl_isi = sorted(t for t in tgl_kandidat if agregat.get(t))
    jendela = tgl_isi[-JENDELA_HARI:]
    if not jendela:
        raise SystemExit("kalender/arsip kosong — tak ada tanggal dgn data broker")
    ekor20_set = set(jendela[-JENDELA_FLIP:])

    # Ruas per broker per hari (nilai rupiah) — gross/net dgn nol di hari absen,
    # supaya z-score & directionality menghitung seluruh jendela, bukan cuma
    # hari aktif.
    broker_semua = sorted({kb for t in jendela for kb in agregat.get(t, {})})
    gross_harian: dict[str, list[float]] = {}
    net_harian: dict[str, list[float]] = {}
    for kb in broker_semua:
        gh, nh = [], []
        for t in jendela:
            bl, bn, jl, jn = agregat.get(t, {}).get(kb, (0, 0, 0, 0))
            gh.append(bn + jn)
            nh.append(bn - jn)
        gross_harian[kb] = gh
        net_harian[kb] = nh

    gross_pasar = sum(sum(v) for v in gross_harian.values())
    metrik: dict[str, dict] = {}
    for kb in broker_semua:
        gh, nh = gross_harian[kb], net_harian[kb]
        gross_nilai = sum(gh)
        if gross_nilai <= 0:
            continue  # tak pernah bertransaksi nyata di jendela — bukan broker aktif
        net_nilai = sum(nh)
        hari_aktif = sum(1 for g in gh if g > 0)
        directionality = abs(net_nilai) / gross_nilai
        tanda_jendela = tanda(net_nilai)
        if tanda_jendela != 0 and hari_aktif > 0:
            searah = sum(1 for g, n in zip(gh, nh) if g > 0 and tanda(n) == tanda_jendela)
            konsistensi = searah / hari_aktif
        else:
            konsistensi = 0.0
        rerata = statistics.fmean(gh)
        sebaran = statistics.pstdev(gh)
        z_vol = (gh[-1] - rerata) / sebaran if sebaran > 0 else 0.0
        net_20 = sum(n for t, n in zip(jendela, nh) if t in ekor20_set)
        metrik[kb] = {
            "share": gross_nilai / gross_pasar if gross_pasar > 0 else 0.0,
            "directionality": directionality,
            "konsistensi": konsistensi,
            "net_nilai": net_nilai,
            "gross_nilai": gross_nilai,
            "z_vol_terakhir": z_vol,
            "_net_20": net_20,
        }

    # Ambang dari distribusi terukur (spek §A.4) — TIDAK dikarang.
    share_list = [m["share"] for m in metrik.values()]
    dir_list = [m["directionality"] for m in metrik.values()]
    kons_list = [m["konsistensi"] for m in metrik.values()]
    q3_share = statistics.quantiles(share_list, n=4, method="inclusive")[2]
    median_dir = statistics.median(dir_list)
    median_kons = statistics.median(kons_list)

    for kb, m in metrik.items():
        share, direc, kons = m["share"], m["directionality"], m["konsistensi"]
        if share >= q3_share and direc >= median_dir:
            kategori = "whale"
        elif direc >= median_dir:
            kategori = "smart"
        elif share >= q3_share:
            kategori = "ritel"
        else:
            kategori = "smart_ritel"
        m["kategori"] = kategori

        # Gaya: scalper (searah rendah) dulu, lalu balik-arah 20 hari terakhir,
        # lalu akumulasi/distribusi konsisten, sisanya campuran.
        tanda_full, tanda_20 = tanda(m["net_nilai"]), tanda(m["_net_20"])
        if direc < median_dir:
            gaya = "scalper"
        elif tanda_full != 0 and tanda_20 != 0 and tanda_full != tanda_20:
            gaya = "flip_beli" if tanda_20 > 0 else "flip_jual"
        elif tanda_full > 0 and kons >= median_kons:
            gaya = "akumulasi"
        elif tanda_full < 0 and kons >= median_kons:
            gaya = "distribusi"
        else:
            gaya = "campuran"
        m["gaya"] = gaya
        del m["_net_20"]

    per_kategori: dict[str, dict] = {}
    for kat in ("whale", "smart", "smart_ritel", "ritel"):
        anggota = [m for m in metrik.values() if m["kategori"] == kat]
        if anggota:
            sh = [a["share"] for a in anggota]
            per_kategori[kat] = {
                "n": len(anggota),
                "rentang_share": [min(sh), max(sh)],
                "median_directionality": statistics.median(a["directionality"] for a in anggota),
            }
        else:
            per_kategori[kat] = {"n": 0, "rentang_share": [0.0, 0.0], "median_directionality": 0.0}
    per_gaya = {g: sum(1 for m in metrik.values() if m["gaya"] == g)
                for g in ("akumulasi", "distribusi", "flip_beli", "flip_jual", "scalper", "campuran")}

    kalibrasi = {
        "q3_share": q3_share,
        "median_directionality": median_dir,
        "median_konsistensi": median_kons,
        "per_kategori": per_kategori,
        "per_gaya": per_gaya,
    }

    print(f"jendela: {jendela[0]} .. {jendela[-1]} ({len(jendela)} hari bursa), {len(metrik)} broker aktif")
    print(f"ambang: q3_share={q3_share:.5f} median_directionality={median_dir:.4f} median_konsistensi={median_kons:.4f}")
    for kat, k in per_kategori.items():
        print(f"  {kat:12s} n={k['n']:3d} share=[{k['rentang_share'][0]:.5f}..{k['rentang_share'][1]:.5f}] "
              f"median_directionality={k['median_directionality']:.4f}")
    print("gaya:", ", ".join(f"{g}={n}" for g, n in per_gaya.items()))

    return {
        "dibangun": datetime.now(WIB).isoformat(timespec="seconds"),
        "sumber": "arsip broker_tahunan REGULER, 120 hari bursa terakhir",
        "jendela": {"mulai": jendela[0], "akhir": jendela[-1], "n_hari": len(jendela)},
        "kalibrasi": kalibrasi,
        "broker": metrik,
    }


def swauji() -> int:
    """Skenario tangan: 2 emiten x 3 hari, 2 broker. Cek jumlah lintas
    emiten, arah, ambang, dan idempotensi."""
    import tempfile
    global BROKER_TAHUNAN, KALENDER, KELUARAN
    asli = BROKER_TAHUNAN, KALENDER, KELUARAN
    try:
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            BROKER_TAHUNAN = d / "broker_tahunan"
            KALENDER = d / "ohlc_ihsg.json"
            KELUARAN = d / "out.json"
            tanggal5 = ["2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"]
            KALENDER.write_text(json.dumps({"d": [[t, 1, 1, 1, 1, 1] for t in tanggal5]}))
            # AK: searah beli terus (akumulasi), whale (share besar).
            # ZZ: churn dua arah tiap hari (scalper/ritel), share kecil.
            for kode, hari_ak, hari_zz in [
                ("AAA", {"2026-01-02": [1000, 100_000_000, 0, 0],
                         "2026-01-05": [1000, 100_000_000, 0, 0],
                         "2026-01-06": [1000, 100_000_000, 0, 0]},
                        {"2026-01-02": [10, 1_000, 10, 1_000],
                         "2026-01-05": [10, 1_000, 10, 1_000],
                         "2026-01-06": [10, 1_000, 10, 1_000]}),
            ]:
                (BROKER_TAHUNAN / kode).mkdir(parents=True)
                hari = {}
                for t in tanggal5[:3]:
                    hari[t] = {"broker": [
                        ["AK", hari_ak[t][0], hari_ak[t][1], hari_ak[t][2], hari_ak[t][3]],
                        ["ZZ", hari_zz[t][0], hari_zz[t][1], hari_zz[t][2], hari_zz[t][3]],
                    ]}
                (BROKER_TAHUNAN / kode / "2026.json").write_text(
                    json.dumps({"kode": kode, "hari": hari}), encoding="utf-8")
            # Emiten kedua: AK beli lagi (jumlah lintas emiten wajib terlihat).
            (BROKER_TAHUNAN / "BBB").mkdir(parents=True)
            hari2 = {t: {"broker": [["AK", 500, 50_000_000, 0, 0]]} for t in tanggal5[:3]}
            (BROKER_TAHUNAN / "BBB" / "2026.json").write_text(
                json.dumps({"kode": "BBB", "hari": hari2}), encoding="utf-8")

            hasil = bangun()
            b = hasil["broker"]
            assert set(b) == {"AK", "ZZ"}, b
            # AK: gross = 100jt*3 hari beli AAA + 50jt*3 hari beli BBB = 450jt
            assert b["AK"]["gross_nilai"] == 450_000_000, b["AK"]
            assert b["AK"]["net_nilai"] == 450_000_000  # semua beli, jual nol
            assert b["AK"]["directionality"] == 1.0
            assert b["AK"]["konsistensi"] == 1.0
            assert b["AK"]["share"] > b["ZZ"]["share"]
            assert b["AK"]["kategori"] == "whale", b["AK"]
            assert b["AK"]["gaya"] == "akumulasi", b["AK"]
            # ZZ: directionality nol persis (beli==jual tiap hari) -> scalper.
            assert b["ZZ"]["directionality"] == 0.0, b["ZZ"]
            assert b["ZZ"]["gaya"] == "scalper", b["ZZ"]
            assert hasil["jendela"]["n_hari"] == 3  # cuma 3 dari 5 hari kalender berisi arsip
            KELUARAN.write_text(json.dumps(hasil, ensure_ascii=False))
            ulang = json.loads(KELUARAN.read_text(encoding="utf-8"))
            assert ulang["broker"]["AK"]["gross_nilai"] == b["AK"]["gross_nilai"]  # idempoten
    finally:
        BROKER_TAHUNAN, KALENDER, KELUARAN = asli
    print("9/9 lulus")
    return 0


def main() -> int:
    if "--uji" in sys.argv:
        return swauji()
    hasil = bangun()
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    tulis_retry(KELUARAN, json.dumps(hasil, ensure_ascii=False, separators=(",", ":")))
    print(f"ditulis: {KELUARAN}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
