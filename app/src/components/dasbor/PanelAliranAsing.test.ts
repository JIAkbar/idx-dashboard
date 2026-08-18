import { describe, expect, it } from 'vitest'
import { netPeriode, persentilNet, kumulatifNet } from './PanelAliranAsing'
import type { AsingHarian } from '../../lib/dasbor/stockDetailData'

/** Fixture 7 hari bursa, angka dihitung tangan di komentar tiap tes. */
const D: AsingHarian[] = [
  { tanggal: '2026-08-10', beli: 100, jual: 50, volume: 0, value: 0, frekuensi: 0 },
  { tanggal: '2026-08-11', beli: 30, jual: 80, volume: 0, value: 0, frekuensi: 0 },
  { tanggal: '2026-08-12', beli: 60, jual: 60, volume: 0, value: 0, frekuensi: 0 },
  { tanggal: '2026-08-13', beli: 200, jual: 10, volume: 0, value: 0, frekuensi: 0 },
  { tanggal: '2026-08-14', beli: 10, jual: 90, volume: 0, value: 0, frekuensi: 0 },
  { tanggal: '2026-08-17', beli: 5, jual: 5, volume: 0, value: 0, frekuensi: 0 },
  { tanggal: '2026-08-18', beli: 40, jual: 20, volume: 0, value: 0, frekuensi: 0 },
]
// net harian: +50, -50, 0, +190, -80, 0, +20

describe('netPeriode', () => {
  it('null kalau tak ada data', () => {
    expect(netPeriode([], 5)).toBeNull()
  })

  it('1 hari = baris terakhir saja', () => {
    expect(netPeriode(D, 1)).toEqual({ beli: 40, jual: 20, net: 20, hariTersedia: 1 })
  })

  it('5 hari = jumlah 5 baris terakhir', () => {
    // baris 08-12..08-18: beli 60+200+10+5+40=315, jual 60+10+90+5+20=185
    expect(netPeriode(D, 5)).toEqual({ beli: 315, jual: 185, net: 130, hariTersedia: 5 })
  })

  it('minta lebih banyak dari riwayat yang ada -> pakai semua, hariTersedia turun', () => {
    expect(netPeriode(D, 20)).toEqual({ beli: 445, jual: 315, net: 130, hariTersedia: 7 })
  })
})

describe('persentilNet', () => {
  it('null kalau riwayat < 5 hari', () => {
    expect(persentilNet(D.slice(0, 4))).toBeNull()
  })

  it('persentil net hari terakhir vs sebaran 7 hari (rank standar, seri dibagi tengah)', () => {
    // nets terurut: -80,-50,0,0,+20,+50,+190 -- hari ini = +20
    // lebih kecil dari +20: 4 (-80,-50,0,0) — item sama (+20): 1
    // persentil = (4 + 1/2) / 7 * 100 = 64.2857...
    const p = persentilNet(D)
    expect(p).not.toBeNull()
    expect(p!.netHariIni).toBe(20)
    expect(p!.n).toBe(7)
    expect(p!.persentil).toBeCloseTo(64.2857, 3)
  })

  it('jendela membatasi cuma N hari terakhir yang dipakai', () => {
    const p = persentilNet(D, 5)
    // 5 hari terakhir: net 0,+190,-80,0,+20 -- hari ini = +20
    // lebih kecil: 0,+190? tidak, 190>20 jadi bukan. lebih kecil dari 20: -80,0,0 = 3, sama:1
    expect(p!.n).toBe(5)
    expect(p!.persentil).toBeCloseTo(((3 + 1 / 2) / 5) * 100, 6)
  })
})

describe('kumulatifNet', () => {
  it('running sum mulai 0 di awal rentang, cuma baris dalam rentang', () => {
    const titik = kumulatifNet(D, '2026-08-11', '2026-08-14')
    expect(titik).toEqual([
      { tanggal: '2026-08-11', kumulatif: -50 },
      { tanggal: '2026-08-12', kumulatif: -50 },
      { tanggal: '2026-08-13', kumulatif: 140 },
      { tanggal: '2026-08-14', kumulatif: 60 },
    ])
  })

  it('rentang kosong -> array kosong, bukan galat', () => {
    expect(kumulatifNet(D, '2099-01-01', '2099-01-02')).toEqual([])
  })
})
