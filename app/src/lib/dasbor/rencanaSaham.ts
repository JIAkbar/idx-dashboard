/**
 * Rencana dagang + rekam jejak per emiten.
 *
 * Sumbernya dihitung sekali sehari di luar peramban — win rate per emiten
 * menuntut menelusuri ratusan hari bursa untuk tiap emiten dan tiap horizon,
 * dan melakukannya di sini berarti mengunduh seluruh riwayat 963 emiten.
 *
 * Rumus levelnya SAMA PERSIS dengan yang dipakai menerbitkan sinyal harian.
 * Itu bukan kerapian: kalau kartu memakai rumus lain, angka win rate di
 * sebelahnya tak menjelaskan apa pun tentang sinyal yang benar-benar terbit.
 */

export interface JejakHorizon {
  menang: number
  kalah: number
  gantung: number
  n: number
  /** menang / (menang+kalah) — `null` kalau tak ada yang tuntas. */
  winRate: number | null
  /** menang / SELURUH sinyal, termasuk yang menggantung. */
  winRateSemua: number | null
  /** Rata-rata hasil per sinyal, persen. Bisa negatif walau win rate tinggi. */
  ekspektansi: number | null
}

export interface RencanaEmiten {
  kode: string
  tanggal: string
  harga: number
  areaBeli: [number, number]
  tp1: number
  tp2: number
  sl: number
  /** (target1 − harga) / (harga − batas). Di bawah 1 = incaran lebih kecil dari risiko. */
  rr: number | null
  atrPct: number
  ubah1h: number | null
  ubah2p: number | null
  nilaiHarian: number | null
  nBar: number
  mulai: string
  jejak: { h5: JejakHorizon; h10: JejakHorizon; h20: JejakHorizon }
}

export interface RencanaSaham {
  dibangun: string
  nSinyal: number
  horizon: number[]
  atrHari: number
  catatan: string
  emiten: RencanaEmiten[]
}

let simpanan: Promise<Map<string, RencanaEmiten>> | null = null
let meta: RencanaSaham | null = null

/** Peta kode → rencana. Diunduh sekali per sesi peramban. */
export function muatRencana(): Promise<Map<string, RencanaEmiten>> {
  if (!simpanan) {
    simpanan = fetch('/data-idx/json/rencana_saham.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: RencanaSaham) => {
        meta = d
        return new Map(d.emiten.map((e) => [e.kode, e]))
      })
      .catch(() => new Map<string, RencanaEmiten>())
  }
  return simpanan
}

export function metaRencana(): RencanaSaham | null {
  return meta
}

/**
 * Kalimat yang dibaca pembaca, bukan angka mentah.
 *
 * Ekspektansi yang dipakai, bukan win rate — dan itu inti seluruh kartu ini.
 * BUMI pada 1 Sep 2026 menang 57,6% dari sinyal yang tuntas di lima hari, dan
 * ekspektansinya tetap −1,203% per sinyal: incarannya +5,8% sementara batas
 * ruginya −12,1%. Aturan berekspektansi negatif memang sering menang; yang
 * membuatnya rugi adalah ukuran kalahnya, bukan seringnya.
 */
export function bacaJejak(j: JejakHorizon | undefined): {
  nada: 'baik' | 'buruk' | 'sepi'
  kalimat: string
} {
  if (!j || !j.n) return { nada: 'sepi', kalimat: 'belum cukup riwayat untuk diukur' }
  if (j.ekspektansi == null) return { nada: 'sepi', kalimat: 'belum terukur' }
  if (j.ekspektansi > 0) {
    return { nada: 'baik', kalimat: 'aturan ini menguntungkan di masa lalu emiten ini' }
  }
  if (j.winRate != null && j.winRate >= 50) {
    return {
      nada: 'buruk',
      kalimat: 'sering menang tapi tetap rugi — kalahnya lebih besar daripada menangnya',
    }
  }
  return { nada: 'buruk', kalimat: 'merugi di masa lalu emiten ini' }
}

/** Lantai likuiditas dari sebaran nyata 838 emiten (diukur 1 Sep 2026):
 *  separuh pasar bertransaksi di bawah 0,49 miliar sehari. */
export const LANTAI_LIKUID = [
  { label: 'Semua', nilai: 0 },
  { label: '≥ 1 M', nilai: 1e9 },
  { label: '≥ 5 M', nilai: 5e9 },
  { label: '≥ 10 M', nilai: 1e10 },
  { label: '≥ 50 M', nilai: 5e10 },
] as const
