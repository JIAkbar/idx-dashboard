/**
 * Backtest kelas Pivot/CPR dan setup R:R — angka di balik BadgeRapor panel
 * analitik chart (#63, spek `audit_chart_custom_LENGKAP.md` §4.2 & §4.3).
 *
 * MENGIMPOR mesin yang dipakai layar (`chartAnalitik.ts`, `rakitBar` +
 * `kunciPekan`/`kunciBulan`), tidak menyalinnya — aturan yang sama dengan
 * `gap-statistik.ts` dan `backtest-pola-klasik.ts`. #49 sudah membayar
 * harganya sekali: pola RBS sempat punya dua mesin yang diam-diam berbeda,
 * jadi angka backtest tak pernah menggambarkan garis yang dilihat orang.
 * Badge yang mengaku mengukur kelas di layar, tapi menghitungnya dengan
 * rumus lain, adalah bentuk kebohongan yang sama.
 *
 * Kunci run BERBEDA dari spek: spek menulis `pivot_cpr.relasi_<kelas>` tanpa
 * kerangka, padahal panelnya hidup di D, W, DAN M — kelasnya dihitung dari
 * bar kerangka aktif, jadi satu angka untuk semua kerangka berarti badge
 * harian dipajang di sebelah klasifikasi pekanan. Itu persis cacat #58/#60/#64
 * yang baru ditutup. Karena itu kerangka masuk ke kunci:
 * `pivot_cpr.relasi_<kelas>-<D|W|M>`.
 *
 * Semesta: `semua` saja. Panel tak tahu kode emiten maupun kelas
 * likuiditasnya, jadi run lq45/nonlikuid tak akan terbaca siapa pun; dan
 * keanggotaan semesta per-tanggal sudah punya satu mesin di
 * `bt_papan.py:universe_partanggal` — menyalinnya ke sini demi data yang tak
 * dibaca berarti dua mesin yang bisa berbeda diam-diam, harga yang sama yang
 * dibayar #49.
 *
 *   node app/scripts/bt-pivot-cpr.ts            (kering — hitung, cetak, tak menulis)
 *   node app/scripts/bt-pivot-cpr.ts --tulis
 *   node app/scripts/bt-pivot-cpr.ts --tf=D --tulis
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import {
  hitungPivot, hitungCpr, posisiCpr, relasiCpr,
  type KelasRelasiCpr, type PosisiCpr,
} from '../src/lib/dasbor/chartAnalitik.ts'
import { rakitBar, kunciPekan, kunciBulan } from '../src/lib/dasbor/kerangkaWaktu.ts'
import type { LilinData } from '../src/lib/dasbor/grafikEmiten.ts'

/* ------------------------------------------------------------------ *
 * Kontrak angka
 * ------------------------------------------------------------------ */

/** Horizon: masuk di BUKA bar t+1, keluar di TUTUP bar t+H (spek §4.2). */
export const HORIZON = 5

/**
 * Arah yang diukur per kelas — hanya kelas yang speknya memberi bias.
 *
 * `Outside Value` (volatilitas naik), `Inside Value` (konsolidasi), dan
 * `di-dalam` SENGAJA tak ada di sini: speknya tak menyebut arah untuk
 * ketiganya, dan "win rate" tanpa arah cuma bisa lahir dari arah yang
 * dikarang sendiri. Kelas tanpa arah tak menghasilkan run, jadi badge-nya
 * tak tampil — lebih baik kosong daripada berisi angka yang diam-diam
 * mengasumsikan long.
 */
export const ARAH_RELASI: Partial<Record<KelasRelasiCpr, 'bullish' | 'bearish'>> = {
  'Higher Value': 'bullish',
  'Lower Value': 'bearish',
  'Overlapping Higher': 'bullish',
  'Overlapping Lower': 'bearish',
}

export const ARAH_POSISI: Partial<Record<PosisiCpr, 'bullish' | 'bearish'>> = {
  'di-atas': 'bullish',
  'di-bawah': 'bearish',
}

/** Slug kunci — SAMA dengan yang dicari `PanelAnalitikChart`. */
export const SLUG_RELASI: Record<KelasRelasiCpr, string> = {
  'Higher Value': 'higher_value',
  'Lower Value': 'lower_value',
  'Outside Value': 'outside_value',
  'Inside Value': 'inside_value',
  'Overlapping Higher': 'overlapping_higher',
  'Overlapping Lower': 'overlapping_lower',
}
export const SLUG_POSISI: Record<PosisiCpr, string> = {
  'di-atas': 'di_atas',
  'di-dalam': 'di_dalam',
  'di-bawah': 'di_bawah',
}

/** Return satu trade, bertanda ARAH — bearish yang turun itu menang.
 *  Tanpa penandaan arah, seluruh kelas bearish akan terbaca kalah total. */
export function returnArah(masuk: number, keluar: number, arah: 'bullish' | 'bearish'): number {
  const r = (keluar - masuk) / masuk
  return arah === 'bullish' ? r : -r
}

/**
 * Bar yang kelasnya BISA dibaca.
 *
 * Bar tanpa rentang (high == low) memberi CPR yang runtuh: TC = BC = P =
 * close, dan `relasiCpr` menjawab `Higher Value` untuk tiap bar yang
 * harganya tak lebih rendah daripada kemarin. Terukur di arsip harian:
 * 938.430 dari 3.000.460 bar (31,3%) tanpa rentang, 623.216 (20,8%)
 * bervolume nol - dan sebelum saringan ini `Higher Value` jadi kelas
 * TERBANYAK (1.533.817), 40% di antaranya berakhir dengan harga masuk =
 * harga keluar. Kelas 'bullish kuat' yang isinya emiten beku.
 *
 * Volume nol ikut disaring: emiten yang tak diperdagangkan hari itu tak
 * punya sesi untuk diklasifikasi. (Ini BUKAN ruas `OpenPrice` bursa yang
 * nolnya berarti 'tak dilaporkan' - arsip ini bersumber lain dan
 * pembukaannya terisi di seluruh 3 juta bar.)
 */
export function barTerbaca(bar: { high: number; low: number }, volume: number): boolean {
  return bar.high > bar.low && volume > 0
}

export type HasilRRTrade = 'target' | 'sl' | 'ambigu' | 'tak_selesai'

/**
 * Target dulu, SL dulu, atau tak keduanya sampai horizon habis (spek §4.3).
 *
 * Bar yang menyentuh KEDUANYA di hari yang sama tak bisa diurutkan dari
 * OHLC harian (intraday 1 menit cuma ±90 hari, jauh dari cukup untuk
 * backtest bertahun-tahun). Speknya memutuskan: hitung LOSS, dan hitung
 * kasusnya TERPISAH supaya win rate tak terdilusi diam-diam. Di sini ia
 * dikembalikan sebagai `ambigu` — pemanggil yang menjumlahkannya ke kalah
 * sekaligus mencatat jumlahnya sendiri.
 */
export function hasilRRTrade(
  bar: { high: number; low: number }[],
  dari: number,
  sampai: number,
  target: number,
  sl: number,
): HasilRRTrade {
  for (let i = dari; i <= sampai && i < bar.length; i++) {
    const kenaTarget = bar[i].high >= target
    const kenaSl = bar[i].low <= sl
    if (kenaTarget && kenaSl) return 'ambigu'
    if (kenaTarget) return 'target'
    if (kenaSl) return 'sl'
  }
  return 'tak_selesai'
}

/* ------------------------------------------------------------------ *
 * Akumulator
 * ------------------------------------------------------------------ */

interface Ember {
  n: number
  menang: number
  /** Harga keluar SAMA PERSIS dengan harga masuk - bukan menang, bukan
   *  kalah, sama seperti lambang `datar` di rapor form. Dihitung di luar
   *  win rate dan dilaporkan sendiri; memasukkannya ke penyebut membuat
   *  tiap kelas terbaca merah karena emiten sepi, bukan karena kelasnya. */
  datar: number
  ret: number[]
  labaKotor: number
  rugiKotor: number
  /** Hanya rr_setup — tiga jalan keluar dicatat terpisah dari `menang`. */
  nTarget?: number
  nSl?: number
  nAmbigu?: number
  nTakSelesai?: number
}

const emberBaru = (): Ember => ({ n: 0, menang: 0, datar: 0, ret: [], labaKotor: 0, rugiKotor: 0 })

function catat(e: Ember, menang: boolean, ret: number, datarNetral = true): void {
  // rr_setup memakai `datarNetral: false`: hasilnya diputuskan target/SL,
  // bukan tanda return, jadi trade berselisih nol TETAP satu hasil. Kalau
  // ia ikut dinetralkan, `n_trade` jadi lebih kecil daripada jumlah empat
  // pencacah jalan keluarnya - dan selisihnya tak terjelaskan dari berkas.
  if (ret === 0 && datarNetral) { e.datar += 1; return }
  e.n += 1
  if (menang) e.menang += 1
  e.ret.push(ret)
  if (ret > 0) e.labaKotor += ret
  else e.rugiKotor += -ret
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/* ------------------------------------------------------------------ *
 * Jalan
 * ------------------------------------------------------------------ */

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OHLC = join(AKAR, 'data-idx', 'json', 'ohlc')
const BT = join(AKAR, 'data-idx', 'json', 'bt')

type Baris = [string, number, number, number, number, number]


/** Bar harian arsip -> bar kerangka, lewat perakit yang dipakai chart.
 *  Volume ikut dirakit (bukan dibuang): saringan `barTerbaca` memakainya,
 *  dan pekan yang seluruh harinya tanpa transaksi harus tetap terbaca
 *  bervolume nol. */
function keKerangka(mentah: Baris[], kerangka: 'D' | 'W' | 'M'): { bar: LilinData[]; vol: number[] } {
  const lilin: LilinData[] = mentah.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
  const volume = mentah.map(([time, , , , , v]) => ({ time, value: v }))
  if (kerangka === 'D') return { bar: lilin, vol: volume.map((v) => v.value) }
  const kunci = kerangka === 'W' ? kunciPekan : kunciBulan
  const r = rakitBar(lilin, volume, kunci, '', '')
  return { bar: r.lilin, vol: r.volume.map((v) => v.value) }
}

interface RingkasRun {
  kunci: string
  ember: Ember
  arah?: 'bullish' | 'bearish'
}

function jalankan(kerangka: 'D' | 'W' | 'M'): {
  runs: RingkasRun[]; dasar: Ember; mulai: string | null; akhir: string | null; nEmiten: number
} {
  const ember = new Map<string, Ember>()
  const ambil = (k: string): Ember => {
    let e = ember.get(k)
    if (!e) { e = emberBaru(); ember.set(k, e) }
    return e
  }
  // Laju dasar - berapa persen SEMUA bar yang lolos saringan berakhir naik.
  // Tanpa angka ini, win rate kelas tak bisa dibaca: 46% terdengar buruk
  // dan 54% terdengar bagus, padahal keduanya persis laju pasarnya sendiri.
  const dasar = emberBaru()
  let mulai: string | null = null
  let akhir: string | null = null
  let nEmiten = 0

  for (const f of readdirSync(OHLC)) {
    if (!f.endsWith('.json') || f === 'IHSG.json') continue
    let d: { d?: Baris[] }
    try { d = JSON.parse(readFileSync(join(OHLC, f), 'utf-8')) } catch { continue }
    const { bar, vol } = keKerangka(d.d ?? [], kerangka)
    // Butuh bar t-1 (relasi), t+1 (masuk), t+HORIZON (keluar) — di bawah ini
    // tak ada satu pun trade yang bisa terbentuk.
    if (bar.length < HORIZON + 3) continue
    nEmiten += 1
    if (!mulai || bar[0].time < mulai) mulai = bar[0].time
    if (!akhir || bar[bar.length - 1].time > akhir) akhir = bar[bar.length - 1].time

    for (let t = 1; t + HORIZON < bar.length; t++) {
      const kini = bar[t]
      const lalu = bar[t - 1]
      // Kelas dibaca dari DUA bar, jadi dua-duanya wajib terbaca.
      if (!barTerbaca(kini, vol[t]) || !barTerbaca(lalu, vol[t - 1])) continue
      const pivot = hitungPivot(kini.high, kini.low, kini.close)
      const cpr = hitungCpr(kini.high, kini.low, kini.close)
      const pivotLalu = hitungPivot(lalu.high, lalu.low, lalu.close)
      const cprLalu = hitungCpr(lalu.high, lalu.low, lalu.close)

      const masuk = bar[t + 1].open
      const keluar = bar[t + HORIZON].close
      if (!(masuk > 0) || !(keluar > 0)) continue

      catat(dasar, keluar > masuk, returnArah(masuk, keluar, 'bullish'))

      const kelas = relasiCpr(
        { tc: cpr.tc, bc: cpr.bc, p: pivot.P },
        { tc: cprLalu.tc, bc: cprLalu.bc, p: pivotLalu.P },
      ).kelas
      const arahRelasi = ARAH_RELASI[kelas]
      if (arahRelasi) {
        const r = returnArah(masuk, keluar, arahRelasi)
        catat(ambil(`pivot_cpr.relasi_${SLUG_RELASI[kelas]}-${kerangka}`), r > 0, r)
      }

      const posisi = posisiCpr(kini.close, cpr.tc, cpr.bc)
      const arahPosisi = ARAH_POSISI[posisi]
      if (arahPosisi) {
        const r = returnArah(masuk, keluar, arahPosisi)
        catat(ambil(`pivot_cpr.posisi_${SLUG_POSISI[posisi]}-${kerangka}`), r > 0, r)
      }

      // R:R — setup hanya sah kalau target dan stop masih di DEPAN harga saat
      // ini. Close di luar R1/S1 berarti salah satunya sudah tersentuh sebelum
      // trade dimulai; memasukkannya akan mencatat kemenangan/kekalahan yang
      // sudah terjadi sebelum entry.
      if (kini.close < pivot.R1 && kini.close > pivot.S1) {
        const e = ambil(`rr_setup.target_before_stop-${kerangka}`)
        e.nTarget ??= 0; e.nSl ??= 0; e.nAmbigu ??= 0; e.nTakSelesai ??= 0
        const hasil = hasilRRTrade(bar, t + 1, t + HORIZON, pivot.R1, pivot.S1)
        if (hasil === 'target') e.nTarget += 1
        else if (hasil === 'sl') e.nSl += 1
        else if (hasil === 'ambigu') e.nAmbigu += 1
        else e.nTakSelesai += 1
        catat(e, hasil === 'target', returnArah(masuk, keluar, 'bullish'), false)
      }
    }
  }

  const runs: RingkasRun[] = [...ember.entries()].map(([kunci, e]) => ({ kunci, ember: e }))
  runs.sort((a, b) => a.kunci.localeCompare(b.kunci))
  return { runs, dasar, mulai, akhir, nEmiten }
}

interface EntriIndex {
  strategi: string
  hash: string
  berkas: string
  dibuat: string
  n_trade: number
  win_rate: number
  median_return: number | null
  profit_factor: null
  parameter_ringkas: Record<string, unknown>
  akhir_data: string | null
}

/** Dipanggil HANYA saat berkas ini dijalankan langsung - berkas uji
 *  mengimpor fungsi murni di atas dan tak boleh ikut menjalankan
 *  backtest 960 emiten sebagai efek samping impor. */
function utama(): void {
  const arg = process.argv.slice(2)
  const tulis = arg.includes('--tulis')
  const tfMinta = arg.find((a) => a.startsWith('--tf='))?.slice(5).toUpperCase()
  const KERANGKA = (tfMinta ? [tfMinta] : ['D', 'W', 'M']) as ('D' | 'W' | 'M')[]
  const stempel = new Date().toISOString().slice(0, 19)
  const entri: EntriIndex[] = []
  const rinci: Record<string, unknown> = {}

for (const kerangka of KERANGKA) {
  const { runs, dasar, mulai, akhir, nEmiten } = jalankan(kerangka)
  const dasarLong = dasar.n ? dasar.menang / dasar.n : 0
  console.log(`\n=== ${kerangka} · ${nEmiten} emiten · ${mulai}–${akhir}  laju dasar long ${(dasarLong * 100).toFixed(2)}% dari ${dasar.n} bar ===`)
  for (const { kunci, ember: e } of runs) {
    const win = e.n ? e.menang / e.n : 0
    const param: Record<string, unknown> = {
      strategi: kunci,
      kerangka,
      semesta: 'semua',
      mulai,
      akhir: null,
      model_masuk: 'open_h1',
      model_keluar: `h${HORIZON}`,
      biaya: 0,
      emiten: nEmiten,
      // Bar tanpa rentang / tanpa volume dibuang sebelum klasifikasi.
      saringan_bar: 'high > low dan volume > 0, pada bar t DAN t-1',
      n_datar: e.datar,
      // Pembanding wajib: win rate kelas TANPA laju dasar tak bisa dinilai.
      laju_dasar_long: dasarLong,
      laju_dasar_short: 1 - dasarLong,
      n_dasar: dasar.n,
      profit_factor_catatan: 'tak dihitung - return ekstrem aksi korporasi belum tersaring di arsip ini',
    }
    if (e.nTarget !== undefined) {
      param.n_target = e.nTarget
      param.n_sl = e.nSl
      param.ambigu_sama_hari = e.nAmbigu
      param.n_tak_selesai = e.nTakSelesai
    }
    entri.push({
      strategi: kunci,
      hash: createHash('sha256').update(JSON.stringify(param)).digest('hex').slice(0, 8),
      berkas: `pivot-cpr-${kerangka}.json`,
      dibuat: stempel,
      n_trade: e.n,
      win_rate: win,
      median_return: median(e.ret),
      // TIDAK dipublikasikan (#63). Arsip harga ini masih memuat return
      // mustahil dari aksi korporasi yang tak tersesuaikan - #45b sudah
      // mengukurnya: satu bar BCIC 2006 berreturn +982.042% sendirian
      // mengangkat profit factor RSI pekanan dari 1,47 jadi 23,74. Rasio
      // laba/rugi kotor di sini kena hal yang sama (di_atas-W terbaca 4,33
      // padahal win rate-nya 47,6%), jadi angkanya akan terbaca resmi dan
      // salah. Win rate tak terpengaruh: ia menghitung ARAH, bukan besar.
      profit_factor: null,
      parameter_ringkas: param,
      akhir_data: akhir,
    })
    console.log(
      `${kunci.padEnd(46)} n=${String(e.n).padStart(7)}  win=${(win * 100).toFixed(1)}%  datar=${e.datar}` +
      (e.nAmbigu !== undefined ? `  (target ${e.nTarget} · sl ${e.nSl} · ambigu ${e.nAmbigu} · tak selesai ${e.nTakSelesai})` : ''),
    )
  }
  rinci[kerangka] = { emiten: nEmiten, mulai, akhir, run: runs.map((r) => ({ kunci: r.kunci, ...r.ember, ret: undefined })) }
}

if (!tulis) {
  console.log('\n(kering — tak ada yang ditulis; tambahkan --tulis)')
} else {
  mkdirSync(BT, { recursive: true })
  for (const kerangka of KERANGKA) {
    writeFileSync(join(BT, `pivot-cpr-${kerangka}.json`), JSON.stringify(rinci[kerangka], null, 1))
  }
  const jalur = join(BT, 'index.json')
  const idx = existsSync(jalur) ? JSON.parse(readFileSync(jalur, 'utf-8')) : { run: [] }
  // Jalan ulang MENGGANTI run lama berkunci sama, bukan menumpuknya:
  // `cariRun` mengambil yang pertama cocok, jadi run basi yang tertinggal di
  // atas run baru akan menang tanpa satu pun galat.
  const kunciBaru = new Set(entri.map((e) => e.strategi))
  idx.run = [...idx.run.filter((r: { strategi: string }) => !kunciBaru.has(r.strategi)), ...entri]
  writeFileSync(jalur, JSON.stringify(idx, null, 1))
  console.log(`\nditulis: ${entri.length} run ke bt/index.json (total ${idx.run.length})`)
}

}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) utama()
