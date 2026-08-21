import { describe, expect, it } from 'vitest'
import { TINGKAT_LIKUIDITAS, kodePeringkatTeratas, ujiLikuiditas } from './likuiditas'

interface Baris { kode: string; nilai: number | null }
const kode = (b: Baris) => b.kode
const nilai = (b: Baris) => b.nilai

describe('ujiLikuiditas', () => {
  it('semua selalu lolos, termasuk null', () => {
    expect(ujiLikuiditas({ kode: 'A', nilai: null }, 'semua', nilai, null, kode)).toBe(true)
    expect(ujiLikuiditas({ kode: 'A', nilai: 1 }, 'semua', nilai, null, kode)).toBe(true)
  })

  it('tiap ambang rupiah menyaring tepat batasnya, null gagal', () => {
    for (const t of TINGKAT_LIKUIDITAS.filter((x) => x.min != null)) {
      const tepat = { kode: 'A', nilai: t.min! }
      const kurang = { kode: 'B', nilai: t.min! - 1 }
      const kosong = { kode: 'C', nilai: null }
      expect(ujiLikuiditas(tepat, t.id, nilai, null, kode)).toBe(true)
      expect(ujiLikuiditas(kurang, t.id, nilai, null, kode)).toBe(false)
      expect(ujiLikuiditas(kosong, t.id, nilai, null, kode)).toBe(false)
    }
  })

  it('semesta memakai set teratas, bukan nilai langsung', () => {
    const teratas = new Set(['A', 'B'])
    expect(ujiLikuiditas({ kode: 'A', nilai: 1 }, 'semesta', nilai, teratas, kode)).toBe(true)
    expect(ujiLikuiditas({ kode: 'Z', nilai: 999 }, 'semesta', nilai, teratas, kode)).toBe(false)
    expect(ujiLikuiditas({ kode: 'A', nilai: 1 }, 'semesta', nilai, null, kode)).toBe(false)
  })
})

describe('kodePeringkatTeratas', () => {
  function buatBaris(n: number): Baris[] {
    return Array.from({ length: n }, (_, i) => ({ kode: `K${i}`, nilai: n - i }))
  }

  it('mengambil PERSIS n teratas dan menghormati urutan nilai', () => {
    const baris = buatBaris(300) // K0 nilai 300 (tertinggi) ... K299 nilai 1
    const set = kodePeringkatTeratas(baris, nilai, 150, kode)
    expect(set.size).toBe(150)
    expect(set.has('K0')).toBe(true)
    expect(set.has('K149')).toBe(true)
    expect(set.has('K150')).toBe(false)
    expect(set.has('K299')).toBe(false)
  })

  it('daftar lebih pendek dari n → semuanya masuk', () => {
    const baris = buatBaris(80)
    const set = kodePeringkatTeratas(baris, nilai, 150, kode)
    expect(set.size).toBe(80)
    for (const b of baris) expect(set.has(b.kode)).toBe(true)
  })

  it('null diabaikan, tak pernah masuk peringkat', () => {
    const baris: Baris[] = [{ kode: 'A', nilai: 5 }, { kode: 'B', nilai: null }]
    const set = kodePeringkatTeratas(baris, nilai, 150, kode)
    expect(set.has('A')).toBe(true)
    expect(set.has('B')).toBe(false)
    expect(set.size).toBe(1)
  })
})

describe('TINGKAT_LIKUIDITAS', () => {
  it('urut longgar -> ketat: ambang min menaik monoton', () => {
    const dgnMin = TINGKAT_LIKUIDITAS.filter((t) => t.min != null)
    for (let i = 1; i < dgnMin.length; i++) {
      expect(dgnMin[i].min!).toBeGreaterThan(dgnMin[i - 1].min!)
    }
  })

  it('tepat lima tingkat dengan id yang diharapkan', () => {
    expect(TINGKAT_LIKUIDITAS.map((t) => t.id)).toEqual(['semua', 'jt100', 'mrd1', 'mrd5', 'semesta'])
  })
})
