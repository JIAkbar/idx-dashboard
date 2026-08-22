# -*- coding: utf-8 -*-
"""Uji rezim untuk sinyal kandidat Deep Dive — apakah analisanya bertahan saat
IHSG TURUN, atau cuma bekerja di pasar naik?

Johan 22 Agu 2026: *"boleh selama memiliki probabilitas tinggi itu lebih baik,
apalagi saat ini karena IHSG naik saja, nnt kalau turun apakah masih bisa di
pertahankan analisa itu atau muncul analisa baru lagi"*.

Rezim ditentukan dari posisi IHSG terhadap MA20-nya sendiri pada hari itu —
bukan dari arah sehari (terlalu bising) dan bukan dari label manual.

HASIL 22 Agu 2026 (7.288 observasi, seluruh emiten ber-riwayat >=200 bar,
25 titik acak per emiten, horizon 5 hari bursa, kejadian = menyentuh +3%):

  Angka dasar   rezim naik 57,6% (n=4.304) · rezim turun 59,0% (n=2.984)
  -> peluang menyentuh +3% TIDAK jatuh saat pasar turun; volatilitas yang
     naik mengimbangi arah yang memburuk.

  Skor gabungan hampir DATAR: 0 -> 53,3/56,6 · 4 -> 61,4/62,3 · 5 -> 53,7/59,3.
  Naik tipis sampai skor 4 lalu turun lagi di skor 5. Ini konfirmasi
  independen atas catatan di `kandidat_deepdive.py`: skor itu PENYARING,
  bukan peringkat peluang.

  Lift per sinyal terhadap dasar rezimnya (persentase poin):
    sinyal                      naik    turun
    net asing 20 hari positif   +3,4    +1,9
    struktur menahan            +2,7    +1,0
    volume di atas normal       +2,5    +0,2
    menyerap saat pasar merah   +2,2    +1,8   <- paling STABIL lintas rezim
    serapan efisien             -1,6    -2,3   <- negatif di kedua rezim
    VolVal senyap               -4,9    -0,4   <- negatif di kedua rezim

Bacaan yang jujur: analisanya tidak runtuh saat pasar turun, tapi KOMPOSISINYA
berubah — "menyerap saat pasar merah" bertahan, "volume di atas normal" dan
"net asing" melemah. Dua sinyal (serapan efisien, VolVal senyap) justru
berlift negatif untuk kejadian +3%.

PENTING sebelum bobotnya diubah: uji ini mengukur hal yang BERBEDA dari tujuan
skripnya. `kandidat_deepdive.py` mencari emiten yang layak DIMINTAKAN Broker
Summary — jejak penyerapan — bukan meramal +3% dalam 5 hari. Mengubah bobot
berdasar uji yang mengukur hal lain adalah kekeliruan yang sama dengan
menyetel ambang sampai kasus favorit muncul. Yang benar: kalibrasi menunggu
puluhan Deep Dive dengan tinjauan H+5 (lihat `tinjau_deepdive.py`), yaitu
ukuran yang memang setujuan.

Pakai:
    python scripts/riset/uji_rezim_kandidat.py     # ~10 menit, nol jaringan
"""

import json, io, sys, glob, statistics, random
sys.path.insert(0, r'C:\1-Johan\10. Pengembangan\IDX Statistik\scripts\riset')
import kandidat_deepdive as kd

AKAR = r'C:\1-Johan\10. Pengembangan\IDX Statistik\data-idx\json'
H = 5  # horizon hari bursa

ihsg = kd.baca(kd.DIR_JSON / 'ihsg_harian.json')['tutup']
tgl_urut = sorted(ihsg)
# rezim per tanggal: IHSG di atas / di bawah MA20-nya sendiri
rezim = {}
for i, t in enumerate(tgl_urut):
    if i < 20:
        continue
    ma20 = statistics.fmean(ihsg[x] for x in tgl_urut[i - 20:i])
    rezim[t] = 'naik' if ihsg[t] > ma20 else 'turun'
turun_hari = {t for i, t in enumerate(tgl_urut) if i and ihsg[t] < ihsg[tgl_urut[i - 1]]}

files = [f for f in glob.glob(AKAR + r'\ohlc\*.json') if 'IHSG' not in f]
random.seed(11)
files = files  # SEMUA emiten

hasil = {}  # (rezim, jumlah_sinyal) -> [naik5?, capai3%?]
per_sinyal = {}  # (rezim, nama_sinyal) -> [capai3%]
dasar = {}  # rezim -> [capai3%]

for f in files:
    kode = f.replace('\\', '/').split('/')[-1][:-5]
    d = kd.baca(__import__('pathlib').Path(f))
    bar = [b for b in (d or {}).get('d', []) if b and b[4]]
    if len(bar) < 200:
        continue
    asing = (kd.baca(kd.DIR_ASING / f'{kode}.json') or {}).get('d')
    # ambil 12 titik acak per emiten yang punya cukup riwayat & masa depan
    idx_mungkin = [i for i in range(kd.VV_WIN + kd.JENDELA + 2, len(bar) - H)]
    if len(idx_mungkin) < 25:
        continue
    for i in random.sample(idx_mungkin, 25):
        potong = bar[:i + 1]
        t = bar[i][0]
        if t not in rezim:
            continue
        a = [r for r in asing if r and r[0] <= t] if asing else None
        s = kd.sinyal(potong, a, turun_hari)
        if not s:
            continue
        depan = bar[i + 1:i + 1 + H]
        if len(depan) < H:
            continue
        c0 = bar[i][4]
        naik5 = depan[-1][4] > c0
        capai3 = max(x[2] for x in depan) >= c0 * 1.03
        r = rezim[t]
        dasar.setdefault(r, []).append(capai3)
        hasil.setdefault((r, s['skor']), []).append((naik5, capai3))
        for x in s['sinyal']:
            per_sinyal.setdefault((r, x['nama']), []).append(capai3)

print('=== ANGKA DASAR per rezim (P capai +3% dalam 5 hari) ===')
for r in ('naik', 'turun'):
    v = dasar.get(r, [])
    if v:
        print(f'  rezim {r:5s}: {statistics.fmean(v)*100:5.1f}%  (n={len(v):,})')

print('\n=== per JUMLAH SINYAL (skor) ===')
print(f'{"skor":>4} | {"rezim naik: P(+3%)":>22} | {"rezim turun: P(+3%)":>22}')
for skor in range(0, 7):
    baris = []
    for r in ('naik', 'turun'):
        v = hasil.get((r, skor), [])
        baris.append(f'{statistics.fmean(x[1] for x in v)*100:5.1f}% (n={len(v):,})' if len(v) >= 30 else f'    — (n={len(v)})')
    print(f'{skor:>4} | {baris[0]:>22} | {baris[1]:>22}')

print('\n=== per SINYAL — lift terhadap dasar rezimnya (pp) ===')
nama_semua = sorted({n for (_, n) in per_sinyal})
print(f'{"sinyal":<28} | {"naik":>16} | {"turun":>16}')
for n in nama_semua:
    baris = []
    for r in ('naik', 'turun'):
        v = per_sinyal.get((r, n), [])
        if len(v) >= 50 and dasar.get(r):
            lift = (statistics.fmean(v) - statistics.fmean(dasar[r])) * 100
            baris.append(f'{lift:+5.1f}pp (n={len(v):,})')
        else:
            baris.append(f'   — (n={len(v)})')
    print(f'{n:<28} | {baris[0]:>16} | {baris[1]:>16}')
