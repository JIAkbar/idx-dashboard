"""Uji mesin RBS sisi Python — dan uji PARITAS-nya dengan sisi TypeScript.

Kontraknya berkas `__fixtures__/rbs-mesin-harapan.json`: kedua bahasa
menjalankan fixture yang sama dan hasilnya wajib sama persis. Selama uji ini
dan `polaRbs.test.ts` sama-sama hijau, kalimat "satu mesin" punya bukti.

    python scripts/riset/uji_rbs_mesin.py
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rbs_mesin import (  # noqa: E402
    PARAM_DASAR, ParamRbs, cari_rbs, param_rbs, pivot_high_idx,
)

AKAR = Path(__file__).resolve().parents[2]
FIX = AKAR / 'app' / 'src' / 'lib' / 'dasbor' / '__fixtures__'


def _baca(nama: str) -> dict:
    return json.loads(io.open(FIX / nama, encoding='utf-8').read())


def uji_pivot_asimetris() -> None:
    """Deret DATAR menandai tepat SATU pivot, bukan setiap barnya."""
    datar = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9]
    assert pivot_high_idx(datar, 2) == [], f'datar tanpa penurunan: {pivot_high_idx(datar, 2)}'
    puncak = [1, 2, 3, 9, 9, 9, 3, 2, 1]
    # Bar 5 (yang terakhir dari deretan datar) satu-satunya pivot.
    assert pivot_high_idx(puncak, 2) == [5], pivot_high_idx(puncak, 2)


def uji_level_beku() -> None:
    """Sentuhan SESUDAH level lahir tak boleh menggeser harganya.

    Ini kebocoran masa depan yang ditutup #49: mesin chart lama memakai
    rata-rata seluruh sentuhan, jadi harga yang dipakai memutuskan breakout
    ikut ditentukan pivot yang belum terjadi.
    """
    # Dua puncak di 100 dan 101 (level lahir di 100,5), lalu puncak KETIGA di
    # 99 jauh kemudian. Level harus tetap 100,5 — kalau ia bergeser jadi 100,
    # berarti sentuhan ketiga menulis ulang keputusan yang sudah lewat.
    bar: list[list] = []
    tinggi = [90] * 6 + [100] + [90] * 11 + [101] + [90] * 11 + [99] + [90] * 10
    for i, h in enumerate(tinggi):
        tgl = f'2026-{1 + i // 28:02d}-{1 + i % 28:02d}'
        bar.append([tgl, 88, h, 87, 88, 1000])
    hasil = cari_rbs(bar, ParamRbs(pivot_n=3, klaster_pct=0.05, jendela_klaster=200))
    assert hasil, 'harus ada satu level'
    lvl = hasil[0]['level']
    assert abs(lvl - 100.5) < 1e-9, f'level bocor ke sentuhan ketiga: {lvl}'
    assert hasil[0]['sentuhan'] == 3, 'sentuhan ketiga tetap DICATAT, cuma tak menggeser harga'


def uji_paritas_fixture() -> None:
    fixture = _baca('rbs-mesin.json')
    harapan = _baca('rbs-mesin-harapan.json')
    hasil = cari_rbs(fixture['d'], param_rbs(fixture['kerangka']))
    assert hasil == harapan['level'], (
        'keluaran Python berbeda dari kontrak bersama.\n'
        f'python  : {json.dumps(hasil, ensure_ascii=False)}\n'
        f'kontrak : {json.dumps(harapan["level"], ensure_ascii=False)}'
    )


def uji_bbca_nyata() -> None:
    """Angka yang bisa dicek tangan di layar — kriteria terima #49."""
    fixture = _baca('rbs-mesin.json')
    hasil = cari_rbs(fixture['d'], PARAM_DASAR)
    sah = [lv for lv in hasil if lv['status'] == 'sah']
    assert len(sah) == 1, f'BBCA harian: harusnya satu level sah, dapat {len(sah)}'
    assert round(sah[0]['level']) == 6588, sah[0]['level']
    assert sah[0]['tanggal_breakout'] == '2026-09-02', sah[0]
    assert sah[0]['tanggal_retest'] == '2026-09-03', sah[0]


def uji_param_kerangka() -> None:
    assert param_rbs('D').retest_bar == 20
    assert param_rbs('W').retest_bar == 10
    assert param_rbs('tak-dikenal') is PARAM_DASAR


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    uji = [uji_pivot_asimetris, uji_level_beku, uji_paritas_fixture, uji_bbca_nyata, uji_param_kerangka]
    gagal = 0
    for f in uji:
        try:
            f()
            print(f'  OK   {f.__name__}')
        except AssertionError as e:
            gagal += 1
            print(f'  GAGAL {f.__name__}: {e}')
    print(f'\n{len(uji) - gagal}/{len(uji)} lolos')
    return 1 if gagal else 0


if __name__ == '__main__':
    raise SystemExit(main())
