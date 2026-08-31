"""Selisih terhadap pasar — apakah pemilihannya berskill, terlepas arah pasar?

Usul Johan 1 Sep 2026: *"backtesting seperti ini tidak harus nunggu 5 september
kita bisa berkaca pada pergerakan IHSG juga, jika IHSG hari ini turun maka
banyak saham turun tapi saham pilihan malah naik dan sebaliknya, dan data-data
itu sudah lengkap sebelum 5 september dimana bisa dibuat backtest di tanggal 31
agustus mundur"*.

## Kenapa metrik ini menjawab hal yang TP/SL tidak

Metrik TP/SL menjawab "janji di layar tertepati?" — dan itu tetap metrik
produk. Yang TIDAK bisa dijawabnya: berapa banyak dari hasilnya sebenarnya
cuma arah pasar. Terukur 1 Sep 2026: di rentang uji, membeli apa saja lalu
menahan 5 hari memberi +0,87%, dan membeli saham bertren rapi +2,61% — tanpa
aturan sama sekali. Ekspektansi aturan yang tak dikurangi angka itu tak bisa
dibedakan dari beta yang menyamar.

Selisih terhadap pasar mengurangkannya langsung:

    selisih_k = return saham selama k hari  −  median pasar selama k hari yang SAMA

Pasar = median SELURUH emiten bervolume hari itu, equal-weight.

## Kenapa median pasar, BUKAN IHSG, yang jadi baseline utama

IHSG tertimbang kapitalisasi dan didominasi segelintir bank besar. Saham
pilihan yang kecil bisa terlihat "kalah dari IHSG" padahal mengalahkan pasar
yang sesungguhnya, dan sebaliknya. Versus-IHSG tetap dihitung dan dilaporkan
sebagai kolom kedua karena Johan bertanya dalam istilah itu — tapi ia
pendamping, bukan wasit.

## Pemecahan rezim — inti pertanyaan Johan

Hasil dipecah menurut arah IHSG pada hari sinyal: turun · datar · naik. Kalau
selisihnya bertahan positif justru di hari IHSG TURUN, itu tanda pemilihannya
membawa sesuatu yang bukan arah pasar. Kalau selisihnya cuma positif saat
IHSG naik, yang diukur beta, bukan skill.

## Kelas bukti

REKONSTRUKSI — saringan diterapkan mundur ke seluruh arsip. Ia menjawab
"apakah pemilihan semacam ini berskill pada masa lalu", bukan "apa yang sudah
terjadi di PAPAN". Kohort terkunci (kelas TERKUNCI) dihitung skrip lain begitu
hari majunya ada.

Satu penjaga sirkularitas yang WAJIB dan gampang terlewat: hari sinyal sendiri
TIDAK ikut dihitung. Gerak hari itu ikut menentukan siapa yang lolos saringan
(harga di atas EMA, dsb.), jadi memasukkannya berarti mengukur hal yang sama
dua kali — kesalahan yang persis sudah dibayar 31 Agu 2026 saat 83 dari 180
sinyal "menang" pada hari yang juga jadi pembandingnya.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from benchmark_aturan import muat, olah, bendera, MIN_HARGA, MIN_NILAI  # noqa: E402

AKAR = Path(__file__).resolve().parents[2]
OHLC = AKAR / 'data-idx' / 'json' / 'ohlc'

HOR = [1, 5, 10, 20]
N_HARI = 250
# Ambang "IHSG bergerak" — di bawah ini dianggap datar. 0,15% dipilih karena
# gerak lebih kecil dari itu tenggelam oleh fraksi harga pada emiten murah,
# jadi memaksanya masuk kelompok naik/turun cuma menambah derau.
AMBANG_DATAR = 0.15

SARINGAN = ['semua', 'atas-ema20', 'atas-ema50', 'tersusun', 'atas-ema20-vol']


def rezim(pct: float) -> str:
    if pct < -AMBANG_DATAR:
        return 'turun'
    if pct > AMBANG_DATAR:
        return 'naik'
    return 'datar'


def main() -> int:
    kode = sorted(f.stem for f in OHLC.glob('*.json') if f.stem != 'IHSG')

    # ── IHSG per tanggal, untuk menentukan rezim & pembanding kedua ─────────
    ih = muat('IHSG')
    if ih is None:
        print('IHSG tak terbaca — berhenti')
        return 1
    ih_ret: dict[str, float] = {}
    ih_fwd: dict[tuple[str, int], float] = {}
    for i in range(1, len(ih['c'])):
        ih_ret[ih['tgl'][i]] = 100 * (ih['c'][i] / ih['c'][i - 1] - 1)
        for h in HOR:
            if i + h < len(ih['c']):
                ih_fwd[(ih['tgl'][i], h)] = 100 * (ih['c'][i + h] / ih['c'][i] - 1)

    # ── Kumpulkan return maju per (tanggal, horizon) untuk SELURUH emiten ───
    # Pasar dihitung dari populasi yang sama dengan yang bisa dipilih saringan,
    # bukan dari indeks — supaya pembilang dan penyebutnya satu rumah.
    pasar: dict[tuple[str, int], list[float]] = {}
    per_saham: list[dict] = []
    n_em = 0
    for k in kode:
        b = muat(k)
        if b is None:
            continue
        c, v = b['c'], b['v']
        ctx = olah(b)
        akhir = len(c) - max(HOR) - 1
        mulai = max(200, akhir - N_HARI + 1)
        if akhir < mulai:
            continue
        if np.median((c * v)[max(0, akhir - 19):akhir + 1]) < MIN_NILAI:
            continue
        n_em += 1
        for i in range(mulai, akhir + 1):
            if c[i] < MIN_HARGA:
                continue
            t = b['tgl'][i]
            bd = bendera(b, ctx, i)
            for h in HOR:
                r = 100 * (c[i + h] / c[i] - 1)
                pasar.setdefault((t, h), []).append(r)
                per_saham.append({'t': t, 'h': h, 'r': r,
                                  'f': [s for s in SARINGAN if bd.get(s)]})

    med = {kh: float(np.median(v)) for kh, v in pasar.items()}

    # ── Agregat: selisih terhadap median pasar, dipecah rezim IHSG ──────────
    hasil: dict[str, dict] = {}
    for s in SARINGAN:
        for h in HOR:
            for rz in ('turun', 'datar', 'naik', 'semua'):
                hasil[f'{s}|{h}|{rz}'] = {'sel': [], 'ihsg': []}
    for x in per_saham:
        kh = (x['t'], x['h'])
        if kh not in med:
            continue
        rz = rezim(ih_ret.get(x['t'], 0.0))
        selisih = x['r'] - med[kh]
        vs_ihsg = x['r'] - ih_fwd.get(kh, 0.0) if kh in ih_fwd else None
        for s in x['f']:
            for kunci in (f"{s}|{x['h']}|{rz}", f"{s}|{x['h']}|semua"):
                hasil[kunci]['sel'].append(selisih)
                if vs_ihsg is not None:
                    hasil[kunci]['ihsg'].append(vs_ihsg)

    out = {'dibuat': ih['tgl'][-1], 'n_emiten': n_em, 'horizon': HOR,
           'ambang_datar': AMBANG_DATAR, 'sel': {}}
    for kunci, v in hasil.items():
        if len(v['sel']) < 100:
            continue
        a = np.array(v['sel'])
        b_ = np.array(v['ihsg']) if v['ihsg'] else np.array([0.0])
        out['sel'][kunci] = {
            'n': len(a),
            'median': round(float(np.median(a)), 4),
            'rata': round(float(a.mean()), 4),
            'menang_pct': round(100 * float((a > 0).mean()), 2),
            'vs_ihsg_median': round(float(np.median(b_)), 4) if v['ihsg'] else None,
        }

    p = Path(os.environ.get('SP', '.')) / 'selisih_pasar.json'
    p.write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
    print(f"{n_em} emiten, {len(per_saham):,} pengamatan, {len(out['sel'])} sel")
    print(f'-> {p}')
    print()
    print('PERTANYAAN JOHAN: saat IHSG TURUN, apakah saham pilihan tetap unggul?')
    print(f"{'saringan':<16} {'H':>3} {'rezim':>7} {'n':>7} {'selisih med':>12} "
          f"{'menang':>8} {'vs IHSG':>9}")
    for s in SARINGAN:
        for h in (5,):
            for rz in ('turun', 'datar', 'naik'):
                r = out['sel'].get(f'{s}|{h}|{rz}')
                if not r:
                    continue
                vi = r['vs_ihsg_median']
                vi_txt = f'{vi:+.3f}' if vi is not None else '-'
                print(f"{s:<16} {h:>3} {rz:>7} {r['n']:>7,} {r['median']:>+11.3f}% "
                      f"{r['menang_pct']:>7.1f}% {vi_txt:>9}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
