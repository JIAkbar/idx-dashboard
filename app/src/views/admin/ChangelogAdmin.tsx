import teks from '../../../../docs/CHANGELOG.md?raw'

/**
 * Changelog dibaca langsung dari docs/CHANGELOG.md — satu sumber kebenaran.
 * Menyalin isinya ke TSX akan membuat keduanya berbeda dalam beberapa bulan;
 * itu persis alasan popup "What's New" lama dibuang (papan #8).
 *
 * Penyaji sengaja seadanya: berkas ini hanya memakai "## judul" dan "- butir",
 * jadi pustaka markdown penuh tidak dibutuhkan.
 */
export function ChangelogAdmin() {
  const baris = teks.split('\n')
  return (
    <div className="lantai">
      <div className="panel">
        <div className="panel-h"><span className="lbl">Changelog</span></div>
        <div className="panel-b">
          {baris.map((b, i) => {
            if (b.startsWith('## ')) return <h2 key={i} className="lbl" style={{ marginTop: 18 }}>{b.slice(3)}</h2>
            if (b.startsWith('# ')) return <h1 key={i} style={{ fontSize: 19 }}>{b.slice(2)}</h1>
            if (b.startsWith('- ')) return <li key={i} style={{ marginLeft: 18 }}>{b.slice(2)}</li>
            return b.trim() ? <p key={i}>{b}</p> : null
          })}
        </div>
      </div>
    </div>
  )
}
