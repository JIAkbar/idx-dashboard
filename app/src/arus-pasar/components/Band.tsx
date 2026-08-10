import type { Edisi } from '../../lib/skor/types'

export function Band({ ed, eyebrow = 'Tinjauan Teknikal & Arus Dana Harian' }: { ed: Edisi; eyebrow?: string }) {
  return (
    <header className="band">
      <div className="m">
        <h1>ARUS PASAR</h1>
        <div className="sub">{eyebrow}</div>
      </div>
      <div className="e">
        {ed.tanggal_id}
        <br />
        <span className="kode">{ed.edisi}</span>
      </div>
    </header>
  )
}
