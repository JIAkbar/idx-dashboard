import { describe, expect, it } from 'vitest'
import { jalurDiTanggal } from './supabaseSetoran'

/**
 * Tanggal setoran ikut tertanam di JALUR BERKAS, dan `path` adalah kunci unik
 * barisnya. Penulisan ulang jalur inilah bagian yang bisa salah senyap saat
 * memindahkan tanggal: kalau ia meleset, barisnya berpindah tapi berkasnya
 * tidak, dan yang tersisa cuma kartu bergambar rusak — tanpa satu pun galat.
 */
describe('jalurDiTanggal', () => {
  it('setoran harian: segmen pertama diganti, nama berkas utuh', () => {
    expect(jalurDiTanggal('2026-08-17/GIAA-broksum.png', '2026-08-14'))
      .toBe('2026-08-14/GIAA-broksum.png')
  })

  it('setoran bedah: tanggal ada di segmen KETIGA, bukan pertama', () => {
    // Kalau segmen pertama yang diganti, jalurnya jadi "2026-08-14/BUMI/…" —
    // folder yang tak pernah ada, dan pemindahannya gagal (atau lebih buruk,
    // berhasil ke tempat yang salah).
    expect(jalurDiTanggal('bedah/BUMI/2026-08-17/broksum-rentang.png', '2026-08-14'))
      .toBe('bedah/BUMI/2026-08-14/broksum-rentang.png')
  })

  it('nama berkas yang kebetulan berpola tanggal tidak ikut terganti', () => {
    expect(jalurDiTanggal('2026-08-17/2026-08-17.png', '2026-08-14'))
      .toBe('2026-08-14/2026-08-17.png')
  })

  it('jalur tanpa pola tanggal dilempar, bukan ditebak', () => {
    expect(() => jalurDiTanggal('contoh/broksum.png', '2026-08-14')).toThrow()
    expect(() => jalurDiTanggal('radar/2026-08-17/wdwl.png', '2026-08-14')).toThrow()
  })
})
