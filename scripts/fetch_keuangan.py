"""
fetch_keuangan.py
==================
Pemanen laporan keuangan (Laba Rugi, Neraca, Arus Kas) kuartalan & tahunan
dari yfinance, untuk panel "Laporan Keuangan" ala Yahoo Finance di Stock Detail.

Beda dari fetch_fundamental.py: itu sudah punya q_revenue/q_net_income dkk.
(dipakai untuk rasio & valuasi). Skrip ini menyimpan BREAKDOWN laporan penuh
per periode (tanggal ISO), angka MENTAH dalam mata uang pelaporan — tidak
dikonversi ke IDR (lihat catatan currency di bawah).

Cara pakai:
  python fetch_keuangan.py --tickers DSSA,BBCA
  python fetch_keuangan.py --semua              → seluruh 959 saham IDX (DEFAULT_TICKERS)

Output: data-idx/json/keuangan/<TICKER>.json
"""

import yfinance as yf
from yfinance.exceptions import YFRateLimitError
import json, os, sys, time
from datetime import datetime

from fetch_fundamental import DEFAULT_TICKERS, sg  # reuse — lihat CLAUDE.md rung 2 (jangan duplikasi)

# Baris yang diambil dari tiap statement yfinance. Nama baris bisa berbeda
# antar emiten/versi yfinance — dicocokkan case-insensitive, dilewati kalau tak ada.
INCOME_ROWS = {
    "revenue":          "Total Revenue",
    "cogs":             "Cost Of Revenue",
    "gross_profit":     "Gross Profit",
    "operating_income": "Operating Income",
    "net_income":       "Net Income",
    "eps":              "Basic EPS",
}
BALANCE_ROWS = {
    "total_assets":      "Total Assets",
    "total_liabilities":  "Total Liabilities Net Minority Interest",
    "equity":            "Stockholders Equity",
    "cash":              "Cash And Cash Equivalents",
    "total_debt":        "Total Debt",
}
CASHFLOW_ROWS = {
    "operating_cf": "Operating Cash Flow",
    "investing_cf": "Investing Cash Flow",
    "financing_cf": "Financing Cash Flow",
    "free_cf":      "Free Cash Flow",
}
ALL_KEYS = list(INCOME_ROWS) + list(BALANCE_ROWS) + list(CASHFLOW_ROWS)


def periods_dict(df, row_map):
    """DataFrame (index=nama pos, kolom=periode) → {iso_date: {key: nilai|None}}."""
    out = {}
    if df is None or df.empty:
        return out
    idx_lower = {str(i).lower(): i for i in df.index}
    resolved = {key: idx_lower.get(nama.lower()) for key, nama in row_map.items()}
    for col in df.columns:
        try:
            iso = col.strftime("%Y-%m-%d")
        except Exception:
            continue
        entry = {}
        for key, row in resolved.items():
            if row is None:
                entry[key] = None
                continue
            v = df.loc[row, col]
            entry[key] = float(v) if (v is not None and v == v) else None
        out[iso] = entry
    return out


def merge_periods(*dicts):
    """Gabung beberapa periods_dict (union tanggal), lalu isi key yang tak ada
    di suatu statement pada tanggal tsb. dengan None supaya tiap periode punya
    field lengkap yang sama."""
    out = {}
    for d in dicts:
        for iso, entry in d.items():
            out.setdefault(iso, {}).update(entry)
    for entry in out.values():
        for k in ALL_KEYS:
            entry.setdefault(k, None)
    return out


def aman(fn):
    try:
        return fn()
    except YFRateLimitError:
        raise
    except Exception:
        return None


def fetch_satu(ticker_code, max_coba=3):
    for coba in range(max_coba):
        try:
            return _fetch_satu(ticker_code)
        except YFRateLimitError:
            if coba == max_coba - 1:
                break
            tunggu = 30 * (2 ** coba)
            print(f" .. rate limit, tunggu {tunggu}s", flush=True)
            time.sleep(tunggu)
    return "gagal"


def _fetch_satu(ticker_code):
    t = yf.Ticker(f"{ticker_code}.JK")
    info = aman(lambda: t.info) or {}
    currency = sg(info, "financialCurrency") or "IDR"

    qfin = aman(lambda: t.quarterly_income_stmt)
    afin = aman(lambda: t.income_stmt)
    qbs  = aman(lambda: t.quarterly_balance_sheet)
    abs_ = aman(lambda: t.balance_sheet)
    qcf  = aman(lambda: t.quarterly_cashflow)
    acf  = aman(lambda: t.cashflow)

    kuartal = merge_periods(
        periods_dict(qfin, INCOME_ROWS),
        periods_dict(qbs, BALANCE_ROWS),
        periods_dict(qcf, CASHFLOW_ROWS),
    )
    tahunan = merge_periods(
        periods_dict(afin, INCOME_ROWS),
        periods_dict(abs_, BALANCE_ROWS),
        periods_dict(acf, CASHFLOW_ROWS),
    )

    if not kuartal and not tahunan:
        return None

    return {
        "ticker":     ticker_code,
        "currency":   currency,   # mentah dari yfinance — JANGAN dikonversi (lihat docstring)
        "diperbarui": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "kuartal":    kuartal,
        "tahunan":    tahunan,
    }


def main():
    args = sys.argv[1:]
    tickers_arg = next((a.split("=", 1)[1] for a in args if a.startswith("--tickers=")), None)
    if not tickers_arg and "--tickers" in args:
        i = args.index("--tickers")
        tickers_arg = args[i + 1] if i + 1 < len(args) else None

    if tickers_arg:
        tickers = [x.strip().upper().replace(".JK", "") for x in tickers_arg.split(",") if x.strip()]
    elif "--semua" in args:
        tickers = list(DEFAULT_TICKERS)
    else:
        print("Pakai: python fetch_keuangan.py --tickers AAA,BBB  atau  --semua")
        sys.exit(1)

    out_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data-idx", "json", "keuangan"))
    os.makedirs(out_dir, exist_ok=True)
    print(f"Target: {len(tickers)} emiten -> {out_dir}\n")

    ok, kosong, gagal = 0, 0, 0
    for i, tk in enumerate(tickers, 1):
        print(f"  [{i:>3}/{len(tickers)}] {tk:<8}", end="", flush=True)
        data = fetch_satu(tk)
        if data == "gagal":
            gagal += 1
            print(" - gagal (rate limit menetap)")
        elif data is None:
            kosong += 1
            print(" - kosong (tak ada data laporan)")
        else:
            with open(os.path.join(out_dir, f"{tk}.json"), "w", encoding="utf-8") as fw:
                json.dump(data, fw, ensure_ascii=False, separators=(",", ":"))
            ok += 1
            n_k, n_t = len(data["kuartal"]), len(data["tahunan"])
            print(f" - ok ({currency_label(data)}, {n_k} kuartal, {n_t} tahunan)")
        time.sleep(0.5)

    print(f"\nSelesai: {ok} berhasil, {kosong} kosong, {gagal} gagal dari {len(tickers)} emiten")


def currency_label(data):
    return data.get("currency", "?")


if __name__ == "__main__":
    main()
