import { useMemo, useState } from 'react'
import { IkonMenu, IKON_CARI, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'
import { Dropdown } from '../../components/dasbor/Dropdown'
import { StockAutocomplete } from '../../components/dasbor/StockAutocomplete'
import { PanelAliranAsing } from '../../components/dasbor/PanelAliranAsing'
import { CatatanCakupan } from '../../components/dasbor/CatatanCakupan'
import { TINGKAT_LIKUIDITAS } from '../../lib/dasbor/likuiditas'
import { saringAliranAsing } from '../../lib/dasbor/aliranAsing'
import { useUrut } from '../../lib/dasbor/useUrut'
import { useScreener, ringkasLembarBertanda, type BarisScreener } from '../../lib/dasbor/screener'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'
import { fp } from '../../lib/dasbor/format'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { keFraksi } from '../../lib/fraksiHarga'
import './AliranAsing.css'

type UrutState = { kunci: keyof BarisScreener; arah: 'naik' | 'turun'; klik: (k: keyof BarisScreener) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan — pola sama Screener.tsx/
 *  TopStocks.tsx, disalin bukan diimpor karena `keyof`-nya beda tiap tabel. */
function thSort(s: UrutState, k: keyof BarisScreener, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/**
 * Aliran Asing (`/aliran-asing`) — Johan 22 Agu 2026: aliran asing per-emiten
 * (`PanelAliranAsing`, dulu cuma di Stock Detail yang jarang dibuka) pindah
 * ke halaman sendiri, dipimpin daftar seluruh emiten diurut net asing.
 *
 * Daftar dibaca dari `screener.json` (satu berkas untuk semua emiten) —
 * BUKAN menembak `asing/<KODE>.json` 900×. Konsekuensinya: kolom "Net Asing"
 * di tabel adalah `net_asing_lembar`, jumlah 20 HARI BURSA (screener.ts),
 * BUKAN net 1 hari — `bangun-screener.mjs` belum menghitung net 1/5 hari
 * terpisah per emiten. Baris terpilih membuka `PanelAliranAsing` di bawah
 * tabel, yang barulah membaca `asing/<KODE>.json` — di situ net 1/5/20 hari
 * sungguhan ada, tapi cuma untuk SATU emiten sekaligus.
 */
export function AliranAsing() {
  const data = useScreener()
  const { index } = useStockIndex()
  const [cari, setCari] = useState('')
  const [tingkatLikuiditas, setTingkatLikuiditas] = useState('semua')
  const [terpilih, setTerpilih] = useState<string | null>(null)
  const [cariLain, setCariLain] = useState('')

  const baris = useMemo(() => data?.emiten ?? [], [data])
  const hasil = useMemo(() => saringAliranAsing(baris, cari, tingkatLikuiditas), [baris, cari, tingkatLikuiditas])
  const s = useUrut<BarisScreener>(hasil, 'net_asing_lembar', 'turun')

  if (!data) {
    return (
      <div className="lantai">
        <div className="vhead"><h1>Aliran Asing</h1></div>
        <div className="panel panel-b" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p><IkonMenu d={IKON_PERINGATAN} size={28} /></p>
          <p className="lbl">Memuat data aliran asing…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Aliran Asing</h1>
        <span className="sub">Emiten diurut net asing — pilih baris untuk arus harian, grafik kumulatif, dan persentilnya.</span>
      </div>
      <CatatanCakupan />

      <div className="panel">
        <div className="panel-b">
          {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css). Cari ·
              Saring (likuiditas); jumlah hasil di grup-kanan. */}
          <div className="bilah-kendali ala-alat">
            <div className="grup-k">
              <span className="grup-lbl">Cari</span>
              <span className="af-cari ala-cari">
                <IkonMenu d={IKON_CARI} size={13} />
                <input
                  className="inp" type="search" placeholder="Cari emiten…" value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </span>
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k">
              <span className="grup-lbl">Saring</span>
              <Dropdown
                opsi={TINGKAT_LIKUIDITAS.map((t) => ({ nilai: t.id, label: t.label }))}
                nilai={tingkatLikuiditas}
                onGanti={setTingkatLikuiditas}
                ariaLabel="Likuiditas"
                placeholder="Semua likuiditas"
              />
            </div>
            <span className="pemisah-v" aria-hidden="true" />
            <div className="grup-k grup-kanan">
              <span className="grup-lbl">Hasil</span>
              <span className="muted ala-jumlah">{hasil.length} dari {baris.length} emiten</span>
            </div>
          </div>
        </div>

        <div className="board-tbl-wrap">
          <table className="tbl ala-tbl">
            <thead>
              <tr>
                {thSort(s, 'kode', 'Kode')}
                {thSort(s, 'nama', 'Nama')}
                {thSort(s, 'harga', 'Harga', true)}
                {thSort(s, 'chg_1d', '%chg', true)}
                {thSort(s, 'net_asing_lembar', 'Net Asing 20H', true)}
                {thSort(s, 'likuiditas', 'Likuiditas', true)}
              </tr>
            </thead>
            <tbody>
              {s.urut.map((b) => (
                <tr key={b.kode} className={b.kode === terpilih ? 'ala-aktif' : undefined}>
                  <td>
                    <button type="button" className="tick ala-pilih" onClick={() => setTerpilih(b.kode)}>{b.kode}</button>
                  </td>
                  <td className="ala-nama" title={b.nama}>{b.nama}</td>
                  <td className="r num">{b.harga == null ? '—' : keFraksi(b.harga, 'dekat').toLocaleString('id-ID')}</td>
                  <td className={`r num ${b.chg_1d == null ? '' : b.chg_1d >= 0 ? 'up' : 'dn'}`}>
                    {b.chg_1d == null ? '—' : fp(b.chg_1d)}
                  </td>
                  <td className={`r num ${b.net_asing_lembar == null ? '' : b.net_asing_lembar >= 0 ? 'up' : 'dn'}`}>
                    {ringkasLembarBertanda(b.net_asing_lembar)}
                  </td>
                  <td className="r num" title={b.likuiditas == null ? undefined : `Rp${b.likuiditas.toLocaleString('id-ID')}`}>
                    {b.likuiditas == null ? '—' : `Rp${fRingkas(b.likuiditas)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {s.urut.length === 0 && (
          <p className="muted" style={{ padding: '10px 14px' }}>Tak ada emiten cocok dengan saringan/kata cari ini.</p>
        )}
      </div>

      <div className="panel">
        <div className="panel-b ala-cari-lain">
          <span className="lbl">Atau cari emiten lain</span>
          <StockAutocomplete
            stocks={index?.stocks ?? []} value={cariLain} onChange={setCariLain}
            onSelect={(t) => { setTerpilih(t); setCariLain('') }}
          />
        </div>
      </div>

      {terpilih && (
        <div className="panel">
          <div className="panel-b">
            <PanelAliranAsing ticker={terpilih} />
          </div>
        </div>
      )}

      <div className="asal">
        Data <b>{data.tanggal}</b> · <b>{data.n}</b> emiten · diperbarui {data.diperbarui}. Kolom{' '}
        <b>Net Asing 20H</b> dalam <b>lembar</b> adalah jumlah 20 hari bursa terakhir (dari <code>screener.json</code>),
        bukan net 1 hari — ruas net 1/5 hari per emiten belum dihitung di berkas ini, jadi belum ada kolomnya di
        tabel. Pilih satu baris untuk membuka net 1/5/20 hari sungguhan per emiten di panel bawah.
      </div>
    </div>
  )
}
