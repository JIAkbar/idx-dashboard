import { useEffect, useState } from 'react'

/** Ikut mendengarkan perubahan, bukan sekadar membaca sekali saat render:
 *  memutar ponsel ke lanskap mengubah jawabannya, dan komponen yang menyimpan
 *  ukuran lama akan tergambar dengan skala yang salah sampai dipaksa render.
 *
 *  Diangkat dari SeasonalityHarian.tsx supaya halaman kedua yang butuh jawaban
 *  ini memakai ambang & pendengar yang sama — dua salinan akan menyimpang. */
export function useLayarSempit(batas = 700): boolean {
  const [sempit, setSempit] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${batas}px)`).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${batas}px)`)
    const ubah = () => setSempit(mq.matches)
    mq.addEventListener('change', ubah)
    return () => mq.removeEventListener('change', ubah)
  }, [batas])
  return sempit
}
