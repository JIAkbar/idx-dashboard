import { useEffect, useState } from 'react'
import { daftarJenjang, type JenjangRow } from '../../lib/jenjang'
import { daftarHalamanAkses, type HalamanBaris } from '../../lib/aksesAdmin'
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
  const [halaman, setHalaman] = useState<HalamanBaris[]>([])
  const [galat, setGalat] = useState(false)

  useEffect(() => {
    let batal = false
    daftarJenjang()
      .then((j) => !batal && setBaris(j))
      .catch(() => !batal && setGalat(true))
    // Halaman ditarik terpisah dan kegagalannya didiamkan: kolom "Yang
    // terbuka" jatuh ke teks `hak` saja, dan tabel acuannya tetap berguna.
    daftarHalamanAkses()
      .then((h) => !batal && setHalaman(h))
      .catch(() => {})
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
                <th className="af-c" title="Hari kerja tanpa setoran sebelum akun dibekukan otomatis">Ambang beku</th>
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
                  <td className="af-c" title="Hari kerja tanpa setoran sebelum akun dibekukan otomatis">
                    {j.hari_beku ?? 5} hari
                  </td>
                  {!ringkas && (
                    <td className="muted">
                      {/* Halaman DITURUNKAN dari tabel Akses, tidak ditulis
                          ulang di sini. Sebelumnya kolom ini cuma menampilkan
                          teks `hak` yang diketik manual, dan begitu jenjang
                          minimum sebuah halaman diubah di tab Akses, kalimat
                          di sini diam saja — Seasonality sempat naik ke Perak
                          tanpa satu pun barisnya menyebutkan itu. Teks yang
                          berbohong lebih buruk daripada kolom yang kosong. */}
                      {(() => {
                        const halamanTier = halaman
                          .filter((h) => h.tingkat === 'login' && (h.min_tier ?? 0) === j.tier)
                          .map((h) => h.label)
                        const manual = (j.hak ?? '').trim()
                        // Tier 0 membuka SEMUA halaman anggota; menyenaraikan
                        // belasan nama di satu sel cuma jadi dinding teks.
                        const bagian = j.tier === 0
                          ? [manual].filter(Boolean)
                          : [manual, ...halamanTier].filter(Boolean)
                        return bagian.length ? bagian.join(' · ') : '—'
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
