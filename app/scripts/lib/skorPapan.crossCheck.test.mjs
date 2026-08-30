/**
 * Uji silang: `lib/skorPapan.mjs` (JS polos, dipakai pembangun Node) vs
 * `harianPapan.ts` (sumber kebenaran, dipakai UI React) — pada data OHLC
 * NYATA dari cakram.
 *
 * Kembaran `skorTeknikal.crossCheck.test.mjs`, yang menjaga pasangan Screener.
 * Pasangan Harian Papan tak punya penjaga apa pun sampai 30 Agu 2026, dan
 * sebabnya struktural: rumusnya hidup di dalam `bangun-harian-papan.mjs`,
 * yang menjalankan pembangunan penuh saat diimpor — jadi tak ada uji yang
 * bisa memanggilnya. Memindahkan rumus ke modul tanpa efek samping itulah
 * yang membuat uji ini bisa ditulis.
 *
 * Yang dijaga: kedua salinan sepakat. Yang TIDAK dijaga di sini dan memang
 * bukan urusannya: apakah Skor Papan sepakat dengan SSS Screener — keduanya
 * sengaja berbeda (`skorAntarHalaman.test.ts`).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as js from './skorPapan.mjs'
import * as ts from '../../src/lib/dasbor/harianPapan.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const DIR_OHLC = join(AKAR, 'data-idx', 'json', 'ohlc')

// Sampel deterministik, pola sama crossCheck Screener: tiap emiten ke-23.
const semuaFile = readdirSync(DIR_OHLC)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'IHSG.json')
  .sort()
const sampel = semuaFile.filter((_, i) => i % 23 === 0)

function bacaBaris(file) {
  const d = JSON.parse(readFileSync(join(DIR_OHLC, file), 'utf8'))
  return Array.isArray(d.d) ? d.d : []
}

describe('skorPapan.mjs vs harianPapan.ts — data OHLC nyata', () => {
  it(`sampel mencakup >=30 emiten (dapat ${sampel.length})`, () => {
    expect(sampel.length).toBeGreaterThanOrEqual(30)
  })

  it('daftar periode identik', () => {
    expect([...js.PERIODE_SKOR_PAPAN]).toEqual([...ts.PERIODE_SKOR_PAPAN])
  })

  for (const file of sampel) {
    const kode = file.replace(/\.json$/, '')
    it(`${kode}: skorPapanTigaKerangka identik`, () => {
      const baris = bacaBaris(file)
      const hasilJs = js.skorPapanTigaKerangka(baris)
      const hasilTs = ts.skorPapanTigaKerangka(baris)

      // Versi TS membawa `komponen` untuk keperluan layar; versi JS tidak
      // (pembangun cuma menulis labelnya). Yang wajib sama angkanya.
      for (const k of ['harian', 'pekanan', 'bulanan']) {
        const a = hasilJs[k]
        const b = hasilTs[k]
        if (a === null || b === null) {
          expect(a, `${kode} ${k}: satu sisi null, satunya tidak`).toEqual(b)
          continue
        }
        expect({ skor: a.skor, label: a.label, ma: a.ma, osilator: a.osilator }, `${kode} ${k}`)
          .toEqual({ skor: b.skor, label: b.label, ma: b.ma, osilator: b.osilator })
      }
    })
  }
})
