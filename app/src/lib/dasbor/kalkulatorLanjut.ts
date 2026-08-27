/**
 * Tiga kalkulator lanjut — Piramida, Blender Posisi, Bunga-Berbunga.
 * Rumusnya saja (tanpa React), port spek §F. Harga hasil SELALU dibulatkan
 * ke tick lewat `keFraksi()` (`lib/fraksiHarga.ts`) — harga yang tak bisa
 * dipesan di bursa tak boleh keluar dari kalkulator ini.
 */
import { keFraksi } from '../fraksiHarga'

// ─── Piramida (Pyramid Entry) ────────────────────────────────────────────

/** Porsi lot tiap lapis — konvensi kalkulator ini, ditulis apa adanya di layar. */
export const PORSI_LAPIS_PIRAMIDA = [0.5, 0.25, 0.15, 0.1]

export interface LapisPiramida {
  lot: number
  harga: number
  /** Harga rata-rata KUMULATIF setelah lapis ini (dan semua sebelumnya) terisi. */
  avgKumulatif: number
}

export interface HasilPiramida {
  risikoRupiah: number
  /** `floor(risiko ÷ (masuk − SL) ÷ 100)` — dasar seluruh rencana lapis. */
  lotDasar: number
  lembarDasar: number
  lapis: LapisPiramida[]
}

/**
 * Bagi `total` menurut `porsi` dengan metode sisa terbesar — supaya jumlah
 * hasil pembulatan SELALU balik ke `total` persis, bukan mendekati.
 */
function bagiPorsi(total: number, porsi: number[]): number[] {
  const mentah = porsi.map((p) => total * p)
  const dasar = mentah.map(Math.floor)
  let sisa = total - dasar.reduce((a, b) => a + b, 0)
  const urutSisa = mentah
    .map((m, i) => ({ i, frac: m - dasar[i] }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < sisa; k++) dasar[urutSisa[k].i]++
  return dasar
}

export function hitungPiramida(
  modal: number, risikoPersen: number, masuk: number, sl: number, langkahPersen: number,
): HasilPiramida | null {
  if (modal <= 0 || risikoPersen <= 0 || masuk <= 0 || sl <= 0 || masuk <= sl) return null
  const risikoRupiah = modal * (risikoPersen / 100)
  const bedaHarga = masuk - sl
  const lotDasar = Math.floor(risikoRupiah / bedaHarga / 100)
  const lots = bagiPorsi(lotDasar, PORSI_LAPIS_PIRAMIDA)

  let kumLot = 0
  let kumNilai = 0
  const lapis: LapisPiramida[] = lots.map((lot, i) => {
    const harga = keFraksi(masuk * (1 + (i * langkahPersen) / 100), 'dekat')
    kumLot += lot
    kumNilai += lot * harga
    return { lot, harga, avgKumulatif: kumLot > 0 ? kumNilai / kumLot : 0 }
  })

  return { risikoRupiah, lotDasar, lembarDasar: lotDasar * 100, lapis }
}

// ─── Blender Posisi (Average Price) ──────────────────────────────────────

export interface PosisiBlender {
  harga: number
  lot: number
}

export interface PresetCutLoss {
  persen: number
  harga: number
  rugiRupiah: number
}

export interface HasilBlender {
  totalLot: number
  totalLembar: number
  totalModal: number
  /** WAP polos (weighted-average price) — TANPA fee. */
  wap: number
  /** Harga jual balik modal, SUDAH memasukkan fee beli & jual, dibulatkan NAIK ke tick. */
  breakEven: number
  presetCutLoss: PresetCutLoss[]
}

const PRESET_CUTLOSS_PERSEN = [-2, -5, -8]

export function hitungBlender(
  posisi: PosisiBlender[], feeBeliPersen: number, feeJualPersen: number,
): HasilBlender | null {
  const valid = posisi.filter((p) => p.harga > 0 && p.lot > 0)
  if (!valid.length) return null

  const totalLot = valid.reduce((a, p) => a + p.lot, 0)
  const totalLembar = totalLot * 100
  const totalModal = valid.reduce((a, p) => a + p.harga * p.lot * 100, 0)
  const wap = totalModal / totalLembar

  const fb = feeBeliPersen / 100
  const fs = feeJualPersen / 100
  const modalDenganFee = totalModal * (1 + fb)
  const breakEven = keFraksi(modalDenganFee / (totalLembar * (1 - fs)), 'atas')

  const presetCutLoss: PresetCutLoss[] = PRESET_CUTLOSS_PERSEN.map((persen) => {
    const harga = keFraksi(wap * (1 + persen / 100), 'bawah')
    return { persen, harga, rugiRupiah: (harga - wap) * totalLembar }
  })

  return { totalLot, totalLembar, totalModal, wap, breakEven, presetCutLoss }
}

// ─── Bunga-Berbunga (Compounding & DCA) ──────────────────────────────────

export interface BarisBunga {
  tahun: number
  saldoNominal: number
  saldoRiil: number
}

export interface HasilBunga {
  rows: BarisBunga[]
  /** `(1+r)/(1+i)−1` — imbal riil tahunan, dicetak apa adanya di layar. */
  imbalRiilTahunan: number
}

export function hitungBunga(
  modalAwal: number, setoranBulanan: number, imbalTahunanPersen: number,
  inflasiTahunanPersen: number, horizonTahun: number,
): HasilBunga {
  const r = imbalTahunanPersen / 100
  const i = inflasiTahunanPersen / 100
  // Bunga majemuk bulanan yang, tanpa setoran, balik ke `r` persis setelah
  // 12 bulan — bukan tebakan bulanan terpisah dari imbal tahunan yang diisi.
  const rBulanan = Math.pow(1 + r, 1 / 12) - 1

  const rows: BarisBunga[] = [{ tahun: 0, saldoNominal: modalAwal, saldoRiil: modalAwal }]
  let saldo = modalAwal
  for (let t = 1; t <= horizonTahun; t++) {
    for (let m = 0; m < 12; m++) saldo = saldo * (1 + rBulanan) + setoranBulanan
    rows.push({ tahun: t, saldoNominal: saldo, saldoRiil: saldo / Math.pow(1 + i, t) })
  }

  return { rows, imbalRiilTahunan: (1 + r) / (1 + i) - 1 }
}
