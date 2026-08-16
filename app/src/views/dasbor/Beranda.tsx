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

/** Berapa kabar & edisi yang tampil di Beranda. Enam, bukan lima: daftarnya
 *  dua kolom, dan angka ganjil menyisakan satu petak kosong di sudut. */
const KABAR_TAMPIL = 6

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

/**
 * Sumber yang tampil di Beranda — EMPAT inti, ditulis eksplisit (bukan
 * "seluruh sumber di kabar.json") karena halaman /kabar akan menampung lebih
 * banyak sumber (CNBC Indonesia, detikFinance, dst) yang sengaja tidak ikut
 * membanjiri pintu masuk situs. Urutan array = urutan kolom.
 *
 * 'Stockbit Snips' didaftarkan lebih dulu dari datanya ada: berkasnya
 * (`data-idx/json/snips.json`) sedang dipanen proses lain dan boleh belum
 * ada saat ini dijalankan. Begitu `useKabar()`/kabar.json ikut memuat item
 * bersumber ini, kolomnya otomatis terisi tanpa sentuh berkas ini lagi.
 */
const SUMBER_BERANDA = ['IDX', 'IPOT News', 'Stockbit Snips', 'Kontan'] as const

/** Kabar per kolom. Empat dipilih (bukan tiga) supaya kolom yang datanya
 *  deras (IDX, Kontan) tak terasa terpotong pendek dibanding kolom lain —
 *  dengan jumlah SAMA di tiap kolom, tinggi ideal tetap seimbang selama
 *  datanya cukup, dan kolom yang datanya tipis (Stockbit di awal) memang
 *  wajar lebih pendek karena isinya sungguh belum sebanyak itu. */
const KABAR_PER_KOLOM = 4

/** Jalur kabar di Beranda — satu kolom per sumber, lengkap di halaman Kabar Pasar. */
function JalurKabar() {
  const { kabar } = useKabar()
  const semua = kabar?.item ?? []
  if (semua.length === 0) return null
  return (
    <section className="brd-kabar">
      <div className="brd-h">
        <span className="lbl">Kabar pasar</span>
        <Link className="brd-semua" to="/kabar">Semua kabar →</Link>
      </div>
      <div className="brd-kabar-kolom">
        {SUMBER_BERANDA.map((sumber) => {
          const item = semua.filter((i) => i.sumber === sumber).slice(0, KABAR_PER_KOLOM)
          return (
            <div className="brd-kabar-kol" key={sumber}>
              <span className="lbl brd-kabar-kol-h">{sumber}</span>
              {item.length === 0 ? (
                // Keadaan kosong jujur — bukan dikarang, bukan disembunyikan.
                // Berlaku juga untuk sumber yang datanya belum sempat dipanen.
                <p className="muted brd-kabar-kosong">Belum ada.</p>
              ) : (
                <div className="brd-kabar-kol-list">
                  {item.map((i, n) => (
                    <a key={`${i.tautan}-${n}`} className={`kbr-it${i.jenis === 'pengumuman' ? ' resmi' : ''}`}
                      href={i.tautan} target="_blank" rel="noopener noreferrer" title={i.judul}
                      style={{ '--i': String(n) } as Record<string, string>}>
                      {/* Lencana sumber tak diulang di sini — kepala kolom
                          sudah bilang sumbernya, dan menghapusnya menghemat
                          tinggi baris supaya kolom lebih rapat sebaris. */}
                      <span className="kbr-meta">
                        {i.jenis === 'pengumuman' && <span className="kbr-resmi">Pengumuman resmi</span>}
                        <span className="kbr-waktu">{waktuKabar(i.waktu)}</span>
                      </span>
                      <span className="kbr-judul">{i.judul}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
      <div className="brd-dua-kolom">
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

      {/* Edisi PAPAN lebih dulu, kabar pihak ketiga menyusul: yang kita
          kerjakan sendiri harus berdiri di depan yang kita tautkan. */}
      <KartuKabar />

      <JalurKabar />

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
