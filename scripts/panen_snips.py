"""Panen arsip Stockbit Snips (12 bulan) → data-idx/json/snips.json.

Beda dari `scripts/panen_kabar.py`: kabar.json itu jendela geser 7 hari yang
ditimpa tiap panen. Arsip Snips justru mau disimpan LAMA (1 tahun) supaya
enak ditelusuri ke belakang — makanya berkasnya dipisah, biar retensi 7 hari
kabar.json tidak diam-diam membuang arsip yang memang mau disimpan panjang.

Situsnya (`snips.stockbit.com`) dibangun di atas Squarespace. Tak ada RSS
(`/feed`, `/rss` semua 404), tapi tiap halaman koleksi menjawab JSON kalau
diberi `?format=json` — API bawaan Squarespace, bukan endpoint rahasia.
Paginasinya pakai `offset=<publishOn epoch-ms milik item terakhir>`, dibalas
lewat `pagination.nextPageOffset` di badan JSON. Diuji 16 Agustus 2026:
`https://snips.stockbit.com/sitemap.xml` (200) menunjukkan koleksi
`snips-terbaru` sebagai arsip utama — sekitar 0,75 tulisan/hari, jadi 1 tahun
cuma ±270 item / ~15 halaman, ringan untuk dipanen.

Yang disimpan hanya METADATA: judul, tautan, waktu. Isi tulisannya (field
`body`/`excerpt` di JSON) sengaja TIDAK disalin — kita menunjuk ke sumbernya,
bukan menyiarkan ulang.

Pakai:
  python scripts/panen_snips.py            # tulis data-idx/json/snips.json
  python scripts/panen_snips.py --hari 30  # arsip lebih pendek, buat uji cepat
"""
from __future__ import annotations

import argparse
import html
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

AKAR = Path(__file__).resolve().parent.parent
KELUARAN = AKAR / "data-idx" / "json" / "snips.json"
WIB = timezone(timedelta(hours=7))
KOLEKSI = "https://snips.stockbit.com/snips-terbaru"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HEADER = {"User-Agent": UA}

SESI = requests.Session()


def ambil_halaman(offset: int | None, percobaan: int = 0) -> dict | None:
    """GET satu halaman koleksi; backoff eksponensial kalau kena 429/5xx.

    Satu halaman gagal (setelah backoff habis) menghentikan paginasi tapi
    TIDAK menggagalkan seluruh panen — apa yang sudah terkumpul tetap dipakai
    (lihat `panen()`), sama seperti prinsip `ambil()` di panen_kabar.py.
    """
    url = f"{KOLEKSI}?format=json"
    if offset is not None:
        url += f"&offset={offset}"
    try:
        r = SESI.get(url, headers=HEADER, timeout=45)
        if r.status_code in (429, 500, 502, 503, 504) and percobaan < 3:
            tunggu = 2 ** (percobaan + 1)
            print(f"  ! {r.status_code}, tunggu {tunggu}s…", file=sys.stderr)
            time.sleep(tunggu)
            return ambil_halaman(offset, percobaan + 1)
        r.raise_for_status()
        return r.json()
    except Exception as e:  # noqa: BLE001 — sengaja menangkap semuanya
        print(f"  ! gagal ambil halaman (offset={offset}) — {e}", file=sys.stderr)
        return None


def waktu_wib(ms: int | None) -> str | None:
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=WIB).isoformat()


def panen(hari: int) -> list[dict]:
    batas = (datetime.now(WIB) - timedelta(days=hari)).isoformat()
    hasil: list[dict] = []
    offset, halaman = None, 0
    while True:
        halaman += 1
        data = ambil_halaman(offset)
        if not data:
            break
        items = data.get("items") or []
        if not items:
            break
        lewat_batas = False
        for it in items:
            waktu = waktu_wib(it.get("publishOn") or it.get("addedOn"))
            if waktu and waktu < batas:
                lewat_batas = True
                continue
            judul = html.unescape((it.get("title") or "").strip())
            jalur = it.get("fullUrl") or ""
            if not judul or not jalur:
                continue
            hasil.append({
                "sumber": "Stockbit Snips",
                "jenis": "snips",
                "judul": judul,
                "tautan": "https://snips.stockbit.com" + jalur,
                "waktu": waktu,
                "emiten": [],
            })
        print(f"  halaman {halaman}: {len(items)} item (terkumpul {len(hasil)})")
        info_hal = data.get("pagination") or {}
        if lewat_batas or not info_hal.get("nextPage"):
            break
        offset = info_hal.get("nextPageOffset")
        time.sleep(0.7)  # jeda sopan — jangan gempur Squarespace-nya orang
    return hasil


def main() -> int:
    ap = argparse.ArgumentParser(description="Panen arsip Stockbit Snips")
    ap.add_argument("--hari", type=int, default=365,
                    help="rentang arsip yang disimpan, dalam hari (default 365)")
    args = ap.parse_args()

    baru = panen(args.hari)
    if not baru:
        print("Tidak ada item terpanen — berkas lama TIDAK ditimpa.", file=sys.stderr)
        return 1

    lama: list[dict] = []
    if KELUARAN.exists():
        try:
            lama = json.loads(KELUARAN.read_text(encoding="utf-8")).get("item", [])
        except Exception:  # noqa: BLE001 — berkas rusak bukan alasan gagal panen
            lama = []

    unik, terlihat = [], set()
    for it in baru + lama:
        if it["tautan"] in terlihat:
            continue
        terlihat.add(it["tautan"])
        unik.append(it)

    batas = (datetime.now(WIB) - timedelta(days=args.hari)).isoformat()
    unik = [i for i in unik if not i.get("waktu") or i["waktu"] >= batas]
    unik.sort(key=lambda i: i.get("waktu") or "", reverse=True)

    isi = {
        "diperbarui": datetime.now(WIB).isoformat(timespec="seconds"),
        "rentang_hari": args.hari,
        "item": unik,
    }
    KELUARAN.parent.mkdir(parents=True, exist_ok=True)
    KELUARAN.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK -> {KELUARAN} ({len(unik)} item)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
