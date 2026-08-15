import { describe, it, expect } from 'vitest'
import { fraksi, keFraksi, batasAra, hariAraMinimal } from './fraksiHarga'

describe('fraksi', () => {
  it('memakai batas atas INKLUSIF — titik yang paling sering salah', () => {
    expect(fraksi(200)).toBe(1)     // tepat 200 masih jenjang pertama
    expect(fraksi(201)).toBe(2)
    expect(fraksi(2000)).toBe(5)
    expect(fraksi(2001)).toBe(10)
    expect(fraksi(5000)).toBe(10)
    expect(fraksi(5001)).toBe(25)
  })
})

describe('keFraksi', () => {
  it('membulatkan ke harga yang benar-benar bisa dipesan', () => {
    expect(keFraksi(1237)).toBe(1235)
    expect(keFraksi(1237, 'atas')).toBe(1240)
    expect(keFraksi(1237, 'bawah')).toBe(1235)
  })

  it('hasilnya selalu kelipatan fraksinya sendiri', () => {
    for (const h of [87, 199, 340, 1999, 3333, 7777, 12345]) {
      const b = keFraksi(h)
      expect(b % fraksi(b)).toBe(0)
    }
  })

  it('tidak menghasilkan harga tak sah saat melompati batas jenjang', () => {
    const b = keFraksi(1999, 'atas')
    expect(b % fraksi(b)).toBe(0)
  })

  it('harga tak masuk akal jadi nol, bukan NaN', () => {
    expect(keFraksi(0)).toBe(0)
    expect(keFraksi(-5)).toBe(0)
    expect(keFraksi(Infinity)).toBe(0)
  })
})

describe('auto rejection', () => {
  it('batas ARA bertingkat menurut harga acuan', () => {
    expect(batasAra(150)).toBe(35)
    expect(batasAra(1000)).toBe(25)
    expect(batasAra(9000)).toBe(20)
  })

  it('menghitung hari ARA bertingkat, bukan satu batas untuk seluruh jalan', () => {
    // Dari 100 naik 100%: ARA 35% dipakai sampai lewat 200, lalu 25%.
    const hari = hariAraMinimal(100, 100)
    expect(hari).toBeGreaterThanOrEqual(2)
    expect(hari).toBeLessThanOrEqual(4)
  })

  it('masukan tak masuk akal memberi nol, bukan putaran tak berujung', () => {
    expect(hariAraMinimal(0, 50)).toBe(0)
    expect(hariAraMinimal(100, 0)).toBe(0)
  })
})
