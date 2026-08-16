import { describe, expect, it } from 'vitest'
import { saringKabar, daftarBulan } from './Kabar'
import type { KabarItem } from '../../lib/dasbor/kabar'

const it_ = (p: Partial<KabarItem>): KabarItem => ({
  sumber: 'IPOT News', jenis: 'berita', judul: 'Judul', tautan: 't', waktu: null, emiten: [], ...p,
})

const daftar: KabarItem[] = [
  it_({ tautan: 'a', judul: 'IHSG menguat', waktu: '2026-08-16T10:00:00+07:00' }),
  it_({ tautan: 'b', judul: 'Emiten BBCA rilis laporan', waktu: '2026-07-04T10:00:00+07:00', emiten: ['BBCA'] }),
  it_({ tautan: 'c', judul: 'Kabar Kontan', sumber: 'Kontan', waktu: '2026-01-09T10:00:00+07:00' }),
  it_({ tautan: 'd', judul: 'Pengumuman resmi', sumber: 'IDX', jenis: 'pengumuman', waktu: '2026-08-15T10:00:00+07:00' }),
  it_({ tautan: 'e', judul: 'Tanpa tanggal', waktu: null }),
]

describe('daftarBulan', () => {
  it('cuma bulan yang benar-benar ada isinya, terbaru dulu', () => {
    expect(daftarBulan(daftar)).toEqual(['2026-08', '2026-07', '2026-01'])
  })

  it('item tanpa waktu tak melahirkan bulan kosong', () => {
    expect(daftarBulan([it_({ waktu: null })])).toEqual([])
  })
})

describe('saringKabar — bulan', () => {
  it('menyaring ke bulan yang dipilih', () => {
    expect(saringKabar(daftar, 'Semua', '', '2026-07').map((i) => i.tautan)).toEqual(['b'])
  })

  it('item tanpa waktu disembunyikan saat bulan dipilih, bukan diikutkan', () => {
    // Menaruhnya di bulan mana pun berarti mengarang tanggal yang tak ada.
    expect(saringKabar(daftar, 'Semua', '', '2026-08').map((i) => i.tautan)).toEqual(['a', 'd'])
  })

  it('tanpa bulan dipilih, semuanya lewat — termasuk yang tanpa waktu', () => {
    expect(saringKabar(daftar, 'Semua', '')).toHaveLength(5)
  })

  it('bulan bekerja bersama tab dan pencarian, bukan menggantikannya', () => {
    expect(saringKabar(daftar, 'IPOT News', 'bbca', '2026-07').map((i) => i.tautan)).toEqual(['b'])
    expect(saringKabar(daftar, 'IPOT News', 'bbca', '2026-08')).toHaveLength(0)
  })
})
