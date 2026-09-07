/**
 * Peringkat Top Broker LINTAS HARI (#29) — dibaca dari rollup pra-hitung.
 *
 * Johan: *"dan di page ini apakah tidak bisa range waktu ? kita punya data
 * hasil panen looh"*.
 *
 * Berkasnya dihasilkan `scripts/bangun_broker_rentang.py` dengan menjumlah
 * rekap broker harian resmi (`data-idx/json/broker/bs_*.json`) — 88 broker
 * lengkap per hari, bukan sepuluh besar. Menjumlah di peramban ditolak sejak
 * di baris antrean: 962 berkas × N hari.
 *
 * ## Satu hal yang WAJIB dibaca sebelum menyamakan angkanya
 *
 * Panel harian di halaman ini memakai `ds_*.json` (sepuluh besar), rollup ini
 * memakai `broker/bs_*.json` (88 broker). Untuk broker yang sama di hari yang
 * sama angkanya TIDAK persis sama — terukur 4 Sep 2026: XL 12.947 vs 14.159
 * juta lembar (1,094×), ZP 1,060×, CC 1,021×, AK 1,000×. Selisihnya beda-beda
 * per broker, jadi ia bukan pembulatan melainkan cakupan papan yang berbeda.
 *
 * Karena itu rentang dan hari TIDAK dicampur di satu tabel, dan panel rentang
 * menyebut basisnya sendiri. Menyatukan keduanya berarti mengganti sumber satu
 * panel — keputusan Johan, bukan agen (CLAUDE.md 3b).
 */
import { useEffect, useState } from 'react'
import type { BrokerRankRow } from './dataHarian'

/** Kunci preset = `PresetRentang` di `periode.ts`; berkasnya bernama sama. */
export type PresetBroker = 'h5' | 'w1' | 'b1' | 'b3' | 'ytd'

export interface BrokerRentang {
  mulai: string | null
  akhir: string | null
  n_hari: number
  hari: string[]
  n_broker: number
  broker_vol: BrokerRankRow[]
  broker_val: BrokerRankRow[]
  broker_freq: BrokerRankRow[]
}

const cache = new Map<string, Promise<BrokerRentang | null>>()

export function muatBrokerRentang(preset: PresetBroker): Promise<BrokerRentang | null> {
  let p = cache.get(preset)
  if (!p) {
    p = fetch(`/data-idx/json/broker_rentang/${preset}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BrokerRentang>) : null))
      .catch(() => null)
    cache.set(preset, p)
  }
  return p
}

export function useBrokerRentang(preset: PresetBroker | null): {
  data: BrokerRentang | null
  memuat: boolean
} {
  const [data, setData] = useState<BrokerRentang | null>(null)
  const [memuat, setMemuat] = useState(false)
  useEffect(() => {
    if (!preset) { setData(null); setMemuat(false); return }
    let batal = false
    setMemuat(true)
    muatBrokerRentang(preset).then((d) => {
      if (batal) return
      setData(d)
      setMemuat(false)
    })
    return () => { batal = true }
  }, [preset])
  return { data, memuat }
}
