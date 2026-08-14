import { describe, expect, it } from 'vitest'
import { perluUlangSesi } from './adminAkun'

describe('perluUlangSesi', () => {
  it('401 + sesi_kedaluwarsa true → perlu ulang', () => {
    expect(perluUlangSesi(401, { sesi_kedaluwarsa: true })).toBe(true)
  })

  it('401 tanpa flag sesi_kedaluwarsa → jangan ulang (403/401 biasa)', () => {
    expect(perluUlangSesi(401, {})).toBe(false)
    expect(perluUlangSesi(401, { sesi_kedaluwarsa: false })).toBe(false)
  })

  it('status lain (403/500) walau flag true → jangan ulang', () => {
    expect(perluUlangSesi(403, { sesi_kedaluwarsa: true })).toBe(false)
    expect(perluUlangSesi(500, { sesi_kedaluwarsa: true })).toBe(false)
  })

  it('200 OK → jangan ulang', () => {
    expect(perluUlangSesi(200, {})).toBe(false)
  })
})
