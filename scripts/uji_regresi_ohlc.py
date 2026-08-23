# -*- coding: utf-8 -*-
"""Sapuan regresi SELURUH data-idx/json/ohlc/*.json sesudah ganti_volume_ohlc.py.

Membandingkan cadangan SEBELUM (_arsip-mentah/ohlc-yahoo-sebelum-ganti-volume/,
dibuat otomatis oleh ganti_volume_ohlc.py sebelum menulis) dengan berkas
SESUDAH (data-idx/json/ohlc/) — bukan sampel, seluruh 963 emiten. Aturan
proyek: membetulkan ruas hulu wajib disertai sapuan regresi seluruh berkas,
bukan cuma yang diperiksa tangan.

Untuk tiap emiten dihitung SEBELUM vs SESUDAH:
- jumlah bar, tanggal mulai/akhir, close terakhir (harus TIDAK berubah)
- total volume, rata-rata volume 20 hari terakhir
- rata-rata nilai transaksi 20 hari terakhir (volume x close) — dipakai
  backfill_broker_massal.py mengurutkan likuiditas
- berapa bar yang volumenya berubah + distribusi persen (median/p95/maks)
- berapa bar yang volumenya TURUN (mestinya mendekati nol kalau premis
  "Stockbit selalu >= Yahoo" berlaku)

Keluaran: docs/riset/regresi-ganti-volume-ohlc.md

Pemakaian:
  python scripts/uji_regresi_ohlc.py
"""
import json
import statistics
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
DIR_SESUDAH = AKAR / "data-idx" / "json" / "ohlc"
DIR_SEBELUM = AKAR / "_arsip-mentah" / "ohlc-yahoo-sebelum-ganti-volume"
LAPORAN = AKAR / "docs" / "riset" / "regresi-ganti-volume-ohlc.md"


def _p95(xs):
    if not xs:
        return 0.0
    s = sorted(xs)
    return s[min(len(s) - 1, int(round(0.95 * (len(s) - 1))))]


def rata_20h(baris_d):
    """Rata-rata volume & nilai transaksi (vol*close) 20 bar terakhir."""
    ekor = baris_d[-20:]
    if not ekor:
        return 0.0, 0.0
    vol = statistics.fmean(b[5] for b in ekor)
    nilai = statistics.fmean(b[5] * b[4] for b in ekor)
    return vol, nilai


def muat(p: Path):
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if "d" not in d or not d["d"]:
        return None
    return d


def main():
    berkas_sesudah = {p.name: p for p in DIR_SESUDAH.glob("*.json")}
    berkas_sebelum = {p.name: p for p in DIR_SEBELUM.glob("*.json")}
    bersama = sorted(set(berkas_sesudah) & set(berkas_sebelum))
    print(f"Emiten dibandingkan (ada di SEBELUM & SESUDAH): {len(bersama)}")

    pelanggaran_struktur = []   # n/tanggal/close berubah -> HARUS nol
    geser_besar = []            # (kode, pct_geser_nilai20h)
    total_baris_berubah = total_baris_turun = 0
    semua_persen = []
    n_diperiksa = 0

    for nama in bersama:
        seb = muat(berkas_sebelum[nama])
        ses = muat(berkas_sesudah[nama])
        if seb is None or ses is None:
            continue
        n_diperiksa += 1
        kode = ses.get("kode", nama[:-5])

        # --- invarian struktural: TIDAK BOLEH berubah ---
        if len(seb["d"]) != len(ses["d"]):
            pelanggaran_struktur.append(f"{kode}: n {len(seb['d'])} -> {len(ses['d'])}")
        if seb["d"][0][0] != ses["d"][0][0]:
            pelanggaran_struktur.append(f"{kode}: mulai {seb['d'][0][0]} -> {ses['d'][0][0]}")
        if seb["d"][-1][0] != ses["d"][-1][0]:
            pelanggaran_struktur.append(f"{kode}: akhir {seb['d'][-1][0]} -> {ses['d'][-1][0]}")
        if seb["d"][-1][4] != ses["d"][-1][4]:
            pelanggaran_struktur.append(
                f"{kode}: close terakhir {seb['d'][-1][4]} -> {ses['d'][-1][4]}")

        # --- volume: berubah & turun ---
        peta_seb = {b[0]: b[5] for b in seb["d"]}
        baris_berubah = baris_turun = 0
        persen_emiten = []
        for b in ses["d"]:
            vl = peta_seb.get(b[0])
            if vl is None or vl == b[5]:
                continue
            baris_berubah += 1
            if b[5] < vl:
                baris_turun += 1
            pct = abs(b[5] - vl) / vl * 100 if vl else 100.0
            persen_emiten.append(pct)
            semua_persen.append(pct)
        total_baris_berubah += baris_berubah
        total_baris_turun += baris_turun

        # --- nilai transaksi 20 hari ---
        _, nilai20_seb = rata_20h(seb["d"])
        _, nilai20_ses = rata_20h(ses["d"])
        if nilai20_seb:
            pct_geser = (nilai20_ses - nilai20_seb) / nilai20_seb * 100
            if abs(pct_geser) > 10:
                geser_besar.append((kode, pct_geser, nilai20_seb, nilai20_ses))

    geser_besar.sort(key=lambda x: -abs(x[1]))

    # --- cetak ke layar ---
    print(f"Emiten diperiksa penuh                    : {n_diperiksa}")
    print(f"Pelanggaran invarian (n/mulai/akhir/close) : {len(pelanggaran_struktur)}"
          " (HARUS 0)")
    for pl in pelanggaran_struktur[:20]:
        print(f"  - {pl}")
    print(f"Total bar volume berubah                  : {total_baris_berubah}")
    print(f"Total bar volume TURUN                    : {total_baris_turun}")
    if semua_persen:
        print(f"Persen perubahan — median {statistics.median(semua_persen):.2f}% "
              f"| p95 {_p95(semua_persen):.2f}% | maks {max(semua_persen):.2f}%")
    print(f"Emiten dgn rata2 nilai transaksi 20h bergeser >10%: {len(geser_besar)}")

    # --- tulis laporan markdown ---
    LAPORAN.parent.mkdir(parents=True, exist_ok=True)
    baris_md = []
    baris_md.append("# Regresi: ganti volume ohlc/ (Yahoo -> Stockbit)\n")
    baris_md.append(f"Emiten dibandingkan: {n_diperiksa}\n")
    baris_md.append("## Ringkasan\n")
    baris_md.append("| Ukuran | Nilai |")
    baris_md.append("|---|---|")
    baris_md.append(f"| Pelanggaran invarian struktural (harus 0) | {len(pelanggaran_struktur)} |")
    baris_md.append(f"| Total bar volume berubah | {total_baris_berubah} |")
    baris_md.append(f"| Total bar volume turun | {total_baris_turun} |")
    if semua_persen:
        baris_md.append(f"| Persen perubahan median | {statistics.median(semua_persen):.2f}% |")
        baris_md.append(f"| Persen perubahan p95 | {_p95(semua_persen):.2f}% |")
        baris_md.append(f"| Persen perubahan maks | {max(semua_persen):.2f}% |")
    baris_md.append(f"| Emiten nilai transaksi 20h bergeser >10% | {len(geser_besar)} |")
    baris_md.append("")
    if pelanggaran_struktur:
        baris_md.append("## Pelanggaran invarian struktural\n")
        for pl in pelanggaran_struktur:
            baris_md.append(f"- {pl}")
        baris_md.append("")
    baris_md.append("## Emiten dengan rata-rata nilai transaksi 20h bergeser >10%\n")
    baris_md.append("| Kode | Geser | Nilai20h sebelum | Nilai20h sesudah |")
    baris_md.append("|---|---|---|---|")
    for kode, pct, seb, ses in geser_besar:
        baris_md.append(f"| {kode} | {pct:+.1f}% | {seb:,.0f} | {ses:,.0f} |")
    LAPORAN.write_text("\n".join(baris_md) + "\n", encoding="utf-8")
    print(f"\nLaporan ditulis: {LAPORAN}")


if __name__ == "__main__":
    main()
