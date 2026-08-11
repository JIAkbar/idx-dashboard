import { useEffect, useState } from 'react'
import { BS_AVAIL } from '../../lib/dasbor/brokerSummaryData'
import { dateLabel } from '../../lib/dasbor/brokerSummaryFormat'

interface BsDatePickerProps {
  open: boolean
  activeFrom: string
  activeTo: string
  onApply: (from: string, to: string) => void
  onClose: () => void
}

const BS_PRESETS: { label: string; locked?: boolean }[] = [
  { label: '1D' },
  { label: '1W' },
  { label: '1M' },
  { label: '3M', locked: true },
  { label: '6M', locked: true },
  { label: '1Y', locked: true },
]

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const FIRST = BS_AVAIL[0]
const LAST = BS_AVAIL[BS_AVAIL.length - 1]

// Data cuma tersedia di Juni 2026 — offset & jumlah hari dihitung dari Date
// (bukan hardcode) supaya kalau BS_AVAIL nanti nambah bulan lain, ini tidak
// diam-diam salah.
const CAL_YEAR = 2026
const CAL_MONTH = 6
const CAL_OFFSET = new Date(CAL_YEAR, CAL_MONTH - 1, 1).getDay()
const CAL_DAYS = new Date(CAL_YEAR, CAL_MONTH, 0).getDate()

function activePresetLabel(from: string, to: string): string | null {
  if (from === to && from === LAST) return '1D'
  if (from === FIRST && to === LAST) return 'Semua'
  return null
}

/**
 * Modal date-range picker Broker Summary — port bsOpenPicker/bsBuildPresets/
 * bsBuildCal/bsCalRangePick/bsApplyDate index_live.html baris 5745-5829.
 * State draft (from/to/pickStep) terpisah dari state aktif di parent — Apply
 * commit draft ke parent, Close membatalkan tanpa efek.
 */
export function BsDatePicker({ open, activeFrom, activeTo, onApply, onClose }: BsDatePickerProps) {
  const [from, setFrom] = useState(activeFrom)
  const [to, setTo] = useState(activeTo)
  const [pickStep, setPickStep] = useState<0 | 1>(0)

  useEffect(() => {
    if (open) {
      setFrom(activeFrom)
      setTo(activeTo)
      setPickStep(0)
    }
  }, [open, activeFrom, activeTo])

  if (!open) return null

  function pickPreset(label: string) {
    if (label === '1D') { setFrom(LAST); setTo(LAST) } else { setFrom(FIRST); setTo(LAST) }
    setPickStep(0)
  }

  function pickDay(key: string) {
    if (pickStep === 0) {
      setFrom(key); setTo(key); setPickStep(1)
    } else {
      if (key < from) { setTo(from); setFrom(key) } else { setTo(key) }
      setPickStep(0)
    }
  }

  const active = activePresetLabel(from, to)
  const rangeLabel = from === to ? dateLabel(from) : `${dateLabel(from)} → ${dateLabel(to)}`

  return (
    <div className="bs-picker-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bs-picker-modal">
        <div className="bs-picker-presets">
          {BS_PRESETS.map((p) => {
            const isActive = p.label === active || (p.label === '1W' && from === FIRST && to === LAST)
            return (
              <button
                key={p.label}
                type="button"
                className={`bs-preset${p.locked ? ' locked' : ''}${isActive ? ' active' : ''}`}
                title={p.locked ? 'Data belum tersedia' : undefined}
                onClick={p.locked ? undefined : () => pickPreset(p.label)}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="bs-picker-label">Custom Range</div>
        <div className="bs-cal-month">Juni {CAL_YEAR}</div>
        <div className="bs-cal-dow">
          {DOW.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="bs-cal-days">
          {Array.from({ length: CAL_OFFSET }, (_, i) => <div key={`e${i}`} className="bs-cal-day empty" />)}
          {Array.from({ length: CAL_DAYS }, (_, i) => i + 1).map((day) => {
            const key = `${CAL_YEAR}-${String(CAL_MONTH).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            if (!BS_AVAIL.includes(key)) {
              return <div key={key} className="bs-cal-day dim">{day}</div>
            }
            const inRange = key >= from && key <= to
            const isEdge = key === from || key === to
            return (
              <button
                key={key}
                type="button"
                className={`bs-cal-day avail${isEdge ? ' selected' : inRange ? ' in-range' : ''}`}
                onClick={() => pickDay(key)}
              >
                {day}
              </button>
            )
          })}
        </div>
        <div className="bs-range-display">{rangeLabel}</div>
        <div className="bs-picker-footer">
          <button type="button" className="bs-cal-apply" onClick={() => onApply(from, to)}>Apply</button>
          <button type="button" className="bs-cal-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
