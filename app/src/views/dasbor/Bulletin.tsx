import { useEffect, useState } from 'react'
import { useBulletinList } from '../../lib/dasbor/bulletin'
import { IkonMenu } from '../../components/dasbor/IkonMenu'

/** Panah unduh ke tray — lokal view ini, belum ada padanannya di IkonMenu.tsx. */
const IKON_UNDUH = 'M12 4v10M7.5 10.5L12 15l4.5-4.5M5 19h14'

/**
 * IHSG per tanggal ISO dari data-idx/json/index.json (#78) — index-nya saja
 * sudah memuat close (`ihsg`) + perubahan % (`ihsg_pct`) per hari bursa, jadi
 * tidak perlu fetch berkas per-tanggal. Helper lokal view: dataHarian.ts tidak
 * diubah, cache modul sendiri (pola sama useBulletinList).
 */
interface IhsgHari {
  ihsg: number
  pct: number
}
let cacheIhsg: Map<string, IhsgHari> | null = null

function useIhsgMap() {
  const [peta, setPeta] = useState<Map<string, IhsgHari> | null>(cacheIhsg)

  useEffect(() => {
    if (cacheIhsg) return
    let batal = false
    fetch('/data-idx/json/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ dates?: { date_iso: string; ihsg: number; ihsg_pct: number }[] }>
      })
      .then((j) => {
        if (batal) return
        cacheIhsg = new Map((j.dates ?? []).map((d) => [d.date_iso, { ihsg: d.ihsg, pct: d.ihsg_pct }]))
        setPeta(cacheIhsg)
      })
      // IHSG pelengkap — gagal fetch berarti kolomnya "—", daftar edisi tetap tampil.
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [])

  return peta
}

const fmtIhsg = (v: number) =>
  v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`

/**
 * Bulletin Arus Pasar — daftar publik edisi analisa teknikal & arus dana
 * broker terbit (#37a). Sumber data: arus-pasar/keluaran/index.json, dibuat
 * arus-pasar/generate_index.py dari edisi/*.json yang sudah punya PDF
 * dirender di keluaran/. Diserve dev server lewat middleware vite.config.ts
 * (mount /arus-pasar/keluaran, sama pola dengan /data).
 */
export function Bulletin() {
  const { daftar, error } = useBulletinList()
  const peta = useIhsgMap()

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
            <div className="blt-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="r">No</th>
                    <th>Edisi</th>
                    <th>Tanggal</th>
                    <th className="r">IHSG</th>
                    <th className="r">&Delta;%</th>
                    <th>Emiten Dibahas</th>
                    <th className="r">Unduh</th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((e, i) => {
                    // index.json urut tanggal turun (generate_index.py) —
                    // edisi pertama terbit = No 1, nomor tiap edisi stabil.
                    const no = daftar.length - i
                    const h = peta?.get(e.tanggal)
                    return (
                      <tr key={e.kode}>
                        <td className="r blt-no">{no}</td>
                        <td><span className="tick">{e.kode}</span></td>
                        <td>{e.tanggal_id}</td>
                        <td className="r num">{h ? fmtIhsg(h.ihsg) : '—'}</td>
                        <td className={`r num ${h ? (h.pct >= 0 ? 'up' : 'dn') : ''}`}>
                          {h ? fmtPct(h.pct) : '—'}
                        </td>
                        <td>{e.emiten.join(', ')}</td>
                        <td className="r">
                          <a
                            className="blt-dl"
                            href={`/arus-pasar/keluaran/${e.pdf}`}
                            download
                            title={`Unduh ${e.pdf}`}
                          >
                            <IkonMenu d={IKON_UNDUH} size={13} />
                            PDF
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
