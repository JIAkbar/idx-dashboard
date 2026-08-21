/**
 * Audit entri KATALOG (bukan seluruh registry — itu `audit-indikator.mjs`)
 * dipanggil lewat JALUR PRODUKSI PERSIS (`buatInstans` + `hitungInstans`) atas
 * OHLC BBCA nyata. Johan 21 Agu 2026: *"kemarin dapat indikator bnyk sekali
 * dari repo github tapi belum tentu terpakai itu, coba cek"*.
 *
 * Beda dengan `audit-indikator.mjs` (audit REGISTRY: 457 entri, `defaultInputs`
 * MENTAH pustaka, BBCA+ARCI diambil yang TERBAIK): audit ini menguji 367 entri
 * yang SUDAH lolos audit itu (`ID_DIBUANG` tersaring di `muatKatalog`), lewat
 * `keMasukanPustaka` — jalur yang CUMA meneruskan ruas angka & pilihan, TIDAK
 * pernah mengirim ruas `bool`/`color` sama sekali (lihat `katalogIndikator.ts`).
 * Entri yang `calculate()`-nya diam-diam butuh ruas itu tanpa jatuh ke bawaan
 * pustaka sendiri bisa lolos audit registry (dipanggil dengan `defaultInputs`
 * LENGKAP) tapi rusak/kosong di sini — dan di sinilah yang sebenarnya dipakai
 * `GrafikEmiten.tsx`, bukan di sana.
 *
 *   npx vite-node app/scripts/audit-katalog-terpakai.ts
 *
 * Tulis: docs/riset/audit-katalog-terpakai.md
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  keDataLilinVolume, buatInstans, hitungInstans, type BerkasOhlcEmiten,
} from '../src/lib/dasbor/grafikEmiten.ts'
import { muatKatalog, ID_PENANDA, ID_PIVOT, ID_LILIN } from '../src/lib/dasbor/katalogIndikator.ts'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const j: BerkasOhlcEmiten = JSON.parse(readFileSync(join(AKAR, 'data-idx', 'json', 'ohlc', 'BBCA.json'), 'utf8'))
const { lilin, volume } = keDataLilinVolume(j.d, '#0a0', '#a00')
const vol = volume.map((v) => v.value)
const tutup = lilin.map((l) => l.close)

const katalog = await muatKatalog()

type Vonis = 'OK' | 'KOSONG' | 'GALAT'
interface Baris { id: string; vonis: Vonis; catatan: string }
const baris: Baris[] = []

for (const [id, entri] of katalog) {
  // Tiga jenis khusus (penanda/pivot/lilin, B30) tak punya `plots` sama
  // sekali — bentuknya sudah diuji jalur sendiri di `grafikEmiten.test.ts`
  // (`pivotPustaka`/`lilinPustaka`/`hitungPenandaInstans`); memaksanya lewat
  // `hitungInstans` di sini cuma akan selalu "kosong" tanpa arti apa pun.
  if (ID_PENANDA.has(id) || ID_PIVOT.has(id) || ID_LILIN.has(id)) {
    baris.push({ id, vonis: 'OK', catatan: 'jenis khusus (penanda/pivot/lilin) — diuji jalur sendiri di grafikEmiten.test.ts' })
    continue
  }
  try {
    const inst = buatInstans(`p:${id}` as `p:${string}`, entri.param, 'audit', 0)
    const garis = hitungInstans(inst, tutup, vol, lilin, katalog)
    const berisi = garis.some((g) => g.nilai.some((v) => v !== null && Number.isFinite(v)))
    baris.push(berisi
      ? { id, vonis: 'OK', catatan: `${garis.length} deret` }
      : { id, vonis: 'KOSONG', catatan: 'seluruh nilai null/tak berhingga' })
  } catch (e) {
    baris.push({ id, vonis: 'GALAT', catatan: String((e as Error)?.message ?? e).slice(0, 140) })
  }
}

baris.sort((a, b) => a.id.localeCompare(b.id))
const kosong = baris.filter((b) => b.vonis === 'KOSONG')
const galat = baris.filter((b) => b.vonis === 'GALAT')
const rusak = [...galat, ...kosong]

console.log(`katalog ${katalog.size} · OK ${baris.length - rusak.length} · KOSONG ${kosong.length} · GALAT ${galat.length}`)
for (const b of rusak) console.log(`  ${b.vonis.padEnd(6)} ${b.id.padEnd(30)} ${b.catatan}`)

const md = [
  '# Audit katalog terpakai — kalkulasi nyata atas BBCA',
  '',
  'Dihasilkan `npx vite-node app/scripts/audit-katalog-terpakai.ts`. Beda dengan',
  '`docs/riset/audit-indikator.tsv` (audit REGISTRY lewat `defaultInputs` mentah',
  'pustaka, BBCA+ARCI, terbaik dari keduanya): audit ini memanggil entri',
  'KATALOG (sudah tersaring `ID_DIBUANG`) lewat jalur PRODUKSI PERSIS —',
  '`buatInstans` + `hitungInstans`, param bawaan `SpekParam`, cuma BBCA',
  `(${lilin.length.toLocaleString()} lilin, hari tanpa perdagangan sudah tersaring).`,
  '',
  `Ringkasan: ${baris.length} entri diuji · OK ${baris.length - rusak.length} · `
    + `KOSONG ${kosong.length} · GALAT ${galat.length}.`,
  '',
  '| id | vonis | catatan |',
  '|---|---|---|',
  ...baris.map((b) => `| ${b.id} | ${b.vonis} | ${b.catatan.replace(/\|/g, '\\|')} |`),
  '',
].join('\n')
writeFileSync(join(AKAR, 'docs', 'riset', 'audit-katalog-terpakai.md'), md, 'utf8')
console.log(`ditulis: docs/riset/audit-katalog-terpakai.md (${baris.length} baris)`)
