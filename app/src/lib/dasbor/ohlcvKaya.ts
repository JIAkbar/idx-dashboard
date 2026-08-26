/**
 * Ruas kaya OHLCV (nilai transaksi, frekuensi, aliran asing, saham beredar)
 * untuk Grafik Emiten — dibaca LANGSUNG dari `ohlcv_stockbit/<KODE>.json`
 * (17 ruas), bukan dari `ohlc/<KODE>.json` yang dipakai buat lilin/volume
 * (6 ruas, dan folder itu sedang dipegang pekerjaan lain — jangan disentuh).
 *
 * Sumbernya sama dengan Broker Summary v2 (`brokerEmitenV2.ts:muatOhlcv`),
 * tapi modulnya berdiri sendiri di sini supaya tak menyunting berkas yang
 * dipegang agen lain, dan supaya bisa membawa dua ruas yang V2 belum pakai
 * (`frequency`, `shareoutstanding`).
 *
 * Cakupan: emiten sejak ±2004 (server Stockbit), IHSG sejak 1997-07-01.
 * Lilin/volume SEBELUM itu tetap tergambar (isi dari Yahoo lewat `ohlc/`),
 * tapi baris ini tidak akan ketemu tanggalnya — pemanggil wajib menjatuhkan
 * baliknya secara jujur (lihat `mulai`), bukan menunjukkan nol.
 */
import { useEffect, useState } from 'react'

export interface BarisKaya {
  /** Rupiah — nilai transaksi hari itu. */
  nilai: number
  /** Kali — jumlah transaksi hari itu. */
  frekuensi: number
  /** Rupiah — LANGSUNG dari sumber, bukan taksiran lembar×harga. */
  foreignBeli: number
  foreignJual: number
  /** Lembar — saham beredar per tanggal itu (ikut aksi korporasi). */
  sahamBeredar: number
}

export interface OhlcvKaya {
  /** Tanggal bar pertama yang tersedia, atau `null` kalau berkasnya kosong/gagal. */
  mulai: string | null
  byDate: Map<string, BarisKaya>
}

interface BerkasMentah {
  kolom: readonly string[]
  bar: (string | number)[][]
}

const KOSONG: OhlcvKaya = { mulai: null, byDate: new Map() }
const cache = new Map<string, Promise<OhlcvKaya>>()
const cacheSejak = new Map<string, number>()
// TTL 30 menit (audit kesegaran 27 Agu §2) — pola screener.ts; tanpa ini data halaman membeku sampai muat-ulang penuh.
const UMUR_CACHE_MS = 30 * 60 * 1000

/** Indeks kolom tetap (`kolom` di berkas): tanggal,unixdate,o,h,l,c,volume,value,
 *  frequency,foreignbuy,foreignsell,foreignflow,dividend,shareoutstanding,…
 *  Fungsi murni (dipisah dari fetch) supaya bisa diuji tanpa jaringan. */
export function keBarisKaya(b: (string | number)[]): [string, BarisKaya] {
  return [b[0] as string, {
    nilai: b[7] as number,
    frekuensi: b[8] as number,
    foreignBeli: b[9] as number,
    foreignJual: b[10] as number,
    sahamBeredar: b[13] as number,
  }]
}

function muat(kode: string): Promise<OhlcvKaya> {
  const sejak = cacheSejak.get(kode)
  if (sejak !== undefined && Date.now() - sejak >= UMUR_CACHE_MS) {
    cache.delete(kode)
    cacheSejak.delete(kode)
  }
  let p = cache.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/ohlcv_stockbit/${kode}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BerkasMentah>) : null))
      .then((j) => {
        if (!j || j.bar.length === 0) return KOSONG
        const byDate = new Map(j.bar.map(keBarisKaya))
        return { mulai: j.bar[0][0] as string, byDate }
      })
      .catch(() => KOSONG)
    cache.set(kode, p)
    cacheSejak.set(kode, Date.now())
  }
  return p
}

/** Satu emiten, satu fetch — sama pola dengan `berkas` OHLC utama di GrafikEmiten. */
export function useOhlcvKaya(kode: string): OhlcvKaya {
  const [data, setData] = useState<OhlcvKaya>(KOSONG)
  useEffect(() => {
    let batal = false
    setData(KOSONG)
    muat(kode).then((d) => { if (!batal) setData(d) })
    return () => { batal = true }
  }, [kode])
  return data
}
