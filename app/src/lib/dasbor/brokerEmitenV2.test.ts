import { describe, expect, it } from 'vitest'
import {
  irisOhlcv, vwapRentang, titikKuadran, labelKuadran, pilihTopInventaris, ringkasSB, saringTahunAwal,
  polaNegoBroker, konsensusKategori, type BarisOhlcv,
} from './brokerEmitenV2'
import type { AgregatBroker, BarisBroker, HariBroker } from './brokerEmiten'
import type { DaftarKategoriBroker } from './kategoriBroker'

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

describe('labelKuadran', () => {
  it('beli di bawah VWAP -> Beli di Bawah VWAP', () => {
    expect(labelKuadran({ deltaVwapPct: -3, netNilai: 100 })).toBe('Beli di Bawah VWAP')
  })
  it('beli di atas VWAP -> Beli di Atas VWAP', () => {
    expect(labelKuadran({ deltaVwapPct: 2, netNilai: 100 })).toBe('Beli di Atas VWAP')
  })
  it('jual di bawah VWAP -> Jual di Bawah VWAP', () => {
    expect(labelKuadran({ deltaVwapPct: -2, netNilai: -100 })).toBe('Jual di Bawah VWAP')
  })
  it('jual di atas VWAP -> Jual di Atas VWAP', () => {
    expect(labelKuadran({ deltaVwapPct: 5, netNilai: -100 })).toBe('Jual di Atas VWAP')
  })
  it('net nol dihitung sisi beli', () => {
    expect(labelKuadran({ deltaVwapPct: -1, netNilai: 0 })).toBe('Beli di Bawah VWAP')
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
  // TAHUN_AWAL 2020 -> 2016 (keputusan Johan 27 Agu, backfill 2016-2019
  // selesai) — kasus uji ikut bergeser ke lantai sumber 2016.
  it('membuang tahun < 2016, sisanya lolos', () => {
    expect(saringTahunAwal([2014, 2015, 2016, 2026])).toEqual({ tahun: [2016, 2026], tutup: false })
  })
  it('seluruhnya tahun lama -> tahun null, tutup true', () => {
    expect(saringTahunAwal([2014, 2015])).toEqual({ tahun: null, tutup: true })
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

const ringkas = (nBeli: number, nJual: number): HariBroker['ringkas'] => ({
  n_beli: nBeli, n_jual: nJual, total_lot: 0, total_nilai: 0, avg: null,
  top1_pct: null, top3_pct: null, top5_pct: null, accdist: null, cocok_volume: 1,
})
const b = (k: string, bl: number, bn: number, jl: number, jn: number): BarisBroker => [k, bl, bn, jl, jn]

describe('polaNegoBroker', () => {
  it('nego beli + reg net jual -> berlawanan, "Nego Beli → Reg Jual"', () => {
    const hari: HariBroker = {
      ringkas: ringkas(1, 1),
      broker: [b('AK', 0, 0, 100, 10_000)], // reg: net jual -10.000
      nego: { ringkas: ringkas(1, 0), broker: [b('AK', 50, 5_000, 0, 0)] }, // nego: beli 5.000
    }
    const r = polaNegoBroker([['2026-01-05', hari]])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ broker: 'AK', kelas: 'berlawanan', pola: 'Nego Beli → Reg Jual', regNetNilai: -10_000 })
  })
  it('nego jual + reg net beli -> berlawanan, "Nego Jual → Reg Beli"', () => {
    const hari: HariBroker = {
      ringkas: ringkas(1, 1),
      broker: [b('CC', 100, 10_000, 0, 0)], // reg: net beli +10.000
      nego: { ringkas: ringkas(0, 1), broker: [b('CC', 0, 0, 50, 5_000)] }, // nego: jual 5.000
    }
    const r = polaNegoBroker([['2026-01-05', hari]])
    expect(r[0]).toMatchObject({ broker: 'CC', kelas: 'berlawanan', pola: 'Nego Jual → Reg Beli' })
  })
  it('nego beli + reg net beli juga -> searah', () => {
    const hari: HariBroker = {
      ringkas: ringkas(1, 0),
      broker: [b('ZP', 100, 10_000, 0, 0)],
      nego: { ringkas: ringkas(1, 0), broker: [b('ZP', 50, 5_000, 0, 0)] },
    }
    expect(polaNegoBroker([['2026-01-05', hari]])[0]).toMatchObject({ kelas: 'searah', pola: 'Searah' })
  })
  it('broker nego tanpa padanan reguler hari itu -> regNetNilai 0, searah', () => {
    const hari: HariBroker = {
      ringkas: ringkas(0, 0), broker: [],
      nego: { ringkas: ringkas(1, 0), broker: [b('XX', 10, 1_000, 0, 0)] },
    }
    expect(polaNegoBroker([['2026-01-05', hari]])[0]).toMatchObject({ regNetNilai: 0, kelas: 'searah' })
  })
  it('hari tanpa varian nego dilewati', () => {
    const hari: HariBroker = { ringkas: ringkas(1, 0), broker: [b('AK', 10, 1_000, 0, 0)] }
    expect(polaNegoBroker([['2026-01-05', hari]])).toEqual([])
  })
})

describe('konsensusKategori', () => {
  const daftar: DaftarKategoriBroker = {
    dibangun: '2026-08-27T11:49:19+07:00',
    jendela: { mulai: '2026-02-18', akhir: '2026-08-24', n_hari: 120 },
    kalibrasi: {
      q3_share: 0, median_directionality: 0, median_konsistensi: 0,
      per_kategori: {} as unknown as DaftarKategoriBroker['kalibrasi']['per_kategori'],
      per_gaya: {} as unknown as DaftarKategoriBroker['kalibrasi']['per_gaya'],
    },
    broker: {
      AK: { kategori: 'whale', gaya: 'akumulasi', share: 0, directionality: 0, konsistensi: 0, net_nilai: 0, gross_nilai: 0, z_vol_terakhir: 0 },
      BK: { kategori: 'whale', gaya: 'akumulasi', share: 0, directionality: 0, konsistensi: 0, net_nilai: 0, gross_nilai: 0, z_vol_terakhir: 0 },
      CC: { kategori: 'ritel', gaya: 'campuran', share: 0, directionality: 0, konsistensi: 0, net_nilai: 0, gross_nilai: 0, z_vol_terakhir: 0 },
    },
  }
  it('n beli/jual & net gabungan per kategori dari agg', () => {
    const aggList: AgregatBroker[] = [agg('AK', 100, 10_000, 0, 0), agg('BK', 0, 0, 50, 4_000), agg('CC', 10, 1_000, 0, 0)]
    const hasil = konsensusKategori([], aggList, daftar)
    const whale = hasil.find((k) => k.id === 'whale')!
    expect(whale.nBeli).toBe(1)
    expect(whale.nJual).toBe(1)
    expect(whale.netGabungan).toBe(10_000 - 4_000)
    const ritel = hasil.find((k) => k.id === 'ritel')!
    expect(ritel.nBeli).toBe(1)
    expect(ritel.netGabungan).toBe(1_000)
    // smart/smart_ritel tak punya anggota di fixture -> 0, bukan galat
    expect(hasil.find((k) => k.id === 'smart')!.nBeli).toBe(0)
  })
  it('konsistensi n/5: hari yang net kategorinya searah tanda netGabungan', () => {
    // whale netGabungan keseluruhan +6.000 (dari agg) -> tanda +1
    const aggList: AgregatBroker[] = [agg('AK', 100, 10_000, 0, 4_000)] // net +6.000
    const hariList: Array<[string, HariBroker]> = [
      ['2026-01-05', { ringkas: ringkas(1, 0), broker: [b('AK', 10, 1_000, 0, 0)] }],   // net +1.000 -> searah
      ['2026-01-06', { ringkas: ringkas(0, 1), broker: [b('AK', 0, 0, 10, 500)] }],     // net -500 -> tak searah
    ]
    const whale = konsensusKategori(hariList, aggList, daftar).find((k) => k.id === 'whale')!
    expect(whale.dariHari).toBe(2)
    expect(whale.konsistensi).toBe(1)
  })
  it('daftar null -> semua kategori kosong, bukan galat', () => {
    const hasil = konsensusKategori([], [agg('AK', 10, 1_000, 0, 0)], null)
    expect(hasil.every((k) => k.nBeli === 0 && k.nJual === 0 && k.netGabungan === 0)).toBe(true)
  })
})
