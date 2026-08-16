import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLoginModalOpsional } from '../../context/LoginModalContext'
import { useAksesHalaman } from '../../context/AksesHalamanContext'
import { MENU_ITEMS } from '../../lib/dasbor/menu'
import { PETA_MENU_KUNCI } from '../../lib/aksesHalaman'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useIhsgBuka } from '../../lib/dasbor/ihsgOhlc'
import { useKabar, waktuKabar } from '../../lib/dasbor/kabar'
import { useBulletinList, tipeEdisi } from '../../lib/dasbor/bulletin'
import { PapanIhsg } from './IndeksDunia'
import { IkonMenu, IKON_KUNCI, IKON_PANAH_KANAN } from '../../components/dasbor/IkonMenu'
// Gaya baris kabar (.kbr-*) hidup di Kabar.css dan dipakai juga di sini.
// WAJIB diimpor: halaman Kabar dimuat malas (lazy), jadi tanpa impor ini
// jalur kabar Beranda tampil sebagai tautan biru tanpa gaya sampai
// pengunjung kebetulan membuka /kabar lebih dulu.
import './Kabar.css'
import './Beranda.css'

/** Berapa edisi terbaru yang tampil di jalur kabar. */
const KABAR_TAMPIL = 4

/**
 * Kepala Beranda: papan IHSG yang SAMA dengan halaman Indeks Dunia —
 * desainnya memang sudah pas dan tak ada alasan menggambar papan kedua.
 *
 * Bedanya dengan /indeks bukan pada papannya, melainkan pada apa yang
 * DITARUH DI DALAMNYA dan apa yang menyusul di bawahnya: di sini papan
 * membawa nama PAPAN + kalimat identitas, lalu disusul kabar pasar, edisi
 * terbaru, dan kartu ke seluruh halaman. Indeks Dunia menyusulnya dengan
 * kalender bursa, net foreign, dan peringkat dunia.
 */
function PapanBeranda() {
  const { tanggalTersedia, hari, tanggalAktif, loading } = useDataHarian()
  const buka = useIhsgBuka(tanggalAktif ?? undefined)

  if (loading && !hari) return <div className="brd-papan-memuat" aria-hidden="true" />
  if (!hari) return null

  return (
    <PapanIhsg
      hari={hari}
      tanggalTersedia={tanggalTersedia}
      buka={buka}
      tanpaMeta
      kepala={
        <div className="brd-identitas">
          <h1 className="brd-nama">PAPAN</h1>
          <p className="brd-tagline">
            Pusat Analisa Pasar Nusantara — <b>data</b> dan <b>informasi</b> Bursa Efek Indonesia.
            Angkanya bisa ditelusuri, metodenya terbuka, dan yang belum kami punya kami sebut belum punya.
          </p>
        </div>
      }
    />
  )
}

/** Jalur kabar di Beranda — lima teratas, sisanya di halaman Kabar Pasar. */
function JalurKabar() {
  const { kabar } = useKabar()
  const item = (kabar?.item ?? []).slice(0, 5)
  if (item.length === 0) return null
  return (
    <section className="brd-kabar">
      <div className="brd-h">
        <span className="lbl">Kabar pasar</span>
        <Link className="brd-semua" to="/kabar">Semua kabar →</Link>
      </div>
      <div className="brd-kabar-list">
        {item.map((i, n) => (
          <a key={`${i.tautan}-${n}`} className={`kbr-it${i.jenis === 'pengumuman' ? ' resmi' : ''}`}
            href={i.tautan} target="_blank" rel="noopener noreferrer"
            style={{ '--i': String(n) } as Record<string, string>}>
            <span className="kbr-meta">
              <span className={`kbr-sum s-${i.sumber.split(' ')[0].toLowerCase()}`}>{i.sumber}</span>
              {i.jenis === 'pengumuman' && <span className="kbr-resmi">Pengumuman resmi</span>}
              <span className="kbr-waktu">{waktuKabar(i.waktu)}</span>
            </span>
            <span className="kbr-judul">{i.judul}</span>
          </a>
        ))}
      </div>
    </section>
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
      <PapanBeranda />

      <JalurKabar />

      <KartuKabar />

      <section className="brd-menu">
        <div className="brd-h"><span className="lbl">Jelajahi data</span></div>
        <div className="brd-grid">
          {MENU_ITEMS.map((m, i) => {
            // Pemetaan menu→kunci akses dipinjam dari sumber yang sama dengan
            // rail & laci (PETA_MENU_KUNCI) — id menu TIDAK selalu sama dengan
            // kunci aksesnya: 'broker' (Top Broker) berpasangan dengan
            // 'topbroker', sementara kunci 'broker' justru milik Broker Summary.
            const kunci = PETA_MENU_KUNCI[m.id]
            const terkunci = kunci ? !boleh(kunci) : false
            return (
              <Link
                key={m.id}
                to={m.path}
                className={`brd-kartu${terkunci ? ' kunci' : ''}`}
                style={{ '--i': String(i) } as Record<string, string>}
              >
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
            <Link to="/admin" className="brd-kartu brd-kartu-aksi"
              style={{ '--i': String(MENU_ITEMS.length) } as Record<string, string>}>
              <span className="brd-kartu-ikon"><IkonMenu d={IKON_PANAH_KANAN} size={22} /></span>
              <span className="brd-kartu-kode">AKU</span>
              <span className="brd-kartu-judul">Area Kontributor</span>
              <span className="brd-kartu-ringkas">
                Setor broker summary harian, pantau jenjang dan kuotamu, kelola unggahan.
              </span>
            </Link>
          ) : (
            <button
              type="button"
              className="brd-kartu brd-kartu-aksi"
              style={{ '--i': String(MENU_ITEMS.length) } as Record<string, string>}
              onClick={() => modalLogin?.buka()}
            >
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
