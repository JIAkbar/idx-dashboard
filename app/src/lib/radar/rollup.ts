/**
 * Rekam jejak Radar WDWL — agregat mingguan (per saham) & bulanan (per jenis
 * sinyal) dari arsip edisi. Logika murni; pemanggil yang memilih subset arsip
 * (minggu berjalan / bulan berjalan).
 */
import { type ArsipRadar, type BarisRadar, semuaBaris } from './arsip'
import { kalibrasiSinyal, LABEL_SINYAL, type JenisSinyal, type StatSinyal } from './skor'

export interface RingkasSaham {
  tik: string
  /** Jumlah edisi kehadiran (papan mana pun). */
  edisi: number
  /** Zona pada kemunculan pertama & terakhir (null bila tanpa zona). */
  zonaAwal: BarisRadar['zona']
  zonaAkhir: BarisRadar['zona']
  /** Return close kemunculan pertama → terakhir (desimal); null bila close hilang / hadir sekali. */
  ret: number | null
  /** Papan tempat kemunculan terakhir. */
  papan: 'watch' | 'penny'
}

/** Per saham: berapa edisi bertahan, perubahan zona, dan nasib harga selama hadir. */
export function rollupMingguan(arsip: ArsipRadar): RingkasSaham[] {
  const per = new Map<string, { edisi: number; first: BarisRadar; last: BarisRadar; papan: 'watch' | 'penny' }>()
  for (const e of arsip) {
    for (const { papan, row } of semuaBaris(e)) {
      const ada = per.get(row.tik)
      if (!ada) per.set(row.tik, { edisi: 1, first: row, last: row, papan })
      else {
        ada.edisi += 1
        ada.last = row
        ada.papan = papan
      }
    }
  }
  const out: RingkasSaham[] = []
  for (const [tik, v] of per) {
    const bisaRet = v.edisi > 1 && v.first.close !== null && v.first.close !== 0 && v.last.close !== null
    out.push({
      tik,
      edisi: v.edisi,
      zonaAwal: v.first.zona,
      zonaAkhir: v.last.zona,
      ret: bisaRet ? (v.last.close! - v.first.close!) / v.first.close! : null,
      papan: v.papan,
    })
  }
  // Yang BERTAHAN dulu (edisi terbanyak), lalu return terbesar.
  return out.sort((a, b) => b.edisi - a.edisi || (b.ret ?? -Infinity) - (a.ret ?? -Infinity))
}

export interface RingkasSinyal extends StatSinyal {
  label: string
  /** Rerata forward return IHSG pada rentang edisi yang sama (desimal); null tanpa data IHSG. */
  ihsgRet: number | null
}

/**
 * Leaderboard keandalan sinyal: hit-rate + rerata return per jenis vs IHSG.
 * `ihsg` = peta date_iso → close IHSG (dari /data-idx/json/index.json).
 */
export function rollupBulanan(arsip: ArsipRadar, ihsg?: Map<string, number>): RingkasSinyal[] {
  const stat = kalibrasiSinyal(arsip)
  // Benchmark: rerata return IHSG antar edisi beruntun di arsip ini.
  let ihsgRet: number | null = null
  if (ihsg) {
    const rets: number[] = []
    for (let i = 0; i + 1 < arsip.length; i++) {
      const a = ihsg.get(arsip[i].date_iso)
      const b = ihsg.get(arsip[i + 1].date_iso)
      if (a && b) rets.push((b - a) / a)
    }
    if (rets.length > 0) ihsgRet = rets.reduce((x, y) => x + y, 0) / rets.length
  }
  return (Object.keys(stat) as JenisSinyal[]).map((j) => ({
    ...stat[j],
    label: LABEL_SINYAL[j],
    ihsgRet,
  }))
}
