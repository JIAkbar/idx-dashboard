import { describe, it, expect } from 'vitest'
import { ambilHargaDariYahoo, ambilHargaDariLokal } from './hargaTerakhir'

describe('ambilHargaDariYahoo', () => {
  it('mengurai harga & nama dari bentuk respons Yahoo chart', () => {
    const j = { chart: { result: [{ meta: { regularMarketPrice: 2150, longName: 'Aneka Tambang Tbk' } }] } }
    expect(ambilHargaDariYahoo(j)).toEqual({ harga: 2150, nama: 'Aneka Tambang Tbk' })
  })

  it('shortName dipakai kalau longName kosong', () => {
    const j = { chart: { result: [{ meta: { regularMarketPrice: 2150, shortName: 'ANTM' } }] } }
    expect(ambilHargaDariYahoo(j)).toEqual({ harga: 2150, nama: 'ANTM' })
  })

  it('null kalau harga kosong atau nol — bukan cuma bentuk JSON yang beda', () => {
    expect(ambilHargaDariYahoo({})).toBeNull()
    expect(ambilHargaDariYahoo({ chart: { result: [] } })).toBeNull()
    expect(ambilHargaDariYahoo({ chart: { result: [{ meta: { regularMarketPrice: 0 } }] } })).toBeNull()
  })
})

describe('ambilHargaDariLokal', () => {
  it('mengurai harga emiten dari berkas cadangan bulanan', () => {
    const j = { bulan: 'Juli 2026', harga: { ANTM: 2100, BBCA: 9500 } }
    expect(ambilHargaDariLokal(j, 'ANTM')).toEqual({ harga: 2100, bulan: 'Juli 2026' })
  })

  it('null kalau kode emiten tak ada di cadangan', () => {
    const j = { bulan: 'Juli 2026', harga: { BBCA: 9500 } }
    expect(ambilHargaDariLokal(j, 'ANTM')).toBeNull()
  })
})
