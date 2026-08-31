"""Benchmark aturan Area Beli / TP / Batas Rugi — banyak varian, satu harness.

Perintah Johan 31 Agu 2026: *"perlu di benchmarking dong data yang cocok untuk
menghasilkan win rate tinggi ... baik data 5 hari, 10 hari, 20 hari, 60 hari
bahkan bisa pakai EMA 20, 50, 100, 200 untuk menentukan Area Beli, TP1, TP2,
Batas Rugi"*.

## Kenapa satu harness, bukan satu skrip per varian

Pelajaran hari ini (lihat `docs/jejak-permintaan.md`): uji horizon pertama
membandingkan 5/10/20 hari pada PERIODE YANG BERBEDA — horizon 20 harus
berhenti 20 hari lebih awal, jadi horizon 5 kebagian dua pekan terakhir yang
sedang kuat. Arah temuannya bertahan tapi jaraknya menyusut, dan urutan per
saham terbalik. Karena itu harness ini memaksa tiga kendali sekaligus:

1. **Hari sinyal IDENTIK** untuk seluruh varian dan seluruh horizon — dipotong
   di `len(bar) - HOR_MAX - 1`, jadi jendela terpanjang pun tutup penuh.
2. **Satu pemindaian, semua horizon.** Tiap (saham, hari, aturan) dipindai
   sekali sampai `HOR_MAX` bar; yang disimpan `bar_ke` — bar keberapa TP/SL
   tersentuh. Horizon H tinggal membaca `bar_ke <= H`. Tanpa ini, horizon
   berbeda bisa diam-diam memakai sampel berbeda.
3. **Saringan masuk dipisah dari hasil.** Bendera saringan (di atas EMA20 dsb.)
   disimpan per hari, bukan dipakai menyaring sebelum pemindaian — jadi
   kombinasi saringan mana pun bisa diagregasi TANPA menghitung ulang, dan
   semuanya berbagi sampel dasar yang sama.

## Yang diukur, dan kenapa BUKAN win rate

Win rate sendirian menyesatkan kalau target dan batas rugi tak sama jauh:
aturan produksi memasang TP di +1×ATR dan SL di -1,5×ATR, jadi menang sering
tapi kecil, kalah jarang tapi besar. Angka utama di sini **ekspektansi** —
rata-rata hasil per sinyal, sudah menimbang besar untung dan besar rugi.
Win rate tetap dilaporkan sebagai pendamping, bukan sebagai vonis.

Keluaran: JSON berisi tiap sel (aturan x saringan x horizon) dengan menang,
kalah, menggantung, win rate, ekspektansi, dan median lama tahan.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from kartu_analisa import ke_fraksi  # noqa: E402

AKAR = Path(__file__).resolve().parents[2]
OHLC = AKAR / 'data-idx' / 'json' / 'ohlc'

HOR_LIST = [5, 10, 20, 60]
HOR_MAX = max(HOR_LIST)
N_HARI = 250          # hari sinyal per emiten
MIN_BAR = 400         # riwayat minimum supaya EMA200 matang
MIN_HARGA = 50        # jangan uji saham gocap — fraksinya bikin TP/SL tak berarti
MIN_NILAI = 5e8       # median nilai transaksi 20 hari, Rp — buang yang tak bisa dimasuki


# ---------------------------------------------------------------- indikator
def ema(x: np.ndarray, n: int) -> np.ndarray:
    """EMA baku (alpha = 2/(n+1)), disemai dengan SMA n bar pertama.

    Nilai sebelum bar ke-n dibiarkan NaN — BUKAN diisi harga, karena EMA yang
    belum matang akan membuat saringan "di atas EMA200" lolos di awal riwayat
    padahal belum ada dasarnya.
    """
    a = 2.0 / (n + 1.0)
    out = np.full(x.shape, np.nan)
    if len(x) < n:
        return out
    out[n - 1] = x[:n].mean()
    for i in range(n, len(x)):
        out[i] = a * x[i] + (1 - a) * out[i - 1]
    return out


def atr_wilder(h: np.ndarray, l: np.ndarray, c: np.ndarray, n: int = 14) -> np.ndarray:
    """ATR Wilder — SAMA dengan `kartu_analisa.atr`, tapi mengembalikan deret
    (nilai di tiap bar), bukan satu angka di ujung. Wajib sama supaya angka
    benchmark bisa dibandingkan dengan yang dipakai produksi."""
    out = np.full(c.shape, np.nan)
    if len(c) < n + 1:
        return out
    tr = np.maximum.reduce([
        h[1:] - l[1:],
        np.abs(h[1:] - c[:-1]),
        np.abs(l[1:] - c[:-1]),
    ])
    a = tr[:n].mean()
    out[n] = a
    for i in range(n, len(tr)):
        a = (a * (n - 1) + tr[i]) / n
        out[i + 1] = a
    return out


def gulir_min(x: np.ndarray, n: int) -> np.ndarray:
    out = np.full(x.shape, np.nan)
    for i in range(n - 1, len(x)):
        out[i] = x[i - n + 1:i + 1].min()
    return out


# ------------------------------------------------------------------ aturan
# Tiap aturan: (id, label, fungsi(ctx) -> (tp, sl)) dengan ctx dict berisi
# skalar untuk SATU hari. `None` berarti aturan tak berlaku hari itu (mis.
# EMA-nya di atas harga, jadi tak bisa jadi batas rugi) — hari itu dilewati,
# TIDAK dihitung sebagai kalah.
def _aturan():
    A = []

    def tam(id_, label, fn, keluarga):
        A.append({'id': id_, 'label': label, 'fn': fn, 'keluarga': keluarga})

    # -- keluarga ATR: target dan batas dari volatilitas saham itu sendiri ---
    tam('atr-produksi', 'ATR +1,0 / -1,5 (+ terendah 5h) — dipakai sekarang',
        lambda x: (x['c'] + 1.0 * x['atr'], min(x['low5'], x['c'] - 1.5 * x['atr'])), 'ATR')
    tam('atr-1-1.5', 'ATR +1,0 / -1,5 (tanpa terendah 5h)',
        lambda x: (x['c'] + 1.0 * x['atr'], x['c'] - 1.5 * x['atr']), 'ATR')
    tam('atr-1-1', 'ATR +1,0 / -1,0 (simetris)',
        lambda x: (x['c'] + 1.0 * x['atr'], x['c'] - 1.0 * x['atr']), 'ATR')
    tam('atr-1.5-1', 'ATR +1,5 / -1,0 (imbalan > risiko)',
        lambda x: (x['c'] + 1.5 * x['atr'], x['c'] - 1.0 * x['atr']), 'ATR')
    tam('atr-2-1', 'ATR +2,0 / -1,0',
        lambda x: (x['c'] + 2.0 * x['atr'], x['c'] - 1.0 * x['atr']), 'ATR')
    tam('atr-3-1', 'ATR +3,0 / -1,0',
        lambda x: (x['c'] + 3.0 * x['atr'], x['c'] - 1.0 * x['atr']), 'ATR')
    tam('atr-2-1.5', 'ATR +2,0 / -1,5',
        lambda x: (x['c'] + 2.0 * x['atr'], x['c'] - 1.5 * x['atr']), 'ATR')
    tam('atr-0.5-0.5', 'ATR +0,5 / -0,5 (sempit, cepat tuntas)',
        lambda x: (x['c'] + 0.5 * x['atr'], x['c'] - 0.5 * x['atr']), 'ATR')

    # -- keluarga EMA: batas rugi di garis rata-rata, target dicerminkan -----
    #    Alasan cermin: kalau EMA jadi batas, jarak ke EMA itulah risiko yang
    #    diterima; target sejauh itu memberi imbalan:risiko 1,0 apa adanya
    #    tanpa memilih angka baru.
    for n in (20, 50, 100, 200):
        tam(f'ema{n}-cermin', f'Batas di EMA{n}, target sejauh jarak yang sama',
            (lambda nn: lambda x: (
                (x['c'] + (x['c'] - x[f'ema{nn}']), x[f'ema{nn}'])
                if x[f'ema{nn}'] == x[f'ema{nn}'] and x[f'ema{nn}'] < x['c'] else None
            ))(n), 'EMA')
        tam(f'ema{n}-atr1', f'Batas di EMA{n}, target +1×ATR',
            (lambda nn: lambda x: (
                (x['c'] + x['atr'], x[f'ema{nn}'])
                if x[f'ema{nn}'] == x[f'ema{nn}'] and x[f'ema{nn}'] < x['c'] else None
            ))(n), 'EMA')

    # -- keluarga terendah-N: batas di dasar harga yang benar-benar terjadi --
    for n in (5, 10, 20):
        tam(f'low{n}-atr1', f'Batas di terendah {n} hari, target +1×ATR',
            (lambda nn: lambda x: (
                (x['c'] + x['atr'], x[f'low{nn}'])
                if x[f'low{nn}'] == x[f'low{nn}'] and x[f'low{nn}'] < x['c'] else None
            ))(n), 'Terendah-N')

    # -- keluarga persen tetap: pembanding paling naif -----------------------
    for tp, sl in ((5, 5), (10, 5), (5, 3), (10, 10)):
        tam(f'pct-{tp}-{sl}', f'Tetap +{tp}% / -{sl}%',
            (lambda t, s: lambda x: (x['c'] * (1 + t / 100), x['c'] * (1 - s / 100)))(tp, sl),
            'Persen tetap')
    return A


ATURAN = _aturan()

# ------------------------------------------------------------------ saringan
# Bendera per hari. Disimpan terpisah dari hasil supaya kombinasi mana pun
# bisa diagregasi tanpa memindai ulang.
SARINGAN = [
    ('semua', 'Semua hari (tanpa saringan)'),
    ('atas-ema20', 'Harga di atas EMA20'),
    ('atas-ema50', 'Harga di atas EMA50'),
    ('atas-ema200', 'Harga di atas EMA200'),
    ('ema20-atas-ema50', 'EMA20 di atas EMA50 (tren naik)'),
    ('tersusun', 'Harga > EMA20 > EMA50 > EMA100 (tersusun rapi)'),
    ('atas-ema20-vol', 'Di atas EMA20 + volume di atas rata-rata 20h'),
]


def muat(kode: str):
    p = OHLC / f'{kode}.json'
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text(encoding='utf-8'))['d']
    except (KeyError, ValueError):
        # berkas tanpa ruas 'd' (mis. penanda gagal panen) — lewati, jangan
        # menghentikan seluruh benchmark karena satu emiten
        return None
    d = [r for r in d if len(r) >= 6 and r[5] > 0]   # buang bar tanpa volume (aturan produksi)
    if len(d) < MIN_BAR:
        return None
    return {
        'tgl': [r[0] for r in d],
        'o': np.array([r[1] for r in d], dtype=float),
        'h': np.array([r[2] for r in d], dtype=float),
        'l': np.array([r[3] for r in d], dtype=float),
        'c': np.array([r[4] for r in d], dtype=float),
        'v': np.array([r[5] for r in d], dtype=float),
    }


def olah(b):
    c, h, l, v = b['c'], b['h'], b['l'], b['v']
    ctx = {
        'atr': atr_wilder(h, l, c),
        'low5': gulir_min(l, 5), 'low10': gulir_min(l, 10), 'low20': gulir_min(l, 20),
    }
    for n in (20, 50, 100, 200):
        ctx[f'ema{n}'] = ema(c, n)
    vol20 = np.full(v.shape, np.nan)
    for i in range(19, len(v)):
        vol20[i] = v[i - 19:i + 1].mean()
    ctx['vol20'] = vol20
    return ctx


def bendera(b, ctx, i) -> dict:
    c = b['c'][i]
    e20, e50, e100, e200 = (ctx[f'ema{n}'][i] for n in (20, 50, 100, 200))
    ok = lambda x: x == x  # noqa: E731  (bukan NaN)
    return {
        'semua': True,
        'atas-ema20': ok(e20) and c > e20,
        'atas-ema50': ok(e50) and c > e50,
        'atas-ema200': ok(e200) and c > e200,
        'ema20-atas-ema50': ok(e20) and ok(e50) and e20 > e50,
        'tersusun': ok(e20) and ok(e50) and ok(e100) and c > e20 > e50 > e100,
        'atas-ema20-vol': ok(e20) and c > e20 and ctx['vol20'][i] == ctx['vol20'][i]
                          and b['v'][i] > ctx['vol20'][i],
    }


def pindai(b, i, tp, sl):
    """Satu pemindaian sampai HOR_MAX bar. Balikan (hasil, bar_ke).

    `bar_ke` = bar keberapa sesudah sinyal TP/SL tersentuh; horizon H tinggal
    memeriksa `bar_ke <= H`. Kena DUA-DUANYA di hari yang sama = 'tak-tentu'
    (data harian tak tahu urutan intraday) — aturan yang sama persis dengan
    `winRate.ts:menangTpSlH5`, jangan diubah sepihak di sini.
    """
    h, l = b['h'], b['l']
    n = len(h)
    for k in range(1, HOR_MAX + 1):
        j = i + k
        if j >= n:
            return None, None
        kena_tp = h[j] >= tp
        kena_sl = l[j] <= sl
        if kena_tp and kena_sl:
            return 'tak-tentu', k
        if kena_tp:
            return 'menang', k
        if kena_sl:
            return 'kalah', k
    return 'menggantung', None


def jalan(kode_list, n_hari=N_HARI):
    """Kembalikan sel per (aturan, saringan, horizon, periode).

    `periode` memecah rentang uji jadi dua PARUH BERURUTAN — 'lama' (separuh
    awal) dan 'baru' (separuh akhir) — plus 'semua'. Ini uji luar sampel yang
    paling murah dan paling sulit dibantah: aturan yang cuma bagus di satu
    paruh ketahuan tanpa perlu menunggu bulan depan. Tanpa ini, "aturan
    terbaik" berisiko cuma aturan yang paling cocok dengan rezim pasar yang
    kebetulan mendominasi rentang uji.
    """
    sel = {}
    n_emiten = 0
    n_sinyal = 0
    for kode in kode_list:
        b = muat(kode)
        if b is None:
            continue
        c = b['c']
        ctx = olah(b)
        akhir = len(c) - HOR_MAX - 1
        mulai = max(200, akhir - n_hari + 1)     # 200 = EMA200 sudah matang
        if akhir < mulai:
            continue
        # likuiditas: median nilai 20 hari terakhir dari periode uji
        nilai = np.median((c * b['v'])[max(0, akhir - 19):akhir + 1])
        if nilai < MIN_NILAI:
            continue
        n_emiten += 1
        tengah = (mulai + akhir) // 2
        for i in range(mulai, akhir + 1):
            periode = ('semua', 'lama' if i <= tengah else 'baru')
            if c[i] < MIN_HARGA or ctx['atr'][i] != ctx['atr'][i]:
                continue
            bd = bendera(b, ctx, i)
            x = {'c': c[i], 'atr': ctx['atr'][i]}
            for k in ('low5', 'low10', 'low20', 'ema20', 'ema50', 'ema100', 'ema200'):
                x[k] = ctx[k][i]
            n_sinyal += 1
            for at in ATURAN:
                r = at['fn'](x)
                if r is None:
                    continue
                tp_raw, sl_raw = r
                if tp_raw != tp_raw or sl_raw != sl_raw:
                    continue
                tp = ke_fraksi(tp_raw, 'atas')
                sl = ke_fraksi(sl_raw, 'bawah')
                if tp <= c[i] or sl >= c[i]:
                    continue
                up = 100 * (tp / c[i] - 1)
                dn = 100 * (1 - sl / c[i])
                hasil, bar_ke = pindai(b, i, tp, sl)
                if hasil is None:
                    continue
                for sid, _ in SARINGAN:
                    if not bd[sid]:
                        continue
                    for H in HOR_LIST:
                        for pr in periode:
                            s = sel.setdefault((at['id'], sid, H, pr),
                                               [0, 0, 0, 0.0, 0.0, [], 0.0])
                            s[6] += dn              # risiko yang ditanggung, tiap sinyal
                            if hasil == 'menggantung' or bar_ke is None or bar_ke > H:
                                s[2] += 1
                            elif hasil == 'menang':
                                s[0] += 1
                                s[3] += up
                                s[5].append(bar_ke)
                            elif hasil == 'kalah':
                                s[1] += 1
                                s[4] += dn
                                s[5].append(bar_ke)
                            else:                   # tak-tentu
                                s[2] += 1
    return sel, n_emiten, n_sinyal


def rapikan(sel):
    """Sel -> baris siap baca.

    Angka utamanya `eks_R`, BUKAN `eks`. Ekspektansi mentah dalam persen tak
    bisa dibandingkan antar aturan yang menanggung risiko berbeda: aturan yang
    memasang batas rugi 30% di bawah harga akan terlihat unggul semata karena
    tiap kemenangannya besar. `eks_R` membagi ekspektansi dengan risiko
    rata-rata yang benar-benar ditanggung (jarak harga ke batas rugi, dirata
    atas SELURUH sinyal termasuk yang menggantung), jadi ia terbaca sebagai
    "berapa kali risiko yang didapat per sinyal" — satuan yang sama untuk
    semua aturan.
    """
    out = []
    lbl = {a['id']: (a['label'], a['keluarga']) for a in ATURAN}
    slbl = dict(SARINGAN)
    for (aid, sid, H, pr), s in sel.items():
        m, k, g, U, D, bars, R = s
        d = m + k
        if d < 50:                                  # sel terlalu tipis, jangan diberi angka
            continue
        n = d + g
        risiko = R / n if n else None
        eks = (U - D) / d
        out.append({
            'aturan': aid, 'label': lbl[aid][0], 'keluarga': lbl[aid][1],
            'saringan': sid, 'saringan_label': slbl[sid], 'horizon': H, 'periode': pr,
            'menang': m, 'kalah': k, 'menggantung': g,
            'wr': round(100 * m / d, 2),
            'tuntas': round(100 * d / n, 2),
            'eks': round(eks, 4),
            'eks_R': round(eks / risiko, 4) if risiko else None,
            'risiko_rata': round(risiko, 3) if risiko else None,
            'untung_rata': round(U / m, 3) if m else None,
            'rugi_rata': round(D / k, 3) if k else None,
            'bar_median': float(np.median(bars)) if bars else None,
        })
    out.sort(key=lambda r: -(r['eks_R'] or -9))
    return out


def main():
    kode = sorted(f.stem for f in OHLC.glob('*.json') if f.stem != 'IHSG')
    batas = None
    if '--emiten' in sys.argv:
        batas = int(sys.argv[sys.argv.index('--emiten') + 1])
    if batas:
        # ambil merata sepanjang abjad supaya tak jadi sampel A-B saja
        langkah = max(1, len(kode) // batas)
        kode = kode[::langkah][:batas]
    print(f'benchmark: {len(kode)} kandidat emiten, {len(ATURAN)} aturan, '
          f'{len(SARINGAN)} saringan, horizon {HOR_LIST}', flush=True)
    sel, n_em, n_sig = jalan(kode)
    hasil = rapikan(sel)
    keluar = Path(os.environ.get('SP', '.')) / 'benchmark_aturan.json'
    keluar.write_text(json.dumps({
        'n_emiten': n_em, 'n_hari_sinyal': n_sig, 'horizon': HOR_LIST,
        'aturan': [{'id': a['id'], 'label': a['label'], 'keluarga': a['keluarga']} for a in ATURAN],
        'saringan': [{'id': s, 'label': l} for s, l in SARINGAN],
        'sel': hasil,
    }, ensure_ascii=False), encoding='utf-8')
    print(f'{n_em} emiten lolos saringan likuiditas, {n_sig} hari sinyal, '
          f'{len(hasil)} sel berisi >= 30 hasil tuntas', flush=True)
    print(f'-> {keluar}', flush=True)
    # peta untuk uji paruh: (aturan, saringan, H) -> eks_R per periode
    per = {}
    for r in hasil:
        per.setdefault((r['aturan'], r['saringan'], r['horizon']), {})[r['periode']] = r

    print()
    print('20 SEL TERBAIK menurut EKSPEKTANSI PER RISIKO (eks/R), periode penuh')
    print('kolom lama/baru = eks/R di paruh awal vs paruh akhir — uji luar sampel termurah')
    print(f"{'aturan':<16} {'saringan':<18} {'H':>3} {'WR':>7} {'tuntas':>7} "
          f"{'eks':>8} {'eks/R':>7} {'lama':>7} {'baru':>7}  n")
    n_cetak = 0
    for r in hasil:
        if r['periode'] != 'semua':
            continue
        p = per[(r['aturan'], r['saringan'], r['horizon'])]
        lama = p.get('lama', {}).get('eks_R')
        baru = p.get('baru', {}).get('eks_R')
        print(f"{r['aturan']:<16} {r['saringan']:<18} {r['horizon']:>3} "
              f"{r['wr']:>6.1f}% {r['tuntas']:>6.1f}% {r['eks']:>+7.3f}% {r['eks_R']:>+7.3f} "
              f"{(f'{lama:+.3f}' if lama is not None else '   -  '):>7} "
              f"{(f'{baru:+.3f}' if baru is not None else '   -  '):>7}  "
              f"{r['menang']}-{r['kalah']}")
        n_cetak += 1
        if n_cetak >= 20:
            break
    print()
    print('ACUAN — aturan produksi, tanpa saringan, periode penuh:')
    for r in hasil:
        if r['aturan'] == 'atr-produksi' and r['saringan'] == 'semua' and r['periode'] == 'semua':
            p = per[(r['aturan'], r['saringan'], r['horizon'])]
            print(f"  H={r['horizon']:>2}  WR {r['wr']:>5.1f}%  tuntas {r['tuntas']:>5.1f}%  "
                  f"eks {r['eks']:>+.3f}%  eks/R {r['eks_R']:>+.3f}  "
                  f"(lama {p.get('lama', {}).get('eks_R')}, baru {p.get('baru', {}).get('eks_R')})")


if __name__ == '__main__':
    main()
