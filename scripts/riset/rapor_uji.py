# -*- coding: utf-8 -*-
"""Rapor Uji — pilihan & sinyal PAPAN dinilai SESUDAH kejadian (#221 opsi a).

Spek: docs/spek-dev-papan/spek_rapor_uji_221.md.

Johan 22 Sep 2026: *"hasil dari benchmark data bukan hanya data angan-angan"*.
Sinyal mesin (OBV, RBS) dicatat pada hari terjadinya lewat `--catat`, dan
catatan lama TIDAK PERNAH ditulis ulang — jadi hasilnya tak bisa disetel
sesudah angka kelihatan. `--nilai` membaca log itu + pilihan redaksi
(`bt_manusia.muat_pilihan_manusia`) dan menilai keduanya H+5/H+20 terhadap
pilihan acak dan IHSG.

Mesin trade SAMA dengan bt_papan/bt_manusia: `simulasi_trade` diimpor apa
adanya. Satu definisi entry/exit/return untuk seluruh repo.

    python scripts/riset/rapor_uji.py --uji
    python scripts/riset/rapor_uji.py --catat
    python scripts/riset/rapor_uji.py --nilai
"""
from __future__ import annotations

import argparse
import bisect
import json
import random
import statistics
import sys
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

AKAR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from bt_papan import (  # noqa: E402
    ParamRBS, deteksi_rbs, muat_emiten, muat_ihsg, simulasi_trade, universe_partanggal,
)
from bt_indikator import _df, sinyal  # noqa: E402
from bt_manusia import muat_pilihan_manusia  # noqa: E402

LOG_DIR = AKAR / "data-idx" / "json" / "rapor_uji"
LOG = LOG_DIR / "log_sinyal.json"
NILAI = AKAR / "data-idx" / "json" / "rapor_uji.json"
RISET = AKAR / "data-idx" / "json" / "bt_riset" / "ringkas.json"

UNIVERSE_TOP_N = 150
N_ULANGAN_ACAK = 200  # 20 terlalu goyang: p95 dari 20 angka = angka ke-19 (terukur 2,13 vs 2,78 antar-benih)
N_PILIHAN_LAYAR = 60


# ============================================================== util bersama
def _idx_pada(d: dict, tgl: str) -> int | None:
    tl = d["tgl"]
    i = bisect.bisect_left(tl, tgl)
    return i if i < len(tl) and tl[i] == tgl else None


def _rank_pada(rank: dict[str, pd.Series], kode: str, idx: int) -> float | None:
    s = rank.get(kode)
    if s is None or idx >= len(s):
        return None
    v = s.iloc[idx]
    return None if pd.isna(v) else float(v)


def _pf(returns: list[float]) -> float | None:
    menang = sum(r for r in returns if r > 0)
    kalah = abs(sum(r for r in returns if r <= 0))
    return (menang / kalah) if kalah else None


# =================================================================== --catat
def proses_catat(bars: dict[str, dict], rank: dict[str, pd.Series], T: str, log: dict) -> tuple[dict, int, int, bool]:
    """Tulis sinyal OBV/RBS yang konfirmasinya jatuh di `T` ke `log` (in-place).

    Idempoten: kalau `T` sudah ada di `hari_tercatat`, log dikembalikan apa
    adanya (nol baris ditambah) dan flag ketiga True.

    `idx = len(d['tgl'])-1` untuk tiap kode yang lolos (bukan `_idx_pada`
    bisect): T adalah tanggal bar TERAKHIR lintas seluruh emiten (nilai
    maksimum), jadi kalau T ada di riwayat sebuah kode ia otomatis bar
    terakhir kode itu juga — tak ada bar sesudahnya yang bisa diintip.
    """
    hari_tercatat: list[str] = log.setdefault("hari_tercatat", [])
    catatan: list[dict] = log.setdefault("catatan", [])
    if T in hari_tercatat:
        return log, 0, 0, True

    hari_ini = date.today().isoformat()
    p = ParamRBS()
    n_obv = n_rbs = 0
    for kode, d in sorted(bars.items()):
        if not d["tgl"] or d["tgl"][-1] != T:
            continue
        idx = len(d["tgl"]) - 1
        r = _rank_pada(rank, kode, idx)
        if r is None or r > UNIVERSE_TOP_N:
            continue

        try:
            s = sinyal("obv", _df(d))
            if bool(s.iloc[idx]):
                catatan.append({"tanggal": T, "kode": kode, "sumber": "obv", "dicatat": hari_ini})
                n_obv += 1
        except Exception:
            pass

        for rec in deteksi_rbs(d, p):
            if rec.get("status") == "konfirmasi" and rec.get("tgl_konfirmasi") == T:
                catatan.append({"tanggal": T, "kode": kode, "sumber": "rbs", "dicatat": hari_ini})
                n_rbs += 1

    hari_tercatat.append(T)
    hari_tercatat.sort()
    log["versi"] = 1
    log["mulai"] = hari_tercatat[0]
    return log, n_obv, n_rbs, False


def _muat_log() -> dict:
    if LOG.exists():
        try:
            return json.loads(LOG.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"versi": 1, "mulai": None, "catatan": [], "hari_tercatat": []}


def jalankan_catat() -> None:
    bars = muat_emiten()
    T = max((d["tgl"][-1] for d in bars.values() if d["tgl"]), default=None)
    if T is None:
        print("Tak ada data OHLC termuat — nol emiten.")
        return
    rank = universe_partanggal(bars, 60)
    log, n_obv, n_rbs, sudah_ada = proses_catat(bars, rank, T, _muat_log())
    if sudah_ada:
        print(f"[{T}] sudah tercatat sebelumnya — idempoten, nol baris ditambah.")
        return
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[{T}] dicatat: {n_obv} sinyal OBV, {n_rbs} sinyal RBS (universe rank<={UNIVERSE_TOP_N}). "
          f"Log mulai {log['mulai']}, total baris catatan {len(log['catatan'])}.")


# =================================================================== --nilai
def _catat_pilihan(bars: dict[str, dict], kode: str, tanggal: str, sumber: str) -> dict | None:
    d = bars.get(kode)
    if d is None:
        return None
    idx = _idx_pada(d, tanggal)
    if idx is None:
        return None
    t5 = simulasi_trade(d, idx, "open_h1", "h5", 0.0)
    t20 = simulasi_trade(d, idx, "open_h1", "h20", 0.0)
    idx_masuk = idx + 1
    masuk = d["o"][idx_masuk] if idx_masuk < len(d["o"]) else None
    h5 = t5["return"] if t5 else None
    h20 = t20["return"] if t20 else None
    return {
        "tanggal": tanggal, "kode": kode, "sumber": sumber, "masuk": masuk,
        "h5": h5, "h20": h20, "status": "selesai" if (h5 is not None and h20 is not None) else "menunggu",
        "_trade5": t5, "_trade20": t20,
    }


def _ihsg_ret_bar(ihsg: dict | None, tgl_masuk: str, tgl_keluar: str) -> float | None:
    if not ihsg:
        return None
    tgl, c = ihsg["tgl"], ihsg["c"]
    i0, i1 = _idx_pada({"tgl": tgl}, tgl_masuk), _idx_pada({"tgl": tgl}, tgl_keluar)
    if i0 is None or i1 is None or c[i0] <= 0:
        return None
    return (c[i1] - c[i0]) / c[i0]


def _ringkas_grup(bars: dict[str, dict], ihsg: dict | None, kandidat_per_tanggal: dict[str, list[str]],
                   entries: list[dict], rng: random.Random) -> dict:
    out: dict = {"n_total": len(entries)}
    for exit_, kunci_trade in (("h5", "_trade5"), ("h20", "_trade20")):
        selesai = [e[kunci_trade] for e in entries if e[kunci_trade] is not None]
        out[f"n_selesai_{exit_}"] = len(selesai)
        rets = [t["return"] for t in selesai]
        pfs, ratas = [], []
        for _ in range(N_ULANGAN_ACAK):
            acak_rets = []
            for e in entries:
                kand = kandidat_per_tanggal.get(e["tanggal"])
                if not kand:
                    continue
                kode_r = rng.choice(kand)
                d_r = bars[kode_r]
                idx_r = _idx_pada(d_r, e["tanggal"])
                if idx_r is None:
                    continue
                t_r = simulasi_trade(d_r, idx_r, "open_h1", exit_, 0.0)
                if t_r is not None:
                    acak_rets.append(t_r["return"])
            if acak_rets:
                ratas.append(statistics.mean(acak_rets))
                pf_ = _pf(acak_rets)
                if pf_ is not None:
                    pfs.append(pf_)
        ihsg_rets = [r for r in (_ihsg_ret_bar(ihsg, t["tgl_masuk"], t["tgl_keluar"]) for t in selesai) if r is not None]
        out[exit_] = {
            "win_rate": (sum(1 for r in rets if r > 0) / len(rets)) if rets else None,
            "pf": _pf(rets),
            "rata": statistics.mean(rets) if rets else None,
            "median": statistics.median(rets) if rets else None,
            "acak_p50_pf": float(np.percentile(pfs, 50)) if pfs else None,
            "acak_p95_pf": float(np.percentile(pfs, 95)) if pfs else None,
            "acak_rata": statistics.mean(ratas) if ratas else None,
            "ihsg_rata": statistics.mean(ihsg_rets) if ihsg_rets else None,
        }
    return out


def jalankan_nilai() -> dict:
    bars = muat_emiten()
    ihsg = muat_ihsg()
    T = max((d["tgl"][-1] for d in bars.values() if d["tgl"]), default=None)
    rank = universe_partanggal(bars, 60)

    # Kandidat acak per tanggal: universe rank<=150 pada tanggal itu (sama
    # definisi dengan --catat dan bt_manusia.jalankan_resmi).
    kandidat_per_tanggal: dict[str, list[str]] = {}
    for kode, d in bars.items():
        r = rank.get(kode)
        if r is None:
            continue
        rv = r.to_numpy()
        for i, t in enumerate(d["tgl"]):
            if not np.isnan(rv[i]) and rv[i] <= UNIVERSE_TOP_N:
                kandidat_per_tanggal.setdefault(t, []).append(kode)

    log = _muat_log()
    grup_def = {
        "redaksi": muat_pilihan_manusia(),
        "obv": [(c["kode"], c["tanggal"]) for c in log.get("catatan", []) if c.get("sumber") == "obv"],
        "rbs": [(c["kode"], c["tanggal"]) for c in log.get("catatan", []) if c.get("sumber") == "rbs"],
    }

    rng = random.Random(221)
    sumber_out: dict = {}
    semua_pilihan: list[dict] = []
    for nama, daftar in grup_def.items():
        entries = [rec for rec in (_catat_pilihan(bars, kode, tanggal, nama) for kode, tanggal in daftar) if rec is not None]
        semua_pilihan.extend(entries)
        sumber_out[nama] = _ringkas_grup(bars, ihsg, kandidat_per_tanggal, entries, rng)

    semua_pilihan.sort(key=lambda r: r["tanggal"])
    pilihan_bersih = [{k: v for k, v in r.items() if not k.startswith("_")} for r in semua_pilihan[-N_PILIHAN_LAYAR:]]

    riset = None
    if RISET.exists():
        try:
            riset = json.loads(RISET.read_text(encoding="utf-8"))
        except Exception:
            riset = None

    hasil = {
        "diperbarui": datetime.now().isoformat(timespec="seconds"),
        "data_per": T,
        # Tanggal T pertama yang pernah dicatat --catat (log_sinyal.json
        # "mulai") — dibawa serta supaya halaman bisa mengatakan sejak kapan
        # sinyal mesin mulai dicatat, tanpa menyalin isi log itu sendiri.
        "mulai": log.get("mulai"),
        "sumber": sumber_out,
        "pilihan": pilihan_bersih,
        "riset": riset,
    }
    NILAI.parent.mkdir(parents=True, exist_ok=True)
    NILAI.write_text(json.dumps(hasil, ensure_ascii=False, default=str, indent=1), encoding="utf-8")

    print(f"data_per={T} · log mulai {log.get('mulai')}")
    for nama, g in sumber_out.items():
        print(f"  {nama:<8} n_total={g['n_total']:<4} selesai_h5={g['n_selesai_h5']:<4} selesai_h20={g['n_selesai_h20']:<4} "
              f"pf_h5={g['h5']['pf']} pf_h20={g['h20']['pf']}")
    print(f"  pilihan (60 terbaru, layar): {len(pilihan_bersih)}")
    print(f"  riset: {'ada' if riset is not None else 'null — belum ditulis riset #221 lain'}")
    return hasil


# ====================================================================== uji
def uji_bawaan() -> int:
    n_ok = n_total = 0

    def cek(ok: bool, label: str) -> None:
        nonlocal n_ok, n_total
        n_total += 1
        n_ok += 1 if ok else 0
        print(("  [ok] " if ok else "  [GAGAL] ") + label)

    # 1. Idempotensi --catat: kedua panggilan dengan T sama, hanya yang
    #    pertama menambah baris.
    tgl = [f"2021-01-{1+i:02d}" if i < 31 else f"2021-02-{1+i-31:02d}" for i in range(90)]
    c = [100.0 + i * 0.3 for i in range(90)]
    bars = {
        "AAA": {"kode": "AAA", "tgl": tgl, "o": c, "h": [x + 1 for x in c], "l": [x - 1 for x in c], "c": c,
                "value": [1e9] * 90, "freq": [500.0] * 90, "fb": [0.0] * 90, "fs": [0.0] * 90, "lot": [1000.0] * 90},
        "BBB": {"kode": "BBB", "tgl": tgl, "o": c, "h": [x + 1 for x in c], "l": [x - 1 for x in c], "c": c,
                "value": [1e9] * 90, "freq": [500.0] * 90, "fb": [0.0] * 90, "fs": [0.0] * 90, "lot": [1000.0] * 90},
    }
    rank = universe_partanggal(bars, 60)
    T = tgl[-1]
    log_kosong = {"versi": 1, "mulai": None, "catatan": [], "hari_tercatat": []}
    log1, n_obv1, n_rbs1, sudah1 = proses_catat(bars, rank, T, log_kosong)
    log2, n_obv2, n_rbs2, sudah2 = proses_catat(bars, rank, T, log1)
    cek(sudah1 is False and sudah2 is True, "panggilan pertama menulis, kedua idempoten (T sama)")
    cek(len(log2["catatan"]) == len(log1["catatan"]) and n_obv2 == 0 and n_rbs2 == 0, "panggilan kedua nol baris ditambah")
    cek(log1["hari_tercatat"] == [T] and log1["mulai"] == T, "hari_tercatat & mulai tercatat benar")

    # 2. status 'menunggu': deret pendek, h20 belum bisa dihitung tapi h5 bisa.
    tgl_pendek = [f"2022-01-{1+i:02d}" for i in range(10)]
    c_pendek = [100.0 + i for i in range(10)]
    d_pendek = {"o": c_pendek, "h": c_pendek, "l": c_pendek, "c": c_pendek, "tgl": tgl_pendek}
    rec = _catat_pilihan({"AAA": d_pendek}, "AAA", tgl_pendek[0], "redaksi")
    cek(rec is not None and rec["h5"] is not None and rec["h20"] is None and rec["status"] == "menunggu",
        "bar tak cukup untuk H+20 -> status menunggu, H+5 tetap terisi")

    # 3. pf/acak dari data rekaan: satu entri nyata dengan return positif
    #    jelas, dibandingkan N_ULANGAN_ACAK ulangan acak dari kandidat yang sama.
    tgl_panjang = [f"2020-{(1+i//28):02d}-{(1+i%28):02d}" for i in range(60)]
    c_naik = [100.0 * (1.01 ** i) for i in range(60)]
    d_naik = {"o": c_naik, "h": c_naik, "l": c_naik, "c": c_naik, "tgl": tgl_panjang}
    bars_r = {"AAA": d_naik, "BBB": d_naik}
    kandidat = {t: ["AAA", "BBB"] for t in tgl_panjang}
    e = _catat_pilihan(bars_r, "AAA", tgl_panjang[0], "redaksi")
    assert e is not None
    ring = _ringkas_grup(bars_r, None, kandidat, [e], random.Random(221))
    cek(ring["n_total"] == 1 and ring["n_selesai_h5"] == 1 and ring["n_selesai_h20"] == 1,
        "satu entri rekaan, kedua horizon selesai")
    cek(ring["h5"]["rata"] is not None and ring["h5"]["rata"] > 0 and ring["h5"]["win_rate"] == 1.0,
        "deret naik monoton -> return positif, win rate 100%")
    cek(ring["h5"]["acak_rata"] is not None and abs(ring["h5"]["acak_rata"] - ring["h5"]["rata"]) < 1e-9,
        "kandidat acak identik dengan pilihan nyata (AAA==BBB) -> rata acak sama persis")
    cek(_pf([0.1, 0.2, -0.1]) is not None and abs(_pf([0.1, 0.2, -0.1]) - 3.0) < 1e-9, "_pf: 0,3 menang / 0,1 kalah = 3,0")
    cek(_pf([0.1, 0.2]) is None, "_pf: nol kalah -> None (bukan infinity)")

    print(f"{n_ok}/{n_total} lulus")
    return 0 if n_ok == n_total else 1


# ======================================================================= cli
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--catat", action="store_true")
    ap.add_argument("--nilai", action="store_true")
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        return uji_bawaan()
    if a.catat:
        jalankan_catat()
        return 0
    if a.nilai:
        jalankan_nilai()
        return 0
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
