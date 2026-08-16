import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLoginModalOpsional } from '../../context/LoginModalContext'
import { useAksesHalaman } from '../../context/AksesHalamanContext'
import { MENU_ITEMS } from '../../lib/dasbor/menu'
import { PETA_MENU_KUNCI } from '../../lib/aksesHalaman'
import { fetchIndex, type TanggalIndex } from '../../lib/dasbor/dataHarian'
import { useBulletinList, tipeEdisi } from '../../lib/dasbor/bulletin'
import { IkonMenu, IKON_KUNCI, IKON_PANAH_KANAN } from '../../components/dasbor/IkonMenu'
import './Beranda.css'

/** Berapa edisi terbaru yang tampil di jalur kabar. */
const KABAR_TAMPIL = 4

function persen(n: number): string {
  const s = n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n >= 0 ? '+' : '−'}${s.replace('-', '')}%`
}

/**
 * Strip keadaan pasar — satu baris angka nyata di bawah judul.
 *
 * Sengaja dari `data-idx/json/index.json` (berkas ringkas yang sudah memuat
 * penutupan & perubahan IHSG per hari bursa), BUKAN dari `useDataHarian` yang
 * menarik seluruh data hari itu: halaman ini pintu masuk, jadi yang boleh
 * ditunggu cuma yang benar-benar ditampilkan.
 */
function StripPasar() {
  const [baris, setBaris] = useState<TanggalIndex | null>(null)

  useEffect(() => {
    let batal = false
    fetchIndex()
      .then((d) => !batal && setBaris(d.length ? d[d.length - 1] : null))
      // Halaman tetap berguna tanpa strip ini — jangan tampilkan galat di
      // pintu masuk untuk sesuatu yang sifatnya pelengkap.
      .catch(() => {})
    return () => { batal = true }
  }, [])

  if (!baris) return null
  const naik = baris.ihsg_pct >= 0
  return (
    <div className="brd-strip">
      <span className="brd-strip-lbl">IHSG</span>
      {/* maximumFractionDigits WAJIB berdampingan dengan minimum: tanpa itu
          6401.888 tercetak "6.401,888" — tiga desimal, beda dari angka yang
          sama di halaman lain. */}
      <b className="brd-strip-num">
        {baris.ihsg.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </b>
      <span className={`brd-strip-chg ${naik ? 'up' : 'dn'}`}>{persen(baris.ihsg_pct)}</span>
      <span className="brd-strip-tgl">{baris.date_id} · hari bursa ke-{baris.trading_day}</span>
    </div>
  )
}

/** Kartu kabar: satu edisi terbit. Judulnya tanggal, bukan kode — yang dicari
 *  pembaca adalah "edisi kapan", kode cuma identitas berkas. */
function KartuKabar() {
  const { daftar } = useBulletinList()
  const edisi = (daftar ?? []).slice(0, KABAR_TAMPIL)

  return (
    <section className="brd-kabar">
      <div className="brd-h">
        <span className="lbl">Terbit terakhir</span>
        <Link className="brd-semua" to="/bulletin">Semua edisi →</Link>
      </div>
      {daftar === null && <p className="muted" style={{ fontSize: 11.5 }}>Memuat…</p>}
      {daftar !== null && edisi.length === 0 && (
        <p className="muted" style={{ fontSize: 11.5 }}>Belum ada edisi terbit.</p>
      )}
      <div className="brd-kabar-list">
        {edisi.map((e) => (
          <Link key={e.kode} className="brd-kabar-it" to="/bulletin" title={`${e.judul} — ${e.kode}`}>
            <span className={`brd-tipe t-${tipeEdisi(e.kode).toLowerCase()}`}>{tipeEdisi(e.kode)}</span>
            <span className="brd-kabar-tgl">{e.tanggal_id}</span>
            <span className="brd-kabar-emiten">
              {e.emiten.slice(0, 6).map((t) => <span key={t} className="brd-tick">{t}</span>)}
              {e.emiten.length > 6 && <span className="brd-lebih">+{e.emiten.length - 6}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * Beranda — pintu masuk PAPAN.
 *
 * Dulu '/' langsung membuka Indeks Dunia: halaman padat angka yang menjawab
 * "berapa" sebelum pengunjung tahu "ini apa". Beranda menjawab urutan yang
 * benar — identitas (data & informasi), lalu kabar terbaru, lalu kartu ke
 * tiap halaman beserta satu kalimat isi masing-masing.
 *
 * Kartunya DITURUNKAN dari `MENU_ITEMS` (sumber yang sama dengan rail dan
 * laci telepon), bukan didaftar ulang di sini — menu baru otomatis muncul
 * sebagai kartu, dan tak ada dua daftar yang bisa berselisih. Status kunci
 * per halaman ikut dari `useAksesHalaman`, jadi kartu yang terkunci menyebut
 * syaratnya alih-alih menyesatkan pengunjung ke pintu tertutup.
 */
export function Beranda() {
  const { session } = useAuth()
  const modalLogin = useLoginModalOpsional()
  const { boleh, alasanRingkas } = useAksesHalaman()

  // Pembungkus `.lantai` WAJIB: seluruh token tema (--bg2, --line, --amber,
  // --r) hidup di kelas itu, bukan di :root — tanpa pembungkus, halaman ini
  // kehilangan SEMUA warnanya sekaligus dan tautan jatuh ke biru bawaan
  // peramban. Tiap view dasbor membungkus dirinya sendiri (lihat IndeksDunia).
  return (
    <div className="lantai">
      <section className="brd-kepala">
        <div className="brd-kepala-teks">
          <h1>PAPAN</h1>
          <p className="brd-tagline">
            Pusat Analisa Pasar Nusantara — <b>data</b> dan <b>informasi</b> Bursa Efek Indonesia,
            disajikan apa adanya: angkanya bisa ditelusuri, metodenya terbuka, dan yang belum
            kami punya kami sebut belum punya.
          </p>
          <StripPasar />
        </div>
      </section>

      <KartuKabar />

      <section className="brd-menu">
        <div className="brd-h"><span className="lbl">Jelajahi data</span></div>
        <div className="brd-grid">
          {MENU_ITEMS.map((m) => {
            // Pemetaan menu→kunci akses dipinjam dari sumber yang sama dengan
            // rail & laci (PETA_MENU_KUNCI) — id menu TIDAK selalu sama dengan
            // kunci aksesnya: 'broker' (Top Broker) berpasangan dengan
            // 'topbroker', sementara kunci 'broker' justru milik Broker Summary.
            const kunci = PETA_MENU_KUNCI[m.id]
            const terkunci = kunci ? !boleh(kunci) : false
            return (
              <Link key={m.id} to={m.path} className={`brd-kartu${terkunci ? ' kunci' : ''}`}>
                <span className="brd-kartu-ikon"><IkonMenu d={m.ikon} size={22} /></span>
                <span className="brd-kartu-kode">{m.kode}</span>
                <span className="brd-kartu-judul">{m.label}</span>
                <span className="brd-kartu-ringkas">{m.ringkas}</span>
                {terkunci && kunci && (
                  <span className="brd-kartu-kunci">
                    <IkonMenu d={IKON_KUNCI} size={11} /> {alasanRingkas(kunci)}
                  </span>
                )}
              </Link>
            )
          })}

          {/* Kartu terakhir bukan halaman, tapi PINTU: masuk (kalau belum) atau
              area kontributor (kalau sudah). Ditaruh sebaris dengan kartu
              lain karena statusnya sama — satu tempat yang bisa dituju. */}
          {session ? (
            <Link to="/admin" className="brd-kartu brd-kartu-aksi">
              <span className="brd-kartu-ikon"><IkonMenu d={IKON_PANAH_KANAN} size={22} /></span>
              <span className="brd-kartu-kode">AKU</span>
              <span className="brd-kartu-judul">Area Kontributor</span>
              <span className="brd-kartu-ringkas">
                Setor broker summary harian, pantau jenjang dan kuotamu, kelola unggahan.
              </span>
            </Link>
          ) : (
            <button type="button" className="brd-kartu brd-kartu-aksi" onClick={() => modalLogin?.buka()}>
              <span className="brd-kartu-ikon"><IkonMenu d={IKON_KUNCI} size={22} /></span>
              <span className="brd-kartu-kode">MSK</span>
              <span className="brd-kartu-judul">Masuk</span>
              <span className="brd-kartu-ringkas">
                Halaman anggota terbuka setelah masuk. Kontributor yang menyetor broker
                summary naik jenjang dan mendapat kuota lebih besar.
              </span>
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
