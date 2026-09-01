import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bacaJejak, type JejakHorizon } from '../../lib/dasbor/rencanaSaham'

/**
 * Penjaga kartu Rencana & Rekam Jejak.
 *
 * Yang dijaga bukan tata letaknya (itu diverifikasi di peramban) melainkan
 * satu klaim yang gampang rusak diam-diam saat seseorang merapikan tampilan:
 * **ekspektansi harus tetap jadi angka utama, bukan win rate.**
 *
 * Sebabnya terukur. BUMI pada 1 Sep 2026 menang 57,6% dari sinyal yang tuntas
 * di lima hari sementara ekspektansinya −1,203% per sinyal — incarannya +5,8%,
 * batas ruginya −12,1%. Menaikkan win rate jadi angka besar akan membuat
 * pembaca menyimpulkan kebalikan dari yang datanya katakan, dan tak ada galat
 * yang akan memberitahu.
 */
const DIR = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(DIR, 'RencanaJejak.tsx'), 'utf8')
const JSX = SRC.slice(SRC.lastIndexOf('*/') + 2)

const buat = (o: Partial<JejakHorizon>): JejakHorizon => ({
  menang: 0, kalah: 0, gantung: 0, n: 0,
  winRate: null, winRateSemua: null, ekspektansi: null, ...o,
})

describe('bacaJejak — kalimat yang dibaca pembaca', () => {
  it('menang sering TAPI ekspektansi negatif dibaca sebagai rugi', () => {
    // Kasus BUMI. Ini inti seluruh komponen.
    const r = bacaJejak(buat({ n: 120, menang: 53, kalah: 39, gantung: 28, winRate: 57.6, ekspektansi: -1.203 }))
    expect(r.nada).toBe('buruk')
    expect(r.kalimat).toMatch(/sering menang.*tetap rugi/i)
  })

  it('ekspektansi positif dibaca sebagai menguntungkan', () => {
    const r = bacaJejak(buat({ n: 100, menang: 40, kalah: 30, winRate: 57.1, ekspektansi: 0.8 }))
    expect(r.nada).toBe('baik')
  })

  it('win rate rendah DAN rugi tak memakai kalimat "sering menang"', () => {
    const r = bacaJejak(buat({ n: 100, menang: 20, kalah: 60, winRate: 25, ekspektansi: -2 }))
    expect(r.nada).toBe('buruk')
    expect(r.kalimat).not.toMatch(/sering menang/i)
  })

  it('riwayat kosong tidak dibaca sebagai buruk', () => {
    expect(bacaJejak(buat({})).nada).toBe('sepi')
    expect(bacaJejak(undefined).nada).toBe('sepi')
  })
})

describe('tata angka utama', () => {
  it('ekspektansi muncul SEBELUM win rate di blok angka besar', () => {
    const blok = JSX.slice(JSX.indexOf('rj-angka'), JSX.indexOf('rj-baca'))
    const iEks = blok.indexOf('ekspektansi')
    const iWr = blok.indexOf('winRate')
    expect(iEks).toBeGreaterThan(-1)
    expect(iWr).toBeGreaterThan(-1)
    expect(iEks).toBeLessThan(iWr)
  })

  it('win rate TIDAK dibuang — membuangnya juga menyesatkan', () => {
    expect(JSX).toMatch(/winRate/)
    expect(JSX).toMatch(/winRateSemua/)
  })

  it('menggantung ikut ditampilkan, bukan disembunyikan', () => {
    expect(JSX).toMatch(/gantung/)
    expect(JSX).toMatch(/menggantung/i)
  })

  it('imbalan:risiko di bawah 1 diberi peringatan eksplisit', () => {
    expect(JSX).toMatch(/rrLemah/)
    expect(JSX).toMatch(/lebih kecil dari yang dipertaruhkan/i)
  })
})

describe('kejujuran teks', () => {
  it('tak menjanjikan peluang masa depan', () => {
    expect(JSX).toMatch(/[Ff]rekuensi masa lalu, bukan peluang/)
  })

  it('tak membocorkan istilah mesin ke layar', () => {
    for (const r of [/data-idx/, /\.json/, /ohlcv_stockbit/, /chartbit/i, /marketdetectors/i]) {
      expect(JSX).not.toMatch(r)
    }
  })
})

describe('CSS', () => {
  const CSS = readFileSync(join(DIR, 'RencanaJejak.css'), 'utf8')

  it('TIDAK berprefiks .lantai — pelajaran #307, aturan berprefiks tak pernah berlaku di sini', () => {
    expect(CSS).not.toMatch(/^\s*\.lantai\s/m)
  })

  it('tabel jejak menggulung di kotaknya sendiri — halaman tak boleh geser mendatar', () => {
    expect(CSS).toMatch(/\.rj-gulir\s*\{[^}]*overflow-x:\s*auto/)
  })

  it('warna diambil dari token, bukan hex yang disalin', () => {
    const hexKeras = CSS.match(/:\s*#[0-9a-f]{3,8}\b/gi) ?? []
    // Yang boleh tinggal cadangan di dalam var(--x, #fallback).
    const tanpaCadangan = CSS.replace(/var\([^)]*\)/g, '')
    const nakal = tanpaCadangan.match(/:\s*#[0-9a-f]{3,8}\b/gi) ?? []
    expect(nakal, `hex tanpa token: ${nakal.join(', ')}`).toHaveLength(0)
    expect(hexKeras.length).toBeGreaterThanOrEqual(0)
  })
})
