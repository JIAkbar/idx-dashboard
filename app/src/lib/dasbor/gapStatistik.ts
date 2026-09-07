/**
 * Angka statistik pola Gap per kerangka, DIBACA DARI BERKAS (#50 §6).
 *
 * Pasangan `rbsStatistik.ts`, dan alasannya sama: konstanta lama di
 * `polaGap.ts` menjanjikan "80% terisi ≤5 hari" — angka dari definisi OPEN,
 * yang 51,6% "pengisiannya" terjadi di bar ke-0 karena candle gap itu sendiri
 * sudah menyentuh acuannya. Dengan definisi RENTANG angkanya lain sama sekali,
 * dan menampilkan yang lama di sebelah zona yang digambar dengan definisi baru
 * akan jadi dua klaim yang saling menyanggah di satu layar.
 *
 * Berkasnya dihasilkan `app/scripts/gap-statistik.ts`, yang MENGIMPOR mesin
 * yang sama dengan yang menggambar zonanya. Kerangka tanpa berkas tak
 * menampilkan apa-apa.
 */
import { useEffect, useState } from 'react'

export interface StatGap {
  kerangka: string
  n_emiten: number
  n_gap: number
  n_tersensor: number
  pct_terisi_5: number | null
  pct_terisi_20: number | null
  median_bar_terisi: number | null
}

const cache = new Map<string, Promise<StatGap | null>>()

export function muatStatGap(kerangka: string): Promise<StatGap | null> {
  let p = cache.get(kerangka)
  if (!p) {
    p = fetch(`/data-idx/json/bt/gap-stat-${kerangka}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<StatGap>) : null))
      .catch(() => null)
    cache.set(kerangka, p)
  }
  return p
}

export function kalimatStatGap(s: StatGap | null): string | null {
  if (!s || !s.n_gap) return null
  const pct = (v: number | null) => (v === null ? '—' : `${v.toString().replace('.', ',')}%`)
  const sensor = Math.round((s.n_tersensor / s.n_gap) * 100)
  return `${s.n_gap.toLocaleString('id-ID')} gap · terisi ${pct(s.pct_terisi_5)} dalam ≤5 bar`
    + ` · ${pct(s.pct_terisi_20)} dalam ≤20 bar · median ${s.median_bar_terisi ?? '—'} bar`
    + ` · ${sensor}% belum terisi sampai data habis`
    + ' · zona level & target penutupan, bukan sinyal beli'
}

export function useStatGap(kerangka: string, aktif: boolean): StatGap | null {
  const [stat, setStat] = useState<StatGap | null>(null)
  useEffect(() => {
    if (!aktif) { setStat(null); return }
    let batal = false
    muatStatGap(kerangka).then((s) => { if (!batal) setStat(s) })
    return () => { batal = true }
  }, [kerangka, aktif])
  return stat
}
