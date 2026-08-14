import { describe, expect, it } from 'vitest'
import { alasanKunci, alasanSingkat, bolehBukaKunci, type HalamanSaya } from './aksesHalaman'

const daftar: HalamanSaya[] = [
  { kunci: 'dasbor', label: 'Dasbor', tingkat: 'publik', min_tier: null, urutan: 1, boleh: true },
  { kunci: 'radar', label: 'Radar', tingkat: 'login', min_tier: 2, urutan: 2, boleh: false },
  { kunci: 'akun', label: 'Akun', tingkat: 'superadmin', min_tier: null, urutan: 3, boleh: false },
]

const namaTier = (t: number) => ({ 0: 'Pemula', 1: 'Perunggu', 2: 'Perak' } as Record<number, string>)[t] ?? `tier ${t}`

describe('bolehBukaKunci', () => {
  it('fail-open selagi daftar belum dimuat (null)', () => {
    expect(bolehBukaKunci(null, 'radar')).toBe(true)
  })

  it('pakai flag `boleh` dari baris yang cocok', () => {
    expect(bolehBukaKunci(daftar, 'dasbor')).toBe(true)
    expect(bolehBukaKunci(daftar, 'radar')).toBe(false)
  })

  it('fail-open utk kunci yang tak terdaftar (mis. salah ketik)', () => {
    expect(bolehBukaKunci(daftar, 'entah-apa')).toBe(true)
  })
})

describe('alasanKunci', () => {
  it('belum ada sesi -> ajakan masuk', () => {
    expect(alasanKunci(daftar, 'radar', false, namaTier)).toEqual({
      judul: 'Masuk dulu',
      kalimat: 'Halaman ini perlu akun untuk dibuka.',
      sasaran: 'login',
    })
  })

  it('sudah masuk, halaman butuh jenjang minimum -> sebut nama jenjang', () => {
    const a = alasanKunci(daftar, 'radar', true, namaTier)
    expect(a.sasaran).toBe('jenjang')
    expect(a.kalimat).toContain('Perak')
  })

  it('sudah masuk, halaman khusus superadmin -> pesan superadmin', () => {
    const a = alasanKunci(daftar, 'akun', true, namaTier)
    expect(a.sasaran).toBe('superadmin')
    expect(a.kalimat).toContain('superadmin')
  })
})

describe('alasanSingkat (tooltip badge rail/laci)', () => {
  it('belum masuk -> "Perlu masuk"', () => {
    expect(alasanSingkat(daftar, 'radar', false, namaTier)).toBe('Perlu masuk')
  })

  it('sudah masuk, jenjang kurang -> sebut nama jenjang minimum', () => {
    expect(alasanSingkat(daftar, 'radar', true, namaTier)).toBe('Perlu jenjang Perak')
  })

  it('khusus superadmin -> "Perlu superadmin"', () => {
    expect(alasanSingkat(daftar, 'akun', true, namaTier)).toBe('Perlu superadmin')
  })
})
