# -*- coding: utf-8 -*-
"""Turunkan kuartal DISKRET dari `data-idx/json/keuangan_idx/<TICKER>.json`
(interim IDX, KUMULATIF sejak awal tahun buku) -> `keuangan_idx_diskret/`.

Kenapa ada (18 Agu 2026, task diskret-kuartal): Johan -- "diskret saja biar
bisa dibandingkan antar kuartal". Laporan interim resmi IDX itu KUMULATIF
(TW2 = Jan-Jun, bukan Apr-Jun saja) -- lihat docs/sumber-fundamental-idx.md
bagian JEBAKAN, dan `panen_keuangan_idx.py` baris 46-53. Nol permintaan
jaringan -- murni pembagian dari apa yang sudah dipanen.

RUMUS (cuma ruas ARUS -- pendapatan/beban/laba/arus kas, BUKAN neraca):
    Q1 = TW1                       (kumulatif sejak awal tahun == TW1 itu sendiri)
    Q2 = TW2 - TW1
    Q3 = TW3 - TW2
    Q4 = Tahunan(audit) - TW3      (gratis -- audit sudah ada, tak perlu TW4)

Ruas NERACA (posisi pada satu tanggal: aset, liabilitas, ekuitas, kas,
total_debt) TIDAK PERNAH dikurangi -- nilainya sudah posisi akhir periode,
diambil APA ADANYA dari TW1/TW2/TW3/audit sesuai kuartalnya.

BEDA DENGAN `app/src/lib/dasbor/fundamentalGabungan.ts` (bacaKuartalIdx):
kode itu SUDAH menurunkan Q2/Q3 saat tampil (live, dari `kuartal` bucket
mentah) -- tapi (a) tak menyentuh Q4 sama sekali (audit ada di bucket
`tahunan` yang terpisah, tak pernah disilangkan ke kuartal di sana), dan
(b) kalau pengurangnya belum ada, ia MENAMPILKAN kumulatif apa adanya
berlabel "B\xb7YTD" (UX: lebih baik menunjukkan satu-satunya angka yang ada
daripada kosong). Berkas ini beda kontrak sengaja: kalau tak bisa diturunkan,
`nilai` NULL -- bukan kumulatif, bukan nol. Ini "lapisan data" murni, tak
menyentuh apa pun yang dirender; penyambungan ke tampilan (kalau dipakai)
kerja terpisah.

SKEMA KELUARAN per tiker (`keuangan_idx_diskret/<TICKER>.json`):
    {
      "ticker": "BBCA", "currency": "IDR", "diperbarui": "...",
      "kuartal_diskret": {
        "2025-03-31": {
          "nilai": {<15 ruas>},
          "asal": {<15 ruas -> "langsung:tw1" | "turunan:tw2-tw1" | ... | null>}
        }, ...
      }
    }

`nilai[f]` None kalau operand-nya hilang -- TIDAK PERNAH ditulis 0 untuk
"tak bisa dihitung" (0 berarti klaim "labanya nol").

PAKAI
-----
  python scripts/turunkan_kuartal_diskret.py            # seluruh tiker
  python scripts/turunkan_kuartal_diskret.py --verifikasi BBCA,TLKM,ASII
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
SUMBER_DIR = AKAR / "data-idx" / "json" / "keuangan_idx"
KELUARAN_DIR = AKAR / "data-idx" / "json" / "keuangan_idx_diskret"
WIB = timezone(timedelta(hours=7))

FIELD_ARUS = [
    "revenue", "cogs", "gross_profit", "operating_income", "net_income", "eps",
    "operating_cf", "investing_cf", "financing_cf", "free_cf",
]
FIELD_NERACA = ["total_assets", "total_liabilities", "equity", "cash", "total_debt"]
SEMUA_FIELD = FIELD_ARUS + FIELD_NERACA

# (label_kuartal, akhir_bulan_hari, sumber_langsung, pengurang) -- pengurang None = Q1 (tak dikurangi)
DEFINISI_Q = [
    ("Q1", "03-31", "tw1", None),
    ("Q2", "06-30", "tw2", "tw1"),
    ("Q3", "09-30", "tw3", "tw2"),
    ("Q4", "12-31", "audit", "tw3"),
]
AKHIR_BULAN = {"tw1": "03-31", "tw2": "06-30", "tw3": "09-30", "audit": "12-31"}


def _tahun_dari_tanggal_kuartal(kuartal: dict, tahunan: dict) -> set[int]:
    tahun = set()
    for tgl in list(kuartal) + list(tahunan):
        try:
            tahun.add(int(tgl.split("-")[0]))
        except (ValueError, IndexError):
            continue
    return tahun


def turunkan_satu_tiker(data: dict) -> dict:
    kuartal = data.get("kuartal") or {}
    tahunan = data.get("tahunan") or {}
    hasil: dict[str, dict] = {}

    for tahun in sorted(_tahun_dari_tanggal_kuartal(kuartal, tahunan)):
        periode_tahun_ini = {
            "tw1": kuartal.get(f"{tahun}-{AKHIR_BULAN['tw1']}"),
            "tw2": kuartal.get(f"{tahun}-{AKHIR_BULAN['tw2']}"),
            "tw3": kuartal.get(f"{tahun}-{AKHIR_BULAN['tw3']}"),
            "audit": tahunan.get(f"{tahun}-{AKHIR_BULAN['audit']}"),
        }
        for label_q, akhir, langsung_key, pengurang_key in DEFINISI_Q:
            sumber = periode_tahun_ini[langsung_key]
            if sumber is None:
                continue  # tak ada dasar apa pun utk kuartal ini -- lewati, jangan tulis null kosongan
            pengurang = periode_tahun_ini[pengurang_key] if pengurang_key else None

            nilai: dict[str, float | None] = {}
            asal: dict[str, str | None] = {}
            for f in FIELD_NERACA:
                v = sumber.get(f)
                nilai[f] = v
                asal[f] = f"langsung:{langsung_key}" if v is not None else None
            for f in FIELD_ARUS:
                v_sumber = sumber.get(f)
                if pengurang_key is None:  # Q1: kumulatif == diskret
                    nilai[f] = v_sumber
                    asal[f] = f"langsung:{langsung_key}" if v_sumber is not None else None
                else:
                    v_pengurang = (pengurang or {}).get(f)
                    if v_sumber is None or v_pengurang is None:
                        nilai[f] = None
                        asal[f] = None
                    else:
                        nilai[f] = v_sumber - v_pengurang
                        asal[f] = f"turunan:{langsung_key}-{pengurang_key}"

            iso = f"{tahun}-{akhir}"
            hasil[iso] = {"nilai": nilai, "asal": asal}

    return hasil


def proses_semua() -> tuple[int, int]:
    KELUARAN_DIR.mkdir(parents=True, exist_ok=True)
    ok = kosong = 0
    for berkas in sorted(SUMBER_DIR.glob("*.json")):
        data = json.loads(berkas.read_text(encoding="utf-8"))
        kuartal_diskret = turunkan_satu_tiker(data)
        if not kuartal_diskret:
            kosong += 1
            continue
        keluar = {
            "ticker": data.get("ticker", berkas.stem),
            "currency": data.get("currency", "IDR"),
            "diperbarui": datetime.now(WIB).strftime("%Y-%m-%d %H:%M"),
            "kuartal_diskret": kuartal_diskret,
        }
        (KELUARAN_DIR / berkas.name).write_text(
            json.dumps(keluar, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        ok += 1
    return ok, kosong


def verifikasi(tickers: list[str]) -> None:
    """Cetak tabel: jumlah 4 kuartal diskret vs tahunan auditan, per tiker.
    Cuma ruas net_income & revenue (yang paling sering diperiksa orang)."""
    print(f"{'Tiker':<8}{'Ruas':<14}{'Q1+Q2+Q3+Q4':>20}{'Tahunan(audit)':>20}{'Selisih':>10}")
    for kode in tickers:
        p = SUMBER_DIR / f"{kode}.json"
        if not p.exists():
            print(f"{kode:<8} -- tak ada berkas sumber")
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        kd = turunkan_satu_tiker(data)
        for tahun in sorted({int(k.split('-')[0]) for k in kd}):
            audit_val = (data.get("tahunan") or {}).get(f"{tahun}-12-31") or {}
            for f in ("revenue", "net_income"):
                total = 0.0
                lengkap = True
                for q_akhir in ("03-31", "06-30", "09-30", "12-31"):
                    iso = f"{tahun}-{q_akhir}"
                    v = kd.get(iso, {}).get("nilai", {}).get(f)
                    if v is None:
                        lengkap = False
                        break
                    total += v
                av = audit_val.get(f)
                if not lengkap or av is None:
                    continue
                selisih = (total - av) / av * 100 if av else float("nan")
                print(f"{kode:<8}{f'{f} {tahun}':<14}{total:>20,.0f}{av:>20,.0f}{selisih:>9.1f}%")


def main() -> int:
    ap = argparse.ArgumentParser(description="Turunkan kuartal diskret dari interim IDX kumulatif")
    ap.add_argument("--verifikasi", help="Tiker dipisah koma -- cetak tabel Q1..Q4 vs audit, tak menulis berkas")
    args = ap.parse_args()

    if args.verifikasi:
        verifikasi([t.strip().upper() for t in args.verifikasi.split(",") if t.strip()])
        return 0

    ok, kosong = proses_semua()
    print(f"Selesai: {ok} tiker ditulis ke {KELUARAN_DIR.relative_to(AKAR)}, {kosong} tak punya kuartal apa pun")
    return 0


def demo() -> None:
    """Swauji tanpa jaringan/tanpa disk -- data rekaan dengan angka bulat."""
    data = {
        "ticker": "UJI", "currency": "IDR",
        "kuartal": {
            "2025-03-31": {"revenue": 100, "net_income": 10, "total_assets": 1000, "cogs": None},
            "2025-06-30": {"revenue": 210, "net_income": 22, "total_assets": 1050},
            "2025-09-30": {"revenue": 330, "net_income": 35, "total_assets": 1100},
        },
        "tahunan": {"2025-12-31": {"revenue": 460, "net_income": 50, "total_assets": 1150}},
    }
    kd = turunkan_satu_tiker(data)
    assert kd["2025-03-31"]["nilai"]["revenue"] == 100, "Q1 harus = TW1 apa adanya"
    assert kd["2025-03-31"]["asal"]["revenue"] == "langsung:tw1"
    assert kd["2025-06-30"]["nilai"]["revenue"] == 110, "Q2 harus TW2-TW1 = 210-100"
    assert kd["2025-06-30"]["asal"]["revenue"] == "turunan:tw2-tw1"
    assert kd["2025-09-30"]["nilai"]["revenue"] == 120, "Q3 harus TW3-TW2 = 330-210"
    assert kd["2025-12-31"]["nilai"]["revenue"] == 130, "Q4 harus audit-TW3 = 460-330"
    assert kd["2025-12-31"]["asal"]["revenue"] == "turunan:audit-tw3"
    # neraca: TIDAK dikurangi, apa adanya per kuartal
    assert kd["2025-06-30"]["nilai"]["total_assets"] == 1050
    assert kd["2025-12-31"]["nilai"]["total_assets"] == 1150, "neraca Q4 = neraca audit apa adanya"
    # ruas yang None di sumber tetap None, bukan 0
    assert kd["2025-03-31"]["nilai"]["cogs"] is None
    assert kd["2025-03-31"]["asal"]["cogs"] is None
    # sum Q1..Q4 == tahunan (data rekaan sengaja pas)
    total = sum(kd[f"2025-{ab}"]["nilai"]["revenue"] for ab in ("03-31", "06-30", "09-30", "12-31"))
    assert total == 460, f"jumlah 4 kuartal diskret harus == audit, dapat {total}"
    print("turunkan_kuartal_diskret: swauji lolos")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        demo()
    else:
        raise SystemExit(main())
