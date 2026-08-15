import { describe, it, expect } from 'vitest'
import { perluRayakan } from './sambutan'
import { rakitSandi } from './sandiRakit'

describe('perluRayakan', () => {
  it('merayakan kenaikan dari catatan yang ada', () => {
    expect(perluRayakan('1', 2)).toBe(true)
    expect(perluRayakan('0', 5)).toBe(true)
  })

  it('DIAM saat belum ada catatan sama sekali', () => {
    // Akun lama / peramban baru / localStorage dibersihkan. Merayakan di sini
    // berarti mengucapkan selamat atas sesuatu yang tidak terjadi — dan untuk
    // Pemula yang belum menyetor apa pun, itu jelas terasa palsu.
    expect(perluRayakan(null, 0)).toBe(false)
    expect(perluRayakan(null, 3)).toBe(false)
  })

  it('DIAM saat jenjang tetap atau turun', () => {
    expect(perluRayakan('2', 2)).toBe(false)
    expect(perluRayakan('3', 1)).toBe(false)
  })

  it('DIAM saat catatan rusak (bukan angka)', () => {
    expect(perluRayakan('entah', 2)).toBe(false)
  })
})

describe('rakitSandi', () => {
  it('berbentuk <Nama><4 angka> dan cukup panjang untuk server', () => {
    const s = rakitSandi('agitama')
    expect(s).toMatch(/^Agitama\d{4}$/)
    expect(s.length).toBeGreaterThanOrEqual(8)
  })

  it('membuang spasi & memotong nama panjang di 10 huruf', () => {
    // "Michael Septian" -> "Michaelsep" + 4 angka. Dipotong supaya sandinya
    // tetap pendek saat dibacakan lewat telepon.
    expect(rakitSandi('Michael Septian')).toMatch(/^Michaelsep\d{4}$/)
  })

  it('jatuh ke kata cadangan kalau nama terlalu pendek setelah dibersihkan', () => {
    // Alias satu huruf, angka saja, atau emoji: hasilnya tetap harus bisa
    // dibacakan lewat WhatsApp dan tetap lolos batas 8 karakter server.
    for (const nama of ['A', '123', '🔥🔥']) {
      const s = rakitSandi(nama)
      expect(s).toMatch(/^Papan\d{4}$/)
      expect(s.length).toBeGreaterThanOrEqual(8)
    }
  })

  it('tidak mengulang sandi yang sama beruntun', () => {
    const kumpulan = new Set(Array.from({ length: 20 }, () => rakitSandi('warda')))
    expect(kumpulan.size).toBeGreaterThan(1)
  })
})
