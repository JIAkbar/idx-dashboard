"""Pemeriksa hasil `benchmark_aturan.py` — menjawab "apakah ini temuan atau undian?"

Perintah Johan 31 Agu 2026 meminta benchmark banyak konfigurasi. Bahaya bawaannya
diingatkan pengawas hari yang sama: menguji ratusan sel lalu menyimpan yang tertinggi
adalah pencocokan kurva, dan sel terbaik dari sekian ratus akan terlihat lebih bagus
daripada nilai sebenarnya semata karena kebetulan.

Skrip ini TIDAK mencari pemenang. Ia menguji apakah pencariannya sendiri layak
dipercaya, lewat empat pemeriksaan yang masing-masing bisa menggugurkan seluruh
hasil:

1. **Korelasi peringkat antar paruh.** Rentang uji dipecah dua paruh berurutan.
   Kalau peringkat aturan di paruh AWAL memperkirakan peringkatnya di paruh AKHIR,
   pencariannya menemukan sesuatu yang bertahan. Kalau korelasinya nol, yang
   ditemukan derau — dan angka tertinggi mana pun tak berarti. Ini pemeriksaan
   paling menentukan di berkas ini; satu angka, sulit dibantah.

2. **Sebaran, bukan puncak.** Kalau seluruh sel berkerumun rapat, pilihan parameter
   tak banyak berpengaruh dan sistemnya kokoh. Kalau rentangnya lebar, puncaknya
   kemungkinan besar keberuntungan dan angka yang jujur adalah MEDIAN.

3. **Selisih juara atas runner-up.** Juara yang cuma unggul setipis derau bukan
   satu temuan melainkan satu kerumunan. Dilaporkan sebagai jarak dalam satuan
   simpangan baku sebaran sel.

4. **Efek per keluarga, bukan per sel.** Sel tunggal gampang beruntung; keluarga
   aturan (ATR / EMA-cermin / Terendah-N / Persen tetap) yang unggul di SELURUH
   saringan dan horizon jauh lebih sulit dipalsukan kebetulan.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np


def spearman(a: list[float], b: list[float]) -> float:
    """Korelasi peringkat Spearman. Ditulis tangan supaya tak menambah dependensi."""
    n = len(a)
    if n < 3:
        return float('nan')

    def peringkat(x):
        urut = sorted(range(len(x)), key=lambda i: x[i])
        r = [0.0] * len(x)
        i = 0
        while i < len(urut):
            j = i
            while j + 1 < len(urut) and x[urut[j + 1]] == x[urut[i]]:
                j += 1
            rata = (i + j) / 2 + 1
            for k in range(i, j + 1):
                r[urut[k]] = rata
            i = j + 1
        return r

    ra, rb = peringkat(a), peringkat(b)
    ma, mb = sum(ra) / n, sum(rb) / n
    pa = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    da = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** 0.5
    return pa / da if da else float('nan')


def main():
    sp = Path(os.environ.get('SP', '.'))
    d = json.loads((sp / 'benchmark_aturan.json').read_text(encoding='utf-8'))
    sel = d['sel']
    penuh = [r for r in sel if r['periode'] == 'semua']
    print(f"benchmark: {d['n_emiten']} emiten, {d['n_hari_sinyal']:,} hari sinyal, "
          f"{len(penuh)} sel berisi (periode penuh)")
    print()

    # ---------------------------------------------------------- 1. antar paruh
    lama = {(r['aturan'], r['saringan'], r['horizon']): r for r in sel if r['periode'] == 'lama'}
    baru = {(r['aturan'], r['saringan'], r['horizon']): r for r in sel if r['periode'] == 'baru'}
    kunci = [k for k in lama if k in baru]
    A = [lama[k]['eks_R'] for k in kunci]
    B = [baru[k]['eks_R'] for k in kunci]
    rho = spearman(A, B)
    print('=' * 78)
    print('1. KORELASI PERINGKAT ANTAR PARUH — apakah yang unggul dulu unggul lagi?')
    print('=' * 78)
    print(f'   {len(kunci)} sel punya angka di kedua paruh')
    print(f'   Spearman rho = {rho:+.3f}')
    if rho > 0.6:
        print('   -> KUAT. Peringkatnya bertahan; pencarian menemukan sesuatu yang nyata.')
    elif rho > 0.3:
        print('   -> SEDANG. Ada sinyal, tapi banyak juga derau. Jangan percaya sel tunggal;')
        print('      pakai tingkat KELUARGA aturan, bukan sel terbaik.')
    else:
        print('   -> LEMAH/NOL. Peringkat paruh awal TIDAK memperkirakan paruh akhir.')
        print('      Artinya sel tertinggi adalah keberuntungan. JANGAN terbitkan pemenang.')

    # Sel yang unggul di KEDUA paruh — ambangnya median MASING-MASING paruh,
    # bukan median gabungan. Versi pertama memakai median gabungan dan itu
    # SALAH: paruh akhir levelnya seragam lebih rendah daripada paruh awal
    # (rezim pasarnya beda), jadi hampir tak ada sel yang bisa melewati ambang
    # gabungan di paruh akhir — hasilnya terbaca "21%, di bawah harapan acak
    # 25%" dan seolah membantah korelasi peringkat yang jelas positif. Yang
    # diuji di sini PERINGKAT (apakah yang unggul dulu unggul lagi), bukan
    # tingginya angka, jadi ambangnya wajib relatif terhadap paruhnya sendiri.
    mA = float(np.median(A))
    mB = float(np.median(B))
    kokoh = [k for k in kunci if lama[k]['eks_R'] > mA and baru[k]['eks_R'] > mB]
    print(f'   ambang = median paruh masing-masing ({mA:+.3f} dan {mB:+.3f})')
    print(f'   sel di atas median paruhnya sendiri di KEDUA paruh: {len(kokoh)} dari {len(kunci)}'
          f'  ({100*len(kokoh)/len(kunci):.0f}%)')
    print(f'   (kalau murni acak, harapannya 25%)')

    # ------------------------------------------------------------- 2. sebaran
    v = np.array([r['eks_R'] for r in penuh], dtype=float)
    print()
    print('=' * 78)
    print('2. SEBARAN SELURUH SEL — puncaknya menonjol, atau cuma ujung kerumunan?')
    print('=' * 78)
    print(f'   min {v.min():+.3f} | kuartil bawah {np.percentile(v,25):+.3f} | '
          f'MEDIAN {np.median(v):+.3f} | kuartil atas {np.percentile(v,75):+.3f} | max {v.max():+.3f}')
    print(f'   simpangan baku {v.std():.3f}')
    print(f'   sel dengan ekspektansi NEGATIF: {(v<0).sum()} dari {len(v)}'
          f'  ({100*(v<0).sum()/len(v):.0f}%)')

    # ------------------------------------------------- 3. selisih juara-runner
    urut = sorted(penuh, key=lambda r: -r['eks_R'])
    j, r2 = urut[0], urut[1]
    jarak_sd = (j['eks_R'] - r2['eks_R']) / v.std() if v.std() else 0
    print()
    print('=' * 78)
    print('3. JUARA vs RUNNER-UP — selisihnya berarti, atau sebatas derau?')
    print('=' * 78)
    print(f"   juara      {j['aturan']:<16} {j['saringan']:<18} H={j['horizon']:<3} eks/R {j['eks_R']:+.3f}")
    print(f"   runner-up  {r2['aturan']:<16} {r2['saringan']:<18} H={r2['horizon']:<3} eks/R {r2['eks_R']:+.3f}")
    print(f'   jarak = {jarak_sd:.2f} simpangan baku')
    if jarak_sd < 0.5:
        print('   -> TIPIS. Juara dan runner-up satu kerumunan; jangan sebut "aturan terbaik".')
    else:
        print('   -> Terpisah cukup jauh untuk disebut berbeda.')

    # -------------------------------------------------------- 4. per keluarga
    print()
    print('=' * 78)
    print('4. PER KELUARGA ATURAN — jauh lebih sulit dipalsukan kebetulan')
    print('=' * 78)
    kel = {}
    for r in penuh:
        kel.setdefault(r['keluarga'], []).append(r['eks_R'])
    print(f"   {'keluarga':<16} {'sel':>4} {'median':>9} {'kuartil atas':>13} {'maks':>9}")
    for k, x in sorted(kel.items(), key=lambda kv: -float(np.median(kv[1]))):
        a = np.array(x)
        print(f'   {k:<16} {len(a):>4} {np.median(a):>+9.3f} {np.percentile(a,75):>+13.3f} {a.max():>+9.3f}')

    # per aturan, hanya saringan "semua" — memisahkan efek ATURAN dari efek SARINGAN
    print()
    print(f"   Tanpa saringan apa pun (saringan='semua'), per aturan, H=5:")
    baris = [r for r in penuh if r['saringan'] == 'semua' and r['horizon'] == 5]
    baris.sort(key=lambda r: -r['eks_R'])
    print(f"   {'aturan':<16} {'WR':>7} {'tuntas':>7} {'risiko':>8} {'eks':>8} {'eks/R':>8}")
    for r in baris:
        print(f"   {r['aturan']:<16} {r['wr']:>6.1f}% {r['tuntas']:>6.1f}% "
              f"{r['risiko_rata']:>7.2f}% {r['eks']:>+7.3f}% {r['eks_R']:>+8.3f}")

    # ------------------------------------------------- ringkas untuk halaman
    keluar = sp / 'benchmark_periksa.json'
    keluar.write_text(json.dumps({
        'rho_antar_paruh': round(rho, 4),
        'n_sel_dua_paruh': len(kunci),
        'kokoh_dua_paruh': len(kokoh),
        'kokoh_pct': round(100 * len(kokoh) / len(kunci), 1) if kunci else None,
        'sebaran': {'min': float(v.min()), 'q25': float(np.percentile(v, 25)),
                    'median': float(np.median(v)), 'q75': float(np.percentile(v, 75)),
                    'max': float(v.max()), 'sd': float(v.std()),
                    'negatif': int((v < 0).sum()), 'n': len(v)},
        'juara': j, 'runner_up': r2, 'jarak_sd': round(jarak_sd, 3),
        'keluarga': {k: {'n': len(x), 'median': float(np.median(x)),
                         'q75': float(np.percentile(x, 75)), 'max': float(max(x))}
                     for k, x in kel.items()},
        'tanpa_saringan_h5': baris,
    }, ensure_ascii=False), encoding='utf-8')
    print()
    print(f'-> {keluar}')


if __name__ == '__main__':
    main()
