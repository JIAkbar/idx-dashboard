import { describe, expect, it } from 'vitest'
import {
  agregatBroker, arusHarian, floorPriceBroker, irisHari, kumulatifBroker,
  tabelDuaSisi, tahunDalamRentang, type BarisBroker, type BerkasTahunan, type HariBroker,
} from './brokerEmiten'

const ringkas = (nBeli: number, nJual: number): HariBroker['ringkas'] => ({
  n_beli: nBeli, n_jual: nJual, total_lot: 0, total_nilai: 0, avg: null,
  top1_pct: null, top3_pct: null, top5_pct: null, accdist: null, cocok_volume: 1,
})

// [broker, beli_lot, beli_nilai, beli_avg, jual_lot, jual_nilai, jual_avg]
const b = (k: string, bl: number, bn: number, ba: number, jl: number, jn: number, ja: number): BarisBroker =>
  [k, bl, bn, ba, jl, jn, ja]

const hari1: HariBroker = { ringkas: ringkas(2, 2), broker: [
  b('AK', 100, 10_000, 100, 40, 4_400, 110),   // net +60 lot, +5.600
  b('CC', 10, 1_200, 120, 90, 9_000, 100),     // net −80 lot, −7.800
] }
const hari2: HariBroker = { ringkas: ringkas(1, 1), broker: [
  b('AK', 50, 6_000, 120, 0, 0, 0),            // net +50 lot, +6.000
  b('ZP', 0, 0, 0, 20, 2_000, 100),            // net −20 lot, −2.000
] }

const berkas2026: BerkasTahunan = {
  kode: 'UJI', tahun: 2026, kolom: [], n_hari: 2,
  hari: { '2026-01-05': hari1, '2026-01-06': hari2 },
}
const berkas2025: BerkasTahunan = {
  kode: 'UJI', tahun: 2025, kolom: [], n_hari: 1,
  hari: { '2025-12-30': hari2 },
}

describe('pemuat', () => {
  it('tahunDalamRentang inklusif dan tahan urutan terbalik', () => {
    expect(tahunDalamRentang('2025-12-01', '2026-02-01')).toEqual([2025, 2026])
    expect(tahunDalamRentang('2026-02-01', '2025-12-01')).toEqual([2025, 2026])
  })
  it('irisHari menggabung beberapa tahun, mengiris inklusif, urut tanggal', () => {
    const h = irisHari([berkas2026, berkas2025], '2025-12-30', '2026-01-05')
    expect(h.map((x) => x[0])).toEqual(['2025-12-30', '2026-01-05'])
  })
})

describe('agregatBroker', () => {
  it('menjumlah lintas hari dan menghitung avg tertimbang, bukan rata-rata dari rata-rata', () => {
    const agg = agregatBroker([['2026-01-05', hari1], ['2026-01-06', hari2]])
    const ak = agg.find((a) => a.broker === 'AK')!
    expect(ak.beliLot).toBe(150)
    expect(ak.beliNilai).toBe(16_000)
    expect(ak.netLot).toBe(110)
    expect(ak.netNilai).toBe(11_600)
    // 16.000 ÷ (150 lot × 100 lembar) = 1,0667 — BUKAN (100+120)/2 = 110
    expect(ak.beliAvg).toBeCloseTo(16_000 / 15_000, 6)
    expect(ak.jualAvg).toBeCloseTo(4_400 / 4_000, 6)
  })
  it('urut net nilai terbesar ke terkecil', () => {
    const agg = agregatBroker([['2026-01-05', hari1], ['2026-01-06', hari2]])
    expect(agg.map((a) => a.broker)).toEqual(['AK', 'ZP', 'CC'])
  })
})

describe('tabelDuaSisi', () => {
  const agg = agregatBroker([['2026-01-05', hari1]])
  it('gross: broker muncul di kedua sisi dengan angka kotor', () => {
    const t = tabelDuaSisi(agg, 'gross')
    expect(t.beli.map((x) => x.broker)).toEqual(['AK', 'CC'])
    expect(t.jual.map((x) => x.broker)).toEqual(['CC', 'AK'])
    expect(t.jual[0].nilai).toBe(9_000)
  })
  it('net: broker hanya di satu sisi, nilai = selisih, sisi jual positif', () => {
    const t = tabelDuaSisi(agg, 'net')
    expect(t.beli).toEqual([{ broker: 'AK', lot: 60, nilai: 5_600, avg: 1 }])
    expect(t.jual).toEqual([{ broker: 'CC', lot: 80, nilai: 7_800, avg: 1 }])
  })
})

describe('kumulatifBroker', () => {
  it('menumpuk net per broker per tanggal; broker yang absen hari itu tetap membawa nilai lama', () => {
    const k = kumulatifBroker([['2026-01-05', hari1], ['2026-01-06', hari2]], ['AK', 'CC'])
    expect(k[0].nilai).toEqual({ AK: 5_600, CC: -7_800 })
    expect(k[1].nilai).toEqual({ AK: 11_600, CC: -7_800 })
  })
  it('ukuran lot', () => {
    const k = kumulatifBroker([['2026-01-05', hari1]], ['AK'], 'lot')
    expect(k[0].nilai.AK).toBe(60)
  })
})

describe('arusHarian', () => {
  it('gross dua sisi per hari — beli dan jual seharusnya sama untuk pasar utuh', () => {
    const a = arusHarian([['2026-01-05', hari1]])
    expect(a[0]).toMatchObject({ beliLot: 110, jualLot: 130, beliNilai: 11_200, jualNilai: 13_400, nBeli: 2 })
  })
})

describe('floorPriceBroker', () => {
  it('harga beli rata-rata terendah per broker berikut tanggalnya, urut naik', () => {
    const f = floorPriceBroker([['2026-01-05', hari1], ['2026-01-06', hari2]])
    expect(f[0]).toEqual({ broker: 'AK', floor: 100, tanggal: '2026-01-05' })
    expect(f.find((x) => x.broker === 'ZP')).toBeUndefined() // tak pernah beli
  })
})
