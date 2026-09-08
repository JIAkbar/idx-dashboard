import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LABEL_RENTANG, URUTAN_PIL, pilRentang } from './periode'

/**
 * Penjaga kosakata rentang (#70).
 *
 * Aturan proyek: kata rentang waktu cuma dieja di `periode.ts`. Sebelum ini
 * penegakannya cuma kalimat di CLAUDE.md, dan terukur 7 Sep 2026 ia bocor di
 * dua arah sekaligus — satu berkas mengeja empat label sendiri, dan satu
 * preset punya DUA kata di layar ("YTD" di sembilan tempat, "YTD" di
 * tiga) tanpa satu pun yang gagal.
 *
 * ## Pembagian kata yang dijaga di sini
 *
 * - **Pil rentang** yang menghitung sendiri: selalu `sejakJan` = "YTD".
 * - **Kolom YTD resmi bursa**: `ytd` = "YTD".
 *
 * Pembagian itu keputusan Johan 5 Sep 2026, dan alasannya bukan selera:
 * Sektor & Indeks dan Top Stocks memajang kolom "YTD" berisi angka RESMI
 * bursa, sementara pil di bilah atasnya menghitung sendiri dari harga di
 * tanggal mulai. Dua angka berbeda dengan satu nama di satu layar.
 */

const DIR = dirname(fileURLToPath(import.meta.url))
const SRC = join(DIR, '..', '..')

function berkasKode(dir: string, keluar: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama)
    if (statSync(p).isDirectory()) berkasKode(p, keluar)
    else if (/\.tsx?$/.test(nama) && !/\.test\.tsx?$/.test(nama)) keluar.push(p)
  }
  return keluar
}

describe('pilRentang menyusun urutan, bukan halamannya (#70)', () => {
  it('mengembalikan urutan kanonis apa pun urutan masukannya', () => {
    const acak = pilRentang([
      { id: 'c', kunci: 'b3' },
      { id: 'a', kunci: 'h5' },
      { id: 'd', kunci: 'sejakJan' },
      { id: 'b', kunci: 'w1' },
    ])
    expect(acak.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(acak.map((o) => o.label)).toEqual(['5 Hari', '1 Minggu', '3 Bulan', 'YTD'])
  })

  it('id boleh berbeda dari kunci kata — state tersimpan tak ikut pindah', () => {
    const o = pilRentang([{ id: 'ytd', kunci: 'sejakJan' }])
    expect(o[0]).toMatchObject({ id: 'ytd', label: 'YTD' })
  })

  it('judul opsional diteruskan apa adanya', () => {
    const o = pilRentang([{ id: 'hari', kunci: 'hariIni', judul: 'Rekap satu hari bursa' }])
    expect(o[0].judul).toBe('Rekap satu hari bursa')
  })

  it('URUTAN_PIL tidak memuat `ytd` — sebagai pil, katanya selalu sejakJan', () => {
    expect(URUTAN_PIL).not.toContain('ytd')
    expect(URUTAN_PIL).toContain('sejakJan')
  })

  it('tiap kunci di URUTAN_PIL punya kata di kamus', () => {
    for (const k of URUTAN_PIL) expect(LABEL_RENTANG[k], k).toBeTruthy()
  })
})

describe('kata rentang cuma dieja di periode.ts (#70)', () => {
  const kode = berkasKode(SRC).filter((p) => !p.endsWith(join('lib', 'dasbor', 'periode.ts')))

  it('tak ada halaman yang mengeja label rentang sendiri', () => {
    // Bentuk yang dicari: string literal berisi kata rentang di posisi label.
    const pola = /label: *'(\d+ (Hari|Minggu|Bulan|Tahun|Pekan)|YTD|Hari Ini|YTD|WTD|MTD)'/
    const langgar: string[] = []
    for (const p of kode) {
      const isi = readFileSync(p, 'utf8')
      isi.split('\n').forEach((baris, i) => {
        if (pola.test(baris)) langgar.push(`${p.slice(SRC.length + 1)}:${i + 1}`)
      })
    }
    expect(langgar).toEqual([])
  })

  it('kunci `ytd` hanya dipakai untuk kolom resmi bursa, bukan untuk pil', () => {
    // Pil dikenali dari bentuknya: `{ id: ..., label: LABEL_RENTANG.ytd }`
    // atau `kunci: 'ytd'`. Kolom memakainya sebagai teks kepala tabel.
    const langgar: string[] = []
    for (const p of kode) {
      const isi = readFileSync(p, 'utf8')
      isi.split('\n').forEach((baris, i) => {
        if (/label: *LABEL_RENTANG\.ytd|kunci: *'ytd'/.test(baris)) {
          langgar.push(`${p.slice(SRC.length + 1)}:${i + 1}`)
        }
      })
    }
    expect(langgar).toEqual([])
  })
})
