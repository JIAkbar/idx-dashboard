import { useState } from 'react'
import { tipeEdisi, useBulletinList, type TipeEdisi } from '../../lib/dasbor/bulletin'
import { IkonMenu, IKON_CARI, IKON_KOTAK_ARSIP } from '../../components/dasbor/IkonMenu'
import './AdminShared.css'

const TIPE_TAB = ['Semua', 'Harian', 'Mingguan', 'Bulanan', 'Bedah'] as const

/** Blok kosong seragam utk panel tanpa isi — pola fd-empty StockDetail.tsx,
 *  disalin dari UnggahHarian.tsx (dipakai 2 tab, terlalu kecil utk diekstrak
 *  jadi komponen bersama lintas modul — 4 baris). */
function PanelKosong({ ikon, pesan, petunjuk }: { ikon: string; pesan: string; petunjuk?: string }) {
  return (
    <div className="fd-empty" style={{ padding: '28px 16px' }}>
      <p style={{ marginBottom: 8 }}><IkonMenu d={ikon} size={26} /></p>
      <p>{pesan}</p>
      {petunjuk && <p style={{ fontSize: 10, marginTop: 6 }}>{petunjuk}</p>}
    </div>
  )
}

/**
 * Tab "Rak Terbitan" (/admin/terbitan) — arsip edisi bulletin (dipindah apa
 * adanya dari AdminHome.tsx lama). Changelog dipisah ke tabnya sendiri
 * (sama-sama "hal yang sudah terbit/dirilis"). Rak baca manifest publik
 * keluaran/index.json (sumber sama dengan halaman Bulletin) — BUKAN tabel
 * Supabase `edisi` (alur lama, kosong): edisi dirakit dari repo, tabel itu
 * tidak pernah diisi pipeline sekarang.
 */
export function RakTerbitan() {
  const { daftar: edisi, error: err } = useBulletinList()
  const [tipe, setTipe] = useState<(typeof TIPE_TAB)[number]>('Semua')
  const [cari, setCari] = useState('')

  // Saringan yang sama persis dengan halaman Bulletin publik — kode edisi ATAU
  // emiten yang dibahas, supaya "di edisi mana MBMA terakhir muncul?" terjawab
  // tanpa membuka PDF satu per satu.
  const q = cari.trim().toUpperCase()
  const tampil = (edisi ?? []).filter((r) => {
    const cocokTipe = tipe === 'Semua' || tipeEdisi(r.kode) === (tipe as TipeEdisi)
    const cocokCari = !q || r.kode.toUpperCase().includes(q) || r.emiten.some((e) => e.includes(q))
    return cocokTipe && cocokCari
  })

  return (
    <>
      <section className="panel">
        <div className="panel-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span className="lbl">Rak terbitan{edisi ? ` (${edisi.length})` : ''}</span>
          <span className="tabs blt-tabs" role="tablist" aria-label="Filter tipe edisi">
            {TIPE_TAB.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tipe === t}
                className={`tab${tipe === t ? ' on' : ''}`}
                onClick={() => setTipe(t)}
              >
                {t}
              </button>
            ))}
          </span>
          <span className="af-cari">
            <IkonMenu d={IKON_CARI} size={13} />
            <input
              className="inp"
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari kode edisi / emiten…"
              aria-label="Cari edisi"
            />
          </span>
        </div>
        <div className="panel-b">
          <p className="muted" style={{ marginTop: 0, fontSize: 11 }}>
            Arsip edisi bulletin yang sudah dirakit dari unggahan.
          </p>
          {err && <p className="muted" style={{ color: 'var(--red)' }}>Gagal memuat daftar: {err}</p>}
          {edisi && edisi.length === 0 && (
            <PanelKosong
              ikon={IKON_KOTAK_ARSIP}
              pesan="Belum ada edisi terbit."
              petunjuk="Edisi yang sudah dirakit dari unggahan akan tampil di rak ini."
            />
          )}
          {edisi && edisi.length > 0 && tampil.length === 0 && (
            <p className="muted">Tak ada edisi yang cocok dengan saringan ini.</p>
          )}
          {tampil.length > 0 && (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tipe</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th className="r">Emiten</th>
                  <th className="r">PDF</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((r) => (
                  <tr key={r.kode}>
                    <td>
                      <span className="tick">{r.kode}</span>
                      {r.update_dari != null && r.emiten.length > r.update_dari && (
                        <span
                          className="bchip"
                          title={`Dirilis ulang: ${r.update_dari} menjadi ${r.emiten.length} emiten`}
                          style={{
                            marginLeft: 6, fontFamily: 'var(--mono)', fontWeight: 700,
                            background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber)',
                          }}
                        >
                          Update {r.update_dari}→{r.emiten.length}
                        </span>
                      )}
                    </td>
                    <td><span className="chip">{tipeEdisi(r.kode)}</span></td>
                    <td>{r.tanggal_id}</td>
                    <td><span className="chip up">terbit</span></td>
                    <td className="r num">{r.emiten.length}</td>
                    <td className="r">
                      <a
                        className="blt-dl"
                        href={`/arus-pasar/keluaran/${r.pdf}`}
                        target="_blank"
                        rel="noopener"
                        title={`Buka ${r.pdf}`}
                      >
                        Lihat
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}
