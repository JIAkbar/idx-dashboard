import { describe, expect, it } from 'vitest'
import { irisOhlcv, vwapRentang, titikKuadran, pilihTopInventaris, ringkasSB, saringTahunAwal, type BarisOhlcv } from './brokerEmitenV2'
import type { AgregatBroker } from './brokerEmiten'

const bar = (tanggal: string, tutup: number, volume: number, nilai: number): BarisOhlcv =>
  ({ tanggal, buka: tutup, tutup, volume, nilai, foreignBeli: 0, foreignJual: 0 })

const bars: BarisOhlcv[] = [
  bar('2026-01-05', 100, 1000, 100_000),
  bar('2026-01-06', 110, 2000, 220_000),
  bar('2026-01-07', 90, 500, 45_000),
]

describe('irisOhlcv', () => {
  it('mengiris inklusif by tanggal', () => {
    expect(irisOhlcv(bars, '2026-01-06', '2026-01-07').map((b) => b.tanggal))
      .toEqual(['2026-01-06', '2026-01-07'])
  })
})

describe('vwapRentang', () => {
  it('Σ nilai ÷ Σ volume', () => {
    // (100000+220000+45000) / (1000+2000+500) = 365000/3500
    expect(vwapRentang(bars)).toBeCloseTo(365_000 / 3_500, 6)
  })
  it('null kalau tak ada volume', () => {
    expect(vwapRentang([])).toBeNull()
  })
})

const agg = (broker: string, beliLot: number, beliNilai: number, jualLot: number, jualNilai: number): AgregatBroker => ({
  broker, beliLot, beliNilai, jualLot, jualNilai,
  netLot: beliLot - jualLot, netNilai: beliNilai - jualNilai,
  beliAvg: beliLot ? beliNilai / (beliLot * 100) : null,
  jualAvg: jualLot ? jualNilai / (jualLot * 100) : null,
})

describe('titikKuadran', () => {
  it('deltaVwapPct dari harga gabungan beli+jual broker vs VWAP', () => {
    // harga broker = (10_000+0)/((100+0)*100) = 1 ; vwap = 1 -> delta 0%
    const a = agg('AK', 100, 10_000, 0, 0)
    const t = titikKuadran([a], 1)
    expect(t).toHaveLength(1)
    expect(t[0].deltaVwapPct).toBeCloseTo(0, 6)
    expect(t[0].netNilai).toBe(10_000)
    expect(t[0].grossNilai).toBe(10_000)
  })
  it('vwap null -> larik kosong; broker tanpa lot disaring', () => {
    expect(titikKuadran([agg('AK', 10, 1000, 0, 0)], null)).toEqual([])
    expect(titikKuadran([agg('ZZ', 0, 0, 0, 0)], 100)).toEqual([])
  })
})

describe('pilihTopInventaris', () => {
  it('mengambil N pembeli & penjual bersih terbesar, terurut dari yang paling ekstrem', () => {
    const list = [
      agg('B1', 100, 100_000, 0, 0),  // net +100000
      agg('B2', 50, 50_000, 0, 0),    // net +50000
      agg('S1', 0, 0, 100, 90_000),   // net -90000
      agg('S2', 0, 0, 10, 5_000),     // net -5000
    ]
    const { pembeli, penjual } = pilihTopInventaris(list, 4)
    expect(pembeli).toEqual(['B1', 'B2'])
    expect(penjual).toEqual(['S1', 'S2'])
  })
  it('n membatasi jumlah tiap sisi', () => {
    const list = [
      agg('B1', 10, 30, 0, 0), agg('B2', 10, 20, 0, 0), agg('B3', 10, 10, 0, 0),
    ]
    expect(pilihTopInventaris(list, 2).pembeli).toEqual(['B1', 'B2'])
  })
})

describe('saringTahunAwal', () => {
  it('membuang tahun < 2020, sisanya lolos', () => {
    expect(saringTahunAwal([2018, 2019, 2020, 2026])).toEqual({ tahun: [2020, 2026], tutup: false })
  })
  it('seluruhnya tahun lama -> tahun null, tutup true', () => {
    expect(saringTahunAwal([2017, 2018])).toEqual({ tahun: null, tutup: true })
  })
  it('larik kosong (belum dipanen sama sekali) -> tutup false', () => {
    expect(saringTahunAwal([])).toEqual({ tahun: null, tutup: false })
  })
})

describe('ringkasSB', () => {
  const list = [
    agg('B1', 200, 200_000, 0, 0),   // net +200000, netLot +200
    agg('B2', 100, 90_000, 0, 0),    // net +90000, netLot +100
    agg('S1', 0, 0, 150, 180_000),   // net -180000, netLot -150
    agg('S2', 0, 0, 50, 40_000),     // net -40000, netLot -50
  ]

  it('memisah pembeli/penjual & menjumlah net volume-value sisi pembeli', () => {
    const r = ringkasSB(list)
    expect(r.pembeli.map((a) => a.broker)).toEqual(['B1', 'B2'])
    expect(r.penjual.map((a) => a.broker)).toEqual(['S1', 'S2']) // S1 paling negatif dulu
    expect(r.netVol).toBe(300)
    expect(r.netVal).toBe(290_000)
    expect(r.avg).toBeCloseTo(290_000 / (300 * 100), 6)
  })

  it('topLot/topVal Top-n menjumlah kedua sisi', () => {
    const r = ringkasSB(list)
    expect(r.topLot(1)).toBe(200 + -150)
    expect(r.topVal(1)).toBe(200_000 + -180_000)
    expect(r.topLot(2)).toBe(300 + -200)
  })

  it('larik kosong -> avg 0, tak melempar', () => {
    const r = ringkasSB([])
    expect(r.netVol).toBe(0)
    expect(r.avg).toBe(0)
  })
})
