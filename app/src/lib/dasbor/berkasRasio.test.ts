import { describe, it, expect } from 'vitest'
import { susunRasio, KELOMPOK_RASIO } from './berkasRasio'

describe('susunRasio', () => {
  it('menempatkan rasio pada kelompoknya', () => {
    const { kelompok } = susunRasio({
      'Current PE Ratio (TTM)': 13.75,
      'Return on Equity (TTM)': '18,2%',
      'Debt to Equity Ratio (Quarter)': 0.42,
    })
    const cari = (k: string) => kelompok.find((x) => x.kunci === k)
    expect(cari('valuasi')?.baris.map((b) => b.nama)).toContain('Current PE Ratio (TTM)')
    expect(cari('profit')?.baris.map((b) => b.nama)).toContain('Return on Equity (TTM)')
    expect(cari('utang')?.baris.map((b) => b.nama)).toContain('Debt to Equity Ratio (Quarter)')
  })

  it('membuang penanda kosong, bukan mencetaknya sebagai angka', () => {
    const { kelompok, totalTerisi, totalKosong } = susunRasio({
      'Current PE Ratio (TTM)': 10,
      'Forward PE Ratio': '-',
      'PEG Ratio': '',
      'PEG Ratio (3yr)': null,
      'PEG (Forward)': 'N/A',
    })
    const v = kelompok.find((x) => x.kunci === 'valuasi')!
    expect(v.baris.map((b) => b.nama)).toEqual(['Current PE Ratio (TTM)'])
    expect(totalTerisi).toBe(1)
    expect(totalKosong).toBeGreaterThan(0)
  })

  it('nol adalah nilai, bukan kekosongan', () => {
    const { kelompok } = susunRasio({ 'Dividend Yield': 0 })
    expect(kelompok.find((x) => x.kunci === 'dividen')?.baris[0]).toEqual({
      nama: 'Dividend Yield', nilai: '0',
    })
  })

  it('menyembunyikan kelompok bersyarat yang kosong, menahan yang biasa', () => {
    const { kelompok } = susunRasio({ 'Current PE Ratio (TTM)': 10 })
    // Bank tak berlaku untuk emiten ini — hilang, bukan tujuh baris kosong.
    expect(kelompok.find((x) => x.kunci === 'bank')).toBeUndefined()
    // Profitabilitas tetap muncul supaya terlihat sudah diperiksa.
    expect(kelompok.find((x) => x.kunci === 'profit')).toBeDefined()
  })

  it('ruas yang tak dikenal peta tetap muncul, tidak hilang diam-diam', () => {
    const { kelompok } = susunRasio({ 'Rasio Baru Dari Sumber': 1.23 })
    const lain = kelompok.find((x) => x.kunci === 'lain')
    expect(lain?.baris).toEqual([{ nama: 'Rasio Baru Dari Sumber', nilai: '1.23' }])
  })

  it('tak melempar saat sumbernya tak ada', () => {
    expect(susunRasio(null).totalTerisi).toBe(0)
    expect(susunRasio(undefined).kelompok.length).toBeGreaterThan(0)
  })

  it('peta tak punya nama kembar dalam satu kelompok', () => {
    for (const k of KELOMPOK_RASIO) {
      expect(new Set(k.isi).size, `kelompok ${k.kunci}`).toBe(k.isi.length)
    }
  })
})
