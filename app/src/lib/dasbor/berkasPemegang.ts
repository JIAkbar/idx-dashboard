/**
 * Blok B Berkas Emiten — SIAPA MEMEGANG.
 *
 * Menjumlahkan arsip broker harian (yang sudah dimuat `useBrokerTahunan`)
 * menjadi jawaban satu layar: broker mana yang menampung, mana yang melepas,
 * seberapa terkonsentrasi, dan berapa porsi investor asingnya.
 *
 * ## Yang membuat angkanya bisa menyesatkan, dan penjagaannya
 *
 * - **GROSS vs NET tak boleh tertukar.** Broker bisa bertransaksi raksasa
 *   dua arah dan berakhir nyaris rata; menampilkan gross-nya saja membuatnya
 *   terlihat seperti penampung besar. Keduanya dihitung dan diberi nama
 *   sendiri — `netLot` untuk posisi, `beliLot`/`jualLot` untuk sibuknya.
 * - **Porsi asing itu porsi TRANSAKSI, bukan identitas broker.** Satu broker
 *   melayani investor asing DAN domestik; varian asing di arsip mengukur
 *   transaksinya, bukan kebangsaan pemiliknya. Layar wajib mengatakan itu
 *   (audit whales 28 Agu §7d).
 * - **Hari tanpa varian asing ≠ asing nol.** Arsip lama belum tentu punya
 *   varian asing; ruasnya sengaja opsional supaya "belum dipanen" tak
 *   terbaca sebagai "tak ada asing".
 * - **Konsentrasi dihitung dari NET sisi beli**, bukan dari gross: pertanyaan
 *   yang dijawabnya "seberapa sedikit tangan yang menampung", dan gross
 *   mencampurkan pedagang bolak-balik ke dalamnya.
 */
import type { BarisBroker, HariBroker } from './whalesPapan'
import { kelompokBroker, type KelompokBroker } from './kelompokBroker'

export interface PemegangBroker {
  kode: string
  netLot: number
  netNilai: number
  beliLot: number
  jualLot: number
  /** Harga rata-rata sisi belinya — jangkar psikologis, bukan target. */
  avgBeli: number | null
  kelompok: KelompokBroker
  /** Porsi lot beli broker ini yang berasal dari investor asing (0–1).
   *  null = hari-hari terpilih tak punya varian asing sama sekali. */
  porsiAsing: number | null
}

export interface RingkasPemegang {
  nHari: number
  tglMulai: string | null
  tglAkhir: string | null
  penampung: PemegangBroker[]
  pelepas: PemegangBroker[]
  /** Porsi net-beli yang dikuasai 3 broker teratas (0–1). */
  konsentrasi3: number | null
  /** Porsi asing atas SELURUH lot beli di periode ini (0–1), null bila
   *  varian asing tak tersedia. */
  porsiAsingTotal: number | null
  /** Net lot per kelompok broker — dua sumbu identitas dalam satu baris. */
  perKelompok: Array<{ kelompok: KelompokBroker; netLot: number }>
}

function tambah(peta: Map<string, PemegangBroker>, b: BarisBroker) {
  const [kode, beliLot, beliNilai, jualLot, jualNilai] = b
  let r = peta.get(kode)
  if (!r) {
    r = {
      kode, netLot: 0, netNilai: 0, beliLot: 0, jualLot: 0,
      avgBeli: null, kelompok: kelompokBroker(kode), porsiAsing: null,
    }
    peta.set(kode, r)
  }
  r.beliLot += beliLot
  r.jualLot += jualLot
  r.netLot += beliLot - jualLot
  r.netNilai += beliNilai - jualNilai
  return r
}

/**
 * Ringkas `n` hari bursa terakhir dari arsip broker.
 *
 * `hari` diharapkan urut lama→baru (bentuk yang dikembalikan
 * `dariBerkasTahunan`). Hari tanpa baris broker dilewati — bukan dihitung
 * sebagai hari sepi, karena ketiadaannya berarti belum dipanen.
 */
export function ringkasPemegang(hari: HariBroker[], nHari = 20): RingkasPemegang {
  const isi = hari.filter((h) => h.broker.length > 0)
  const pilih = isi.slice(-Math.max(1, nHari))

  const peta = new Map<string, PemegangBroker>()
  const nilaiBeli = new Map<string, number>()
  for (const h of pilih) {
    for (const b of h.broker) {
      tambah(peta, b)
      nilaiBeli.set(b[0], (nilaiBeli.get(b[0]) ?? 0) + b[2])
    }
  }

  // Varian asing: lot beli per broker, hanya dari hari yang memang punya.
  const asing = new Map<string, number>()
  let adaVarianAsing = false
  let asingTotal = 0
  for (const h of pilih) {
    if (!h.brokerAsing?.length) continue
    adaVarianAsing = true
    for (const b of h.brokerAsing) {
      asing.set(b[0], (asing.get(b[0]) ?? 0) + b[1])
      asingTotal += b[1]
    }
  }

  const semua = [...peta.values()]
  for (const r of semua) {
    const nb = nilaiBeli.get(r.kode) ?? 0
    r.avgBeli = r.beliLot > 0 ? nb / (r.beliLot * 100) : null
    if (adaVarianAsing) {
      r.porsiAsing = r.beliLot > 0 ? Math.min(1, (asing.get(r.kode) ?? 0) / r.beliLot) : null
    }
  }

  const penampung = semua.filter((r) => r.netLot > 0).sort((a, b) => b.netLot - a.netLot)
  const pelepas = semua.filter((r) => r.netLot < 0).sort((a, b) => a.netLot - b.netLot)

  const totalNetBeli = penampung.reduce((s, r) => s + r.netLot, 0)
  const konsentrasi3 = totalNetBeli > 0
    ? penampung.slice(0, 3).reduce((s, r) => s + r.netLot, 0) / totalNetBeli
    : null

  const totalBeli = semua.reduce((s, r) => s + r.beliLot, 0)
  const porsiAsingTotal = adaVarianAsing && totalBeli > 0
    ? Math.min(1, asingTotal / totalBeli)
    : null

  const kel = new Map<KelompokBroker, number>()
  for (const r of semua) kel.set(r.kelompok, (kel.get(r.kelompok) ?? 0) + r.netLot)

  return {
    nHari: pilih.length,
    tglMulai: pilih[0]?.tanggal ?? null,
    tglAkhir: pilih[pilih.length - 1]?.tanggal ?? null,
    penampung,
    pelepas,
    konsentrasi3,
    porsiAsingTotal,
    perKelompok: [...kel.entries()]
      .map(([kelompok, netLot]) => ({ kelompok, netLot }))
      .sort((a, b) => Math.abs(b.netLot) - Math.abs(a.netLot)),
  }
}

/** Kalimat konsentrasi — ambangnya dicetak, bukan disembunyikan. */
export function bacaKonsentrasi(k: number | null): string | null {
  if (k == null) return null
  const p = Math.round(k * 100)
  if (k >= 0.8) return `Sangat terpusat — 3 broker menguasai ${p}% net beli.`
  if (k >= 0.6) return `Terpusat — 3 broker menguasai ${p}% net beli.`
  return `Menyebar — 3 broker teratas ${p}% net beli.`
}
