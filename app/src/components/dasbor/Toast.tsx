import { useEffect, useRef, useState } from 'react'
import { IkonMenu, IKON_CENTANG, IKON_PERINGATAN } from './IkonMenu'

export type ToastState = { ok: boolean; pesan: string } | null

/**
 * Toast status unggah/hapus/kelola akun — satu bentuk untuk seluruh admin
 * (#170). Dulu markup+state ini disalin identik ke 5 berkas (UnggahHarian,
 * AkunAdmin, PanduanScreenshot, KurasiSetoran, AksesAdmin); sekarang satu
 * komponen.
 *
 * Perbedaan yang tak kelihatan dari markupnya saja: komponen ini menangani
 * transisi KELUAR. Versi lama unmount instan begitu parent men-null-kan
 * state lewat `setTimeout(4500ms)` — toast lenyap seketika, nol animasi
 * keluar. Di sini state `toast` jadi null lebih dulu memicu kelas `.keluar`
 * (animasi fade+geser .2s), baru SESUDAH itu elemennya benar-benar lepas
 * dari DOM — parent tak perlu tahu bedanya, cukup terus `setToast(null)`
 * seperti biasa.
 */
export function Toast({ toast }: { toast: ToastState }) {
  const [tampil, setTampil] = useState(toast)
  const [keluar, setKeluar] = useState(false)
  const tampilSebelumnya = useRef(toast)

  useEffect(() => {
    if (toast) {
      tampilSebelumnya.current = toast
      setTampil(toast)
      setKeluar(false)
      return
    }
    if (!tampilSebelumnya.current) return
    setKeluar(true)
    const t = setTimeout(() => {
      tampilSebelumnya.current = null
      setTampil(null)
    }, 220)
    return () => clearTimeout(t)
  }, [toast])

  if (!tampil) return null
  return (
    <div className={`lantai af-toast${tampil.ok ? '' : ' gagal'}${keluar ? ' keluar' : ''}`} role="status">
      <span className="af-toast-ikon">
        <IkonMenu d={tampil.ok ? IKON_CENTANG : IKON_PERINGATAN} size={13} />
      </span>
      <span>{tampil.pesan}</span>
    </div>
  )
}
