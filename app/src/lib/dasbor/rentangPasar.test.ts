import { describe, it, expect } from 'vitest'
import { ringkasRentang } from './rentangPasar'
import type { DataHarian } from './dataHarian'

/**
 * Angka acuan DIHITUNG TANGAN dari empat berkas statistik harian 1–4 Sep 2026,
 * bukan disalin dari keluaran fungsi ini. Itu seluruh gunanya: kalau fungsinya
 * salah, uji yang bahannya berasal dari fungsi itu akan ikut salah dan tetap
 * hijau.
 *
 *   tanggal      vol(jt)   nilai(M)  frek(rb)   nf(M IDR)
 *   2026-09-01    57.897     20.700     2.627    +2.027,77
 *   2026-09-02    63.132     16.800     2.436      −326,64
 *   2026-09-03    39.306     18.607     2.471    +1.069,28
 *   2026-09-04    34.285     15.001     2.028       −29,76
 *   JUMLAH       194.620     71.108     9.562    +2.740,65
 *
 * IHSG: penutupan 29 Agu (ihsg_prev 1 Sep) 6.525,478 → penutupan 4 Sep 6.636,475.
 */
const HARI: DataHarian[] = [
  { date_id: '1 Sep 2026', trading_day: 155, ihsg_value: 6599.943, ihsg_pct: 1.14,
    ihsg_prev: 6525.478, ihsg_high: 6608.183, ihsg_low: 6535.797,
    vol_today: 57897, val_idr_today: 20700, freq_today: 2627, nf_today_idr: 2027.77 } as DataHarian,
  { date_id: '2 Sep 2026', trading_day: 156, ihsg_value: 6595.776, ihsg_pct: -0.06,
    ihsg_prev: 6599.943, ihsg_high: 6629.543, ihsg_low: 6561.003,
    vol_today: 63132, val_idr_today: 16800, freq_today: 2436, nf_today_idr: -326.64 } as DataHarian,
  { date_id: '3 Sep 2026', trading_day: 157, ihsg_value: 6667.891, ihsg_pct: 1.09,
    ihsg_prev: 6595.776, ihsg_high: 6681.838, ihsg_low: 6614.714,
    vol_today: 39306, val_idr_today: 18607, freq_today: 2471, nf_today_idr: 1069.28 } as DataHarian,
  { date_id: '4 Sep 2026', trading_day: 158, ihsg_value: 6636.475, ihsg_pct: -0.47,
    ihsg_prev: 6667.891, ihsg_high: 6704.125, ihsg_low: 6633.915,
    vol_today: 34285, val_idr_today: 15001, freq_today: 2028, nf_today_idr: -29.76 } as DataHarian,
]

describe('ringkasRentang', () => {
  it('menjumlahkan empat hari persis seperti hitungan tangan', () => {
    const r = ringkasRentang(HARI)!
    expect(r.n_hari).toBe(4)
    expect(r.vol).toBe(194620)
    expect(r.val).toBe(71108)
    expect(r.frek).toBe(9562)
    expect(r.nf).toBeCloseTo(2740.65, 2)
  })

  it('net asing dijumlahkan dari nilai HARIAN, jadi hari negatif ikut mengurangi', () => {
    // −29,76 (4 Sep) adalah hari yang dulu HILANG seluruhnya karena ambang
    // besaran di pembaca PDF. Kalau ia diam-diam terlewat lagi, jumlahnya
    // menjadi 2.770,41 dan uji ini merah.
    const r = ringkasRentang(HARI)!
    expect(r.n_nf).toBe(4)
    expect(r.nf).not.toBeCloseTo(2770.41, 2)
  })

  it('IHSG diukur dari penutupan SEBELUM rentang, bukan dari hari pertamanya', () => {
    const r = ringkasRentang(HARI)!
    expect(r.ihsg_awal).toBe(6525.478)
    expect(r.ihsg_akhir).toBe(6636.475)
    expect(r.ihsg_pct).toBeCloseTo(1.7010, 3)
    // Kalau awalnya salah diambil dari penutupan 1 Sep (6.599,943), hasilnya
    // 0,553% — sepertiga dari yang sebenarnya, tanpa satu pun galat.
    expect(r.ihsg_pct).not.toBeCloseTo(0.553, 3)
  })

  it('ekstrem diambil intraday lintas rentang, bukan dari penutupan', () => {
    const r = ringkasRentang(HARI)!
    expect(r.ihsg_tertinggi).toBe(6704.125)
    expect(r.ihsg_terendah).toBe(6535.797)
  })

  it('rata-rata dibagi hari BERDATA, dan cacahnya dilaporkan saat ada yang bolong', () => {
    const bolong = [
      HARI[0],
      { ...HARI[1], vol_today: undefined, nf_today_idr: undefined } as DataHarian,
      HARI[2], HARI[3],
    ]
    const r = ringkasRentang(bolong)!
    expect(r.n_hari).toBe(4)
    expect(r.n_vol).toBe(3)          // <- inilah yang wajib dicetak halaman
    expect(r.n_nf).toBe(3)
    expect(r.vol).toBe(57897 + 39306 + 34285)
    expect(r.vol_rerata).toBeCloseTo((57897 + 39306 + 34285) / 3, 6)
    // Pembaginya BUKAN 4: membagi dengan jumlah hari akan menurunkan rata-rata
    // ~25% dan angkanya tetap terlihat masuk akal.
    expect(r.vol_rerata).not.toBeCloseTo((57897 + 39306 + 34285) / 4, 6)
  })

  it('urutan masukan tidak boleh membalik arah persentase', () => {
    const terbalik = ringkasRentang([...HARI].reverse())!
    const urut = ringkasRentang(HARI)!
    expect(terbalik.ihsg_pct).toBeCloseTo(urut.ihsg_pct!, 6)
    expect(terbalik.ihsg_awal).toBe(urut.ihsg_awal)
  })

  it('ruas yang tak ada sama sekali jadi null, bukan nol', () => {
    const kosong = HARI.map((d) => ({ ...d, nf_today_idr: undefined }) as DataHarian)
    const r = ringkasRentang(kosong)!
    expect(r.nf).toBeNull()
    expect(r.n_nf).toBe(0)
  })

  it('rentang kosong menjawab null, bukan nol-nol', () => {
    expect(ringkasRentang([])).toBeNull()
  })
})
