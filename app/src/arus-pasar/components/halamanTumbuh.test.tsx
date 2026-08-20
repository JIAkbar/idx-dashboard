import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import edisiUji from '../../../../arus-pasar/edisi/2026-08-14.json'
import type { Edisi, Skor } from '../../lib/skor/types'
import type { SkorMap } from '../skorMap'
import { HalamanRingkasan } from './HalamanRingkasan'
import { HalamanPeringkat } from './HalamanPeringkat'

/**
 * Penjaga satu hal saja, dan hal itu pernah gagal senyap: **tak satu pun emiten
 * boleh hilang dari dua halaman yang memuat seluruh emiten edisi.**
 *
 * Dulu `.page` memakai tinggi A4 mati + `overflow:hidden` sementara kedua tabel
 * ini merender SEMUA emiten dalam satu halaman. Kelebihannya dipotong tanpa
 * jejak — bukan lanjut ke lembar baru, bukan galat, cuma daftar yang menyusut.
 * Fixture Fase 2 cuma 3 emiten sehingga tak pernah terlihat; edisi 14 Agustus
 * 2026 yang dipakai di sini berisi **22**.
 *
 * Dipakai `renderToStaticMarkup`, bukan jsdom + testing-library: yang perlu
 * dibuktikan cuma "semua baris ikut ter-render", dan React sudah ada di
 * dependensi. Menambah dua pustaka uji untuk satu penegasan string tak sepadan.
 *
 * Edisinya di-IMPOR, bukan dibaca lewat `node:fs`. Versi pertama memakai
 * `readFileSync` + `__dirname` dan itu MEMATIKAN BUILD PRODUKSI: `npx tsc
 * --noEmit` lolos, tapi `tsc -b` yang dipakai `npm run build` menolak nama
 * `node:fs`/`__dirname` karena tipe Node memang tak terpasang di app ini.
 * Akibatnya Vercel gagal membangun dan data yang sudah ter-push tak pernah
 * sampai ke layar — nol galat di sisi saya, halaman diam di tanggal kemarin.
 */

const ed = edisiUji as unknown as Edisi

/** Skor tetap per ticker — halaman ini diuji soal KELENGKAPAN baris, bukan soal
 *  benar-salahnya rumus skor (itu punya `skor.test.ts` sendiri). Nilainya dibuat
 *  menurun mengikuti urutan supaya pengurutannya tetap deterministik. */
const skorMap: SkorMap = Object.fromEntries(
  ed.emiten.map((e, i): [string, Skor] => [
    e.ticker,
    {
      teknikal: 30 - i * 0.1,
      flow: 25,
      rr: 15,
      lik: 8,
      ihsg: 4,
      korr: 0.5,
      total: 82 - i,
      risiko: 'MENENGAH',
    },
  ]),
)

describe('halaman yang isinya bertambah seiring jumlah emiten', () => {
  it('edisi ujinya memang banyak emiten — kalau tidak, uji ini tak membuktikan apa pun', () => {
    expect(ed.emiten.length).toBeGreaterThanOrEqual(10)
  })

  for (const [nama, Komponen] of [
    ['Ringkasan Edisi', HalamanRingkasan],
    ['Peringkat Peluang', HalamanPeringkat],
  ] as const) {
    describe(nama, () => {
      const html = renderToStaticMarkup(<Komponen ed={ed} skorMap={skorMap} />)

      it('memuat SELURUH ticker edisi', () => {
        const hilang = ed.emiten.filter((e) => !html.includes(e.ticker)).map((e) => e.ticker)
        expect(hilang).toEqual([])
      })

      it('halamannya ditandai `tumbuh` supaya tak dipotong tinggi A4 mati', () => {
        expect(html).toContain('page tumbuh')
      })

      it('baris judul tabel ada di <thead> supaya terulang saat tabelnya pecah', () => {
        expect(html).toContain('<thead>')
      })
    })
  }

  it('jumlah emiten di narasi mengikuti isi, tidak dieja mati', () => {
    const html = renderToStaticMarkup(<HalamanRingkasan ed={ed} skorMap={skorMap} />)
    expect(html).toContain(`${ed.emiten.length} emiten dibedah`)
    expect(html).not.toContain('Tiga emiten dibedah')
  })
})
