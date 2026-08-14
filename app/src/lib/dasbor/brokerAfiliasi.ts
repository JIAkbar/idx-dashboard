/**
 * Kurasi afiliasi broker (anggota bursa) ↔ grup konglomerasi emiten IDX.
 *
 * Dipakai Peta Investor untuk menandai broker yang satu grup dengan emiten —
 * aktivitas broker terafiliasi di saham grupnya sendiri adalah salah satu
 * jejak klasik "bandar menampung barangnya sendiri" (bukan bukti, tapi layak
 * diperhatikan saat membaca broker summary).
 *
 * SIFAT DATA: kurasi redaksi per Agustus 2026, hanya afiliasi yang publik dan
 * berkeyakinan tinggi (kepemilikan/grup usaha yang sama). Bukan daftar lengkap
 * 88 anggota bursa — broker independen/asing tanpa emiten tercatat satu grup
 * sengaja tidak dimasukkan. Perbarui manual bila ada aksi korporasi.
 */

export interface AfiliasiBroker {
  /** Kode anggota bursa di broker summary (2 huruf). */
  kode: string
  sekuritas: string
  grup: string
  /** Ticker emiten tercatat yang satu grup usaha dengan sekuritas ini. */
  emiten: string[]
}

export const AFILIASI_BROKER: AfiliasiBroker[] = [
  { kode: 'CC', sekuritas: 'Mandiri Sekuritas', grup: 'Bank Mandiri', emiten: ['BMRI'] },
  { kode: 'NI', sekuritas: 'BNI Sekuritas', grup: 'Bank Negara Indonesia', emiten: ['BBNI'] },
  { kode: 'OD', sekuritas: 'BRI Danareksa Sekuritas', grup: 'Bank Rakyat Indonesia', emiten: ['BBRI'] },
  { kode: 'SQ', sekuritas: 'BCA Sekuritas', grup: 'BCA / Djarum', emiten: ['BBCA'] },
  { kode: 'GR', sekuritas: 'Panin Sekuritas', grup: 'Panin', emiten: ['PNBN', 'PNLF', 'PNIN', 'PANS', 'CFIN'] },
  { kode: 'DH', sekuritas: 'Sinarmas Sekuritas', grup: 'Sinar Mas', emiten: ['SMMA', 'BSIM', 'DSSA', 'GEMS', 'INKP', 'TKIM', 'SMAR', 'BSDE', 'DUTI'] },
  { kode: 'EP', sekuritas: 'MNC Sekuritas', grup: 'MNC', emiten: ['BHIT', 'BMTR', 'MNCN', 'BABP', 'IPTV', 'KPIG'] },
  { kode: 'KI', sekuritas: 'Ciptadana Sekuritas Asia', grup: 'Lippo', emiten: ['LPKR', 'LPCK', 'LPPF', 'MPPA', 'SILO', 'MLPL', 'LINK', 'LPGI'] },
  { kode: 'ZP', sekuritas: 'Maybank Sekuritas Indonesia', grup: 'Maybank', emiten: ['BNII'] },
  { kode: 'YU', sekuritas: 'CGS International Sekuritas', grup: 'CGS–CIMB', emiten: ['BNGA'] },
  { kode: 'TP', sekuritas: 'OCBC Sekuritas Indonesia', grup: 'OCBC', emiten: ['NISP'] },
  { kode: 'LG', sekuritas: 'Trimegah Sekuritas Indonesia', grup: 'Trimegah', emiten: ['TRIM'] },
  { kode: 'LS', sekuritas: 'Reliance Sekuritas Indonesia', grup: 'Reliance', emiten: ['RELI'] },
  { kode: 'MU', sekuritas: 'Minna Padi Investama Sekuritas', grup: 'Minna Padi', emiten: ['PADI'] },
  { kode: 'MI', sekuritas: 'Victoria Sekuritas Indonesia', grup: 'Victoria', emiten: ['BVIC', 'VICO', 'VINS'] },
  { kode: 'PG', sekuritas: 'Panca Global Sekuritas', grup: 'Panca Global', emiten: ['PEGE'] },
  { kode: 'RS', sekuritas: 'Yulie Sekuritas Indonesia', grup: 'Yulie', emiten: ['YULE'] },
  { kode: 'SF', sekuritas: 'Surya Fajar Sekuritas', grup: 'Surya Fajar Capital', emiten: ['SFAN'] },
  { kode: 'AF', sekuritas: 'Harita Kencana Sekuritas', grup: 'Harita', emiten: ['NCKL', 'CITA'] },
  { kode: 'AP', sekuritas: 'Pacific Sekuritas Indonesia', grup: 'Pacific Strategic', emiten: ['APIC'] },
]

const PETA_EMITEN: ReadonlyMap<string, AfiliasiBroker[]> = (() => {
  const m = new Map<string, AfiliasiBroker[]>()
  for (const a of AFILIASI_BROKER)
    for (const t of a.emiten) {
      const arr = m.get(t) ?? []
      arr.push(a)
      m.set(t, arr)
    }
  return m
})()

/** Broker yang satu grup usaha dengan `ticker` (array kosong bila tak ada). */
export function afiliasiUntukEmiten(ticker: string): AfiliasiBroker[] {
  return PETA_EMITEN.get(ticker.toUpperCase()) ?? []
}
