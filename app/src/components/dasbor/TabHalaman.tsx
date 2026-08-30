/**
 * Baris tab antar-halaman yang sudah dilebur jadi satu pintu.
 *
 * Asal (Johan 30 Agu 2026): *"memang kita sudah over menu, pengen saya pangkas
 * umum nya 10 maksimal sudahan"* — 30 pintu jadi 9.
 *
 * ## Kenapa tab, bukan menggabung kodenya
 *
 * Empat halaman Sinyal berjumlah ±3.300 baris; menggabungnya jadi satu berkas
 * berarti menguji ulang seluruhnya untuk masalah yang sebenarnya cuma soal
 * jumlah pintu. Komponen ini menyatukan PINTUNYA — rute lama tetap hidup, jadi
 * tautan, bookmark, dan tautan antar-halaman tak ada yang patah.
 *
 * ## Kenapa `<Link>`, bukan state tab
 *
 * Tiap tab tetap halaman sendiri dengan URL sendiri. Itu yang membuat
 * "kirim tautan ke halaman ini" tetap bekerja, dan yang membuat tombol
 * kembali peramban berperilaku seperti yang diharapkan orang. Tab yang
 * menyimpan pilihannya di state akan kehilangan keduanya.
 */
import { Link, useLocation } from 'react-router-dom'
import { tabHalaman, indukDari } from '../../lib/dasbor/menu'
import { useAksesHalaman } from '../../context/AksesHalamanContext'
import { PETA_MENU_KUNCI } from '../../lib/aksesHalaman'
import './TabHalaman.css'

export function TabHalaman() {
  const { pathname } = useLocation()
  const { boleh } = useAksesHalaman()

  // Halaman anak menggambar baris tab milik INDUKNYA — kalau tidak, membuka
  // tab kedua akan membuat barisnya hilang dan pembaca terjebak di sana.
  const induk = indukDari(pathname) ?? pathname
  const tab = tabHalaman(induk)
  if (tab.length === 0) return null

  // Tab yang terkunci untuk pembaca ini TIDAK ditampilkan: baris tab bukan
  // tempat menawarkan yang tak bisa dibuka — itu tugas kartu di Beranda yang
  // memang menjelaskan jenjangnya.
  const terlihat = tab.filter((t) => {
    const kunci = PETA_MENU_KUNCI[t.path]
    return !kunci || boleh(kunci)
  })
  if (terlihat.length <= 1) return null

  return (
    <nav className="tab-halaman" aria-label="Bagian halaman ini">
      {terlihat.map((t) => (
        <Link
          key={t.path}
          to={t.path}
          className={`tab-halaman-it${t.path === pathname ? ' on' : ''}`}
          aria-current={t.path === pathname ? 'page' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
