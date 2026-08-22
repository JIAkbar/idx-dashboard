# -*- coding: utf-8 -*-
"""Panen komposisi kepemilikan efek bulanan KSEI (lokal/asing × 9 jenis investor).

Johan 22 Agu 2026: *"data ini ada di IDX dan KSEI ... terus di parsing datanya"*.
Ini lapis "Peta Investor" yang dijual tradersaham — resmi, publik, gratis.

## Sumber

    https://web.ksei.co.id/archive_download/holding_composition/<tahun>   # daftar
    https://web.ksei.co.id/Download/BalanceposEfek<YYYYMMDD>.zip           # berkas

Satu zip per akhir bulan (tanggal = hari bursa terakhir bulan itu), berisi
`Balancepos<YYYYMMDD>.txt` ±3.800 baris, semua jenis efek, pemisah `|`:

    Date|Code|Type|Sec. Num|Price|Local IS|Local CP|Local PF|Local IB|Local ID|
    Local MF|Local SC|Local FD|Local OT|Total|Foreign IS|...|Foreign OT|Total

Jenis investor: IS asuransi · CP korporasi · PF dana pensiun · IB bank ·
ID perorangan · MF reksa dana · SC sekuritas · FD yayasan · OT lainnya.
Satuan LEMBAR. Diuji 22 Agu 2026: Juli 2026 terunduh, arsip tersedia sampai
Desember 2020 (2025-12-31 menjawab 404 karena akhir bulannya 30 Des, dsb —
tanggal persisnya diambil dari halaman daftar, bukan ditebak).

## Dua lapis

- `_arsip-mentah/ksei-balancepos/BalanceposEfek<YYYYMMDD>.zip` — zip utuh,
  sekali unduh selamanya (idempoten).
- `data-idx/json/kepemilikan/<KODE>.json` — deret bulanan per emiten
  (hanya `Type == EQUITY`), larik padat 18 angka + total; `index.json` memuat
  daftar bulan yang tersedia.

Pakai:
    python scripts/panen_ksei_balancepos.py            # semua tahun 2020→kini
    python scripts/panen_ksei_balancepos.py --tahun 2026
    python scripts/panen_ksei_balancepos.py --uji
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
AKAR = Path(__file__).resolve().parent.parent
ARSIP = AKAR / "_arsip-mentah" / "ksei-balancepos"
KELUARAN = AKAR / "data-idx" / "json" / "kepemilikan"
WIB = timezone(timedelta(hours=7))
DASAR = "https://web.ksei.co.id"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
JENIS = ["IS", "CP", "PF", "IB", "ID", "MF", "SC", "FD", "OT"]
KOLOM = ["lembar_tercatat", "harga"] + [f"lokal_{j}" for j in JENIS] + ["lokal_total"] + \
        [f"asing_{j}" for j in JENIS] + ["asing_total"]
KETERANGAN = {"IS": "asuransi", "CP": "korporasi", "PF": "dana pensiun", "IB": "bank",
              "ID": "perorangan", "MF": "reksa dana", "SC": "sekuritas", "FD": "yayasan", "OT": "lainnya"}


def daftar_berkas(tahun: int) -> list[str]:
    import requests

    r = requests.get(f"{DASAR}/archive_download/holding_composition/{tahun}",
                     headers={"User-Agent": UA}, timeout=60)
    r.raise_for_status()
    return sorted(set(re.findall(r"BalanceposEfek(\d{8})\.zip", r.text)))


def kandidat_akhir_bulan(tahun: int) -> list[list[str]]:
    """Untuk tiap bulan: tanggal akhir bulan lalu mundur sampai 6 hari — berkas
    KSEI bertanggal hari bursa terakhir (29 Mei, 30 Des, 28 Nov...), dan halaman
    daftar hanya memuat ±3 tahun terakhir walau berkas lama masih bisa diunduh."""
    import calendar
    keluar = []
    for b in range(1, 13):
        akhir = datetime(tahun, b, calendar.monthrange(tahun, b)[1])
        keluar.append([(akhir - timedelta(days=i)).strftime("%Y%m%d") for i in range(0, 7)])
    return keluar


def unduh(tgl: str) -> Path:
    import requests

    p = ARSIP / f"BalanceposEfek{tgl}.zip"
    if p.exists() and p.stat().st_size > 0:
        return p
    r = requests.get(f"{DASAR}/Download/BalanceposEfek{tgl}.zip", headers={"User-Agent": UA}, timeout=120)
    if r.status_code != 200 or not r.content.startswith(b"PK"):
        raise RuntimeError(f"{tgl}: HTTP {r.status_code}, bukan zip")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(r.content)
    return p


def _angka(v: str) -> float:
    try:
        return float(v.strip() or 0)
    except ValueError:
        return 0.0


def urai(zip_bytes: bytes) -> tuple[str, dict[str, list[float]]]:
    """zip -> (tanggal ISO, {kode: [lembar_tercatat, harga, lokal×9, lokal_total, asing×9, asing_total]})
    hanya EQUITY. Tanggal dibaca dari kolom Date baris pertama, bukan nama berkas."""
    z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    teks = z.read(z.namelist()[0]).decode("utf-8", errors="replace").splitlines()
    kepala = [k.strip() for k in teks[0].split("|")]
    assert kepala[:5] == ["Date", "Code", "Type", "Sec. Num", "Price"], f"kepala berubah: {kepala[:5]}"
    assert len(kepala) == 25, f"jumlah kolom berubah: {len(kepala)}"
    tgl_iso = None
    keluar: dict[str, list[float]] = {}
    for baris in teks[1:]:
        b = baris.split("|")
        if len(b) != 25 or b[2].strip() != "EQUITY":
            continue
        if tgl_iso is None:
            tgl_iso = datetime.strptime(b[0].strip(), "%d-%b-%Y").strftime("%Y-%m-%d")
        keluar[b[1].strip().upper()] = [_angka(x) for x in b[3:25]]
    return tgl_iso or "", keluar


def bangun_keluaran(per_bulan: dict[str, dict[str, list[float]]]) -> int:
    per_kode: dict[str, dict[str, list[float]]] = defaultdict(dict)
    for tgl, baris in per_bulan.items():
        for kode, v in baris.items():
            per_kode[kode][tgl] = [round(x) for x in v]
    KELUARAN.mkdir(parents=True, exist_ok=True)
    for kode, bulan in per_kode.items():
        (KELUARAN / f"{kode}.json").write_text(json.dumps({
            "kode": kode, "kolom": KOLOM, "satuan": "lembar", "jenis": KETERANGAN,
            "sumber": "KSEI Balancepos (Kepemilikan Efek Lokal-Asing), akhir bulan",
            "bulan": {t: bulan[t] for t in sorted(bulan)},
        }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (KELUARAN / "index.json").write_text(json.dumps({
        "bulan": sorted(per_bulan), "n_emiten": len(per_kode),
        "diperbarui": datetime.now(WIB).isoformat(timespec="seconds"),
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return len(per_kode)


def jalankan(tahun_semua: list[int], jeda: float = 1.0) -> int:
    per_bulan: dict[str, dict] = {}
    # Arsip yang sudah ada dibaca dulu — nol jaringan untuk bulan lama.
    for p in sorted(ARSIP.glob("BalanceposEfek*.zip")):
        tgl, baris = urai(p.read_bytes())
        if tgl:
            per_bulan[tgl] = baris
    baru = 0
    for th in tahun_semua:
        try:
            daftar = daftar_berkas(th)
        except Exception as e:  # noqa: BLE001 — halaman daftar KSEI sering 500; berkasnya sendiri tetap ada
            print(f"{th}: daftar gagal ({e}) — memakai tebakan akhir bulan")
            daftar = []
        ada_bulan = {d[:6] for d in daftar}
        rencana: list[list[str]] = [[d] for d in daftar]
        # Bulan yang tak ada di daftar (tahun lama) dicoba lewat tebakan akhir bulan.
        kini = datetime.now(WIB)
        for kandidat in kandidat_akhir_bulan(th):
            if kandidat[0][:6] in ada_bulan or kandidat[0] > kini.strftime("%Y%m%d"):
                continue
            rencana.append(kandidat)
        for kandidat in rencana:
            if any((ARSIP / f"BalanceposEfek{k}.zip").exists() for k in kandidat):
                continue
            for tgl8 in kandidat:
                try:
                    p = unduh(tgl8)
                except Exception:  # noqa: BLE001 — tanggal ini bukan hari bursa terakhir, coba mundur
                    time.sleep(0.3)
                    continue
                tgl, baris = urai(p.read_bytes())
                per_bulan[tgl] = baris
                baru += 1
                print(f"  {tgl}: {len(baris)} emiten")
                time.sleep(jeda)
                break
            else:
                print(f"  {kandidat[0][:6]}: tak ada berkas di 7 hari terakhir bulan itu")
    n = bangun_keluaran(per_bulan)
    print(f"Selesai: {len(per_bulan)} bulan ({baru} baru diunduh), {n} emiten → {KELUARAN}")
    return 0


def swauji() -> int:
    teks = ("Date|Code|Type|Sec. Num|Price|Local IS|Local CP|Local PF|Local IB|Local ID|Local MF|Local SC|Local FD|Local OT|Total|"
            "Foreign IS|Foreign CP|Foreign PF|Foreign IB|Foreign ID|Foreign MF|Foreign SC|Foreign FD|Foreign OT|Total\n"
            "31-JUL-2026|UJI|EQUITY|1000|150|1|2|3|4|5|6|7|8|9|45|10|20|30|40|50|60|70|80|90|450\n"
            "31-JUL-2026|OBL1|CORPORATE BOND|5|100|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0\n")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("Balancepos20260731.txt", teks)
    tgl, baris = urai(buf.getvalue())
    assert tgl == "2026-07-31" and list(baris) == ["UJI"], (tgl, list(baris))
    v = baris["UJI"]
    assert v[0] == 1000 and v[1] == 150 and v[2:11] == [1, 2, 3, 4, 5, 6, 7, 8, 9] and v[11] == 45
    assert v[12:21] == [10, 20, 30, 40, 50, 60, 70, 80, 90] and v[21] == 450
    assert len(KOLOM) == 22 == len(v)
    print("4/4 lulus")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tahun", type=int, nargs="*")
    ap.add_argument("--uji", action="store_true")
    a = ap.parse_args()
    if a.uji:
        raise SystemExit(swauji())
    raise SystemExit(jalankan(a.tahun or list(range(2020, datetime.now(WIB).year + 1))))
