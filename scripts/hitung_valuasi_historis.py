"""Deret P/E & P/B tahunan per emiten → data-idx/json/valuasi_historis.json.

**Nol jaringan.** Bahannya tiga berkas yang sudah ada di cakram:
`data-idx/json/keuangan_idx/` (XBRL resmi bursa, tahunan 2019-2025),
`data-idx/json/ohlc/` (harga penutupan harian), dan `data-idx/json/daftar_emiten.json`
(`saham` = `ListedShares` bursa).

Keluarannya cuma DERET MENTAH per tahun. Rerata, ambang, dan vonis
murah/wajar/mahal dihitung di `app/src/lib/dasbor/valuasiHistoris.ts` supaya
rumusnya bisa diuji vitest dan dibantah pembaca — lihat komentar di sana.

## Jebakan yang WAJIB dipahami sebelum mengubah berkas ini

**1. Harga OHLC sudah disesuaikan pemecahan saham; EPS XBRL tidak.**
Terukur 20 Agu 2026: BBCA memecah saham 1:5 (Okt 2021). Penutupan akhir 2019
yang benar-benar diperdagangkan adalah 33.425, tapi `ohlc/BBCA.json` menyimpan
**6.685** — persis 33.425 ÷ 5. Sementara `eps` di laporan 2019 tetap **1.159**,
angka apa adanya saat itu (basis 24,65 miliar lembar, bukan 123,21 miliar).

Membagi keduanya begitu saja memberi **P/E 2019 = 5,8×** untuk emiten yang
sebenarnya diperdagangkan di ~29×. Nol galat, nol tanda; yang terlihat cuma
"dulu BBCA sangat murah". Kesalahan yang sama muncul di setiap emiten yang
pernah memecah saham — UNVR (1:5, Jan 2020) tercatat P/B melompat 12× → 57×
antara 2019 dan 2020 semata karena pemecahannya.

Karena itu ruas per-saham TIDAK dipakai sama sekali. Yang dipakai jumlah
AGREGAT (laba bersih, ekuitas) dibagi jumlah saham HARI INI — basis yang sama
dengan deret harga yang sudah disesuaikan:

    P/E tahun Y = harga_akhir_Y x saham_hari_ini / laba_bersih_Y
    P/B tahun Y = harga_akhir_Y x saham_hari_ini / ekuitas_Y

Diperiksa ulang dengan rumus ini: BBCA 2019 = 28,8x (nyata ~29x), UNVR 2019 =
43,5x (nyata ~43x). Cocok.

# ponytail: normalisasi "saham hari ini" tepat untuk pemecahan/penggabungan
# saham, tapi memperlakukan saham hasil rights issue seolah selalu ada — P/E
# tahun lama emiten yang banyak menerbitkan saham baru jadi agak tinggi. Data
# yang ada tak bisa membedakan pemecahan dari penerbitan (keduanya cuma terlihat
# sebagai jumlah saham yang berubah). Naikkan ke deret jumlah saham per tahun
# kalau nanti ada sumbernya.

**2. Hanya `tahunan`, tak pernah `kuartal`.** Kuartal `keuangan_idx/` itu
interim KUMULATIF sedangkan `keuangan/` (yfinance) diskret; mencampurnya
memberi angka hampir dua kali lipat tanpa galat (CLAUDE.md). Berkas ini tak
menyentuh `keuangan/` sama sekali dan hanya membaca periode tahunan, yang
maknanya sama di kedua sumber.

**3. Mata uang.** 100 dari 949 emiten melapor dalam USD sementara harga selalu
rupiah. Periode yang mata uangnya bukan IDR DILEWATI, bukan dikonversi —
kursnya berubah tiap tahun dan menebaknya menambah galat diam-diam.

Pakai:
  C:/Python314/python.exe scripts/hitung_valuasi_historis.py
"""
from __future__ import annotations

import bisect
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
JSON = AKAR / "data-idx" / "json"
KELUARAN = JSON / "valuasi_historis.json"
WIB = timezone(timedelta(hours=7))

# Rasio di luar rentang ini hampir pasti bukan valuasi melainkan cacat data
# (laba nyaris nol memberi P/E ratusan ribu). Dibuang di sini supaya tak ada
# satu titik gila yang menyeret kuartil deretnya.
BATAS_PE = 300.0
BATAS_PB = 100.0


def muat(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 — berkas hilang/rusak = emiten dilewati
        return None


def deret_tutup(ohlc: dict) -> tuple[list[str], list[float]]:
    """Tanggal & harga penutupan, urut naik. Baris `d` = [tgl, o, h, l, c, v]."""
    baris = ohlc.get("d") or []
    tgl = [r[0] for r in baris]
    tutup = [r[4] for r in baris]
    return tgl, tutup


def tutup_akhir_tahun(tgl: list[str], tutup: list[float], tahun: str) -> float | None:
    """Penutupan perdagangan TERAKHIR di tahun itu. None kalau emiten belum
    tercatat (atau berhenti diperdagangkan) sepanjang tahun tsb."""
    i = bisect.bisect_right(tgl, f"{tahun}-12-31") - 1
    if i < 0 or tgl[i][:4] != tahun:
        return None
    nilai = tutup[i]
    return float(nilai) if nilai else None


def main() -> int:
    daftar = muat(JSON / "daftar_emiten.json")
    if not daftar:
        print("daftar_emiten.json tak terbaca", file=sys.stderr)
        return 1
    saham_idx = {
        (e.get("kode") or "").upper(): e.get("saham")
        for e in daftar.get("emiten", [])
        if e.get("saham")
    }

    hasil: dict[str, dict] = {}
    # Alasan per-kode kenapa deret P/B-nya kosong (audit 26 Agu 1.5) — UI dulu
    # menyalahkan "mata uang" untuk SEMUA yang kosong, padahal terukur 10/14
    # sampel tak punya berkas laporan sama sekali dan 5 lainnya murni IDR tapi
    # ekuitasnya negatif. Kunci: kode; nilai salah satu dari
    # tak_ada_laporan | tanpa_saham | tanpa_harga | non_idr |
    # ekuitas_negatif | rasio_ekstrem | tak_ada_periode.
    alasan_pb: dict[str, str] = {}
    lewat_mata_uang = 0
    tanpa_saham: list[str] = []
    tanpa_ohlc = 0

    punya_laporan: set[str] = set()
    for path in sorted((JSON / "keuangan_idx").glob("*.json")):
        kode = path.stem.upper()
        ki = muat(path)
        if not ki:
            continue
        punya_laporan.add(kode)
        saham = saham_idx.get(kode)
        if not saham:
            tanpa_saham.append(kode)
            alasan_pb[kode] = "tanpa_saham"
            continue
        ohlc = muat(JSON / "ohlc" / f"{kode}.json")
        if not ohlc:
            tanpa_ohlc += 1
            alasan_pb[kode] = "tanpa_harga"
            continue
        tgl, tutup = deret_tutup(ohlc)
        if not tgl:
            tanpa_ohlc += 1
            alasan_pb[kode] = "tanpa_harga"
            continue

        mata_uang = ki.get("mata_uang") or {}
        bawaan = ki.get("currency")
        pe: dict[str, float] = {}
        pb: dict[str, float] = {}
        ni_akhir = eq_akhir = None
        tahun_akhir = None
        n_tahunan = n_idr = n_eq_pos = 0

        for kunci in sorted(ki.get("tahunan") or {}):
            n_tahunan += 1
            if (mata_uang.get(kunci) or bawaan) != "IDR":
                lewat_mata_uang += 1
                continue
            n_idr += 1
            p = ki["tahunan"][kunci]
            tahun = kunci[:4]
            harga = tutup_akhir_tahun(tgl, tutup, tahun)
            if harga is None:
                continue
            kap = harga * saham  # kapitalisasi pada basis jumlah saham hari ini
            ni = p.get("net_income")
            eq = p.get("equity")
            if ni and ni > 0:
                v = kap / ni
                if v <= BATAS_PE:
                    pe[tahun] = round(v, 3)
            if eq and eq > 0:
                n_eq_pos += 1
                v = kap / eq
                if v <= BATAS_PB:
                    pb[tahun] = round(v, 3)
            # Tahun buku terakhir yang datanya lengkap — jadi dasar rasio KINI
            # (harga hari ini ÷ per-saham tahun ini) supaya basisnya sama persis
            # dengan deret historis di atas.
            if ni or eq:
                tahun_akhir = tahun
                ni_akhir = ni
                eq_akhir = eq

        if not pb:
            # Urutan diagnosa dari hulu ke hilir — alasan pertama yang gugur.
            if n_tahunan == 0:
                alasan_pb[kode] = "tak_ada_periode"
            elif n_idr == 0:
                alasan_pb[kode] = "non_idr"
            elif n_eq_pos == 0:
                alasan_pb[kode] = "ekuitas_negatif"
            else:
                alasan_pb[kode] = "rasio_ekstrem"
        if not pe and not pb:
            continue
        hasil[kode] = {
            "saham": saham,
            "tahun_terakhir": tahun_akhir,
            # Per-saham pada basis jumlah saham HARI INI — dipakai TS bersama
            # harga terkini untuk menghitung rasio saat ini. Bukan EPS resmi
            # emiten (yang basisnya jumlah saham saat laporan terbit).
            "eps_dasar": round(ni_akhir / saham, 4) if ni_akhir and ni_akhir > 0 else None,
            "bv_dasar": round(eq_akhir / saham, 4) if eq_akhir and eq_akhir > 0 else None,
            "pe": pe,
            "pb": pb,
        }

    for e in daftar.get("emiten", []):
        k = (e.get("kode") or "").upper()
        if k and k not in punya_laporan and k not in alasan_pb:
            alasan_pb[k] = "tak_ada_laporan"

    isi = {
        "diperbarui": datetime.now(WIB).isoformat(timespec="seconds"),
        "sumber": "keuangan_idx (XBRL tahunan) x ohlc x daftar_emiten.saham (ListedShares)",
        "catatan": (
            "P/E & P/B per tahun buku pada basis jumlah saham HARI INI — sepadan "
            "dengan deret harga yang sudah disesuaikan pemecahan saham. Bukan rasio "
            "apa adanya yang tercetak di laporan tahun ybs."
        ),
        "n": len(hasil),
        "emiten": dict(sorted(hasil.items())),
        # Emiten TANPA berkas keuangan_idx sama sekali tak pernah masuk loop —
        # dilengkapi dari daftar_emiten di bawah sebagai "tak_ada_laporan".
        "alasan_pb": dict(sorted(alasan_pb.items())),
    }
    KELUARAN.write_text(json.dumps(isi, ensure_ascii=False, indent=1), encoding="utf-8")

    cukup_pe = sum(1 for v in hasil.values() if len(v["pe"]) >= 5)
    cukup_pb = sum(1 for v in hasil.values() if len(v["pb"]) >= 5)
    print(f"OK -> {KELUARAN}")
    print(f"  emiten berderet        : {len(hasil)}")
    print(f"  >=5 tahun P/E (layak vonis): {cukup_pe}")
    print(f"  >=5 tahun P/B (layak vonis): {cukup_pb}")
    print(f"  periode dilewati non-IDR   : {lewat_mata_uang}")
    print(f"  tanpa jumlah saham IDX     : {len(tanpa_saham)}")
    print(f"  tanpa berkas OHLC          : {tanpa_ohlc}")
    from collections import Counter
    print(f"  alasan_pb                  : {dict(Counter(alasan_pb.values()))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
