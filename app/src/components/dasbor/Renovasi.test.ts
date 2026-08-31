import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RENOVASI_AKTIF } from './Renovasi'

/**
 * Penjaga pemberitahuan renovasi.
 *
 * Yang dijaga bukan tata letaknya (itu diverifikasi di peramban) melainkan dua
 * hal yang gampang rusak diam-diam saat renovasi berakhir dan seseorang
 * membersihkan kode:
 *
 * 1. **Saklarnya tetap satu tempat.** Mematikan pemberitahuan ini harus cukup
 *    dengan mengubah satu konstanta. Kalau ia pernah tersebar ke beberapa
 *    berkas, mematikannya jadi pekerjaan berisiko.
 * 2. **Pesannya tetap jujur.** Kalimatnya wajib menyebut bahwa DATANYA belum
 *    diperbarui — bukan cuma "sedang ada perbaikan". Pembaca yang mengira
 *    situsnya cuma sedang dipercantik akan tetap memakai angkanya.
 */
const DIR = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(DIR, 'Renovasi.tsx'), 'utf8')
const JSX = SRC.slice(SRC.lastIndexOf('*/') + 2).replace(/\s+/g, ' ')

describe('pemberitahuan renovasi', () => {
  it('saklarnya satu konstanta yang diekspor', () => {
    expect(typeof RENOVASI_AKTIF).toBe('boolean')
  })

  it('menyebut DATANYA belum diperbarui, bukan sekadar "sedang perbaikan"', () => {
    expect(JSX).toMatch(/datanya belum diperbarui/i)
    expect(JSX).toMatch(/angka.*(berubah|tertinggal)/i)
  })

  it('TIDAK menjanjikan tanggal — tanggal yang meleset jadi teks basi publik', () => {
    expect(JSX).not.toMatch(/\b\d{1,2}\s+(Sep|Okt|Nov|Des|Jan)/i)
    expect(JSX).not.toMatch(/\b(besok|minggu depan|beberapa hari)\b/i)
  })

  it('memakai sessionStorage, bukan localStorage', () => {
    // localStorage akan menyembunyikan pemberitahuan SELAMANYA sesudah satu
    // klik — termasuk dari pembaca yang kembali seminggu kemudian.
    //
    // Diperiksa atas KODE-nya, bukan seluruh berkas: kata `localStorage` muncul
    // sekali di komentar dokumentasi, justru untuk menerangkan kenapa ia TIDAK
    // dipakai. Versi pertama uji ini memeriksa seluruh berkas dan gagal karena
    // kalimat penjelas itu — menghukum dokumentasi yang benar.
    const kode = SRC.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(kode).toMatch(/sessionStorage/)
    expect(kode).not.toMatch(/localStorage/)
  })

  it('pita permanen ada, bukan cuma modal', () => {
    // Modal saja tak cukup: sesudah ditutup, pembaca yang menggulir berjam-jam
    // kehilangan petunjuk bahwa angkanya sedang tak diperbarui.
    expect(JSX).toMatch(/rnv-pita/)
  })

  it('tak membocorkan istilah mesin ke layar', () => {
    for (const r of [/data-idx/, /\.json/, /VITE_/, /getstocksummary/i]) {
      expect(JSX).not.toMatch(r)
    }
  })
})
