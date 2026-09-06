/**
 * Kerangka waktu (timeframe) Grafik Emiten — menu `5m 15m 30m 1h 4h D W M`.
 *
 * Tiga sumber, satu bentuk keluaran (`LilinData` + `VolumeData` yang sama
 * dengan sisa halaman):
 *
 * | Kerangka | Dari mana | Kenapa begitu |
 * |---|---|---|
 * | 5m/15m/30m/1h | Yahoo, lewat proxy CORS | tak ada satu pun data intraday di repo; IDX `GetStockSummary` cuma harian |
 * | 4h | DIRAKIT dari 1h | Yahoo tidak punya interval 4 jam sama sekali |
 * | D | berkas lokal `ohlc/<KODE>.json` | sudah ada, 10 tahun, tak perlu jaringan |
 * | W/M | DIRAKIT dari D | sama alasannya — merakit lebih murah daripada satu unduhan lagi |
 *
 * **1 menit sengaja tidak ada.** Yahoo cuma menyimpan ±5 hari untuk interval
 * satu menit; menu yang menjanjikan "1 menit" lalu memberi seminggu data lebih
 * buruk daripada tak ada menunya sama sekali.
 *
 * ## Waktu sebagai STRING, selalu
 *
 * Seluruh halaman ini memakai `time: string`: harian `'yyyy-mm-dd'`, intraday
 * `'yyyy-mm-dd HH:mm'` dalam WIB. Keduanya urut secara leksikografis, jadi
 * peta legenda dan pencarian pola tak perlu tahu ada kerangka waktu sama
 * sekali — mereka tetap membandingkan string.
 *
 * Konversi ke tipe `Time` lightweight-charts terjadi di SATU tempat
 * (`keWaktuChart`) tepat saat data diserahkan ke kanvas, dan kembalinya
 * (`dariWaktuChart`) saat crosshair melaporkan titik yang disorot. Alternatif
 * yang ditolak: memakai epoch angka sebagai waktu internal — itu memaksa
 * seluruh 1.400 baris `grafikEmiten.ts` (ATR, pivot, musiman, penanda) ikut
 * berganti tipe demi satu hal yang cuma dibutuhkan kanvas.
 */
import type { LilinData, VolumeData } from './grafikEmiten'

/** WIB tetap +07:00 sepanjang tahun — Indonesia tak punya DST, jadi offset
 *  tetap ini bukan penyederhanaan yang akan meleset di bulan tertentu. */
const OFFSET_WIB_DETIK = 7 * 3600

const p2 = (n: number) => String(n).padStart(2, '0')

/** Epoch detik (UTC, apa adanya dari Yahoo) → `'yyyy-mm-dd HH:mm'` WIB. */
export function dariEpoch(detik: number): string {
  const d = new Date((detik + OFFSET_WIB_DETIK) * 1000)
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
    + ` ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
}

/** Kebalikan `dariEpoch`. Bolak-balik WAJIB persis: nilai inilah yang
 *  diserahkan ke kanvas dan yang dikembalikan crosshair, dan selisih satu
 *  detik saja membuat pencarian nilai indikator di legenda meleset ke titik
 *  yang tak ada. */
export function keEpoch(waktu: string): number {
  return Math.round(Date.parse(`${waktu.replace(' ', 'T')}:00+07:00`) / 1000)
}

/** Waktu internal → tipe `Time` lightweight-charts. Harian tetap string
 *  (dibaca sebagai BusinessDay); intraday jadi epoch detik, karena
 *  lightweight-charts cuma mengenal string berformat tanggal — `'2026-08-18
 *  09:30'` akan ditolaknya. */
export function keWaktuChart(waktu: string): string | number {
  return waktu.length <= 10 ? waktu : keEpoch(waktu)
}

/** Kebalikannya, untuk `param.time` yang dilaporkan crosshair. */
export function dariWaktuChart(t: unknown): string | null {
  if (typeof t === 'number') return dariEpoch(t)
  if (typeof t === 'string') return t
  return null
}

/** Sebuah waktu internal itu intraday (punya jam) atau bukan. */
export const beriJam = (waktu: string): boolean => waktu.length > 10

/* ------------------------------------------------------------------ *
 * Daftar kerangka
 * ------------------------------------------------------------------ */

export type IdKerangka = '5m' | '15m' | '30m' | '1h' | '4h' | 'D' | 'W' | 'M'

export interface Kerangka {
  id: IdKerangka
  label: string
  /** Batas riwayatnya, ditulis apa adanya di `title` tombolnya. Tanpa ini
   *  pembaca menyangka 5m punya riwayat sepuluh tahun seperti D, lalu
   *  menyimpulkan datanya rusak saat grafiknya berhenti sebulan lalu. */
  judul: string
  /** Interval yang diminta ke Yahoo. `null` = tak diambil dari Yahoo sama
   *  sekali (dirakit, atau dari berkas lokal). */
  interval: '5m' | '15m' | '30m' | '60m' | null
  /** Rentang yang diminta ke Yahoo bersama `interval`. */
  rentang: '1mo' | '2y' | null
  /** Dirakit dari kerangka lain — `1h` untuk 4 jam, `D` untuk pekan/bulan. */
  rakitDari?: IdKerangka
}

export const KERANGKA: Kerangka[] = [
  { id: '5m', label: '5m', judul: '5 menit — Yahoo, riwayat ±1 bulan', interval: '5m', rentang: '1mo' },
  { id: '15m', label: '15m', judul: '15 menit — Yahoo, riwayat ±1 bulan', interval: '15m', rentang: '1mo' },
  { id: '30m', label: '30m', judul: '30 menit — Yahoo, riwayat ±1 bulan', interval: '30m', rentang: '1mo' },
  { id: '1h', label: '1h', judul: '1 jam — Yahoo, riwayat ±2 tahun', interval: '60m', rentang: '2y' },
  { id: '4h', label: '4h', judul: '4 jam — dirakit dari candle 1 jam (Yahoo tak punya interval ini), riwayat ±2 tahun', interval: '60m', rentang: '2y', rakitDari: '1h' },
  { id: 'D', label: 'D', judul: 'Harian — data PAPAN sendiri, riwayat 10 tahun', interval: null, rentang: null },
  { id: 'W', label: 'W', judul: 'Pekanan — dirakit dari candle harian, riwayat 10 tahun', interval: null, rentang: null, rakitDari: 'D' },
  { id: 'M', label: 'M', judul: 'Bulanan — dirakit dari candle harian, riwayat 10 tahun', interval: null, rentang: null, rakitDari: 'D' },
]

export const KERANGKA_BAWAAN: IdKerangka = 'D'

/** Kerangka yang datanya diambil dari Yahoo (bukan dari berkas lokal). */
export const intraday = (id: IdKerangka): boolean =>
  (KERANGKA.find((k) => k.id === id)?.interval ?? null) !== null

/** Kata untuk SATU bar kerangka itu, tunggal, apa adanya di layar.
 *
 *  Satu-satunya tempat kata ini dieja — persis seperti `LABEL_RENTANG` untuk
 *  rentang waktu. Sebelum ini seluruh panel analitik mengeja "sesi" apa pun
 *  kerangkanya, jadi 40 candle lima menit tercetak sebagai "40 sesi". */
export const SATUAN_BAR: Record<IdKerangka, string> = {
  '5m': 'candle 5 menit',
  '15m': 'candle 15 menit',
  '30m': 'candle 30 menit',
  '1h': 'candle 1 jam',
  '4h': 'candle 4 jam',
  D: 'sesi',
  W: 'pekan',
  M: 'bulan',
}

/** Kelas kerangka untuk perhitungan horizon (`offsetHorizon`). */
export function kelasKerangka(id: IdKerangka): 'intraday' | 'D' | 'W' | 'M' {
  if (id === 'D' || id === 'W' || id === 'M') return id
  return 'intraday'
}

/* ------------------------------------------------------------------ *
 * Perakitan
 * ------------------------------------------------------------------ */

/**
 * Gabungkan lilin menurut sebuah KUNCI EMBER: buka = lilin pertama ember,
 * tutup = terakhir, tinggi/rendah = ekstremnya, volume = jumlahnya.
 *
 * `lilin` dan `volume` diasumsikan sejajar indeksnya — sudah begitu di
 * seluruh halaman ini (keduanya lahir dari `keDataLilinVolume` yang sama).
 *
 * Waktu lilin hasil = KUNCI embernya, bukan waktu lilin pertama: lilin 4 jam
 * pertama IDX berisi 09:00–11:00 dan menaruhnya di 09:00 membuat jarak antar
 * lilin tak sama (09:00 → 12:00 → 09:00 hari berikutnya). Kunci ember
 * mengembalikannya ke kisi yang rata, sama seperti yang dilakukan TradingView.
 */
export function rakitBar(
  lilin: LilinData[],
  volume: VolumeData[],
  kunci: (waktu: string) => string,
  warnaNaik: string,
  warnaTurun: string,
): { lilin: LilinData[]; volume: VolumeData[] } {
  const hasilLilin: LilinData[] = []
  const hasilVolume: number[] = []
  let kunciTerakhir = ''
  for (let i = 0; i < lilin.length; i++) {
    const l = lilin[i]
    const k = kunci(l.time)
    if (k !== kunciTerakhir) {
      kunciTerakhir = k
      hasilLilin.push({ time: k, open: l.open, high: l.high, low: l.low, close: l.close })
      hasilVolume.push(volume[i]?.value ?? 0)
      continue
    }
    const akhir = hasilLilin[hasilLilin.length - 1]
    akhir.high = Math.max(akhir.high, l.high)
    akhir.low = Math.min(akhir.low, l.low)
    akhir.close = l.close
    hasilVolume[hasilVolume.length - 1] += volume[i]?.value ?? 0
  }
  return {
    lilin: hasilLilin,
    volume: hasilLilin.map((l, i) => ({
      time: l.time,
      value: hasilVolume[i],
      color: l.close >= l.open ? warnaNaik : warnaTurun,
    })),
  }
}

/** Ember 4 jam menurut JAM DINDING (00:00/04:00/08:00/12:00/16:00/20:00),
 *  bukan "tiap empat lilin sejak pembukaan". Bedanya terasa di hari yang
 *  perdagangannya dipotong (libur setengah hari, gangguan bursa): hitungan
 *  per-empat-lilin menggeser seluruh sisa harinya ke ember yang salah,
 *  jam dinding tidak. */
export const kunci4Jam = (waktu: string): string =>
  `${waktu.slice(0, 11)}${p2(Math.floor(Number(waktu.slice(11, 13)) / 4) * 4)}:00`

/** Ember pekanan = tanggal SENIN pekan itu. Senin libur tetap dipakai sebagai
 *  label ember (kisi yang rata lebih penting daripada label yang kebetulan
 *  hari bursa) — sama seperti alasan kunci 4 jam. */
export function kunciPekan(waktu: string): string {
  const d = new Date(`${waktu.slice(0, 10)}T00:00:00Z`)
  // getUTCDay: 0=Minggu. Minggu digeser 6 hari mundur, bukan nol.
  const mundur = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - mundur)
  return d.toISOString().slice(0, 10)
}

/** Ember bulanan = tanggal 1 bulan itu. */
export const kunciBulan = (waktu: string): string => `${waktu.slice(0, 7)}-01`

/* ------------------------------------------------------------------ *
 * Yahoo
 * ------------------------------------------------------------------ */

/** Bentuk minimal respons Yahoo chart yang dipakai — sisanya diabaikan. */
export interface YahooIntradayJson {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>
          high?: Array<number | null>
          low?: Array<number | null>
          close?: Array<number | null>
          volume?: Array<number | null>
        }>
      }
    }>
  }
}

/**
 * Respons Yahoo → lilin + volume. Fungsi MURNI supaya bentuk JSON-nya bisa
 * diuji tanpa jaringan (pola yang sama dengan `hargaTerakhir.ts`).
 *
 * Titik yang salah satu ruas OHLC-nya `null` DIBUANG, bukan ditambal dengan
 * nilai sebelahnya: Yahoo menaruh `null` di menit yang tak ada transaksinya,
 * dan menambalnya menghasilkan lilin datar yang mengaku ada perdagangan —
 * kesalahan yang sama persis dengan `hariTanpaPerdagangan` di jalur harian.
 */
export function dariYahoo(
  j: YahooIntradayJson,
  warnaNaik: string,
  warnaTurun: string,
): { lilin: LilinData[]; volume: VolumeData[] } {
  const res = j?.chart?.result?.[0]
  const t = res?.timestamp
  const q = res?.indicators?.quote?.[0]
  if (!t || !q) return { lilin: [], volume: [] }
  const lilin: LilinData[] = []
  const volume: VolumeData[] = []
  for (let i = 0; i < t.length; i++) {
    const o = q.open?.[i]; const h = q.high?.[i]; const l = q.low?.[i]; const c = q.close?.[i]
    if (o == null || h == null || l == null || c == null) continue
    const waktu = dariEpoch(t[i])
    lilin.push({ time: waktu, open: o, high: h, low: l, close: c })
    volume.push({ time: waktu, value: q.volume?.[i] ?? 0, color: c >= o ? warnaNaik : warnaTurun })
  }
  return { lilin, volume }
}

/**
 * Ambil lilin intraday sebuah emiten dari Yahoo.
 *
 * Lewat proksi SE-ASAL `/api/yahoo` — `api/yahoo.js` di produksi, `server.proxy`
 * di dev server Vite, dengan bentuk URL yang sengaja dibuat identik supaya kode
 * ini tak perlu tahu ia sedang berjalan di mana.
 *
 * Proksi CORS publik (jalur `hargaTerakhir.ts`) sudah dicoba dan DITOLAK:
 * terukur 18 Agustus 2026, keempatnya — corsproxy.io, allorigins, codetabs,
 * thingproxy — dibalas 429/520 oleh Yahoo. Pembedanya ternyata User-Agent,
 * bukan alamat IP: permintaan yang sama dengan UA peramban dibalas 200.
 * Proksi sendiri bisa mengirim UA yang benar; proksi orang lain tidak.
 *
 * Melempar `Error` berpesan menyebut kodenya — pemanggil tinggal menampilkan
 * `e.message`.
 */
export async function ambilIntraday(
  kode: string,
  id: IdKerangka,
  warnaNaik: string,
  warnaTurun: string,
  /** Sinyal pembatal dari efek pemanggil — audit 21 Agu 2026 (#10): tanpa
   *  ini, variabel `batal` cuma membuang HASILNYA sementara permintaan ke
   *  proksi `/api/yahoo` tetap berjalan sampai timeout 15 detik. Menjelajahi
   *  beberapa kode intraday cepat berarti beberapa permintaan paralel nyata
   *  ke satu-satunya proksi yang lolos rate-limit Yahoo. */
  sinyal?: AbortSignal,
): Promise<{ lilin: LilinData[]; volume: VolumeData[] }> {
  const k = KERANGKA.find((x) => x.id === id)
  if (!k?.interval || !k.rentang) throw new Error(`Kerangka ${id} bukan intraday.`)
  const r = await fetch(
    `/api/yahoo?simbol=${encodeURIComponent(`${kode}.JK`)}&interval=${k.interval}&rentang=${k.rentang}`,
    { signal: sinyal ? AbortSignal.any([sinyal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) },
  )
  if (!r.ok) throw new Error(`Yahoo menolak permintaan intraday ${kode} (HTTP ${r.status}).`)
  const mentah = dariYahoo((await r.json()) as YahooIntradayJson, warnaNaik, warnaTurun)
  if (mentah.lilin.length === 0) throw new Error(`Yahoo tak punya candle ${k.label} untuk ${kode}.`)
  return k.rakitDari ? rakitBar(mentah.lilin, mentah.volume, kunci4Jam, warnaNaik, warnaTurun) : mentah
}
