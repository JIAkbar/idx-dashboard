import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LABEL_STATUS, ambilVonisTesis, batalkanTesis, pesanGalat, ringkasTesis, useSisaKuotaTesis,
  useTesisSaya, type TesisRow, type VonisTesis,
} from '../../lib/tesis'

/**
 * Tab Tesis — pengganti tab Unggah untuk kontributor (antrean #3).
 *
 * Bedanya dengan tab lama bukan bentuk melainkan siapa yang memutuskan: dulu
 * kurator menilai tangkapan layar, sekarang **mesin** menilai tesis dengan
 * aturan yang sama persis dengan rekam jejak PAPAN sendiri. Halaman ini tak
 * menghitung menang/kalah sama sekali — ia membaca vonis yang sudah ditulis
 * hakim, sama seperti tab Riwayat & Win Rate sesudah antrean #7.
 */
export function TesisTab() {
  const { session } = useAuth()
  const [pemicu, setPemicu] = useState(0)
  const { baris: mentah, galat, muat } = useTesisSaya()
  const sisaKuota = useSisaKuotaTesis(pemicu)
  const [sibuk, setSibuk] = useState<string | null>(null)

  // Vonis hakim ditempelkan ke baris tabel saat MEMBACA. Tabel menyimpan apa
  // yang disetor; hakim yang memutuskan menang/kalah, dan halaman ini tak
  // menghitung apa pun sendiri.
  const [vonis, setVonis] = useState<Map<string, VonisTesis>>(new Map())
  useEffect(() => { void ambilVonisTesis().then(setVonis) }, [])
  const baris = mentah?.map((t) => {
    const v = vonis.get(t.id)
    return v ? { ...t, status: v.status, ambigu: v.ambigu, harga_akhir: v.hargaAkhir,
                 hari_terpakai: v.hariTerpakai } : t
  }) ?? null

  async function batal(t: TesisRow) {
    setSibuk(t.id)
    try {
      await batalkanTesis(t.id)
      await muat()
      setPemicu((n) => n + 1)
    } catch (e) {
      alert(pesanGalat(e))
    } finally {
      setSibuk(null)
    }
  }

  if (!session) return <p className="muted" style={{ padding: 14 }}>Masuk dulu untuk melihat tesismu.</p>

  const r = ringkasTesis(baris ?? [])

  return (
    <div className="panel">
      <div className="panel-b">
        <div className="bilah-kendali">
          <div className="grup-k">
            <span className="grup-lbl">Tesis saya</span>
            <span className="be-statis">{baris?.length ?? 0}</span>
          </div>
          <span className="pemisah-v" aria-hidden="true" />
          <div className="grup-k grup-kanan">
            <span className="muted">
              {sisaKuota == null ? 'kuota belum terbaca' : <>sisa kuota hari ini <b>{sisaKuota}</b></>}
            </span>
          </div>
        </div>

        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Tesis dinilai <b>mesin</b>, bukan dikurasi. Aturannya sama dengan rekam jejak PAPAN: hari sinyal tak
          ikut dinilai, target dan batas rugi yang tersentuh di hari yang sama dihitung <b>kalah</b>, dan harga
          yang tak pernah masuk area dihitung <b>tak masuk</b> — bukan dibuang. Setor dari halaman{' '}
          <Link to="/berkas-emiten" className="tick">Berkas Emiten</Link>.
        </p>

        {galat && <p className="dn" style={{ marginTop: 8, fontSize: 12 }}>{galat}</p>}
      </div>

      {baris && baris.length > 0 && (
        <>
          <div className="panel-b" style={{ paddingTop: 0 }}>
            <table className="tbl scr-tbl">
              <thead>
                <tr>
                  <th>Ringkasan</th>
                  <th className="r">Menang</th>
                  <th className="r">Kalah</th>
                  <th className="r">Tak masuk</th>
                  <th className="r">Masih berjalan</th>
                  <th className="r">Akurasi</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{r.tuntas} tesis tuntas</td>
                  <td className="r num up">{r.menang}</td>
                  <td className="r num dn">{r.kalah}</td>
                  <td className="r num muted">{r.takMasuk}</td>
                  <td className="r num muted">{r.berjalan}</td>
                  <td className="r num">{r.akurasi == null ? <span className="muted">—</span> : `${r.akurasi.toFixed(1)}%`}</td>
                </tr>
              </tbody>
            </table>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
              Penyebut akurasi = tesis yang <b>horizonnya sudah lewat</b>. Yang masih berjalan tidak dihitung —
              penyetor yang rajin tak boleh dihukum oleh hari yang belum terjadi.
            </p>
          </div>

          <div className="board-tbl-wrap">
            <table className="tbl scr-tbl">
              <thead>
                <tr>
                  <th>Tanggal sinyal</th>
                  <th>Kode</th>
                  <th>Arah</th>
                  <th className="r">Area masuk</th>
                  <th className="r">Target</th>
                  <th className="r">Batas rugi</th>
                  <th className="r">Horizon</th>
                  <th>Hasil</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {baris.map((t) => (
                  <tr key={t.id}>
                    <td>{t.tanggal_sinyal}</td>
                    <td><Link to={`/berkas-emiten?kode=${t.kode}`} className="tick">{t.kode}</Link></td>
                    <td className={t.arah === 'naik' ? 'up' : 'dn'}>{t.arah === 'naik' ? 'Naik' : 'Turun'}</td>
                    <td className="r num">
                      {t.masuk_bawah === t.masuk_atas
                        ? t.masuk_bawah.toLocaleString('id-ID')
                        : `${t.masuk_bawah.toLocaleString('id-ID')}–${t.masuk_atas.toLocaleString('id-ID')}`}
                    </td>
                    <td className="r num">{t.target.toLocaleString('id-ID')}</td>
                    <td className="r num">{t.stop.toLocaleString('id-ID')}</td>
                    <td className="r num">{t.horizon_hari} hari</td>
                    <td>
                      <span className={t.status === 'menang' ? 'up' : t.status === 'kalah' ? 'dn' : 'muted'}>
                        {LABEL_STATUS[t.status]}
                      </span>
                      {t.ambigu && (
                        <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}
                              title="Target dan batas rugi tersentuh di hari yang sama; data harian tak menyimpan urutannya, jadi dihitung kalah.">
                          ambigu
                        </span>
                      )}
                    </td>
                    <td>
                      {t.status === 'menunggu' && (
                        <button type="button" className="dd-btn" disabled={sibuk === t.id}
                                onClick={() => void batal(t)}>
                          {sibuk === t.id ? '…' : 'Batalkan'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ padding: '0 14px 12px', fontSize: 11 }}>
            Pembatalan hanya berlaku sampai bursa berikutnya buka, dan tesis yang dibatalkan tak dihitung apa
            pun. Sesudah itu ia jadi rekam jejak — menang atau kalah, keduanya tetap tercatat.
          </p>
        </>
      )}

      {baris && baris.length === 0 && !galat && (
        <p className="muted" style={{ padding: 14 }}>
          Belum ada tesis. Buka <Link to="/berkas-emiten" className="tick">Berkas Emiten</Link>, pilih emiten,
          lalu tekan <b>Setor tesis</b>.
        </p>
      )}
    </div>
  )
}
