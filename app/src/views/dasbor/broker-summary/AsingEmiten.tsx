import { useState } from 'react'
import { Dropdown, type OpsiDropdown } from '../../../components/dasbor/Dropdown'
import { IkonMenu, IKON_CARI, IKON_JAM } from '../../../components/dasbor/IkonMenu'
import { useKamusEmiten } from '../../../lib/dasbor/kamusEmiten'
import { useStockAsing } from '../../../lib/dasbor/stockDetailData'
import { taksiranNetAsing, type TaksiranAsing } from '../../../lib/dasbor/flowNego'
import { fRingkas } from '../../../lib/dasbor/stockDetailFormat'

/** Net dengan tanda +/- (fRingkas sudah bawa tanda minus sendiri). */
function fNet(v: number): string {
  return (v >= 0 ? '+' : '') + fRingkas(v)
}
function fRupiah(v: number | null): string {
  return v == null ? '—' : (v >= 0 ? '+' : '-') + 'Rp ' + fRingkas(Math.abs(v))
}

function Sel({ label, t }: { label: string; t: TaksiranAsing | null }) {
  return (
    <div>
      <span className="lbl">Net {label}</span>
      <div className={`v num${t ? (t.netLembar >= 0 ? ' up' : ' dn') : ''}`}>{t ? fNet(t.netLembar) : '—'}</div>
      <span className="sub">{t ? `≈ ${fRupiah(t.rupiah)} (taksiran)` : ' '}</span>
    </div>
  )
}

/**
 * C7 — net foreign 5D/10D PER EMITEN, drill-down dari chart Flow (level
 * pasar) di atas. Sumber `data-idx/json/asing/{KODE}.json`, dibaca lewat
 * `useStockAsing` yang sudah dipakai panel Aliran Asing Stock Detail — tidak
 * diduplikasi di sini, cuma dipasang `taksiranNetAsing` (flowNego.ts) di
 * atasnya untuk taksiran rupiah (Stock Detail sengaja TIDAK menampilkan
 * rupiah; di sini kita punya value/volume per baris untuk menaksirnya, WAJIB
 * berlabel taksiran — net asing sendiri selalu lembar, bukan rupiah).
 */
export function AsingEmiten() {
  const kamus = useKamusEmiten()
  const [kode, setKode] = useState('')
  const { data, loading } = useStockAsing(kode || null)

  const opsi: OpsiDropdown[] = kamus
    ? kamus.emiten.map((e) => ({ nilai: e.kode, label: `${e.kode} — ${e.nama}` }))
    : []

  const n5 = data ? taksiranNetAsing(data.d, 5) : null
  const n10 = data ? taksiranNetAsing(data.d, 10) : null

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
          placeholder="Pilih emiten…"
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
              <Sel label={`${n5?.hariTersedia ?? 5} Hari`} t={n5} />
              <Sel label={`${n10?.hariTersedia ?? 10} Hari`} t={n10} />
            </div>
            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>
              Net (beli-jual) lembar langsung dari sumber IDX. Taksiran rupiah = net lembar × (nilai transaksi ÷
              volume) periode yang sama — IDX tidak melaporkan aliran asing dalam rupiah, ini perkiraan, bukan angka
              resmi. Data s.d. {data.akhir}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
