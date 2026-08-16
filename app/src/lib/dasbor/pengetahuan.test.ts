import { describe, expect, it } from 'vitest'
import { cariPengetahuan, PENGETAHUAN } from './pengetahuan'

describe('cariPengetahuan', () => {
  it('menjawab fraksi harga', () => {
    const e = cariPengetahuan('berapa fraksi harga saham di bawah 200?')
    expect(e?.id).toBe('fraksi-harga')
    expect(e?.isi).toContain('Rp1')
  })

  it('menjawab ARA/ARB dengan angka yang cocok dengan lib/fraksiHarga.ts', () => {
    const e = cariPengetahuan('berapa batas ARA hari ini')
    expect(e?.id).toBe('auto-rejection')
    expect(e?.isi).toContain('35%')
  })

  it('menjawab apa itu top stocks', () => {
    const e = cariPengetahuan('apa itu top stocks')
    expect(e?.id).toBe('halaman-top-stocks')
    expect(e?.ke).toBe('/stocks')
  })

  it('menjawab istilah broker summary, bukan orderbook', () => {
    const e = cariPengetahuan('kenapa disebut orderbook')
    expect(e?.id).toBe('istilah-broker-summary')
    expect(e?.isi).toContain('bukan')
  })

  it('menjawab kebijakan kredit kontributor', () => {
    const e = cariPengetahuan('kredit kontributor ikut yang mana kalau tidak dimuat edisi')
    expect(e?.id).toBe('kredit-setoran')
  })

  it('pertanyaan di luar topik mengembalikan null, bukan tebakan', () => {
    expect(cariPengetahuan('siapa presiden indonesia sekarang')).toBeNull()
  })

  it('pertanyaan kosong mengembalikan null', () => {
    expect(cariPengetahuan('   ')).toBeNull()
  })

  it('kata kunci tumpang tindih — "apa itu seasonality" menang ke entri HALAMAN (kecocokan lebih banyak)', () => {
    const e = cariPengetahuan('apa itu seasonality')
    expect(e?.id).toBe('halaman-seasonality')
  })

  it('kata kunci tumpang tindih — "pola musiman itu apa" menang ke entri ISTILAH, bukan halaman', () => {
    const e = cariPengetahuan('pola musiman itu apa maksudnya')
    expect(e?.id).toBe('istilah-seasonality')
  })

  it('tiap entri wajib punya kunci, judul, dan isi tak kosong', () => {
    for (const entri of PENGETAHUAN) {
      expect(entri.kunci.length).toBeGreaterThan(0)
      expect(entri.judul.trim().length).toBeGreaterThan(0)
      expect(entri.isi.trim().length).toBeGreaterThan(0)
    }
  })

  it('id tiap entri unik', () => {
    const ids = PENGETAHUAN.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
