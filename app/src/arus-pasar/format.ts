/** Port 1:1 dari arus-pasar/build.py — format angka gaya Indonesia. */

export function fmt(n: number, des = 0): string {
  const s = n.toFixed(des)
  const [intPart, decPart] = s.split('.')
  const neg = intPart.startsWith('-')
  const digits = neg ? intPart.slice(1) : intPart
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = neg ? '-' : ''
  return decPart ? `${sign}${withDots},${decPart}` : `${sign}${withDots}`
}

/** Nilai dalam juta Rp -> '8,3B' / '921,7M' gaya Stockbit. */
export function fmtRp(juta: number): string {
  if (Math.abs(juta) >= 1000) return fmt(juta / 1000, 1) + 'B'
  return fmt(juta, 1) + 'M'
}

export function fmtLot(lot: number): string {
  return lot >= 1000 ? fmt(lot / 1000, 1) + 'K' : fmt(lot)
}
