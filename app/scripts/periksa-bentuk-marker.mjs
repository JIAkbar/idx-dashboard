/**
 * Skrip SEKALI PAKAI (B30) — membuktikan bentuk PERSIS keluaran `calculate()`
 * untuk tiga entri registry yang `plotConfig`-nya kosong: volume-delta,
 * williams-fractals, zigzag. Sebelum menulis jalur penggambar penanda,
 * dibuktikan dulu apa isinya — bukan ditebak dari nama.
 *
 * node app/scripts/periksa-bentuk-marker.mjs
 *
 * Hasilnya (bukti, bukan tebakan): `williams-fractals` mengembalikan
 * `markers` — array `{time,position,shape,color,size}`, PERSIS bentuk
 * `SeriesMarker` `lightweight-charts`. `volume-delta` mengembalikan
 * `plotCandles.delta` (deret LILIN, bukan penanda titik — butuh seri
 * candlestick sendiri). `zigzag` mengembalikan `pivots`/`lines`/`labels`
 * (segmen garis dua titik + teks, bukan penanda titik tunggal). Cuma yang
 * pertama dipetakan ke katalog — lihat `ID_PENANDA` di katalogIndikator.ts.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { indicatorRegistry } from 'lightweight-charts-indicators'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TARGET = ['volume-delta', 'williams-fractals', 'zigzag']

function muatBar(kode) {
  const j = JSON.parse(readFileSync(join(AKAR, 'data-idx', 'json', 'ohlc', `${kode}.json`), 'utf8'))
  return j.d.map(([tgl, o, h, l, c, v]) => ({
    time: Math.floor(Date.parse(`${tgl}T00:00:00Z`) / 1000),
    open: o, high: h, low: l, close: c, volume: v ?? 0,
  }))
}

const bars = muatBar('BBCA')

for (const id of TARGET) {
  const e = indicatorRegistry.find((x) => x.id === id)
  console.log(`\n=== ${id} (${e?.name}) ===`)
  if (!e) { console.log('  TAK DITEMUKAN di registry'); continue }
  console.log('  overlay:', e.overlay, '| category:', e.category, '| plotConfig:', e.plotConfig)
  console.log('  defaultInputs:', JSON.stringify(e.defaultInputs))
  let hasil
  try {
    hasil = e.calculate(bars, e.defaultInputs ?? {})
  } catch (err) {
    console.log('  GALAT saat calculate():', err?.message ?? err)
    continue
  }
  const kunci = Object.keys(hasil ?? {})
  console.log('  kunci hasil calculate():', kunci)
  for (const k of kunci) {
    const v = hasil[k]
    console.log(`  -- ${k}: tipe=${Array.isArray(v) ? 'array' : typeof v}, panjang=${Array.isArray(v) ? v.length : '-'}`)
    if (Array.isArray(v)) {
      for (const contoh of v.slice(0, 3)) console.log('     contoh:', JSON.stringify(contoh))
      // Cari 3 contoh yang bukan null/kosong kalau tiga pertama kebetulan kosong
      const nonKosong = v.filter((x) => x != null).slice(0, 3)
      if (nonKosong.length) console.log('     contoh (non-null):', nonKosong.map((x) => JSON.stringify(x)).join(' | '))
    } else if (v && typeof v === 'object') {
      console.log('     isi objek:', JSON.stringify(v).slice(0, 400))
    }
  }
}
