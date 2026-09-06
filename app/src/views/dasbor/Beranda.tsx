import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLoginModalOpsional } from '../../context/LoginModalContext'
import { useAksesHalaman } from '../../context/AksesHalamanContext'
import { MENU_ITEMS } from '../../lib/dasbor/menu'
import { PETA_MENU_KUNCI } from '../../lib/aksesHalaman'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import { useKabar, waktuKabar } from '../../lib/dasbor/kabar'
import { rangkumHari } from '../../lib/dasbor/ringkasHarian'
import { useBulletinList, tipeEdisi, LABEL_TIPE_EDISI } from '../../lib/dasbor/bulletin'
import { PapanRti } from '../../components/dasbor/PapanRti'
import { PanelDiary } from '../../components/dasbor/PanelDiary'
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

/* Hero IHSG (`PapanBeranda`) DICABUT 30 Agu 2026 atas permintaan Johan:
   "landing page ubah total, ganti section itu dengan mode RTI". Grafik IHSG
   berikut pemilih rentangnya TIDAK hilang — komponen `PapanIhsg` yang sama
   tetap berdiri megah di /indeks, tempat angka itu memang tokoh utamanya.
   Identitas PAPAN (judul + tagline) ikut dicabut atas permintaan yang sama.

   Catatan jujur yang perlu dibaca sebelum ada yang mencarinya: kalimat
   "Pusat Analisa Pasar Nusantara" ternyata TIDAK ada di /indeks — ia hanya
   tersisa sebagai `title` tooltip di rail/layout dan satu kalimat di
   Metodologi. Dilaporkan ke Johan pada hari yang sama. */


/**
 * Sumber yang tampil di Beranda — EMPAT inti, ditulis eksplisit (bukan
 * "seluruh sumber di kabar.json") karena halaman /kabar boleh menampung
 * sumber tambahan yang sengaja tidak ikut membanjiri pintu masuk situs.
 * Urutan array = urutan kolom.
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

/**
 * Ringkasan Pasar — angka penutupan hari itu dirakit jadi kalimat.
 *
 * Padanan "Coffee Morning" yang dipakai dasbor lain, dengan satu perbedaan
 * yang disengaja: di sana narasinya teks mati yang tak menunjuk ke mana pun,
 * di sini **tiap chip dan tiap katalis menautkan ke halaman yang membuktikan
 * angkanya**. Kalimatnya sendiri dirakit rule-engine (`rangkumHari`), bukan
 * LLM — supaya "kenapa disebut menguat kuat?" bisa dijawab dengan ambang,
 * bukan dengan "begitu kata modelnya".
 */
function RingkasanPasar() {
  const { hari, loading } = useDataHarian()
  if (loading && !hari) return null
  if (!hari) return null

  const r = rangkumHari(hari)
  return (
    <section className="brd-ringkas">
      <div className="brd-ringkas-kepala">
        <span className="lbl">Ringkasan pasar · {hari.date_id}</span>
        <span className="brd-ringkas-mesin" title="Kalimat dirakit dari ambang angka yang tertulis di kode, bukan dari model bahasa">
          dirakit dari angka, bukan ditulis AI
        </span>
      </div>
      {/* h1, bukan h2: ini judul halaman yang sebenarnya - kalimat yang
          merangkum hari itu. Beranda tak punya `.vhead`, jadi tanpa baris ini
          halaman terbuka tanpa satu pun h1 dan pembaca layar kehilangan
          penanda "halaman ini tentang apa". Gayanya berbasis kelas
          (`.brd-ringkas-judul`), jadi tampilannya tidak berubah. */}
      <h1 className="brd-ringkas-judul">{r.headline}</h1>
      {r.ringkasan && <p className="brd-ringkas-isi">{r.ringkasan}</p>}
      <div className="brd-chips">
        {r.chips.map((c) => (
          <Link key={c.label} to={c.ke ?? '/indeks'} className={`brd-chip ${c.nada}`}>{c.label}</Link>
        ))}
      </div>
      <div className="brd-katalis">
        <span className="lbl">Katalis utama</span>
        {r.katalis.map((k) => (
          <Link key={k.judul} to={k.ke ?? '/indeks'} className={`brd-katalis-it ${k.nada}`}>
            <b>{k.judul}</b>
            <span>{k.isi}</span>
          </Link>
        ))}
      </div>
      <p className="brd-ringkas-kaki">
        Sumber angka: Statistik Ringkas IDX · penutupan {hari.date_id}. Klik mana pun untuk
        menelusuri angkanya.
      </p>
    </section>
  )
}

/**
 * Empat pintu kerja (Arah A "Meja Kerja", keputusan Johan 28 Agu dari artifact
 * Beranda PAPAN Baru: "Kerjakan Arah A") — bukan sekadar tautan: tiap kartu
 * membawa satu angka hidup dari data yang SUDAH dimuat halaman ini
 * (rangkumHari + daftar edisi), nol fetch tambahan, nol klaim baru.
 */
function PintuKerja() {
  const { hari } = useDataHarian()
  const { daftar } = useBulletinList()
  const r = hari ? rangkumHari(hari) : null
  const cariChip = (pola: RegExp) => r?.chips.find((c) => pola.test(c.label))?.label ?? null
  const chipAsing = cariChip(/asing/i)
  const chipGerak = cariChip(/naik|turun|menguat|melemah/i)
  // Kunci internal tipe Deep Dive tetap 'Bedah' (LABEL_TIPE_EDISI yang
  // menampilkannya sebagai "Deep Dive" — lihat bulletin.ts).
  const dd = (daftar ?? []).find((e) => tipeEdisi(e.kode) === 'Bedah') ?? (daftar ?? [])[0]

  const pintu = [
    { ke: '/whales-papan', judul: 'Whales Papan', isi: chipAsing ?? 'jejak bandar harian — siapa menampung' },
    { ke: '/screener', judul: 'Screener', isi: 'saring seluruh papan — preset Whale & momentum' },
    { ke: '/harian-papan', judul: 'Harian Papan', isi: chipGerak ?? 'peringkat harian satu bursa' },
    { ke: '/bulletin', judul: 'Terbitan', isi: dd ? `${LABEL_TIPE_EDISI[tipeEdisi(dd.kode)]} · ${dd.tanggal_id}` : 'Arus Pasar & Deep Dive' },
  ]
  return (
    <section className="brd-pintu" aria-label="Pintu kerja">
      {pintu.map((p, i) => (
        <Link key={p.ke} to={p.ke} className="brd-pintu-it" style={{ '--i': String(i) } as Record<string, string>}>
          <span className="brd-pintu-jdl">{p.judul}<IkonMenu d={IKON_PANAH_KANAN} size={12} /></span>
          <span className="brd-pintu-isi">{p.isi}</span>
        </Link>
      ))}
    </section>
  )
}

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
            <span className={`brd-tipe tipe-edisi t-${tipeEdisi(e.kode).toLowerCase()}`}>{tipeEdisi(e.kode)}</span>
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
      {/* ARAH 1 (keputusan Johan 29 Agu, artifact "Tiga Arah Beranda PAPAN"):
          yang menjawab "hari ini kenapa" naik ke atas; papan angka menyusut.

          Urutan ini menggantikan Arah A, dan satu hal di Arah A memang SALAH:
          ia melipat Breadth & Diary ke dalam <details> tertutup. Johan 29 Agu:
          "untuk tampilan yang seperti RTI kemana yaa? malah itu yang ingin
          saya pertahankan menggantikan itu" — dua panel itu justru yang paling
          dicari, jadi lipatannya DIBUANG dan keduanya berdiri di layar
          pertama, tepat sesudah kalimat ringkasan. */}
      {/* Papan RTI menggantikan hero IHSG (Johan 30 Agu: "landing page ubah
          total, ganti section itu dengan mode RTI"). Ringkasan Pasar turun ke
          BAWAHNYA atas permintaan yang sama — "pindah section ini dibawah
          RTI" — jadi angka mentah dulu, kalimatnya menyusul. */}
      <PapanRti />

      {/* Diary Pasar naik ke atas 30 Agu 2026 (Johan: "pindahkan hero ini ke
          atas"). Ia memang pasangan alami papan RTI: papan menjawab "hari ini
          apa", Diary menjawab "sebulan ini bagaimana" — dua pertanyaan yang
          orang buka dasbor untuk menjawabnya, dan keduanya kini di layar
          pertama tanpa menggulir. */}
      <PanelDiary />

      <RingkasanPasar />

      <PintuKerja />

      {/* Panel Market Breadth DICABUT dari beranda 30 Agu 2026 (Johan: "Hero
          ini hapus gak guna"). Komponennya tidak dihapus dari repo — angka
          naik/turun/tak-berubah tetap dipakai Ringkasan Pasar lewat
          `hitungBreadth`, dan panelnya bisa dipanggil lagi kalau suatu saat
          diperlukan di halaman lain. Yang dibuang panjangnya di beranda, bukan
          hitungannya. */}

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
