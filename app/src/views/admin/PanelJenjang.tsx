import { useEffect, useState } from 'react'
import { daftarJenjang, type JenjangRow } from '../../lib/jenjang'
import { IkonJenjang } from '../../components/dasbor/IkonJenjang'

/**
 * Tabel acuan jenjang kontributor — dipakai di tab Akun (menjelaskan kolom
 * Jenjang) dan tab Akses (menjelaskan dropdown "jenjang minimum").
 *
 * Isinya dibaca dari tabel `jenjang`, BUKAN ditulis ulang sebagai konstanta
 * di sini: ambang yang menentukan kuota dan ambang yang tampil di layar harus
 * berasal dari satu sumber, kalau tidak keduanya akan berselisih begitu
 * angkanya diubah.
 */
export function PanelJenjang({ ringkas = false }: { ringkas?: boolean }) {
  const [baris, setBaris] = useState<JenjangRow[]>([])
  const [galat, setGalat] = useState(false)

  useEffect(() => {
    let batal = false
    daftarJenjang()
      .then((j) => !batal && setBaris(j))
      .catch(() => !batal && setGalat(true))
    return () => { batal = true }
  }, [])

  if (galat) return null
  if (baris.length === 0) return null

  return (
    <section className="panel">
      <div className="panel-h">
        <span className="lbl">Jenjang Kontributor</span>
        <span className="muted" style={{ fontSize: 11 }}>
          naik otomatis dari setoran yang lolos kurasi
        </span>
      </div>
      <div className="panel-b">
        <p className="muted" style={{ marginTop: 0, fontSize: 11.5, lineHeight: 1.6, maxWidth: '78ch' }}>
          Kedua syarat harus terpenuhi bersamaan. Akurasi dihitung dari setoran yang sudah
          dikurasi saja — yang masih menunggu tidak ikut membagi, supaya kontributor tidak
          dirugikan oleh antrean kurasi. Kuota manual di kolom sebelah menimpa kuota jenjang;
          superadmin tidak dibatasi keduanya.
        </p>
        <div className="af-gulir">
          <table className="tbl">
            <thead>
              <tr>
                <th>Jenjang</th>
                <th className="af-c">Setoran disetujui</th>
                <th className="af-c">Akurasi minimum</th>
                <th className="af-c">Kuota/hari</th>
                {!ringkas && <th>Yang terbuka</th>}
              </tr>
            </thead>
            <tbody>
              {baris.map((j) => (
                <tr key={j.tier}>
                  <td>
                    {/* Lencana kecil di tiap baris: enam nama jenjang berturut
                        terbaca sebagai daftar kata sampai warnanya ikut hadir —
                        logam dan jumlah takiknya membuat urutannya kelihatan
                        sebelum kolom angkanya dibaca. */}
                    <span className="pj-nama">
                      <IkonJenjang tier={j.tier} nama={j.nama} size={26} />
                      <span>
                        <b>{j.nama}</b>{' '}
                        <span className="muted" style={{ fontSize: 10 }}>tier {j.tier}</span>
                      </span>
                    </span>
                  </td>
                  <td className="af-c">{j.min_disetujui === 0 ? '—' : `${j.min_disetujui}+`}</td>
                  <td className="af-c">{!j.min_akurasi ? '—' : `${j.min_akurasi}%`}</td>
                  <td className="af-c">{j.kuota}</td>
                  {!ringkas && <td className="muted">{j.hak ?? '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
