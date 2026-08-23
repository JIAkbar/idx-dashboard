/**
 * Data tab "Shareholders" Broker Summary v2 — dua sumber terpisah:
 * - `/data-idx/json/kepemilikan/<KODE>.json`: KSEI Balancepos bulanan
 *   (lokal/asing per jenis investor), port `renderShareholders()` bagian KSEI.
 * - `/data-idx/json/profil_stockbit/<KODE>.json`: pemegang saham ≥5%, anak
 *   usaha, direksi/komisaris — port bagian `DATA.profil` mockup, TAPI bentuk
 *   sumber aslinya beda dari `DATA.profil` mockup (itu contoh, ini nyata),
 *   jadi fungsi susun di sini yang menjembatani.
 */
import { useEffect, useState } from 'react'

// ── KSEI Balancepos ──────────────────────────────────────────────────────────

export interface BerkasKepemilikan {
  kode: string
  kolom: readonly string[]
  satuan: string
  jenis: Record<string, string>
  bulan: Record<string, number[]>
}

const cacheKepemilikan = new Map<string, Promise<BerkasKepemilikan | null>>()

export function muatKepemilikan(kode: string): Promise<BerkasKepemilikan | null> {
  let p = cacheKepemilikan.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/kepemilikan/${kode}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BerkasKepemilikan>) : null))
      .catch(() => null)
    cacheKepemilikan.set(kode, p)
  }
  return p
}

export function useKepemilikan(kode: string) {
  const [data, setData] = useState<BerkasKepemilikan | null>(null)
  useEffect(() => {
    let batal = false
    setData(null)
    muatKepemilikan(kode).then((d) => { if (!batal) setData(d) })
    return () => { batal = true }
  }, [kode])
  return data
}

// Indeks kolom tetap `kolom` berkas: [0]=lembar_tercatat [1]=harga
// [2..10]=lokal per jenis (9) [11]=lokal_total [12..20]=asing per jenis (9) [21]=asing_total.
const IDX_LOKAL = 2
const IDX_LOKAL_TOTAL = 11
const IDX_ASING = 12
const IDX_ASING_TOTAL = 21

export interface BarisKsei {
  jenis: string
  label: string
  lokalPct: number
  asingPct: number
  totalPct: number
  deltaSetahunPp: number
}

export interface RingkasKsei {
  bulanList: string[]
  bulanTerakhir: string
  lembarTercatat: number
  baris: BarisKsei[]
  asingTotalPct: number
  asingDeltaSetahunPp: number
}

/** Port bagian tabel KSEI `renderShareholders()` — 1 baris per jenis investor + baris "Asing total". */
export function susunKsei(data: BerkasKepemilikan): RingkasKsei | null {
  const bulanList = Object.keys(data.bulan).sort()
  if (bulanList.length === 0) return null
  const kunciJenis = Object.keys(data.jenis)
  const terakhir = data.bulan[bulanList[bulanList.length - 1]]
  const y12 = data.bulan[bulanList[Math.max(0, bulanList.length - 13)]]
  const tot = terakhir[0]
  const totY12 = y12[0]
  const baris = kunciJenis.map((j, i): BarisKsei => {
    const l = terakhir[IDX_LOKAL + i], a = terakhir[IDX_ASING + i]
    const totalPct = tot ? ((l + a) / tot) * 100 : 0
    const total12 = totY12 ? ((y12[IDX_LOKAL + i] + y12[IDX_ASING + i]) / totY12) * 100 : 0
    return { jenis: j, label: data.jenis[j], lokalPct: tot ? (l / tot) * 100 : 0, asingPct: tot ? (a / tot) * 100 : 0, totalPct, deltaSetahunPp: totalPct - total12 }
  }).sort((x, y) => y.totalPct - x.totalPct)
  const asingTotalPct = tot ? (terakhir[IDX_ASING_TOTAL] / tot) * 100 : 0
  const asingTotal12 = totY12 ? (y12[IDX_ASING_TOTAL] / totY12) * 100 : 0
  return {
    bulanList, bulanTerakhir: bulanList[bulanList.length - 1], lembarTercatat: tot,
    baris, asingTotalPct, asingDeltaSetahunPp: asingTotalPct - asingTotal12,
  }
}

/** Deret komposisi (lokal perorangan/korporasi/lainnya, asing korporasi/lainnya) — bahan area chart bertumpuk. */
export function deretKomposisiKsei(data: BerkasKepemilikan) {
  const bulanList = Object.keys(data.bulan).sort()
  const seri = [
    { label: 'Perorangan lokal', ambil: (r: number[]) => r[IDX_LOKAL + 4] /* ID */ },
    { label: 'Korporasi lokal', ambil: (r: number[]) => r[IDX_LOKAL + 1] /* CP */ },
    { label: 'Lokal lainnya', ambil: (r: number[]) => r[IDX_LOKAL_TOTAL] - r[IDX_LOKAL + 4] - r[IDX_LOKAL + 1] },
    { label: 'Korporasi asing', ambil: (r: number[]) => r[IDX_ASING + 1] /* CP */ },
    { label: 'Asing lainnya', ambil: (r: number[]) => r[IDX_ASING_TOTAL] - r[IDX_ASING + 1] },
  ]
  return {
    bulanList,
    seri: seri.map((s) => ({
      label: s.label,
      pct: bulanList.map((b) => { const r = data.bulan[b]; return r[0] ? (s.ambil(r) / r[0]) * 100 : 0 }),
    })),
  }
}

// ── Profil Stockbit (pemegang saham, anak usaha, pengurus) ──────────────────

interface EksekutifMentah { key: string; value: string }
export interface BerkasProfil {
  kode: string
  shareholder: Array<{ percentage: string; name: string; value: string; badges: string[] }>
  subsidiary: Array<{ company: string; percentage: string; types: string; value: string }>
  key_executive: {
    commissioner: EksekutifMentah[]
    independent_commissioner: EksekutifMentah[]
    president_commissioner: EksekutifMentah[]
    vice_president_commissioner: EksekutifMentah[]
    director: EksekutifMentah[]
    president_director: EksekutifMentah[]
    vice_president: EksekutifMentah[]
  }
}

const cacheProfil = new Map<string, Promise<BerkasProfil | null>>()

export function muatProfil(kode: string): Promise<BerkasProfil | null> {
  let p = cacheProfil.get(kode)
  if (!p) {
    p = fetch(`/data-idx/json/profil_stockbit/${kode}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<BerkasProfil>) : null))
      .catch(() => null)
    cacheProfil.set(kode, p)
  }
  return p
}

export function useProfil(kode: string) {
  const [data, setData] = useState<BerkasProfil | null>(null)
  useEffect(() => {
    let batal = false
    setData(null)
    muatProfil(kode).then((d) => { if (!batal) setData(d) })
    return () => { batal = true }
  }, [kode])
  return data
}

/** "170.00 B" / "30.43 M" / "577,851" → angka lembar penuh. */
export function angkaSingkatKeLembar(teks: string): number | null {
  const m = /^([\d,.]+)\s*([BMK])?$/i.exec(teks.trim())
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  if (Number.isNaN(n)) return null
  const suf = m[2]?.toUpperCase()
  if (suf === 'B') return n * 1e9
  if (suf === 'M') return n * 1e6
  if (suf === 'K') return n * 1e3
  return n
}

export interface BarisPemegangSaham {
  nama: string
  kategori: string
  persen: number
  lembar: number | null
  pengendali: boolean
}

/** Port tabel "Pemegang saham ≥5% & pengendali" — kategori tak tersedia di sumber, ditinggal '—'. */
export function pemegangSaham(p: BerkasProfil): BarisPemegangSaham[] {
  return [...p.shareholder]
    .map((s) => ({
      nama: s.name, kategori: '—', persen: Number(s.percentage.replace('%', '')) || 0,
      lembar: angkaSingkatKeLembar(s.value), pengendali: s.badges.includes('pengendali'),
    }))
    .filter((s) => s.persen > 0)
    .sort((a, b) => b.persen - a.persen)
}

export interface BarisAnakUsaha {
  nama: string
  bidang: string
  persen: number | null
  nilai: number | null
}

export function anakUsaha(p: BerkasProfil): BarisAnakUsaha[] {
  return [...p.subsidiary]
    .map((s) => ({
      nama: s.company, bidang: s.types,
      persen: s.percentage ? Number(s.percentage.replace('%', '')) : null,
      nilai: s.value ? Number(s.value) : null,
    }))
    .sort((a, b) => (b.nilai ?? 0) - (a.nilai ?? 0))
}

export interface Pengurus {
  direksi: string[]
  komisaris: string[]
}

/** Gabung seluruh peran direksi/komisaris jadi "Nama (jabatan)" — port teks "Pengurus" mockup. */
export function pengurus(p: BerkasProfil): Pengurus {
  const ke = p.key_executive
  const label = (jabatan: string, arr: EksekutifMentah[] | undefined) =>
    (arr ?? []).filter((d) => d.value).map((d) => `${d.value} (${jabatan})`)
  return {
    direksi: [
      ...label('presiden direktur', ke.president_director),
      ...label('wakil presiden direktur', ke.vice_president),
      ...label('direktur', ke.director),
    ],
    komisaris: [
      ...label('presiden komisaris', ke.president_commissioner),
      ...label('wakil presiden komisaris', ke.vice_president_commissioner),
      ...label('komisaris', ke.commissioner),
      ...label('komisaris independen', ke.independent_commissioner),
    ],
  }
}
