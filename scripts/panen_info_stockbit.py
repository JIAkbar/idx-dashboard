# -*- coding: utf-8 -*-
"""Panen info (harga hari ini, keanggotaan indeks, sektor, notasi) per emiten dari Stockbit.

Endpoint `GET /emitten/{kode}/info?with_sub_industry=true` — snapshot terkini.
Rincian ruas: `docs/riset/stockbit-inventaris-endpoint.md` baris 19.

Seluruh ruas yang endpoint berikan DISIMPAN apa adanya (`indexes`, `sector`,
`sub_sector`, `industry`, `sub_industry`, `notation`, `uma`, `orderbook`,
`day_trade_info`, dst.) — bukan memilih sebagian lalu membuang sisanya
(kesalahan itu pernah terjadi di proyek ini dan mahal, lihat CLAUDE.md "Ruas
salinan yfinance").

Tambahan: `data-idx/json/info_stockbit/_indeks.json`, ringkasan datar lintas
emiten (kode -> daftar indeks yang diikuti, kode -> sektor/industri/notasi)
untuk dipakai screener tanpa menelusuri satu berkas per emiten. Ditulis ulang
dari SELURUH berkas yang ada di `info_stockbit/` tiap kali skrip jalan (bukan
cuma emiten yang baru dipanen kali ini), supaya tetap konsisten walau
dijalankan bertahap per batch.

## Arsip mentah

Balasan JSON apa adanya ke `_arsip-mentah/info-stockbit/<KODE>/<tanggal-
panen>.json` (di luar git). Arsip hari ini yang sudah ada dipakai ulang
kecuali `--paksa`.

Pakai:
    python scripts/panen_info_stockbit.py BBCA BUMI AADI
    python scripts/panen_info_stockbit.py --semua --jeda 0.4
    python scripts/panen_info_stockbit.py BBCA --paksa
    python scripts/panen_info_stockbit.py --swauji
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
KELUARAN = DIR_JSON / "info_stockbit"
INDEKS = KELUARAN / "_indeks.json"
ARSIP = AKAR / "_arsip-mentah" / "info-stockbit"
WIB = timezone(timedelta(hours=7))

URL = "https://exodus.stockbit.com/emitten/{kode}/info"


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
    """Balasan info -> keluaran: salinan penuh `data`, apa adanya."""
    return dict((mentah or {}).get("data") or {})


def verifikasi(hasil: dict) -> str | None:
    if not hasil.get("symbol"):
        return "tanpa symbol"
    return None


def baris_indeks(kode: str, hasil: dict) -> dict:
    """Ruas ringkas satu emiten untuk `_indeks.json` — datar, dipakai screener."""
    return {
        "indeks": hasil.get("indexes") or [],
        "sektor": hasil.get("sector") or "",
        "sub_sektor": hasil.get("sub_sector") or "",
        "industri": hasil.get("industry") or "",
        "sub_industri": hasil.get("sub_industry") or "",
        "notasi_khusus": hasil.get("notation") or [],
        "uma": bool(hasil.get("uma")),
    }


def bangun_indeks(hari_ini: str) -> None:
    """Sapu ulang seluruh `info_stockbit/*.json` (kecuali `_indeks.json` sendiri)."""
    peta: dict[str, dict] = {}
    if KELUARAN.exists():
        for p in sorted(KELUARAN.glob("*.json")):
            if p.name == INDEKS.name:
                continue
            isi = baca(p)
            if isi and isi.get("kode"):
                peta[isi["kode"]] = baris_indeks(isi["kode"], isi)
    tulis_ulet(INDEKS, json.dumps({
        "sumber": "Stockbit info (ringkasan)",
        "dipanen_pada": hari_ini,
        "emiten": peta,
    }, ensure_ascii=False, separators=(",", ":")))


# ── Jaringan ────────────────────────────────────────────────────────────────
def ambil(token: str, kode: str, percobaan: int = 4):
    """Ambil info satu emiten, dicoba ulang mundur-bertahap kalau jaringan
    gagal (lihat CLAUDE.md soal `RemoteDisconnected` mematikan panen ke-285)."""
    import requests

    galat = ""
    for ke in range(1, percobaan + 1):
        try:
            r = requests.get(URL.format(kode=kode), headers={
                "Authorization": f"Bearer {token}", "Origin": "https://stockbit.com",
                "Referer": "https://stockbit.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }, params={"with_sub_industry": "true"}, timeout=60)
            return r.status_code, (r.json() if r.status_code == 200 else r.text[:200])
        except Exception as e:  # noqa: BLE001 — jaringan apa pun
            galat = f"{type(e).__name__}: {str(e)[:100]}"
            if ke < percobaan:
                time.sleep(min(30.0, 2 ** ke))
    return 0, f"jaringan gagal {percobaan}x — {galat}"


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
        print(f"Panen info Stockbit {hari_ini} — {len(kode_semua)} emiten, jeda {a.jeda}s")

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
            "sumber": "Stockbit info",
            "dipanen_pada": hari_ini,
            **hasil,
        }, ensure_ascii=False, separators=(",", ":")))
        n_ok += 1
        if i % 100 == 0:
            print(f"  ...{i}/{len(kode_semua)} ({time.time()-mulai:.0f}s)")

    bangun_indeks(hari_ini)
    print(f"Selesai {time.time()-mulai:.0f}s: {n_ok} tersimpan ({n_lewat} dari arsip), {n_gagal} gagal")
    return 0 if n_ok else 1


def swauji() -> int:
    mentah = {"data": {
        "symbol": "BBCA",
        "name": "Bank Central Asia Tbk.",
        "price": "6450",
        "previous": "6400",
        "sector": "Keuangan",
        "sub_sector": "Bank",
        "industry": "",
        "sub_industry": "",
        "notation": [],
        "uma": False,
        "indexes": ["LQ45", "IDX30", "IHSG"],
    }}
    hasil = urai(mentah)
    assert hasil["symbol"] == "BBCA"
    assert hasil["indexes"] == ["LQ45", "IDX30", "IHSG"], "salinan penuh wajib tetap ada"
    assert verifikasi(hasil) is None

    assert verifikasi(urai({"data": {}})) == "tanpa symbol"
    assert verifikasi(urai({})) == "tanpa symbol"

    baris = baris_indeks("BBCA", hasil)
    assert baris["indeks"] == ["LQ45", "IDX30", "IHSG"]
    assert baris["sektor"] == "Keuangan" and baris["sub_sektor"] == "Bank"
    assert baris["uma"] is False

    # uma True dan notasi terisi tak boleh hilang jadi falsy.
    khusus = urai({"data": {"symbol": "GOTO", "uma": True, "notation": ["UMA"], "indexes": []}})
    baris2 = baris_indeks("GOTO", khusus)
    assert baris2["uma"] is True and baris2["notasi_khusus"] == ["UMA"]

    print("6/6 lulus")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen info dari Stockbit")
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
