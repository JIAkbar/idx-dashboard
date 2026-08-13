import { useEffect, useState } from 'react'
import { useBulletinList } from '../../lib/dasbor/bulletin'
import { IkonMenu, IKON_SILANG } from '../../components/dasbor/IkonMenu'

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
 * Tipe edisi dari kode (#92) — pola generator arus-pasar: AP-<ddmmyy> harian
 * (build.py), AP-W<ddmmyy> mingguan (build_weekly.py), AP-M<mmyy> bulanan
 * (build_monthly.py); edisi uji berprefiks UJI-.
 */
function tipeEdisi(kode: string): 'Harian' | 'Mingguan' | 'Bulanan' {
  const k = kode.replace(/^UJI-/, '')
  if (k.startsWith('AP-W')) return 'Mingguan'
  if (k.startsWith('AP-M')) return 'Bulanan'
  return 'Harian'
}

/**
 * Bulletin Arus Pasar — daftar publik edisi analisa teknikal & arus dana
 * broker terbit (#37a). Sumber data: arus-pasar/keluaran/index.json, dibuat
 * arus-pasar/generate_index.py dari edisi/*.json yang sudah punya PDF
 * dirender di keluaran/. Diserve dev server lewat middleware vite.config.ts
 * (mount /arus-pasar/keluaran, sama pola dengan /data).
 *
 * #92: pencarian per emiten di header panel (chip emiten di baris juga bisa
 * diklik untuk mengisi filter), kolom Tipe (Harian/Mingguan/Bulanan dari kode
 * edisi), dan IHSG + Δ% digabung satu kolom (badge pola .ytd-bdg).
 */
export function Bulletin() {
  const { daftar, error } = useBulletinList()
  const peta = useIhsgMap()
  const [cari, setCari] = useState('')

  // Filter: kode emiten yang dibahas ATAU kode edisi (case-insensitive).
  const q = cari.trim().toUpperCase()
  // Nomor dihitung dari daftar penuh (index.json urut tanggal turun,
  // generate_index.py) SEBELUM difilter — nomor tiap edisi stabil.
  const baris = (daftar ?? []).map((e, i, arr) => ({ e, no: arr.length - i }))
  const tampil = q
    ? baris.filter(
        ({ e }) =>
          e.emiten.some((t) => t.toUpperCase().includes(q)) || e.kode.toUpperCase().includes(q),
      )
    : baris

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Bulletin Arus Pasar</h1>
        <span className="sub">analisa teknikal &amp; arus dana broker, terbit berkala</span>
      </div>

      <div className="panel">
        <div className="panel-h blt-h">
          <span className="lbl">Edisi Terbit</span>
          {daftar && daftar.length > 0 && (
            <span className="blt-cari">
              <input
                className="inp"
                type="text"
                value={cari}
                onChange={(ev) => setCari(ev.target.value)}
                placeholder="Cari emiten…"
                aria-label="Cari emiten atau kode edisi"
              />
              {cari !== '' && (
                <button
                  type="button"
                  className="blt-cari-x"
                  onClick={() => setCari('')}
                  title="Bersihkan pencarian"
                  aria-label="Bersihkan pencarian"
                >
                  <IkonMenu d={IKON_SILANG} size={11} />
                </button>
              )}
            </span>
          )}
        </div>
        <div className="panel-b">
          {error && <p className="muted">Gagal memuat daftar edisi: {error}</p>}
          {!error && daftar === null && <p className="muted">Memuat…</p>}
          {daftar && daftar.length === 0 && <p className="muted">Belum ada edisi terbit.</p>}
          {daftar && daftar.length > 0 && tampil.length === 0 && (
            <p className="muted">
              Tidak ada edisi yang membahas &ldquo;{cari.trim()}&rdquo;.{' '}
              <button type="button" className="blt-reset" onClick={() => setCari('')}>
                Tampilkan semua
              </button>
            </p>
          )}
          {tampil.length > 0 && (
            <div className="blt-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="r">No</th>
                    <th>Edisi</th>
                    <th>Tipe</th>
                    <th>Tanggal</th>
                    <th className="r">IHSG</th>
                    <th>Emiten Dibahas</th>
                    <th className="r">Unduh</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map(({ e, no }) => {
                    const h = peta?.get(e.tanggal)
                    return (
                      <tr key={e.kode}>
                        <td className="r blt-no">{no}</td>
                        <td><span className="tick">{e.kode}</span></td>
                        <td><span className="bchip blt-tipe">{tipeEdisi(e.kode)}</span></td>
                        <td>{e.tanggal_id}</td>
                        <td className="r num blt-ihsg">
                          {h ? (
                            <>
                              {fmtIhsg(h.ihsg)}{' '}
                              <span className={`ytd-bdg ${h.pct >= 0 ? 'u' : 'd'}`}>
                                {fmtPct(h.pct)}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {e.emiten.slice(0, 5).map((t) => (
                            <button
                              key={t}
                              type="button"
                              className="bchip blt-em"
                              onClick={() => setCari(t)}
                              title={`Cari edisi yang membahas ${t}`}
                            >
                              {t}
                            </button>
                          ))}
                          {/* ponytail: potong flat di 5 chip, tanpa ResizeObserver — "+N" statis cukup */}
                          {e.emiten.length > 5 && (
                            <span className="bchip blt-tipe" title={e.emiten.slice(5).join(', ')}>
                              +{e.emiten.length - 5}
                            </span>
                          )}
                        </td>
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
