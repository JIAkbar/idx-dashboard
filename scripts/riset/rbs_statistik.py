"""Statistik pola RBS per KERANGKA — angka yang dipajang di chart (#49 §5).

Menggantikan konstanta `RINGKAS_BACKTEST_RBS` yang dulu tertulis mati di
`polaRbs.ts` ("617 breakout -> 79% retest -> 71% bertahan"). Angka itu lahir
dari semesta top-100 statis, tak pernah dihitung ulang, dan BERTENTANGAN dengan
berkas backtest di repo yang sama. Sekarang angkanya dihitung dari arsip, per
kerangka, dan chart membacanya dari berkas — tak ada lagi salinan kedua yang
bisa diam-diam berbeda.

Yang dihitung, dan tiap satunya sengaja:

* `n`            — berapa level yang pernah breakout. Tanpa n, persentase tak
                   berarti apa-apa.
* `median_h20`   — return median 20 bar sesudah RETEST bertahan. Median, bukan
                   rata-rata: sebaran return saham berekor panjang.
* `pct_sl`       — berapa persen kena stop 3% di bawah level sebelum H+20.
* `tersensor`    — berapa yang datanya HABIS sebelum H+20. Dulu dibuang diam-
                   diam; membuangnya tanpa menyebutnya membuat sisanya terlihat
                   lebih pasti daripada yang sebenarnya.

    python scripts/riset/rbs_statistik.py --kerangka D
    python scripts/riset/rbs_statistik.py --kerangka D W --tulis
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rbs_mesin import cari_rbs, param_rbs  # noqa: E402

AKAR = Path(__file__).resolve().parents[2]
OHLC = AKAR / 'data-idx' / 'json' / 'ohlc'
BT = AKAR / 'data-idx' / 'json' / 'bt'
KANDIDAT = AKAR / 'data-idx' / 'json' / 'rbs_kandidat.json'

SL_PCT = 0.03
HORIZON = 20
# Hari terakhir sinyal masih disebut "kandidat" — sesudah ini ia riwayat.
KANDIDAT_HARI = 30


def median(xs: list[float]) -> float | None:
    if not xs:
        return None
    s = sorted(xs)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def rakit(bar: list[list], kerangka: str) -> list[list]:
    """Bar harian -> bar kerangka. Kunci ember: Senin (W), tanggal 1 (M)."""
    if kerangka == 'D':
        return bar
    ember: dict[str, list] = {}
    for b in bar:
        t = date.fromisoformat(b[0])
        k = (t - timedelta(days=t.weekday())).isoformat() if kerangka == 'W' else f'{t.year}-{t.month:02d}-01'
        e = ember.get(k)
        if e is None:
            ember[k] = [k, b[1], b[2], b[3], b[4], b[5]]
        else:
            e[2] = max(e[2], b[2])
            e[3] = min(e[3], b[3])
            e[4] = b[4]
            e[5] += b[5]
    return [ember[k] for k in sorted(ember)]


def statistik(kerangka: str, kode_saja: list[str] | None = None) -> dict:
    p = param_rbs(kerangka)
    berkas = sorted(OHLC.glob('*.json'))
    if kode_saja:
        pilih = {k.upper() for k in kode_saja}
        berkas = [b for b in berkas if b.stem.upper() in pilih]

    n_bo = 0
    n_retest = 0
    n_bertahan = 0
    ret_h20: list[float] = []
    n_sl = 0
    n_sensor = 0
    n_emiten = 0
    kandidat: list[dict] = []
    batas_kandidat = (date.today() - timedelta(days=KANDIDAT_HARI)).isoformat()

    for f in berkas:
        if f.stem == 'IHSG':
            continue
        try:
            d = json.loads(io.open(f, encoding='utf-8').read())
        except Exception:
            continue
        bar = rakit(d.get('d') or [], kerangka)
        if len(bar) < 60:
            continue
        n_emiten += 1
        close = [float(b[4]) for b in bar]
        low = [float(b[3]) for b in bar]
        tgl = [b[0] for b in bar]
        idx = {t: i for i, t in enumerate(tgl)}

        for lv in cari_rbs(bar, p):
            if lv['tanggal_breakout'] is None:
                continue
            n_bo += 1
            if lv['tanggal_retest'] is None:
                continue
            n_retest += 1
            if lv['status'] == 'gagal':
                continue
            n_bertahan += 1
            i_rt = idx[lv['tanggal_retest']]
            level = lv['level']

            # Kandidat dikumpulkan SEBELUM pemeriksaan sensor — dan itu bukan
            # detail urutan. Sinyal paling baru SELALU yang datanya belum genap
            # H+20; memeriksanya belakangan berarti daftar kandidat selalu
            # kosong justru untuk yang paling relevan (terukur: 0 kandidat pada
            # jalan pertama, padahal BBCA 6.588 sah 3 Sep ada di dalamnya).
            if lv['status'] == 'sah' and lv['tanggal_retest'] >= batas_kandidat:
                kandidat.append({
                    'kode': f.stem, 'kerangka': kerangka, 'level': round(level, 2),
                    'tanggal_breakout': lv['tanggal_breakout'],
                    'tanggal_retest': lv['tanggal_retest'],
                    'status': lv['status'], 'sentuhan': lv['sentuhan'],
                })

            batas = i_rt + HORIZON
            if batas >= len(bar):
                # Data habis sebelum H+20 — DIHITUNG, bukan dibuang.
                n_sensor += 1
                continue
            # Return H+20 dihitung untuk SEMUA yang genap, termasuk yang sempat
            # menyentuh batas rugi. Versi pertama skrip ini cuma menjumlah yang
            # SELAMAT, dan hasilnya median +6% berdampingan dengan "65% kena
            # batas rugi" — dua angka yang bersama-sama membuat pola ini terbaca
            # seperti sinyal beli. Yang menjawab "kalau semua sinyal diambil,
            # apa yang terjadi" adalah median seluruhnya.
            if any(low[j] <= level * (1 - SL_PCT) for j in range(i_rt + 1, batas + 1)):
                n_sl += 1
            ret_h20.append((close[batas] - close[i_rt]) / close[i_rt] * 100)

    dinilai = len(ret_h20)
    return {
        'kerangka': kerangka,
        'parameter': {'retest_tol_pct': p.retest_tol_pct, 'retest_bar': p.retest_bar,
                      'sl_pct': SL_PCT, 'horizon': HORIZON},
        'n_emiten': n_emiten,
        'n_breakout': n_bo,
        'n_retest': n_retest,
        'n_bertahan': n_bertahan,
        'n_dinilai': dinilai,
        'n_tersensor': n_sensor,
        'pct_retest': round(n_retest / n_bo * 100, 1) if n_bo else None,
        'pct_bertahan': round(n_bertahan / n_retest * 100, 1) if n_retest else None,
        'pct_sl': round(n_sl / dinilai * 100, 1) if dinilai else None,
        'median_h20': round(median(ret_h20), 2) if ret_h20 else None,
        '_kandidat': kandidat,
    }


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--kerangka', nargs='+', default=['D'])
    ap.add_argument('--kode', nargs='*')
    ap.add_argument('--tulis', action='store_true')
    a = ap.parse_args()

    semua_kandidat: list[dict] = []
    for k in a.kerangka:
        s = statistik(k, a.kode)
        semua_kandidat.extend(s.pop('_kandidat'))
        print(f"\n[{k}] {s['n_emiten']} emiten · {s['n_breakout']} breakout · "
              f"retest {s['pct_retest']}% · bertahan {s['pct_bertahan']}%")
        print(f"     dinilai {s['n_dinilai']} · tersensor {s['n_tersensor']} · "
              f"kena SL {s['pct_sl']}% · median H+{HORIZON} {s['median_h20']}%")
        if a.tulis:
            BT.mkdir(parents=True, exist_ok=True)
            p = BT / f'rbs-stat-{k}.json'
            p.write_text(json.dumps(s, ensure_ascii=False, indent=1), encoding='utf-8')
            print(f'     -> {p.relative_to(AKAR)}')

    if a.tulis:
        semua_kandidat.sort(key=lambda x: (x['tanggal_retest'], x['kode']), reverse=True)
        KANDIDAT.write_text(json.dumps({
            'catatan': ('Pemasok ide Deep Dive (#49 §6): level RBS berstatus sah dengan retest '
                        f'{KANDIDAT_HARI} hari terakhir. BUKAN sinyal beli — daftar penyaring.'),
            'kerangka': a.kerangka, 'n': len(semua_kandidat), 'kandidat': semua_kandidat,
        }, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f"\n{len(semua_kandidat)} kandidat -> {KANDIDAT.relative_to(AKAR)}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
