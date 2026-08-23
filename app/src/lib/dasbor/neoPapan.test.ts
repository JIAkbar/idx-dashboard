import { describe, it, expect } from 'vitest'
import {
  agregasiBroker, avgHarga, kumulatifBroker, topNet,
  kalenderBrokerHarian, stalkerAgregasi, kodeBrokerUnik,
  zScoreBergerak, rsRatioMomentum, porsiBergerak,
  musimanHari, musimanBulan, moneyFlowAsing, pilihKandidatSektor,
} from './neoPapan'
import type { BarHarga, BrokerHarianEmiten, HariBroker } from './neoPapanData'

function hari(broker: Array<[string, number, number, number, number]>): HariBroker {
  return {
    ringkas: null,
    broker: broker.map(([kode, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode, beliLot, beliNilai, jualLot, jualNilai })),
  }
}

describe('agregasiBroker', () => {
  it('menjumlah dua hari untuk broker yang sama', () => {
    const h = {
      '2026-01-01': hari([['AK', 100, 10_000, 50, 5_000]]),
      '2026-01-02': hari([['AK', 20, 2_000, 0, 0], ['BK', 10, 1_000, 10, 1_000]]),
    }
    const agg = agregasiBroker(h, ['2026-01-01', '2026-01-02'])
    const ak = agg.find((a) => a.kode === 'AK')!
    expect(ak.beliLot).toBe(120)
    expect(ak.beliNilai).toBe(12_000)
    expect(ak.jualNilai).toBe(5_000)
    expect(ak.net).toBe(12_000 - 5_000)
    const bk = agg.find((a) => a.kode === 'BK')!
    expect(bk.net).toBe(0)
  })

  it('mengabaikan tanggal yang tak ada di berkas', () => {
    const h = { '2026-01-01': hari([['AK', 1, 100, 0, 0]]) }
    const agg = agregasiBroker(h, ['2026-01-01', '2026-01-99'])
    expect(agg).toHaveLength(1)
  })
})

describe('avgHarga', () => {
  it('nol lot -> null, bukan Infinity/NaN', () => {
    expect(avgHarga(1000, 0)).toBeNull()
  })
  it('lot dikali 100 (lembar per lot)', () => {
    expect(avgHarga(20_000, 1)).toBe(200)
  })
})

describe('kumulatifBroker & topNet', () => {
  const h = {
    '2026-01-01': hari([['AK', 10, 1000, 0, 0], ['BK', 0, 0, 10, 1000]]),
    '2026-01-02': hari([['AK', 10, 1000, 0, 0], ['BK', 0, 0, 5, 500]]),
  }
  it('kumulatif berjalan menaik tiap hari untuk net buyer', () => {
    const r = kumulatifBroker(['2026-01-01', '2026-01-02'], h, ['AK', 'BK'])
    const ak = r.seri.find((s) => s.broker === 'AK')!
    expect(ak.nilai).toEqual([1000, 2000])
    const bk = r.seri.find((s) => s.broker === 'BK')!
    expect(bk.nilai).toEqual([-1000, -1500])
  })
  it('topNet memilah pembeli/penjual terbesar', () => {
    const agg = agregasiBroker(h, ['2026-01-01', '2026-01-02'])
    const { pembeli, penjual } = topNet(agg, 1)
    expect(pembeli[0].kode).toBe('AK')
    expect(penjual[0].kode).toBe('BK')
  })
})

describe('stalkerAgregasi', () => {
  const peta = new Map<string, BrokerHarianEmiten>([
    ['BUMI', { kode: 'BUMI', jendelaHari: 2, hari: { '2026-01-01': hari([['AK', 100, 10_000, 0, 0]]), '2026-01-02': hari([['AK', 50, 5_000, 0, 0]]) } }],
    ['DEWA', { kode: 'DEWA', jendelaHari: 1, hari: { '2026-01-02': hari([['AK', 0, 0, 200, 20_000]]) } }],
    ['ANTM', { kode: 'ANTM', jendelaHari: 1, hari: { '2026-01-02': hari([['BK', 10, 1_000, 0, 0]]) } }],
  ])

  it('kalender gabungan = union tanggal seluruh emiten', () => {
    expect(kalenderBrokerHarian(peta)).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('menjumlah net broker terpilih lintas emiten, memisah net buy/sell', () => {
    const r = stalkerAgregasi(peta, ['AK'], 2)
    expect(r.jendela).toEqual(['2026-01-01', '2026-01-02'])
    expect(r.netBuy).toHaveLength(1)
    expect(r.netBuy[0]).toMatchObject({ emiten: 'BUMI', net: 15_000, cakupanHari: 2 })
    expect(r.netSell).toHaveLength(1)
    expect(r.netSell[0]).toMatchObject({ emiten: 'DEWA', net: -20_000, cakupanHari: 1 })
    // ANTM tak punya baris AK sama sekali -> tak muncul di kedua daftar.
    expect(r.netBuy.find((x) => x.emiten === 'ANTM')).toBeUndefined()
    expect(r.netSell.find((x) => x.emiten === 'ANTM')).toBeUndefined()
  })

  it('cakupanHari mencatat emiten yang arsipnya belum menutupi seluruh jendela', () => {
    const r = stalkerAgregasi(peta, ['AK'], 2)
    // DEWA cuma punya 1 dari 2 hari jendela.
    expect(r.netSell[0].cakupanHari).toBe(1)
  })

  it('kodeBrokerUnik mengumpulkan seluruh kode broker yang muncul', () => {
    expect(kodeBrokerUnik(peta)).toEqual(['AK', 'BK'])
  })
})

describe('zScoreBergerak & rsRatioMomentum', () => {
  it('deret konstan -> z-score 100 (stdev nol)', () => {
    expect(zScoreBergerak([5, 5, 5, 5], 3)).toEqual([100, 100, 100, 100])
  })
  it('nilai di atas rata-rata jendela -> di atas 100', () => {
    const z = zScoreBergerak([1, 1, 1, 10], 4)
    expect(z[3]).toBeGreaterThan(100)
  })
  it('rsRatioMomentum menghasilkan dua deret sepanjang input', () => {
    const { rsRatio, rsMomentum } = rsRatioMomentum([100, 101, 99, 103, 98], 3)
    expect(rsRatio).toHaveLength(5)
    expect(rsMomentum).toHaveLength(5)
  })
})

describe('porsiBergerak', () => {
  it('porsi grup terhadap total, rata-rata bergerak', () => {
    const grup = [10, 10, 10, 10]
    const total = [100, 100, 100, 100]
    const p = porsiBergerak(grup, total, 2)
    expect(p[0]).toBeCloseTo(0.1)
    expect(p[3]).toBeCloseTo(0.1)
  })
  it('total nol pada satu hari tak melempar galat (jadi porsi nol)', () => {
    const p = porsiBergerak([5], [0], 5)
    expect(p[0]).toBe(0)
  })
})

describe('musimanHari & musimanBulan', () => {
  function bar(t: string, c: number): BarHarga {
    return { t, o: c, h: c, l: c, c, v: 0, val: 0, freq: 0, fb: 0, fs: 0, so: 0 }
  }
  it('membagi return harian ke 5 hari kerja', () => {
    // Senin 2026-01-05 .. Jumat 2026-01-09 (2026-01-01 itu Kamis, aman diabaikan).
    const bars = [
      bar('2026-01-05', 100), // Senin
      bar('2026-01-06', 110), // Selasa: +10%
      bar('2026-01-07', 99),  // Rabu: -10%
    ]
    const stat = musimanHari(bars)
    expect(stat).toHaveLength(5)
    // Selasa (index 1) naik 100%, n=1
    expect(stat[1].naikPersen).toBe(100)
    expect(stat[1].n).toBe(1)
    // Rabu (index 2) turun 100%
    expect(stat[2].turunPersen).toBe(100)
  })

  it('membagi return akhir bulan ke 12 bulan', () => {
    const bars = [
      bar('2026-01-31', 100),
      bar('2026-02-27', 105),
      bar('2026-03-31', 100),
    ]
    const stat = musimanBulan(bars)
    expect(stat).toHaveLength(12)
    expect(stat[1].n).toBe(1) // Februari
    expect(stat[1].naikPersen).toBe(100)
  })

  it('kurang dari 2 bar -> statistik kosong, bukan galat', () => {
    expect(musimanHari([bar('2026-01-01', 100)])).toHaveLength(5)
    expect(musimanHari([bar('2026-01-01', 100)])[0].n).toBe(0)
  })
})

describe('pilihKandidatSektor', () => {
  it('mengurutkan tiap sektor by nilai desc dan memotong ke perSektor', () => {
    const baris = [
      { kode: 'A', sektor: 'Energi', nilai: 100 },
      { kode: 'B', sektor: 'Energi', nilai: 300 },
      { kode: 'C', sektor: 'Energi', nilai: 200 },
      { kode: 'D', sektor: 'Keuangan', nilai: 50 },
    ]
    const r = pilihKandidatSektor(baris, 2)
    expect(r.Energi).toEqual(['B', 'C'])
    expect(r.Keuangan).toEqual(['D'])
  })
  it('mengabaikan baris tanpa sektor atau nilai', () => {
    const r = pilihKandidatSektor([{ kode: 'A', sektor: '', nilai: 10 }, { kode: 'B', sektor: 'X', nilai: null }], 5)
    expect(r).toEqual({})
  })
})

describe('moneyFlowAsing', () => {
  it('selisih beli-jual asing', () => {
    expect(moneyFlowAsing({ t: '', o: 0, h: 0, l: 0, c: 0, v: 0, val: 0, freq: 0, fb: 300, fs: 120, so: 0 })).toBe(180)
  })
})
