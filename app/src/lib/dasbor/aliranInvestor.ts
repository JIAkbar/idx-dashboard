import { useEffect, useState } from 'react'
import { LABEL_RENTANG } from './periode'

/**
 * Aliran investor asing vs domestik di tingkat PASAR — B36.
 *
 * Johan 21 Agu 2026 menaruh tangkapan layar "Investor Chart" RTI Business di
 * `data ide/` lalu meminta: *"B36 kerjakan, bangun agregasi FBuy/FSell nya"*.
 *
 * Berkasnya dibangun `scripts/bangun_aliran_investor.py` dari arsip mentah
 * `GetStockSummary` (nol jaringan; 1.595 tanggal sejak 2020). Rumus, bukti
 * kalibrasi, dan alasan tiap keputusan ada di kepala skrip itu — yang di sini
 * cuma pembacaan dan penjumlahan per periode.
 *
 * ## Tiga tingkat kepastian, dan panel WAJIB membedakannya
 *
 * Ini inti berkas ini, bukan detailnya:
 *
 * 1. **Volume (lembar) — NYATA.** `ForeignBuy`/`ForeignSell` dilaporkan IDX
 *    per emiten dalam lembar. Domestik = sisanya.
 * 2. **Nilai (rupiah) — TAKSIRAN, dan galatnya MIRING.** IDX tak melaporkan
 *    aliran asing dalam rupiah sama sekali. Taksirannya lembar × harga
 *    rata-rata emiten itu. Diukur atas 138 hari berangka resmi: arah cocok
 *    91%, median harian 0,94× — tapi dijumlah, kumulatifnya 1,33×. Karena
 *    itu NET periode dilaporkan dari angka RESMI kalau tersedia, dan
 *    taksiran menyisakan tugasnya yang tak tergantikan: BELAHAN beli/jual.
 * 3. **Frekuensi — TAK ADA belahannya.** Yang tersedia cuma totalnya, dan
 *    panel mengatakannya. Menaksir belahan frekuensi berarti mengarang.
 *
 * ## Pasar reguler vs non-reguler
 *
 * IDX melaporkan dua pasar terpisah di baris yang sama, dan belahan asingnya
 * HANYA ada untuk pasar reguler. Contoh 20 Agu 2026: GOTO menyilangkan 41,4
 * miliar lembar di pasar negosiasi — 55% seluruh volume papan hari itu —
 * tanpa satu pun keterangan siapa pembelinya. Karena itu belahan
 * asing/domestik di sini SELALU berbasis pasar reguler, dan porsi
 * non-regulernya dicetak terpisah supaya pembaca tahu berapa yang tak
 * terjawab.
 */

/** Satu tanggal, urut ruas seperti di berkasnya. */
export type BarisAliran = [
  tanggal: string, emiten: number,
  rgVol: number, rgVal: number, rgFrek: number,
  nrVol: number, nrVal: number, nrFrek: number,
  fBeli: number, fJual: number, fBeliRp: number, fJualRp: number,
  /** Net asing RESMI IDX, MILIAR rupiah. `null` = tanggal itu tak punya
   *  berkas harian (arsip kita mulai 2020, berkas harian 2026). */
  nfResmi: number | null,
]

export interface BerkasAliran {
  mulai: string | null
  akhir: string | null
  n: number
  d: BarisAliran[]
}

export function useAliranInvestor(): BerkasAliran | null {
  const [data, setData] = useState<BerkasAliran | null>(null)
  useEffect(() => {
    let batal = false
    fetch('/data-idx/json/aliran_investor.json')
      .then((r) => r.json())
      .then((j: BerkasAliran) => { if (!batal) setData(j) })
      .catch(() => {}) // panel tak tampil; halaman lain tak terganggu
    return () => { batal = true }
  }, [])
  return data
}

/** Kunci rentang KANONIS (`LABEL_RENTANG`), bukan ejaan sendiri — aturan
 *  #170, yang lahir setelah satu kendali yang sama tumbuh sembilan bentuk. */
export type IdPeriodeAliran = 'h1' | 'h5' | 'b1' | 'b3' | 'b6' | 'ytd' | 'y1' | 'y3' | 'y5'

export const PERIODE_ALIRAN: Array<{ id: IdPeriodeAliran; label: string }> =
  (['h1', 'h5', 'b1', 'b3', 'b6', 'ytd', 'y1', 'y3', 'y5'] as const)
    .map((id) => ({ id, label: LABEL_RENTANG[id] }))

/** Baris yang masuk periode `id`, dihitung mundur dari baris TERAKHIR.
 *
 *  `1D`/`5D` dihitung dalam hari BURSA (sepekan perdagangan memang lima hari
 *  bursa); sisanya dalam bulan KALENDER, karena pembaca yang membaca
 *  "3 Bulan" berharap tiga bulan kalender dan jumlah hari bursa per bulan tak
 *  pernah tetap. Pemisahan yang sama dipakai `diaryPasar.ts`. */
export function irisPeriode(d: BarisAliran[], id: IdPeriodeAliran): BarisAliran[] {
  if (d.length === 0) return []
  if (id === 'h1') return d.slice(-1)
  if (id === 'h5') return d.slice(-5)
  const akhir = d[d.length - 1][0]
  let batas: string
  if (id === 'ytd') {
    batas = `${akhir.slice(0, 4)}-01-01`
  } else {
    const bulan = { b1: 1, b3: 3, b6: 6, y1: 12, y3: 36, y5: 60 }[id]
    const t = new Date(`${akhir}T00:00:00Z`)
    t.setUTCMonth(t.getUTCMonth() - bulan)
    batas = t.toISOString().slice(0, 10)
  }
  return d.filter((r) => r[0] >= batas)
}

/** Satu sisi (beli atau jual) satu kelompok investor. */
export interface SisiAliran {
  nilai: number
  /** Porsi terhadap SELURUH sisi (beli + jual), persen.
   *
   *  Penyebutnya 2× total, bukan total — tiap transaksi punya pembeli DAN
   *  penjual, jadi sisi beli menjumlah 50% dan sisi jual 50%. Itu juga
   *  konvensi panel RTI yang jadi acuan: FBuy 28,03% + DBuy 21,97% = 50,00%. */
  persen: number
}

export interface KelompokAliran {
  /** Total pasar reguler untuk ukuran ini. */
  total: number
  fBeli: SisiAliran
  fJual: SisiAliran
  dBeli: SisiAliran
  dJual: SisiAliran
  /** Net asing (beli − jual). */
  net: number
}

export interface RingkasAliran {
  mulai: string
  akhir: string
  hari: number
  /** Volume, lembar — NYATA. */
  volume: KelompokAliran
  /** Nilai, rupiah — sisi asingnya TAKSIRAN. */
  nilai: KelompokAliran
  /** Frekuensi pasar reguler, kali. Tak punya belahan asing/domestik. */
  frekuensi: number
  /** Net asing RESMI IDX sepanjang periode, RUPIAH — `null` kalau ada satu
   *  saja hari tanpa angka resmi. Sengaja tak menambal yang bolong dengan
   *  taksiran: jumlah setengah-resmi lebih menyesatkan daripada tak ada. */
  netResmi: number | null
  /** Berapa hari di periode ini yang tak punya angka resmi. */
  hariTanpaResmi: number
  /** Porsi pasar NON-REGULER terhadap seluruh volume papan, persen — bagian
   *  yang belahan asingnya memang tak dilaporkan siapa pun. */
  nonRegulerPersen: number
  nonRegulerVol: number
}

function kelompok(total: number, fBeli: number, fJual: number): KelompokAliran {
  const dua = total * 2
  const bagi = (v: number) => (dua > 0 ? (v / dua) * 100 : 0)
  // Domestik = sisa pasar reguler. Bukan ruas tersendiri dari IDX, dan itu
  // memang definisinya: yang bukan asing adalah domestik.
  const dBeli = Math.max(total - fBeli, 0)
  const dJual = Math.max(total - fJual, 0)
  return {
    total,
    fBeli: { nilai: fBeli, persen: bagi(fBeli) },
    fJual: { nilai: fJual, persen: bagi(fJual) },
    dBeli: { nilai: dBeli, persen: bagi(dBeli) },
    dJual: { nilai: dJual, persen: bagi(dJual) },
    net: fBeli - fJual,
  }
}

/** Jumlahkan satu periode jadi satu ringkasan siap tampil. */
export function ringkasAliran(baris: BarisAliran[]): RingkasAliran | null {
  if (baris.length === 0) return null
  let rgVol = 0, rgVal = 0, rgFrek = 0, nrVol = 0
  let fBeli = 0, fJual = 0, fBeliRp = 0, fJualRp = 0
  let resmi = 0, tanpaResmi = 0
  for (const r of baris) {
    rgVol += r[2]; rgVal += r[3]; rgFrek += r[4]; nrVol += r[5]
    fBeli += r[8]; fJual += r[9]; fBeliRp += r[10]; fJualRp += r[11]
    // Berkas menyimpannya dalam MILIAR rupiah (satuan berkas harian IDX);
    // dinaikkan ke rupiah di sini supaya seluruh panel bicara satu satuan.
    if (r[12] === null || r[12] === undefined) tanpaResmi++
    else resmi += r[12] * 1e9
  }
  if (rgVol <= 0) return null
  const papan = rgVol + nrVol
  return {
    mulai: baris[0][0],
    akhir: baris[baris.length - 1][0],
    hari: baris.length,
    volume: kelompok(rgVol, fBeli, fJual),
    nilai: kelompok(rgVal, fBeliRp, fJualRp),
    frekuensi: rgFrek,
    netResmi: tanpaResmi === 0 ? resmi : null,
    hariTanpaResmi: tanpaResmi,
    nonRegulerVol: nrVol,
    nonRegulerPersen: papan > 0 ? (nrVol / papan) * 100 : 0,
  }
}
