/**
 * Kolom "Pola" di Screener (Johan 21 Agu 2026: *"itu juga bisa masuk di
 * screener"*) — pola klasik AKTIF per emiten, dari data HARIAN penuh.
 *
 * "Aktif" = pola berstatus 'menunggu' dengan `iSinyal` TERBESAR (yang paling
 * baru bicara); pola yang sudah 'tercapai'/'gagal' bukan info screener — kolom
 * ini soal "apa yang sedang berjalan", bukan riwayat. `cariPolaKlasik`
 * mengembalikan array terurut naik menurut `iSinyal` (kontraknya, lihat
 * `polaKlasik.ts`), jadi pola menunggu paling baru selalu di ujung setelah
 * difilter.
 *
 * Kesegaran: pola menunggu yang sinyalnya lebih tua dari `SEGAR_LILIN` lilin
 * terakhir dianggap basi -> null. Menunggu berbulan-bulan bukan informasi
 * screener yang berguna.
 *
 * Angka backtest sapuan penuh (`polaKlasik.ts` kepala berkas) membalik tanda
 * dari sampel kecil — sebagian besar pola TIDAK mengungguli peluang dasar.
 * Kolom ini deskripsi bentuk, BUKAN sinyal beli; keterangan itu wajib
 * tercetak di halaman (Screener.tsx), bukan cuma di sini.
 *
 *   npx vite-node app/scripts/pola-screener.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PARAM_POLA_KLASIK_BAWAAN, cariPolaKlasik, LABEL_POLA_KLASIK } from '../src/lib/dasbor/polaKlasik.ts'
import type { LilinData } from '../src/lib/dasbor/grafikEmiten.ts'

// 10 lilin harian = dua pekan bursa. Semula 60, dan Johan menangkap
// akibatnya dari layar: 63% papan berlabel "berpola aktif" — chip yang
// menyala di dua pertiga baris bukan saringan. Terukur atas 915 emiten:
// jendela 60=63%, 30=43%, 20=34%, 10=22%. Dua pekan dipilih karena label
// "aktif" harus berarti "baru saja terjadi", bukan "masih belum batal".
// (catatan lama: 60 lilin ≈ tiga bulan bursa — pola yang masih "menunggu" lebih lama
// dari itu sudah bukan info yang segar untuk sebuah screener.
const SEGAR_LILIN = 10

// Jalur dihitung dari LETAK BERKAS (pola sama `sapu-pola-klasik.ts`), bukan
// dari direktori kerja — supaya jalan sama dari `cwd` mana pun.
const dirRepo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dirOhlc = join(dirRepo, 'data-idx', 'json', 'ohlc')
const kode = readdirSync(dirOhlc).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))

type EntriPola = [nama: string, arah: 'bullish' | 'bearish', tanggal: string, target: number, hargaSinyal: number]

const d: Record<string, EntriPola> = {}
const sebaran: Record<string, number> = {}
let akhirGlobal = ''

for (const k of kode) {
  let j: { akhir?: string; d?: Array<[string, number, number, number, number]> }
  try {
    j = JSON.parse(readFileSync(join(dirOhlc, `${k}.json`), 'utf8'))
  } catch { continue }
  if (!Array.isArray(j.d)) continue // mis. `_gagal.json`, manifest bukan lilin
  if (j.akhir && j.akhir > akhirGlobal) akhirGlobal = j.akhir
  const lilin: LilinData[] = j.d.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
  if (lilin.length === 0) continue

  const pola = cariPolaKlasik(lilin, PARAM_POLA_KLASIK_BAWAAN)
  const menunggu = pola.filter((q) => q.status === 'menunggu')
  if (menunggu.length === 0) continue

  const aktif = menunggu[menunggu.length - 1] // iSinyal terbesar
  if (aktif.iSinyal < lilin.length - SEGAR_LILIN) continue // basi

  d[k] = [aktif.nama, aktif.arah, lilin[aktif.iSinyal].time, aktif.target, aktif.hargaSinyal]
  sebaran[aktif.nama] = (sebaran[aktif.nama] ?? 0) + 1
}

writeFileSync(
  join(dirRepo, 'data-idx', 'json', 'pola_screener.json'),
  JSON.stringify({ akhir: akhirGlobal, n: Object.keys(d).length, d }),
)

console.log(`${Object.keys(d).length} dari ${kode.length} emiten berpola aktif (segar, ≤${SEGAR_LILIN} lilin terakhir)\n`)
for (const nm of Object.keys(LABEL_POLA_KLASIK)) {
  if (sebaran[nm]) console.log(`  ${LABEL_POLA_KLASIK[nm as keyof typeof LABEL_POLA_KLASIK].padEnd(28)} ${sebaran[nm]}`)
}
