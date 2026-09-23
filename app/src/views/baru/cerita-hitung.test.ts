import { describe, expect, it } from 'vitest'
import { susunFaktaHarian, susunFaseBroker, type BarisOhlc, type BarisAsing, type HariBrokerPuncak } from './cerita-hitung'

const ohlc: BarisOhlc[] = [
  ['2026-09-01', 100, 105, 99, 100, 1000],
  ['2026-09-02', 100, 108, 100, 106, 1200],
  ['2026-09-03', 106, 107, 103, 104, 900],
]
const asing: BarisAsing[] = [
  ['2026-09-02', 500, 300, 1200, 120000, 10],
  ['2026-09-03', 200, 600, 900, 90000, 8],
]
const broker: HariBrokerPuncak[] = [
  { tanggal: '2026-09-02', accdist: 'Acc', total_nilai: 120000, beli: [['KZ', 5000]], jual: [['RX', -2000]] },
  { tanggal: '2026-09-03', accdist: 'Dist', total_nilai: 90000, beli: [['CC', 1000]], jual: [['ZP', -4000]] },
]

describe('susunFaktaHarian', () => {
  it('chgPct terhadap penutupan hari bursa sebelumnya', () => {
    const f = susunFaktaHarian(ohlc, asing, broker, 10)
    expect(f).toHaveLength(3)
    expect(f[0].chgPct).toBeNull() // tak ada hari sebelum 09-01 di riwayat
    expect(f[1].chgPct).toBeCloseTo(6, 5) // (106-100)/100*100
    expect(f[2].chgPct).toBeCloseTo(-1.886792, 5) // (104-106)/106*100
  })

  it('hari pertama pada potongan n tetap dapat chgPct benar dari riwayat penuh', () => {
    const f = susunFaktaHarian(ohlc, asing, broker, 2)
    expect(f).toHaveLength(2)
    expect(f[0].tanggal).toBe('2026-09-02')
    expect(f[0].chgPct).toBeCloseTo(6, 5)
  })

  it('net asing lembar = beli - jual; hari tanpa data asing -> null', () => {
    const f = susunFaktaHarian(ohlc, asing, broker, 10)
    expect(f[0].netAsingLembar).toBeNull()
    expect(f[1].netAsingLembar).toBe(200)
    expect(f[2].netAsingLembar).toBe(-400)
  })

  it('broker_puncak null (belum dibangun agen data) -> semua hari broker null, tak melempar galat', () => {
    const f = susunFaktaHarian(ohlc, asing, null, 10)
    expect(f.every((h) => h.broker === null)).toBe(true)
  })

  it('asing null -> semua netAsingLembar null', () => {
    const f = susunFaktaHarian(ohlc, null, broker, 10)
    expect(f.every((h) => h.netAsingLembar === null)).toBe(true)
  })
})

describe('susunFaseBroker', () => {
  it('menghitung hari Dist dari n hari terakhir', () => {
    expect(susunFaseBroker(broker, 5)).toEqual({ dist: 1, total: 2 })
  })

  it('data lebih pendek dari n -> total ikut data yang ada', () => {
    expect(susunFaseBroker([broker[1]], 5)).toEqual({ dist: 1, total: 1 })
  })

  it('null -> nol/nol', () => {
    expect(susunFaseBroker(null, 5)).toEqual({ dist: 0, total: 0 })
  })
})
