import { describe, expect, it } from 'vitest'
import { perluUlangSesi, butuhPaksa } from './adminAkun'

describe('perluUlangSesi', () => {
  it('401 + sesi_kedaluwarsa true → perlu ulang', () => {
    expect(perluUlangSesi(401, { sesi_kedaluwarsa: true })).toBe(true)
  })

  it('401 polos dari gateway (verify_jwt menyala) → tetap perlu ulang', () => {
    // Kasus yang dulu lolos: gateway menolak token basi sebelum permintaan
    // sampai ke fungsi, jadi tak ada flag `sesi_kedaluwarsa` untuk dikenali.
    expect(perluUlangSesi(401, {})).toBe(true)
    expect(perluUlangSesi(401, { sesi_kedaluwarsa: false })).toBe(true)
  })

  it('status lain (403/500) walau flag true → jangan ulang', () => {
    expect(perluUlangSesi(403, { sesi_kedaluwarsa: true })).toBe(false)
    expect(perluUlangSesi(500, { sesi_kedaluwarsa: true })).toBe(false)
  })

  it('200 OK → jangan ulang', () => {
    expect(perluUlangSesi(200, {})).toBe(false)
  })
})

/**
 * `butuhPaksa` — penanda "penolakan ini boleh dilanjutkan".
 *
 * Yang dijaga di sini bukan kasus positifnya, melainkan yang NEGATIF: server
 * punya tiga pagar hapus akun, dan hanya SATU yang boleh dilewati. Dua lainnya
 * (menghapus diri sendiri, menghapus superadmin lain) melindungi sistem, bukan
 * catatan — kalau tombol "hapus paksa" sampai muncul di sana, pagar yang tak
 * pernah dimaksudkan bisa ditembus lewat layar.
 */
describe('butuhPaksa', () => {
  it('penolakan karena setoran disetujui → boleh dilanjutkan, bawa angkanya', () => {
    const e = Object.assign(new Error('punya 2 setoran yang sudah disetujui'), {
      butuhPaksa: true,
      setoranDisetujui: 2,
    })
    expect(butuhPaksa(e)).toEqual({ setoran: 2 })
  })

  it('pagar yang MUTLAK tidak pernah memunculkan tombol paksa', () => {
    expect(butuhPaksa(new Error('Tidak bisa menghapus akun sendiri.'))).toBeNull()
    expect(butuhPaksa(new Error('Turunkan dulu perannya jadi kontributor sebelum dihapus.'))).toBeNull()
  })

  it('bukan galat, atau galat tanpa penanda → null', () => {
    expect(butuhPaksa(null)).toBeNull()
    expect(butuhPaksa(undefined)).toBeNull()
    expect(butuhPaksa(new Error('Gagal memanggil admin-akun (500).'))).toBeNull()
  })
})
