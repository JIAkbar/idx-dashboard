import { describe, expect, it } from 'vitest'
import {
  kunciGambar, uraiGambar, bacaGambarTersimpan, tulisGambarTersimpan, VERSI_GAMBAR,
  bacaGayaBawaan, tulisGayaBawaan, dashDariGaya, gayaDariDash, GAYA_BAWAAN,
  type GambarTersimpan, type GayaGambar,
} from './gambarGrafik'

// Lingkungan uji vitest berkas ini 'node' (bukan jsdom) — tak ada `localStorage`
// bawaan. Stub minimal, cukup untuk `baca`/`tulisGambarTersimpan` (Map biasa),
// bukan polyfill lengkap Web Storage API.
if (typeof globalThis.localStorage === 'undefined') {
  const toko = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => toko.get(k) ?? null,
    setItem: (k: string, v: string) => { toko.set(k, v) },
    removeItem: (k: string) => { toko.delete(k) },
    clear: () => { toko.clear() },
    key: (i: number) => [...toko.keys()][i] ?? null,
    get length() { return toko.size },
  } as Storage
}

describe('kunciGambar', () => {
  it('kunci berbeda per emiten — gambar BBCA tak boleh menimpa TLKM', () => {
    expect(kunciGambar('BBCA')).not.toBe(kunciGambar('TLKM'))
    expect(kunciGambar('BBCA')).toBe('papan:grafik-gambar:BBCA')
  })
})

const gambarSah: GambarTersimpan = {
  versi: VERSI_GAMBAR,
  type: 'trend-line',
  id: 'tl-1',
  anchors: [{ waktu: '2024-01-15', harga: 100 }, { waktu: '2024-02-15', harga: 110 }],
  style: { lineColor: '#2962FF' },
  options: {},
}

describe('uraiGambar', () => {
  it('null/kosong -> daftar kosong', () => {
    expect(uraiGambar(null)).toEqual([])
    expect(uraiGambar('')).toEqual([])
    expect(uraiGambar('bukan json{')).toEqual([])
    expect(uraiGambar('{"bukan":"array"}')).toEqual([])
  })

  it('menerima daftar sah apa adanya', () => {
    expect(uraiGambar(JSON.stringify([gambarSah]))).toEqual([gambarSah])
  })

  it('melewati baris versi tak dikenal, bukan menjatuhkan seluruh daftar', () => {
    const rusak = { ...gambarSah, id: 'tl-2', versi: 99 }
    expect(uraiGambar(JSON.stringify([gambarSah, rusak]))).toEqual([gambarSah])
  })

  it('melewati baris tanpa type/id/anchors', () => {
    const tanpaType = { ...gambarSah, type: undefined }
    const tanpaId = { ...gambarSah, id: '' }
    const tanpaAnchor = { ...gambarSah, anchors: [] }
    expect(uraiGambar(JSON.stringify([tanpaType]))).toEqual([])
    expect(uraiGambar(JSON.stringify([tanpaId]))).toEqual([])
    expect(uraiGambar(JSON.stringify([tanpaAnchor]))).toEqual([])
  })

  it('melewati anchor yang harganya bukan angka berhingga (NaN/Infinity/teks)', () => {
    const nan = { ...gambarSah, id: 'tl-3', anchors: [{ waktu: '2024-01-15', harga: Number.NaN }] }
    const teks = { ...gambarSah, id: 'tl-4', anchors: [{ waktu: '2024-01-15', harga: '100' }] }
    expect(uraiGambar(JSON.stringify([nan]))).toEqual([])
    expect(uraiGambar(JSON.stringify([teks]))).toEqual([])
  })

  it('style/options yang bukan objek jatuh ke {} — bukan ditolak seluruhnya', () => {
    const raw = [{ ...gambarSah, style: null, options: 'x' }]
    const hasil = uraiGambar(JSON.stringify(raw))
    expect(hasil).toEqual([{ ...gambarSah, style: {}, options: {} }])
  })
})

describe('baca/tulis gambar tersimpan — bolak-balik & per-emiten', () => {
  it('serialisasi bolak-balik: tulis lalu baca menghasilkan data yang sama', () => {
    localStorage.clear()
    tulisGambarTersimpan('BBCA', [gambarSah])
    expect(bacaGambarTersimpan('BBCA')).toEqual([gambarSah])
  })

  it('menulis untuk satu emiten tak menyentuh emiten lain', () => {
    localStorage.clear()
    tulisGambarTersimpan('BBCA', [gambarSah])
    tulisGambarTersimpan('TLKM', [])
    expect(bacaGambarTersimpan('BBCA')).toEqual([gambarSah])
    expect(bacaGambarTersimpan('TLKM')).toEqual([])
  })

  it('emiten yang belum pernah disimpan mengembalikan daftar kosong', () => {
    localStorage.clear()
    expect(bacaGambarTersimpan('ASII')).toEqual([])
  })
})

describe('gaya gambar bawaan (global, bukan per emiten — #185 lanjutan)', () => {
  it('belum pernah disetel -> GAYA_BAWAAN', () => {
    localStorage.clear()
    expect(bacaGayaBawaan()).toEqual(GAYA_BAWAAN)
  })

  it('bolak-balik: tulis lalu baca menghasilkan gaya yang sama', () => {
    localStorage.clear()
    const g: GayaGambar = { warna: '#38B77E', tebal: 3, gaya: 'dashed' }
    tulisGayaBawaan(g)
    expect(bacaGayaBawaan()).toEqual(g)
  })

  it('bentuk rusak (JSON tak valid, ruas hilang, gaya di luar enum) jatuh ke GAYA_BAWAAN', () => {
    localStorage.setItem('papan:alat-gambar-gaya', 'bukan json{')
    expect(bacaGayaBawaan()).toEqual(GAYA_BAWAAN)
    localStorage.setItem('papan:alat-gambar-gaya', JSON.stringify({ warna: '#000' }))
    expect(bacaGayaBawaan()).toEqual(GAYA_BAWAAN)
    localStorage.setItem('papan:alat-gambar-gaya', JSON.stringify({ warna: '#000', tebal: 2, gaya: 'miring' }))
    expect(bacaGayaBawaan()).toEqual(GAYA_BAWAAN)
    localStorage.setItem('papan:alat-gambar-gaya', JSON.stringify({ warna: '#000', tebal: 0, gaya: 'solid' }))
    expect(bacaGayaBawaan()).toEqual(GAYA_BAWAAN)
  })
})

describe('dashDariGaya / gayaDariGaya — bolak-balik gaya garis <-> lineDash pustaka', () => {
  it('solid -> larik kosong, dan sebaliknya', () => {
    expect(dashDariGaya('solid')).toEqual([])
    expect(gayaDariDash([])).toBe('solid')
    expect(gayaDariDash(undefined)).toBe('solid')
  })

  it('dashed/dotted bolak-balik ke gaya yang sama', () => {
    expect(gayaDariDash(dashDariGaya('dashed'))).toBe('dashed')
    expect(gayaDariDash(dashDariGaya('dotted'))).toBe('dotted')
  })
})
