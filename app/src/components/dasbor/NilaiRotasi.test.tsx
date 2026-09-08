import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NilaiRotasi } from './NilaiRotasi'

const fmt = (v: number | null) => (v == null ? '—' : String(v))
const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe('NilaiRotasi (#36 A)', () => {
  it('angka sumber utama tayang TANPA lencana', () => {
    const h = html(
      <NilaiRotasi ruas="pb" lama={2.9} rasio={{ 'Current Price to Book Value': 3.02 }} render={fmt} />,
    )
    expect(h).toContain('3.02')
    // Lencana di tiap baris = lencana yang berhenti dibaca.
    expect(h).not.toContain('<sup')
  })

  it('jatuh ke cadangan = angka lama + lencana asal', () => {
    const h = html(<NilaiRotasi ruas="pb" lama={2.9} rasio={{}} render={fmt} />)
    expect(h).toContain('2.9')
    expect(h).toContain('>c</sup>')
    expect(h).toContain('cadangan')
  })

  it('lencana milik sumber lama ikut HANYA saat angka lama yang tayang', () => {
    const lencana = <sup data-uji="turunan">≈</sup>
    expect(html(
      <NilaiRotasi ruas="ps" lama={6.8} rasio={{ 'Current Price to Sales (TTM)': 6.9 }}
        render={fmt} lencanaLama={lencana} />,
    )).not.toContain('data-uji')
    expect(html(
      <NilaiRotasi ruas="ps" lama={6.8} rasio={null} render={fmt} lencanaLama={lencana} />,
    )).toContain('data-uji')
  })

  it('dua sumber kosong = tak ada yang ditandai', () => {
    const h = html(<NilaiRotasi ruas="altman_z" lama={null} rasio={{}} render={fmt} />)
    expect(h).toContain('—')
    expect(h).not.toContain('<sup')
  })
})
