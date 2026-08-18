import { describe, expect, it } from 'vitest'
import { saringGlosarium, urutkanGlosarium } from './metodologi'
import type { EntriGlosarium } from './glosarium'

const e = (p: Partial<EntriGlosarium>): EntriGlosarium => ({
  id: 'x', istilah: 'X', kunci: [], definisi: '', frekuensi: 0, ...p,
})

const daftar: EntriGlosarium[] = [
  e({ id: 'volume', istilah: 'Volume', definisi: 'Jumlah lembar berpindah tangan', frekuensi: 102 }),
  e({ id: 'ara', istilah: 'ARA', definisi: 'Auto rejection atas', contoh: 'target ARA 1.245', frekuensi: 10 }),
  e({ id: 'macd', istilah: 'MACD', definisi: 'Indikator momentum', frekuensi: 40 }),
]

describe('saringGlosarium', () => {
  it('kosong = semua lewat', () => {
    expect(saringGlosarium(daftar, '')).toHaveLength(3)
  })

  it('cocok di istilah', () => {
    expect(saringGlosarium(daftar, 'macd').map((x) => x.id)).toEqual(['macd'])
  })

  it('cocok di definisi', () => {
    expect(saringGlosarium(daftar, 'momentum').map((x) => x.id)).toEqual(['macd'])
  })

  it('cocok di contoh, entri tanpa contoh tak ikut error', () => {
    expect(saringGlosarium(daftar, '1.245').map((x) => x.id)).toEqual(['ara'])
  })

  it('tak ada yang cocok = kosong', () => {
    expect(saringGlosarium(daftar, 'zzz')).toHaveLength(0)
  })
})

describe('urutkanGlosarium', () => {
  it('abjad', () => {
    expect(urutkanGlosarium(daftar, 'abjad').map((x) => x.id)).toEqual(['ara', 'macd', 'volume'])
  })

  it('frekuensi turun', () => {
    expect(urutkanGlosarium(daftar, 'frekuensi').map((x) => x.id)).toEqual(['volume', 'macd', 'ara'])
  })

  it('tidak mengubah array asal', () => {
    const asli = [...daftar]
    urutkanGlosarium(daftar, 'frekuensi')
    expect(daftar).toEqual(asli)
  })
})
