import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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

  /**
   * Saat ada elemen yang sedang LAYAR PENUH, modal harus pindah ke DALAM
   * elemen itu.
   *
   * Fullscreen API hanya menggambar elemen yang diminta layar penuh beserta
   * turunannya; apa pun di luarnya tak dirender sama sekali — termasuk
   * `position: fixed`, yang biasanya kebal terhadap segalanya. Di Grafik
   * Emiten modal setelan dirender sebagai saudara panel, jadi begitu panelnya
   * layar penuh, ketukan "Indikator" membuka modal yang benar-benar ada di
   * DOM tapi tak pernah terlihat: tak ada galat, tak ada apa pun di layar,
   * dan Escape-nya tetap bekerja. Dilaporkan Johan 20 Agu 2026.
   *
   * Saat TIDAK ada yang layar penuh, modal sengaja dibiarkan di tempatnya —
   * memindahkannya ke `document.body` akan melepasnya dari ancestor
   * `.dasbor-shell[data-theme]` yang memberi token warnanya, dan seluruh modal
   * admin akan terkunci di tema gelap.
   */
  const [wadahFs, setWadahFs] = useState<Element | null>(() => document.fullscreenElement)
  useEffect(() => {
    const saatGanti = () => setWadahFs(document.fullscreenElement)
    saatGanti()
    document.addEventListener('fullscreenchange', saatGanti)
    return () => document.removeEventListener('fullscreenchange', saatGanti)
  }, [])

  const isi = (
    <div className="dasbor-modal-bg" onClick={onClose}>
      <div className={`lantai dasbor-modal${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="panel">
          <div className="panel-h"><span className="lbl">{label}</span></div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
        </div>
      </div>
    </div>
  )

  return wadahFs ? createPortal(isi, wadahFs) : isi
}
