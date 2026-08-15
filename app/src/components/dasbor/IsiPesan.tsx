import { Fragment } from 'react'
import { Link } from 'react-router-dom'

/** Kode emiten IDX: 4 huruf berawalan $ supaya penulisnya sengaja menandainya.
 *
 *  Huruf besar-kecil TIDAK lagi dipersoalkan. Yang menjaga percakapan dari
 *  berubah jadi ladang tautan adalah tanda $-nya, bukan kapitalnya: tanpa $,
 *  kata biasa seperti "saya" atau "pagi" ikut tertangkap — dengan $, tak ada
 *  orang mengetik "$pagi" tanpa maksud. Mensyaratkan kapital hanya memindahkan
 *  beban ke penulis, yang harus menekan Caps Lock di tengah kalimat dan
 *  gagal diam-diam kalau lupa (persis yang terjadi pada "$bumi", 15 Agu 2026).
 *
 *  Kodenya dinaikkan ke huruf besar saat ditampilkan — kunci ruang di
 *  `forum_ruang` selalu kapital, jadi "$bumi" dan "$BUMI" harus mendarat di
 *  ruang yang sama. */
const POLA_TAG = /\$([A-Za-z]{4})\b/g

/**
 * Isi pesan forum dengan tag emiten yang bisa diklik.
 *
 * `$BUMI` jadi tautan ke ruang diskusi emiten itu — bukan ke chart. Alasannya:
 * pembaca yang sedang di dalam percakapan biasanya ingin percakapan lain
 * tentang emiten itu, bukan keluar ke grafik. Tautan ke chart & Stock Detail
 * tetap tersedia satu klik lagi dari halaman ruangnya.
 *
 * Teks selain tag dirender apa adanya sebagai teks (bukan HTML) — React
 * meng-escape-nya otomatis, jadi tidak ada jalan bagi penulis pesan untuk
 * menyuntikkan markup.
 */
export function IsiPesan({ teks }: { teks: string }) {
  const potongan: Array<string | { tag: string }> = []
  let akhirSebelumnya = 0

  for (const cocok of teks.matchAll(POLA_TAG)) {
    const mulai = cocok.index ?? 0
    if (mulai > akhirSebelumnya) potongan.push(teks.slice(akhirSebelumnya, mulai))
    potongan.push({ tag: cocok[1].toUpperCase() })
    akhirSebelumnya = mulai + cocok[0].length
  }
  if (akhirSebelumnya < teks.length) potongan.push(teks.slice(akhirSebelumnya))

  return (
    <p className="forum-msg-isi">
      {potongan.map((bagian, i) =>
        typeof bagian === 'string' ? (
          <Fragment key={i}>{bagian}</Fragment>
        ) : (
          <Link key={i} className="forum-tag" to={`/forum/${bagian.tag}`} title={`Diskusi ${bagian.tag}`}>
            ${bagian.tag}
          </Link>
        )
      )}
    </p>
  )
}
