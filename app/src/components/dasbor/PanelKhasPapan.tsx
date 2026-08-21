import { panelKhas } from '../../lib/dasbor/bedahEmiten'
import type { StockFundamental } from '../../lib/dasbor/stockDetailData'

/**
 * Panel "Panel Khas PAPAN" — dipindah dari halaman Bedah Emiten (pensiun 21
 * Agu 2026, isinya digabung ke Stock Detail). Altman Z-Score, Piotroski
 * F-Score, ROIC, ROCE, dan siklus konversi kas SUDAH tampil sebagai angka
 * mentah di panel lain (Solvabilitas, Efektivitas Manajemen, Skor &
 * Struktur) — panel ini beda: tiap angka disertai satu kalimat bacaan
 * ("zona aman", "sinyal kuat", dst.) dari `panelKhas()`
 * (`lib/dasbor/bedahEmiten.ts`). Yang tak bisa dihitung dari data yang ada
 * disebut apa adanya, tak pernah ditambal taksiran.
 */
export function PanelKhasPapan({ fd }: { fd: StockFundamental }) {
  const khas = panelKhas(fd)

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-h"><span className="lbl">Panel Khas PAPAN</span></div>
      <div className="panel-b">
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
          Ruas yang tak dipunyai dasbor pembanding. Yang tak bisa dihitung dari data yang ada disebut
          apa adanya — tak pernah ditambal taksiran.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 460 }}>
            <thead>
              <tr><th>Ukuran</th><th className="r">Nilai</th><th>Bacaannya</th></tr>
            </thead>
            <tbody>
              {khas.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td className="r num">{b.nilai}</td>
                  <td style={{ fontSize: 10.5, lineHeight: 1.55, color: 'var(--text2)' }}>{b.baca ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
