/**
 * Angka statistik pola RBS per kerangka, DIBACA DARI BERKAS (#49 §5).
 *
 * Menggantikan konstanta `RINGKAS_BACKTEST_RBS` yang dulu tertulis mati di
 * `polaRbs.ts` — satu kalimat berisi jumlah breakout, persen retest, dan
 * persen bertahan. (Angkanya sengaja tak dikutip di sini: kriteria terima #49
 * mensyaratkan grep angka itu nol hasil di `app/src`, dan komentar yang
 * mengutipnya akan membuat pemeriksaan itu gagal untuk alasan yang salah.)
 * Tiga hal salah sekaligus di kalimat itu, dan ketiganya cuma terlihat dari luar —
 * semestanya top-100 statis (bukan seluruh papan), angkanya tak pernah
 * dihitung ulang sesudah mesinnya berubah, dan ia BERTENTANGAN dengan berkas
 * backtest di repo yang sama (`bt/index.json`: n_trade 248, win 48,4%). Dua
 * angka resmi yang berbeda untuk satu hal, dan yang tampil di layar justru
 * yang tak punya berkas.
 *
 * Sekarang: satu berkas per kerangka, dihasilkan `scripts/riset/rbs_statistik.py`
 * dari mesin yang SAMA dengan yang menggambar garisnya. Kerangka yang belum
 * punya berkas tak menampilkan apa-apa — diam lebih jujur daripada meminjam
 * angka kerangka lain.
 */
import { useEffect, useState } from 'react'

export interface StatRbs {
  kerangka: string
  n_emiten: number
  n_breakout: number
  n_retest: number
  n_bertahan: number
  n_dinilai: number
  n_tersensor: number
  pct_retest: number | null
  pct_bertahan: number | null
  pct_sl: number | null
  median_h20: number | null
}

const cache = new Map<string, Promise<StatRbs | null>>()

export function muatStatRbs(kerangka: string): Promise<StatRbs | null> {
  let p = cache.get(kerangka)
  if (!p) {
    p = fetch(`/data-idx/json/bt/rbs-stat-${kerangka}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<StatRbs>) : null))
      .catch(() => null)
    cache.set(kerangka, p)
  }
  return p
}

/**
 * Kalimat siap tampil. `null` kalau berkasnya belum ada.
 *
 * Persen ditulis apa adanya termasuk yang tak enak dibaca — median H+20 di
 * harian memang sekitar nol, dan menyembunyikannya akan membuat pola ini
 * terbaca sebagai sinyal beli. Yang tersensor ikut disebut: membuangnya diam-
 * diam membuat sisanya terlihat lebih pasti daripada yang sebenarnya.
 */
export function kalimatStatRbs(s: StatRbs | null): string | null {
  if (!s || !s.n_breakout) return null
  const pct = (v: number | null) => (v === null ? '—' : `${v.toString().replace('.', ',')}%`)
  const n = s.n_breakout.toLocaleString('id-ID')
  const sensor = s.n_dinilai + s.n_tersensor > 0
    ? Math.round((s.n_tersensor / (s.n_dinilai + s.n_tersensor)) * 100)
    : 0
  const med = s.median_h20 === null ? '—' : `${s.median_h20 > 0 ? '+' : ''}${s.median_h20.toString().replace('.', ',')}%`
  return `${n} breakout · retest ${pct(s.pct_retest)} · bertahan ${pct(s.pct_bertahan)}`
    + ` · median H+20 ${med} · kena batas rugi ${pct(s.pct_sl)}`
    + ` · ${sensor}% belum genap H+20 (data habis)`
    + ' · pola deskriptif, bukan sinyal beli'
}

export function useStatRbs(kerangka: string, aktif: boolean): StatRbs | null {
  const [stat, setStat] = useState<StatRbs | null>(null)
  useEffect(() => {
    if (!aktif) { setStat(null); return }
    let batal = false
    muatStatRbs(kerangka).then((s) => { if (!batal) setStat(s) })
    return () => { batal = true }
  }, [kerangka, aktif])
  return stat
}
