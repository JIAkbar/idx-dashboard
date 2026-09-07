"""Rollup Top Broker lintas hari (#29) — nol jaringan, satu sumber.

Johan, di halaman Top Broker: *"dan di page ini apakah tidak bisa range waktu ?
kita punya data hasil panen looh"*.

## Sumbernya SAMA dengan yang sudah dipajang halaman, dan itu keputusan

Usulan di baris antrean mengambil rentang dari arsip broker per emiten
(`broker_harian/`, Stockbit) sambil menandai sumbernya berbeda dari "Hari Ini"
yang resmi. Diperiksa dulu sebelum dikerjakan: `data-idx/json/broker/bs_*.json`
— rekap broker harian resmi yang SUDAH dibaca halaman ini — memuat **seluruh 88
broker** dengan vol/nilai/frekuensi, bukan cuma sepuluh teratas. Jadi rentangnya
bisa dijumlah dari sumber yang sama persis.

Itu lebih baik dari dua sisi. Angkanya tak perlu diberi catatan kaki "sumber
berbeda", dan aturan proyek soal jahitan sumber (CLAUDE.md 3b: mengganti atau
menjahit sumber = keputusan Johan, bukan agen) tak perlu dilanggar sama sekali.

## Yang TIDAK ikut dijumlah, dan kenapa

Blok "Top Stock by Volume/Value/Frequency" di halaman yang sama datang dari
`ds_*.json` dan isinya **cuma sepuluh teratas per hari**. Menjumlah sepuluh
besar harian lalu menyebutnya peringkat sepekan adalah kesalahan diam-diam:
emiten yang tiap hari ada di peringkat 11 tak pernah terhitung, padahal
jumlahnya sepekan bisa mengalahkan yang sempat sekali masuk sepuluh besar.
Daftar broker tak punya masalah itu — ia lengkap.

    python scripts/bangun_broker_rentang.py            # laporan
    python scripts/bangun_broker_rentang.py --tulis
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

AKAR = Path(__file__).resolve().parents[1]
SUMBER = AKAR / 'data-idx' / 'json' / 'broker'
KELUAR = AKAR / 'data-idx' / 'json' / 'broker_rentang'

# Kunci preset PERSIS `PresetRentang` di `app/src/lib/dasbor/periode.ts`, dan
# jumlah harinya persis `HARI_PRESET` — dua tempat yang harus sepakat, jadi
# angkanya ditulis dengan rujukan, bukan ditebak ulang.
PRESET: dict[str, int | None] = {
    'h5': 5,      # 5 Hari  — hari BURSA, bukan kalender (lihat `ambil`)
    'w1': 7,
    'b1': 30,
    'b3': 91,
    'ytd': None,  # sejak 1 Januari tahun berjalan
}


def berkas_harian() -> list[tuple[str, Path]]:
    """(tanggal ISO, jalur) urut naik. Nama berkas `bs_yymmdd.json`."""
    keluar = []
    for p in SUMBER.glob('bs_*.json'):
        n = p.stem[3:]
        if len(n) != 6 or not n.isdigit():
            continue
        keluar.append((f'20{n[0:2]}-{n[2:4]}-{n[4:6]}', p))
    return sorted(keluar)


def ambil(semua: list[tuple[str, Path]], preset: str) -> list[tuple[str, Path]]:
    """Potong daftar hari bursa untuk satu preset.

    `h5` dihitung sebagai lima hari BURSA terakhir — bukan lima hari kalender.
    Sisanya dihitung mundur dari tanggal terakhir yang berdata, jadi akhir
    pekan dan libur bursa tak diam-diam memendekkan rentangnya.
    """
    if not semua:
        return []
    akhir = date.fromisoformat(semua[-1][0])
    n = PRESET[preset]
    if preset == 'h5':
        return semua[-5:]
    if n is None:
        mulai = date(akhir.year, 1, 1)
    else:
        mulai = akhir - timedelta(days=n - 1)
    return [(t, p) for t, p in semua if date.fromisoformat(t) >= mulai]


def rollup(hari: list[tuple[str, Path]]) -> dict:
    vol: dict[str, float] = defaultdict(float)
    val: dict[str, float] = defaultdict(float)
    frek: dict[str, float] = defaultdict(float)
    nama: dict[str, str] = {}
    dipakai: list[str] = []

    for tgl, p in hari:
        try:
            d = json.loads(io.open(p, encoding='utf-8').read())
        except Exception:
            continue
        baris = d.get('brokers') or []
        if not baris:
            continue
        dipakai.append(tgl)
        for b in baris:
            k = b.get('kode')
            if not k:
                continue
            nama.setdefault(k, b.get('nama') or k)
            vol[k] += float(b.get('vol') or 0)
            val[k] += float(b.get('val') or 0)
            frek[k] += float(b.get('frek') or 0)

    def peringkat(agg: dict[str, float], pembagi: float) -> list[dict]:
        """`pembagi` menyamakan SATUAN dengan tabel harian di halaman.

        Bukan kosmetik: judul kolomnya berbunyi "Juta Saham" dan "Miliar IDR",
        sementara rekap hariannya menyimpan angka mentah. Tanpa pembagi, mode
        rentang mencetak 2.571.637.602.996 di kolom yang bertuliskan juta —
        angka yang benar dengan label yang salah, dan itu lebih buruk daripada
        angka yang jelas-jelas rusak karena tak ada yang curiga.
        """
        total = sum(agg.values()) or 1
        urut = sorted(agg.items(), key=lambda kv: -kv[1])[:10]
        return [{'cd': k, 'nm': nama[k], 'v': round(v / pembagi, 2),
                 'p': round(v / total * 100, 2)} for k, v in urut]

    return {
        'mulai': dipakai[0] if dipakai else None,
        'akhir': dipakai[-1] if dipakai else None,
        'n_hari': len(dipakai),
        'hari': dipakai,
        'n_broker': len(nama),
        # Satuan sama dengan tabel harian: juta lembar, miliar rupiah, kali.
        'broker_vol': peringkat(vol, 1e6),
        'broker_val': peringkat(val, 1e9),
        'broker_freq': peringkat(frek, 1),
    }


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--tulis', action='store_true')
    a = ap.parse_args()

    semua = berkas_harian()
    if not semua:
        print('tak ada berkas bs_*.json — tak ada yang bisa dirollup')
        return 1
    print(f'{len(semua)} hari bursa tersedia, {semua[0][0]} .. {semua[-1][0]}')

    if a.tulis:
        KELUAR.mkdir(parents=True, exist_ok=True)
    for preset in PRESET:
        hasil = rollup(ambil(semua, preset))
        teratas = hasil['broker_val'][0] if hasil['broker_val'] else None
        print(f"  {preset:<4} {hasil['n_hari']:>3} hari  {hasil['mulai']} .. {hasil['akhir']}"
              f"  teratas(nilai) {teratas['cd'] if teratas else '-'}")
        if a.tulis:
            (KELUAR / f'{preset}.json').write_text(
                json.dumps(hasil, ensure_ascii=False, indent=1), encoding='utf-8')
    if a.tulis:
        print(f'-> {KELUAR.relative_to(AKAR)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
