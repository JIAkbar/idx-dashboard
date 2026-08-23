# -*- coding: utf-8 -*-
"""Ganti ruas VOLUME di data-idx/json/ohlc/<KODE>.json (Yahoo) dengan volume
data-idx/json/ohlcv_stockbit/<KODE>.json — terbukti 100,00% identik dengan
IDX atas 7.172 baris uji, sedangkan Yahoo beda 2,66% baris (237/8.896) dan
SELALU lebih kecil. Rujukan: docs/riset/ohlc-yahoo-vs-idx.md.

Hanya ruas volume (indeks 5 di `d`) yang diganti, dan hanya untuk tanggal
yang ADA di kedua sumber. Harga (o/h/l/c), rentang tanggal (`mulai`/`akhir`),
dan jumlah bar (`n`) TIDAK disentuh — riwayat Stockbit yang lebih panjang
sengaja tidak dipakai memperpanjang berkas (lihat CLAUDE.md / instruksi
tugas: `ohlc/` masuk git, memperpanjang bikin ~360 MB, itu keputusan Johan
yang belum diambil).

Idempoten: berjangkar pada ohlcv_stockbit/ (sumber terpisah dari ohlc/),
bukan menimpa hasil tulisannya sendiri — menjalankan dua kali memberi hasil
yang sama persis (aturan proyek: penambal yang menimpa sumbernya sendiri
tidak bisa dibatalkan).

Pemakaian:
  python scripts/ganti_volume_ohlc.py --kering    # hitung saja, TIDAK menulis
  python scripts/ganti_volume_ohlc.py             # tulis beneran (cadangan dulu)
  python scripts/ganti_volume_ohlc.py --swauji     # uji unit kecil, keluar
"""
import argparse
import json
import shutil
import statistics
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

AKAR = Path(__file__).parent.parent
DIR_OHLC = AKAR / "data-idx" / "json" / "ohlc"
DIR_STOCKBIT = AKAR / "data-idx" / "json" / "ohlcv_stockbit"
DIR_BACKUP = AKAR / "_arsip-mentah" / "ohlc-yahoo-sebelum-ganti-volume"


def tulis_ulet(p: Path, teks: str, coba: int = 5) -> None:
    """Tulis dengan coba ulang — Windows kadang menolak sesaat (Errno 22/13).
    Pola sama dengan panen_broker_harian.py / panen_ohlc.py."""
    for i in range(coba):
        try:
            p.write_text(teks, encoding="utf-8")
            return
        except OSError:
            if i == coba - 1:
                raise
            time.sleep(0.5 * (i + 1))


def peta_volume_stockbit(d: dict) -> dict:
    """tanggal -> volume(int) dari isi berkas ohlcv_stockbit/<KODE>.json."""
    kolom = d.get("kolom") or []
    try:
        i_tgl, i_vol = kolom.index("tanggal"), kolom.index("volume")
    except ValueError:
        return {}
    return {b[i_tgl]: int(b[i_vol]) for b in (d.get("bar") or []) if len(b) > i_vol}


def proses_satu(ohlc: dict, peta: dict):
    """Ganti volume in-place di ohlc['d'] untuk tanggal yang ada di `peta`.
    Kembalikan (berubah: bool, stat: dict)."""
    baris_berubah = baris_turun = baris_nol_dilewati = 0
    persen = []
    for baris in ohlc.get("d", []):
        tgl, vol_lama = baris[0], baris[5]
        vol_baru = peta.get(tgl)
        if vol_baru is None or vol_baru == vol_lama:
            continue
        # Stockbit 0 sementara Yahoo punya angka: PERTAHANKAN Yahoo.
        # Menulis 0 menghapus informasi, dan nol tak bisa dibedakan dari "tak
        # diperdagangkan" — aturan proyek yang sudah dibayar sekali di ruas
        # OpenPrice IDX. Terukur 23 Agu 2026: 296 bar seperti ini (ABDA 11.000,
        # ALTO 10.000, ALDO 208 lembar), semuanya hari sangat sepi.
        if vol_baru == 0 and vol_lama > 0:
            baris_nol_dilewati += 1
            continue
        baris_berubah += 1
        if vol_baru < vol_lama:
            baris_turun += 1
        persen.append(abs(vol_baru - vol_lama) / vol_lama * 100 if vol_lama else 100.0)
        baris[5] = vol_baru
    stat = {"baris_berubah": baris_berubah, "baris_turun": baris_turun,
            "baris_nol_dilewati": baris_nol_dilewati, "persen": persen}
    return baris_berubah > 0, stat


def _p95(xs):
    if not xs:
        return 0.0
    s = sorted(xs)
    return s[min(len(s) - 1, int(round(0.95 * (len(s) - 1))))]


def hitung_potensi_perluasan(berkas_ohlc: list[Path]) -> dict:
    """Kalau ohlc/ diperpanjang ke SELURUH riwayat Stockbit: berapa bar
    tambahan & estimasi ukuran ohlc/ sesudahnya. Estimasi ukuran linear
    terhadap jumlah bar (bentuk baris identik, header konstan diabaikan)."""
    bar_sebelum = bar_sesudah = 0
    for p in berkas_ohlc:
        try:
            ohlc = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if "d" not in ohlc:
            continue
        p_sb = DIR_STOCKBIT / p.name
        if not p_sb.exists():
            bar_sebelum += len(ohlc["d"])
            bar_sesudah += len(ohlc["d"])
            continue
        try:
            sb = json.loads(p_sb.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        tgl_ohlc = {b[0] for b in ohlc["d"]}
        n_sb = len(sb.get("bar") or [])
        bar_sebelum += len(ohlc["d"])
        # bar sesudah = bar ohlc yang tak ada padanan stockbit + seluruh bar stockbit
        i_tgl = (sb.get("kolom") or []).index("tanggal") if "tanggal" in (sb.get("kolom") or []) else 0
        tgl_sb = {b[i_tgl] for b in (sb.get("bar") or [])}
        hanya_ohlc = len(tgl_ohlc - tgl_sb)
        bar_sesudah += hanya_ohlc + n_sb
    ukuran_sebelum = sum(p.stat().st_size for p in berkas_ohlc)
    rasio = (bar_sesudah / bar_sebelum) if bar_sebelum else 1.0
    return {
        "bar_sebelum": bar_sebelum,
        "bar_sesudah": bar_sesudah,
        "bar_tambahan": bar_sesudah - bar_sebelum,
        "mb_sebelum": ukuran_sebelum / 1_048_576,
        "mb_sesudah_estimasi": ukuran_sebelum * rasio / 1_048_576,
    }


def swauji():
    """Uji unit kecil murni in-memory, tanpa I/O berkas."""
    ohlc = {"kode": "TEST", "d": [
        ["2024-01-01", 100, 100, 100, 100, 1000],   # naik
        ["2024-01-02", 100, 100, 100, 100, 500],    # turun (harus tercatat baris_turun)
        ["2024-01-03", 100, 100, 100, 100, 700],    # sama -> tak dihitung berubah
        ["2024-01-04", 100, 100, 100, 100, 999],    # tak ada padanan -> dibiarkan
    ]}
    peta = {"2024-01-01": 1200, "2024-01-02": 300, "2024-01-03": 700}
    berubah, stat = proses_satu(ohlc, peta)
    assert berubah is True
    assert stat["baris_berubah"] == 2, stat
    assert stat["baris_turun"] == 1, stat
    assert ohlc["d"][0][5] == 1200
    assert ohlc["d"][1][5] == 300
    assert ohlc["d"][2][5] == 700  # tak berubah walau ada padanan (nilainya sama)
    assert ohlc["d"][3][5] == 999  # tak ada padanan -> dibiarkan

    # berkas tanpa "d" (mis. _gagal.json) harus dilewati oleh pemanggil,
    # bukan dites di sini karena proses_satu murni menerima dict ohlc valid.
    print("swauji OK — 4/4 assert lulus")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kering", action="store_true", help="hitung saja, jangan menulis")
    ap.add_argument("--swauji", action="store_true", help="jalankan uji unit lalu keluar")
    a = ap.parse_args()

    if a.swauji:
        swauji()
        return

    berkas = sorted(DIR_OHLC.glob("*.json"))
    print(f"Berkas di ohlc/: {len(berkas)}")

    n_tersentuh = 0
    n_tanpa_pasangan = 0
    n_bukan_ohlc = 0
    total_baris_berubah = 0
    total_baris_turun = 0
    semua_persen = []
    hasil_tulis = []  # (path, dict) yang perlu ditulis kalau bukan --kering

    for p in berkas:
        try:
            ohlc = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            n_bukan_ohlc += 1
            continue
        if "d" not in ohlc:
            n_bukan_ohlc += 1
            continue
        p_sb = DIR_STOCKBIT / p.name
        if not p_sb.exists():
            n_tanpa_pasangan += 1
            continue
        sb = json.loads(p_sb.read_text(encoding="utf-8"))
        peta = peta_volume_stockbit(sb)
        if not peta:
            n_tanpa_pasangan += 1
            continue
        berubah, stat = proses_satu(ohlc, peta)
        total_baris_berubah += stat["baris_berubah"]
        total_baris_turun += stat["baris_turun"]
        semua_persen.extend(stat["persen"])
        if berubah:
            n_tersentuh += 1
            hasil_tulis.append((p, ohlc))

    print(f"Emiten tersentuh (>=1 bar volume berubah): {n_tersentuh}")
    print(f"Emiten tanpa pasangan Stockbit            : {n_tanpa_pasangan}")
    print(f"Berkas bukan ohlc (mis. _gagal.json)      : {n_bukan_ohlc}")
    print(f"Total bar volume berubah                  : {total_baris_berubah}")
    print(f"Total bar volume TURUN (mestinya ~0)      : {total_baris_turun}")
    if semua_persen:
        print(f"Persen perubahan — median {statistics.median(semua_persen):.2f}% "
              f"| p95 {_p95(semua_persen):.2f}% | maks {max(semua_persen):.2f}%")

    perluasan = hitung_potensi_perluasan(berkas)
    print("\n-- Kalau diperpanjang ke seluruh riwayat Stockbit --")
    print(f"Bar sekarang   : {perluasan['bar_sebelum']}")
    print(f"Bar kalau penuh: {perluasan['bar_sesudah']} "
          f"(+{perluasan['bar_tambahan']})")
    print(f"Ukuran ohlc/ sekarang       : {perluasan['mb_sebelum']:.1f} MB")
    print(f"Ukuran ohlc/ kalau penuh (estimasi linear): "
          f"{perluasan['mb_sesudah_estimasi']:.1f} MB")

    if a.kering:
        print("\n--kering: tidak ada berkas yang ditulis.")
        return

    if not hasil_tulis:
        print("\nTak ada perubahan untuk ditulis.")
        return

    # Cadangan WAJIB sebelum menulis apa pun.
    try:
        if DIR_BACKUP.exists():
            shutil.rmtree(DIR_BACKUP)
        shutil.copytree(DIR_OHLC, DIR_BACKUP)
    except OSError as e:
        print(f"::error::Cadangan gagal ({e}) — DIBATALKAN, tidak menulis apa pun.")
        sys.exit(1)
    print(f"\nCadangan tersimpan: {DIR_BACKUP}")

    for p, ohlc in hasil_tulis:
        teks = json.dumps(ohlc, ensure_ascii=False, separators=(",", ":"))
        tulis_ulet(p, teks)
    print(f"Ditulis: {len(hasil_tulis)} berkas.")


if __name__ == "__main__":
    main()
