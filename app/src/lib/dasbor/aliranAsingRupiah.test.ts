import { describe, expect, it } from 'vitest'
import { netRupiahPeriode, kumulatifRupiah } from './aliranAsingRupiah'
import type { OhlcvKaya } from './ohlcvKaya'

function buatOhlcv(baris: [string, number, number][]): OhlcvKaya {
  const byDate = new Map(
    baris.map(([tanggal, foreignBeli, foreignJual]) => [
      tanggal,
      { nilai: 0, frekuensi: 0, foreignBeli, foreignJual, sahamBeredar: 0 },
    ]),
  )
  return { mulai: baris[0]?.[0] ?? null, byDate }
}

describe('netRupiahPeriode', () => {
  const d = buatOhlcv([
    ['2019-12-30', 100, 40], // net +60
    ['2019-12-31', 50, 80], // net -30
    ['2020-01-02', 200, 10], // net +190
  ])

  it('jumlah beli/jual/net hari TERSEDIA terakhir s.d. akhir', () => {
    expect(netRupiahPeriode(d, '2020-01-02', 2)).toEqual({
      beli: 250,
      jual: 90,
      net: 160,
      hariTersedia: 2,
    })
  })

  it('jendela lebih panjang dari riwayat -> pakai semua, hariTersedia turun', () => {
    expect(netRupiahPeriode(d, '2020-01-02', 10)?.hariTersedia).toBe(3)
  })

  it('akhir sebelum data manapun -> null', () => {
    expect(netRupiahPeriode(d, '2019-01-01', 5)).toBeNull()
  })

  it('berkas kosong -> null', () => {
    expect(netRupiahPeriode({ mulai: null, byDate: new Map() }, '2020-01-02', 5)).toBeNull()
  })
})

describe('kumulatifRupiah', () => {
  const d = buatOhlcv([
    ['2019-12-30', 100, 40], // net +60
    ['2019-12-31', 50, 80], // net -30
    ['2020-01-02', 200, 10], // net +190
  ])

  it('running sum + jahitan untuk hari sebelum bursaMulai', () => {
    const titik = kumulatifRupiah(d, '2020-01-02', '2019-12-30', '2020-01-02')
    expect(titik).toEqual([
      { tanggal: '2019-12-30', kumulatif: 60, jahitan: true },
      { tanggal: '2019-12-31', kumulatif: 30, jahitan: true },
      { tanggal: '2020-01-02', kumulatif: 220, jahitan: false },
    ])
  })

  it('bursaMulai null -> seluruhnya jahitan (bursa tak punya emiten ini sama sekali)', () => {
    const titik = kumulatifRupiah(d, null, '2019-12-30', '2019-12-31')
    expect(titik.every((t) => t.jahitan)).toBe(true)
  })

  it('rentang kosong -> array kosong', () => {
    expect(kumulatifRupiah(d, '2020-01-02', '2099-01-01', '2099-01-02')).toEqual([])
  })
})
