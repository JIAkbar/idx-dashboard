import { useId, useState } from 'react'
import { IkonMenu, IKON_MATA, IKON_MATA_CORET } from './IkonMenu'

/**
 * Kolom kata sandi dengan tombol intip.
 *
 * Dipakai di semua tempat sandi diketik (masuk, buat akun, atur ulang sandi)
 * supaya perilakunya sama. Menyembunyikan sandi melindungi dari mata orang di
 * sekitar layar, tapi tanpa cara mengintip, salah ketik baru ketahuan setelah
 * ditolak — dan untuk sandi yang BARU dibuat, tidak ketahuan sama sekali
 * sampai pemiliknya gagal masuk.
 *
 * Tombolnya `type="button"` — kalau tidak, ia ikut mengirim formulir saat
 * ditekan. Statusnya diumumkan lewat aria-label yang berubah, bukan lewat
 * warna ikon saja.
 */
export function KolomSandi({
  label, nilai, onGanti, placeholder, wajib = true, autoFocus, autoComplete,
}: {
  label: string
  nilai: string
  onGanti: (v: string) => void
  placeholder?: string
  wajib?: boolean
  autoFocus?: boolean
  autoComplete?: string
}) {
  const [terlihat, setTerlihat] = useState(false)
  const id = useId()

  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="sandi-bungkus">
        <input
          id={id}
          className="inp sandi-inp"
          type={terlihat ? 'text' : 'password'}
          value={nilai}
          onChange={(e) => onGanti(e.target.value)}
          placeholder={placeholder}
          required={wajib}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="sandi-intip"
          onClick={() => setTerlihat((v) => !v)}
          aria-label={terlihat ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
          title={terlihat ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
          aria-pressed={terlihat}
        >
          <IkonMenu d={terlihat ? IKON_MATA_CORET : IKON_MATA} size={15} />
        </button>
      </div>
    </div>
  )
}
