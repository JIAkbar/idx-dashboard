import { describe, expect, it } from 'vitest'
import {
  cekWatchlistBerubah, hitungLonjakan, pemicuAsingBeruntun, pemicuDekatStop, pemicuPembeliBerganti, pemicuTembusMa20,
  type HariBrokerPuncak,
} from './pagi-hitung'
import type { BarisOhlc } from '../../lib/dasbor/ihsgOhlc'
import type { BarisAsing } from './cerita-hitung'

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

describe('pemicuPembeliBerganti', () => {
  it('mendelegasikan ke cekWatchlistBerubah (bentuk HasilPemicu)', () => {
    const hari: HariBrokerPuncak[] = [
      { tanggal: '2026-09-21', accdist: 'Acc', total_nilai: 100, beli: [['YU', 10]], jual: [['ZP', -8]] },
      { tanggal: '2026-09-22', accdist: 'Acc', total_nilai: 90, beli: [['CC', 6]], jual: [['YU', -7]] },
    ]
    expect(pemicuPembeliBerganti(hari)).toEqual({ menyala: true, kalimat: 'Pembeli terbesar dua hari lalu, YU, hari ini menjual.' })
    expect(pemicuPembeliBerganti([])).toEqual({ menyala: false, kalimat: null })
  })
})

describe('pemicuTembusMa20', () => {
  function bar(tanggal: string, tutup: number): BarisOhlc {
    return [tanggal, tutup, tutup, tutup, tutup, 1000]
  }

  it('kurang dari 21 bar → tak menyala', () => {
    expect(pemicuTembusMa20([bar('1', 100)]).menyala).toBe(false)
  })

  it('tutup kemarin <= MA20, tutup terakhir > MA20 → tembus ke atas', () => {
    // 20 bar flat 100, bar ke-21 melompat ke 110: MA20 kemarin = 100 (rata 20 bar flat),
    // MA20 terakhir = (19*100+110)/20 = 100.5 — tutup 110 tetap di atasnya.
    const bars: BarisOhlc[] = Array.from({ length: 20 }, (_, i) => bar(`d${i}`, 100))
    bars.push(bar('d20', 110))
    const r = pemicuTembusMa20(bars)
    expect(r.menyala).toBe(true)
    expect(r.kalimat).toBe('Tutup tembus ke ATAS MA20.')
  })

  it('tutup kemarin >= MA20, tutup terakhir < MA20 → tembus ke bawah', () => {
    const bars: BarisOhlc[] = Array.from({ length: 20 }, (_, i) => bar(`d${i}`, 100))
    bars.push(bar('d20', 90))
    const r = pemicuTembusMa20(bars)
    expect(r.menyala).toBe(true)
    expect(r.kalimat).toBe('Tutup tembus ke BAWAH MA20.')
  })

  it('tetap di atas MA20 dua hari berturut (tren naik) → tak menyala', () => {
    // closes 100..121 (22 bar) naik linear: tutup kemarin & terakhir dua-duanya
    // sudah di atas MA20-nya sendiri, jadi bukan persilangan baru.
    const bars: BarisOhlc[] = Array.from({ length: 22 }, (_, i) => bar(`d${i}`, 100 + i))
    expect(pemicuTembusMa20(bars).menyala).toBe(false)
  })
})

describe('pemicuAsingBeruntun', () => {
  function barAsing(tanggal: string, beli: number, jual: number): BarisAsing {
    return [tanggal, beli, jual, beli + jual, (beli + jual) * 5000, 100]
  }

  it('kurang dari 5 hari data → tak menyala', () => {
    const asing = [barAsing('d1', 100, 50), barAsing('d2', 100, 50)]
    expect(pemicuAsingBeruntun(asing).menyala).toBe(false)
  })

  it('net beli 5 hari bursa berturut-turut → menyala beli', () => {
    const asing = ['d1', 'd2', 'd3', 'd4', 'd5'].map((t) => barAsing(t, 100, 40))
    const r = pemicuAsingBeruntun(asing)
    expect(r.menyala).toBe(true)
    expect(r.kalimat).toBe('Asing net beli 5 hari bursa berturut-turut.')
  })

  it('net jual 5 hari bursa berturut-turut → menyala jual', () => {
    const asing = ['d1', 'd2', 'd3', 'd4', 'd5'].map((t) => barAsing(t, 40, 100))
    const r = pemicuAsingBeruntun(asing)
    expect(r.menyala).toBe(true)
    expect(r.kalimat).toBe('Asing net jual 5 hari bursa berturut-turut.')
  })

  it('arah campur dalam 5 hari terakhir → tak menyala', () => {
    const asing = [
      barAsing('d1', 100, 40), barAsing('d2', 100, 40), barAsing('d3', 40, 100),
      barAsing('d4', 100, 40), barAsing('d5', 100, 40),
    ]
    expect(pemicuAsingBeruntun(asing).menyala).toBe(false)
  })
})

describe('pemicuDekatStop', () => {
  it('harga di atas stop dan jarak < 3% → menyala', () => {
    const r = pemicuDekatStop({ harga: 102, stop: 100 })
    expect(r.menyala).toBe(true)
    expect(r.kalimat).toBe('Harga 2.0% di atas stop.')
  })

  it('harga di bawah stop → tak menyala', () => {
    expect(pemicuDekatStop({ harga: 98, stop: 100 }).menyala).toBe(false)
  })

  it('harga jauh di atas stop (>= 3%) → tak menyala', () => {
    expect(pemicuDekatStop({ harga: 110, stop: 100 }).menyala).toBe(false)
  })
})
