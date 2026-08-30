import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ambilRingkasanRuang, waktuRelatif, type RuangRingkasan } from '../../lib/forum'
import { pesanGalat } from '../../lib/pesanGalat'

/**
 * Shell Forum — rel ruang di kiri, isi ruang di kanan.
 *
 * Sebelumnya daftar ruang berupa kartu satu halaman penuh: untuk tahu ruang
 * mana yang ramai, orang harus membuka satu per satu lalu menekan tombol
 * kembali. Sekarang rel ruangnya menetap di samping, badge jumlah pesan
 * terbaca sekaligus, dan berpindah ruang tidak pernah meninggalkan halaman.
 *
 * Rel tidak ikut dimuat ulang saat pindah ruang — daftarnya diambil sekali di
 * shell ini, sementara `<Outlet/>` yang berganti (rute bersarang, pola yang
 * sama dengan shell tab admin).
 */
export function Forum() {
  const [ruang, setRuang] = useState<RuangRingkasan[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [cari, setCari] = useState('')

  useEffect(() => {
    let batal = false
    ambilRingkasanRuang()
      .then((r) => { if (!batal) setRuang(r) })
      .catch((e: unknown) => { if (!batal) setGalat(pesanGalat(e, 'Gagal memuat daftar ruang.')) })
    return () => { batal = true }
  }, [])

  const tersaring = useMemo(() => {
    if (!ruang) return []
    const q = cari.trim().toLowerCase()
    if (!q) return ruang
    return ruang.filter((r) =>
      r.label.toLowerCase().includes(q) || (r.keterangan ?? '').toLowerCase().includes(q) || r.kunci.toLowerCase().includes(q))
  }, [ruang, cari])

  const topik = tersaring.filter((r) => r.jenis === 'topik')
  const emiten = tersaring.filter((r) => r.jenis === 'emiten')

  // Ruang yang sedang dibuka dibaca dari alamat, bukan dari useParams: shell
  // ini rute INDUK, dan induk tidak melihat parameter anaknya. Judulnya
  // diambil dari daftar ruang yang memang sudah dimuat di sini — kalau ditaruh
  // di dalam kolom kanan, judul halaman ikut menyempit dan sejajar dengan
  // panel isinya, bukan dengan halamannya.
  const kunciAktif = useLocation().pathname.replace(/^\/forum\/?/, '').split('/')[0]
  const ruangAktif = ruang?.find((r) => r.kunci === kunciAktif) ?? null

  return (
    <div className="lantai forum-shell">
      <div className="vhead forum-judul">
        <h1>{ruangAktif ? ruangAktif.label : 'Forum'}</h1>
        <span className="sub">
          {ruangAktif
            ? (ruangAktif.keterangan || (ruangAktif.jenis === 'emiten' ? `Diskusi ${ruangAktif.kunci}` : ''))
            : 'diskusi terbuka seputar pasar & emiten'}
        </span>
      </div>

      <aside className="forum-rel">

        <span className="af-cari forum-cari">
          <input
            className="inp" type="search" placeholder="Cari ruang…" value={cari}
            onChange={(e) => setCari(e.target.value)} aria-label="Cari ruang forum"
          />
        </span>

        {galat && <p className="muted" style={{ fontSize: 11.5 }}>{galat}</p>}
        {!galat && ruang === null && <p className="muted" style={{ fontSize: 11.5 }}>Memuat ruang…</p>}

        {ruang !== null && (
          <>
            {topik.length > 0 && <BlokRel judul="Topik" daftar={topik} />}
            {emiten.length > 0 && <BlokRel judul="Ruang Emiten" daftar={emiten} />}
            {tersaring.length === 0 && (
              <p className="muted" style={{ fontSize: 11.5 }}>Tidak ada ruang yang cocok.</p>
            )}
          </>
        )}
      </aside>

      <div className="forum-isi">
        <Outlet />
      </div>
    </div>
  )
}

function BlokRel({ judul, daftar }: { judul: string; daftar: RuangRingkasan[] }) {
  return (
    <div className="forum-rel-blok">
      <span className="lbl">{judul}</span>
      {daftar.map((r) => (
        <NavLink
          key={r.kunci}
          to={`/forum/${r.kunci}`}
          className={({ isActive }) => `forum-rel-item${isActive ? ' on' : ''}`}
          // Keterangan ruang tidak muat di rel sesempit ini, tapi juga tidak
          // perlu hilang — dititipkan ke title supaya tetap bisa dibaca.
          title={r.keterangan || undefined}
        >
          <span className="nm">{r.label}</span>
          {/* Badge menyebut jumlah pesan, dan meredup saat nol — ruang kosong
              tetap terlihat ada tanpa menuntut perhatian yang sama dengan
              ruang yang sedang ramai. */}
          <span className={`forum-badge${r.jumlah === 0 ? ' nol' : ''}`}>{r.jumlah}</span>
          <span className="wkt">{r.terakhir ? waktuRelatif(r.terakhir) : 'belum ada pesan'}</span>
        </NavLink>
      ))}
    </div>
  )
}

/**
 * Isi awal saat belum ada ruang dipilih (rute `/forum` persis). Bukan halaman
 * kosong: menyebut apa yang ada di rel sebelahnya, supaya orang tahu langkah
 * berikutnya tanpa menebak.
 */
export function ForumSambutan() {
  return (
    <div className="fd-empty" style={{ padding: '56px 20px' }}>
      <p style={{ fontSize: 14 }}>Pilih ruang di sebelah kiri untuk mulai membaca.</p>
      <p style={{ fontSize: 11.5, marginTop: 6 }}>
        Ruang emiten juga terbuka dari tag <b>$KODE</b> di dalam pesan mana pun.
      </p>
    </div>
  )
}
