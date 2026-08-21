import { describe, it, expect } from 'vitest'
import { ringkasPilihan, type OpsiMulti } from './DropdownMulti'

/**
 * `DropdownMulti` sendiri belum diuji lewat testing-library — proyek ini
 * belum punya dependensi itu (`halamanTumbuh.test.tsx` juga menghindarinya
 * lewat `renderToStaticMarkup`, dan itu tak bisa mensimulasikan klik
 * checkbox). Yang diuji di sini: `ringkasPilihan`, fungsi murni yang
 * menentukan teks tombol — satu-satunya logika non-trivial yang bisa lepas
 * dari DOM sama sekali.
 */
const opsi: OpsiMulti[] = [
  { nilai: 'sb', label: 'Strong Buy', jumlah: 12 },
  { nilai: 'b', label: 'Buy', jumlah: 40 },
  { nilai: 'n', label: 'Neutral', jumlah: 900 },
]

describe('ringkasPilihan', () => {
  it('nol pilihan → ringkasKosong (bawaan "Semua")', () => {
    expect(ringkasPilihan([], opsi)).toBe('Semua')
  })

  it('nol pilihan → ringkasKosong kustom', () => {
    expect(ringkasPilihan([], opsi, 'Apa saja')).toBe('Apa saja')
  })

  it('satu pilihan → label opsi itu', () => {
    expect(ringkasPilihan(['b'], opsi)).toBe('Buy')
  })

  it('satu pilihan yang nilainya tak ada di opsi → jatuh balik ke nilai mentah', () => {
    expect(ringkasPilihan(['ghaib'], opsi)).toBe('ghaib')
  })

  it('dua atau lebih pilihan → "N dipilih"', () => {
    expect(ringkasPilihan(['sb', 'b'], opsi)).toBe('2 dipilih')
    expect(ringkasPilihan(['sb', 'b', 'n'], opsi)).toBe('3 dipilih')
  })
})
