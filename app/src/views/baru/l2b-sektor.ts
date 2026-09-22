/**
 * Pemetaan sektor bersama L2HariIni + L2Berkala. Sumbernya beda bentuk per
 * lapisan (harian_papan pakai nama sektor bebas berbahasa Inggris + dua
 * varian typo Indonesia; ms_ (bulanan) pakai kode indeks IDXxxx dari
 * indeks_kinerja) tapi label tampilannya disamakan supaya dua lapisan
 * konsisten.
 */
export interface SektorDef { id: string; label: string }

export const SEKTOR_URUT: SektorDef[] = [
  { id: 'energi', label: 'Energi' },
  { id: 'basic', label: 'Bahan Baku' },
  { id: 'industri', label: 'Industri' },
  { id: 'nonsiklikal', label: 'Konsumer Primer' },
  { id: 'siklikal', label: 'Konsumer Sekunder' },
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'keuangan', label: 'Keuangan' },
  { id: 'properti', label: 'Properti' },
  { id: 'teknologi', label: 'Teknologi' },
  { id: 'infrastruktur', label: 'Infrastruktur' },
  { id: 'transportasi', label: 'Transportasi' },
]

/** harian_papan/<tanggal>.json: ruas `sektor` per emiten. Dua varian typo
 *  ('Keuangan', 'Teknologi' — harusnya 'Financials'/'Technology') dan '-'
 *  (sektor tak diketahui, 1 emiten) sudah terukur di data 22 Sep 2026. */
export function normalisasiSektorHarian(raw: string): string | null {
  switch (raw) {
    case 'Energy': return 'energi'
    case 'Basic Materials': return 'basic'
    case 'Industrials': return 'industri'
    case 'Consumer Non-Cyclicals': return 'nonsiklikal'
    case 'Consumer Cyclicals': return 'siklikal'
    case 'Healthcare': return 'kesehatan'
    case 'Financials': case 'Keuangan': return 'keuangan'
    case 'Properties & Real Estate': return 'properti'
    case 'Technology': case 'Teknologi': return 'teknologi'
    case 'Infrastructures': return 'infrastruktur'
    case 'Transportation & Logistic': return 'transportasi'
    default: return null
  }
}

/** ms_<yymm>.json → indeks_kinerja: kode indeks sektor ("Sector Indices" +
 *  IDXTECHNO yang tercatat di grup lain). */
export const KODE_SEKTOR_BULANAN: Record<string, string> = {
  IDXENERGY: 'energi', IDXBASIC: 'basic', IDXINDUST: 'industri', IDXNONCYC: 'nonsiklikal',
  IDXCYCLIC: 'siklikal', IDXHEALTH: 'kesehatan', IDXFINANCE: 'keuangan', IDXPROPERT: 'properti',
  IDXTECHNO: 'teknologi', IDXINFRA: 'infrastruktur', IDXTRANS: 'transportasi',
}

export function labelSektor(id: string): string {
  return SEKTOR_URUT.find((s) => s.id === id)?.label ?? id
}
