import { langkahMoneyFlow, sambunganFlow } from '../../lib/dasbor/bedahEmiten'
import type { StockFundamental } from '../../lib/dasbor/stockDetailData'
import { fEps, fMC } from '../../lib/dasbor/stockDetailFormat'

/**
 * Panel "Lima Langkah Uang" — dipindah dari halaman Bedah Emiten (pensiun 21
 * Agu 2026, isinya digabung ke Stock Detail). Uang berjalan dari penjualan
 * sampai rekening pemegang saham; yang paling memberi tahu bukan kelima
 * angkanya, melainkan rasio antar langkah di bawahnya. Hitungannya
 * (`langkahMoneyFlow`/`sambunganFlow`) dari `lib/dasbor/bedahEmiten.ts`.
 *
 * Klasnya (`bdh-flow`, `bdh-sambung`, dst.) sengaja dipertahankan apa adanya
 * dari BedahEmiten.css → StockDetail.css: bentuknya (grid lima kartu +
 * sambungan rasio) khas panel ini saja, tak dipakai halaman lain.
 */

function pct(v: number | null | undefined, d = 1): string {
  return v != null && Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}%` : '—'
}

function pctPolos(v: number | null | undefined, d = 1): string {
  return v != null && Number.isFinite(v) ? `${v.toFixed(d)}%` : '—'
}

function kelasArah(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '' : v >= 0 ? ' up' : ' dn'
}

export function PanelLimaLangkahUang({ fd }: { fd: StockFundamental }) {
  const langkah = langkahMoneyFlow(fd)
  const sambungan = sambunganFlow(fd)
  const adaIsi = langkah.some((l) => l.nilai != null)

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel-h"><span className="lbl">Lima Langkah Uang</span></div>
      <div className="panel-b">
        <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.6 }}>
          Uang berjalan dari penjualan sampai rekening pemegang saham. Yang paling memberi tahu bukan
          kelima angkanya, melainkan rasio antar langkah di bawahnya.
        </p>

        {!adaIsi ? (
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>
            Ruas TTM emiten ini belum tersedia — lima langkahnya belum bisa dirangkai.
          </p>
        ) : (
          <>
            <ol className="bdh-flow">
              {langkah.map((l, i) => (
                <li key={l.id}>
                  <span className="bdh-flow-no num">{i + 1}</span>
                  <div className="bdh-flow-isi">
                    <span className="lbl">{l.label}</span>
                    <div className="bdh-flow-nilai num">
                      {l.nilai == null
                        ? 'Belum tersedia'
                        : l.satuan === 'uang'
                          ? fMC(l.nilai)
                          : `Rp ${fEps(l.nilai)}`}
                      {l.yoy != null && <span className={'bdh-yoy' + kelasArah(l.yoy)}>{pct(l.yoy)} YoY</span>}
                    </div>
                    <span className="bdh-arti">{l.arti}</span>
                    <span className="sub">{l.periode}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="bdh-sambung" style={{ marginTop: 10 }}>
              {sambungan.map((s) => (
                <div key={s.id}>
                  <span className="lbl">{s.label}</span>
                  <div className="v num">{pctPolos(s.nilai)}</div>
                  <span className="sub">{s.baca ?? 'Belum tersedia'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
