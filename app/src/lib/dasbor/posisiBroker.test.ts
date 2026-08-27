import { describe, it, expect } from 'vitest'
import { hitungPosisiBroker, trappedTopN, type BarisPosisiHari } from './posisiBroker'

function hari(broker: Array<[string, number, number, number, number]>): { broker: BarisPosisiHari[] } {
  return { broker: broker.map(([kode, beliLot, beliNilai, jualLot, jualNilai]) => ({ kode, beliLot, beliNilai, jualLot, jualNilai })) }
}

describe('hitungPosisiBroker', () => {
  it('floor = Σbeli_nilai ÷ (Σbeli_lot×100), pnl% dari hargaKini', () => {
    const tanggal = ['2026-01-01', '2026-01-02']
    const data = {
      '2026-01-01': hari([['AK', 100, 500_000, 0, 0]]), // beli 100 lot @ Rp50/lembar
      '2026-01-02': hari([['AK', 100, 700_000, 0, 0]]), // beli 100 lot @ Rp70/lembar
    }
    const [ak] = hitungPosisiBroker(tanggal, data, 66)
    // floor = 1.200.000 / (200*100) = 60
    expect(ak.floor).toBe(60)
    expect(ak.net).toBe(1_200_000)
    expect(ak.status).toBe('AKUM')
    // pnl% = (66-60)/60 = 0.1
    expect(ak.pnlPersen).toBeCloseTo(0.1, 6)
  })

  it('broker jual-saja: floor & pnl null, status DIST', () => {
    const tanggal = ['2026-01-01']
    const data = { '2026-01-01': hari([['XL', 0, 0, 50, 300_000]]) }
    const [xl] = hitungPosisiBroker(tanggal, data, 100)
    expect(xl.floor).toBeNull()
    expect(xl.pnlPersen).toBeNull()
    expect(xl.status).toBe('DIST')
  })

  it('hari sejak flip: tanda kumulatif pindah dari jual ke beli', () => {
    // Net harian: -10,-10,-10,+5,+5 -> kumulatif -10,-20,-30,-25,-20 (tanda tetap negatif seluruhnya,
    // TIDAK pernah flip -> hariSejakFlip = seluruh jendela)
    const tanggal = ['1', '2', '3', '4', '5']
    const data: Record<string, { broker: BarisPosisiHari[] }> = {
      '1': hari([['AK', 0, 0, 1, 10]]),
      '2': hari([['AK', 0, 0, 1, 10]]),
      '3': hari([['AK', 0, 0, 1, 10]]),
      '4': hari([['AK', 1, 15, 0, 0]]), // net +15-... beli 15 net di sini utk pastikan sign berubah
      '5': hari([['AK', 1, 25, 0, 0]]),
    }
    // net harian: -10,-10,-10,+15,+25 -> kum: -10,-20,-30,-15,+10 -> flip di hari-5 (tanda -,-,-,-,+)
    const [ak] = hitungPosisiBroker(tanggal, data, null)
    expect(ak.hariSejakFlip).toBe(1) // hanya hari terakhir yang positif
  })

  it('hari sejak flip: broker jual-saja sepanjang jendela = seluruh panjang jendela', () => {
    const tanggal = ['1', '2', '3']
    const data: Record<string, { broker: BarisPosisiHari[] }> = {
      '1': hari([['XL', 0, 0, 1, 10]]),
      '2': hari([['XL', 0, 0, 1, 10]]),
      '3': hari([['XL', 0, 0, 1, 10]]),
    }
    const [xl] = hitungPosisiBroker(tanggal, data, null)
    expect(xl.hariSejakFlip).toBe(3)
  })

  it('tren MELEPAS: status AKUM jendela penuh tapi 10 hari terakhir net jual', () => {
    const tanggal = Array.from({ length: 12 }, (_, i) => String(i + 1))
    const data: Record<string, { broker: BarisPosisiHari[] }> = {}
    // 2 hari pertama beli besar (dominasi net AKUM keseluruhan), 10 hari terakhir jual kecil terus
    data['1'] = hari([['AK', 100, 1_000_000, 0, 0]])
    data['2'] = hari([['AK', 100, 1_000_000, 0, 0]])
    for (let i = 3; i <= 12; i++) data[String(i)] = hari([['AK', 0, 0, 1, 1_000]])
    const [ak] = hitungPosisiBroker(tanggal, data, null)
    expect(ak.status).toBe('AKUM') // net total masih positif
    expect(ak.tren).toBe('MELEPAS')
  })
})

describe('trappedTopN', () => {
  it('menghitung berapa dari top-N net-buyer yang pnl% < 0, jujur kalau net-buyer < n', () => {
    const posisi = [
      { kode: 'A', net: 300, beliNilai: 0, beliLot: 0, floor: 100, pnlPersen: -0.1, hariSejakFlip: 1, status: 'AKUM' as const, tren: null, seriHarian: [] },
      { kode: 'B', net: 200, beliNilai: 0, beliLot: 0, floor: 100, pnlPersen: 0.2, hariSejakFlip: 1, status: 'AKUM' as const, tren: null, seriHarian: [] },
      { kode: 'C', net: -50, beliNilai: 0, beliLot: 0, floor: null, pnlPersen: null, hariSejakFlip: 1, status: 'DIST' as const, tren: null, seriHarian: [] },
    ]
    const r = trappedTopN(posisi, 5)
    expect(r.total).toBe(2) // cuma 2 net-buyer di sampel ini
    expect(r.trapped).toBe(1) // A saja yang pnl < 0
  })
})
