import { useEffect, useMemo, useState } from 'react'
import { useKabar, waktuKabar, type KabarItem } from '../../lib/dasbor/kabar'
import { IkonMenu, IKON_CARI, IKON_KOTAK_ARSIP } from '../../components/dasbor/IkonMenu'
import './Kabar.css'

const PER_HAL = 12

/** Saringan sumber. 'Pengumuman' bukan sumber tapi JENIS — dinaikkan ke baris
 *  yang sama karena itulah pembedaan yang paling sering dicari: pengumuman
 *  resmi emiten punya bobot lain daripada berita media. */
const TAB = ['Semua', 'Pengumuman IDX', 'IDX', 'IPOT News', 'Kontan'] as const

export function saringKabar(item: KabarItem[], tab: string, cari: string): KabarItem[] {
  const q = cari.trim().toLowerCase()
  return item.filter((i) => {
    const cocokTab =
      tab === 'Semua' ? true
        : tab === 'Pengumuman IDX' ? i.jenis === 'pengumuman'
          : i.sumber === tab && i.jenis !== 'pengumuman'
    const cocokCari = !q
      || i.judul.toLowerCase().includes(q)
      || i.emiten.some((e) => e.toLowerCase().includes(q))
    return cocokTab && cocokCari
  })
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
  const { kabar, galat } = useKabar()
  const [tab, setTab] = useState<(typeof TAB)[number]>('Semua')
  const [cari, setCari] = useState('')
  const [hal, setHal] = useState(0)

  useEffect(() => { setHal(0) }, [tab, cari])

  const tersaring = useMemo(() => saringKabar(kabar?.item ?? [], tab, cari), [kabar, tab, cari])
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
          <span className="af-cari">
            <IkonMenu d={IKON_CARI} size={13} />
            <input className="inp" type="search" value={cari} onChange={(e) => setCari(e.target.value)}
              placeholder="Cari judul / emiten…" aria-label="Cari kabar" />
          </span>
        </div>

        <div className="panel-b">
          <p className="muted kbr-sumber">
            Judul dan tautan dari <b>IDX</b> (berita &amp; pengumuman resmi emiten),
            <b> IPOT News</b>, dan <b>Kontan</b>. PAPAN menautkan, tidak menyalin isinya.
            {kabar && <> Terakhir diperbarui {waktuKabar(kabar.dipanen)}.</>}
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
