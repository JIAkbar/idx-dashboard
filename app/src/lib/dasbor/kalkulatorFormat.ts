/**
 * Port fmtModeInp/parseModeInp (index_live.html baris 3564-3581) — input angka
 * bertitik-ribuan id-ID dipakai mode "End Average" & "Average Down Value" di ADC.
 *
 * Beda dari sumber: state disimpan sebagai string digit mentah di React (bukan
 * properti DOM `_raw`), lalu diformat untuk ditampilkan. Sumber asli reparse
 * `el.value` (yang sudah berisi titik ribuan, mis. "1.500") lewat
 * `parseFloat(...replace(/[^0-9.]/g,''))` saat `_raw` belum ada (mis. sesudah
 * load dari localStorage) — itu bug, karena titik ribuan dibaca sebagai titik
 * desimal ("1.500" -> 1.5). Pola di sini (digit mentah sebagai source of truth)
 * tidak punya celah itu; rumus kalkulasi lain tidak berubah.
 */
export function onlyDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

export function formatRibuan(digits: string): string {
  return digits === '' ? '' : parseInt(digits, 10).toLocaleString('id-ID')
}

export function parseRibuan(digits: string): number {
  return digits === '' ? 0 : parseInt(digits, 10)
}
