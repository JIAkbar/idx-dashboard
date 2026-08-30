import { useEffect, useMemo, useState } from 'react'
import { kabarTerbaru, useKabar, waktuKabar, type KabarItem } from '../../lib/dasbor/kabar'
import { IkonMenu, IKON_KOTAK_ARSIP } from '../../components/dasbor/IkonMenu'
import { Dropdown } from '../../components/dasbor/Dropdown'
import './Kabar.css'

const PER_HAL = 12

/** Dua tab pertama SELALU ada; sisanya diturunkan dari data.
 *
 *  Sebelumnya seluruh daftar tab ditulis tetap di sini, dan akibatnya sumber
 *  yang baru masuk sudah ikut terpanen tapi TAK PUNYA tabnya — hanya
 *  kelihatan di "Semua", jadi seolah panennya gagal. Daftar yang ditulis
 *  tangan selalu ketinggalan dari daftar yang tumbuh; sekaligus daftar ini
 *  ikut menyusut sendiri saat sebuah sumber dicabut (CNBC & detikFinance,
 *  16 Agu 2026) tanpa perlu disunting lagi. */
const TAB_TETAP = ['Semua', 'Pengumuman IDX'] as const

function daftarTab(item: KabarItem[]): string[] {
  const sumber = [...new Set(item.filter((i) => i.jenis !== 'pengumuman').map((i) => i.sumber))]
  // IDX & IPOT di depan (sumber primer bursa), sisanya alfabetis.
  const utama = ['IDX', 'IPOT News']
  sumber.sort((a, b) => {
    const ia = utama.indexOf(a), ib = utama.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.localeCompare(b)
  })
  return [...TAB_TETAP, ...sumber]
}

export function saringKabar(item: KabarItem[], tab: string, cari: string, bulan = ''): KabarItem[] {
  const q = cari.trim().toLowerCase()
  return item.filter((i) => {
    const cocokTab =
      tab === 'Semua' ? true
        : tab === 'Pengumuman IDX' ? i.jenis === 'pengumuman'
          : i.sumber === tab && i.jenis !== 'pengumuman'
    const cocokCari = !q
      || i.judul.toLowerCase().includes(q)
      || i.emiten.some((e) => e.toLowerCase().includes(q))
    // Tanpa waktu = tak bisa dipastikan masuk bulan mana; disembunyikan saat
    // bulan dipilih, bukan diikutkan ke bulan mana pun.
    const cocokBulan = !bulan || (i.waktu ?? '').slice(0, 7) === bulan
    return cocokTab && cocokCari && cocokBulan
  })
}

/** Daftar bulan yang benar-benar ada isinya, terbaru dulu. Diturunkan dari
 *  data dengan alasan yang sama seperti daftar tab: arsip yang tumbuh mundur
 *  tiap kali dipanen tak boleh menunggu daftar bulan disunting tangan. */
export function daftarBulan(item: KabarItem[]): string[] {
  return [...new Set(item.map((i) => (i.waktu ?? '').slice(0, 7)).filter(Boolean))].sort().reverse()
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function labelBulan(ym: string): string {
  const [th, bl] = ym.split('-')
  return `${NAMA_BULAN[Number(bl) - 1]} ${th}`
}

/**
 * Kabar Pasar — rumah berita PAPAN.
 *
 * Empat sumber dalam satu aliran: berita & pengumuman resmi IDX, IPOT News,
 * dan Kontan. Yang disimpan cuma METADATA (judul, tautan, waktu, emiten yang
 * disebut) — isi beritanya tidak disalin, tiap baris menunjuk balik ke
 * sumbernya. Panen dijalankan `scripts/panen_kabar.py` dari mesin rumahan,
 * bukan dari peramban pengunjung (lihat catatan di `lib/dasbor/kabar.ts`).
 */
export function Kabar() {
  // `true` = ikut menarik arsip IPOT (mundur sampai awal tahun). Cuma halaman
  // ini yang membayar ukurannya; Beranda tetap memakai versi ringan.
  const { kabar, galat } = useKabar(true)
  const [tab, setTab] = useState<string>('Semua')
  const [cari, setCari] = useState('')
  const [bulan, setBulan] = useState('')
  const [hal, setHal] = useState(0)

  useEffect(() => { setHal(0) }, [tab, cari, bulan])

  const TAB = useMemo(() => daftarTab(kabar?.item ?? []), [kabar])
  const BULAN = useMemo(() => daftarBulan(kabar?.item ?? []), [kabar])

  const tersaring = useMemo(() => saringKabar(kabar?.item ?? [], tab, cari, bulan), [kabar, tab, cari, bulan])
  const tampil = tersaring.slice(hal * PER_HAL, (hal + 1) * PER_HAL)

  return (
    <div className="lantai">
      <section className="panel">
        <div className="panel-h kbr-h">
          <span className="lbl">
            Kabar pasar{kabar ? ` (${kabar.item.length})` : ''}
          </span>
          <span className="tabs kbr-tabs" role="tablist" aria-label="Saring sumber kabar">
            {TAB.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t}
                className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </span>
          {/* Bulan dan pencarian DISATUKAN jadi satu kendali. Dua kotak
              terpisah di header ber-`space-between` saling terlempar ke ujung
              yang berbeda, dan yang di tengah terbaca seperti tersesat.
              Keduanya menyaring daftar yang sama, jadi memang satu alat.
              Saringan bulan sendiri baru muncul kalau arsipnya lintas bulan —
              di berkas yang cuma berumur sepekan, kotak itu tak menjelaskan
              apa pun. */}
          <span className="kbr-alat">
            {/* `Dropdown` proyek, bukan <select> bawaan: daftar pilihan
                <select> digambar sistem operasi, jadi muncul putih terang di
                atas panel gelap dan tak bisa ditema. */}
            {BULAN.length > 1 && (
              <span className="kbr-bulan">
                <Dropdown
                  ariaLabel="Saring bulan"
                  nilai={bulan}
                  onGanti={setBulan}
                  opsi={[{ nilai: '', label: 'Semua bulan' },
                    ...BULAN.map((b) => ({ nilai: b, label: labelBulan(b) }))]}
                />
              </span>
            )}
            <span className="af-cari">
              {/* Kotak CARI CAMPURAN (bukan picker emiten) — sengaja BUKAN StockAutocomplete: menyaring lebih dari satu ruas sekaligus. Jangan "diperbaiki" jadi picker; riwayat: sweep Papan Pekerjaan #355. */}
              <input className="inp" type="search" value={cari} onChange={(e) => setCari(e.target.value)}
                placeholder="Cari judul / emiten…" aria-label="Cari kabar" />
            </span>
          </span>
        </div>

        <div className="panel-b">
          <p className="muted kbr-sumber">
            {/* Sumbernya disebut dari DATA, bukan dari daftar yang diketik —
                supaya kalimat ini tak pernah menjanjikan sumber yang sedang
                kosong, atau melupakan sumber yang baru masuk. */}
            Judul dan tautan dari{' '}
            <b>{(kabar?.sumber ?? []).join(', ') || 'sumber yang sedang dimuat'}</b>
            {' '}— termasuk pengumuman resmi emiten dari IDX. PAPAN menautkan, tidak menyalin isinya.
            {/* Dari ISI daftar, bukan dari ruas `dipanen` (waktu unduh) —
                lihat `kabarTerbaru`. */}
            {kabar && <> Kabar terbaru {waktuKabar(kabarTerbaru(kabar))}.</>}
          </p>

          {!kabar && !galat && <p className="muted">Memuat…</p>}
          {galat && (
            <div className="fd-empty" style={{ padding: '28px 16px' }}>
              <p style={{ marginBottom: 8 }}><IkonMenu d={IKON_KOTAK_ARSIP} size={26} /></p>
              <p>Kabar belum tersedia.</p>
              <p style={{ fontSize: 10, marginTop: 6 }}>
                Berkas <code>kabar.json</code> belum ada — pembaruan belum pernah dijalankan.
              </p>
            </div>
          )}
          {kabar && tersaring.length === 0 && (
            <p className="muted">Tak ada kabar yang cocok dengan saringan ini.</p>
          )}

          <div className="kbr-list">
            {tampil.map((i, n) => (
              <a
                key={`${i.tautan}-${n}`}
                className={`kbr-it${i.jenis === 'pengumuman' ? ' resmi' : ''}`}
                href={i.tautan} target="_blank" rel="noopener noreferrer"
                // Judul dipotong dua baris di CSS; tooltip menyimpan versi utuhnya.
                title={i.judul}
                style={{ '--i': String(n) } as Record<string, string>}
              >
                <span className="kbr-meta">
                  <span className={`kbr-sum s-${i.sumber.split(' ')[0].toLowerCase()}`}>{i.sumber}</span>
                  {/* Kanal IPOT (Saham · Ekonomi · IPS News · Market/JCI) —
                      dipanen per topik, jadi topiknya layak terlihat. */}
                  {i.kanal && <span className="kbr-kanal">{i.kanal}</span>}
                  {i.jenis === 'pengumuman' && <span className="kbr-resmi">Pengumuman resmi</span>}
                  <span className="kbr-waktu">{waktuKabar(i.waktu)}</span>
                </span>
                <span className="kbr-judul">{i.judul}</span>
                {i.emiten.length > 0 && (
                  <span className="kbr-emiten">
                    {i.emiten.map((e) => <span key={e} className="brd-tick">{e}</span>)}
                  </span>
                )}
              </a>
            ))}
          </div>

          {tersaring.length > PER_HAL && (
            <div className="af-paginasi">
              <span className="muted">
                {hal * PER_HAL + 1}–{Math.min((hal + 1) * PER_HAL, tersaring.length)} dari {tersaring.length}
              </span>
              <span className="af-paginasi-tbl">
                <button type="button" className="dd-btn" disabled={hal === 0}
                  onClick={() => setHal((h) => Math.max(0, h - 1))}>‹ Lebih baru</button>
                <button type="button" className="dd-btn"
                  disabled={(hal + 1) * PER_HAL >= tersaring.length}
                  onClick={() => setHal((h) => h + 1)}>Lebih lama ›</button>
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
