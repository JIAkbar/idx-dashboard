import { describe, it, expect } from 'vitest'
import { pesanGalat } from './pesanGalat'

describe('pesanGalat', () => {
  it('membaca PostgrestError yang BUKAN turunan Error', () => {
    // Bentuk persis yang dikembalikan supabase-js v2. Inilah kasus yang selama
    // ini jatuh ke teks cadangan dan menyembunyikan sebab sebenarnya.
    const e = {
      message: 'new row violates row-level security policy for table "akses_halaman"',
      details: null, hint: null, code: '42501',
    }
    expect(pesanGalat(e, 'Gagal menyimpan.')).toContain('row-level security')
  })

  it('menggabungkan details/hint yang memuat sebab sebenarnya', () => {
    const e = { message: 'Gagal', details: 'Key (kunci) sudah ada.', hint: null, code: '23505' }
    expect(pesanGalat(e)).toBe('Gagal — Key (kunci) sudah ada.')
  })

  it('tidak mengulang details kalau isinya sama dengan message', () => {
    const e = { message: 'Sama', details: 'Sama' }
    expect(pesanGalat(e)).toBe('Sama')
  })

  it('tetap membaca Error biasa', () => {
    expect(pesanGalat(new Error('Jaringan putus'))).toBe('Jaringan putus')
  })

  it('menerima galat berupa string', () => {
    expect(pesanGalat('Sesi kedaluwarsa')).toBe('Sesi kedaluwarsa')
  })

  it('jatuh ke cadangan hanya kalau benar-benar tidak ada pesan', () => {
    expect(pesanGalat(null, 'Gagal memuat.')).toBe('Gagal memuat.')
    expect(pesanGalat({}, 'Gagal memuat.')).toBe('Gagal memuat.')
    expect(pesanGalat({ message: '   ' }, 'Gagal memuat.')).toBe('Gagal memuat.')
  })
})
