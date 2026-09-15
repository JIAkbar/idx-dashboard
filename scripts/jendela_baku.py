"""Satu definisi rentang waktu untuk skrip: cermin `jendelaBaku()` di
`app/src/lib/dasbor/periode.ts` (referensi J20, keputusan Johan #209, 15 Sep 2026).

Pembanding = hari berdata terakhir pada atau sebelum (hari aktif - N hari
kalender). Jendela = hari berdata sesudah pembanding sampai hari aktif.
Jumlah memakai jendela; return memakai tutup pembanding. `h1` = hari berdata
sebelumnya, `sejakJan` = 31 Des tahun lalu, `semua` = tanpa pembanding.
None = data tidak cukup; jendela TIDAK dipotong ke riwayat yang ada.

    python scripts/jendela_baku.py   # uji bawaan, kasus sama dengan periode.test.ts
"""
from __future__ import annotations

from bisect import bisect_right
from datetime import date, timedelta

KUNCI = ('h1', 'w1', 'w2', 'b1', 'b3', 'b6', 'sejakJan', 'y1', 'y2', 'semua')
HARI_KALENDER = {'w1': 7, 'w2': 14, 'b1': 30, 'b3': 91, 'b6': 182, 'y1': 365, 'y2': 730}


def geser(iso: str, hari: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=hari)).isoformat()


def batas(akhir: str, kunci: str) -> str | None:
    """Tanggal batas kalender; hari berdata SESUDAH batas masuk jendela."""
    if kunci == 'semua':
        return None
    if kunci == 'h1':
        return geser(akhir, -1)
    if kunci == 'sejakJan':
        return f'{int(akhir[:4]) - 1}-12-31'
    return geser(akhir, -HARI_KALENDER[kunci])


def jendela(tanggal: list[str], akhir: str, kunci: str) -> dict | None:
    """`tanggal` ISO urut naik. Kembalikan {pembanding, mulai, akhir} atau None."""
    i_akhir = bisect_right(tanggal, akhir) - 1
    if i_akhir < 0:
        return None
    akhir_ef = tanggal[i_akhir]
    b = batas(akhir_ef, kunci)
    if b is None:
        return {'pembanding': None, 'mulai': tanggal[0], 'akhir': akhir_ef}
    i_pemb = min(bisect_right(tanggal, b), i_akhir) - 1
    if i_pemb < 0:
        return None
    return {'pembanding': tanggal[i_pemb], 'mulai': tanggal[i_pemb + 1], 'akhir': akhir_ef}


def uji() -> None:
    T = ['2025-12-30', '2025-12-31', '2026-01-02', '2026-09-07', '2026-09-08',
         '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15']
    assert jendela(T, '2026-09-15', 'w1') == {'pembanding': '2026-09-08', 'mulai': '2026-09-09', 'akhir': '2026-09-15'}
    assert jendela(T, '2026-09-15', 'h1') == {'pembanding': '2026-09-14', 'mulai': '2026-09-15', 'akhir': '2026-09-15'}
    assert jendela(T, '2026-09-13', 'h1') == {'pembanding': '2026-09-10', 'mulai': '2026-09-11', 'akhir': '2026-09-11'}
    assert jendela(T, '2026-09-15', 'sejakJan') == {'pembanding': '2025-12-31', 'mulai': '2026-01-02', 'akhir': '2026-09-15'}
    assert jendela(T, '2026-09-15', 'semua') == {'pembanding': None, 'mulai': '2025-12-30', 'akhir': '2026-09-15'}
    assert jendela(T, '2026-09-15', 'y2') is None
    assert jendela(['2026-09-15'], '2026-09-15', 'h1') is None
    # Hari kerja 2 Jan 2024 - 15 Sep 2026: batas per label (tabel J20 di periode.test.ts).
    H, d = [], date(2024, 1, 2)
    while d <= date(2026, 9, 15):
        if d.weekday() < 5:
            H.append(d.isoformat())
        d += timedelta(days=1)
    for k, pemb in [('w2', '2026-09-01'), ('b1', '2026-08-14'), ('b3', '2026-06-16'),
                    ('b6', '2026-03-17'), ('y1', '2025-09-15'), ('y2', '2024-09-13')]:
        assert jendela(H, '2026-09-15', k)['pembanding'] == pemb, (k, jendela(H, '2026-09-15', k))
    print('OK  jendela_baku: 13 pemeriksaan lolos')


if __name__ == '__main__':
    uji()
