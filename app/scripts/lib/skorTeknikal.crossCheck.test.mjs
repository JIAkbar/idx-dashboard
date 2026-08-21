/**
 * Uji silang: `lib/skor.mjs` (JS polos, dipakai skrip Node) vs
 * `skorTeknikal.ts` (sumber kebenaran, dipakai UI React) — pada data OHLC
 * NYATA dari cakram, bukan deret buatan.
 *
 * Kenapa ini WAJIB ada dan bukan sekadar "boleh": skrip pembangun berjalan di
 * Node tanpa transpiler, jadi rumus skornya HARUS berupa salinan JS polos.
 * Salinan yang menyimpang diam-diam dari sumber TS adalah bug termahal di
 * proyek ini (lihat komentar di `skorTeknikal.ts`). Uji ini GAGAL kalau
 * `lib/skor.mjs` diubah tanpa mengikuti `skorTeknikal.ts`, atau sebaliknya.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as js from './skor.mjs'
import * as ts from '../../src/lib/dasbor/skorTeknikal.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR_OHLC = join(AKAR, 'data-idx', 'json', 'ohlc')

// Sampel deterministik: tiap emiten ke-23 (bukan acak — hasil uji harus sama
// tiap dijalankan), merentang dari deret sepanjang 1 lilin sampai >2400 lilin.
// Mencakup kasus null (deret terlalu pendek) DAN kasus terhitung penuh.
const semuaFile = readdirSync(DIR_OHLC)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json')
  .sort()
const sampel = semuaFile.filter((_, i) => i % 23 === 0)

function bacaBaris(file) {
  const d = JSON.parse(readFileSync(join(DIR_OHLC, file), 'utf8'))
  return Array.isArray(d.d) ? d.d : []
}

describe('skor.mjs vs skorTeknikal.ts — data OHLC nyata', () => {
  it(`sampel mencakup >=30 emiten (dapat ${sampel.length})`, () => {
    // Penjaga supaya sampelnya tak diam-diam kosong kalau struktur folder berubah.
    expect(sampel.length).toBeGreaterThanOrEqual(30)
  })

  for (const file of sampel) {
    const kode = file.replace(/\.json$/, '')
    it(`${kode}: skorTigaKerangka & momentumPersen identik`, () => {
      const baris = bacaBaris(file)

      const hasilJs = js.skorTigaKerangka(baris)
      const hasilTs = ts.skorTigaKerangka(baris)
      expect(hasilJs).toEqual(hasilTs)

      const momJs = js.momentumPersen(baris)
      const momTs = ts.momentumPersen(baris)
      expect(momJs).toEqual(momTs)
    })
  }
})
