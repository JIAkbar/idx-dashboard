import { IkonMenu, IKON_PAPAN_KLIP } from '../../../components/dasbor/IkonMenu'
import { StockAutocomplete } from '../../../components/dasbor/StockAutocomplete'
import { useStockIndex } from '../../../lib/dasbor/stockDetailData'

interface PosisiBarProps {
  kode: string
  onKode: (v: string) => void
  lots: string
  onLots: (v: string) => void
  avg: string
  onAvg: (v: string) => void
  onFill: () => void
}

/**
 * Port ".jia-pos-bar" (index_live.html baris 1312-1324 dst, objek POSISI baris
 * 3126-3165) — mini-bar "Isi Kalkulator" dipakai di tab Profit/RR/Dividen.
 * Sync kode lintas-tab (POSISI.syncFrom) sengaja tidak diport — per arahan
 * proyek cukup per-komponen, tombol "Isi Kalkulator" saja yang wajib jalan.
 *
 * Kode dulu input teks bebas (kode karangan lolos tanpa ketahuan) — kini
 * StockAutocomplete yang sama dengan Avg Down & Pemulihan, label seragam
 * "Emiten" (sweep 21 Agu 2026).
 */
export function PosisiBar({ kode, onKode, lots, onLots, avg, onAvg, onFill }: PosisiBarProps) {
  const { index: indexSaham } = useStockIndex()
  const nama = indexSaham?.stocks.find((s) => s.ticker === kode)?.name

  return (
    <div className="vcard" style={{ gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ width: 190 }}>
          <span className="lbl"><IkonMenu d={IKON_PAPAN_KLIP} size={12} /> Emiten</span>
          <StockAutocomplete
            stocks={indexSaham?.stocks ?? []}
            value={kode}
            onChange={onKode}
            onSelect={onKode}
            placeholder="Cari emiten…"
          />
          {nama && <div className="v-note" style={{ display: 'block', marginTop: 4 }}>{nama}</div>}
        </div>
        <div className="field" style={{ width: 80 }}>
          <span className="lbl">Lots</span>
          <input className="inp" type="number" name="lots" placeholder="0" min={0} value={lots} onChange={(e) => onLots(e.target.value)} />
        </div>
        <div className="field" style={{ width: 110 }}>
          <span className="lbl">Avg Cost</span>
          <input className="inp" type="number" name="avg" placeholder="0" min={0} value={avg} onChange={(e) => onAvg(e.target.value)} />
        </div>
        <button className="btn-p btn-p-kecil" onClick={onFill}>↩ Isi Kalkulator</button>
      </div>
      <span className="v-note">Isi posisi untuk auto-fill ↓</span>
    </div>
  )
}
