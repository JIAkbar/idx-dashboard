import { ALASAN_MIN } from '../../lib/alasanValidasi'

/**
 * Textarea "alasan memilih emiten ini" (Admin Fase 3) — wajib ≥ALASAN_MIN
 * karakter untuk kontributor, opsional (catatan arsip) untuk superadmin.
 * Dipakai form unggah AdminHome (orderbook/chart) & BedahUnggah — setoran
 * Bedah kena aturan alasan yang sama persis di server. File komponen
 * terpisah (bukan ikut AdminHome.tsx) supaya BedahUnggah.tsx tidak perlu
 * impor balik dari AdminHome.tsx (hindari circular import).
 */
export function AlasanField({ value, onChange, superadmin }: { value: string; onChange: (v: string) => void; superadmin: boolean }) {
  const panjang = value.trim().length
  const kurang = !superadmin && panjang < ALASAN_MIN
  return (
    <div className="field">
      <span className="lbl">Alasan memilih emiten ini{superadmin ? ' (opsional)' : ''}</span>
      <textarea
        className="inp"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={superadmin ? 'Opsional — catatan untuk arsip.' : `Mengapa emiten ini menarik disetor hari ini? (minimal ${ALASAN_MIN} karakter)`}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />
      <p className={`af-alasan-cnt${kurang ? ' kurang' : ''}`} style={{ margin: '4px 0 0', fontSize: 10.5 }}>
        {panjang} karakter{!superadmin && ` (minimal ${ALASAN_MIN})`}
      </p>
    </div>
  )
}
