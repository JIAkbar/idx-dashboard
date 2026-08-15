import { describe, expect, it } from 'vitest'
import { perluUlangSesi } from './adminAkun'

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
