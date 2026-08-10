import type { Edisi } from '../../lib/skor/types'

export function Kaki({ ed }: { ed: Edisi }) {
  return (
    <footer className="foot">
      <span className="kode">{ed.edisi}</span>
      <span>Arus Pasar · Analisis probabilistik, bukan ajakan transaksi.</span>
    </footer>
  )
}
