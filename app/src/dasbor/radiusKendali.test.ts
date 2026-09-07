import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Penjaga aturan BENTUK ronde 2 (#39): radius kendali interaktif & badge data
 * seragam 4px.
 *
 * ## Kenapa penjaganya berbentuk DAFTAR, bukan pemindai nilai
 *
 * Percobaan pertama uji ini memindai tiap deklarasi `border-radius` di seluruh
 * CSS dan menolak yang bukan 4px. Ia langsung merah pada kelas yang justru
 * SUDAH benar: `.chip-t` memang dideklarasikan 99px di tempatnya lahir, lalu
 * ditimpa 4px oleh blok override yang letaknya lebih bawah; `.dd-btn` dan
 * `.btn-p` memakai `var(--r)`; `.bchip` memakai `var(--r-kecil)`. Yang
 * menentukan di layar adalah nilai EFEKTIF sesudah kaskade, dan kaskade tak
 * bisa dihitung dari satu regex — memaksanya menghasilkan uji yang merah pada
 * kode yang benar, dan uji semacam itu tak akan bertahan seminggu.
 *
 * Yang benar-benar menjadi celah, dan itu yang ditulis di baris antreannya:
 * blok override memakai DAFTAR selector, jadi kelas kendali yang lahir
 * sesudahnya tidak ikut dan lolos tanpa peringatan. Uji ini menjaga tepat
 * celah itu — tiap kelas kendali/badge yang kita akui wajib TERDAFTAR di blok
 * override. Kalau ada yang menambah kelas kendali baru dan lupa mendaftarkan,
 * ia menambahkannya ke daftar di bawah ini dan uji langsung menunjukkan di
 * mana pendaftarannya kurang.
 *
 * ## Yang SENGAJA di luar jangkauan
 *
 * - **Lingkaran status** (dot, medal peringkat, legend-dot, thumb batang
 *   gulir): aturannya sendiri mengecualikan — bukan tombol, memang bundar.
 * - **Panel, popover, modal, tooltip**: aturannya menyebut mereka tetap `--r`.
 * - **`.tab-halaman-it`**: tab ANTAR-HALAMAN sengaja tanpa kotak dan tanpa
 *   radius sama sekali — keputusan Johan 7 Sep 2026 (#2 opsi B), penanda
 *   aktifnya garis bawah emas. Mendaftarkannya justru mengembalikan kotak
 *   yang baru dibuang, jadi ia tidak ada di daftar dan itu disengaja.
 */

const LANTAI = join(dirname(fileURLToPath(import.meta.url)), 'lantai.css')

/** CSS tanpa komentarnya. Wajib: pemindai blok di bawah menyapu apa saja
 *  yang berdiri sebelum `{`, dan komentar yang MENYEBUT sebuah kelas akan
 *  terbaca sebagai selector kelas itu - termasuk komentar yang isinya
 *  justru mengumumkan kelasnya sudah dibuang. */
function tanpaKomentar(isi: string): string {
  return isi.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Kelas kendali & badge data yang wajib ikut aturan 4px.
 *
 * Enam yang pertama ditambahkan 7 Sep 2026 sesudah diukur satu per satu:
 * `.brd-chip` 999px, `.be-pil` 999px, `.bm-pil` 999px, `.gk-chip` 8px,
 * `.bs2-chipstat` 5px, `.rdr-chip` 3px — semuanya lolos bertahun-tahun karena
 * tak pernah masuk daftar.
 */
const KENDALI = [
  'chip-t', 'dd-btn', 'btn-p', 'bchip', 'tab', 'inp', 'dd-it',
  'brd-chip', 'be-pil', 'bm-pil', 'gk-chip', 'bs2-chipstat', 'rdr-chip',
]

/** Isi blok deklarasi yang tepat berbunyi `border-radius: 4px`. */
function blokEmpatPx(): string {
  const isi = tanpaKomentar(readFileSync(LANTAI, 'utf8'))
  const potong: string[] = []
  for (const m of isi.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/border-radius: *4px *;?\s*$/.test(m[2].trim())) potong.push(m[1])
  }
  return potong.join('\n')
}

describe('radius kendali & badge data seragam 4px (#39)', () => {
  const daftar = blokEmpatPx()

  it('blok override radius 4px benar-benar ada', () => {
    expect(daftar.length).toBeGreaterThan(0)
  })

  for (const kelas of KENDALI) {
    it(`.${kelas} terdaftar di blok override 4px`, () => {
      // `(?![\w-])` supaya `.be-pil` tidak dianggap cocok oleh `.be-pilar`.
      expect(new RegExp(`\\.${kelas}(?![\\w-])`).test(daftar), `.${kelas}`).toBe(true)
    })
  }

  it('CSS yatim `.pi-view-tab` sudah dicabut', () => {
    // Dibuang 7 Sep 2026: nol pemakai di seluruh .tsx. CSS tanpa pemakai bukan
    // sekadar bobot mati — ia ikut terbaca sebagai "kendali yang ada" saat
    // orang menyapu aturan bentuk.
    const isi = tanpaKomentar(readFileSync(LANTAI, 'utf8'))
    const aturan = [...isi.matchAll(/([^{}]+)\{[^{}]*\}/g)]
      .map((m) => m[1])
      .filter((s) => /\.pi-view-tabs?(?![\w-])/.test(s))
    expect(aturan).toEqual([])
  })
})
