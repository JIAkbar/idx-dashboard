import { describe, expect, it } from 'vitest'
import { cekWatchlistBerubah, hitungLonjakan, type HariBrokerPuncak } from './pagi-hitung'
import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'

describe('cekWatchlistBerubah', () => {
  it('kurang dari 2 hari → tak berubah', () => {
    expect(cekWatchlistBerubah([]).berubah).toBe(false)
  })

  it('pembeli terbesar dua hari lalu kini menjual → berubah', () => {
    const hari: HariBrokerPuncak[] = [
      { tanggal: '2026-09-21', accdist: 'Acc', total_nilai: 100, beli: [['YU', 10]], jual: [['ZP', -8]] },
      { tanggal: '2026-09-22', accdist: 'Acc', total_nilai: 90, beli: [['CC', 6]], jual: [['YU', -7]] },
    ]
    const r = cekWatchlistBerubah(hari)
    expect(r.berubah).toBe(true)
    expect(r.brokerSebelum).toBe('YU')
    expect(r.kalimat).toContain('YU')
  })

  it('accdist berbalik Acc -> Dist (bentuk data asli) → berubah walau broker sama', () => {
    const hari: HariBrokerPuncak[] = [
      { tanggal: '2026-09-21', accdist: 'Acc', total_nilai: 100, beli: [['YU', 10]], jual: [] },
      { tanggal: '2026-09-22', accdist: 'Dist', total_nilai: 90, beli: [['YU', 4]], jual: [['ZP', -2]] },
    ]
    expect(cekWatchlistBerubah(hari).berubah).toBe(true)
    expect(cekWatchlistBerubah(hari).kalimat).toBe('Arah broker berbalik dari akumulasi ke distribusi.')
  })

  it('pembeli terbesar tetap beli, accdist tetap arah → tak berubah', () => {
    const hari: HariBrokerPuncak[] = [
      { tanggal: '2026-09-21', accdist: 'Acc', total_nilai: 100, beli: [['YU', 10]], jual: [] },
      { tanggal: '2026-09-22', accdist: 'Acc', total_nilai: 90, beli: [['YU', 6]], jual: [['ZP', -2]] },
    ]
    const r = cekWatchlistBerubah(hari)
    expect(r.berubah).toBe(false)
    expect(r.kalimat).toBeNull()
  })
})

describe('hitungLonjakan', () => {
  function bar(tanggal: string, tutup: number): BarisOhlc {
    return [tanggal, tutup, tutup, tutup, tutup, 1000]
  }

  it('terlalu sedikit bar → n = 0', () => {
    expect(hitungLonjakan([bar('1', 100), bar('2', 110)], 5).n).toBe(0)
  })

  it('satu kejadian lonjakan dengan 5 bar sesudahnya → median = return H+5 itu', () => {
    const bars = [
      bar('d0', 100),
      bar('d1', 120), // +20% dari d0, di atas ambang 10
      bar('d2', 121), bar('d3', 122), bar('d4', 123), bar('d5', 124), bar('d6', 130), // d6 = d1+5
    ]
    const r = hitungLonjakan(bars, 10)
    expect(r.n).toBe(1)
    expect(r.medianH5).toBeCloseTo(((130 - 120) / 120) * 100, 6)
  })

  it('hari terakhir tak dihitung sebagai kejadian (tak ada 5 bar sesudahnya)', () => {
    const bars = [bar('d0', 100), bar('d1', 200), bar('d2', 201), bar('d3', 202), bar('d4', 203), bar('d5', 204)]
    // d1 lonjakan +100%, tapi cuma 4 bar sesudahnya (d2..d5) → belum genap H+5
    expect(hitungLonjakan(bars, 10).n).toBe(0)
  })

  it('median dari dua kejadian dirata-rata', () => {
    const bars = [
      bar('d0', 100), bar('d1', 120), bar('d2', 100), bar('d3', 100), bar('d4', 100), bar('d5', 100), bar('d6', 110), // d1 H5 = +10/120*... -> return dari 120->110 = -8.33
      bar('d7', 90), bar('d8', 108), // d7->d8 +20% lonjakan kedua
      bar('d9', 108), bar('d10', 108), bar('d11', 108), bar('d12', 108), bar('d13', 118.8), // d8 H5 = +10%
    ]
    const r = hitungLonjakan(bars, 15)
    expect(r.n).toBe(2)
  })
})
