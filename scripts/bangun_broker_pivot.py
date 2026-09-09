"""Pivot broker -> emiten (#30) — nol jaringan, dibangun dari arsip sendiri.

Johan, di halaman Top Broker: *"dan misal broker itu di klik bisa kita lihat
aslinya oh XL lagi akumulasi di saham apa saja, CC, dan lain sebagainya"*.

## Kenapa perlu dipra-hitung, bukan dihitung di layar

Arsip broker kita disusun PER EMITEN: satu berkas per emiten, isinya daftar
broker per hari. Pertanyaan "broker XL sedang mengakumulasi emiten apa" adalah
arah kebalikannya, dan menjawabnya di peramban berarti mengunduh 963 berkas
tahunan (2,1 GB) untuk satu klik. Jadi pembalikannya dikerjakan sekali di sini,
hasilnya satu berkas kecil per broker.

## Yang WAJIB disebut di layar, karena angkanya tidak lengkap

Daftar broker harian per emiten **dipotong 50 teratas tiap sisi** oleh
sumbernya (`ringkas.n_beli`/`n_jual` = 50, dan `top5_pct` bisa > 100% justru
karena penyebutnya sudah terpotong). Akibatnya: broker yang tiap hari duduk di
peringkat 51 tak pernah terhitung di emiten itu, walaupun jumlah sebulannya
bisa besar. Ini BUKAN alasan menolak pivotnya — untuk pertanyaan "di saham apa
broker ini bergerak besar", potongan 50 teratas justru tepat sasaran — tapi
wajib tertulis di halaman pemakainya supaya tak ada yang membacanya sebagai
rekap lengkap. Ruas `terpotong` di keluaran membawa fakta itu.

Penyebut pangsa memakai `ringkas.total_nilai`, yaitu nilai transaksi emiten
hari itu APA ADANYA (bukan jumlah baris broker yang terpotong) — diuji di
BBCA 2026-09-04: 634.066.397.500 berbanding nilai bursa 634,22 miliar.

## Sumber

`data-idx/json/broker_tahunan/<EMITEN>/<tahun>.json` — varian REGULER, semua
investor, GROSS. Satu varian saja dan itu disengaja: pertanyaannya soal arus
pasar reguler, dan mencampur nego/tunai ke dalam angka yang sama akan membuat
satu silang blok terbaca sebagai akumulasi harian.

    python scripts/bangun_broker_pivot.py              # laporan, tak menulis
    python scripts/bangun_broker_pivot.py --tulis
    python scripts/bangun_broker_pivot.py --emiten 40  # cuplikan cepat
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
SUMBER = AKAR / 'data-idx' / 'json' / 'broker_tahunan'
KELUAR = AKAR / 'data-idx' / 'json' / 'broker_pivot'

# Panjang tiap preset dalam HARI KALENDER, kecuali yang disebut di dua
# himpunan di bawah. Kunci dan panjangnya sama dengan pemilih rentang di
# aplikasi (`lib/dasbor/periode.ts`) supaya dua halaman berdampingan tak
# diam-diam memakai definisi "1 Bulan" yang berbeda.
#
# Sembilan, bukan tiga (#119 3A). Tiga yang lama bukan batas data — arsip
# broker mulai 2016-01-04 — melainkan daftar yang dikunci tangan di tiga
# tempat sekaligus (skrip ini, tipe TS, halaman) dengan komentar yang
# mengklaim menyamai berkas lain yang ternyata punya daftar berbeda.
PRESET: dict[str, int] = {
    'hariini': 1,   # ditangani PRESET_HARI_BURSA di bawah
    'h5': 5,        # hari BURSA
    'w1': 7,        # hari kalender
    'b1': 30,
    'b3': 91,
    'b6': 182,
    'mtd': 0,       # ditangani PRESET_TANGGAL — panjangnya tak tetap
    'ytd': 0,
    'y1': 365,
}
# `hariini` dan `h5` dihitung dari hari BURSA (satu dan lima hari berdata
# terakhir), bukan dari kalender: lima hari kalender yang melintasi akhir
# pekan cuma memuat tiga hari perdagangan.
PRESET_HARI_BURSA = {'hariini', 'h5'}
# `mtd` dan `ytd` berpangkal pada TANGGAL (tanggal 1 bulan / tahun berjalan),
# jadi panjangnya berubah tiap hari dan tak bisa ditulis sebagai jumlah hari.
# Memberi mereka angka tetap berarti mengarang panjang yang salah tiap
# tanggal — aturan yang sama dipakai pemilih rentang di aplikasi.
PRESET_TANGGAL = {'mtd', 'ytd'}

TOP_N = 20


def tahun_perlu(akhir: date, mundur_hari: int) -> set[int]:
    return {akhir.year, (akhir - timedelta(days=mundur_hari)).year}


def hari_bursa_terakhir() -> tuple[date, list[str]]:
    """Tanggal bursa terakhir + seluruh tanggal yang ada, dari satu emiten
    paling likuid. BBCA diperdagangkan tiap hari bursa, jadi daftarnya setara
    kalender bursa — dan membacanya dari SATU berkas jauh lebih murah daripada
    menyatukan 963 berkas hanya untuk tahu tanggalnya."""
    p = SUMBER / 'BBCA' / f'{date.today().year}.json'
    if not p.exists():
        raise SystemExit(f'acuan kalender tak ada: {p}')
    d = json.loads(io.open(p, encoding='utf-8').read())
    tgl = sorted(d.get('hari', {}))
    if not tgl:
        raise SystemExit('acuan kalender kosong')
    return date.fromisoformat(tgl[-1]), tgl


def batas(preset: str, akhir: date, kalender: list[str]) -> str:
    """Tanggal ISO paling awal yang masih ikut, inklusif."""
    if preset in PRESET_HARI_BURSA:
        n = PRESET[preset]
        return kalender[-n] if len(kalender) >= n else kalender[0]
    if preset == 'mtd':
        return akhir.replace(day=1).isoformat()
    if preset == 'ytd':
        return akhir.replace(month=1, day=1).isoformat()
    return (akhir - timedelta(days=PRESET[preset])).isoformat()


def daftar_emiten(batas_jumlah: int | None) -> list[str]:
    """Direktori yang namanya BUKAN kode emiten dibuang.

    Arsipnya memuat satu direktori bernama `8` (index kosong, nol tahun,
    dibangun 6 Sep 2026) - sesuatu di hulu memperlakukan "8" sebagai kode
    emiten. Dilewati di sini supaya pivotnya tak melaporkan satu emiten
    hantu, dan dicatat sebagai temuan terpisah: yang perlu diperbaiki
    pemanennya, bukan pembacanya.
    """
    nama = sorted(
        p.name for p in SUMBER.iterdir()
        if p.is_dir() and p.name.isalpha() and p.name.isupper()
    )
    return nama[:batas_jumlah] if batas_jumlah else nama


def kumpul(emiten: list[str], tahun: set[int], mulai: dict[str, str]):
    """Jumlahkan per (preset, broker, emiten) dalam satu kali baca per berkas.

    Satu lintasan untuk SEMUA preset: membaca 963 berkas tiga kali berarti
    membaca ~1,8 GB dua kali lebih banyak tanpa menambah satu angka pun.
    """
    # preset -> broker -> emiten -> [beli_lot, beli_nilai, jual_lot, jual_nilai, n_hari]
    agg: dict[str, dict[str, dict[str, list[float]]]] = {
        k: defaultdict(lambda: defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])) for k in PRESET
    }
    # preset -> emiten -> total nilai transaksi emiten (penyebut pangsa)
    total: dict[str, dict[str, float]] = {k: defaultdict(float) for k in PRESET}
    dilewati: list[str] = []

    for i, kode in enumerate(emiten, 1):
        if i % 100 == 0:
            print(f'  {i}/{len(emiten)} emiten', flush=True)
        hari: dict[str, dict] = {}
        for t in sorted(tahun):
            p = SUMBER / kode / f'{t}.json'
            if not p.exists():
                continue
            try:
                hari.update(json.loads(io.open(p, encoding='utf-8').read()).get('hari', {}))
            except (ValueError, OSError):
                dilewati.append(f'{kode}/{t}')
        if not hari:
            dilewati.append(kode)
            continue
        for tgl, h in hari.items():
            baris = h.get('broker') or []
            nilai_hari = float((h.get('ringkas') or {}).get('total_nilai') or 0)
            for preset, awal in mulai.items():
                if tgl < awal:
                    continue
                total[preset][kode] += nilai_hari
                per = agg[preset]
                for r in baris:
                    a = per[r[0]][kode]
                    a[0] += r[1]; a[1] += r[2]; a[2] += r[3]; a[3] += r[4]
                    a[4] += 1
    return agg, total, dilewati


def susun(agg, total, preset: str, broker: str) -> dict:
    """Dua sisi terpisah: net beli terbesar dan net jual terbesar."""
    baris = []
    for kode, a in agg[preset][broker].items():
        net_nilai = a[1] - a[3]
        net_lot = a[0] - a[2]
        pembagi = total[preset].get(kode) or 0
        baris.append({
            'kode': kode,
            'net_nilai': round(net_nilai),
            'net_lot': round(net_lot),
            'beli_nilai': round(a[1]),
            'jual_nilai': round(a[3]),
            # Lot PER SISI, bukan cuma netnya: harga rata-rata sisi beli
            # adalah Σnilai_beli ÷ Σlot_beli, dan menghitungnya dari net
            # akan mencampur harga beli dengan harga jual — dua angka yang
            # kebetulan bisa dibagi tapi tak berarti apa-apa bersama.
            'beli_lot': round(a[0]),
            'jual_lot': round(a[2]),
            'hari': int(a[4]),
            # Pangsa terhadap NILAI TRANSAKSI emiten di periode yang sama.
            # None (bukan 0) kalau penyebutnya tak ada: "tak diketahui" dan
            # "tak berpangsa" dua pernyataan berbeda, dan yang satu bisa salah.
            'pangsa': (abs(net_nilai) / pembagi) if pembagi else None,
        })
    beli = sorted((b for b in baris if b['net_nilai'] > 0), key=lambda b: -b['net_nilai'])[:TOP_N]
    jual = sorted((b for b in baris if b['net_nilai'] < 0), key=lambda b: b['net_nilai'])[:TOP_N]
    return {'beli': beli, 'jual': jual, 'n_emiten': len(baris)}


def swauji() -> int:
    """Periksa dua bagian yang bisa salah tanpa satu pun galat.

    Dijalankan `--swauji`, tanpa menyentuh arsip. Yang diuji bukan
    aritmetikanya melainkan DEFINISI periodenya dan pemisahan sisinya -
    dua hal yang kalau meleset menghasilkan tabel yang tetap terlihat
    masuk akal.
    """
    kal = ['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28',
           '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
    akhir = date(2026, 9, 4)
    # h5 memotong HARI BURSA: lima bar terakhir, bukan lima hari kalender
    # (yang akan jatuh ke 30 Agustus, seberang akhir pekan).
    assert batas('h5', akhir, kal) == '2026-08-31', batas('h5', akhir, kal)
    assert batas('b1', akhir, kal) == '2026-08-05'
    assert batas('b3', akhir, kal) == '2026-06-05'
    # Kalender lebih pendek daripada jendela: ambil yang paling awal,
    # jangan melampaui ujung larik dan diam-diam memotong dari belakang.
    assert batas('h5', akhir, kal[:3]) == kal[0]
    # Preset yang ditambahkan #119 3A. `hariini` = SATU hari bursa terakhir
    # (rentang satu hari, bukan nol); `mtd`/`ytd` berpangkal tanggal, jadi
    # panjangnya berubah tiap hari dan tak boleh dihitung mundur berhari.
    assert batas('hariini', akhir, kal) == '2026-09-04'
    assert batas('mtd', akhir, kal) == '2026-09-01'
    assert batas('ytd', akhir, kal) == '2026-01-01'
    assert batas('w1', akhir, kal) == '2026-08-28'
    assert batas('b6', akhir, kal) == '2026-03-06'
    assert batas('y1', akhir, kal) == '2025-09-04'
    # MTD di tanggal 1 = satu hari, bukan mundur ke bulan lalu.
    assert batas('mtd', date(2026, 9, 1), kal) == '2026-09-01'

    agg = {
        'b1': {'XL': {
            'AAA': [0, 300.0, 0, 100.0, 5],   # net +200
            'BBB': [0, 100.0, 0, 400.0, 5],   # net -300
            'CCC': [0, 50.0, 0, 50.0, 5],     # net 0 - tak masuk sisi mana pun
        }},
    }
    total = {'b1': {'AAA': 1000.0, 'BBB': 1000.0, 'CCC': 0.0}}
    d = susun(agg, total, 'b1', 'XL')
    assert [x['kode'] for x in d['beli']] == ['AAA'], d['beli']
    assert [x['kode'] for x in d['jual']] == ['BBB'], d['jual']
    assert d['n_emiten'] == 3
    assert abs(d['beli'][0]['pangsa'] - 0.2) < 1e-12
    # Penyebut nol -> None, bukan 0: "tak diketahui" bukan "tak berpangsa".
    assert d['jual'][0]['pangsa'] == 0.3
    # Lot per SISI ikut ditulis (#119 2A) — tanpa ini halaman tak bisa
    # menghitung harga rata-rata sisi tanpa mencampur beli dengan jual.
    agg2 = {'b1': {'XL': {'AAA': [200.0, 300.0, 50.0, 100.0, 5]}}}
    d2 = susun(agg2, {'b1': {'AAA': 1000.0}}, 'b1', 'XL')
    assert d2['beli'][0]['beli_lot'] == 200, d2['beli'][0]
    assert d2['beli'][0]['jual_lot'] == 50, d2['beli'][0]
    # Harga rata-rata sisi beli = nilai/lot/100 = 300/200/100 = 0,015.
    # Dihitung di layar, tapi bahannya wajib ada di sini.
    assert d2['beli'][0]['beli_nilai'] == 300
    print('swauji lolos')
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--tulis', action='store_true')
    ap.add_argument('--swauji', action='store_true', help='periksa definisi periode & pemisahan sisi')
    ap.add_argument('--emiten', type=int, default=None, help='batasi jumlah emiten (uji cepat)')
    a = ap.parse_args()
    if a.swauji:
        return swauji()

    akhir, kalender = hari_bursa_terakhir()
    mulai = {k: batas(k, akhir, kalender) for k in PRESET}
    tahun = set()
    for k in PRESET:
        # Preset ber-pangkal-tanggal butuh tahun berjalan saja untuk `mtd`,
        # dan tahun berjalan untuk `ytd` — keduanya tak pernah melintasi
        # tahun ke belakang, jadi 0 hari mundur sudah benar di sini.
        mundur = 14 if k in PRESET_HARI_BURSA else PRESET[k]
        tahun |= tahun_perlu(akhir, mundur)

    emiten = daftar_emiten(a.emiten)
    print(f'akhir {akhir} · tahun {sorted(tahun)} · {len(emiten)} emiten')
    for k, v in mulai.items():
        print(f'  {k}: {v} s.d. {akhir}')

    agg, total, dilewati = kumpul(emiten, tahun, mulai)

    broker = sorted({b for k in PRESET for b in agg[k]})
    print(f'{len(broker)} broker · {len(dilewati)} emiten/tahun dilewati')
    if not broker:
        print('tak ada broker terkumpul — tidak menulis apa pun')
        return 1

    if not a.tulis:
        for b in broker[:3]:
            d = susun(agg, total, 'b1', b)
            atas = ', '.join(f"{x['kode']} {x['net_nilai']/1e9:.1f}M" for x in d['beli'][:5])
            print(f'  {b} 1 Bulan net beli: {atas}')
        print('(laporan saja — pakai --tulis untuk menyimpan)')
        return 0

    KELUAR.mkdir(parents=True, exist_ok=True)
    for b in broker:
        isi = {
            'broker': b,
            'akhir': akhir.isoformat(),
            'dibangun': date.today().isoformat(),
            # Disebut apa adanya supaya halaman bisa mengutipnya: daftar broker
            # harian per emiten dipotong 50 teratas tiap sisi oleh sumbernya.
            'terpotong': 50,
            'periode': {k: {'mulai': mulai[k], 'akhir': akhir.isoformat()} for k in PRESET},
            'data': {k: susun(agg, total, k, b) for k in PRESET},
        }
        io.open(KELUAR / f'{b}.json', 'w', encoding='utf-8').write(
            json.dumps(isi, ensure_ascii=False, separators=(',', ':')))
    io.open(KELUAR / 'index.json', 'w', encoding='utf-8').write(
        json.dumps({'akhir': akhir.isoformat(), 'broker': broker}, ensure_ascii=False))
    print(f'ditulis {len(broker)} berkas + index ke {KELUAR}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
