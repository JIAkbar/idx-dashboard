/**
 * Tipe bersama Broker Summary. Data contoh BS_DATA (transkrip 3 hari Jun 2026
 * dari index_live.html) DIHAPUS di #99 — seluruh tab kini pakai data nyata:
 * Inventory/Kuadran dari bs_YYMMDD.json (brokerHarian.ts), NEGO/Flow dari
 * ds_YYMMDD.json (flowNego.ts).
 */

export interface BrokerRow {
  kode: string
  nama: string
  vol: number
  nilai: number
  freq: number
  /** Rank by nilai (1 = nilai terbesar). */
  rn: number
  /** Rank by frekuensi (1 = frekuensi terbesar). */
  rf: number
}
