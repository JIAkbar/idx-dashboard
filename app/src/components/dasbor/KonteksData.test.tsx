import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { KonteksData } from './KonteksData'

const render = (el: React.ReactElement) =>
  renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('KonteksData — dua sumber yang berbeda tanggal (#80 C)', () => {
  it('satu sumber: kalimatnya tetap seperti semula', () => {
    expect(render(<KonteksData tanggal="2026-09-07" />)).toContain('Data per 7 September 2026')
  })

  it('dua sumber SEPAKAT: tetap satu tanggal, tak menambah kata', () => {
    // Menyebut dua sumber yang sepakat cuma memanjangkan baris tanpa memberi
    // tahu apa pun yang baru.
    const teks = render(
      <KonteksData
        tanggal="2026-09-07"
        kedua={{ labelUtama: 'statistik IDX', label: 'harga', tanggal: '2026-09-07' }}
      />,
    )
    expect(teks).toContain('Data per 7 September 2026')
    expect(teks).not.toContain('harga')
  })

  it('dua sumber BERBEDA: keduanya disebut beserta namanya', () => {
    // Bentuk kegagalan yang ditutup: halaman menulis "Data per 4 September"
    // padahal harganya sudah 7 September, dan pembaca menyangka SELURUH
    // halaman setua itu (temuan Johan 7 Sep 2026).
    const teks = render(
      <KonteksData
        tanggal="2026-09-04"
        kedua={{ labelUtama: 'statistik IDX', label: 'harga', tanggal: '2026-09-07' }}
      />,
    )
    expect(teks).toContain('Data per statistik IDX 4 September 2026')
    expect(teks).toContain('harga 7 September 2026')
  })

  it('sumber kedua yang tanggalnya belum termuat tidak mengubah apa pun', () => {
    const teks = render(
      <KonteksData
        tanggal="2026-09-04"
        kedua={{ labelUtama: 'statistik IDX', label: 'harga', tanggal: null }}
      />,
    )
    expect(teks).toContain('Data per 4 September 2026')
    expect(teks).not.toContain('harga')
  })
})
