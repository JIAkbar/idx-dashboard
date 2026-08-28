import { describe, it, expect } from 'vitest'
import { ringkasPemegang, bacaKonsentrasi } from './berkasPemegang'
import type { HariBroker } from './whalesPapan'

/** Satu hari buatan. `broker` = [kode, beliLot, beliNilai, jualLot, jualNilai]. */
function hari(tanggal: string, broker: HariBroker['broker'], brokerAsing?: HariBroker['broker']): HariBroker {
  return { tanggal, avg: 100, totalLot: 0, broker, brokerAsing }
}

describe('ringkasPemegang', () => {
  it('memisahkan penampung dari pelepas menurut NET, bukan gross', () => {
    const h = [hari('2026-01-02', [
      // AA sibuk dua arah tapi posisinya nyaris rata — BUKAN penampung.
      ['AA', 1000, 10_000_000, 990, 9_900_000],
      // BB kecil tapi net beli murni.
      ['BB', 100, 1_000_000, 0, 0],
      ['CC', 0, 0, 500, 5_000_000],
    ])]
    const r = ringkasPemegang(h)
    expect(r.penampung.map((x) => x.kode)).toEqual(['BB', 'AA'])
    expect(r.pelepas.map((x) => x.kode)).toEqual(['CC'])
    // gross AA jauh lebih besar dari BB, tapi netnya lebih kecil
    expect(r.penampung[0].netLot).toBe(100)
    expect(r.penampung[1].netLot).toBe(10)
  })

  it('avgBeli dihitung per LEMBAR (lot x 100), bukan per lot', () => {
    const r = ringkasPemegang([hari('2026-01-02', [['AA', 10, 1_000_000, 0, 0]])])
    // 1.000.000 rupiah / (10 lot x 100 lembar) = 1.000 per lembar
    expect(r.penampung[0].avgBeli).toBe(1000)
  })

  it('porsi asing null ketika varian asing tak ada — bukan nol', () => {
    const r = ringkasPemegang([hari('2026-01-02', [['AA', 100, 1_000_000, 0, 0]])])
    expect(r.porsiAsingTotal).toBeNull()
    expect(r.penampung[0].porsiAsing).toBeNull()
  })

  it('porsi asing dihitung hanya dari hari yang punya variannya', () => {
    const h = [
      hari('2026-01-02', [['AA', 100, 1_000_000, 0, 0]], [['AA', 60, 600_000, 0, 0]]),
      hari('2026-01-05', [['AA', 100, 1_000_000, 0, 0]]),   // tanpa varian asing
    ]
    const r = ringkasPemegang(h)
    // 60 lot asing dari 200 lot beli = 30%
    expect(r.porsiAsingTotal).toBeCloseTo(0.3, 5)
  })

  it('porsi asing dijepit ke 1 — arsip tak konsisten tak boleh melahirkan 140%', () => {
    const h = [hari('2026-01-02', [['AA', 100, 1_000_000, 0, 0]], [['AA', 140, 1_400_000, 0, 0]])]
    expect(ringkasPemegang(h).porsiAsingTotal).toBe(1)
  })

  it('konsentrasi3 dari NET sisi beli saja', () => {
    const h = [hari('2026-01-02', [
      ['AA', 800, 0, 0, 0], ['BB', 100, 0, 0, 0], ['CC', 50, 0, 0, 0], ['DD', 50, 0, 0, 0],
    ])]
    const r = ringkasPemegang(h)
    expect(r.konsentrasi3).toBeCloseTo(950 / 1000, 5)
  })

  it('hari tanpa baris broker dilewati, tidak dihitung sebagai hari sepi', () => {
    const h = [hari('2026-01-01', []), hari('2026-01-02', [['AA', 10, 0, 0, 0]])]
    const r = ringkasPemegang(h)
    expect(r.nHari).toBe(1)
    expect(r.tglMulai).toBe('2026-01-02')
  })

  it('hanya n hari TERAKHIR yang dipakai', () => {
    const h = Array.from({ length: 30 }, (_, i) =>
      hari(`2026-01-${String(i + 1).padStart(2, '0')}`, [['AA', 1, 0, 0, 0]]))
    const r = ringkasPemegang(h, 5)
    expect(r.nHari).toBe(5)
    expect(r.tglAkhir).toBe('2026-01-30')
    expect(r.penampung[0].netLot).toBe(5)
  })

  it('daftar kosong tak melempar', () => {
    const r = ringkasPemegang([])
    expect(r.nHari).toBe(0)
    expect(r.konsentrasi3).toBeNull()
    expect(r.penampung).toEqual([])
  })
})

describe('bacaKonsentrasi', () => {
  it('mencetak angkanya, bukan cuma label', () => {
    expect(bacaKonsentrasi(0.85)).toContain('85%')
    expect(bacaKonsentrasi(0.85)).toContain('Sangat terpusat')
    expect(bacaKonsentrasi(0.65)).toContain('Terpusat')
    expect(bacaKonsentrasi(0.3)).toContain('Menyebar')
    expect(bacaKonsentrasi(null)).toBeNull()
  })
})
