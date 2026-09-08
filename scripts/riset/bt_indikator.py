# -*- coding: utf-8 -*-
"""BT Indikator — backtest sinyal set INTI per kerangka waktu (#45b).

Johan, 7 Sep 2026: *"LALU BACKTEST JUGA INDIKATOR YANG SUDAH ADA DI TIMEFRAME
1H 4H DAILY WEEKLY MONTHLY"* · *"backtest lagi indikator-indikator yang
menempel pada menu"*.

Menumpang mesin yang sudah ada: `simulasi_trade`, `ringkas_trades`,
`tulis_hasil`, `perbarui_index` diimpor APA ADANYA dari `bt_papan.py`. Satu
mesin, satu definisi return dan biaya — dua mesin backtest di satu repo akan
menghasilkan dua angka untuk pertanyaan yang sama, dan yang berbeda paling
jauh justru yang paling jarang dibaca.

    python scripts/riset/bt_indikator.py --uji
    python scripts/riset/bt_indikator.py --tf D --semesta semua
    python scripts/riset/bt_indikator.py --semua --tulis

## Yang TIDAK diuji, dan itu sifat indikatornya — bukan kekurangan mesin

Set Inti berisi 14 nama; tiga di antaranya **tak punya sinyal arah**:

- **Volume** — besaran, bukan arah. Ia konteks bagi sinyal lain.
- **ATR** — ukuran volatilitas. Naik-turunnya tak menyatakan harga mau ke mana.
- **OBV** diuji, tapi lewat breakout garisnya sendiri, bukan "OBV naik".

Mengarang aturan masuk untuk Volume/ATR ("beli saat volume 2x rata-rata")
berarti menguji ATURAN KARANGAN dan melaporkannya sebagai kinerja indikator.
Itu angka yang terlihat resmi dan menjawab pertanyaan yang tak pernah
diajukan. Keduanya dicetak di keluaran sebagai `tak_berarah`, bukan dihilangkan.

**VWAP hanya di kerangka intraday.** VWAP berjangkar sesi; di kerangka harian
ke atas satu bar = satu sesi penuh, jadi "harga menembus VWAP" jadi
pernyataan tentang bar itu sendiri.

## Kedalaman data per kerangka — DIUKUR, dan ini membatasi kesimpulannya

| Kerangka | Sumber          | Bar/emiten (median) | Cakupan            |
|----------|-----------------|---------------------|--------------------|
| D        | arsip harian    | 2.822               | sejak 2000         |
| W        | dirakit dari D  | ~564                | sejak 2000         |
| M        | dirakit dari D  | ~130                | sejak 2000         |
| 1H       | arsip intraday  | 386                 | 29 Mei–4 Sep 2026  |
| 4H       | dirakit dari 1H | ~96                 | 29 Mei–4 Sep 2026  |

Arsip intraday cuma **70 hari bursa**. Hasil 1H karena itu mewakili SATU
rezim pasar tiga bulan, dan 4H menyisakan terlalu sedikit bar sesudah periode
pemanasan indikator. Keduanya tetap dijalankan — angka yang ada lebih berguna
daripada kolom kosong — tapi keluarannya membawa `peringatan_kedalaman`, dan
siapa pun yang membacanya sebagai bukti keunggulan sinyal sedang salah baca.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

AKAR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from bt_papan import (  # noqa: E402
    muat_emiten, muat_ihsg, ihsg_return, ringkas_trades, simulasi_trade,
    universe_partanggal,
)

INTRADAY = AKAR / 'data-idx' / 'json' / 'intraday_1h'
INFO = AKAR / 'data-idx' / 'json' / 'info_stockbit'

# Bar minimum sebuah emiten supaya ikut diuji di kerangka itu. 250 dipilih
# karena indikator terpanjang di set ini (Ichimoku 52+26) butuh ~80 bar
# pemanasan; 250 menyisakan ruang uji yang masih berarti sesudahnya.
# Berapa trade yang IKUT disimpan sebagai contoh. Daftar penuh sengaja
# TIDAK ditulis: run OBV di semesta "semua" saja menghasilkan ratusan ribu
# baris, dan terukur 4 MB terkompresi PER BERKAS - 165 kombinasi berarti
# ~450 MB masuk repo untuk angka yang tak satu pun pembacanya butuh baris
# per baris. Yang dipakai layar dan laporan adalah RINGKASANNYA; contoh
# ini cuma supaya hasilnya bisa dicocokkan tangan ke chart.
CONTOH_TRADE = 200

# Return di atas ambang ini DIBUANG sebagai data rusak, dan jumlahnya
# dilaporkan - bukan disaring diam-diam.
#
# Kenapa perlu, dengan angkanya: satu trade BCIC 17 Jul 2006 memberi
# **+982.042%** (9.820x dalam lima bar pekanan). Itu bukan gerak harga,
# itu penyesuaian aksi korporasi yang hilang - BCIC melewati rekapitalisasi
# dan reverse split di tahun itu. Satu baris itu sendirian mengangkat
# profit factor run RSI pekanan dari **1,47 menjadi 23,74** dan Bollinger
# dari **1,19 menjadi 13,30**. Angka 23,74 tercetak rapi, terlihat
# spektakuler, dan seluruhnya milik satu bar rusak.
#
# Ambangnya per kerangka, dan dasarnya batas fisik bursa: auto-reject atas
# 35% per hari untuk saham termurah. Lima bar HARIAN karena itu tak bisa
# melewati 1,35^5 = 4,5x. Untuk pekanan/bulanan batas berantai itu tak lagi
# mengikat, jadi dipakai ambang yang jelas mustahil sebagai gerak harga.
AMBANG_RETURN = {'1H': 1.0, '4H': 1.0, 'D': 3.5, 'W': 20.0, 'M': 50.0}

MIN_BAR = 250
BIAYA = 0.0            # roundtrip; 0 sejak keputusan Johan 8 Sep 2026 (#93), dulu 0,3%
MODEL_MASUK = 'open_h1'
MODEL_KELUAR = 'h5'    # 5 BAR kerangka itu, bukan 5 hari

TAK_BERARAH = {
    'volume': 'besaran, bukan arah — konteks bagi sinyal lain',
    'atr': 'ukuran volatilitas; naik-turunnya tak menyatakan arah harga',
}


# ============================================================ deret & kerangka
def _kunci_pekan(t: str) -> str:
    y, m, d = int(t[:4]), int(t[5:7]), int(t[8:10])
    import datetime as _dt
    tgl = _dt.date(y, m, d)
    return (tgl - _dt.timedelta(days=tgl.weekday())).isoformat()


def _kunci_bulan(t: str) -> str:
    return t[:8] + '01'


def rakit(d: dict, kunci) -> dict:
    """Gabungkan bar ke ember yang lebih besar. Tutup ember = tutup bar
    TERAKHIR di dalamnya, dan waktunya = kunci ember — sama persis dengan
    `rakitBar` di layar, supaya angka riset dan angka chart lahir dari
    definisi yang sama."""
    out = {'kode': d['kode'], 'tgl': [], 'o': [], 'h': [], 'l': [], 'c': [], 'value': [], 'lot': []}
    terakhir = None
    for i, t in enumerate(d['tgl']):
        k = kunci(t)
        if k != terakhir:
            terakhir = k
            out['tgl'].append(k)
            out['o'].append(d['o'][i]); out['h'].append(d['h'][i])
            out['l'].append(d['l'][i]); out['c'].append(d['c'][i])
            out['value'].append(d['value'][i]); out['lot'].append(d.get('lot', d['value'])[i])
            continue
        out['h'][-1] = max(out['h'][-1], d['h'][i])
        out['l'][-1] = min(out['l'][-1], d['l'][i])
        out['c'][-1] = d['c'][i]
        out['value'][-1] += d['value'][i]
        out['lot'][-1] += d.get('lot', d['value'])[i]
    return out


def muat_intraday(kode_saja: set[str] | None = None) -> dict[str, dict]:
    """Bar 1 jam. Waktunya string `YYYY-MM-DD HH:MM` WIB — bentuk yang sama
    dengan yang dipakai layar, jadi `tgl_sinyal` di hasil bisa dicocokkan
    tangan ke chart."""
    import datetime as _dt
    WIB = _dt.timezone(_dt.timedelta(hours=7))
    out: dict[str, dict] = {}
    for p in sorted(INTRADAY.glob('*.json')):
        kode = p.stem
        if kode_saja is not None and kode not in kode_saja:
            continue
        try:
            d = json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue
        kolom, bar = d.get('kolom'), d.get('bar')
        if not kolom or not bar:
            continue
        ix = {k: i for i, k in enumerate(kolom)}
        req = ['epoch', 'open', 'high', 'low', 'close', 'value']
        if any(r not in ix for r in req):
            continue
        bar = sorted(bar, key=lambda r: r[ix['epoch']])
        out[kode] = {
            'kode': kode,
            'tgl': [_dt.datetime.fromtimestamp(r[ix['epoch']], WIB).strftime('%Y-%m-%d %H:%M') for r in bar],
            'o': [float(r[ix['open']]) for r in bar],
            'h': [float(r[ix['high']]) for r in bar],
            'l': [float(r[ix['low']]) for r in bar],
            'c': [float(r[ix['close']]) for r in bar],
            'value': [float(r[ix['value']]) for r in bar],
            'lot': [float(r[ix['volume']]) if 'volume' in ix else 0.0 for r in bar],
        }
    return out


def _kunci_4jam(t: str) -> str:
    """Ember 4 jam dari bar 1 jam: dua ember per hari bursa (09-12, 13-16).
    Sesi IDX 09.00-11.30 dan 13.30-15.00 (Jumat beda), jadi pembagian jam
    tetap TIDAK menghasilkan empat ember penuh — dua yang jujur lebih baik
    daripada empat yang separuhnya kosong."""
    jam = int(t[11:13])
    return f"{t[:10]} {'09' if jam < 12 else '13'}:00"


def deret(kerangka: str, kode_saja: set[str] | None = None) -> dict[str, dict]:
    if kerangka == 'D':
        return muat_emiten(kode_saja)
    if kerangka in ('W', 'M'):
        kunci = _kunci_pekan if kerangka == 'W' else _kunci_bulan
        return {k: rakit(v, kunci) for k, v in muat_emiten(kode_saja).items()}
    if kerangka == '1H':
        return muat_intraday(kode_saja)
    if kerangka == '4H':
        return {k: rakit(v, _kunci_4jam) for k, v in muat_intraday(kode_saja).items()}
    raise SystemExit('kerangka tak dikenal: ' + kerangka)


# ================================================================== indikator
def _df(d: dict) -> pd.DataFrame:
    return pd.DataFrame({
        'o': d['o'], 'h': d['h'], 'l': d['l'], 'c': d['c'],
        'v': d.get('lot', [0.0] * len(d['c'])), 'val': d['value'],
    })


def _rsi(c: pd.Series, n: int = 14) -> pd.Series:
    """RSI Wilder.

    Pembagian nol ditangani EKSPLISIT, bukan diserahkan ke NaN. Deret yang
    tak pernah turun (auto-reject atas berturut-turut itu nyata di papan
    ini) membuat penyebutnya nol, dan `x / 0 -> NaN` menghasilkan RSI
    kosong: sinyalnya lalu diam di emiten yang justru paling ekstrem, tanpa
    satu pun galat. Ditangkap swauji sebelum jalan penuh.
    """
    delta = c.diff()
    naik = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    turun = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rsi = 100 - 100 / (1 + naik / turun.replace(0, np.nan))
    # turun == 0: hanya kenaikan -> 100 kalau memang ada kenaikan, 50 kalau
    # deretnya rata (tak naik dan tak turun sama sekali).
    rata = (turun == 0) & (naik == 0)
    hanya_naik = (turun == 0) & (naik > 0)
    rsi = rsi.mask(hanya_naik, 100.0).mask(rata, 50.0)
    return rsi


def _atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    tr = pd.concat([
        df['h'] - df['l'],
        (df['h'] - df['c'].shift()).abs(),
        (df['l'] - df['c'].shift()).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False).mean()


def _silang_naik(a: pd.Series, b: pd.Series) -> pd.Series:
    """a menembus b DARI BAWAH. `shift(1)` wajib: tanpa itu bar yang cuma
    menyentuh dari atas ikut terhitung, dan sinyalnya jadi dua kali lebih
    sering tanpa satu pun galat."""
    return (a > b) & (a.shift(1) <= b.shift(1))


def sinyal(nama: str, df: pd.DataFrame) -> pd.Series:
    c, h, l = df['c'], df['h'], df['l']
    if nama == 'sma':
        return _silang_naik(c, c.rolling(20).mean())
    if nama == 'ema':
        return _silang_naik(c, c.ewm(span=20, adjust=False).mean())
    if nama == 'rsi':
        r = _rsi(c)
        # Silang naik keluar dari wilayah jenuh jual — bukan "RSI < 30", yang
        # akan menandai TIAP bar selama harga terus turun.
        return _silang_naik(r, pd.Series(30.0, index=r.index))
    if nama == 'macd':
        m = c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
        return _silang_naik(m, m.ewm(span=9, adjust=False).mean())
    if nama == 'stochastic':
        rendah = l.rolling(14).min()
        tinggi = h.rolling(14).max()
        k = 100 * (c - rendah) / (tinggi - rendah).replace(0, np.nan)
        k = k.rolling(3).mean()
        d = k.rolling(3).mean()
        return _silang_naik(k, d) & (k < 30)
    if nama == 'bollinger':
        ma = c.rolling(20).mean()
        sd = c.rolling(20).std(ddof=0)
        return _silang_naik(c, ma - 2 * sd)
    if nama == 'adx_dmi':
        up = df['h'].diff()
        dn = -df['l'].diff()
        plus = pd.Series(np.where((up > dn) & (up > 0), up, 0.0), index=c.index)
        minus = pd.Series(np.where((dn > up) & (dn > 0), dn, 0.0), index=c.index)
        atr = _atr(df)
        pdi = 100 * plus.ewm(alpha=1 / 14, adjust=False).mean() / atr.replace(0, np.nan)
        mdi = 100 * minus.ewm(alpha=1 / 14, adjust=False).mean() / atr.replace(0, np.nan)
        dx = 100 * (pdi - mdi).abs() / (pdi + mdi).replace(0, np.nan)
        adx = dx.ewm(alpha=1 / 14, adjust=False).mean()
        return _silang_naik(pdi, mdi) & (adx > 20)
    if nama == 'parabolic_sar':
        sar = _sar(df)
        return _silang_naik(c, sar)
    if nama == 'supertrend':
        return _supertrend_balik(df)
    if nama == 'ichimoku':
        konv = (h.rolling(9).max() + l.rolling(9).min()) / 2
        dasar = (h.rolling(26).max() + l.rolling(26).min()) / 2
        a = ((konv + dasar) / 2).shift(26)
        b = ((h.rolling(52).max() + l.rolling(52).min()) / 2).shift(26)
        return _silang_naik(c, pd.concat([a, b], axis=1).max(axis=1))
    if nama == 'obv':
        arah = np.sign(c.diff()).fillna(0)
        obv = (arah * df['v']).cumsum()
        # Breakout garis OBV sendiri: OBV menembus puncak 20 barnya. "OBV
        # naik" bukan sinyal — ia naik di tiap bar hijau.
        return obv > obv.rolling(20).max().shift(1)
    if nama == 'vwap':
        tp = (h + l + c) / 3
        hari = pd.Series([t[:10] for t in df.index.astype(str)], index=df.index)
        return pd.Series(False, index=c.index) if hari.nunique() <= 1 else _silang_naik(
            c, (tp * df['v']).groupby(hari).cumsum() / df['v'].groupby(hari).cumsum().replace(0, np.nan))
    raise SystemExit('indikator tak dikenal: ' + nama)


def _supertrend_balik(df: pd.DataFrame, n: int = 10, m: float = 3.0) -> pd.Series:
    """Bar tempat Supertrend BERBALIK dari turun ke naik.

    Versi pertama menulis `close menembus (hl2 - 3*ATR)` dan itu BUKAN
    Supertrend: garis itu bergerak bebas naik-turun mengikuti harga, jadi
    perlintasan hampir tak pernah terjadi - terukur 21 sinyal di 45 emiten
    LQ45 sepanjang 26 tahun, sementara indikator lain memberi ribuan. Angka
    sekecil itu bukan "indikatornya selektif", melainkan rumus yang salah,
    dan profit factor 8,90 yang menyertainya justru terlihat MENGGIURKAN -
    persis bentuk hasil yang menyesatkan kalau tak diperiksa.

    Supertrend sebenarnya MENGUNCI: pita bawah hanya boleh naik selama tren
    naik, pita atas hanya boleh turun selama tren turun. Arahnya berbalik
    saat harga menembus pita yang mengunci itu.
    """
    hl2 = ((df["h"] + df["l"]) / 2).to_numpy()
    atr = _atr(df, n).to_numpy()
    c = df["c"].to_numpy()
    jml = len(c)
    atas = hl2 + m * atr
    bawah = hl2 - m * atr
    arah = np.ones(jml, dtype=bool)   # True = tren naik
    for i in range(1, jml):
        if np.isnan(atr[i]):
            atas[i], bawah[i], arah[i] = atas[i - 1], bawah[i - 1], arah[i - 1]
            continue
        atas[i] = min(atas[i], atas[i - 1]) if c[i - 1] < atas[i - 1] else atas[i]
        bawah[i] = max(bawah[i], bawah[i - 1]) if c[i - 1] > bawah[i - 1] else bawah[i]
        if c[i] > atas[i - 1]:
            arah[i] = True
        elif c[i] < bawah[i - 1]:
            arah[i] = False
        else:
            arah[i] = arah[i - 1]
    balik = np.zeros(jml, dtype=bool)
    balik[1:] = arah[1:] & ~arah[:-1]
    return pd.Series(balik, index=df.index)


def _sar(df: pd.DataFrame, langkah: float = 0.02, maks: float = 0.2) -> pd.Series:
    h, l = df['h'].to_numpy(), df['l'].to_numpy()
    n = len(h)
    sar = np.full(n, np.nan)
    if n < 2:
        return pd.Series(sar, index=df.index)
    naik = True
    af = langkah
    ep = h[0]
    sar[0] = l[0]
    for i in range(1, n):
        sar[i] = sar[i - 1] + af * (ep - sar[i - 1])
        if naik:
            if l[i] < sar[i]:
                naik, sar[i], ep, af = False, ep, l[i], langkah
            elif h[i] > ep:
                ep, af = h[i], min(af + langkah, maks)
        else:
            if h[i] > sar[i]:
                naik, sar[i], ep, af = True, ep, h[i], langkah
            elif l[i] < ep:
                ep, af = l[i], min(af + langkah, maks)
    return pd.Series(sar, index=df.index)


BERARAH = ['sma', 'ema', 'rsi', 'macd', 'stochastic', 'bollinger',
           'adx_dmi', 'parabolic_sar', 'supertrend', 'ichimoku', 'obv', 'vwap']


# =================================================================== semesta
def anggota_lq45() -> set[str]:
    out: set[str] = set()
    for p in INFO.glob('*.json'):
        try:
            d = json.loads(p.read_text(encoding='utf-8'))
        except Exception:
            continue
        if 'LQ45' in (d.get('indexes') or []):
            out.add(p.stem)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--tf', default='D', choices=['1H', '4H', 'D', 'W', 'M'])
    ap.add_argument('--semesta', default='semua', choices=['semua', 'lq45', 'nonlikuid'])
    ap.add_argument('--indikator', default=None, help='satu nama; kosong = semua yang berarah')
    ap.add_argument('--emiten', type=int, default=None, help='batasi jumlah emiten (uji cepat)')
    ap.add_argument('--tulis', action='store_true')
    ap.add_argument('--semua', action='store_true', help='5 kerangka x 3 semesta')
    ap.add_argument('--uji', action='store_true')
    a = ap.parse_args()

    if a.uji:
        return swauji()
    if a.semua:
        rc = 0
        for tf in ['D', 'W', 'M', '1H', '4H']:
            for sm in ['semua', 'lq45', 'nonlikuid']:
                rc |= jalankan(tf, sm, None, a.emiten, a.tulis)
        return rc
    return jalankan(a.tf, a.semesta, a.indikator, a.emiten, a.tulis)


def jalankan(tf: str, semesta: str, satu: str | None, batas: int | None, tulis: bool) -> int:
    kode_saja = anggota_lq45() if semesta == 'lq45' else None
    bars = deret(tf, kode_saja)
    if batas:
        bars = dict(sorted(bars.items())[:batas])
    bars = {k: v for k, v in bars.items() if len(v['c']) >= MIN_BAR}
    if not bars:
        print(f'[{tf}/{semesta}] nol emiten memenuhi {MIN_BAR} bar — dilewati')
        return 0

    rank = universe_partanggal(bars) if semesta == 'nonlikuid' else None
    ihsg = muat_ihsg()
    daftar = [satu] if satu else BERARAH
    if tf in ('D', 'W', 'M') and 'vwap' in daftar:
        daftar = [x for x in daftar if x != 'vwap']

    dangkal = tf in ('1H', '4H')
    print(f'[{tf}/{semesta}] {len(bars)} emiten, {len(daftar)} indikator'
          + (' — KEDALAMAN TERBATAS' if dangkal else ''))

    for nama in daftar:
        trades: list[dict] = []
        dibuang: list[dict] = []
        for kode, d in bars.items():
            df = _df(d)
            df.index = pd.Index(d['tgl'])
            try:
                s = sinyal(nama, df).to_numpy()
            except Exception:
                continue
            for i in np.flatnonzero(s):
                i = int(i)
                if rank is not None:
                    r = rank.get(kode)
                    pos = r.iloc[i] if r is not None and i < len(r) else None
                    # Non-likuid = DI LUAR 150 besar nilai transaksi trailing.
                    # Ambangnya sama dengan yang dipakai IDX untuk semesta
                    # indeks utamanya (peringkat relatif, bukan rupiah tetap).
                    if pos is None or pd.isna(pos) or pos <= 150:
                        continue
                t = simulasi_trade(d, i, MODEL_MASUK, MODEL_KELUAR, BIAYA)
                if not t:
                    continue
                if t['return'] > AMBANG_RETURN[tf]:
                    dibuang.append({'kode': kode, 'tgl': d['tgl'][i], 'return': t['return']})
                    continue
                t['kode'] = kode
                t['tgl_sinyal'] = d['tgl'][i]
                t['tier_likuiditas'] = semesta
                trades.append(t)
        if not trades:
            print(f'  {nama:<14} nol trade')
            continue
        akhir = max(t['tgl_keluar'] for t in trades)
        params = {
            'indikator': nama, 'kerangka': tf, 'semesta': semesta,
            'model_masuk': MODEL_MASUK, 'model_keluar': MODEL_KELUAR,
            'min_bar': MIN_BAR, 'n_emiten': len(bars),
        }
        ring = ringkas_trades(trades, ihsg_return(ihsg, '2000-01-01', None), BIAYA, params)
        ring['tak_berarah_tidak_diuji'] = TAK_BERARAH
        ring['n_trade_disimpan_sebagai_contoh'] = min(CONTOH_TRADE, len(trades))
        ring['ambang_return_mustahil'] = AMBANG_RETURN[tf]
        ring['n_trade_dibuang_mustahil'] = len(dibuang)
        ring['trade_dibuang_terbesar'] = sorted(
            dibuang, key=lambda x: -x['return'])[:5]
        # Kerapuhan: kalau profit factor jatuh drastis begitu lima trade
        # teratas dibuang, angkanya milik segelintir kejadian - bukan sifat
        # sinyalnya. Dicetak supaya pembaca tak perlu menghitung sendiri.
        r = sorted((t['return'] for t in trades), reverse=True)
        kalah = abs(sum(x for x in r if x <= 0))
        ring['profit_factor_tanpa_5_teratas'] = (
            (sum(x for x in r[5:] if x > 0) / kalah) if kalah else None)
        ring['return_terbesar'] = r[0] if r else None
        if dangkal:
            ring['peringatan_kedalaman'] = (
                'Arsip intraday cuma 70 hari bursa (29 Mei–4 Sep 2026). Angka ini '
                'mewakili SATU rezim pasar; jangan dibaca sebagai bukti keunggulan sinyal.'
            )
        print(f'  {nama:<14} n={ring["n_trade"]:<6} win={ring["win_rate"]:.3f} '
              f'med={ring["median_return"]:+.4f} pf={ring["profit_factor"] or 0:.2f} '
              f'pf5={ring["profit_factor_tanpa_5_teratas"] or 0:.2f} '
              f'buang={len(dibuang)}')
        if tulis:
            # Ringkasan + contoh, bukan daftar penuh (lihat CONTOH_TRADE).
            tulis_ringkas(f'ind-{nama}-{tf}-{semesta}', params, ring,
                          trades[:CONTOH_TRADE], akhir)
    return 0


def tulis_ringkas(strategi: str, params: dict, ringkasan: dict,
                  contoh: list[dict], akhir_data: str | None) -> None:
    """Tulis satu berkas ringkasan + perbarui index bersama.

    Sengaja TIDAK memakai `tulis_hasil` bt_papan: fungsi itu menyimpan
    seluruh daftar trade, yang benar untuk run strategi (belasan run,
    ratusan trade) tapi salah untuk run indikator (165 kombinasi, ratusan
    ribu trade). Index-nya tetap yang sama supaya semua run backtest
    terdaftar di satu tempat.
    """
    import hashlib
    from datetime import datetime
    from bt_papan import BT_DIR, perbarui_index

    BT_DIR.mkdir(parents=True, exist_ok=True)
    h8 = hashlib.sha256(json.dumps(params, sort_keys=True, default=str).encode()).hexdigest()[:8]
    jalur = BT_DIR / f"{strategi}-{h8}.json"
    isi = {
        "strategi": strategi, "hash": h8, "parameter": params,
        "akhir_data": akhir_data,
        "dibuat": datetime.now().isoformat(timespec="seconds"),
        "ringkasan": ringkasan,
        "trades_contoh": contoh,
    }
    jalur.write_text(json.dumps(isi, ensure_ascii=False, default=str), encoding="utf-8")
    perbarui_index(strategi, h8, jalur.name, params, ringkasan, akhir_data)


def swauji() -> int:
    """Periksa bagian yang bisa salah tanpa satu pun galat."""
    # 1. Silang naik hanya menandai perlintasan, bukan "berada di atas".
    a = pd.Series([1.0, 2, 3, 4, 3, 2])
    b = pd.Series([2.0, 2, 2, 2, 2, 2])
    assert list(_silang_naik(a, b)) == [False, False, True, False, False, False], list(_silang_naik(a, b))

    # 2. Rakit pekanan: tutup ember = tutup bar TERAKHIR, waktunya kunci ember.
    d = {'kode': 'X',
         'tgl': ['2026-08-17', '2026-08-18', '2026-08-21', '2026-08-24', '2026-08-28'],
         'o': [1, 1, 1, 1, 1], 'h': [2, 6, 11, 21, 31], 'l': [1, 1, 1, 1, 1],
         'c': [100, 105, 110, 120, 130], 'value': [1, 1, 1, 1, 1], 'lot': [1, 1, 1, 1, 1]}
    w = rakit(d, _kunci_pekan)
    assert w['tgl'] == ['2026-08-17', '2026-08-24'], w['tgl']
    assert w['c'] == [110, 130], w['c']
    assert w['h'] == [11, 31], w['h']
    assert w['value'] == [3, 2], w['value']

    # 3. Ember 4 jam: dua per hari, bukan empat.
    assert _kunci_4jam('2026-09-04 09:00') == '2026-09-04 09:00'
    assert _kunci_4jam('2026-09-04 11:00') == '2026-09-04 09:00'
    assert _kunci_4jam('2026-09-04 13:00') == '2026-09-04 13:00'
    assert _kunci_4jam('2026-09-04 15:00') == '2026-09-04 13:00'

    # 4. RSI di deret naik monoton mendekati 100, dan sinyalnya TIDAK menyala
    #    (tak ada perlintasan dari bawah 30).
    naik = pd.Series(np.arange(1, 80, dtype=float))
    r = _rsi(naik)
    assert r.iloc[-1] > 95, r.iloc[-1]
    df = pd.DataFrame({'o': naik, 'h': naik, 'l': naik, 'c': naik, 'v': naik, 'val': naik})
    assert not sinyal('rsi', df).any()

    # 5. Tiap indikator berarah menghasilkan Series boolean sepanjang deret,
    #    tanpa melempar — penjaga paling murah terhadap salah ketik nama ruas.
    n = 300
    rng = np.random.default_rng(7)
    c = pd.Series(100 + np.cumsum(rng.normal(0, 1, n)))
    df = pd.DataFrame({'o': c, 'h': c + 1, 'l': c - 1, 'c': c, 'v': pd.Series(rng.integers(1, 99, n)), 'val': c})
    df.index = pd.Index([f'2026-01-{1 + i % 28:02d} {9 + i % 6:02d}:00' for i in range(n)])
    for nama in BERARAH:
        s = sinyal(nama, df)
        assert len(s) == n, nama
        assert s.dtype == bool, (nama, s.dtype)

    # 6b. Ambang mustahil terdefinisi untuk SETIAP kerangka, dan yang harian
    #     lebih ketat daripada pekanan - batas auto-reject berantai memang
    #     mengikat di lima bar harian, tidak di lima bar pekanan.
    assert set(AMBANG_RETURN) == {'1H', '4H', 'D', 'W', 'M'}
    assert AMBANG_RETURN['D'] < AMBANG_RETURN['W'] < AMBANG_RETURN['M']
    assert AMBANG_RETURN['1H'] < AMBANG_RETURN['D']

    # 6. Supertrend BERBALIK, bukan "harga melintas pita bebas". Deret
    #    gelombang panjang wajib memberi pembalikan berulang; versi pertama
    #    yang salah cuma memberi 21 sinyal di 45 emiten x 26 tahun, dan
    #    profit factor 8,90 yang menyertainya justru terlihat menggiurkan.
    t = np.arange(600)
    gel = pd.Series(100 + 20 * np.sin(t / 25.0))
    dfg = pd.DataFrame({"o": gel, "h": gel + 1, "l": gel - 1, "c": gel,
                        "v": pd.Series(np.ones(600)), "val": gel})
    n_balik = int(sinyal("supertrend", dfg).sum())
    # ~600/(2*pi*25) ~ 3,8 siklus penuh; tiap siklus satu pembalikan naik.
    assert 2 <= n_balik <= 8, n_balik
    # Dan pembalikannya TIDAK boleh menyala di tiap bar naik.
    assert n_balik < int((gel.diff() > 0).sum()) / 10, n_balik

    # 6. Volume & ATR memang TIDAK ada di daftar yang diuji.
    assert 'volume' not in BERARAH and 'atr' not in BERARAH
    assert set(TAK_BERARAH) == {'volume', 'atr'}

    print('swauji lolos')
    return 0


if __name__ == '__main__':
    sys.exit(main())
