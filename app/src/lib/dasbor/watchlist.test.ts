import { describe, it, expect, beforeEach } from 'vitest'
import {
  hargaRataRata, untungRugi, ambilHargaTerakhir,
  muatWatchlist, tambahEmiten, hapusEmiten, simpanHargaMilik,
} from './watchlist'

/** Polyfill localStorage minimal — tak ada jsdom di setup vitest proyek ini
 *  (lihat vite.config.ts), jadi `localStorage` global tak ada bawaan. */
class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})

describe('hargaRataRata', () => {
  it('null kalau belum ada harga milik', () => {
    expect(hargaRataRata([])).toBeNull()
  })
  it('rata-rata beberapa entri', () => {
    expect(hargaRataRata([{ harga: 1000, tanggal: '' }, { harga: 2000, tanggal: '' }])).toBe(1500)
  })
})

describe('untungRugi', () => {
  it('untung: harga sekarang di atas harga milik', () => {
    const r = untungRugi(1000, 1200)
    expect(r.rp).toBe(200)
    expect(r.persen).toBeCloseTo(20)
  })
  it('rugi: harga sekarang di bawah harga milik', () => {
    const r = untungRugi(1000, 800)
    expect(r.rp).toBe(-200)
    expect(r.persen).toBeCloseTo(-20)
  })
  it('tak pernah membagi nol', () => {
    expect(untungRugi(0, 100).persen).toBe(0)
  })
})

describe('ambilHargaTerakhir', () => {
  it('null kalau berkas kosong', () => {
    expect(ambilHargaTerakhir([])).toBeNull()
  })
  it('chgPersen null di baris pertama (tak ada pembanding)', () => {
    const r = ambilHargaTerakhir([['2026-08-18', 100, 100, 100, 100, 1000]])
    expect(r?.harga).toBe(100)
    expect(r?.chgPersen).toBeNull()
  })
  it('chgPersen dihitung dari dua baris terakhir', () => {
    const r = ambilHargaTerakhir([
      ['2026-08-18', 100, 105, 100, 100, 1000],
      ['2026-08-19', 100, 110, 100, 110, 1000],
    ])
    expect(r?.harga).toBe(110)
    expect(r?.chgPersen).toBeCloseTo(10)
  })
})

describe('penyimpan localStorage (muat/tambah/hapus/simpanHargaMilik)', () => {
  it('mulai kosong', () => {
    expect(muatWatchlist()).toEqual([])
  })
  it('tambah kode baru, tak duplikat kalau ditambah lagi', () => {
    tambahEmiten('bbca')
    const dua = tambahEmiten('BBCA')
    expect(dua).toHaveLength(1)
    expect(dua[0].kode).toBe('BBCA')
    expect(dua[0].beli).toEqual([])
  })
  it('hapus mengeluarkan kode dari daftar', () => {
    tambahEmiten('BBCA')
    tambahEmiten('BBRI')
    const sisa = hapusEmiten('BBCA')
    expect(sisa.map((i) => i.kode)).toEqual(['BBRI'])
  })
  it('simpanHargaMilik mengisi lalu mengosongkan kembali', () => {
    tambahEmiten('BBCA')
    const isi = simpanHargaMilik('BBCA', 9500)
    expect(hargaRataRata(isi[0].beli)).toBe(9500)
    const kosong = simpanHargaMilik('BBCA', null)
    expect(hargaRataRata(kosong[0].beli)).toBeNull()
  })
  it('tersimpan lintas panggilan (muatWatchlist baca ulang dari localStorage)', () => {
    tambahEmiten('BBCA')
    expect(muatWatchlist().map((i) => i.kode)).toEqual(['BBCA'])
  })
})
