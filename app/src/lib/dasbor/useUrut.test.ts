import { describe, it, expect } from 'vitest'
import { bandingkanBaris } from './useUrut'

const urut = (nilai: string[], arah: 'naik' | 'turun' = 'naik') =>
  nilai.map((v) => ({ v })).sort((a, b) => bandingkanBaris(a, b, 'v', arah)).map((x) => x.v)

describe('bandingkanBaris — kolom sinyal', () => {
  it('mengurut menurut ARTI, bukan alfabet', () => {
    // Alfabet akan menghasilkan: Buy, Neutral, Sell, Strong Buy, Strong Sell
    expect(urut(['Sell', 'Strong Buy', 'Neutral', 'Strong Sell', 'Buy']))
      .toEqual(['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell'])
  })

  it('arah turun membalik jadi paling bearish di atas', () => {
    expect(urut(['Buy', 'Strong Sell', 'Neutral'], 'turun'))
      .toEqual(['Strong Sell', 'Neutral', 'Buy'])
  })

  it('kapitalisasi & ejaan Indonesia ikut dikenali', () => {
    expect(urut(['sell', 'STRONG BUY', 'Netral'])).toEqual(['STRONG BUY', 'Netral', 'sell'])
  })

  it('teks BUKAN sinyal tetap alfabet', () => {
    expect(urut(['Energy', 'Basic Materials', 'Financials']))
      .toEqual(['Basic Materials', 'Energy', 'Financials'])
  })

  it('angka tetap dibanding sebagai angka', () => {
    const r = [{ v: 10 }, { v: 2 }, { v: 33 }].sort((a, b) => bandingkanBaris(a, b, 'v', 'naik'))
    expect(r.map((x) => x.v)).toEqual([2, 10, 33])
  })

  it('nilai kosong tetap di bawah di KEDUA arah', () => {
    const data = [{ v: null }, { v: 'Buy' }, { v: 'Sell' }]
    expect(data.slice().sort((a, b) => bandingkanBaris(a, b, 'v', 'naik')).at(-1)!.v).toBeNull()
    expect(data.slice().sort((a, b) => bandingkanBaris(a, b, 'v', 'turun')).at(-1)!.v).toBeNull()
  })
})
