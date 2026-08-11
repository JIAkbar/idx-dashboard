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
 */
export function PosisiBar({ kode, onKode, lots, onLots, avg, onAvg, onFill }: PosisiBarProps) {
  return (
    <div className="jia-pos-bar">
      <label>📋 Kode</label>
      <input
        className="jia-pos-inp kode"
        type="text"
        placeholder="BBCA"
        maxLength={6}
        value={kode}
        onChange={(e) => onKode(e.target.value.toUpperCase())}
      />
      <label>Lots</label>
      <input
        className="jia-pos-inp lots"
        type="number"
        placeholder="0"
        min={0}
        value={lots}
        onChange={(e) => onLots(e.target.value)}
      />
      <label>Avg Cost</label>
      <input
        className="jia-pos-inp avg"
        type="number"
        placeholder="0"
        min={0}
        value={avg}
        onChange={(e) => onAvg(e.target.value)}
      />
      <button className="jia-pos-sync" onClick={onFill}>↩ Isi Kalkulator</button>
      <span className="jia-pos-tag">Isi posisi untuk auto-fill ↓</span>
    </div>
  )
}
