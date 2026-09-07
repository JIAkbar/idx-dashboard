"""Mesin RBS — SATU aturan, padanan persis `app/src/lib/dasbor/polaRbs.ts`.

Sebelum 7 Sep 2026 ada DUA mesin yang berbeda diam-diam: `polaRbs.ts` untuk
garis di chart dan `deteksi_rbs()` di `bt_papan.py` untuk backtest. Enam titik
berbeda — pivot, saat level lahir, jendela cek "belum ditutup di atasnya",
cara level dihitung, batas pencarian breakout, dan bentuk pita retest — jadi
angka backtest tak pernah benar-benar menggambarkan garis yang dilihat orang.

Berkas ini menutup itu. Aturannya ditulis sekali di sini dan sekali di
`polaRbs.ts`, dan KESAMAANNYA DIBUKTIKAN, bukan diklaim: kedua bahasa
menjalankan fixture yang sama (`app/src/lib/dasbor/__fixtures__/rbs-mesin.json`)
dan hasilnya dibandingkan level demi level (`uji_rbs_mesin.py`).

Kausalitas — dan inilah yang paling berubah dari mesin chart yang lama:

* Pivot di bar `i` baru DIKETAHUI di bar `i + pivot_n`; sebelum itu ia tak
  boleh memutuskan apa pun.
* Harga level DIBEKUKAN saat level lahir. Mesin chart lama memakai rata-rata
  SELURUH sentuhan termasuk yang terjadi sesudah breakout — jadi harga yang
  dipakai memutuskan breakout sebagian ditentukan bar yang belum ada.

    python scripts/riset/rbs_mesin.py --fixture     # jalankan atas fixture bersama
    python scripts/riset/rbs_mesin.py --kode BBCA   # atas arsip harian
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2]
FIXTURE = AKAR / 'app' / 'src' / 'lib' / 'dasbor' / '__fixtures__' / 'rbs-mesin.json'


@dataclass(frozen=True)
class ParamRbs:
    pivot_n: int = 5
    klaster_pct: float = 0.015
    jendela_klaster: int = 120
    breakout_pct: float = 0.01
    retest_tol_pct: float = 0.01
    retest_bar: int = 20
    konfirmasi_pct: float = 0.02
    konfirmasi_bar: int = 3


PARAM_DASAR = ParamRbs()
# Yang berbeda per kerangka cuma jendela retest — 20 bar harian sebulan; 20
# PEKAN hampir setengah tahun, dan menuntut itu berarti hampir tak ada level
# pekanan yang pernah berstatus selain `breakout`.
PARAM: dict[str, ParamRbs] = {
    '1h': ParamRbs(retest_bar=20),
    '4h': ParamRbs(retest_bar=20),
    'D': PARAM_DASAR,
    'W': ParamRbs(retest_bar=10),
    'M': ParamRbs(retest_bar=10),
}


def param_rbs(kerangka: str) -> ParamRbs:
    return PARAM.get(kerangka, PARAM_DASAR)


def pivot_high_idx(high: list[float], n: int) -> list[int]:
    """Puncak lokal, perbandingan ASIMETRIS (`<` kiri, `<=` kanan).

    Simetris menandai SETIAP bar dalam deretan datar sebagai pivot — meledak
    jadi ratusan pivot palsu di papan tipis. Asimetris menandai tepat satu.
    """
    idx: list[int] = []
    for i in range(n, len(high) - n):
        ok = True
        for k in range(1, n + 1):
            if high[i] < high[i - k] or high[i] <= high[i + k]:
                ok = False
                break
        if ok:
            idx.append(i)
    return idx


def _klaster(high: list[float], piv: list[int], p: ParamRbs) -> list[dict]:
    klaster: list[dict] = []
    for i in piv:
        h = high[i]
        cocok = None
        for kl in klaster:
            if i - kl['idx'][0] <= p.jendela_klaster and abs(h - kl['acuan']) / kl['acuan'] <= p.klaster_pct:
                cocok = kl
                break
        if cocok is None:
            klaster.append({'acuan': h, 'idx': [i], 'i_lahir': -1})
            continue
        cocok['idx'].append(i)
        if cocok['i_lahir'] == -1:
            cocok['acuan'] = sum(high[j] for j in cocok['idx']) / len(cocok['idx'])
            if len(cocok['idx']) >= 2:
                cocok['i_lahir'] = i + p.pivot_n
        # Sesudah lahir: sentuhan tetap dicatat, harga TIDAK digeser.
    return [kl for kl in klaster if len(kl['idx']) >= 2 and kl['i_lahir'] >= 0]


def cari_rbs(bar: list[list], p: ParamRbs = PARAM_DASAR) -> list[dict]:
    """`bar` = [tanggal, o, h, l, c, volume] urut naik."""
    if len(bar) < p.pivot_n * 2 + 1:
        return []
    tgl = [b[0] for b in bar]
    high = [float(b[2]) for b in bar]
    low = [float(b[3]) for b in bar]
    close = [float(b[4]) for b in bar]
    n = len(bar)
    keluar: list[dict] = []

    for kl in _klaster(high, pivot_high_idx(high, p.pivot_n), p):
        idx_urut = sorted(kl['idx'])
        level = kl['acuan']
        i_lahir = kl['i_lahir']
        if i_lahir >= n:
            continue

        if any(close[j] > level for j in range(idx_urut[0], i_lahir + 1)):
            continue

        status = 'resistance'
        tgl_breakout = tgl_retest = tgl_konfirmasi = None

        i_bo = next((j for j in range(i_lahir + 1, n) if close[j] > level * (1 + p.breakout_pct)), -1)
        if i_bo != -1:
            status = 'breakout'
            tgl_breakout = tgl[i_bo]
            batas_rt = min(n - 1, i_bo + p.retest_bar)
            i_rt = next((j for j in range(i_bo + 1, batas_rt + 1)
                         if low[j] <= level * (1 + p.retest_tol_pct)), -1)
            if i_rt != -1:
                status = 'retest'
                tgl_retest = tgl[i_rt]
                if close[i_rt] < level:
                    status = 'gagal'
                else:
                    batas_k = min(n - 1, i_rt + p.konfirmasi_bar)
                    for j in range(i_rt, batas_k + 1):
                        if close[j] >= level * (1 + p.konfirmasi_pct):
                            status = 'sah'
                            tgl_konfirmasi = tgl[j]
                            break

        keluar.append({
            'level': level,
            'status': status,
            'tanggal_pivot': [tgl[i] for i in idx_urut],
            'tanggal_breakout': tgl_breakout,
            'tanggal_retest': tgl_retest,
            'tanggal_konfirmasi': tgl_konfirmasi,
            'sentuhan': len(idx_urut),
        })

    return sorted(keluar, key=lambda x: x['level'])


def _bar_fixture() -> list[list]:
    return json.loads(io.open(FIXTURE, encoding='utf-8').read())['d']


def _bar_kode(kode: str) -> list[list]:
    p = AKAR / 'data-idx' / 'json' / 'ohlc' / f'{kode}.json'
    return json.loads(io.open(p, encoding='utf-8').read())['d']


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--fixture', action='store_true')
    ap.add_argument('--kode')
    ap.add_argument('--kerangka', default='D')
    ap.add_argument('--json', action='store_true', help='keluarkan JSON mentah (dipakai uji lintas bahasa)')
    a = ap.parse_args()

    bar = _bar_fixture() if a.fixture or not a.kode else _bar_kode(a.kode)
    hasil = cari_rbs(bar, param_rbs(a.kerangka))
    if a.json:
        print(json.dumps({'param': asdict(param_rbs(a.kerangka)), 'level': hasil}, ensure_ascii=False))
        return 0
    print(f'{len(bar)} bar {bar[0][0]} .. {bar[-1][0]} · kerangka {a.kerangka}')
    print(f'{len(hasil)} level')
    for lv in hasil:
        print(f"  {lv['level']:>12,.2f}  {lv['status']:<11} sentuhan {lv['sentuhan']}"
              f"  breakout {lv['tanggal_breakout'] or '-'}"
              f"  retest {lv['tanggal_retest'] or '-'}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
