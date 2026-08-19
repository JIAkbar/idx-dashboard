/**
 * Audit MEKANIS seluruh `indicatorRegistry` pustaka `lightweight-charts-indicators`
 * atas OHLC NYATA milik PAPAN — bukan penilaian selera, bukan daftar tangan.
 *
 * Johan 19 Agu 2026: *"bnyk indikator yang kmu pasang tidak berfungsi mestinya
 * pasang yang berguna saja"*.
 *
 * Kenapa ada berkas ini dan bukan sekadar laporan sekali pakai: katalog dibaca
 * dari REGISTRY pustaka (lihat `src/lib/dasbor/katalogIndikator.ts`), jadi
 * begitu pustakanya naik versi daftar isinya berubah tanpa satu baris kode
 * kita berubah. Daftar buangan yang ditulis tangan pasti basi diam-diam:
 * indikator yang sudah dibetulkan pustaka tetap tersembunyi, indikator baru
 * yang rusak tetap tampil. Audit yang bisa dijalankan ulang menutup keduanya.
 *
 *   node scripts/audit-indikator.mjs           # laporan ke layar
 *   node scripts/audit-indikator.mjs --tulis   # + tulis ulang berkas hasil
 *
 * Dua emiten sengaja, bukan satu: BBCA (2.469 lilin, likuid, harga ribuan) dan
 * ARCI (1.238 lilin, tipis, harga puluhan). Indikator yang cuma jalan di satu
 * di antaranya bukan indikator yang jalan.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { indicatorRegistry } from 'lightweight-charts-indicators'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EMITEN = ['BBCA', 'ARCI']

/** `data-idx/json/ohlc/{KODE}.json` -> bar yang bentuknya SAMA persis dengan
 *  yang `plotPustaka()` kirim di produksi (`grafikEmiten.ts:378`). Kalau dua
 *  bentuk ini menyimpang, auditnya menguji sesuatu yang tak pernah dijalankan. */
function muatBar(kode) {
  const j = JSON.parse(readFileSync(join(AKAR, 'data-idx', 'json', 'ohlc', `${kode}.json`), 'utf8'))
  return j.d.map(([tgl, o, h, l, c, v]) => ({
    time: Math.floor(Date.parse(`${tgl}T00:00:00Z`) / 1000),
    open: o, high: h, low: l, close: c, volume: v ?? 0,
  }))
}

/**
 * Satu entri atas satu deret bar -> vonis.
 *
 * Urutan pemeriksaannya penting, tiap langkah menangkap kegagalan yang
 * langkah sesudahnya BUTA terhadapnya:
 *
 *  1. `plotConfig` kosong — keluarannya penanda/label, bukan deret angka.
 *     Kanvas ini menggambar deret; entri semacam ini butuh masukan lain.
 *  2. Melempar galat.
 *  3. Kunci plot yang dikembalikan tak cocok dengan yang diumumkan.
 *     `garisPustaka()` mengambil deret lewat `kunciPlot` (dari `plotConfig`),
 *     bukan lewat apa pun yang kebetulan ada di objeknya — entri semacam ini
 *     LOLOS seluruh pemeriksaan nilai dan tetap menggambar nol garis.
 *  4. Waktu titik yang tak ada di bar mana pun. `plotPustaka()` memetakan
 *     titik ke lilin lewat `time`; yang tak cocok jatuh diam-diam jadi `null`.
 *  5. Nol nilai berhingga (NaN/Infinity semua).
 *  6. Konstan sepanjang deret — garis lurus sempurna.
 *  7. `overlay` tapi nilainya jatuh SELURUHNYA di luar pita harga emiten.
 *     Ini digambar, tak melempar apa pun, dan tetap tak terlihat: ia ada di
 *     panel harga pada koordinat yang tak pernah masuk layar.
 */
function vonisSatu(entri, bars, indeksWaktu, pita) {
  if (!entri.plotConfig?.length) {
    return { vonis: 'BUTUH_MASUKAN_LAIN', catatan: 'tanpa plotConfig — keluarannya penanda/label, bukan deret angka' }
  }
  let hasil
  try {
    hasil = entri.calculate(bars, entri.defaultInputs ?? {})
  } catch (e) {
    return { vonis: 'RUSAK', catatan: `galat: ${String(e?.message ?? e).slice(0, 110)}` }
  }
  const plots = hasil?.plots
  if (!plots || typeof plots !== 'object') return { vonis: 'RUSAK', catatan: 'plots bukan objek' }

  const diumumkan = entri.plotConfig.map((p) => p.id)
  const cocok = diumumkan.filter((k) => Array.isArray(plots[k]))
  if (!cocok.length) {
    return {
      vonis: 'RUSAK',
      catatan: `kunci plot tak cocok: umum [${diumumkan.join(',')}] vs balik [${Object.keys(plots).join(',') || '-'}]`,
    }
  }

  let berhingga = 0, takBerhingga = 0, waktuNyasar = 0, diPita = 0
  const unik = new Set()
  for (const k of cocok) {
    for (const t of plots[k]) {
      const v = t?.value
      if (typeof v !== 'number') continue
      if (!Number.isFinite(v)) { takBerhingga++; continue }
      if (!indeksWaktu.has(Number(t.time))) { waktuNyasar++; continue }
      berhingga++
      if (v >= pita.lo && v <= pita.hi) diPita++
      // Dibulatkan supaya "berubah" berarti berubah secara TERLIHAT. Tanpa
      // ini, garis yang bergerak di digit ke-15 terhitung hidup padahal di
      // layar ia lurus sempurna. Berhenti di 8 — yang dicari cuma "lebih
      // dari satu", bukan cacahnya.
      if (unik.size < 8) unik.add(v.toPrecision(10))
    }
  }
  if (berhingga === 0) {
    if (waktuNyasar) return { vonis: 'RUSAK', catatan: `${waktuNyasar} titik berwaktu di luar deret lilin, nol yang cocok` }
    return { vonis: 'RUSAK', catatan: takBerhingga ? `${takBerhingga} nilai NaN/Infinity, nol berhingga` : 'nol nilai berhingga' }
  }
  if (unik.size <= 1) return { vonis: 'MATI', catatan: `konstan ${[...unik][0]} sepanjang ${berhingga} titik` }
  if (entri.overlay === true && diPita === 0) {
    return { vonis: 'MATI', catatan: `overlay, ${berhingga} nilainya seluruhnya di luar pita harga ${pita.lo}-${pita.hi} — digambar di luar layar` }
  }
  const catat = [`${berhingga} titik`]
  if (takBerhingga) catat.push(`${takBerhingga} NaN`)
  if (waktuNyasar) catat.push(`${waktuNyasar} waktu nyasar`)
  return { vonis: 'BEKERJA', catatan: catat.join(', ') }
}

// Vonis akhir sebuah entri = yang TERBAIK di antara kedua emiten. Indikator
// volume yang datar di emiten tipis (hari-hari nol volume) bukan indikator
// rusak — itu datanya. Yang dibuang adalah yang gagal di KEDUANYA.
const PERINGKAT = { RUSAK: 0, BUTUH_MASUKAN_LAIN: 1, MATI: 2, BEKERJA: 3 }

const data = Object.fromEntries(EMITEN.map((kode) => {
  const bars = muatBar(kode)
  return [kode, {
    bars,
    indeksWaktu: new Set(bars.map((b) => b.time)),
    pita: { lo: Math.min(...bars.map((b) => b.low)), hi: Math.max(...bars.map((b) => b.high)) },
  }]
}))

const baris = indicatorRegistry.map((e) => {
  const per = EMITEN.map((kode) => {
    const d = data[kode]
    return { kode, ...vonisSatu(e, d.bars, d.indeksWaktu, d.pita) }
  })
  const menang = per.reduce((a, b) => (PERINGKAT[b.vonis] > PERINGKAT[a.vonis] ? b : a))
  return {
    id: e.id, nama: e.name, kategori: e.category, overlay: e.overlay === true,
    vonis: menang.vonis, catatan: `${menang.kode}: ${menang.catatan}`,
    per: per.map((p) => `${p.kode}=${p.vonis}`).join(' '),
  }
})

const per = (v) => baris.filter((b) => b.vonis === v)
const rusak = per('RUSAK'), mati = per('MATI'), butuh = per('BUTUH_MASUKAN_LAIN'), bekerja = per('BEKERJA')

console.log(`registry ${baris.length} · bekerja ${bekerja.length} · rusak ${rusak.length} · mati ${mati.length} · butuh masukan lain ${butuh.length}`)
for (const b of [...rusak, ...mati]) console.log(`  ${b.vonis.padEnd(5)} ${b.id.padEnd(26)} ${b.kategori.padEnd(20)} ${b.catatan}`)

if (process.argv.includes('--tulis')) {
  const tsv = ['id\tnama\tkategori\toverlay\tvonis\tper_emiten\tcatatan',
    ...baris.map((b) => [b.id, b.nama, b.kategori, b.overlay, b.vonis, b.per, b.catatan].join('\t'))].join('\n')
  writeFileSync(join(AKAR, 'docs', 'riset', 'audit-indikator.tsv'), `${tsv}\n`, 'utf8')

  const versi = JSON.parse(readFileSync(join(AKAR, 'app', 'node_modules', 'lightweight-charts-indicators', 'package.json'), 'utf8')).version
  const daftar = (arr) => arr.map((b) => `  '${b.id}', // ${b.catatan}`).join('\n')
  const isi = [
    '/* DIHASILKAN `node scripts/audit-indikator.mjs --tulis` — jangan disunting tangan.',
    `   Vonis mekanis atas OHLC nyata (${EMITEN.join(' + ')}), pustaka`,
    `   lightweight-charts-indicators ${versi}.`,
    `   Laporan penuh ${baris.length} baris: docs/riset/audit-indikator.tsv.`,
    '',
    `   Kenapa daftar HASIL dan bukan penyaringan saat jalan: menghitung ${baris.length} rumus`,
    '   atas ribuan lilin di peramban demi menyaring menu berarti membayar seluruh',
    '   biaya indikator yang justru sedang dibuang.',
    '',
    '   Kenapa daftar BUANGAN dan bukan daftar IZIN: entri baru di versi pustaka',
    '   berikutnya harus tetap muncul di menu. Daftar izin membuatnya lenyap',
    '   diam-diam sampai ada yang ingat menjalankan audit ini lagi. */',
    '',
    '/** Melempar galat, mengembalikan kunci plot yang tak diumumkannya, memberi',
    ' *  waktu di luar deret lilin, atau nol nilai berhingga. Ditambahkan ke menu,',
    ' *  ia muncul di legenda dan tak pernah menggambar apa pun. */',
    'export const ID_RUSAK: ReadonlySet<string> = new Set([',
    daftar(rusak),
    '])',
    '',
    '/** Menggambar, tapi tak ada yang bisa dilihat: nilainya konstan sepanjang',
    ' *  deret (garis lurus sempurna), atau ia overlay yang seluruh nilainya',
    ' *  jatuh di luar pita harga emiten sehingga digambar di luar layar. */',
    'export const ID_MATI: ReadonlySet<string> = new Set([',
    daftar(mati),
    '])',
    '',
    '/** Dibuang dari katalog. Keduanya sama tak bergunanya di layar; dipisah di',
    ' *  atas supaya audit berikutnya bisa melihat mana yang berpindah kelompok. */',
    'export const ID_DIBUANG: ReadonlySet<string> = new Set([...ID_RUSAK, ...ID_MATI])',
    '',
  ].join('\n')
  writeFileSync(join(AKAR, 'app', 'src', 'lib', 'dasbor', 'indikatorDibuang.ts'), isi, 'utf8')
  console.log(`ditulis: docs/riset/audit-indikator.tsv (${baris.length} baris), app/src/lib/dasbor/indikatorDibuang.ts (${rusak.length + mati.length} id)`)
}
