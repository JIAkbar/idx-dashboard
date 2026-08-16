import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAksesHalaman } from '../context/AksesHalamanContext'
import { useLoginModalOpsional } from '../context/LoginModalContext'
import { IkonMenu, IKON_KUNCI } from './dasbor/IkonMenu'
import type { AlasanKunci } from '../lib/aksesHalaman'
import { PemuatHalaman } from './dasbor/PemuatHalaman'
import { useJarakJenjang } from '../lib/jarakJenjang'
import { PenunjukJarak } from './dasbor/PenunjukJarak'

/**
 * Penjaga rute (Fase 6 — akses & jenjang): kalau `boleh(kunci)` false,
 * `children` TIDAK PERNAH DIRENDER — bukan ditampilkan lalu ditutup CSS.
 * Ini krusial: `children` biasanya berisi efek fetch data (Supabase/RLS,
 * fetch statis) — dengan tidak me-mount-nya sama sekali, efek itu tidak
 * pernah jalan, jadi tak ada data sungguhan yang sempat terkirim ke
 * peramban pengguna yang tak berhak (blur CSS saja TIDAK cukup — DevTools
 * Network/Elements tetap bisa membaca respons mentahnya).
 */
export function PenjagaHalaman({ kunci, children }: { kunci: string; children: ReactNode }) {
  const { daftar, boleh, alasan } = useAksesHalaman()
  // `daftar === null` = jawaban `halaman_saya()` BELUM datang — TIDAK boleh
  // dianggap "boleh" di sini (beda dari badge gembok rail/laci yang memang
  // sengaja fail-open supaya tak berkedip). Kalau children dirender duluan
  // lalu baru ditutup begitu jawabannya "tolak" datang, efek fetch di dalam
  // children (yang biasanya mulai jalan begitu di-mount) SUDAH KEBURU JALAN
  // — persis kebocoran yang mau dicegah. Jadi selagi belum tahu, tampilkan
  // pemuat netral dulu, BUKAN children, BUKAN juga kerangka terkunci (belum
  // tentu terkunci).
  if (daftar === null) return <PemuatHalaman />
  if (boleh(kunci)) return <>{children}</>
  return <KerangkaTerkunci kunci={kunci} {...alasan(kunci)} />
}

/**
 * Kerangka pengganti halaman terkunci: baris/tabel TIRUAN (angka & label
 * hardcode di bawah — BUKAN data server) diburamkan, dengan kartu ajakan
 * di tengah. JANGAN ganti isi `.pgh-blur` dengan data asli — kalau suatu
 * saat halaman ini "dioptimalkan" supaya kerangkanya "lebih akurat" pakai
 * data sungguhan, itu justru membocorkan data yang seharusnya terkunci.
 */
function KerangkaTerkunci({ kunci, judul, kalimat, sasaran }: AlasanKunci & { kunci: string }) {
  const loginModal = useLoginModalOpsional()
  // Cuma yang tertahan JENJANG yang punya jarak terukur. Tamu yang belum masuk
  // tidak punya setoran untuk dihitung, dan halaman superadmin tak bisa
  // dikejar dengan setoran sebanyak apa pun.
  const jarak = useJarakJenjang(kunci, sasaran === 'jenjang')
  return (
    // Pembungkus `.lantai` WAJIB: seluruh token tema (--amber, --bg1, --line,
    // --r) didefinisikan pada .lantai, bukan :root (lihat lantai.css baris
    // 606). Kerangka ini dirender langsung di .dasbor-main, jadi tanpa
    // pembungkus itu semua var kosong — tombolnya jatuh ke biru bawaan
    // peramban dan kartunya kehilangan latar, garis, serta radiusnya.
    <div className="lantai">
      <div className="pgh-wrap">
        <div className="pgh-blur" aria-hidden="true">
          <div className="vhead">
            <h1>████ ████████</h1>
            <span className="sub">████████ ███ ████████</span>
          </div>
          <div className="panel">
            <div className="panel-h"><span className="lbl">████████</span></div>
            <div className="panel-b">
              <table className="tbl">
                <thead>
                  <tr><th>████</th><th>████████</th><th className="r">████</th></tr>
                </thead>
                <tbody>
                  {['AAAA', 'BBBB', 'CCCC'].map((t) => (
                    <tr key={t}>
                      <td className="tick">{t}</td>
                      <td>████████</td>
                      <td className="r num">1.234,56</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="pgh-cta">
          <div className="pgh-kartu">
            <span className="pgh-lambang"><IkonMenu d={IKON_KUNCI} size={24} /></span>
            <p className="pgh-judul">{judul}</p>
            <p className="pgh-kalimat">{kalimat}</p>
            {jarak && <PenunjukJarak jarak={jarak} className="pgh-jarak" />}
            {sasaran === 'login' ? (
              <button type="button" className="btn-p" disabled={!loginModal} onClick={() => loginModal?.buka()}>
                Masuk
              </button>
            ) : (
              <Link className="btn-p pgh-tautan" to="/admin">Lihat jenjang kontributor</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
