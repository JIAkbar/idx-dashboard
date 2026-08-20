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
export function pecah(sumber: string): { preambul: string[]; blok: Blok[] } {
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
  return { preambul: gabungBungkus(preambul), blok: blok.map((b) => ({ ...b, isi: gabungBungkus(b.isi) })) }
}

/**
 * Sambung baris yang cuma hasil BUNGKUS KERAS di berkas markdown.
 *
 * `docs/CHANGELOG.md` ditulis dengan lebar ~80 kolom, jadi satu butir sering
 * jatuh ke dua-tiga baris berkas. Penyaji lama merender tiap baris sebagai
 * elemen sendiri: baris pertama jadi `<li class="cl-butir">` dengan tanda
 * "–" dan indentasi, sisanya jadi `<p class="cl-teks">` yang mulai dari tepi
 * kiri. Di layar itu terbaca sebagai butir pendek disusul kalimat gantung
 * tanpa induk — persis yang terlihat pada butir Forum, Terbitan mingguan,
 * Pemuatan awal dasbor, dan Kartu jenjang.
 *
 * Aturan markdown yang ditiru di sini cuma satu dan itu memang cukup untuk
 * berkas ini: baris kosong memisahkan blok, baris berisi menyambung blok
 * sebelumnya. Kepala (`###`) dan butir baru (`- `) tetap memulai blok baru.
 */
export function gabungBungkus(baris: string[]): string[] {
  const keluar: string[] = []
  for (const b of baris) {
    const isi = b.trim()
    if (!isi) { keluar.push(''); continue }
    const mulaiBlok = isi.startsWith('- ') || isi.startsWith('#')
    const sebelum = keluar.length ? keluar[keluar.length - 1] : ''
    if (!mulaiBlok && sebelum.trim() && !sebelum.trim().startsWith('#')) {
      keluar[keluar.length - 1] = `${sebelum.replace(/\s+$/, '')} ${isi}`
      continue
    }
    keluar.push(b)
  }
  return keluar
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
          <p key={i} className="cl-intro" lang="id">{tanpaMarkup(p)}</p>
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
                  return <li key={j} className="cl-butir" lang="id">{tanpaMarkup(baris.slice(2))}</li>
                }
                // Sisa: paragraf lepas di dalam satu versi (jarang, tapi ada
                // di catatan riwayat lama). Lanjutan butir sudah disambung
                // `gabungBungkus` di atas, bukan di sini — CSS tak pernah bisa
                // menyatukan dua elemen terpisah jadi satu butir.
                return baris.trim() ? <p key={j} className="cl-teks" lang="id">{tanpaMarkup(baris)}</p> : null
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
