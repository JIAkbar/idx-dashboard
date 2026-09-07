/**
 * Enumerasi isi menu ƒx Indikator — SEBELUM menyunting apa pun (#45a).
 *
 * Johan 7 Sep 2026: *"HAPUS INDIKATOR YANG TIDAK BERGUNA ITU RATUSAN INDIKATOR
 * SIAPA JUGA YANG PAKAI"*. Kata "hapus … ratusan" itu sapuan, dan sapuan wajib
 * dienumerasi dulu: berapa yang ADA, berapa yang akan tampil, berapa yang
 * diarsipkan — tiga angka, bukan satu klaim.
 *
 *   node scripts/enumerasi-menu-indikator.mjs
 *   node scripts/enumerasi-menu-indikator.mjs --tsv > ../docs/riset/menu-indikator.tsv
 *
 * Registry dibaca langsung, sama seperti `audit-indikator.mjs` — bukan daftar
 * tangan yang basi begitu pustakanya naik versi.
 */
import { indicatorRegistry } from 'lightweight-charts-indicators'

const tsv = process.argv.includes('--tsv')
const entri = Object.values(indicatorRegistry)

const rows = entri.map((e) => ({
  id: e.id,
  nama: e.name,
  singkat: e.shortName,
  kategori: e.category,
  grup: e.group,
  overlay: e.overlay ? 1 : 0,
  plot: e.plotConfig?.length ?? 0,
}))

if (tsv) {
  console.log(['id', 'nama', 'singkat', 'kategori', 'grup', 'overlay', 'plot'].join('\t'))
  for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log([r.id, r.nama, r.singkat, r.kategori, r.grup, r.overlay, r.plot].join('\t'))
  }
} else {
  const perKategori = new Map()
  for (const r of rows) perKategori.set(r.kategori, (perKategori.get(r.kategori) ?? 0) + 1)
  console.log(`registry: ${rows.length} entri`)
  console.log(`ber-plotConfig: ${rows.filter((r) => r.plot > 0).length}`)
  console.log('per kategori:')
  for (const [k, n] of [...perKategori].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
}
