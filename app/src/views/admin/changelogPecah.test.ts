import { describe, expect, it } from 'vitest'
import { gabungBungkus, pecah } from './ChangelogAdmin'

/**
 * Yang diuji: baris yang cuma hasil bungkus keras di `docs/CHANGELOG.md`
 * kembali menyatu dengan butirnya. Sebelum perbaikan 20 Agu 2026, sambungan
 * butir dirender sebagai paragraf sendiri yang mulai dari tepi kiri — butir
 * pendek disusul kalimat gantung tanpa induk.
 */
describe('gabungBungkus', () => {
  it('menyambung lanjutan butir yang terbungkus', () => {
    expect(gabungBungkus(['- Halaman Forum: ruang umum dan ruang per emiten', 'tautan ke ruang emiten itu.']))
      .toEqual(['- Halaman Forum: ruang umum dan ruang per emiten tautan ke ruang emiten itu.'])
  })

  it('butir berikutnya tetap butir sendiri', () => {
    expect(gabungBungkus(['- satu', '- dua'])).toEqual(['- satu', '- dua'])
  })

  it('kepala kategori tak pernah ditelan butir sebelumnya, dan tak menelan butir sesudahnya', () => {
    expect(gabungBungkus(['- satu', '### DIUBAH', '- dua'])).toEqual(['- satu', '### DIUBAH', '- dua'])
  })

  it('baris kosong memutus sambungan', () => {
    expect(gabungBungkus(['- satu', '', 'paragraf lepas'])).toEqual(['- satu', '', 'paragraf lepas'])
  })
})

describe('pecah', () => {
  const sumber = [
    '# Changelog — PAPAN',
    'Format mengikuti Keep a Changelog 1.1.0 dan',
    'penomoran mengikuti Semantic Versioning 2.0.0.',
    '',
    '## [6.1.0] — 2026-08-15',
    '### DITAMBAH',
    '- Halaman Forum: ruang umum dan ruang per emiten; tag $KODE di dalam pesan jadi',
    'tautan ke ruang emiten itu.',
    '- Tombol intip kata sandi',
  ].join('\n')

  it('preambul ikut disambung, judul berkas tetap terpisah', () => {
    const { preambul } = pecah(sumber)
    expect(preambul).toContain('# Changelog — PAPAN')
    expect(preambul.some((b) => b.includes('Keep a Changelog 1.1.0 dan penomoran mengikuti'))).toBe(true)
  })

  it('satu versi, dua butir — bukan dua butir plus paragraf gantung', () => {
    const { blok } = pecah(sumber)
    expect(blok).toHaveLength(1)
    expect(blok[0].versi).toBe('6.1.0')
    const butir = blok[0].isi.filter((b) => b.startsWith('- '))
    expect(butir).toHaveLength(2)
    expect(butir[0]).toContain('tautan ke ruang emiten itu.')
    // Tak ada baris berisi yang bukan butir/kepala — itu bentuk kalimat gantung.
    expect(blok[0].isi.filter((b) => b.trim() && !b.startsWith('- ') && !b.startsWith('#'))).toEqual([])
  })
})
