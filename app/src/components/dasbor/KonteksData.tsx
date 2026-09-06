import { Link } from 'react-router-dom'
import { IkonMenu, IKON_JAM, IKON_PANAH_KANAN } from './IkonMenu'

interface KonteksDataProps {
  /**
   * Tanggal data ISO (yyyy-mm-dd) — WAJIB dibaca dari ISI data yang sudah
   * dimuat halaman (mis. entri terakhir `tanggalTersedia`/`hari.date_iso`),
   * BUKAN dari mtime berkas. Berkas bisa ditulis ulang tanpa membawa data
   * baru; mtime membuat data basi terlihat segar (aturan proyek, sudah
   * pernah menipu — lihat CLAUDE.md "Status panen WAJIB berupa tabel").
   * `null` selama data belum dimuat — baris tetap dirender jujur ("Data per —")
   * daripada disembunyikan (konsisten dgn pola `memuat` Kalender.tsx).
   */
  tanggal: string | null
  /** true = angka hari itu masih PLACEHOLDER (hari.sementara, dataHarian.ts)
   *  — 7 halaman pernah menulis "Data per …" bernada final di atasnya
   *  (audit kesegaran 27 Agu §1). Kalimatnya SATU dengan Kalender.tsx. */
  sementara?: boolean
}

/**
 * Peringatan konteks + tautan metodologi (#154) — satu komponen dipakai
 * ulang di tiap halaman analitik, BUKAN kalimat yang disalin manual ke tiap
 * halaman (itu sebabnya sebagian halaman menyebut tanggal datanya dan
 * sebagian tidak — tidak ada satu tempat untuk mengubahnya).
 *
 * Sengaja TIDAK menyebut endpoint/jalur berkas/aturan penggabungan/ambang
 * skor apa pun di sini — itu tetap tinggal di /metodologi. Halaman ini
 * publik; menyebut dapur di layar pernah dinilai fatal (lihat komentar di
 * Metodologi.tsx).
 */
export function KonteksData({ tanggal, sementara }: KonteksDataProps) {
  const label = tanggal
    ? new Date(`${tanggal}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'
  return (
    <div className="konteks-data muted">
      <span>
        <IkonMenu d={IKON_JAM} size={12} /> Data per {label}
        {sementara && (
          <em
            style={{ color: 'var(--amber)', fontStyle: 'normal', marginLeft: 6 }}
            title="Angka sementara dari Yahoo Finance — bursa mungkin masih buka, jadi ini belum penutupan resmi. Akan tergantikan begitu IDX merilis statistik harinya."
          >
            · angka sementara
          </em>
        )}
      </span>
      <Link to="/metodologi" className="kd-tautan">
        Metodologi<span className="kd-panjang"> &amp; sumber data</span> <IkonMenu d={IKON_PANAH_KANAN} size={11} />
      </Link>
    </div>
  )
}
