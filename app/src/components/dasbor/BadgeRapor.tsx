import './BadgeRapor.css'
import {
  bolehLihatRapor,
  capSampelKecil,
  labelHorizon,
  perluPeringatanBasi,
  warnaBadge,
  type HasilForm,
  type KonfigRapor,
  type RunBt,
} from '../../lib/dasbor/raporBadge'

/**
 * Badge win rate satu fitur — satu komponen, dipakai semua halaman (adendum
 * "Komponen BadgeRapor"). Isi wajib: win % · horizon · n · rentang data.
 * Angka/warna datang HANYA dari `raporBadge.ts` (bt/index.json beku) — tak
 * ada jalur edit di sini.
 *
 * Non-Diamond: placeholder terkunci, BUKAN disembunyikan — supaya fiturnya
 * diketahui ada (pilihan yang direkomendasikan adendum).
 */
export function BadgeRapor({
  run,
  tier,
  config,
  live,
  href,
}: {
  run: RunBt | null
  tier?: number | null
  config?: KonfigRapor
  /** Angka win rate berjalan (opsional) — dipasang dua-angka + tanda basi bila terpaut jauh. */
  live?: { winRate: number; n: number } | null
  href?: string
}) {
  if (!bolehLihatRapor(tier, config)) {
    return (
      <span className="br-badge br-kunci" title="Rapor & win rate — untuk pengguna jenjang Diamond">
        🔒 Rapor — Diamond
      </span>
    )
  }
  if (!run) return null

  const warna = warnaBadge(run.win_rate)
  const kecil = capSampelKecil(run.n_trade)
  const basi = live ? perluPeringatanBasi(run.win_rate, live.winRate) : false
  const rentang = `${run.parameter_ringkas.mulai ?? '?'}–${run.akhir_data ?? 'kini'}`
  const isi = (
    <>
      <b className={`br-win br-${warna}`}>{(run.win_rate * 100).toFixed(1)}%</b>
      {live && (
        <span className="br-live">
          {' '}
          · live {(live.winRate * 100).toFixed(1)}% ({live.n} hari){basi ? ' ⚠' : ''}
        </span>
      )}
      <span className="br-meta">
        {' '}
        · {labelHorizon(run.parameter_ringkas.model_keluar)} · n={run.n_trade}
        {kecil ? ' (sampel kecil)' : ''} · {rentang}
      </span>
    </>
  )
  const kelas = `br-badge br-${warna}${basi ? ' br-basi' : ''}`
  return href ? (
    <a className={kelas} href={href}>
      {isi}
    </a>
  ) : (
    <span className={kelas}>{isi}</span>
  )
}

/** Kolom form emiten — deret ▲▼▬ + label "4-1" (bt terpisah dari BadgeRapor,
 *  lihat komentar "dua ukuran" di raporBadge.ts). Sel tabel siap pakai. */
export function KolomForm({ hasil }: { hasil: HasilForm }) {
  return (
    <span className="br-form" title={`Form: ${hasil.menang} naik, ${hasil.kalah} turun`}>
      {hasil.seri.map((s, i) => (
        <span key={i} className={`br-form-panah br-form-${s}`}>
          {s === 'naik' ? '▲' : s === 'turun' ? '▼' : '▬'}
        </span>
      ))}
      <b className="br-form-label">{hasil.label}</b>
    </span>
  )
}
