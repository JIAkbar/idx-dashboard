# -*- coding: utf-8 -*-
"""GERBANG: kuartal diskret turunan IDX vs kuartal yfinance (yang sudah diskret).

Kenapa gerbang ini dan bukan `Q1+Q2+Q3+Q4 == audit`: yang terakhir itu
IDENTITAS ALJABAR --
`TW1 + (TW2-TW1) + (TW3-TW2) + (Audit-TW3)` selalu `Audit`, berapa pun
operandnya, termasuk kalau operandnya tertukar TAHUN atau salah skala. Ia
membuktikan tak ada salah hitung, bukan tak ada salah baca.

Yang benar-benar memvonis: sumber INDEPENDEN yang periodenya sudah diskret --
`data-idx/json/keuangan/` (yfinance). Rasio median per ruas harus ~1,00.

Baris yang dilewati (bukan kegagalan):
  * salah satu sisi null / nol (rasio tak terdefinisi)
  * mata uang kedua sumber beda (mis. RIGS) -- selisihnya kurs, bukan bacaan

PAKAI
-----
  python scripts/uji_diskret_yfinance.py                # per tahun, semua ruas
  python scripts/uji_diskret_yfinance.py --tahun 2024
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median

AKAR = Path(__file__).resolve().parent.parent
DISKRET_DIR = AKAR / "data-idx" / "json" / "keuangan_idx_diskret"
YF_DIR = AKAR / "data-idx" / "json" / "keuangan"

RUAS = ["revenue", "net_income", "operating_income", "gross_profit", "operating_cf"]


def _angka(v) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def kumpulkan(tahun: int | None) -> tuple[dict[tuple[int, str], list[float]], int, int]:
    """(tahun, ruas) -> daftar rasio idx/yf. Plus (dilewati_mata_uang, revenue_negatif)."""
    rasio: dict[tuple[int, str], list[float]] = {}
    lewat_mu = neg_rev = 0
    for p in sorted(DISKRET_DIR.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        yf_path = YF_DIR / p.name
        yf = json.loads(yf_path.read_text(encoding="utf-8")) if yf_path.exists() else {}
        yf_kuartal = (yf.get("kuartal") or {})
        yf_cur = yf.get("currency") or "IDR"
        mu = d.get("mata_uang") or {}
        for iso, entri in (d.get("kuartal_diskret") or {}).items():
            th = int(iso.split("-")[0])
            nilai = entri.get("nilai") or {}
            rev = _angka(nilai.get("revenue"))
            if rev is not None and rev < 0:
                neg_rev += 1
            if tahun and th != tahun:
                continue
            sisi_yf = yf_kuartal.get(iso)
            if not sisi_yf:
                continue
            if (mu.get(iso) or d.get("currency") or "IDR") != yf_cur:
                lewat_mu += 1
                continue
            for f in RUAS:
                a, b = _angka(nilai.get(f)), _angka(sisi_yf.get(f))
                if a is None or b is None or b == 0:
                    continue
                rasio.setdefault((th, f), []).append(a / b)
    return rasio, lewat_mu, neg_rev


def main() -> int:
    ap = argparse.ArgumentParser(description="Gerbang diskret IDX vs yfinance")
    ap.add_argument("--tahun", type=int, default=None)
    args = ap.parse_args()

    rasio, lewat_mu, neg_rev = kumpulkan(args.tahun)
    print(f"{'Tahun':<7}{'Ruas':<20}{'n':>7}{'median':>10}{'p10':>10}{'p90':>10}{'dlm 5%':>9}")
    for (th, f) in sorted(rasio):
        r = sorted(rasio[(th, f)])
        n = len(r)
        p10 = r[max(0, int(0.10 * n) - 1)]
        p90 = r[min(n - 1, int(0.90 * n))]
        dekat = sum(1 for x in r if 0.95 <= x <= 1.05) / n * 100
        print(f"{th:<7}{f:<20}{n:>7}{median(r):>10.3f}{p10:>10.3f}{p90:>10.3f}{dekat:>8.0f}%")
    print(f"\nDilewati karena mata uang beda: {lewat_mu} kuartal")
    print(f"Revenue diskret NEGATIF (seluruh tahun, bukan cuma yang diuji): {neg_rev}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
