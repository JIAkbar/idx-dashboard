/**
 * Petakan daftar "Built-in Technicals" TradingView ke id registry pustaka
 * (#45a). Keluarannya id yang BENAR-BENAR ada, bukan nama yang kedengarannya
 * cocok.
 *
 * Johan 7 Sep 2026: *"GUNAKAN DEFAULT REFERENSI … BISA LIHAT DI STOCKBIT ATAU
 * DI TRADINGVIEW"* · *"disnii letaknya indikator bawaan nya"* (tangkapan layar
 * TradingView Built-in -> Technicals).
 *
 * Kenapa nama TradingView-nya ditulis tangan di sini padahal proyek ini
 * melarang daftar tangan: daftar itu milik PIHAK LAIN dan tak ada di registry
 * mana pun yang bisa kita baca. Yang tak boleh ditulis tangan adalah ID
 * PUSTAKA-nya — dan itu tidak ditulis tangan: skrip ini yang mencarinya, dan
 * nama TradingView yang TIDAK ketemu dilaporkan apa adanya alih-alih
 * dicocokkan paksa.
 *
 *   node scripts/petakan-tv-bawaan.mjs           # laporan
 *   node scripts/petakan-tv-bawaan.mjs --set     # potongan Set siap tempel
 */
import { indicatorRegistry } from 'lightweight-charts-indicators'

/** Nama di panel Built-in > Technicals TradingView. */
const TV = [
  'Accumulation/Distribution', 'Arnaud Legoux Moving Average', 'Aroon',
  'Average True Range', 'Average Directional Index', 'Awesome Oscillator',
  'Balance of Power', 'Bollinger Bands', 'Bollinger Bands %B', 'Bollinger BandWidth',
  'Chaikin Money Flow', 'Chaikin Oscillator', 'Chande Kroll Stop',
  'Chande Momentum Oscillator', 'Choppiness Index', 'Commodity Channel Index',
  'Connors RSI', 'Coppock Curve', 'Detrended Price Oscillator',
  'Directional Movement Index', 'Donchian Channels', 'Double Exponential Moving Average',
  'Ease of Movement', 'Elders Force Index', 'Envelope', 'Exponential Moving Average',
  'Fisher Transform', 'Historical Volatility', 'Hull Moving Average', 'Ichimoku Cloud',
  'Keltner Channels', 'Klinger Oscillator', 'Know Sure Thing',
  'Least Squares Moving Average', 'Linear Regression Channel', 'Mass Index',
  'McGinley Dynamic', 'Momentum', 'Money Flow Index', 'Moving Average Convergence Divergence',
  'Net Volume', 'On Balance Volume', 'Parabolic SAR', 'Pivot Points High Low',
  'Price Oscillator', 'Price Volume Trend', 'Rate of Change',
  'Relative Strength Index', 'Relative Vigor Index', 'Relative Volatility Index',
  'Simple Moving Average', 'SMI Ergodic Indicator', 'Smoothed Moving Average',
  'Stochastic', 'Stochastic RSI', 'SuperTrend', 'TRIX', 'Triple Exponential Moving Average',
  'True Strength Index', 'Ultimate Oscillator', 'Volume Oscillator',
  'Volume Weighted Average Price', 'Volume Weighted Moving Average', 'Vortex Indicator',
  'Williams %R', 'Williams Alligator', 'Williams Fractals', 'Zig Zag',
]

/**
 * Alias nama TradingView -> ejaan yang dipakai pustaka (biasanya singkatannya).
 * Ditulis hanya untuk nama yang gagal cocok persis, dan tiap alias TETAP
 * dicari di registry — kalau aliasnya juga tak ada, ia dilaporkan hilang.
 */
const ALIAS = {
  'Accumulation/Distribution': ['Accumulation/Distribution Line', 'A/D', 'accum-dist'],
  'Arnaud Legoux Moving Average': ['ALMA'],
  'Average True Range': ['ATR'],
  'Average Directional Index': ['ADX'],
  'Balance of Power': ['BOP'],
  'Bollinger Bands': ['BB'],
  'Commodity Channel Index': ['CCI'],
  'Donchian Channels': ['Donchian'],
  'Double Exponential Moving Average': ['DEMA'],
  'Elders Force Index': ['Elder Force Index', 'Force Index', 'EFI'],
  'Exponential Moving Average': ['EMA'],
  'Hull Moving Average': ['HMA'],
  'Keltner Channels': ['Keltner'],
  'Know Sure Thing': ['KST'],
  'Least Squares Moving Average': ['LSMA'],
  'Moving Average Convergence Divergence': ['MACD'],
  'On Balance Volume': ['OBV'],
  'Pivot Points High Low': ['Pivot HH HL LH LL', 'pivot-hh-hl-lh-ll'],
  'Price Oscillator': ['PPO'],
  'Rate of Change': ['ROC'],
  'Relative Strength Index': ['RSI'],
  'Simple Moving Average': ['SMA'],
  'Triple Exponential Moving Average': ['TEMA'],
  'Volume Weighted Average Price': ['VWAP'],
  'Volume Weighted Moving Average': ['VWMA'],
}

const bersih = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const entri = Object.values(indicatorRegistry)
const peta = new Map()
for (const e of entri) {
  peta.set(bersih(e.name), e)
  if (e.shortName) peta.set(bersih(e.shortName), e)
}

const ketemu = []
const hilang = []
for (const nama of TV) {
  const calon = [nama, ...(ALIAS[nama] ?? [])]
  const e = calon.map((c) => peta.get(bersih(c))).find(Boolean)
  if (e) ketemu.push({ tv: nama, id: e.id, nama: e.name, plot: e.plotConfig?.length ?? 0 })
  else hilang.push(nama)
}

if (process.argv.includes('--set')) {
  const id = [...new Set(ketemu.map((k) => k.id))].sort()
  console.log(id.map((x) => `'${x}',`).join(' '))
} else {
  console.log(`daftar TradingView: ${TV.length} nama`)
  console.log(`ketemu di registry : ${ketemu.length}`)
  console.log(`TIDAK ketemu       : ${hilang.length}`)
  for (const h of hilang) console.log(`  -  ${h}`)
  console.log('\nketemu (tv -> id, jumlah plot):')
  for (const k of ketemu) console.log(`  ${k.tv}  ->  ${k.id}  (${k.plot})`)
}
