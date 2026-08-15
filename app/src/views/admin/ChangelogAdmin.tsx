import teks from '../../../../docs/CHANGELOG.md?raw'
import { useTheme } from '../../context/ThemeContext'
import { useProfilSaya } from '../../lib/profilSaya'
import { AksesDitolak } from './AdminLayout'
import '../../dasbor/lantai.css'
import './AdminShared.css'

/**
 * Changelog dibaca langsung dari docs/CHANGELOG.md — satu sumber kebenaran.
 * Menyalin isinya ke TSX akan membuat keduanya berbeda dalam beberapa bulan;
 * itu persis alasan popup "What's New" lama dibuang (papan #8).
 *
 * Berkas itu mengikuti Keep a Changelog 1.1.0 + SemVer 2.0.0 (§135), jadi
 * penyaji di sini hanya perlu mengenali empat bentuk: "## [x.y.z] — tanggal"
 * (kepala versi), "### Kategori", "- butir", dan paragraf biasa. Pustaka
 * markdown penuh tetap tidak dibutuhkan — dan justru merugikan, karena kepala
 * versi mau dirender sebagai kartu, bukan sebagai <h2> biasa.
 */

interface Blok {
  versi: string
  tanggal: string
  judul: string
  isi: string[]
}

/** Pisah berkas jadi blok per versi. Baris sebelum versi pertama = preambul. */
function pecah(sumber: string): { preambul: string[]; blok: Blok[] } {
  const baris = sumber.split('\n')
  const preambul: string[] = []
  const blok: Blok[] = []
  for (const b of baris) {
    const kepala = b.match(/^## \[?([\d.]+)\]?\s*[—-]\s*(.+)$/)
    if (kepala) {
      // "2026-08-14" atau "11 Agustus 2026 — Judul lama" (riwayat sebelum aturan)
      const sisa = kepala[2].split(/\s*[—-]\s*(.+)/)
      blok.push({ versi: kepala[1], tanggal: sisa[0].trim(), judul: (sisa[1] ?? '').trim(), isi: [] })
      continue
    }
    if (b.startsWith('## ')) {
      // Judul non-versi (mis. "Riwayat sebelum aturan ini") — jadikan penanda
      // bagian, bukan kartu versi.
      blok.push({ versi: '', tanggal: '', judul: b.slice(3), isi: [] })
      continue
    }
    if (blok.length === 0) preambul.push(b)
    else blok[blok.length - 1].isi.push(b)
  }
  return { preambul, blok }
}

export function ChangelogPanel() {
  // Superadmin saja. Menyembunyikan tabnya saja tidak cukup — /admin/riwayat
  // tetap bisa dibuka lewat URL atau bookmark; pola guard yang sama dipakai
  // tab superadmin lain (lihat AktivitasAdmin). Selagi profil belum datang
  // (null) halaman dibiarkan render: isinya berkas statis, bukan data akun.
  const { profil } = useProfilSaya()
  if (profil && profil.peran !== 'superadmin') {
    return <AksesDitolak pesan="Changelog hanya untuk superadmin." />
  }

  const { preambul, blok } = pecah(teks)
  const judulBerkas = preambul.find((b) => b.startsWith('# '))?.slice(2) ?? 'Changelog'
  const paragraf = preambul.filter((b) => b.trim() && !b.startsWith('# '))

  return (
    <section className="panel">
      <div className="panel-h">
        <span className="lbl">{judulBerkas}</span>
        <span className="muted" style={{ fontSize: 11 }}>
          {blok.filter((b) => b.versi).length} versi tercatat
        </span>
      </div>
      <div className="panel-b cl-b">
        {paragraf.map((p, i) => (
          <p key={i} className="cl-intro">{tanpaMarkup(p)}</p>
        ))}

        {blok.map((b, i) =>
          b.versi ? (
            <article key={i} className="cl-versi">
              <header className="cl-kepala">
                <span className="cl-nomor">{b.versi}</span>
                <span className="cl-tanggal">{b.tanggal}</span>
                {b.judul && <span className="cl-judul">{b.judul}</span>}
              </header>
              {b.isi.map((baris, j) => {
                if (baris.startsWith('### ')) {
                  return <h4 key={j} className="cl-kategori">{baris.slice(4)}</h4>
                }
                if (baris.startsWith('- ')) {
                  return <li key={j} className="cl-butir">{tanpaMarkup(baris.slice(2))}</li>
                }
                // Baris lanjutan butir (indentasi) digabung ke butir sebelumnya
                // oleh CSS; baris kosong dibuang.
                return baris.trim() ? <p key={j} className="cl-teks">{tanpaMarkup(baris)}</p> : null
              })}
            </article>
          ) : (
            <h3 key={i} className="cl-bagian">{b.judul}</h3>
          )
        )}
      </div>
    </section>
  )
}

/** Buang penanda markdown ringan (**tebal**, [teks](tautan)) — changelog ini
 *  dibaca sebagai catatan, bukan dokumen bergaya. */
function tanpaMarkup(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/**
 * Halaman mandiri /admin/changelog (dijaga ProtectedRoute) — dipertahankan
 * untuk penanda halaman lama. TIDAK ikut dibungkus <DasborLayout>: layout itu
 * menyeret Sidebar/MobileNav/PitaKurs milik rail publik yang tak boleh nongol
 * di halaman admin. Tapi .lantai/.panel butuh ancestor .dasbor-shell[data-theme]
 * buat token warnanya (lantai.css baris 454) — tanpa itu .lantai jatuh ke token
 * gelap default-nya terus, kebal toggle tema. Maka bungkus tipis di sini.
 *
 * Di dalam shell tab, ChangelogPanel dipakai langsung (tab "Changelog") karena
 * AdminLayout sudah menyediakan ancestor itu.
 */
export function ChangelogAdmin() {
  const { theme } = useTheme()
  return (
    <div className="dasbor-shell" data-theme={theme}>
      <div className="lantai">
        <ChangelogPanel />
      </div>
    </div>
  )
}
