import { describe, expect, it } from 'vitest'
import { keAngka, keTeksAngka } from '../../views/dasbor/Watchlist'

/**
 * Titik = pemisah ribuan, koma = desimal (konvensi Indonesia). Yang diuji di
 * sini bukan kerapian tampilan melainkan uang: salah tafsir "6.000" berarti
 * harga milik enam ribu tersimpan sebagai enam rupiah, dan untung-ruginya
 * melonjak 100.000% tanpa satu pun galat.
 */
describe('keAngka', () => {
  it('titik dibaca sebagai pemisah ribuan, bukan desimal', () => {
    expect(keAngka('6.000')).toBe(6000)
    expect(keAngka('1.234.567')).toBe(1234567)
  })

  it('koma dibaca sebagai desimal', () => {
    expect(keAngka('6,5')).toBe(6.5)
    expect(keAngka('1.234,5')).toBe(1234.5)
  })

  it('angka polos tanpa pemisah tetap benar', () => {
    expect(keAngka('6000')).toBe(6000)
  })

  it('kosong, nol, dan negatif = null (bukan harga milik)', () => {
    expect(keAngka('')).toBeNull()
    expect(keAngka('   ')).toBeNull()
    expect(keAngka('0')).toBeNull()
  })

  it('teks tak masuk akal = null, bukan NaN yang menjalar', () => {
    expect(keAngka('..')).toBeNull()
    expect(keAngka(',')).toBeNull()
  })
})

describe('keTeksAngka', () => {
  it('ribuan bertitik', () => {
    expect(keTeksAngka(6000)).toBe('6.000')
  })

  it('bolak-balik utuh — yang ditulis ulang terbaca sama', () => {
    for (const n of [6000, 1234567, 6.5, 1234.5, 50]) {
      expect(keAngka(keTeksAngka(n))).toBe(n)
    }
  })
})
