import { useEffect, useState } from 'react'

/**
 * Bandarmologi — teori BidOffer Bandar & spek Algo/Radar dihitung di atas data
 * yang sudah dipanen (bukan umpan live).
 *
 * Johan 3 Sep 2026: *"sistem yang dibuat itu sebenarnya rata-rata jalan
 * offline, dimana data kita panen mereka baru build gitu sih"*. Halaman ini
 * membahas tiap teori sekaligus menunjukkan angkanya hari itu — termasuk yang
 * TIDAK bisa dihitung, lengkap dengan sebabnya.
 *
 * Berkasnya dibangun `scripts/bangun_bandarmologi.py`; seluruh rumus dan
 * batasannya ada di komentar skrip itu, bukan di sini.
 */

export interface FaseBroker {
  hhi_beli: number
  hhi_jual: number
  /** hhi_beli − hhi_jual. Positif = sisi beli lebih terpusat = ciri akumulasi. */
  konsentrasi: number
  top3_beli_pct: number | null
  top3_jual_pct: number | null
  n_beli: number
  n_jual: number
}

export interface KeyAccount {
  broker: string
  /** Berapa hari dari 20 terakhir broker ini masuk 3 besar nilai beli. */
  hari: number
  beli: number
  jual: number
  net: number
}

export interface TmmSwing {
  target: number
  harga_avg_top5: number
  jarak_pct: number | null
  vb_lot_top5: number
  penyebut_lot: number
  rentang_10tick: number
  basis: string
}

export interface BarisBandar {
  kode: string
  /** Lot rata-rata per transaksi = volume ÷ frekuensi ÷ 100. */
  lot_per_tx: number
  lot_med: number
  /** z-robust lot_per_tx terhadap kebiasaan emiten itu sendiri (60 hari). */
  z_lot: number | null
  n_baseline: number
  terkalibrasi: boolean
  nilai: number
  share_nilai: number | null
  frekuensi: number
  volume: number
  net_asing_lembar: number
  share_asing: number | null
  rasio_offer_bid: number | null
  accdist: string | null
  fase: FaseBroker | null
  key_account: KeyAccount[] | null
  tmm_swing: TmmSwing | null
}

export interface TakBisa {
  teori: string
  sumber: string
  sebab: string
}

export interface DataBandar {
  tanggal: string
  tanggal_bidoffer: string | null
  nilai_pasar_miliar: number | null
  n: number
  ambang: {
    lipat_timpang: number
    share_nilai_min: number
    share_asing_min: number
    n_min_kalibrasi: number
    jendela_baseline: number
  }
  tak_bisa: TakBisa[]
  d: BarisBandar[]
}

export function useBandarmologi() {
  const [data, setData] = useState<DataBandar | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  useEffect(() => {
    let batal = false
    fetch('/data-idx/json/bandarmologi.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: DataBandar) => { if (!batal) { setData(j); setMemuat(false) } })
      .catch((e: Error) => { if (!batal) { setGalat(e.message); setMemuat(false) } })
    return () => { batal = true }
  }, [])
  return { data, memuat, galat }
}

/** Ciri bandar vs retail (BidOffer hal. 3) — "lot besar freq kecil = bandar".
 *  Dinyatakan relatif terhadap kebiasaan emiten sendiri, bukan lintas emiten:
 *  42 lot/transaksi di BBCA dan 42 di saham gocap bukan hal yang sama. */
export function ciriLot(b: BarisBandar): 'tebal' | 'biasa' | 'tipis' | null {
  if (b.z_lot == null) return null
  if (b.z_lot >= 2.5) return 'tebal'
  if (b.z_lot <= -2.5) return 'tipis'
  return 'biasa'
}

/** Ketimpangan antrean penutupan (BidOffer hal. 4). `lipat` dari berkas. */
export function ciriTimpang(b: BarisBandar, lipat: number): 'offer-tebal' | 'bid-tebal' | 'imbang' | null {
  const r = b.rasio_offer_bid
  if (r == null) return null
  if (r >= lipat) return 'offer-tebal'
  if (r <= 1 / lipat) return 'bid-tebal'
  return 'imbang'
}

/** Fase dari konsentrasi broker (BidOffer hal. 15-16), digabung arah asing.
 *  Sengaja TIDAK memutuskan empat fase penuh: mark up vs mark down menuntut
 *  arah harga multi-hari, dan menyebutnya dari satu hari akan mengarang. */
export function ciriFase(b: BarisBandar): 'akumulasi' | 'distribusi' | 'campuran' | null {
  if (!b.fase) return null
  const k = b.fase.konsentrasi
  if (k > 0.02) return 'akumulasi'
  if (k < -0.02) return 'distribusi'
  return 'campuran'
}

export const LABEL_LOT: Record<string, string> = {
  tebal: 'Lot tebal',
  biasa: 'Biasa',
  tipis: 'Lot tipis',
}

export const LABEL_TIMPANG: Record<string, string> = {
  'offer-tebal': 'Offer tebal',
  'bid-tebal': 'Bid tebal',
  imbang: 'Imbang',
}

export const LABEL_FASE: Record<string, string> = {
  akumulasi: 'Beli terpusat',
  distribusi: 'Jual terpusat',
  campuran: 'Setara',
}
