import { describe, expect, it } from 'vitest'
import { perluSambutan, kunciSambutan } from './sambutan'

describe('perluSambutan', () => {
  it('belum pernah tersimpan (login pertama di perangkat ini) → tampil', () => {
    expect(perluSambutan(null, '2026-08-14T08:00:00Z')).toBe(true)
  })

  it('penanda tersimpan sama dengan sesi aktif (refresh halaman / pindah tab & balik) → tidak tampil', () => {
    expect(perluSambutan('2026-08-14T08:00:00Z', '2026-08-14T08:00:00Z')).toBe(false)
  })

  it('sesi login baru (keluar lalu masuk lagi) → penanda beda → tampil', () => {
    expect(perluSambutan('2026-08-14T08:00:00Z', '2026-08-14T09:30:00Z')).toBe(true)
  })

  it('belum ada sesi aktif (logout / belum login) → tidak tampil apa pun penanda tersimpan', () => {
    expect(perluSambutan('2026-08-14T08:00:00Z', null)).toBe(false)
    expect(perluSambutan('2026-08-14T08:00:00Z', undefined)).toBe(false)
  })
})

describe('kunciSambutan', () => {
  it('key per-user supaya tidak tabrakan antar akun di perangkat sama', () => {
    expect(kunciSambutan('user-a')).toBe('sambut:user-a')
    expect(kunciSambutan('user-b')).toBe('sambut:user-b')
  })
})
