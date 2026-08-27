import type { BarisOhlc } from './ihsgOhlc'

/**
 * Watchlist sebagai indeks (spek §E) — anggota watchlist digabung jadi satu
 * indeks harian dua bobot: Setara (rata-rata return harian anggota) dan
 * Kap. pasar. Murni dari `ohlc/<KODE>.json` anggota + `ohlc/IHSG.json` yang
 * SUDAH difetch halaman Watchlist (fetchDeret, cache modul) — tak ada
 * unduhan tambahan untuk perhitungan ini sendiri.
 *
 * DEVIASI DARI SPEK — dicatat, bukan didiamkan (kejujuran inventaris,
 * CLAUDE.md): spek §E.2 menyebut "bobot market_cap dari screener.json", tapi
 * `screener.json` TIDAK punya ruas itu (diperiksa `bangun-screener.mjs` —
 * hanya `harga/rvol10/nilai/likuiditas/...`, tak ada `market_cap`). Dipakai
 * `harga × saham` (saham = ListedShares resmi bursa, `daftar_emiten.json`,
 * lihat `fetchSahamMap`) — BUKAN `fundamental/<KODE>.json.market_cap`
 * (turunan `sharesOutstanding` Yahoo, terbukti basi 51 emiten termasuk BBNI
 * 578jt vs resmi 36,92 M — lihat CLAUDE.md "Jumlah saham diambil dari BURSA").
 */

export interface AnggotaIndeks {
  kode: string
  /** Riwayat penuh (BarisOhlc dari ohlc/<KODE>.json), urut tanggal naik. */
  bars: BarisOhlc[]
  /** Lembar saham beredar (daftar_emiten.json) — null = tak tersedia, bobot
   *  Kap.pasar untuk anggota ini jatuh ke rata-rata anggota yang punya. */
  saham: number | null
}

export interface MetrikIndeks {
  /** Persen, sepanjang jendela terpilih. */
  totalReturn: number
  /** totalReturn indeks − totalReturn IHSG, persen. */
  vsIhsg: number
  /** σ return harian × √252, persen. */
  volatilitas: number
  /** Penurunan puncak-ke-lembah terbesar, persen (≤ 0). */
  maxDrawdown: number
  /** % hari return indeks > return IHSG. */
  winRateHarian: number
  /** Jumlah hari bursa yang dibandingkan (n return harian, bukan n harga). */
  nHari: number
}

export interface HasilIndeksWatchlist {
  tgl: string[]
  /** Rebased 100 di tgl[0]. */
  rebasedSetara: number[]
  rebasedKap: number[]
  rebasedIhsg: number[]
  /** Garis tipis tiap anggota, rebased 100 di tgl[0] juga. */
  rebasedAnggota: { kode: string; nilai: number[] }[]
  metrikSetara: MetrikIndeks
  metrikKap: MetrikIndeks
  /** Kode anggota tanpa data saham — bobot Kap.pasar-nya jatuh ke rata-rata,
   *  disebut jujur di layar (spek §E.2). */
  tanpaKap: string[]
}

/**
 * Tanggal yang dipunyai SEMUA anggota (irisan penuh) + IHSG, urut kalender
 * IHSG. Watchlist yang punya anggota IPO baru akan mempersempit jendela ini
 * ke sejak listing termuda — itu batas jujur, bukan bug (disebut di layar).
 */
export function tanggalUmumWatchlist(anggota: AnggotaIndeks[], ihsg: BarisOhlc[]): string[] {
  const valid = anggota.filter((a) => a.bars.length > 0)
  if (valid.length === 0) return []
  const petaAnggota = valid.map((a) => new Map(a.bars.map((b) => [b[0], b[4]] as const)))
  return ihsg.map((b) => b[0]).filter((t) => petaAnggota.every((m) => m.has(t)))
}

function statistikSd(xs: number[]): number {
  if (xs.length < 2) return 0
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length
  const v = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

function rebase100(harga: number[]): number[] {
  const h0 = harga[0]
  return harga.map((h) => (h / h0) * 100)
}

/** Penurunan puncak-ke-lembah terbesar dari deret rebased (mulai 100). */
function maxDrawdown(rebased: number[]): number {
  let peak = rebased[0]
  let dd = 0
  for (const v of rebased) {
    if (v > peak) peak = v
    dd = Math.min(dd, (v / peak - 1) * 100)
  }
  return dd
}

function hitungMetrik(
  rebased: number[], returnHarian: number[], returnIhsgHarian: number[], returnIhsgTotal: number,
): MetrikIndeks {
  const totalReturn = rebased[rebased.length - 1] - 100
  const win = returnHarian.filter((v, i) => v > returnIhsgHarian[i]).length
  return {
    totalReturn,
    vsIhsg: totalReturn - returnIhsgTotal,
    volatilitas: statistikSd(returnHarian) * Math.sqrt(252) * 100,
    maxDrawdown: maxDrawdown(rebased),
    winRateHarian: returnHarian.length ? (win / returnHarian.length) * 100 : 0,
    nHari: returnHarian.length,
  }
}

/**
 * Bangun indeks Setara & Kap.pasar dari anggota watchlist atas jendela
 * `tanggal` (sudah diiris rentang oleh pemanggil, mis. `potongRentang` dari
 * `rentang.ts` atas hasil `tanggalUmumWatchlist`). null kalau anggotanya
 * kosong atau jendelanya < 3 hari (irisan return butuh minimal 2 return).
 */
export function hitungIndeksWatchlist(
  anggota: AnggotaIndeks[], ihsg: BarisOhlc[], tanggal: string[],
): HasilIndeksWatchlist | null {
  const valid = anggota.filter((a) => a.bars.length > 0)
  if (valid.length === 0 || tanggal.length < 3) return null

  const petaAnggota = valid.map((a) => new Map(a.bars.map((b) => [b[0], b[4]] as const)))
  const petaIhsg = new Map(ihsg.map((b) => [b[0], b[4]] as const))
  // `tanggal` semestinya sudah irisan penuh (tanggalUmumWatchlist), tapi
  // divalidasi ulang di sini — pemanggil yang lupa mengiris tak boleh
  // diam-diam mendapat harga `undefined` di tengah perhitungan.
  for (const t of tanggal) {
    if (!petaIhsg.has(t) || petaAnggota.some((m) => !m.has(t))) return null
  }

  const hargaIhsg = tanggal.map((t) => petaIhsg.get(t)!)
  const hargaAnggota = petaAnggota.map((m) => tanggal.map((t) => m.get(t)!))

  const returnAnggota = hargaAnggota.map((h) => h.slice(1).map((v, i) => v / h[i] - 1))
  const returnIhsgHarian = hargaIhsg.slice(1).map((v, i) => v / hargaIhsg[i] - 1)

  // Bobot Kap.pasar = harga di AWAL jendela × saham (bobot tetap sepanjang
  // jendela, pola indeks standar — bukan direbalans harian). Anggota tanpa
  // `saham` jatuh ke rata-rata bobot anggota yang punya ("bobot setara").
  const capMentah = valid.map((a, i) => (a.saham != null ? a.saham * hargaAnggota[i][0] : null))
  const capDiketahui = capMentah.filter((c): c is number => c != null)
  const rataCap = capDiketahui.length > 0 ? capDiketahui.reduce((a, b) => a + b, 0) / capDiketahui.length : 1
  const bobotKap = capMentah.map((c) => c ?? rataCap)
  const tanpaKap = valid.filter((a) => a.saham == null).map((a) => a.kode)

  const nReturn = tanggal.length - 1
  const returnSetara: number[] = []
  const returnKap: number[] = []
  for (let t = 0; t < nReturn; t++) {
    let sSetara = 0
    let sKapAtas = 0
    let sKapBawah = 0
    for (let i = 0; i < valid.length; i++) {
      sSetara += returnAnggota[i][t]
      sKapAtas += bobotKap[i] * returnAnggota[i][t]
      sKapBawah += bobotKap[i]
    }
    returnSetara.push(sSetara / valid.length)
    returnKap.push(sKapBawah > 0 ? sKapAtas / sKapBawah : sSetara / valid.length)
  }

  const rebasedSetara = [100]
  const rebasedKap = [100]
  for (let t = 0; t < nReturn; t++) {
    rebasedSetara.push(rebasedSetara[t] * (1 + returnSetara[t]))
    rebasedKap.push(rebasedKap[t] * (1 + returnKap[t]))
  }
  const rebasedIhsg = rebase100(hargaIhsg)
  const rebasedAnggota = valid.map((a, i) => ({ kode: a.kode, nilai: rebase100(hargaAnggota[i]) }))
  const returnIhsgTotal = rebasedIhsg[rebasedIhsg.length - 1] - 100

  return {
    tgl: tanggal, rebasedSetara, rebasedKap, rebasedIhsg, rebasedAnggota,
    metrikSetara: hitungMetrik(rebasedSetara, returnSetara, returnIhsgHarian, returnIhsgTotal),
    metrikKap: hitungMetrik(rebasedKap, returnKap, returnIhsgHarian, returnIhsgTotal),
    tanpaKap,
  }
}

// ── Bobot Kap.pasar: lembar saham beredar ───────────────────────────────────

interface DaftarEmitenMentah {
  emiten?: { kode: string; saham?: number }[]
}

let sahamPromise: Promise<Record<string, number>> | null = null

/** kode -> lembar saham beredar (`daftar_emiten.json`, ListedShares resmi
 *  bursa — lihat catatan deviasi di kepala berkas). Cache modul: satu fetch
 *  per sesi, dipakai ulang tiap kali tab Kinerja dibuka. */
export function fetchSahamMap(): Promise<Record<string, number>> {
  if (!sahamPromise) {
    sahamPromise = fetch('/data-idx/json/daftar_emiten.json')
      .then((r) => (r.ok ? (r.json() as Promise<DaftarEmitenMentah>) : Promise.resolve({ emiten: [] })))
      .then((j) => Object.fromEntries(
        (j.emiten ?? []).filter((e): e is { kode: string; saham: number } => typeof e.saham === 'number')
          .map((e) => [e.kode, e.saham]),
      ))
      .catch(() => ({}))
  }
  return sahamPromise
}

// ── Top Broker chip (kolom tabel) ───────────────────────────────────────────

export interface NetBroker {
  kode: string
  net: number
}

export interface TopBrokerHarian {
  tanggal: string
  /** 3 net BELI terbesar, urut besar -> kecil. */
  beli: NetBroker[]
  /** 3 net JUAL terbesar (magnitude), urut besar -> kecil. */
  jual: NetBroker[]
}

interface BrokerHarianMentah {
  hari: Record<string, { broker: [string, number, number, number, number][] }>
}

const cacheTopBroker = new Map<string, Promise<TopBrokerHarian | null>>()

/**
 * 3 chip beli + 3 chip jual net terbesar (rupiah) hari terakhir dari
 * `broker_harian/<KODE>.json` — net = beli_nilai − jual_nilai per broker.
 * Cache modul per kode, `null` dicache untuk 404/emiten tanpa berkas broker.
 */
export function fetchTopBrokerHarian(kode: string): Promise<TopBrokerHarian | null> {
  let p = cacheTopBroker.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/broker_harian/${kode}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BrokerHarianMentah>) : null))
      .then((j) => {
        if (!j) return null
        const tanggalTerakhir = Object.keys(j.hari).sort().at(-1)
        if (!tanggalTerakhir) return null
        const net: NetBroker[] = j.hari[tanggalTerakhir].broker
          .map(([brokerKode, , beliNilai, , jualNilai]) => ({ kode: brokerKode, net: beliNilai - jualNilai }))
          .sort((a, b) => b.net - a.net)
        return {
          tanggal: tanggalTerakhir,
          beli: net.filter((b) => b.net > 0).slice(0, 3),
          jual: net.filter((b) => b.net < 0).slice(-3).reverse(),
        }
      })
      .catch(() => null)
    cacheTopBroker.set(kode, p)
  }
  return p
}
