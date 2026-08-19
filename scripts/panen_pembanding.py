# -*- coding: utf-8 -*-
"""Perah KOLOM PEMBANDING (kolom C) dari XLSX interim yang SUDAH di cakram
-> interim tahun sebelumnya di `data-idx/json/keuangan_idx/`. NOL jaringan.

Tugas D2 (19 Agu 2026, docs/riset/keputusan-stock-detail.md §1.A). Kenapa:
kedalaman kuartal diskret cuma 6 kuartal (2025-03-31 .. 2026-06-30), padahal
tiap laporan interim membawa periode pembandingnya sendiri. Dari 2.615 berkas
2025/tw1|tw2|tw3 yang sudah terarsip keluar TW1/TW2/TW3 **2024** lengkap;
audit 2024 sudah ada -> Q4'24 turunan. Hasil: 10 kuartal, tanpa satu pun
permintaan keluar.

APA YANG DIAMBIL DARI KOLOM C -- DAN APA YANG SENGAJA TIDAK
------------------------------------------------------------
Kolom C BUKAN satu periode; artinya beda per jenis sheet:

  * laba-rugi & arus kas ("...Duration")  -> periode KUMULATIF yang sama
    tahun sebelumnya. Ini yang dicari.
  * neraca ("PriorEndYearInstant")        -> posisi **31 Desember** tahun
    sebelumnya, BUKAN 31 Maret/Juni/September. Menaruhnya di slot interim
    memberi angka yang terbaca sepenuhnya wajar dan salah tanggal.

Karena itu ruas NERACA (total_assets/total_liabilities/equity/total_debt)
ditulis **null** untuk periode interim hasil skrip ini. Yang 31 Des-nya sudah
ada sebagai audit; di sini ia cuma dipakai sebagai PENGUJI SILANG.

`cash` dua jalur dan tanggalnya beda: baris neraca "Cash and cash equivalents"
(31 Des) versus baris arus kas "...cash flows, end of the period" (tanggal
interim). Terukur: TLKM/ASII/ICBP kolom C-nya identik di tw1/tw2/tw3 -- itu
jalur neraca, tanggal salah. Jadi `cash` di sini HANYA dari sheet arus kas.

Token baris konteks TIDAK dipercaya: sheet arus kas menulis
`CurrentYearDuration | PriorYearInstant` -- token kolom C-nya salah, isinya
durasi. Klasifikasinya lewat JUDUL sheet (`klasifikasi_judul`), sama seperti
pemanen utamanya.

MATA UANG. Komparatif disajikan ulang dalam mata uang penyajian berjalan
(IAS 21), jadi mata uang yang benar untuk angka kolom C adalah deklarasi
BERKAS YANG MEMUATNYA -- belum tentu mata uang yang dipakai emiten itu pada
2024. Itulah yang ditulis ke `mata_uang_laporan`. Emiten yang deklarasi
2025-nya beda dari audit 2024-nya dilaporkan (`--tulis` tetap jalan; yang
menjaga pengurangannya `turunkan_kuartal_diskret.py`, yang menolak selisih
antar mata uang berbeda).

TIDAK MENIMPA. Periode yang sudah ada dilewati -- kolom B selalu menang atas
kolom C (kolom C versi *restated*), dan nilai yang ada sudah lewat
`perbaiki_skala_keuangan.py`.

PAKAI
-----
  python scripts/panen_pembanding.py                 # kaji saja, TIDAK menulis
  python scripts/panen_pembanding.py --tulis
  python scripts/panen_pembanding.py --tahun 2025 --periode tw1 --batas 30
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

from openpyxl import load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parent))
from panen_keuangan_idx import (  # noqa: E402  -- reuse, lihat CLAUDE.md rung 2
    ARSIP_MENTAH,
    KAS_AKHIR,
    KELUARAN_DIR,
    PERIODE_AKHIR,
    cari,
    ekstrak,
    info_umum,
    peta_dari_tipe,
    simpan,
    sudah_ada,
)
from turunkan_kuartal_diskret import FIELD_ARUS  # noqa: E402

# Ruas NERACA yang kolom C-nya bertanggal 31 Des tahun lalu -- tak boleh masuk
# slot interim. `cash` tidak di sini: ia diambil ulang dari sheet arus kas.
NERACA_SALAH_TANGGAL = ["total_assets", "total_liabilities", "equity", "total_debt"]


def kas_akhir_pembanding(wb) -> float | None:
    """Kas akhir periode dari sheet ARUS KAS kolom C -- bertanggal interim,
    berbeda dari baris kas di neraca yang bertanggal 31 Des."""
    _, skala, _ = info_umum(wb)
    v = cari(peta_dari_tipe(wb, "kas", 2), KAS_AKHIR)
    try:
        return float(v) * skala if v is not None else None
    except (TypeError, ValueError):
        return None


def periode_pembanding(data_c: dict, kas_akhir: float | None) -> dict:
    """Satu catatan periode interim tahun sebelumnya dari kolom C."""
    keluar = {f: data_c.get(f) for f in FIELD_ARUS}
    for f in NERACA_SALAH_TANGGAL:
        keluar[f] = None
    keluar["cash"] = kas_akhir
    return keluar


def audit_tersimpan(kode: str, tahun_c: int) -> tuple[dict, str | None]:
    p = KELUARAN_DIR / f"{kode}.json"
    if not p.exists():
        return {}, None
    try:
        isi = json.loads(p.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}, None
    return ((isi.get("tahunan") or {}),
            (isi.get("mata_uang_laporan") or {}).get(f"{tahun_c}-12-31"))


def jalankan(tahun: int | None, periode: str | None, batas: int | None, tulis: bool,
             pecahan: tuple[int, int] | None = None) -> int:
    berkas = sorted(ARSIP_MENTAH.glob("*/*/*.xlsx"))
    dibaca = gagal = ditulis = dilewati = kosong = 0
    beda_mata_uang: list[tuple[str, str, str, str]] = []
    silang: list[tuple[str, str, float]] = []   # (kode, ruas, rasio kolomC/audit)
    silang_n = 0

    for f in berkas:
        th, per, kode = int(f.parent.parent.name), f.parent.name, f.stem.upper()
        if per == "audit" or per not in PERIODE_AKHIR:
            continue  # audit -> kolom C = setahun penuh sebelumnya, bukan interim
        if tahun and th != tahun:
            continue
        if periode and per != periode:
            continue
        if batas and dibaca >= batas:
            break
        # Pecahan dipisah per EMITEN, bukan per periode: satu berkas JSON hanya
        # boleh disentuh satu proses. Membagi per periode membuat tw1/tw2/tw3
        # menulis berkas yang sama dan saling menimpa -- tanpa satu pun galat.
        if pecahan and sum(map(ord, kode)) % pecahan[1] != pecahan[0]:
            continue
        th_c = th - 1
        tanggal = f"{th_c}-{PERIODE_AKHIR[per]}"

        try:
            wb = load_workbook(io.BytesIO(f.read_bytes()), data_only=True, read_only=True)
            data_c, currency, _kurs = ekstrak(wb, kolom=2)
            catatan = periode_pembanding(data_c, kas_akhir_pembanding(wb))
            wb.close()
        except Exception as e:  # noqa: BLE001
            gagal += 1
            print(f"  gagal {kode} {th}/{per}: {e}")
            continue
        dibaca += 1

        # --- silang-periksa: neraca kolom C (31 Des th_c) vs audit tersimpan ---
        tahunan, mu_audit = audit_tersimpan(kode, th_c)
        aud = tahunan.get(f"{th_c}-12-31") or {}
        for r in ("total_assets", "equity"):
            a, b = data_c.get(r), aud.get(r)
            if isinstance(a, (int, float)) and isinstance(b, (int, float)) and b:
                silang_n += 1
                rasio = a / b
                if not (0.95 <= rasio <= 1.05):
                    silang.append((kode, f"{r} {th_c}", rasio))
        if mu_audit and currency and mu_audit != currency:
            beda_mata_uang.append((kode, str(th_c), mu_audit, currency))

        if sum(1 for v in catatan.values() if v is not None) == 0:
            kosong += 1
            continue
        if sudah_ada(kode, tanggal, "kuartal"):
            dilewati += 1
            continue
        if tulis:
            simpan(kode, tanggal, "kuartal", catatan, currency)
        ditulis += 1

    print(f"\n{'DITULIS' if tulis else 'KAJI SAJA (tak menulis)'}: "
          f"{dibaca} berkas terbaca, {gagal} gagal, {ditulis} periode interim baru, "
          f"{dilewati} sudah ada (dilewati), {kosong} kolom C kosong")
    print(f"Silang-periksa neraca kolom C vs audit tersimpan: {silang_n} pasangan diuji, "
          f"{len(silang)} di luar +/-5%")
    for kode, ruas, rasio in silang[:15]:
        print(f"    {kode:<6} {ruas:<22} kolomC/audit = {rasio:,.4f}")
    if len(silang) > 15:
        print(f"    ... {len(silang) - 15} lagi")
    print(f"Mata uang berkas 2025 BEDA dari audit tahun pembanding: {len(beda_mata_uang)} emiten")
    for kode, th_c, a, b in beda_mata_uang[:15]:
        print(f"    {kode:<6} audit {th_c}={a}  vs berkas pembanding={b}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Perah kolom pembanding (kolom C) interim -> tahun sebelumnya")
    ap.add_argument("--tahun", type=int, default=2025, help="Tahun berkas SUMBER (default 2025)")
    ap.add_argument("--periode", choices=["tw1", "tw2", "tw3"], default=None)
    ap.add_argument("--batas", type=int, default=None)
    ap.add_argument("--tulis", action="store_true", help="Benar-benar tulis (default: kaji saja)")
    ap.add_argument("--semua-arsip", action="store_true", help="Semua tahun interim di arsip")
    ap.add_argument("--pecahan", help="i/n -- kerjakan pecahan ke-i dari n, dipisah per EMITEN "
                                      "(aman dijalankan paralel: tak ada dua proses menulis berkas sama)")
    args = ap.parse_args()
    tahun = None if args.semua_arsip else args.tahun
    pecahan = None
    if args.pecahan:
        i, n = (int(x) for x in args.pecahan.split("/"))
        pecahan = (i, n)
    return jalankan(tahun, args.periode, args.batas, args.tulis, pecahan)


def demo() -> None:
    """Swauji tanpa cakram: ruas neraca kolom C tak boleh masuk slot interim."""
    data_c = {f: 100.0 for f in FIELD_ARUS}
    data_c.update({"total_assets": 999.0, "equity": 888.0, "cash": 777.0,
                   "total_liabilities": 1.0, "total_debt": 2.0})
    hasil = periode_pembanding(data_c, 42.0)
    assert hasil["revenue"] == 100.0
    assert hasil["total_assets"] is None, "neraca kolom C bertanggal 31 Des -- jangan masuk interim"
    assert hasil["equity"] is None and hasil["total_debt"] is None
    assert hasil["cash"] == 42.0, "cash wajib dari sheet arus kas, bukan dari neraca"
    print("panen_pembanding: swauji lolos")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        demo()
    else:
        raise SystemExit(main())
