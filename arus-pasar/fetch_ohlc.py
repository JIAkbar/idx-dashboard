"""Arus Pasar — pengambil data OHLC harian via yfinance.

Baca daftar ticker dari edisi/<tanggal>.json, ambil ~2 tahun OHLC harian
(pemanasan EMA200; ticker IDX = <KODE>.JK, IHSG = ^JKSE), tulis
cache/ohlc-<tanggal>.json.

Konvensi cache (mengikuti ohlc-2026-08-10.json existing): bar terakhir =
sesi terakhir SEBELUM tanggal edisi (edisi Senin 10 Agu memakai data
Jumat 7 Agu — ohlc_hari di edisi.json = bar itu). Karena itu end fetch
eksklusif di tanggal edisi.

Pakai: python fetch_ohlc.py 2026-08-10 [--paksa]
  --paksa : timpa cache existing walau ada selisih > toleransi.
"""
import json, sys
from datetime import date, timedelta
from pathlib import Path

import yfinance as yf

AKAR = Path(__file__).parent
TOLERANSI = 0.005  # 0,5% selisih close pada tanggal overlap


def ambil(simbol, mulai, akhir):
    """Fetch 1 simbol -> list bar {d,o,h,l,c,v} (format cache)."""
    h = yf.Ticker(simbol).history(start=mulai.isoformat(), end=akhir.isoformat(),
                                  auto_adjust=True)
    bars = []
    for ts, row in h.iterrows():
        if any(row[k] != row[k] for k in ("Open", "High", "Low", "Close")):  # NaN
            continue
        bars.append({"d": ts.strftime("%Y-%m-%d"),
                     "o": round(float(row["Open"]), 2),
                     "h": round(float(row["High"]), 2),
                     "l": round(float(row["Low"]), 2),
                     "c": round(float(row["Close"]), 2),
                     "v": int(row["Volume"])})
    return bars


def banding(lama, baru):
    """Bandingkan close per tanggal overlap. Return (n_overlap, maks_diff_pct, contoh)."""
    peta = {b["d"]: b["c"] for b in lama}
    n, maks, contoh = 0, 0.0, None
    for b in baru:
        if b["d"] in peta:
            n += 1
            acuan = peta[b["d"]]
            diff = abs(b["c"] - acuan) / acuan if acuan else 0.0
            if diff > maks:
                maks, contoh = diff, (b["d"], acuan, b["c"])
    return n, maks, contoh


def main():
    if len(sys.argv) < 2:
        sys.exit("Pakai: python fetch_ohlc.py <tanggal> [--paksa]")
    tgl = date.fromisoformat(sys.argv[1])
    paksa = "--paksa" in sys.argv

    ed = json.loads((AKAR / "edisi" / f"{tgl}.json").read_text(encoding="utf-8"))
    tickers = [e["ticker"] for e in ed["emiten"]]
    mulai = tgl - timedelta(days=744)  # ~2 tahun: pemanasan EMA200

    data = {}
    for tk in tickers:
        data[tk] = ambil(f"{tk}.JK", mulai, tgl)
        print(f"  {tk}: {len(data[tk])} bar ({data[tk][0]['d']} .. {data[tk][-1]['d']})")
    data["JKSE"] = ambil("^JKSE", mulai, tgl)
    print(f"  JKSE: {len(data['JKSE'])} bar ({data['JKSE'][0]['d']} .. {data['JKSE'][-1]['d']})")

    tujuan = AKAR / "cache" / f"ohlc-{tgl}.json"
    if tujuan.exists():
        lama = json.loads(tujuan.read_text(encoding="utf-8"))
        gagal = False
        for k, bars in data.items():
            if k not in lama:
                print(f"  banding {k}: tidak ada di cache lama (baru)")
                continue
            n, maks, contoh = banding(lama[k], bars)
            print(f"  banding {k}: {n} tanggal overlap, maks selisih close {maks*100:.3f}%"
                  + (f" ({contoh[0]}: lama {contoh[1]} vs baru {contoh[2]})" if contoh and maks else ""))
            if maks > TOLERANSI:
                gagal = True
        if gagal and not paksa:
            sys.exit("STOP: selisih > 0,5% vs cache existing (bisa hasil kurasi). "
                     "Periksa dulu; pakai --paksa untuk tetap menimpa.")

    tujuan.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"OK -> {tujuan}")


if __name__ == "__main__":
    main()
