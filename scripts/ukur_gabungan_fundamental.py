"""A0: ukur dampak penggabungan keuangan/ + fundamental/ di panel Stock Detail.

Mencerminkan aturan di app/src/lib/dasbor/fundamentalGabungan.ts (PADANAN_KUARTAL,
PADANAN_TAHUNAN, PADANAN_TTM, PADANAN_KINI) — kalau tabel padanan di sana berubah,
perbarui juga di sini supaya angka before/after tetap benar.

Pakai: python scripts/ukur_gabungan_fundamental.py
"""
import json
import os
from glob import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEUANGAN_DIR = os.path.join(ROOT, 'data-idx', 'json', 'keuangan')
FUNDAMENTAL_DIR = os.path.join(ROOT, 'data-idx', 'json', 'fundamental')

ALL_FIELDS = [
    'revenue', 'cogs', 'gross_profit', 'operating_income', 'net_income', 'eps',
    'total_assets', 'total_liabilities', 'equity', 'cash', 'total_debt',
    'operating_cf', 'investing_cf', 'financing_cf', 'free_cf',
]

Q_MAP = {
    'revenue': 'q_revenue', 'net_income': 'q_net_income', 'eps': 'q_eps',
    'gross_profit': 'q_gross', 'operating_income': 'q_op_income',
    'total_assets': 'q_assets', 'equity': 'q_equity', 'total_debt': 'q_debt',
    'cash': 'q_cash', 'operating_cf': 'q_ocf', 'free_cf': 'q_fcf',
}
TTM_MAP = {
    'revenue': 'ttm_revenue', 'gross_profit': 'ttm_gross', 'operating_income': 'ttm_op_income',
    'net_income': 'ttm_net_income', 'eps': 'eps', 'operating_cf': 'ttm_ocf',
    'investing_cf': 'ttm_icf', 'financing_cf': 'ttm_fincf', 'free_cf': 'ttm_fcf',
}
KINI_MAP = {
    'total_assets': 'lq_assets', 'total_liabilities': 'lq_tot_liab',
    'equity': 'lq_equity', 'cash': 'lq_cash', 'total_debt': 'lq_total_debt',
}


def nilai_gabungan(field, nilai_keuangan, iso, fd):
    """Versi Python dari gabungkanBaris() mode='kuartal', terbaru=True."""
    if nilai_keuangan is not None:
        return nilai_keuangan
    if fd is None:
        return None
    tahun, bulan, _ = iso.split('-')
    kuartal = f'Q{(int(bulan) - 1) // 3 + 1}'
    qf = Q_MAP.get(field)
    if qf:
        v = (fd.get(qf) or {}).get(tahun, {}).get(kuartal)
        if v is not None:
            return v
    tf = TTM_MAP.get(field)
    if tf and fd.get(tf) is not None:
        return fd[tf]
    kf = KINI_MAP.get(field)
    if kf and fd.get(kf) is not None:
        return fd[kf]
    return None


def main():
    files = sorted(glob(os.path.join(KEUANGAN_DIR, '*.json')))
    before = {f: 0 for f in ALL_FIELDS}
    after = {f: 0 for f in ALL_FIELDS}
    n = 0
    for path in files:
        ticker = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding='utf-8') as fh:
            kd = json.load(fh)
        kuartal = kd.get('kuartal') or {}
        if not kuartal:
            continue
        n += 1
        iso = sorted(kuartal.keys())[-1]
        periode = kuartal[iso]

        fd_path = os.path.join(FUNDAMENTAL_DIR, f'{ticker}.json')
        fd = None
        if os.path.exists(fd_path):
            with open(fd_path, encoding='utf-8') as fh:
                fd = json.load(fh)

        for field in ALL_FIELDS:
            if periode.get(field) is not None:
                before[field] += 1
                after[field] += 1
                continue
            if nilai_gabungan(field, None, iso, fd) is not None:
                after[field] += 1

    print(f'{n} emiten dengan data kuartal - kolom kuartal TERBARU per emiten\n')
    print(f'{"field":<20s}{"sebelum":>10s}{"sesudah":>10s}')
    for field in ALL_FIELDS:
        b = before[field] / n * 100
        a = after[field] / n * 100
        print(f'{field:<20s}{b:9.1f}%{a:9.1f}%')

    print(f'\noperating_cf - angka yang diminta diukur: {before["operating_cf"]}/{n} '
          f'({before["operating_cf"] / n * 100:.1f}%) -> {after["operating_cf"]}/{n} '
          f'({after["operating_cf"] / n * 100:.1f}%)')


if __name__ == '__main__':
    main()
