import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStockIndex } from '../../lib/dasbor/stockDetailData'

/**
 * Kotak tulis forum dengan saran emiten saat mengetik `$`.
 *
 * Menandai emiten sebelumnya menuntut dua hal sekaligus: ingat tanda `$`, DAN
 * ingat empat huruf kodenya dalam kapital. Yang kedua itu beban yang tak perlu
 * — orang tahu "Bumi Resources", belum tentu hafal "BUMI", dan Caps Lock di
 * tengah kalimat membuat tag gagal diam-diam kalau lupa.
 *
 * Sekarang `$` saja yang wajib. Begitu diketik, daftar emiten muncul dan bisa
 * dicari lewat kode ATAU nama perusahaan; memilih salah satunya menuliskan
 * kodenya dalam kapital. Yang mengetik kodenya sendiri dalam huruf kecil juga
 * tetap benar — IsiPesan menaikkannya saat menampilkan.
 */
export function KotakTulisTag({ nilai, onNilai, placeholder, rows = 3 }: {
  nilai: string
  onNilai: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  const { index } = useStockIndex()
  const ref = useRef<HTMLTextAreaElement>(null)
  /** Posisi awal `$` yang sedang diketik; null kalau kursor tak di dalam tag. */
  const [mulai, setMulai] = useState<number | null>(null)
  const [kueri, setKueri] = useState('')
  const [sorot, setSorot] = useState(0)

  const saran = useMemo(() => {
    if (mulai === null || !index) return []
    const q = kueri.toUpperCase()
    const semua = index.stocks
    // Kode dulu, baru nama: orang yang sudah tahu kodenya tidak boleh disodori
    // perusahaan lain yang kebetulan namanya memuat huruf itu.
    const kode = semua.filter((s) => s.ticker.startsWith(q))
    const nama = q.length >= 2
      ? semua.filter((s) => !s.ticker.startsWith(q) && s.name.toUpperCase().includes(q))
      : []
    return [...kode, ...nama].slice(0, 7)
  }, [index, kueri, mulai])

  function periksa(teks: string, kursor: number) {
    // Tag yang sedang diketik = `$` diikuti paling banyak empat huruf, tanpa
    // spasi, tepat sebelum kursor. Lebih dari empat huruf berarti ini bukan
    // kode emiten dan sarannya berhenti muncul.
    const sebelum = teks.slice(0, kursor)
    const cocok = /\$([A-Za-z]{0,4})$/.exec(sebelum)
    if (!cocok) { setMulai(null); return }
    setMulai(kursor - cocok[0].length)
    setKueri(cocok[1])
    setSorot(0)
  }

  function pilih(ticker: string) {
    if (mulai === null) return
    const el = ref.current
    const kursor = el ? el.selectionStart : nilai.length
    const baru = nilai.slice(0, mulai) + '$' + ticker + ' ' + nilai.slice(kursor)
    onNilai(baru)
    setMulai(null)
    // Kursor dikembalikan ke belakang tag supaya kalimatnya bisa diteruskan
    // tanpa mengklik lagi.
    const posisi = mulai + ticker.length + 2
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(posisi, posisi) })
  }

  function tombol(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mulai === null || saran.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSorot((i) => (i + 1) % saran.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSorot((i) => (i - 1 + saran.length) % saran.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pilih(saran[sorot].ticker) }
    else if (e.key === 'Escape') { setMulai(null) }
  }

  return (
    <div className="tag-bungkus">
      <textarea
        ref={ref} className="inp" rows={rows} maxLength={2000} placeholder={placeholder}
        value={nilai}
        onChange={(e) => { onNilai(e.target.value); periksa(e.target.value, e.target.selectionStart) }}
        onKeyDown={tombol}
        onClick={(e) => periksa(nilai, e.currentTarget.selectionStart)}
        // Ditutup lewat timeout supaya klik pada daftar sempat terdaftar dulu —
        // blur menyala sebelum click, dan tanpa jeda ini daftarnya hilang
        // persis sebelum pilihannya masuk.
        onBlur={() => setTimeout(() => setMulai(null), 150)}
      />
      {mulai !== null && saran.length > 0 && (
        <ul className="tag-saran" role="listbox" aria-label="Saran emiten">
          {saran.map((s, i) => (
            <li key={s.ticker}>
              <button type="button" role="option" aria-selected={i === sorot}
                className={'tag-saran-it' + (i === sorot ? ' on' : '')}
                onMouseEnter={() => setSorot(i)} onClick={() => pilih(s.ticker)}>
                <span className="kd">${s.ticker}</span>
                <span className="nm">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {mulai !== null && saran.length === 0 && kueri.length > 0 && (
        <div className="tag-saran tag-saran-kosong">Tak ada emiten cocok &ldquo;{kueri}&rdquo;</div>
      )}
    </div>
  )
}
