import { useCallback, useEffect, useState } from 'react'

/**
 * Tipe & fetch data Peta Investor. Port dari index_live.html piInit()
 * baris 4452-4472. Bentuk field diverifikasi langsung dari
 * data/investor_map.json (952 emiten, 6.728 baris holder) — BUKAN tebakan:
 * tiap holder cuma punya {name, cls, lf, pct}. Sumber asli (index_live.html)
 * banyak memakai h.type siap pakai ('CORP'/'IND'/'OTH') dan lf berisi kode
 * negara ('US','SG', dst) untuk shape/warna node "focused view" —
 * data/investor_map.json TIDAK punya field-field itu (cuma cls bebas-teks +
 * lf 'L'/'F'). `holderType()` di bawah menurunkan kategori kasar dari cls;
 * lihat catatan ponytail di graphRender.ts soal shape focused view.
 */

export interface Holder {
  name: string
  cls: string
  lf: 'L' | 'F'
  pct: number
}

export interface InvestorMapEntry {
  code: string
  issuer: string
  holders: Holder[]
}

/** Kategori kasar dari cls bebas-teks, dipakai badge tabel & filter tipe. */
export type HolderType = 'CORP' | 'IND' | 'OTH'

export function holderType(cls: string): HolderType {
  if (!cls) return 'OTH'
  if (/individual/i.test(cls)) return 'IND'
  return 'CORP'
}

/* piNodeColor() lama (5 warna jenuh: oranye/biru/ungu/hijau/merah muda) dihapus
   di Task 12 — palet simpul sekarang tinggal satu aksen amber + derajat abu-biru
   dan hidup di graphRender.ts (`WARNA`/`warnaSimpul`), satu tempat yang juga
   dipakai legenda. Hijau/merah dikunci untuk arah angka. */

/** Entitas terpilih (klik node graf / baris tabel / hasil pencarian) — dipakai GrafikJaringan, ByStock, ByInvestor, panel detail, dan search box supaya satu handler bisa dipakai semua sumber klik. */
export type GraphSelection =
  | { type: 'emiten'; code: string }
  | { type: 'investor'; name: string; cls: string; lf: string }

let cache: InvestorMapEntry[] | null = null
let inflight: Promise<InvestorMapEntry[]> | null = null

function load(): Promise<InvestorMapEntry[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/data/investor_map.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<InvestorMapEntry[]>
      })
      .then((data) => {
        cache = data
        return data
      })
      .catch((e: unknown) => {
        inflight = null
        throw e
      })
  }
  return inflight
}

/** Fetch-sekali-cache 590KB investor_map.json, dipakai bersama Grafik/By Stock/By Investor supaya ganti sub-view tidak fetch ulang. */
export function usePetaInvestor() {
  const [data, setData] = useState<InvestorMapEntry[] | null>(cache)
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (cache) {
      setData(cache)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    load()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat data investor')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  const retry = useCallback(() => {
    inflight = null
    setTick((t) => t + 1)
  }, [])

  return { data, loading, error, retry }
}

export interface InvestorHolding {
  code: string
  issuer: string
  pct: number
}

export interface InvestorRow {
  name: string
  type: HolderType
  lf: string
  cls: string
  holdings: InvestorHolding[]
}

let invMapCache: InvestorRow[] | null = null
let invMapSrc: InvestorMapEntry[] | null = null

/** Ekstrak+dedup investor unik lintas emiten. Port piGetInvMap() baris 256-270. Di-cache selama referensi `data` tidak berubah (data stabil setelah fetch pertama). */
export function getInvestorMap(data: InvestorMapEntry[]): InvestorRow[] {
  if (invMapCache && invMapSrc === data) return invMapCache
  const map = new Map<string, InvestorRow>()
  data.forEach((em) => {
    em.holders.forEach((h) => {
      let row = map.get(h.name)
      if (!row) {
        row = { name: h.name, type: holderType(h.cls), lf: h.lf, cls: h.cls, holdings: [] }
        map.set(h.name, row)
      }
      row.holdings.push({ code: em.code, issuer: em.issuer, pct: h.pct })
    })
  })
  invMapCache = [...map.values()].sort((a, b) => b.holdings.length - a.holdings.length)
  invMapSrc = data
  return invMapCache
}

export interface SearchHit {
  emitenHits: InvestorMapEntry[]
  investorHits: { name: string; cls: string; lf: string; count: number }[]
}

/** Port piShowDrop() baris 460-477 (bagian pencarian, tanpa render HTML). */
export function searchPetaInvestor(data: InvestorMapEntry[], qRaw: string): SearchHit {
  const q = qRaw.trim().toUpperCase()
  if (!q) return { emitenHits: [], investorHits: [] }

  const emitenHits = data
    .filter((e) => e.code.startsWith(q) || e.code.includes(q) || e.issuer.toUpperCase().includes(q))
    .slice(0, 8)

  const invMap = new Map<string, { cls: string; lf: string; count: number }>()
  data.forEach((e) => {
    e.holders.forEach((h) => {
      if (h.name.toUpperCase().includes(q)) {
        const entry = invMap.get(h.name)
        if (entry) entry.count++
        else invMap.set(h.name, { cls: h.cls, lf: h.lf, count: 1 })
      }
    })
  })
  const investorHits = [...invMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, info]) => ({ name, ...info }))

  return { emitenHits, investorHits }
}
