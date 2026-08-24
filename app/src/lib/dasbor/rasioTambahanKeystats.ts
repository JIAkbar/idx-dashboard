/**
 * Ruas TAMBAHAN dari sumber Stockbit (rasio kunci + profil perusahaan) —
 * HANYA yang belum punya padanan tayang di fundamental lama
 * (data-idx/json/fundamental, dipakai `stockDetailData.ts`). Ruas yang SUDAH
 * tayang dari sumber lama (PE, PBV, ROE, Altman Z, F-Score, EV/EBIT,
 * Current Ratio, dst — lihat PanelValuasi/PanelSolvency/PanelEfektivitas/
 * PanelSkor di `stock-detail/KolomValuasi.tsx`) SENGAJA tidak diulang di
 * sini. Itu keputusan proyek 24 Agu 2026 (CLAUDE.md klausul 3b): mengganti
 * angka yang sudah tayang butuh persetujuan Johan lewat tabel pembanding,
 * bukan ditimpa diam-diam. Berkas ini murni MENAMBAH tiga kelompok yang
 * memang tak dimiliki sumber lama:
 *  - rasio bank/multifinance (NPL, CASA, CAR, LDR, NIM, dst — yfinance tak
 *    punya rasio industri spesifik ini, cuma terisi utk ~48 emiten sektor
 *    keuangan, sengaja disembunyikan total untuk emiten lain);
 *  - peringkat persentil terhadap seluruh emiten IDX (bukan rasio itu
 *    sendiri, tapi posisinya di antara emiten lain);
 *  - profil perusahaan naratif (alamat, kontak, sekretaris perusahaan,
 *    ringkasan pencatatan awal) — fundamental lama cuma punya `summary`
 *    Inggris dari penyedia lama, bukan alamat/kontak resmi.
 */

export interface RasioBank {
  nplGross: number | null
  nplCoverage: number | null
  casaRatio: number | null
  capitalAdequacyRatio: number | null
  loanToDepositRatio: number | null
  netInterestMargin: number | null
  costOfCredit: number | null
  npfGross: number | null
  npfCoverage: number | null
  financingToDepositRatio: number | null
}

export interface PeringkatPeer {
  marketCap: number | null
  peTtm: number | null
  earningsYield: number | null
  ps: number | null
  pb: number | null
  near52wHigh: number | null
}

export interface ProfilRingkas {
  alamat: string | null
  telepon: string | null
  email: string | null
  website: string | null
  latarBelakang: string | null
  sekretaris: { nama: string; telepon: string | null; email: string | null } | null
  pencatatanAwal: {
    tanggal: string | null
    harga: string | null
    jumlahSaham: string | null
    underwriters: string[]
  } | null
}

export interface TambahanKeystats {
  bank: RasioBank | null
  rank: PeringkatPeer | null
  profil: ProfilRingkas | null
}

interface BerkasKeystatsRasio {
  rasio?: Record<string, unknown>
}

interface BerkasProfilAddress {
  office?: string
  phone?: string
  website?: string
  email?: string[]
}
interface BerkasProfilSecretary {
  value?: string
}
interface BerkasProfilHistory {
  date?: string
  price?: string
  shares?: string
  underwriters?: string[]
}
interface BerkasProfil {
  address?: BerkasProfilAddress[]
  background?: string
  secretary?: BerkasProfilSecretary[]
  history?: BerkasProfilHistory
}

const CACHE = new Map<string, Promise<TambahanKeystats | null>>()

/** String "5.32%" / "-" / "1.234,00" → angka; kosong/"-" → null. */
export function angka(v: unknown): number | null {
  if (v == null) return null
  const s = String(v).trim()
  if (s === '' || s === '-' || s === 'N/A') return null
  const neg = s.startsWith('(') && s.endsWith(')')
  const bersih = s.replace(/[()]/g, '').replace(/,/g, '').replace(/%/g, '').trim()
  const n = parseFloat(bersih)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

// Parameternya `object`, BUKAN `Record<string, number | null>`. Antarmuka
// (`interface`) di TypeScript tak punya index signature implisit, jadi
// `RasioBank` dan `PeringkatPeer` tak bisa diberikan ke Record — `tsc -b`
// menolaknya dengan TS2345.
//
// Yang bikin ini lolos ke produksi: `tsc --noEmit` MELEWATKANNYA, sementara
// `tsc -b` (yang dipakai `npm run build`) menangkapnya. Tiga pemeriksaan
// berturut-turut memakai `--noEmit` dan semuanya melapor bersih, lalu setiap
// deployment gagal di langkah pertama. Periksa dengan perintah yang sama
// dengan yang dipakai build, bukan yang mirip.
function semuaKosong(o: object): boolean {
  return Object.values(o).every((v) => v == null)
}

async function ambilJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

export function muatTambahanKeystats(kode: string): Promise<TambahanKeystats | null> {
  let p = CACHE.get(kode)
  if (!p) {
    p = (async () => {
      const [ks, pr] = await Promise.all([
        ambilJson<BerkasKeystatsRasio>(`/data-idx/json/keystats_stockbit/${kode}.json`),
        ambilJson<BerkasProfil>(`/data-idx/json/profil_stockbit/${kode}.json`),
      ])
      if (!ks && !pr) return null
      const r = ks?.rasio ?? {}

      const bank: RasioBank = {
        nplGross: angka(r['NPL - Gross']),
        nplCoverage: angka(r['NPL - Coverage']),
        casaRatio: angka(r['CASA Ratio']),
        capitalAdequacyRatio: angka(r['Capital Adequacy Ratio']),
        loanToDepositRatio: angka(r['Loan to Deposit Ratio']),
        netInterestMargin: angka(r['Net Interest Margin (NIM)']),
        costOfCredit: angka(r['Cost of Credit']),
        npfGross: angka(r['NPF - Gross']),
        npfCoverage: angka(r['NPF - Coverage']),
        financingToDepositRatio: angka(r['Financing to Deposit Ratio']),
      }

      const rank: PeringkatPeer = {
        marketCap: angka(r['Rank (Market Cap)']),
        peTtm: angka(r['Rank (Current PE Ratio TTM)']),
        earningsYield: angka(r['Rank (Earnings Yield)']),
        ps: angka(r['Rank (P/S)']),
        pb: angka(r['Rank (P/B)']),
        near52wHigh: angka(r['Rank (Near 52 Weeks High)']),
      }

      let profil: ProfilRingkas | null = null
      if (pr) {
        const alamat = pr.address?.[0]
        let sekretaris: ProfilRingkas['sekretaris'] = null
        const sekRaw = pr.secretary?.[0]?.value
        if (sekRaw) {
          try {
            const s = JSON.parse(sekRaw) as { name?: string; phone?: string; email?: string }
            if (s.name) sekretaris = { nama: s.name, telepon: s.phone ?? null, email: s.email ?? null }
          } catch {
            // format tak terduga — biarkan null, jangan menebak
          }
        }
        const h = pr.history
        const pencatatanAwal = h && (h.date || h.price)
          ? {
              tanggal: h.date ?? null,
              harga: h.price ?? null,
              jumlahSaham: h.shares ?? null,
              underwriters: h.underwriters ?? [],
            }
          : null
        profil = {
          alamat: alamat?.office ?? null,
          telepon: alamat?.phone ?? null,
          email: alamat?.email?.[0] ?? null,
          website: alamat?.website ?? null,
          latarBelakang: pr.background ?? null,
          sekretaris,
          pencatatanAwal,
        }
      }

      return {
        bank: semuaKosong(bank) ? null : bank,
        rank: semuaKosong(rank) ? null : rank,
        profil,
      }
    })()
    CACHE.set(kode, p)
  }
  return p
}
