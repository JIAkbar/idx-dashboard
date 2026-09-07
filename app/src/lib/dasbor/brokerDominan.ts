/**
 * Broker Dominan per emiten (#65) — siapa yang paling besar membeli dan
 * menjual emiten ini dalam satu rentang.
 *
 * Johan, 7 Sep 2026: *"Perlu dibuatkan ini juga seperti kemarin saya bilang,
 * ada menu dimana broker-broker itu muncul yang dominan beli dan dominan jual
 * dan pakai rentang waktu"*.
 *
 * ## Kenapa dihitung di peramban, padahal saudaranya (#30) dipra-hitung
 *
 * Arahnya kebalikan. #30 menjawab "broker X di emiten apa saja" — itu butuh
 * membalik 963 arsip, jadi wajib dipra-hitung. Yang ini menjawab "di emiten
 * INI broker siapa saja", dan arsip emiten itu **sudah dimuat halamannya**
 * (`useBrokerTahunan` di Berkas Emiten memuat seluruh tahunnya). Menambah
 * skrip pra-hitung untuk angka yang sudah ada di memori berarti satu berkas
 * turunan lagi yang harus dijadwalkan, dipantau kebasiannya, dan bisa basi
 * diam-diam — biaya nyata untuk nol manfaat.
 *
 * ## Yang tidak boleh salah baca
 *
 * - **`avg` dihitung dari SISI yang dominan**, bukan dari campuran. Harga
 *   rata-rata beli dan rata-rata jual adalah dua angka berbeda; memakai satu
 *   untuk dua sisi membuat estimasi laba/rugi menunjuk arah yang salah.
 * - **Penyebut dominasi adalah Σ nilai beli SELURUH broker** di rentang itu.
 *   Memakai total broker terpilih membuat angkanya selalu berjumlah 100% dan
 *   berhenti memberi tahu seberapa besar brokernya.
 * - **Daftar broker harian dipotong 50 teratas tiap sisi oleh sumbernya.**
 *   Karena itu Σ-nya bukan nilai transaksi bursa yang sesungguhnya, dan
 *   halaman wajib menyebutnya. Sama seperti #30.
 * - **Estimasi laba/rugi memakai penutupan TERAKHIR yang ada**, jadi ia
 *   pernyataan tentang posisi hari ini seandainya belum dilepas — bukan
 *   realisasi. Kata "estimasi" di judul kolomnya bukan hiasan.
 */
import { LABEL_RENTANG, HARI_PRESET } from './periode'
import { sisiBroker, type SisiBroker } from './pilihGarisBroker'
import { namaBroker } from './kelompokBroker'

/** Bentuk minimum yang dibutuhkan — sengaja bukan `HariBroker` penuh supaya
 *  uji tak perlu merakit ruas yang tak dipakai. */
export interface HariRingkas {
  tanggal: string
  broker: Array<[string, number, number, number, number]>
}

export type RentangDominan = 'w1' | 'b1' | 'b3' | 'b6'

export const RENTANG_DOMINAN: Array<{ id: RentangDominan; label: string }> =
  (['w1', 'b1', 'b3', 'b6'] as const).map((id) => ({ id, label: LABEL_RENTANG[id] }))

export interface BarisDominan {
  kode: string
  nama: string
  sisi: SisiBroker
  /** Nilai sisi dominan (beli untuk pembeli dominan, jual untuk penjual). */
  nilai: number
  lot: number
  netNilai: number
  /** Harga rata-rata sisi dominan; null kalau lotnya nol. */
  avg: number | null
  /** (tutup terakhir − avg) ÷ avg. null kalau salah satunya tak ada.
   *  Untuk penjual dominan tandanya DIBALIK: harga naik sesudah ia menjual
   *  berarti rugi kesempatan, bukan untung. */
  estimasi: number | null
  /** Nilai sisi dominan ÷ Σ nilai beli seluruh broker di rentang. */
  dominasi: number | null
}

export interface HasilDominan {
  mulai: string
  akhir: string
  nHari: number
  /** Σ nilai beli seluruh broker di rentang — penyebut dominasi, dan sekaligus
   *  ukuran "seberapa ramai" emiten ini di periode itu. */
  totalNilai: number
  beli: BarisDominan[]
  jual: BarisDominan[]
}

/** Tanggal ISO paling awal yang masih ikut rentang, snap ke hari BERDATA. */
export function mulaiRentang(hari: HariRingkas[], preset: RentangDominan): string {
  if (hari.length === 0) return ''
  const akhir = hari[hari.length - 1].tanggal
  const d = new Date(`${akhir}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - HARI_PRESET[preset])
  const target = d.toISOString().slice(0, 10)
  // Hari berdata pertama yang >= target. Kalau riwayatnya lebih pendek
  // daripada presetnya, jatuh ke hari pertama yang ada — bukan larik kosong,
  // karena "riwayat baru sebulan" tetap layak ditampilkan asal batasnya jujur.
  return hari.find((h) => h.tanggal >= target)?.tanggal ?? hari[0].tanggal
}

export function hitungDominan(
  hari: HariRingkas[],
  preset: RentangDominan,
  hargaAkhir: number | null,
  topN = 7,
): HasilDominan | null {
  if (hari.length === 0) return null
  const mulai = mulaiRentang(hari, preset)
  const akhir = hari[hari.length - 1].tanggal
  const potong = hari.filter((h) => h.tanggal >= mulai && h.tanggal <= akhir)
  if (potong.length === 0) return null

  const per = new Map<string, { bl: number; bn: number; jl: number; jn: number }>()
  let totalNilai = 0
  for (const h of potong) {
    for (const r of h.broker) {
      const a = per.get(r[0]) ?? { bl: 0, bn: 0, jl: 0, jn: 0 }
      a.bl += r[1]; a.bn += r[2]; a.jl += r[3]; a.jn += r[4]
      per.set(r[0], a)
      totalNilai += r[2]
    }
  }

  const baris = (kode: string, sisi: 'beli' | 'jual'): BarisDominan => {
    const a = per.get(kode)!
    const nilai = sisi === 'beli' ? a.bn : a.jn
    const lot = sisi === 'beli' ? a.bl : a.jl
    // Lot dikali 100 karena satu lot = 100 lembar; ini harga per LEMBAR,
    // satuan yang sama dengan penutupan yang dibandingkan di sebelahnya.
    const avg = lot > 0 ? nilai / (lot * 100) : null
    const mentah = avg && hargaAkhir ? (hargaAkhir - avg) / avg : null
    return {
      kode,
      nama: namaBroker(kode),
      sisi: sisiBroker(kode),
      nilai,
      lot,
      netNilai: a.bn - a.jn,
      avg,
      estimasi: mentah == null ? null : (sisi === 'beli' ? mentah : -mentah),
      dominasi: totalNilai > 0 ? nilai / totalNilai : null,
    }
  }

  const kode = [...per.keys()]
  const beli = kode
    .filter((k) => per.get(k)!.bn > per.get(k)!.jn)
    .sort((x, y) => (per.get(y)!.bn - per.get(y)!.jn) - (per.get(x)!.bn - per.get(x)!.jn))
    .slice(0, topN)
    .map((k) => baris(k, 'beli'))
  const jual = kode
    .filter((k) => per.get(k)!.jn > per.get(k)!.bn)
    .sort((x, y) => (per.get(y)!.jn - per.get(y)!.bn) - (per.get(x)!.jn - per.get(x)!.bn))
    .slice(0, topN)
    .map((k) => baris(k, 'jual'))

  return { mulai, akhir, nHari: potong.length, totalNilai, beli, jual }
}
