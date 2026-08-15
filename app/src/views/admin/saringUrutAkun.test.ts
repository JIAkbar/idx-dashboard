import { describe, expect, it } from 'vitest'
import { saringUrutAkun } from './AkunAdmin'
import type { AkunRow } from '../../lib/adminAkun'

function akun(p: Partial<AkunRow> & { email: string }): AkunRow {
  return {
    id: p.email,
    alias: null,
    peran: 'kontributor',
    kuota_harian: 1,
    boleh_bedah: false,
    aktif: true,
    dibuat_pada: '2026-01-01T00:00:00Z',
    terakhir_masuk: null,
    ...p,
  }
}

const DAFTAR: AkunRow[] = [
  akun({ email: 'agit@papan.id', alias: 'Agitama', terakhir_masuk: '2026-08-15T10:07:00Z', tier: 2, kuota_harian: 5 }),
  akun({ email: 'mike@papan.id', alias: 'Michael Septian', terakhir_masuk: null, tier: 0, kuota_harian: 2 }),
  akun({ email: 'deo@papan.id', alias: 'Deonal Ramadhan', terakhir_masuk: '2026-08-15T22:05:00Z', tier: 1 }),
  akun({ email: 'firdaus@papan.id', alias: 'Firdaus', terakhir_masuk: null, aktif: false }),
]

const email = (d: AkunRow[]) => d.map((a) => a.email.split('@')[0])

describe('saringUrutAkun', () => {
  it('mencari di email maupun alias, tanpa peduli huruf besar-kecil', () => {
    expect(email(saringUrutAkun(DAFTAR, 'MIKE', 'email'))).toEqual(['mike'])
    expect(email(saringUrutAkun(DAFTAR, 'ramadhan', 'email'))).toEqual(['deo'])
    expect(saringUrutAkun(DAFTAR, 'tak ada', 'email')).toHaveLength(0)
  })

  it('kueri kosong mengembalikan semuanya', () => {
    expect(saringUrutAkun(DAFTAR, '   ', 'email')).toHaveLength(4)
  })

  it('akun yang belum pernah masuk selalu di ujung, DI KEDUA ARAH', () => {
    // Inti tesnya. Kalau null diperlakukan sebagai epoch 0, urutan "terlama"
    // akan diisi akun yang belum pernah masuk — justru menutupi apa yang
    // dicari lewat urutan itu: akun lama yang sudah lama tak muncul.
    expect(email(saringUrutAkun(DAFTAR, '', 'terbaru')).slice(0, 2)).toEqual(['deo', 'agit'])
    expect(email(saringUrutAkun(DAFTAR, '', 'terlama')).slice(0, 2)).toEqual(['agit', 'deo'])
    for (const arah of ['terbaru', 'terlama'] as const) {
      expect(email(saringUrutAkun(DAFTAR, '', arah)).slice(2).sort()).toEqual(['firdaus', 'mike'])
    }
  })

  it('mengurutkan menurut jenjang, kuota, dan status aktif', () => {
    expect(email(saringUrutAkun(DAFTAR, '', 'jenjang'))[0]).toBe('agit')
    expect(email(saringUrutAkun(DAFTAR, '', 'kuota'))[0]).toBe('agit')
    expect(email(saringUrutAkun(DAFTAR, '', 'nonaktif'))[0]).toBe('firdaus')
  })

  it('kuota manual menang atas kuota harian saat mengurutkan', () => {
    const dengan = [...DAFTAR, akun({ email: 'z@papan.id', kuota_harian: 1, kuota_manual: 50 })]
    expect(email(saringUrutAkun(dengan, '', 'kuota'))[0]).toBe('z')
  })

  it('tidak mengubah daftar aslinya', () => {
    const semula = [...DAFTAR]
    saringUrutAkun(DAFTAR, '', 'nonaktif')
    expect(DAFTAR).toEqual(semula)
  })
})
