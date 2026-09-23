# -*- coding: utf-8 -*-
"""Ringkasan broker harian — bagian D spek #231 (Peta Pasar Hidup + Kartu Pagi).

Sumber TUNGGAL: `data-idx/json/broker_tahunan/<KODE>/<TAHUN>.json`. Kelompok
broker dibaca langsung dari `app/src/lib/dasbor/kelompokBroker.ts` (bukan
disalin tangan — kode tak terdaftar jatuh ke 'lain'). Sektor dari
`data-idx/json/emiten_sektor.json`.

Keluaran:
- `data-idx/json/peta_arus.json` — net rupiah per kelompok broker, per sektor,
  untuk T / 5 hari / 20 hari bursa terakhir.
- `data-idx/json/broker_puncak/<KODE>.json` — 10 hari terakhir per emiten:
  accdist, total nilai, 3 net beli terbesar, 3 net jual terbesar.

Jalankan:
    python scripts/riset/ringkas_broker_harian.py --uji     # uji bawaan
    python scripts/riset/ringkas_broker_harian.py --tulis   # tulis sungguhan
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
BASE_BROKER = AKAR / "data-idx" / "json" / "broker_tahunan"
BERKAS_SEKTOR = AKAR / "data-idx" / "json" / "emiten_sektor.json"
BERKAS_KELOMPOK_TS = AKAR / "app" / "src" / "lib" / "dasbor" / "kelompokBroker.ts"
KELUARAN_PETA = AKAR / "data-idx" / "json" / "peta_arus.json"
KELUARAN_PUNCAK = AKAR / "data-idx" / "json" / "broker_puncak"

KELOMPOK = ["asing", "bumn", "smart", "ritel", "afiliasi", "lain"]
N_PUNCAK_HARI = 10
N_TOP = 3


# ---------------------------------------------------------------- sumber ---

def baca_kelompok(path: Path = BERKAS_KELOMPOK_TS) -> dict[str, str]:
    """Kode broker -> kelompok, diparse dari KURASI di kelompokBroker.ts."""
    teks = path.read_text(encoding="utf-8")
    m = re.search(r"const KURASI[^{]*\{(.*?)\n\}", teks, re.S)
    if not m:
        raise RuntimeError(f"blok KURASI tak ditemukan di {path}")
    hasil: dict[str, str] = {}
    for kode, kelompok in re.findall(r"\b([A-Z]{1,3}):\s*\[\s*'(\w+)'", m.group(1)):
        hasil[kode] = kelompok
    return hasil


def baca_sektor(path: Path = BERKAS_SEKTOR) -> dict[str, str]:
    d = json.loads(path.read_text(encoding="utf-8"))
    return {k: v.get("sektor") or "Tanpa sektor" for k, v in d.get("emiten", {}).items()}


def daftar_kode(base: Path = BASE_BROKER) -> list[str]:
    return sorted(p.name for p in base.iterdir() if p.is_dir())


def muat_emiten(kode: str, n_simpan: int = 25, base: Path = BASE_BROKER) -> list[tuple[str, dict]]:
    """(tanggal, hari-record) 25 hari terakhir milik `kode`, urut turun. Kosong bila tak ada berkas."""
    tahun_ada = sorted((int(p.stem) for p in (base / kode).glob("[0-9][0-9][0-9][0-9].json")), reverse=True)
    if not tahun_ada:
        return []
    d = json.loads((base / kode / f"{tahun_ada[0]}.json").read_text(encoding="utf-8"))
    hari = d.get("hari", {})
    tanggal = sorted(hari.keys(), reverse=True)[:n_simpan]
    return [(t, hari[t]) for t in tanggal]


# ------------------------------------------------------------- perhitungan ---

def net_per_broker(hari_record: dict) -> list[list]:
    """[[broker, net], ...] dari baris `broker` sehari — net = beli_nilai - jual_nilai."""
    return [[b[0], b[2] - b[4]] for b in hari_record.get("broker", [])]


def puncak_hari(hari_record: dict) -> tuple[list, list]:
    net = net_per_broker(hari_record)
    beli = sorted(net, key=lambda x: -x[1])[:N_TOP]
    jual = sorted(net, key=lambda x: x[1])[:N_TOP]
    return beli, jual


def agg_kelompok(net: list[list], kelompok_map: dict[str, str]) -> dict[str, float]:
    total = dict.fromkeys(KELOMPOK, 0.0)
    for broker, n in net:
        total[kelompok_map.get(broker, "lain")] += n
    return total


def bangun_peta_arus(
    data_per_kode: dict[str, list[tuple[str, dict]]],
    kelompok_map: dict[str, str],
    sektor_map: dict[str, str],
) -> dict:
    """Fungsi murni (tak menyentuh berkas) — dites langsung dengan data sintetis."""
    tanggal_akhir = {k: v[0][0] for k, v in data_per_kode.items() if v}
    if not tanggal_akhir:
        raise RuntimeError("tak ada emiten dengan data broker")
    T = Counter(tanggal_akhir.values()).most_common(1)[0][0]
    # Cakupan = emiten yang PUNYA data pada T (bukan yang tanggal terakhirnya T:
    # emiten yang sudah punya hari sesudah T tetap ikut dihitung di T).
    cakupan = sum(1 for v in data_per_kode.values() if any(t == T for t, _ in v))

    # kalender acuan: dates milik emiten pertama (alfabetis) yang tanggal
    # terakhirnya = T — "tanggal dari data broker itu sendiri".
    acuan_kode = next(k for k, t in sorted(tanggal_akhir.items()) if t == T)
    tanggal_acuan = [t for t, _ in data_per_kode[acuan_kode]]

    rentang_def = {"h1": tanggal_acuan[:1], "h5": tanggal_acuan[:5], "h20": tanggal_acuan[:20]}
    rentang_out: dict[str, dict] = {}
    for kunci, tgls in rentang_def.items():
        tgl_set = set(tgls)
        total = dict.fromkeys(KELOMPOK, 0.0)
        sektor: dict[str, dict] = {}
        for kode, hari_list in data_per_kode.items():
            sek = sektor_map.get(kode, "Tanpa sektor")
            for tanggal, rec in hari_list:
                if tanggal not in tgl_set:
                    continue
                net = net_per_broker(rec)
                per_kel = agg_kelompok(net, kelompok_map)
                for kel, n in per_kel.items():
                    total[kel] += n
                s = sektor.setdefault(sek, {"n_emiten": set(), "nilai": 0.0,
                                             "net": dict.fromkeys(KELOMPOK, 0.0)})
                s["n_emiten"].add(kode)
                s["nilai"] += rec.get("ringkas", {}).get("total_nilai", 0) or 0
                for kel, n in per_kel.items():
                    s["net"][kel] += n
        nilai_semua = sum(s["nilai"] for s in sektor.values()) or 1
        sektor_out = {
            nama: {
                "n_emiten": len(s["n_emiten"]),
                "nilai": s["nilai"],
                "porsi_nilai_pct": round(s["nilai"] / nilai_semua * 100, 4),
                "net": s["net"],
            }
            for nama, s in sektor.items()
        }
        rentang_out[kunci] = {
            "mulai": tgls[-1], "akhir": tgls[0], "n_hari": len(tgls),
            "total": total, "sektor": sektor_out,
        }

    return {"tanggal": T, "n_emiten": cakupan, "kelompok": KELOMPOK, "rentang": rentang_out}


def bangun_broker_puncak(kode: str, hari_list: list[tuple[str, dict]]) -> dict:
    hari_out = []
    for tanggal, rec in reversed(hari_list[:N_PUNCAK_HARI]):  # urut naik
        beli, jual = puncak_hari(rec)
        ringkas = rec.get("ringkas", {})
        hari_out.append({
            "tanggal": tanggal,
            "accdist": ringkas.get("accdist"),
            "total_nilai": ringkas.get("total_nilai"),
            "beli": beli,
            "jual": jual,
        })
    return {"kode": kode, "hari": hari_out}


# --------------------------------------------------------------- jalankan ---

def jalankan(tulis: bool = True) -> dict:
    kelompok_map = baca_kelompok()
    sektor_map = baca_sektor()
    kode_list = daftar_kode()
    data_per_kode = {k: muat_emiten(k) for k in kode_list}
    data_per_kode = {k: v for k, v in data_per_kode.items() if v}

    peta = bangun_peta_arus(data_per_kode, kelompok_map, sektor_map)
    puncak = {k: bangun_broker_puncak(k, v) for k, v in data_per_kode.items()}

    if tulis:
        KELUARAN_PETA.write_text(json.dumps(peta, ensure_ascii=False, indent=1), encoding="utf-8")
        KELUARAN_PUNCAK.mkdir(parents=True, exist_ok=True)
        for kode, d in puncak.items():
            (KELUARAN_PUNCAK / f"{kode}.json").write_text(
                json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"T={peta['tanggal']} cakupan={peta['n_emiten']}/{len(kode_list)} emiten "
          f"kode_kelompok_terbaca={len(kelompok_map)} broker_puncak={len(puncak)} berkas")
    return peta


# --------------------------------------------------------------------- uji ---

def uji_bawaan() -> None:
    # 1) kelompok dari kelompokBroker.ts — harus terbaca, bukan kosong.
    kelompok_map = baca_kelompok()
    assert len(kelompok_map) > 50, f"cuma {len(kelompok_map)} kode terbaca dari kelompokBroker.ts"
    for kel in kelompok_map.values():
        assert kel in KELOMPOK, kel
    print(f"kelompokBroker.ts: {len(kelompok_map)} kode terkurasi terbaca")

    # 2) logika agregasi — data sintetis dengan jawaban tangan.
    sintetis = {
        "AAA": [
            ("2026-01-02", {"broker": [["XA", 100, 1000, 10, 100, 1, 1, "A"],
                                        ["CC", 10, 100, 100, 1000, 1, 1, "P"]],
                             "ringkas": {"accdist": "Acc", "total_nilai": 2000}}),
        ],
        "BBB": [
            ("2026-01-02", {"broker": [["ZZZ", 5, 500, 0, 0, 1, 0, "L"]],
                             "ringkas": {"accdist": "Acc", "total_nilai": 500}}),
        ],
    }
    kelompok_uji = {"XA": "asing", "CC": "bumn"}  # ZZZ sengaja tak terdaftar -> 'lain'
    sektor_uji = {"AAA": "Energi", "BBB": "Energi"}
    peta = bangun_peta_arus(sintetis, kelompok_uji, sektor_uji)
    assert peta["tanggal"] == "2026-01-02"
    assert peta["n_emiten"] == 2
    total_h1 = peta["rentang"]["h1"]["total"]
    # AAA: XA net=1000-100=900 (asing); CC net=100-1000=-900 (bumn). BBB: ZZZ net=500-0=500 (lain).
    assert total_h1["asing"] == 900, total_h1
    assert total_h1["bumn"] == -900, total_h1
    assert total_h1["lain"] == 500, total_h1
    sek = peta["rentang"]["h1"]["sektor"]["Energi"]
    assert sek["n_emiten"] == 2 and sek["nilai"] == 2500 and sek["porsi_nilai_pct"] == 100.0
    assert sek["net"]["asing"] == 900 and sek["net"]["lain"] == 500

    puncak = bangun_broker_puncak("AAA", sintetis["AAA"])
    assert puncak["hari"][0]["beli"][0] == ["XA", 900]
    assert puncak["hari"][0]["jual"][0] == ["CC", -900]
    print("agregasi sintetis: lolos (kelompok, sektor, puncak broker cocok jawaban tangan)")

    # 3) idempoten — dua kali jalan atas data sintetis identik menghasilkan JSON sama.
    peta2 = bangun_peta_arus(sintetis, kelompok_uji, sektor_uji)
    assert json.dumps(peta, sort_keys=True) == json.dumps(peta2, sort_keys=True)
    print("idempoten: lolos (dua kali bangun_peta_arus menghasilkan JSON identik)")

    # 4) sanity Σnet ≈ 0 atas sampel data NYATA (murah — 50 emiten saja).
    if BASE_BROKER.exists():
        kode_list = daftar_kode()
        sampel = kode_list[:: max(1, len(kode_list) // 50)][:50]
        rasio = []
        for kode in sampel:
            hari_list = muat_emiten(kode, n_simpan=1)
            if not hari_list:
                continue
            _, rec = hari_list[0]
            net = net_per_broker(rec)
            total_nilai = rec.get("ringkas", {}).get("total_nilai") or 0
            if total_nilai:
                rasio.append(abs(sum(n for _, n in net)) / total_nilai)
        if rasio:
            median = statistics.median(rasio)
            assert median < 0.05, f"median |jumlah net|/total_nilai = {median} -- dugaan salah parse"
            print(f"jumlah net vs total_nilai (sampel {len(rasio)} emiten nyata): median rasio = {median:.4f}")
    else:
        print("BASE_BROKER tak ada di sini — lewati sanity data nyata (masih di worktree lain?)")

    print("uji bawaan ringkas_broker_harian: LULUS")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--uji", action="store_true")
    ap.add_argument("--tulis", action="store_true")
    a = ap.parse_args()
    if a.uji:
        uji_bawaan()
        sys.exit(0)
    if not a.tulis:
        ap.error("pilih --uji atau --tulis")
    jalankan(tulis=True)
