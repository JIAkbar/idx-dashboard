import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Penjaga teks `BedaSkor` — komponen penanda "dua skor, sengaja berbeda" yang
 * dipasang di tab Screener dan tab Harian sesudah peleburan menu.
 *
 * Kenapa diuji lewat SUMBERNYA, bukan dengan merender: kedua halaman
 * pemakainya ada di balik login, jadi verifikasi layar butuh Johan masuk
 * sendiri (aturan proyek: agen tak pernah mengisi kolom sandi). Yang perlu
 * dijaga di sini bukan tata letaknya melainkan ISI KALIMATNYA, dan itu bisa
 * diperiksa dari teks sumber tanpa peramban sama sekali.
 *
 * Yang dijaga ada dua, dan keduanya pernah gagal senyap di proyek ini:
 *
 * 1. **Pesannya tidak boleh hilang.** Tanpa kalimat ini, dua tab bersebelahan
 *    memberi vonis berbeda untuk emiten yang sama tanpa keterangan — dan
 *    pembaca pertama yang menyadarinya akan melaporkannya sebagai cacat.
 * 2. **Istilah mesin tak boleh tayang.** Halaman Metodologi pernah terbit
 *    dengan nama berkas internal tercetak di layar publik; aturan proyek
 *    melarang nama endpoint, nama berkas, nama fungsi, dan angka kalibrasi
 *    muncul di teks yang dibaca pengguna. Uji ini memeriksa string yang
 *    DIRENDER saja — blok komentar di atas komponen sengaja dilewati, karena
 *    di situ istilah teknis memang boleh dan perlu.
 */
const AKAR = dirname(fileURLToPath(import.meta.url))
const SUMBER = readFileSync(join(AKAR, 'BedaSkor.tsx'), 'utf8')

/** Isi setelah blok komentar penutup — bagian yang benar-benar jadi kode &
 *  teks tayang. Komentar dokumentasi di atasnya tak ikut diperiksa.
 *
 *  Spasi DIRATAKAN jadi satu: JSX menyatukan baris saat merender, jadi
 *  "bukan\n      kekeliruan" di sumber tampil sebagai "bukan kekeliruan" di
 *  layar. Memeriksa sumber mentah membuat uji ini gagal karena pemenggalan
 *  baris — kegagalan yang tak berhubungan sama sekali dengan isi kalimatnya.
 *  (Terjadi pada jalan pertama uji ini, 1 Sep 2026.) */
const KODE = SUMBER.slice(SUMBER.indexOf('*/') + 2).replace(/\s+/g, ' ')

describe('BedaSkor — penanda dua skor di menu Sinyal', () => {
  it('menyatakan perbedaannya DISENGAJA, bukan kekeliruan', () => {
    expect(KODE).toMatch(/disengaja/i)
    expect(KODE).toMatch(/bukan kekeliruan|bukan cacat/i)
  })

  it('menjelaskan kedua arah pembacaan, bukan cuma menyebut ada beda', () => {
    expect(KODE).toMatch(/berlawanan arah/i)   // sisi Screener
    expect(KODE).toMatch(/momentum/i)          // sisi Harian
  })

  it('menyebut tab lawannya supaya pembaca tahu harus melihat ke mana', () => {
    expect(KODE).toContain("'Harian'")
    expect(KODE).toContain("'Screener'")
  })

  it('TIDAK membocorkan istilah mesin ke teks yang tayang', () => {
    const terlarang = [
      /skorTeknikal/i, /harianPapan/i, /\.tsx?\b/, /\.json\b/,
      /RSI\s*\d/i, /\bSSS\b/, /data-idx/i, /getstocksummary/i,
      /\b83 label\b/i,                 // angka kalibrasi internal
    ]
    const bocor = terlarang.filter((r) => r.test(KODE)).map(String)
    expect(bocor).toEqual([])
  })

  it('dipasang di KEDUA halaman, bukan salah satu saja', () => {
    const scr = readFileSync(join(AKAR, '..', '..', 'views', 'dasbor', 'Screener.tsx'), 'utf8')
    const hrn = readFileSync(join(AKAR, '..', '..', 'views', 'dasbor', 'HarianPapan.tsx'), 'utf8')
    expect(scr).toContain('<BedaSkor halaman="screener" />')
    expect(hrn).toContain('<BedaSkor halaman="harian" />')
  })
})
