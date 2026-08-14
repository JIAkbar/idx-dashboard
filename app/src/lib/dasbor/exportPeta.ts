import * as XLSX from 'xlsx'
import { holderType, type InvestorMapEntry } from './petaInvestorData'
import { afiliasiUntukEmiten } from './brokerAfiliasi'

/** Export XLS Peta Investor — tiga mode (emiten+cabang, investor, seluruh
 *  dataset). SheetJS menulis .xlsx asli multi-sheet langsung di browser;
 *  tanpa server, data yang diekspor persis data yang sedang dirender. */

const TIPE: Record<'CORP' | 'IND' | 'OTH', string> = { CORP: 'Corporate', IND: 'Individual', OTH: 'Tipe tak terisi' }

function lokalAsing(lf: string): string {
  return lf === 'F' ? 'Asing' : 'Lokal'
}

function unduh(wb: XLSX.WorkBook, nama: string) {
  const tgl = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `peta-investor-${nama}-${tgl}.xlsx`)
}

function sheet(wb: XLSX.WorkBook, nama: string, baris: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(baris)
  // lebar kolom kira-kira dari isi terpanjang (cap 60) — murni kosmetik
  ws['!cols'] = baris[0].map((_, c) => ({
    wch: Math.min(60, Math.max(...baris.map((r) => String(r[c] ?? '').length)) + 2),
  }))
  XLSX.utils.book_append_sheet(wb, ws, nama)
}

/** Emiten + cabang: pemegang emiten ini, lalu emiten LAIN yang dipegang para
 *  pemegang itu (jaringan 2 tingkat — persis cabang yang tampak di graf). */
export function exportEmiten(data: InvestorMapEntry[], code: string) {
  const em = data.find((e) => e.code === code)
  if (!em) return
  const wb = XLSX.utils.book_new()

  sheet(wb, 'Pemegang', [
    ['Pemegang', 'Tipe', 'Lokal/Asing', '%'],
    ...em.holders.map((h) => [h.name, TIPE[holderType(h.cls)], lokalAsing(h.lf), h.pct]),
  ])

  const cabang: (string | number)[][] = [['Pemegang', 'Kode', 'Emiten', '%']]
  for (const h of em.holders)
    for (const e of data) {
      if (e.code === code) continue
      const ikut = e.holders.find((x) => x.name === h.name)
      if (ikut) cabang.push([h.name, e.code, e.issuer, ikut.pct])
    }
  sheet(wb, 'Cabang', cabang.length > 1 ? cabang : [...cabang, ['(tidak ada emiten lain yang dipegang pemegang yang sama)', '', '', '']])

  const af = afiliasiUntukEmiten(code)
  sheet(wb, 'Broker Terafiliasi', [
    ['Kode Broker', 'Sekuritas', 'Grup', 'Saham Segrup'],
    ...(af.length
      ? af.map((a) => [a.kode, a.sekuritas, a.grup, a.emiten.join(', ')])
      : [['(belum ada sekuritas segrup tercatat — kurasi redaksi)', '', '', '']]),
  ])

  unduh(wb, `emiten-${code}`)
}

/** Investor: seluruh portofolio ≥1% miliknya. */
export function exportInvestor(data: InvestorMapEntry[], nama: string) {
  const wb = XLSX.utils.book_new()
  const baris: (string | number)[][] = [['Kode', 'Emiten', '%']]
  for (const e of data) {
    const h = e.holders.find((x) => x.name === nama)
    if (h) baris.push([e.code, e.issuer, h.pct])
  }
  sheet(wb, 'Portofolio', baris)
  unduh(wb, `investor-${nama.replace(/[^\w-]+/g, '_').slice(0, 40)}`)
}

/** Seluruh dataset flat — satu baris per relasi emiten–pemegang; bahan pivot Excel. */
export function exportSemua(data: InvestorMapEntry[]) {
  const wb = XLSX.utils.book_new()
  const baris: (string | number)[][] = [['Kode', 'Emiten', 'Pemegang', 'Tipe', 'Lokal/Asing', '%']]
  for (const e of data)
    for (const h of e.holders)
      baris.push([e.code, e.issuer, h.name, TIPE[holderType(h.cls)], lokalAsing(h.lf), h.pct])
  sheet(wb, 'Kepemilikan', baris)
  unduh(wb, 'semua')
}
