import { useBulletinList } from '../../lib/dasbor/bulletin'

/**
 * Bulletin Arus Pasar — daftar publik edisi analisa teknikal & arus dana
 * broker terbit (#37a). Sumber data: arus-pasar/keluaran/index.json, dibuat
 * arus-pasar/generate_index.py dari edisi/*.json yang sudah punya PDF
 * dirender di keluaran/. Diserve dev server lewat middleware vite.config.ts
 * (mount /arus-pasar/keluaran, sama pola dengan /data).
 */
export function Bulletin() {
  const { daftar, error } = useBulletinList()

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Bulletin Arus Pasar</h1>
        <span className="sub">analisa teknikal &amp; arus dana broker, terbit berkala</span>
      </div>

      <div className="panel">
        <div className="panel-h"><span className="lbl">Edisi Terbit</span></div>
        <div className="panel-b">
          {error && <p className="muted">Gagal memuat daftar edisi: {error}</p>}
          {!error && daftar === null && <p className="muted">Memuat…</p>}
          {daftar && daftar.length === 0 && <p className="muted">Belum ada edisi terbit.</p>}
          {daftar && daftar.length > 0 && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Edisi</th>
                  <th>Tanggal</th>
                  <th>Emiten Dibahas</th>
                  <th className="r">Unduh</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((e) => (
                  <tr key={e.kode}>
                    <td><span className="tick">{e.kode}</span></td>
                    <td>{e.tanggal_id}</td>
                    <td>{e.emiten.join(', ')}</td>
                    <td className="r">
                      <a className="btn-p" href={`/arus-pasar/keluaran/${e.pdf}`} download>
                        Unduh PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
