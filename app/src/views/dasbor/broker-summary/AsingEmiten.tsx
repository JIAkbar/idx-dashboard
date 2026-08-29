import { useState } from 'react'
import { Dropdown, type OpsiDropdown } from '../../../components/dasbor/Dropdown'
import { IkonMenu, IKON_CARI, IKON_JAM } from '../../../components/dasbor/IkonMenu'
import { useKamusEmiten } from '../../../lib/dasbor/kamusEmiten'
import { useStockAsing } from '../../../lib/dasbor/stockDetailData'
import { netPeriode, type NetPeriode } from '../../../components/dasbor/PanelAliranAsing'
import { useOhlcvKaya } from '../../../lib/dasbor/ohlcvKaya'
import { netRupiahPeriode, type NetRupiahPeriode } from '../../../lib/dasbor/aliranAsingRupiah'
import { fRingkas } from '../../../lib/dasbor/stockDetailFormat'

/** Net dengan tanda +/- (fRingkas sudah bawa tanda minus sendiri). */
function fNet(v: number): string {
  return (v >= 0 ? '+' : '') + fRingkas(v)
}
function fRp(v: number): string {
  return (v >= 0 ? '+' : '-') + 'Rp ' + fRingkas(Math.abs(v))
}

function Sel({ hariDiminta, lembar, rupiah }: {
  hariDiminta: number
  lembar: NetPeriode | null
  rupiah: NetRupiahPeriode | null
}) {
  return (
    <div>
      <span className="lbl">Net {lembar?.hariTersedia ?? hariDiminta} Hari</span>
      <div className={`v num${lembar ? (lembar.net >= 0 ? ' up' : ' dn') : ''}`}>{lembar ? fNet(lembar.net) : '—'}</div>
      <span className="sub">
        {rupiah
          ? fRp(rupiah.net) + (rupiah.hariTersedia < hariDiminta ? ` (${rupiah.hariTersedia} dari ${hariDiminta} hari)` : '')
          : 'Rupiah belum tersedia'}
      </span>
    </div>
  )
}

/**
 * C7 — net foreign PER EMITEN, drill-down dari chart Flow (level pasar) di
 * atas. Lembar dari sumber bursa resmi lewat `useStockAsing` (dipakai bareng
 * panel Aliran Asing Stock Detail, `netPeriode` dari situ dipakai ulang di
 * sini — tidak diduplikasi). Rupiah SEBENARNYA (bukan taksiran) dari gudang
 * harga kaya yang sudah dipakai Grafik Emiten, lewat `netRupiahPeriode` —
 * kalau harinya belum terpanen di sana, ditandai jujur "belum tersedia",
 * bukan jatuh diam-diam ke taksiran.
 */
export function AsingEmiten() {
  const kamus = useKamusEmiten()
  const [kode, setKode] = useState('')
  const { data, loading } = useStockAsing(kode || null)
  const stockbit = useOhlcvKaya(kode)

  const opsi: OpsiDropdown[] = kamus
    ? kamus.emiten.map((e) => ({ nilai: e.kode, label: `${e.kode} — ${e.nama}` }))
    : []

  const n5 = data ? netPeriode(data.d, 5) : null
  const n10 = data ? netPeriode(data.d, 10) : null
  const n5r = data ? netRupiahPeriode(stockbit, data.akhir, 5) : null
  const n10r = data ? netRupiahPeriode(stockbit, data.akhir, 10) : null

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div className="panel-h">
        <span className="lbl"><IkonMenu d={IKON_CARI} size={13} /> Net Foreign per Emiten</span>
      </div>
      <div className="panel-b">
        <Dropdown
          opsi={opsi}
          nilai={kode}
          onGanti={setKode}
          ariaLabel="Pilih emiten"
          placeholder="Pilih emiten: BUMI, BBCA…"
        />

        {!kode && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
            Pilih satu emiten untuk melihat net asing 5 &amp; 10 hari bursa terakhir.
          </p>
        )}

        {kode && loading && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}><IkonMenu d={IKON_JAM} size={12} /> Memuat {kode}…</p>
        )}

        {kode && !loading && !data && (
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>Data aliran asing untuk {kode} belum tersedia.</p>
        )}

        {kode && !loading && data && (
          <>
            <div className="rasio" style={{ marginTop: 10 }}>
              <Sel hariDiminta={5} lembar={n5} rupiah={n5r} />
              <Sel hariDiminta={10} lembar={n10} rupiah={n10r} />
            </div>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>
              Net (beli-jual) lembar langsung dari sumber resmi bursa. Nilai rupiah aliran asing sebenarnya (bukan
              perkiraan) — kosong kalau harinya belum terpanen. Data s.d. {data.akhir}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
