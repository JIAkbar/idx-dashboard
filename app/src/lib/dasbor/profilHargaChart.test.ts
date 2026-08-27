import { describe, expect, it } from 'vitest'
import { kelasPita } from './profilHargaChart'

describe('kelasPita', () => {
  it('POC = pita terbesar, VA meluas ke tetangga sampai ≥70%', () => {
    // total 100; POC indeks 2 (40); perluasan: 30 (i3) → 70% tercapai.
    const k = kelasPita([5, 10, 40, 30, 10, 5])
    expect(k[2]).toBe('poc')
    expect(k[3]).toBe('va')
    expect(k[0]).toBe('luar')
    expect(k[5]).toBe('luar')
  })

  it('semua lot nol → hanya POC pertama, sisanya luar (tanpa loop abadi)', () => {
    const k = kelasPita([0, 0, 0])
    expect(k).toEqual(['poc', 'luar', 'luar'])
  })

  it('kosong → kosong', () => {
    expect(kelasPita([])).toEqual([])
  })
})
