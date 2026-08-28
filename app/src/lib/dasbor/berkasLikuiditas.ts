/**
 * Blok D Berkas Emiten — LIKUIDITAS.
 *
 * Menjawab pertanyaan yang menentukan apakah blok-blok lain boleh dipercaya:
 * emiten ini benar-benar diperdagangkan, atau angkanya lahir dari segelintir
 * transaksi?
 *
 * ## Kenapa blok ini penting justru untuk blok LAIN
 *
 * Audit rezim pasar (28 Agu 2026) menemukan bahwa emiten yang harganya jarang
 * bergerak terbaca "defensif" padahal sebenarnya **tidak responsif** — beta
 * kecil karena tak ada transaksi, bukan karena tahan banting. Blok ini
 * mencetak penanda itu supaya pembaca bisa menilai sendiri.
 *
 * ## Dua ukuran yang sengaja dipisah
 *
 * - **Hari sepi** = hari bursa dengan volume NOL. Emiten yang separuh harinya
 *   sepi tak bisa dianalisis seperti emiten likuid.
 * - **Hari harga BEKU** = ada transaksi tapi closenya sama persis dengan
 *   kemarin. Ini yang membuat beta terbaca kecil palsu, dan ia berbeda dari
 *   hari sepi: sahamnya diperdagangkan, harganya saja yang tak bergerak.
 *
 * ## Porsi negosiasi
 *
 * Papan negosiasi bisa menyilangkan volume raksasa di harga jauh di luar
 * pasar (GOTO 20 Agu 2026: 41,4 miliar lembar di harga rata-rata Rp 21,9
 * sementara fraksinya sendiri Rp 50). Porsinya dilaporkan supaya "volume
 * besar" tak otomatis dibaca sebagai minat pasar. Hari yang variannya belum
 * dipanen TIDAK dihitung sebagai nol.
 */

export interface HariLikuid {
  tanggal: string
  /** Lembar. */
  volume: number
  close: number
  /** Lot papan reguler hari itu (dari arsip broker). */
  regulerLot?: number
  /** Lot papan negosiasi hari itu. undefined = belum ada di arsip. */
  negoLot?: number
}

export interface RingkasLikuid {
  nHari: number
  /** Hari bervolume nol. */
  hariSepi: number
  /** Hari bertransaksi tapi close sama persis dengan hari sebelumnya. */
  hariBeku: number
  /** Median volume harian (lembar) atas hari yang BERTRANSAKSI. */
  medianVolume: number | null
  /** Porsi lot nego terhadap total (reguler + nego), 0–1. null bila varian
   *  nego tak tersedia di satu hari pun. */
  porsiNego: number | null
  /** Peringatan yang layak dibaca sebelum mempercayai blok lain. */
  peringatan: string[]
}

function median(v: number[]): number | null {
  if (v.length === 0) return null
  const s = [...v].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[n >> 1] : (s[(n >> 1) - 1] + s[n >> 1]) / 2
}

export function ringkasLikuid(hari: HariLikuid[], n = 60): RingkasLikuid {
  const pilih = hari.slice(-Math.max(1, n))
  if (pilih.length === 0) {
    return { nHari: 0, hariSepi: 0, hariBeku: 0, medianVolume: null, porsiNego: null, peringatan: [] }
  }

  const hariSepi = pilih.filter((h) => !h.volume).length

  // Beku: bertransaksi TAPI closenya sama dengan bar sebelumnya. Hari sepi
  // sengaja tak ikut — ia sudah dihitung sebagai sepi, dan menghitungnya dua
  // kali membuat emiten tidur terlihat dua kali lebih buruk.
  let hariBeku = 0
  for (let i = 1; i < pilih.length; i += 1) {
    if (pilih[i].volume > 0 && pilih[i].close === pilih[i - 1].close) hariBeku += 1
  }

  const medianVolume = median(pilih.filter((h) => h.volume > 0).map((h) => h.volume))

  let reg = 0
  let nego = 0
  let adaNego = false
  for (const h of pilih) {
    if (h.negoLot == null) continue
    adaNego = true
    nego += h.negoLot
    reg += h.regulerLot ?? 0
  }
  const porsiNego = adaNego && reg + nego > 0 ? nego / (reg + nego) : null

  const peringatan: string[] = []
  const porsiSepi = hariSepi / pilih.length
  const porsiBeku = hariBeku / pilih.length
  if (porsiSepi >= 0.25) {
    peringatan.push(`${Math.round(porsiSepi * 100)}% hari tanpa transaksi sama sekali — angka di blok lain berdiri di atas sedikit sekali hari perdagangan.`)
  }
  if (porsiBeku >= 0.25) {
    peringatan.push(`${Math.round(porsiBeku * 100)}% hari harganya tak bergerak meski ada transaksi — emiten begini terbaca "tahan banting" padahal sebenarnya tidak responsif.`)
  }
  if (porsiNego != null && porsiNego >= 0.3) {
    peringatan.push(`${Math.round(porsiNego * 100)}% lot berpindah lewat papan negosiasi — harga di sana bisa jauh di luar pasar, jadi volume besar belum tentu minat pasar.`)
  }

  return { nHari: pilih.length, hariSepi, hariBeku, medianVolume, porsiNego, peringatan }
}

/** Label satu kata untuk kepala kartu — ambangnya sama dengan peringatan. */
export function labelLikuiditas(r: RingkasLikuid): 'likuid' | 'tipis' | 'tidur' | null {
  if (r.nHari === 0) return null
  const sepi = r.hariSepi / r.nHari
  const beku = r.hariBeku / r.nHari
  if (sepi >= 0.5) return 'tidur'
  if (sepi >= 0.25 || beku >= 0.25) return 'tipis'
  return 'likuid'
}
