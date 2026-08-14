import { useEffect, type ReactNode } from 'react'

/** Kerangka modal kecil — pola visual sama dengan LoginModal (.dasbor-modal-bg
 *  + .dasbor-modal + .panel), Escape & klik latar menutup. Diekstrak dari
 *  AdminHome.tsx lama (dipakai lintas halaman admin: UnggahHarian, KurasiSetoran,
 *  AkunAdmin) supaya tidak ada dependency silang antar tab shell baru. */
export function ModalKecil({ label, onClose, className, children }: { label: string; onClose: () => void; className?: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dasbor-modal-bg" onClick={onClose}>
      <div className={`lantai dasbor-modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="panel">
          <div className="panel-h"><span className="lbl">{label}</span></div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
        </div>
      </div>
    </div>
  )
}
