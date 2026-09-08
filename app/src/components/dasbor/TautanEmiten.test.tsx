import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { TautanEmiten } from './TautanEmiten'

const render = (el: React.ReactElement) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>)
const punya = new Set(['BBCA', 'TLKM'])

describe('TautanEmiten (#27)', () => {
  it('emiten tercatat menautkan ke berkasnya', () => {
    const h = render(<TautanEmiten kode="BBCA" punya={punya} className="tick" />)
    expect(h).toContain('href="/berkas-emiten?kode=BBCA"')
    expect(h).toContain('BBCA')
  })

  it('kode yang BUKAN emiten tercatat dicetak sebagai teks, bukan tautan mati', () => {
    // Delisting di edisi lama dan pencatatan IPO yang batal ada di tabel yang
    // memakai komponen ini; tautan yang mendarat di halaman kosong membuat
    // orang berhenti mengklik yang lain.
    const h = render(<TautanEmiten kode="ZZZZ" punya={punya} className="tick" />)
    expect(h).not.toContain('href')
    expect(h).toContain('ZZZZ')
  })

  it('daftar kosong (belum tiba) = semua teks — bukan tautan yang lenyap di bawah jari', () => {
    expect(render(<TautanEmiten kode="BBCA" punya={new Set()} />)).not.toContain('href')
  })

  it('kode huruf kecil tetap menautkan ke kode kapital', () => {
    expect(render(<TautanEmiten kode="tlkm" punya={punya} />)).toContain('href="/berkas-emiten?kode=TLKM"')
  })
})
