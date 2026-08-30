/**
 * Papan RTI — pintu masuk Beranda, menggantikan hero IHSG raksasa.
 *
 * Asal (Johan, 30 Agu 2026): *"landing page ubah total, ganti section itu
 * dengan mode RTI"* · *"pindah section ini dibawah RTI"* (Ringkasan Pasar).
 * Cakupan dipilih Johan: papan indeks + ringkasan pasar + lima tabel top.
 * Identitas PAPAN dihapus dari beranda atas permintaannya.
 *
 * ## Kenapa ini muat tanpa panen baru
 *
 * Seluruh angka di sini SUDAH ada di statistik harian yang dipanen tiap hari
 * bursa — `featured` (8 indeks), `board` (3 papan), ringkasan nilai/volume/
 * frekuensi, net asing hari & YTD, PER/PBV pasar, kurs, dan lima peringkat
 * sepuluh baris (`gainers`, `losers`, `top_val`, `top_vol`, `top_freq`).
 * Diukur 30 Agu 2026 sebelum menulis sebaris pun kode: nol permintaan
 * jaringan tambahan, nol berkas turunan baru.
 *
 * ## Yang membedakannya dari hero lama
 *
 * Hero lama memakai satu layar penuh untuk SATU angka (IHSG) plus grafik
 * tahun berjalan. Papan ini menaruh 11 indeks, tujuh angka ringkasan pasar,
 * dan 50 baris peringkat di ruang yang sama — itu yang membuat papan RTI
 * dikenali: kepadatan, bukan hiasan.
 *
 * ## Yang TIDAK dilakukan di sini
 *
 * Tak ada angka yang dihitung ulang. Tiap sel adalah ruas yang dilaporkan
 * bursa apa adanya; satu-satunya turunan adalah perubahan harian IHSG
 * (`ihsg_value − ihsg_prev`), dan itu memakai dua ruas yang ada di SELURUH
 * berkas harian — bukan `ihsg_change` yang cuma ada di 55 dari 93 (lihat
 * catatan di `dataHarian.ts`).
 */
import { Link } from 'react-router-dom'
import { useDataHarian } from '../../lib/dasbor/dataHarian'
import type { DataHarian, SectorRow, StockMoveRow, StockRankRow } from '../../lib/dasbor/dataHarian'
import './PapanRti.css'

/** Angka bursa dilaporkan dalam satuan majemuk (juta lembar, miliar rupiah,
 *  ribu kali). Diformat apa adanya + satuannya, bukan dikonversi — konversi
 *  diam-diam itu cara termudah membuat angka layar berbeda dari angka sumber. */
const nf = (n: number, d = 2) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })

const persen = (n: number) => `${n >= 0 ? '+' : ''}${nf(n, 2)}%`
const nada = (n: number) => (n > 0 ? 'up' : n < 0 ? 'dn' : '')

/** Satu indeks di pita atas. */
function Pita({ baris }: { baris: SectorRow }) {
  // Nama sektor datang berawalan kode papan ("[A] Energy"); di pita sempit
  // awalan itu memakan ruang tanpa menambah arti.
  const nama = baris.n.replace(/^\[[A-Z]\]\s*/, '')
  return (
    <Link to="/indeks" className="rti-pita-it" title={`${nama} · YTD ${persen(baris.ytd)}`}>
      <span className="rti-pita-n">{nama}</span>
      <span className="rti-pita-v">{nf(baris.v, 2)}</span>
      <span className={`rti-pita-d ${nada(baris.d)}`}>{persen(baris.d)}</span>
    </Link>
  )
}

/** Satu angka ringkasan pasar. `ket` menyebut SATUANNYA — tanpa itu "15.132"
 *  bisa dibaca sebagai apa saja. */
function Angka({ label, nilai, ket, warna, ke }: {
  label: string; nilai: string; ket?: string; warna?: string; ke?: string
}) {
  const isi = (
    <>
      <span className="rti-ang-l">{label}</span>
      <b className={`rti-ang-v ${warna ?? ''}`}>{nilai}</b>
      {ket && <span className="rti-ang-k">{ket}</span>}
    </>
  )
  return ke ? <Link to={ke} className="rti-ang">{isi}</Link> : <div className="rti-ang">{isi}</div>
}

/** Satu tabel peringkat. Sengaja SATU komponen untuk kelima papan: perbedaan
 *  mereka cuma kolom nilainya, dan menyalinnya lima kali adalah cara termudah
 *  membuat kelimanya menyimpang diam-diam. */
function Peringkat({ judul, ket, baris, ke }: {
  judul: string
  ket: string
  baris: Array<{ kode: string; nilai: string; delta: number }>
  ke: string
}) {
  return (
    <div className="rti-tabel">
      <div className="rti-tabel-kop">
        <h3>{judul}</h3>
        <Link to={ke} className="rti-tabel-semua">semua →</Link>
      </div>
      <div className="rti-tabel-ket">{ket}</div>
      <table>
        <tbody>
          {baris.map((b, i) => (
            <tr key={b.kode}>
              <td className="rti-no">{i + 1}</td>
              <td className="rti-kode">
                <Link to={`/stock-detail?kode=${b.kode}`}>{b.kode}</Link>
              </td>
              <td className="rti-nilai">{b.nilai}</td>
              <td className={`rti-delta ${nada(b.delta)}`}>{persen(b.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const dariMove = (r: StockMoveRow[] = []) =>
  r.map((x) => ({ kode: x.c, nilai: nf(x.td, 0), delta: x.p }))

const dariRank = (r: StockRankRow[] = [], d = 0) =>
  r.map((x) => ({ kode: x.c, nilai: nf(x.v, d), delta: x.p }))

export function PapanRti() {
  const { hari, loading } = useDataHarian()
  if (loading && !hari) return <div className="rti-memuat" aria-hidden="true" />
  if (!hari) return null
  const h = hari as DataHarian

  // Perubahan IHSG dari dua ruas yang ada di SELURUH berkas — lihat catatan
  // kepala berkas ini.
  const ubah = h.ihsg_prev != null ? h.ihsg_value - h.ihsg_prev : null
  const indeks = [...(h.featured ?? []), ...(h.board ?? []), ...(h.sharia ?? [])]

  return (
    <section className="rti" aria-label="Papan pasar">
      {/* ── Pita indeks ─────────────────────────────────────────── */}
      <div className="rti-kepala">
        <div className="rti-ihsg">
          <span className="rti-ihsg-n">IHSG</span>
          <b className="rti-ihsg-v">{nf(h.ihsg_value, 2)}</b>
          <span className={`rti-ihsg-d ${nada(h.ihsg_pct)}`}>
            {ubah != null && `${ubah >= 0 ? '+' : ''}${nf(ubah, 2)} `}({persen(h.ihsg_pct)})
          </span>
        </div>
        <div className="rti-tgl">
          {h.date_id} · hari bursa ke-{h.trading_day}
          {h.ihsg_high != null && h.ihsg_low != null && (
            <> · rentang {nf(h.ihsg_low, 2)}–{nf(h.ihsg_high, 2)}</>
          )}
        </div>
      </div>

      {indeks.length > 0 && (
        <div className="rti-pita" role="list">
          {indeks.map((b) => <Pita key={b.n} baris={b} />)}
        </div>
      )}

      {/* ── Ringkasan pasar ─────────────────────────────────────── */}
      <div className="rti-angka">
        {h.val_idr_today != null && (
          <Angka label="Nilai" nilai={nf(h.val_idr_today, 0)} ket="miliar Rp" ke="/statistik" />
        )}
        {h.vol_today != null && (
          <Angka label="Volume" nilai={nf(h.vol_today, 0)} ket="juta lembar" ke="/statistik" />
        )}
        {h.freq_today != null && (
          <Angka label="Frekuensi" nilai={nf(h.freq_today, 0)} ket="ribu kali" ke="/statistik" />
        )}
        {h.nf_today_idr != null && (
          <Angka
            label="Asing hari ini"
            nilai={nf(h.nf_today_idr, 0)}
            ket={`miliar Rp · ${h.nf_today_status ?? ''}`}
            warna={nada(h.nf_today_idr)}
            ke="/aliran-asing"
          />
        )}
        {h.nf_ytd_idr != null && (
          <Angka
            label="Asing YTD"
            nilai={nf(h.nf_ytd_idr, 0)}
            ket="miliar Rp"
            warna={nada(h.nf_ytd_idr)}
            ke="/aliran-asing"
          />
        )}
        {h.mcap_idr != null && (
          <Angka label="Kapitalisasi" nilai={nf(h.mcap_idr, 0)} ket="triliun Rp" />
        )}
        {h.mkt_per != null && h.mkt_pbv != null && (
          <Angka label="PER · PBV pasar" nilai={`${nf(h.mkt_per, 2)} · ${nf(h.mkt_pbv, 2)}`} ket="kali" />
        )}
        {h.usd_idr != null && (
          <Angka label="USD/IDR" nilai={nf(h.usd_idr, 0)} ket="rupiah" />
        )}
      </div>

      {/* ── Lima papan peringkat ────────────────────────────────── */}
      <div className="rti-papan">
        <Peringkat judul="Top Gainer" ket="harga penutupan · %" baris={dariMove(h.gainers)} ke="/stocks" />
        <Peringkat judul="Top Loser" ket="harga penutupan · %" baris={dariMove(h.losers)} ke="/stocks" />
        <Peringkat judul="Top Value" ket="miliar Rp · % dari total" baris={dariRank(h.top_val)} ke="/stocks" />
        <Peringkat judul="Top Volume" ket="juta lembar · % dari total" baris={dariRank(h.top_vol)} ke="/stocks" />
        <Peringkat judul="Top Frekuensi" ket="kali · % dari total" baris={dariRank(h.top_freq)} ke="/stocks" />
      </div>

      <p className="rti-kaki">
        Angka penutupan resmi bursa, {h.date_id}. Tiap baris menautkan ke halaman
        yang membuktikannya.
      </p>
    </section>
  )
}
