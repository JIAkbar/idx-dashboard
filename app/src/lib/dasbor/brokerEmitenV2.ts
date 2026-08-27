/**
 * Bahan tambahan Broker Summary v2 di atas `brokerEmiten.ts` (dipakai APA
 * ADANYA, tak diubah): harga OHLCV per emiten (buat overlay & VWAP) + fungsi
 * murni Kuadran/Inventory yang butuh menggabung `AgregatBroker` dengan harga.
 *
 * OHLCV di sini datang dari `/data-idx/json/ohlcv_stockbit/<KODE>.json` —
 * BEDA dari `ohlc/` yang dipakai Grafik Emiten (`ihsgOhlc.ts`): kolomnya 17
 * ruas (termasuk `value`, perlu buat VWAP), dan folder `ohlc/` sedang
 * dipegang pekerjaan lain (jangan disatukan/disentuh).
 */
import { useEffect, useState } from 'react'
import type { AgregatBroker, BarisBroker, HariBroker } from './brokerEmiten'
import { muatRentang } from './brokerEmiten'
import { pesanGalat } from '../pesanGalat'
import { kelompokBroker, LABEL_KELOMPOK, KETERANGAN_KELOMPOK, type KelompokBroker } from './kelompokBroker'
import { LABEL_KATEGORI, type DaftarKategoriBroker, type KategoriBroker } from './kategoriBroker'

export interface BarisOhlcv {
  tanggal: string
  buka: number
  tutup: number
  volume: number
  nilai: number
  /** Rupiah — LANGSUNG dari sumber (Stockbit/IDX), bukan taksiran lembar×avg
   *  (itu yang terukur miring +33% kumulatif, lihat CLAUDE.md). Aman dijumlah. */
  foreignBeli: number
  foreignJual: number
}

interface BerkasOhlcvMentah {
  kode: string
  kolom: readonly string[]
  bar: (string | number)[][]
}

/** Indeks kolom tetap (lihat `kolom` di berkas): tanggal,unixdate,o,h,l,c,volume,value,freq,foreignbuy,foreignsell,… */
function keBaris(bar: (string | number)[]): BarisOhlcv {
  return {
    tanggal: bar[0] as string, buka: bar[2] as number, tutup: bar[5] as number,
    volume: bar[6] as number, nilai: bar[7] as number,
    foreignBeli: bar[9] as number, foreignJual: bar[10] as number,
  }
}

const cacheOhlcv = new Map<string, Promise<BarisOhlcv[] | null>>()

/** Muat + cache OHLCV satu emiten (modul-level — dipakai ulang antar kunjungan panel). */
export function muatOhlcv(kode: string): Promise<BarisOhlcv[] | null> {
  let p = cacheOhlcv.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/ohlcv_stockbit/${kode}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BerkasOhlcvMentah>) : null))
      .then((j) => (j ? j.bar.map(keBaris) : null))
    cacheOhlcv.set(kode, p)
  }
  return p
}

export function useOhlcvEmiten(kode: string) {
  const [bars, setBars] = useState<BarisOhlcv[] | null>(null)
  useEffect(() => {
    let batal = false
    setBars(null)
    muatOhlcv(kode).then((b) => { if (!batal) setBars(b) })
    return () => { batal = true }
  }, [kode])
  return bars
}

/** Iris OHLCV ke rentang tanggal (inklusif) — bahan VWAP & overlay harga. */
export function irisOhlcv(bars: BarisOhlcv[], dari: string, sampai: string): BarisOhlcv[] {
  return bars.filter((b) => b.tanggal >= dari && b.tanggal <= sampai)
}

/** VWAP pasar (Σ nilai ÷ Σ volume) sepanjang baris yang diberikan — acuan sumbu Kuadran. */
export function vwapRentang(bars: BarisOhlcv[]): number | null {
  let nilai = 0
  let volume = 0
  for (const b of bars) { nilai += b.nilai; volume += b.volume }
  return volume ? nilai / volume : null
}

export interface TitikKuadran {
  broker: string
  /** Harga rata-rata broker (beli+jual gabung) ÷ VWAP − 1, dalam persen. */
  deltaVwapPct: number
  netNilai: number
  grossNilai: number
  netLot: number
  grossLot: number
}

/**
 * Titik Kuadran: X = harga rata-rata broker vs VWAP (persen), Y = net value,
 * ukuran gelembung = nilai kotor (dua sisi) — definisi kita sendiri (belum
 * ada padanan Stockbit), lihat CLAUDE.md rancangan halaman. Broker tanpa
 * transaksi disaring; `vwap` null (OHLCV kosong) → larik kosong.
 */
export function titikKuadran(agg: AgregatBroker[], vwap: number | null): TitikKuadran[] {
  if (!vwap) return []
  const keluar: TitikKuadran[] = []
  for (const a of agg) {
    const grossLot = a.beliLot + a.jualLot
    const grossNilai = a.beliNilai + a.jualNilai
    if (!grossLot) continue
    const hargaBroker = grossNilai / (grossLot * 100)
    keluar.push({
      broker: a.broker, deltaVwapPct: (hargaBroker / vwap - 1) * 100,
      netNilai: a.netNilai, grossNilai, netLot: a.netLot, grossLot,
    })
  }
  return keluar
}

export type LabelKuadran =
  | 'Beli di Bawah VWAP' | 'Beli di Atas VWAP' | 'Jual di Bawah VWAP' | 'Jual di Atas VWAP'

/**
 * Label kuadran dari tanda X (harga broker vs VWAP) & Y (net value). Net 0
 * dihitung sisi beli (tak ada arus, bukan tanda negatif).
 *
 * REVISI 27 Agu 2026 (sapuan pengawas, sumbu ke-4): label lama spek §B.1
 * ('Akumulasi Cerdas'/'Jual Panik') mengklaim KEPINTARAN dan EMOSI dari data
 * yang cuma tahu beli/jual × posisi vs VWAP — klaim prediktif tanpa
 * BadgeRapor. Label sekarang menyebut sumbunya sendiri; tafsir (mengejar
 * harga, lego di harga bagus, dst.) pindah ke keterangan legenda, ditandai
 * sebagai tafsir umum bukan vonis.
 */
export function labelKuadran(t: { deltaVwapPct: number; netNilai: number }): LabelKuadran {
  if (t.netNilai >= 0) return t.deltaVwapPct < 0 ? 'Beli di Bawah VWAP' : 'Beli di Atas VWAP'
  return t.deltaVwapPct < 0 ? 'Jual di Bawah VWAP' : 'Jual di Atas VWAP'
}

export interface RingkasSB {
  /** Pembeli bersih, sudah terurut turun (agregatBroker sudah urut netNilai desc). */
  pembeli: AgregatBroker[]
  /** Penjual bersih, terurut dari yang paling negatif (Top 1 penjual). */
  penjual: AgregatBroker[]
  netVol: number
  netVal: number
  avg: number
  /** Σ netLot Top-n pembeli + Top-n penjual (gaya Stockbit: dua sisi sekaligus). */
  topLot: (n: number) => number
  topVal: (n: number) => number
}

/**
 * Baris ringkas "Pembeli − penjual" ala Stockbit (Top 1..5 + Average) — port
 * `renderRingkasSB()` di mockup, dari `AgregatBroker[]` murni (bukan DOM).
 */
export function ringkasSB(agg: AgregatBroker[]): RingkasSB {
  const pembeli = agg.filter((a) => a.netNilai > 0)
  const penjual = [...agg].filter((a) => a.netNilai < 0).sort((x, y) => x.netNilai - y.netNilai)
  const netVol = pembeli.reduce((s, a) => s + a.netLot, 0)
  const netVal = pembeli.reduce((s, a) => s + a.netNilai, 0)
  const avg = netVol ? netVal / (netVol * 100) : 0
  const topLot = (n: number) => pembeli.slice(0, n).reduce((s, a) => s + a.netLot, 0) + penjual.slice(0, n).reduce((s, a) => s + a.netLot, 0)
  const topVal = (n: number) => pembeli.slice(0, n).reduce((s, a) => s + a.netNilai, 0) + penjual.slice(0, n).reduce((s, a) => s + a.netNilai, 0)
  return { pembeli, penjual, netVol, netVal, avg, topLot, topVal }
}

/** N pembeli & penjual bersih terbesar (by |net|) — bahan chip warna tab
 *  Inventory. `ukuran` (§B.6 wiring) memilih rank by net value atau net lot —
 *  bawaan 'nilai' supaya pemanggil lama (tanpa argumen ketiga) tak berubah. */
export function pilihTopInventaris(
  agg: AgregatBroker[], n = 4, ukuran: 'nilai' | 'lot' = 'nilai',
): { pembeli: string[]; penjual: string[] } {
  const netOf = (a: AgregatBroker) => (ukuran === 'nilai' ? a.netNilai : a.netLot)
  const terurut = [...agg].sort((x, y) => netOf(y) - netOf(x))
  const pembeli = terurut.filter((a) => netOf(a) > 0).slice(0, n).map((a) => a.broker)
  const penjual = terurut.filter((a) => netOf(a) < 0).slice(-n).map((a) => a.broker).reverse()
  return { pembeli, penjual }
}

/** Cakupan yang tervalidasi — DIEKSPOR sebagai SATU-SATUNYA rumah angka
 *  tahun awal broker (audit kesegaran 27 Agu: "sejak 2020" pernah disalin
 *  manual di 7 tempat). Riwayat: 2025 -> 2020 (26 Agu), lalu -> 2016
 *  (ketetapan Johan 27 Agu "gpp sampai 2016"; backfill 2016-2019 selesai,
 *  2016 terukur 100,00% hari, uji manual cocok arsip mentah). */
export const TAHUN_AWAL = 2016

/** true bila tanggal ISO berada SEBELUM cakupan broker — dipakai halaman
 *  chart panjang (candle sejak IPO) untuk peringatan Johan 27 Agu: "kurang
 *  dari tahun itu diberi peringatan jika data broker tidak tersedia". */
export function praBroker(tanggalIso: string | null | undefined): boolean {
  return !!tanggalIso && tanggalIso < `${TAHUN_AWAL}-01-01`
}

/** Kalimat peringatan SERAGAM — satu ejaan untuk semua halaman. */
export const PERINGATAN_PRA_BROKER =
  `Rincian broker belum tersedia sebelum ${TAHUN_AWAL} — grafik harga tetap lengkap, lapisan/panel broker hanya mencakup ${TAHUN_AWAL} ke sini.`

/** Bagian murni (testable) dari `tahunTersedia` — pisah dari fetch supaya diuji tanpa mock jaringan. */
export function saringTahunAwal(semua: number[]): { tahun: number[] | null; tutup: boolean } {
  const dipakai = semua.filter((t) => t >= TAHUN_AWAL)
  return { tahun: dipakai.length ? dipakai : null, tutup: semua.length > 0 && dipakai.length === 0 }
}

/**
 * Tahun-tahun (>= TAHUN_AWAL) yang punya berkas broker per emiten untuk
 * `kode`, atau `null` kalau tak ada satu pun tahun terpakai. `tutup` menandai
 * kasus KHUSUS: berkasnya ADA tapi seluruh isinya tahun lama yang sedang
 * ditutup (bukan "belum pernah dipanen sama sekali") — dipakai untuk pesan
 * yang lebih tepat ke pembaca.
 */
async function tahunTersedia(kode: string): Promise<{ tahun: number[] | null; tutup: boolean }> {
  const r = await fetch(`/data-idx/json/broker_tahunan/${kode}/index.json`)
  // Server dev/statis di sini membalas 200 + index.html (fallback SPA) untuk
  // berkas yang TIDAK ada, bukan 404 — `r.ok` saja lolos untuk kode yang
  // belum dipanen, lalu `r.json()` gagal parse `<!DOCTYPE …` dengan pesan
  // teknis yang bocor ke layar. Content-type asli JSON `application/json`,
  // fallback-nya `text/html` — itu pembeda yang benar, bukan status code.
  if (!r.ok || !r.headers.get('content-type')?.includes('json')) return { tahun: null, tutup: false }
  const j = (await r.json()) as { tahun: number[] }
  return saringTahunAwal(j.tahun ?? [])
}

/**
 * Muat SELURUH riwayat broker satu emiten sekali per pergantian kode (bukan
 * per pergantian rentang) — geser rentang di halaman lalu tinggal MENYARING
 * larik ini di klien, bukan fetch ulang. Reuse penuh `muatRentang()`
 * (brokerEmiten.ts) supaya logika ambil-per-tahun tak ditulis dua kali.
 */
export function useArusBrokerEmiten(kode: string) {
  const [hari, setHari] = useState<Array<[string, HariBroker]> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let batal = false
    setLoading(true)
    setError(null)
    setHari(null)
    tahunTersedia(kode)
      .then(({ tahun, tutup }) => {
        if (!tahun) {
          throw new Error(
            tutup
              ? `Data ${kode} sejak ${TAHUN_AWAL} belum lengkap — arsipnya masih dalam proses pengumpulan.`
              : `${kode} belum punya arsip broker per emiten`,
          )
        }
        return muatRentang(kode, `${Math.min(...tahun)}-01-01`, `${Math.max(...tahun)}-12-31`)
      })
      .then((h) => { if (!batal) setHari(h) })
      .catch((e: unknown) => { if (!batal) setError(pesanGalat(e, 'Gagal memuat data broker')) })
      .finally(() => { if (!batal) setLoading(false) })
    return () => { batal = true }
  }, [kode])

  return { hari: hari ?? [], loading, error }
}

// ── Tab "Overview" — Broker Analysis per kelompok ───────────────────────────

const URUTAN_KELOMPOK: KelompokBroker[] = ['asing', 'bumn', 'smart', 'ritel', 'afiliasi', 'lain']

export interface BarisAnalisaKelompok {
  id: KelompokBroker
  label: string
  ket: string
  net: number
  jumlahBroker: number
  /** Deret net harian (searah `hari`) — bahan sparkline. */
  harian: number[]
}

/**
 * Port `renderAnalisis()` mockup — net PER KELOMPOK (selalu net, tak terikat
 * toggle Mode Net/Gross — sama seperti mockup, yang membaca `agg[key]`
 * langsung, bukan `tabelDuaSisi`), ukuran ikut toggle Nilai/Lot.
 */
export function analisaKelompok(
  hari: Array<[string, HariBroker]>, agg: AgregatBroker[], ukuran: 'nilai' | 'lot',
): BarisAnalisaKelompok[] {
  const grup: Record<KelompokBroker, AgregatBroker[]> = { asing: [], bumn: [], smart: [], ritel: [], afiliasi: [], lain: [] }
  for (const a of agg) grup[kelompokBroker(a.broker)].push(a)
  return URUTAN_KELOMPOK.map((id) => {
    const net = grup[id].reduce((s, a) => s + (ukuran === 'nilai' ? a.netNilai : a.netLot), 0)
    const harian = hari.map(([, h]) => {
      let v = 0
      for (const r of h.broker) {
        if (kelompokBroker(r[0]) !== id) continue
        v += ukuran === 'nilai' ? r[2] - r[4] : r[1] - r[3]
      }
      return v
    })
    return { id, label: LABEL_KELOMPOK[id], ket: KETERANGAN_KELOMPOK[id], net, jumlahBroker: grup[id].length, harian }
  })
}

// ── Tab "Flow Net vs Gross" — Market Flow Conviction ────────────────────────

export interface TitikKonviksi {
  tanggal: string
  kotor: number
  net: number
  /** net ÷ kotor × 100 — tinggi = arus searah, rendah = bolak-balik intraday. */
  konviksi: number
}

/** Port `renderConviction()` mockup — net handover = Σ net POSITIF per broker
 *  sehari. `ukuran` (§B.6 wiring) pilih kolom nilai (idx 2/4) atau lot (idx
 *  1/3) — bawaan 'nilai' supaya pemanggil lama tak berubah. */
export function convictionHarian(hari: Array<[string, HariBroker]>, ukuran: 'nilai' | 'lot' = 'nilai'): TitikKonviksi[] {
  const ambilBeli = (r: BarisBroker) => (ukuran === 'nilai' ? r[2] : r[1])
  const ambilJual = (r: BarisBroker) => (ukuran === 'nilai' ? r[4] : r[3])
  return hari.map(([tanggal, h]) => {
    const kotor = h.broker.reduce((s, r) => s + ambilBeli(r), 0)
    const net = h.broker.reduce((s, r) => s + Math.max(0, ambilBeli(r) - ambilJual(r)), 0)
    return { tanggal, kotor, net, konviksi: kotor ? (net / kotor) * 100 : 0 }
  })
}

// ── Tab "vs IHSG" ────────────────────────────────────────────────────────────

function statistik(xs: number[]): { mu: number; sd: number } {
  const n = xs.length
  const mu = xs.reduce((a, b) => a + b, 0) / n
  const v = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)
  return { mu, sd: Math.sqrt(v) }
}
const returnHarian = (xs: number[]) => xs.slice(1).map((v, i) => v / xs[i] - 1)

export interface RegresiVsIhsg {
  tgl: string[]
  rebasedSaham: number[]
  rebasedIhsg: number[]
  n: number
  beta: number
  korelasi: number
  rSquared: number
  alpha: number
  returnSaham: number
  returnIhsg: number
  winRateHarian: number
  volatilitasSaham: number
  volatilitasIhsg: number
}

/**
 * Port `deretVs()` + `renderVsIHSG()` mockup — regresi return harian saham vs
 * IHSG atas `n` hari bursa TERAKHIR yang beririsan di kedua deret (irisan
 * tanggal, bukan asumsi kalender sama). null kalau irisannya < 3 hari.
 */
export function regresiVsIhsg(saham: BarisOhlcv[], ihsg: BarisOhlcv[], n: number): RegresiVsIhsg | null {
  const petaIhsg = new Map(ihsg.map((b) => [b.tanggal, b.tutup]))
  const pasangan = saham.filter((b) => petaIhsg.has(b.tanggal)).slice(-n)
  const m = pasangan.length
  if (m < 3) return null
  const s = pasangan.map((b) => b.tutup)
  const im = pasangan.map((b) => petaIhsg.get(b.tanggal)!)
  const rebasedSaham = s.map((v) => (v / s[0]) * 100)
  const rebasedIhsg = im.map((v) => (v / im[0]) * 100)
  const r1 = returnHarian(s), r2 = returnHarian(im)
  const st1 = statistik(r1), st2 = statistik(r2)
  let cov = 0
  for (let i = 0; i < r1.length; i++) cov += (r1[i] - st1.mu) * (r2[i] - st2.mu)
  cov /= r1.length - 1
  const beta = cov / st2.sd ** 2
  const korelasi = cov / (st1.sd * st2.sd)
  const returnSaham = (s[m - 1] / s[0] - 1) * 100
  const returnIhsg = (im[m - 1] / im[0] - 1) * 100
  const winRateHarian = (r1.filter((v, i) => v > r2[i]).length / r1.length) * 100
  return {
    tgl: pasangan.map((b) => b.tanggal), rebasedSaham, rebasedIhsg, n: m,
    beta, korelasi, rSquared: korelasi * korelasi, alpha: returnSaham - beta * returnIhsg,
    returnSaham, returnIhsg, winRateHarian,
    volatilitasSaham: st1.sd * Math.sqrt(252) * 100, volatilitasIhsg: st2.sd * Math.sqrt(252) * 100,
  }
}

// ── Tab "Timeline Foreign" ───────────────────────────────────────────────────

export interface TimelineForeign {
  tgl: string[]
  kumulatifRp: number[]
  tutup: number[]
  /** Net asing kumulatif SELURUH rentang terpilih — akhir `kumulatifRp`,
   * jadi otomatis ikut tombol 3 Bulan/6 Bulan/YTD (dulu dua chip terpisah
   * berjendela TETAP 126/20 hari, tak berubah walau tombol rentang ditekan —
   * label bilang "ikut rentang", angkanya tidak. Lihat CLAUDE.md #187 TUGAS 2). */
  netRentang: number
}

/**
 * Net asing RUPIAH LANGSUNG dari `foreignbuy`/`foreignsell` OHLCV (bukan
 * taksiran lembar×harga — itu yang di mockup ditulis "miring +33%
 * kumulatif" makanya sumbunya lembar; sumber ini beda, rupiahnya asli dari
 * Stockbit/IDX, jadi aman dipakai apa adanya).
 */
export function timelineForeign(bars: BarisOhlcv[], n: number): TimelineForeign | null {
  if (bars.length === 0) return null
  const sel = bars.slice(-n)
  let akum = 0
  const kumulatifRp = sel.map((b) => { akum += b.foreignBeli - b.foreignJual; return akum })
  return { tgl: sel.map((b) => b.tanggal), kumulatifRp, tutup: sel.map((b) => b.tutup), netRentang: akum }
}

// ── Tab "NEGO" — pola berlawanan vs reguler (§B.2) ──────────────────────────

export type KelasPolaNego = 'berlawanan' | 'searah'

export interface PolaNegoBaris {
  tanggal: string
  broker: string
  negoBeliLot: number
  negoBeliNilai: number
  negoJualLot: number
  negoJualNilai: number
  /** Net reguler broker itu, hari yang sama — acuan silang. */
  regNetNilai: number
  kelas: KelasPolaNego
  /** Label Indonesia siap-tayang. */
  pola: string
}

/**
 * Silangkan nego vs reguler PER BROKER PER HARI (§B.2 spek C2): broker yang
 * BELI di nego sementara net JUAL di reguler (atau sebaliknya) = pola
 * berlawanan — kandidat distribusi/akumulasi terselubung lewat pasar
 * negosiasi. Hanya hari yang punya varian nego (`h.nego`) yang diproses;
 * broker nego tanpa padanan baris reguler hari itu dianggap net reguler 0.
 */
export function polaNegoBroker(hari: Array<[string, HariBroker]>): PolaNegoBaris[] {
  const keluar: PolaNegoBaris[] = []
  for (const [tanggal, h] of hari) {
    if (!h.nego) continue
    const regNet = new Map(h.broker.map((r) => [r[0], r[2] - r[4]]))
    for (const r of h.nego.broker) {
      const [broker, negoBeliLot, negoBeliNilai, negoJualLot, negoJualNilai] = r
      const regNetNilai = regNet.get(broker) ?? 0
      let kelas: KelasPolaNego = 'searah'
      let pola = 'Searah'
      if (negoBeliNilai > 0 && regNetNilai < 0) { kelas = 'berlawanan'; pola = 'Nego Beli → Reg Jual' }
      else if (negoJualNilai > 0 && regNetNilai > 0) { kelas = 'berlawanan'; pola = 'Nego Jual → Reg Beli' }
      keluar.push({ tanggal, broker, negoBeliLot, negoBeliNilai, negoJualLot, negoJualNilai, regNetNilai, kelas, pola })
    }
  }
  return keluar
}

// ── Overview — Konsensus per kategori perilaku (§B.3) ───────────────────────

export interface KonsensusKategori {
  id: KategoriBroker
  label: string
  nBeli: number
  nJual: number
  netGabungan: number
  /** Berapa dari `dariHari` hari terakhir net kategori ini searah tanda
   *  `netGabungan` seluruh rentang — bukan berjendela sendiri. */
  konsistensi: number
  dariHari: number
}

const URUTAN_KATEGORI: KategoriBroker[] = ['whale', 'smart', 'smart_ritel', 'ritel']

/**
 * Konsensus 4 kategori perilaku (whale/smart/smart_ritel/ritel,
 * `kategoriBroker.ts`) atas rentang aktif — n broker net-beli vs net-jual,
 * net gabungan, dan konsistensi n/5 hari terakhir. `daftar` null (kategori
 * belum termuat) → tiap kategori kosong (n 0, bukan galat).
 */
export function konsensusKategori(
  hari: Array<[string, HariBroker]>, agg: AgregatBroker[], daftar: DaftarKategoriBroker | null,
): KonsensusKategori[] {
  return URUTAN_KATEGORI.map((id) => {
    const anggota = new Set(
      daftar ? Object.entries(daftar.broker).filter(([, p]) => p.kategori === id).map(([kode]) => kode) : [],
    )
    let nBeli = 0, nJual = 0, netGabungan = 0
    for (const a of agg) {
      if (!anggota.has(a.broker)) continue
      netGabungan += a.netNilai
      if (a.netNilai > 0) nBeli++
      else if (a.netNilai < 0) nJual++
    }
    const tanda = Math.sign(netGabungan)
    const terakhir = hari.slice(-5)
    let konsistensi = 0
    if (tanda !== 0) {
      for (const [, h] of terakhir) {
        let netHari = 0
        for (const r of h.broker) { if (anggota.has(r[0])) netHari += r[2] - r[4] }
        if (Math.sign(netHari) === tanda) konsistensi++
      }
    }
    return { id, label: LABEL_KATEGORI[id], nBeli, nJual, netGabungan, konsistensi, dariHari: terakhir.length }
  })
}
