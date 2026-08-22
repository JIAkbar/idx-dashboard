# -*- coding: utf-8 -*-
"""Panen keystats (valuasi + laporan keuangan ringkas) per emiten dari Stockbit.

Endpoint `GET /keystats/{kode}` — snapshot terkini, ±94 rasio dalam 12 grup
(valuasi, per saham, solvabilitas, profitabilitas, growth, dividen, Piotroski,
neraca, arus kas, imbal hasil) plus riwayat kuartalan `financial_year_parent`
dan ringkasan `most_recent_quarter`. Rincian: `docs/riset/
stockbit-inventaris-endpoint.md`.

Seluruh ruas yang endpoint berikan DISIMPAN apa adanya (`closure_fin_items_
results`, `financial_year_parent`, `most_recent_quarter`, `info`) — bukan
memilih sebagian lalu membuang sisanya (kesalahan itu pernah terjadi di
proyek ini dan mahal, lihat CLAUDE.md "Ruas salinan yfinance"). Ruas turunan
`rasio` (nama -> nilai, digabung dari seluruh grup) ditambahkan DI SAMPING
salinan penuhnya, untuk pembaca yang cuma butuh satu angka tanpa menelusuri
12 grup.

## Arsip mentah

Balasan JSON apa adanya ke `_arsip-mentah/keystats-stockbit/<KODE>/<tanggal-
panen>.json` (di luar git). Arsip hari ini yang sudah ada dipakai ulang
kecuali `--paksa`.

Pakai:
    python scripts/panen_keystats_stockbit.py BBCA BUMI AADI
    python scripts/panen_keystats_stockbit.py --semua --jeda 0.4
    python scripts/panen_keystats_stockbit.py BBCA --paksa
    python scripts/panen_keystats_stockbit.py --swauji
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AKAR / "scripts"))

DIR_JSON = AKAR / "data-idx" / "json"
DAFTAR = DIR_JSON / "daftar_emiten.json"
KELUARAN = DIR_JSON / "keystats_stockbit"
ARSIP = AKAR / "_arsip-mentah" / "keystats-stockbit"
WIB = timezone(timedelta(hours=7))

URL = "https://exodus.stockbit.com/keystats/{kode}"


def baca(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def tulis_ulet(p: Path, teks: str, coba: int = 5) -> None:
    for i in range(coba):
        try:
            p.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if i == coba - 1:
                raise
            time.sleep(0.5 * (i + 1))


# ── Normalisasi ─────────────────────────────────────────────────────────────
def urai(mentah: dict) -> dict:
    """Balasan keystats -> keluaran: salinan penuh + `rasio` flat DI SAMPINGnya."""
    data = (mentah or {}).get("data") or {}
    grup = data.get("closure_fin_items_results") or []
    rasio: dict[str, str] = {}
    for g in grup:
        for item in g.get("fin_name_results") or []:
            nama = item.get("fitem_name")
            if nama:
                rasio[nama] = item.get("fitem_value")
    return {
        "rasio": rasio,
        "closure_fin_items_results": grup,
        "financial_year_parent": data.get("financial_year_parent"),
        "most_recent_quarter": data.get("most_recent_quarter"),
        "info": data.get("info"),
    }


def verifikasi(hasil: dict) -> str | None:
    if not hasil.get("rasio"):
        return "nol rasio"
    return None


# ── Jaringan ────────────────────────────────────────────────────────────────
def ambil(token: str, kode: str):
    import requests

    r = requests.get(URL.format(kode=kode), headers={
        "Authorization": f"Bearer {token}", "Origin": "https://stockbit.com",
        "Referer": "https://stockbit.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }, timeout=60)
    return r.status_code, (r.json() if r.status_code == 200 else r.text[:200])


def daftar_kode(semua: bool, pilih: list[str]) -> list[str]:
    if semua:
        d = baca(DAFTAR) or {}
        return [e["kode"] for e in d.get("emiten") or [] if e.get("kode")]
    return [k.strip().upper() for k in pilih if k.strip()]


def jalankan(a) -> int:
    from stockbit_token import token_segar

    kode_semua = daftar_kode(a.semua, a.kode)
    if not kode_semua:
        raise SystemExit("Tak ada emiten — beri kode atau --semua.")
    hari_ini = datetime.now(WIB).strftime("%Y-%m-%d")
    token = token_segar()
    if len(kode_semua) > 1:
        print(f"Panen keystats Stockbit {hari_ini} — {len(kode_semua)} emiten, jeda {a.jeda}s")

    n_ok = n_lewat = n_gagal = 0
    mulai = time.time()
    for i, kode in enumerate(kode_semua, 1):
        ark = ARSIP / kode / f"{hari_ini}.json"
        if ark.exists() and not a.paksa:
            mentah = baca(ark)
            n_lewat += 1
        else:
            st, isi = ambil(token, kode)
            if st == 401:
                token = token_segar(margin=10**9)
                st, isi = ambil(token, kode)
            if st == 429:
                print(f"  {kode}: 429 — jeda 30 detik")
                time.sleep(30)
                st, isi = ambil(token, kode)
            if st != 200:
                n_gagal += 1
                print(f"  {kode}: HTTP {st} {str(isi)[:80]}")
                time.sleep(a.jeda)
                continue
            mentah = isi
            ark.parent.mkdir(parents=True, exist_ok=True)
            tulis_ulet(ark, json.dumps(mentah, ensure_ascii=False))
            time.sleep(a.jeda)

        hasil = urai(mentah)
        alasan = verifikasi(hasil)
        if alasan:
            n_gagal += 1
            print(f"  {kode}: verifikasi gagal — {alasan}")
            continue

        out = KELUARAN / f"{kode}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        tulis_ulet(out, json.dumps({
            "kode": kode,
            "sumber": "Stockbit keystats",
            "dipanen_pada": hari_ini,
            **hasil,
        }, ensure_ascii=False, separators=(",", ":")))
        n_ok += 1
        if i % 100 == 0:
            print(f"  ...{i}/{len(kode_semua)} ({time.time()-mulai:.0f}s)")

    print(f"Selesai {time.time()-mulai:.0f}s: {n_ok} tersimpan ({n_lewat} dari arsip), {n_gagal} gagal")
    return 0 if n_ok else 1


def swauji() -> int:
    mentah = {"data": {
        "closure_fin_items_results": [
            {"fin_name_results": [
                {"fitem_id": "12148", "fitem_name": "Current PE Ratio (Annualised)", "fitem_value": "13.46"},
                {"fitem_id": "2891", "fitem_name": "Current PE Ratio (TTM)", "fitem_value": "13.70"},
            ]},
            {"fin_name_results": [
                {"fitem_id": "9", "fitem_name": "ROE", "fitem_value": "21.8%"},
            ]},
        ],
        "financial_year_parent": [{"financial_year_groups": []}],
        "most_recent_quarter": {"date": "30 Jun 2026", "quarter": "Q2"},
        "info": "",
    }}
    hasil = urai(mentah)
    assert hasil["rasio"]["Current PE Ratio (TTM)"] == "13.70"
    assert hasil["rasio"]["ROE"] == "21.8%"
    assert len(hasil["rasio"]) == 3, "dua grup harus digabung jadi satu peta rasio"
    assert hasil["closure_fin_items_results"] == mentah["data"]["closure_fin_items_results"], \
        "salinan penuh grup wajib tetap ada di samping ruas turunan"
    assert hasil["most_recent_quarter"]["quarter"] == "Q2"
    assert verifikasi(hasil) is None

    assert verifikasi(urai({"data": {}})) == "nol rasio"
    assert verifikasi(urai({})) == "nol rasio"

    # Ruas kosong pada satu item (nama tanpa nilai) tak boleh menjatuhkan skrip.
    aneh = {"data": {"closure_fin_items_results": [
        {"fin_name_results": [{"fitem_id": "1", "fitem_name": "X", "fitem_value": None}]}
    ]}}
    hasil2 = urai(aneh)
    assert hasil2["rasio"]["X"] is None and verifikasi(hasil2) is None

    print("6/6 lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen keystats dari Stockbit")
    ap.add_argument("kode", nargs="*", help="kode emiten, mis. BBCA BUMI AADI")
    ap.add_argument("--semua", action="store_true", help="seluruh daftar_emiten.json")
    ap.add_argument("--jeda", type=float, default=0.4, help="detik antar permintaan")
    ap.add_argument("--paksa", action="store_true", help="abaikan arsip hari ini, tarik ulang")
    ap.add_argument("--swauji", action="store_true")
    a = ap.parse_args()
    if a.swauji:
        return swauji()
    return jalankan(a)


if __name__ == "__main__":
    raise SystemExit(main())
