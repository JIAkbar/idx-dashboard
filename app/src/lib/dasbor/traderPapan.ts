/**
 * Trader Papan — logika MURNI posisi broker (tanpa DOM, tanpa React).
 *
 * Bentuknya dipetik dari tab Inventory/Accumulation tradersaham.com (audit
 * `docs/riset/tradersaham-bongkar.md`): untuk satu emiten dalam satu rentang,
 * tiap broker punya harga rata-rata, harga terendah tempat ia menampung,
 * berapa lama ia menampung, dan untung/rugi mengambang terhadap harga
 * terakhir. Datanya milik kita sendiri — arsip broker harian yang sudah
 * dipanen, sumber yang sama dengan [[whalesPapan]].
 *
 * ## Bedanya dengan Whales Papan, dan kenapa keduanya ada
 *
 * Whales Papan bertanya "di rentang HARGA ini, siapa yang menampung" — sumbu
 * masuknya harga. Trader Papan bertanya "broker ini posisinya bagaimana" —
 * sumbu masuknya pelaku. Keduanya membaca berkas yang sama; yang berbeda
 * pertanyaannya, dan menggabungkannya jadi satu halaman berarti memaksa satu
 * layar menjawab dua hal sekaligus.
 *
 * ## Satuan — sudah diukur, jangan ditebak lagi
 *
 * `beli_nilai / beli_lot` memberi harga per LOT, bukan per lembar. Terukur di
 * BUMI 2026-08-21: TP 31.584.692.700 / 1.578.037 = 20.016, sementara harga
 * rata-rata hari itu 196,6 — faktornya persis 100 (1 lot = 100 lembar). Semua
 * harga yang keluar dari modul ini sudah dibagi 100 supaya sebanding dengan
 * harga di layar mana pun.
 *
 * ## Yang TIDAK bisa dihitung dari data harian, dan tak boleh dikarang
 *
 * Harga rata-rata di sini adalah rata-rata TERTIMBANG SELURUH RENTANG, bukan
 * harga perolehan posisi yang masih dipegang. Broker yang membeli lalu
 * menjual habis tetap punya "avg" di sini — angkanya benar sebagai rata-rata
 * transaksi, tapi ia BUKAN modal posisi terbuka. Data harian tak menyimpan
 * posisi terbawa dari sebelum rentang, jadi P&L mengambang di bawah hanya
 * sah dibaca untuk broker yang net-nya masih positif; komponen wajib
 * menyembunyikannya untuk yang lain, bukan mencetak angka yang tak berarti.
 */

import type { HariBroker } from './whalesPapan'

/** Ambang lot: di bawah ini broker dianggap tak berposisi, cuma menyentuh.
 *  Bukan ambang kualitas — hanya penjaga supaya baris 1-2 lot tak memenuhi
 *  tabel dan membuat P&L-nya (yang penyebutnya kecil) meledak. */
const MIN_LOT = 1

export type StatusBroker =
  | 'akumulasi'
  | 'akumulasi-mereda'
  | 'distribusi'
  | 'distribusi-berbalik'
  | 'datar'

export interface PosisiBroker {
  kode: string
  beliLot: number
  jualLot: number
  netLot: number
  netNilai: number
  /** Harga rata-rata beli & jual per LEMBAR. `null` kalau sisi itu nol. */
  avgBeli: number | null
  avgJual: number | null
  /** Harga rata-rata hari TERENDAH tempat broker ini net-membeli. Padanan
   *  "floor price" tradersaham: seberapa murah ia pernah menampung. */
  floor: number | null
  hariAktif: number
  hariNetBeli: number
  hariNetJual: number
  /** Net lot per hari sepanjang rentang, urut tanggal — bahan strip harian. */
  netHarian: number[]
  status: StatusBroker
  /** Untung/rugi mengambang terhadap `hargaAkhir`, persen. Hanya diisi untuk
   *  broker yang net-nya masih positif — lihat catatan kepala berkas. */
  pnlPct: number | null
}

export interface HasilPosisi {
  baris: PosisiBroker[]
  nHari: number
  hargaAkhir: number | null
  tglMulai: string | null
  tglAkhir: string | null
}

/**
 * Berapa hari terakhir yang menentukan "sedang" pada label status.
 *
 * Dibatasi separuh rentang, dan itu bukan hiasan: dengan ekor tetap 5 hari,
 * rentang 4 hari membuat ekor = SELURUH rentang, jadi `netEkor` selalu sama
 * dengan `net` dan label "mereda"/"berbalik" tak pernah bisa muncul. Gagalnya
 * senyap — tabelnya terisi penuh dan semua brokernya terbaca konsisten,
 * padahal pembandingnya membandingkan sesuatu dengan dirinya sendiri.
 */
function panjangEkor(nHari: number): number {
  return Math.min(EKOR_MAKS, Math.floor(nHari / 2))
}
const EKOR_MAKS = 5

function label(net: number, netEkor: number): StatusBroker {
  if (net === 0) return 'datar'
  if (net > 0) return netEkor < 0 ? 'akumulasi-mereda' : 'akumulasi'
  return netEkor > 0 ? 'distribusi-berbalik' : 'distribusi'
}

/** Hari dalam rentang tanggal (inklusif), urut. Harga tak ikut menyaring di
 *  sini — itu urusan Whales Papan. */
export function hariRentang(hari: HariBroker[], dari: string, sampai: string): HariBroker[] {
  const d1 = dari <= sampai ? dari : sampai
  const d2 = dari <= sampai ? sampai : dari
  return hari.filter((h) => h.tanggal >= d1 && h.tanggal <= d2)
}

/**
 * Posisi tiap broker atas rentang hari yang diberikan.
 *
 * `hargaAkhir` diambil dari hari terakhir yang punya harga rata-rata — bukan
 * hari terakhir begitu saja, karena hari tanpa transaksi reguler tak punya
 * harga dan akan membuat seluruh kolom P&L kosong tanpa sebab yang terlihat.
 */
export function posisiBroker(hariTerpilih: HariBroker[]): HasilPosisi {
  const hari = [...hariTerpilih].sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))
  let hargaAkhir: number | null = null
  for (let i = hari.length - 1; i >= 0; i--) {
    if (hari[i].avg != null) {
      hargaAkhir = hari[i].avg
      break
    }
  }

  interface Akum {
    beliLot: number
    beliNilai: number
    jualLot: number
    jualNilai: number
    hariAktif: number
    hariNetBeli: number
    hariNetJual: number
    floor: number | null
    netHarian: number[]
  }
  const peta = new Map<string, Akum>()
  const kosong = (): Akum => ({
    beliLot: 0,
    beliNilai: 0,
    jualLot: 0,
    jualNilai: 0,
    hariAktif: 0,
    hariNetBeli: 0,
    hariNetJual: 0,
    floor: null,
    netHarian: Array(hari.length).fill(0),
  })

  hari.forEach((h, i) => {
    for (const [kode, bLot, bNilai, jLot, jNilai] of h.broker) {
      let a = peta.get(kode)
      if (!a) {
        a = kosong()
        peta.set(kode, a)
      }
      a.beliLot += bLot
      a.beliNilai += bNilai
      a.jualLot += jLot
      a.jualNilai += jNilai
      const net = bLot - jLot
      a.netHarian[i] = net
      if (bLot || jLot) a.hariAktif += 1
      if (net > 0) {
        a.hariNetBeli += 1
        // Floor = harga terendah tempat ia MENAMPUNG. Hari net-jual tak
        // dihitung: menjual murah bukan menampung murah.
        if (h.avg != null && (a.floor == null || h.avg < a.floor)) a.floor = h.avg
      } else if (net < 0) {
        a.hariNetJual += 1
      }
    }
  })

  const baris: PosisiBroker[] = []
  for (const [kode, a] of peta) {
    const netLot = a.beliLot - a.jualLot
    if (a.beliLot + a.jualLot < MIN_LOT) continue
    const nEkor = panjangEkor(hari.length)
    // Ekor 0 (rentang < 2 hari) berarti tak ada "sebelum" untuk dibandingkan;
    // labelnya jatuh ke arah keseluruhan saja, bukan ditebak.
    const netEkor = nEkor > 0 ? a.netHarian.slice(-nEkor).reduce((s, x) => s + x, 0) : netLot
    const avgBeli = a.beliLot > 0 ? a.beliNilai / a.beliLot / 100 : null
    baris.push({
      kode,
      beliLot: a.beliLot,
      jualLot: a.jualLot,
      netLot,
      netNilai: a.beliNilai - a.jualNilai,
      avgBeli,
      avgJual: a.jualLot > 0 ? a.jualNilai / a.jualLot / 100 : null,
      floor: a.floor,
      hariAktif: a.hariAktif,
      hariNetBeli: a.hariNetBeli,
      hariNetJual: a.hariNetJual,
      netHarian: a.netHarian,
      status: label(netLot, netEkor),
      pnlPct:
        netLot > 0 && avgBeli != null && avgBeli > 0 && hargaAkhir != null
          ? ((hargaAkhir - avgBeli) / avgBeli) * 100
          : null,
    })
  }

  baris.sort((x, y) => Math.abs(y.netNilai) - Math.abs(x.netNilai))
  return {
    baris,
    nHari: hari.length,
    hargaAkhir,
    tglMulai: hari.length ? hari[0].tanggal : null,
    tglAkhir: hari.length ? hari[hari.length - 1].tanggal : null,
  }
}

export const TEKS_STATUS: Record<StatusBroker, string> = {
  akumulasi: 'Menampung',
  'akumulasi-mereda': 'Menampung, mereda',
  distribusi: 'Melepas',
  'distribusi-berbalik': 'Melepas, berbalik beli',
  datar: 'Datar',
}
