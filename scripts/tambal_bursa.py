# -*- coding: utf-8 -*-
"""Tambalan ujung dari arsip bursa — sisi Python.

Kembaran `app/scripts/lib/tambalBursa.mjs`; alasan, batas, dan angka
pengukurannya ditulis lengkap di sana dan tidak diulang di sini supaya tak
ada dua versi yang berbeda diam-diam. Ringkasnya:

* Arsip harga memakai kredensial dan bisa berhenti terisi tanpa satu pun galat
  — yang tertulis bar bertanggal hari ini dengan volume nol.
* Arsip bursa tidak memakai kredensial dan tetap terbit, 963 emiten per hari.
* Keduanya terukur SAMA pada hari yang dua-duanya punya: median rasio tutup
  1,000000 atas 8.976 pasang emiten-hari.
* Yang disambung HANYA hari yang arsip harga belum punya, maksimal MAKS_HARI,
  dan selalu di memori — berkas arsip tak pernah ditulis ulang.

Dipakai `scripts/riset/kartu_analisa.py`. Bentuknya sengaja "muat sekali,
sisipkan per emiten": kartu membaca 963 berkas satu per satu, dan memuat
semuanya ke memori dulu hanya untuk menambal satu hari akan menelan lebih
dari satu gigabita.
"""
from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DIR_BURSA = AKAR / "_arsip-mentah" / "asing"

#: Lebih dari ini = panen ulang sumbernya, bukan dijahit.
MAKS_HARI = 5

_NAMA = re.compile(r"^(\d{4})(\d{2})(\d{2})\.json\.gz$")


def _angka(x) -> float | None:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v else None


def bar_enam_kolom(r: dict, iso: str) -> list | None:
    """`[tanggal, buka, tinggi, rendah, tutup, volume]` — format `ohlc/`.

    Pembukaan dibiarkan None kalau bursa tak melaporkannya (terukur 28 Agu
    2026: kosong di 220 dari 833 emiten aktif). Yang membacanya wajib
    menjaganya sendiri; mengisinya nol memberi angka yang terbaca seperti
    hasil hitungan sungguhan.
    """
    tutup = _angka(r.get("Close"))
    if tutup is None:
        return None
    return [
        iso,
        _angka(r.get("OpenPrice")),
        _angka(r.get("High")) or tutup,
        _angka(r.get("Low")) or tutup,
        tutup,
        float(r.get("Volume") or 0),
    ]


def tanggal_berisi_terakhir(baris: list, i_volume: int = 5) -> str | None:
    """Tanggal bar terakhir yang BERISI — bar hantu tak bersuara."""
    if not baris:
        return None
    i = len(baris) - 1
    while i > 0 and not (baris[i][i_volume] if len(baris[i]) > i_volume else 0):
        i -= 1
    return baris[i][0] if baris[i] else None


def tanggal_berisi_di_dir(dir_ohlc: Path, ruas: str = "d", i_volume: int = 5,
                          n_sampel: int = 60) -> str | None:
    """Sampai tanggal berapa direktori arsip harga benar-benar berisi (modus).

    Modus atas 60 berkas, bukan atas semuanya: yang dicari tanggal yang
    dimiliki hampir semua emiten, bukan yang langka — dan 60 sudah kokoh
    untuk itu, sementara 963 berkas mahal dibaca dua kali.
    """
    if not dir_ohlc.exists():
        return None
    hitung: dict[str, int] = {}
    for p in sorted(dir_ohlc.glob("*.json"))[:n_sampel]:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        baris = d.get(ruas) if isinstance(d, dict) else None
        if not baris:
            continue
        t = tanggal_berisi_terakhir(baris, i_volume)
        if t:
            hitung[t] = hitung.get(t, 0) + 1
    return max(hitung.items(), key=lambda kv: kv[1])[0] if hitung else None


def muat_tambalan(punya_sampai: str | None, ke_bar=bar_enam_kolom,
                  lapor=print) -> tuple[list[str], dict[str, list]]:
    """Bar arsip bursa yang lebih muda daripada `punya_sampai`, per emiten.

    Mengembalikan `(tanggal_ditambal, {kode: [bar, ...]})`.
    """
    if not punya_sampai or not DIR_BURSA.exists():
        return [], {}

    kandidat: list[tuple[str, Path]] = []
    for th in DIR_BURSA.iterdir():
        if not th.is_dir() or not re.fullmatch(r"\d{4}", th.name):
            continue
        for f in th.iterdir():
            m = _NAMA.match(f.name)
            if not m:
                continue
            iso = f"{m[1]}-{m[2]}-{m[3]}"
            if iso <= punya_sampai:
                continue
            # Arsip 0-baris bertanggal muda = "belum terbit", bukan hari libur.
            if f.stat().st_size < 1000:
                continue
            kandidat.append((iso, f))
    if not kandidat:
        return [], {}
    kandidat.sort()

    if len(kandidat) > MAKS_HARI:
        lapor(f"  arsip harga tertinggal {len(kandidat)} hari dari arsip bursa "
              f"({punya_sampai} -> {kandidat[-1][0]}); melewati batas tambal "
              f"{MAKS_HARI} hari, sumbernya perlu dipanen ulang bukan dijahit")
        return [], {}

    tanggal: list[str] = []
    per_kode: dict[str, list] = {}
    for iso, jalur in kandidat:
        try:
            with gzip.open(jalur, "rt", encoding="utf-8") as fh:
                rows = json.load(fh).get("data")
        except Exception as e:  # noqa: BLE001
            lapor(f"  arsip bursa {iso} tak terbaca: {e}")
            continue
        if not rows:
            continue
        n = 0
        for r in rows:
            baru = ke_bar(r, iso)
            if baru is None:
                continue
            per_kode.setdefault(r.get("StockCode"), []).append(baru)
            n += 1
        if n:
            tanggal.append(iso)
            lapor(f"  tambal {iso} dari arsip bursa: {n} emiten")
    return tanggal, per_kode


def sisipkan(baris: list, tambahan: list | None, i_volume: int = 5) -> list:
    """Sisipkan bar tambahan ke deret satu emiten, di tempat.

    Bar hantu bertanggal sama DITIMPA; bar berisi tak pernah disentuh — arsip
    yang sudah punya isinya sendiri selalu menang, jadi panen ulang berikutnya
    otomatis mengembalikan angka aslinya tanpa perlu membatalkan apa pun.
    """
    if not tambahan:
        return baris
    indeks = {r[0]: i for i, r in enumerate(baris)}
    for baru in tambahan:
        i = indeks.get(baru[0])
        if i is None:
            baris.append(baru)
        elif not (baris[i][i_volume] if len(baris[i]) > i_volume else 0):
            baris[i] = baru
    return baris


def _uji() -> None:
    """Swauji tanpa menyentuh cakram."""
    d = [["2026-08-26", 1, 1, 1, 100, 500], ["2026-08-27", 1, 1, 1, 110, 0]]
    assert tanggal_berisi_terakhir(d) == "2026-08-26", "bar hantu tak boleh menang"

    # Bar hantu ditimpa, bar berisi tidak.
    baris = [["2026-08-26", 1, 1, 1, 100, 500], ["2026-08-27", 1, 1, 1, 110, 0]]
    sisipkan(baris, [["2026-08-27", 2, 2, 2, 120, 900], ["2026-08-28", 3, 3, 3, 130, 700]])
    assert baris[1][4] == 120 and baris[1][5] == 900, "bar hantu wajib ditimpa"
    assert baris[0][4] == 100, "bar berisi tak boleh disentuh"
    assert baris[2][0] == "2026-08-28", "hari baru wajib ditambahkan"

    # Pembukaan kosong tetap None — bukan nol.
    b = bar_enam_kolom({"Close": 100, "High": 0, "Low": 0, "Volume": 5, "OpenPrice": 0}, "2026-08-28")
    assert b[1] is None, "pembukaan kosong wajib None, bukan 0"
    assert b[2] == 100 and b[3] == 100, "tinggi/rendah kosong jatuh ke tutup"

    # Tanpa harga tutup tak ada yang bisa dihitung.
    assert bar_enam_kolom({"Close": 0, "Volume": 5}, "2026-08-28") is None

    print("uji tambal_bursa: LOLOS")


if __name__ == "__main__":
    _uji()
