import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Dropdown, type OpsiDropdown } from '../../components/dasbor/Dropdown'
import { DatePicker } from '../../components/dasbor/DatePicker'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { fN, fp } from '../../lib/dasbor/format'
import { papanBerisiko } from '../../lib/dasbor/sektorIdx'
import { hariBursaSejak, todayIsoJakarta } from '../../lib/tanggalBursa'
import { BULAN } from '../../lib/seasonality'
import { keFraksi } from '../../lib/fraksiHarga'
import { useUrut } from '../../lib/dasbor/useUrut'
import { useLayarSempit } from '../../lib/dasbor/useLayarSempit'
import {
  useRingkasKartu, useArsipKartu, keBarisTabel, saring, saringKualitas, SARINGAN, CHIP_BAWAAN, type BarisTabel,
} from '../../lib/dasbor/kartuRingkas'
import { TINGKAT_LIKUIDITAS, kodePeringkatTeratas, ujiLikuiditas } from '../../lib/dasbor/likuiditas'
import { LencanaBeku, tidakDiperdagangkan } from '../../components/dasbor/LencanaBeku'
import {
  useIndeksKartu, useKartu, pembatalDalamAtr, bangunTesis, tingkatBasi, takKeduanya as hitungTakKeduanya,
  type KartuEmiten, type LevelSR, type TargetItem, type FirstPassage,
} from '../../lib/dasbor/kartuAnalisa'
import './KartuAnalisa.css'
import { RencanaJejak } from '../../components/dasbor/RencanaJejak'

/** Di atas ini, halaman berhenti menampilkan SEMUA kartu sekaligus secara
 *  bawaan — begitu `--semua` (scripts/riset/kartu_analisa.py) dijalankan
 *  untuk ratusan emiten, memuat semuanya tanpa diminta akan membanjiri
 *  jaringan & layar. Di bawah ambang ini (kondisi sekarang: 3 emiten)
 *  menampilkan semua sekaligus justru yang paling berguna. */
const BATAS_TAMPIL_SEMUA = 12

function fmtHarga(v: number | null | undefined): string {
  return v == null ? '—' : Math.round(v).toLocaleString('id-ID')
}
function fmtDes(v: number | null | undefined, d = 1): string {
  return v == null ? '—' : v.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d })
}
/** Format persen id-ID (koma desimal) — bukan `toFixed` (titik), supaya
 *  konsisten dengan `fmtHarga`/`fmtDes` di halaman yang sama. */
function fmtPct(v: number | null | undefined, d = 2): string {
  if (v == null) return '—'
  const teks = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
  return `${v >= 0 ? '+' : '-'}${teks}%`
}
function fmtPct0(v: number | null | undefined, d = 1): string {
  return v == null ? '—' : `${v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
}
function naikTurun(v: number | null | undefined): string {
  return v == null ? '' : v >= 0 ? 'up' : 'dn'
}

/** Baris satu level S/R — badge R/S, harga, jumlah sentuhan & tanggal terakhir. */
function BarisLevel({ tipe, urutan, lv }: { tipe: 'R' | 'S'; urutan: number; lv: LevelSR }) {
  return (
    <div className="lvl">
      <span>
        <b className={tipe === 'R' ? 'dn' : 'up'}>{tipe}{urutan}</b> {fmtHarga(lv.harga)}
      </span>
      <em>{lv.sentuhan} sentuhan · {lv.terakhir}{lv.dalam_atr ? ' · <1 ATR' : ''}</em>
    </div>
  )
}

/** Satu baris tabel skenario first-passage (horizon 20 hari — kolom utama kartu).
 *  TIDAK ADA kolom "Harapan": jalur yang tak pernah menyentuh target maupun
 *  pembatal diberi imbal persis 0% oleh rumusnya, padahal posisi itu tetap
 *  berakhir di suatu harga — tandanya bisa terbalik. Datanya tetap ada di
 *  `fp.harapan` (JSON), cuma tidak ditampilkan. */
function BarisSkenario({ t }: { t: TargetItem }) {
  const f: FirstPassage = t.fp
  const sisa = hitungTakKeduanya(f)
  return (
    <tr>
      <td>{fmtHarga(t.harga)}</td>
      <td>{fmtPct(t.pct, 2)}</td>
      <td className="up">{fmtPct0(f.p_kena)}</td>
      <td className="dn">{fmtPct0(f.p_stop)}</td>
      <td>{sisa == null ? '—' : fmtPct0(sisa)}</td>
      <td>{f.median_hari == null ? '—' : `${fmtDes(f.median_hari, f.median_hari % 1 ? 1 : 0)} hb`}</td>
      <td>{f.q1 == null || f.q3 == null ? '—' : `${f.q1}–${f.q3}`}</td>
    </tr>
  )
}

/** Sama isinya dengan `BarisSkenario`, tapi kartu-per-baris (bukan `<tr>`) —
 *  dipakai di 412px lewat CSS (lihat KartuAnalisa.css) supaya tabel 7 kolom
 *  tidak menggulung mendatar dengan kolom kanan yang tak pernah terbaca. */
function KartuSkenario({ t }: { t: TargetItem }) {
  const f: FirstPassage = t.fp
  const sisa = hitungTakKeduanya(f)
  return (
    <div className="tp-kartu">
      <div className="baris"><span>Level</span><span>{fmtHarga(t.harga)} ({fmtPct(t.pct, 2)})</span></div>
      <div className="baris"><span>Target dulu</span><span className="up">{fmtPct0(f.p_kena)}</span></div>
      <div className="baris"><span>Pembatal dulu</span><span className="dn">{fmtPct0(f.p_stop)}</span></div>
      <div className="baris"><span>Tak keduanya</span><span>{sisa == null ? '—' : fmtPct0(sisa)}</span></div>
      <div className="baris"><span>Median waktu</span><span>{f.median_hari == null ? '—' : `${fmtDes(f.median_hari, f.median_hari % 1 ? 1 : 0)} hb`}</span></div>
      <div className="baris"><span>Q1–Q3</span><span>{f.q1 == null || f.q3 == null ? '—' : `${f.q1}–${f.q3} hb`}</span></div>
    </div>
  )
}

/** Blok Aliran Asing — ringkas SENGAJA (net 5h & 20h + porsi thd volume
 *  pasar), bukan panel lengkap: itu tugas panel Aliran Asing di Stock Detail.
 *  `asing === null` WAJIB berbunyi "belum tersedia", tidak pernah 0 — nol
 *  berarti asing tak bertransaksi, itu klaim berbeda dari ketiadaan data. */
function BlokAsing({ k }: { k: KartuEmiten }) {
  if (!k.asing) {
    return (
      <div className="blok blok-kosong">
        <h4>Aliran Asing</h4>
        <p style={{ margin: 0, fontSize: 12 }}>Belum tersedia untuk emiten ini.</p>
        <div className="asal">Tidak ada angka yang direkayasa untuk mengisi ruang ini.</div>
      </div>
    )
  }
  const satBeli = k.asing.satuan.beli ?? 'lembar'
  const p5 = k.asing.periode['5']
  const p20 = k.asing.periode['20']
  return (
    <div className="blok">
      <h4>Aliran Asing</h4>
      {[[5, p5], [20, p20]].map(([hari, p]) => {
        const pr = p as typeof p5 | undefined
        if (!pr) return null
        return (
          <div className="baris" key={hari as number}>
            <span>Net {pr.n} hari</span>
            <span className={naikTurun(pr.net)}>
              {pr.net >= 0 ? '+' : ''}{fRingkas(pr.net)} {satBeli}
            </span>
          </div>
        )
      })}
      <div className="baris">
        <span>Beli / Jual (5h)</span>
        <span>{fRingkas(p5?.beli)} / {fRingkas(p5?.jual)}</span>
      </div>
      <div className="baris kta-asing-porsi">
        <span>Porsi dari volume pasar (20h)</span>
        <span>beli {fmtPct0(p20?.porsi_beli_pct)} · jual {fmtPct0(p20?.porsi_jual_pct)}</span>
      </div>
      <div className="asal">
        <b>Asal:</b> jumlah beli/jual asing ({satBeli}) dibagi jumlah volume pasar periode yang sama.
        Beli dan jual ditampilkan terpisah, bukan cuma net — net menyembunyikan beda antara &quot;sepi
        dua arah&quot; dan &quot;ramai dua arah&quot;. Satuan bukan rupiah: IDX tidak melaporkan aliran
        asing dalam rupiah.
      </div>
    </div>
  )
}

function KartuSatuEmiten({ kode }: { kode: string }) {
  const { data: k, status } = useKartu(kode)
  const kamus = useKamusEmiten()
  const nama = kamus?.emiten.find((e) => e.kode === kode)?.nama

  if (status === 'memuat') {
    return <div className="panel kta-kartu"><div className="panel-b"><p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>Memuat {kode}…</p></div></div>
  }
  if (status === 'belum-tersedia' || !k) {
    return (
      <div className="panel kta-kartu">
        <div className="panel-b">
          <p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>Kartu {kode} belum tersedia.</p>
        </div>
      </div>
    )
  }

  const tesis = bangunTesis(k)
  const peringatanAtr = pembatalDalamAtr(k)
  const s = k.sektor
  const f = k.fundamental
  const namaBulan = BULAN[Number(k.tgl.slice(5, 7)) - 1]
  const resAsc = k.resistance.slice().reverse() // R3,R2,R1 (jauh -> dekat), sesuai urutan tampil acuan
  const beku = tidakDiperdagangkan(k)

  return (
    <article className="panel kta-kartu">
      <div className="panel-h kta-kepala">
        <div>
          <a className="tick kta-tik" href={`/grafik?kode=${kode}`}>{kode}</a>
          <span className="kta-nama">
            {nama ?? s.nama ?? kode} · {[s.sektor_en ?? s.sektor, s.subindustri_en ?? s.subindustri].filter(Boolean).join(' / ')}
            {' · Papan '}{s.papan ?? '—'}{s.papan === 'Pemantauan Khusus' ? ' ⚠' : ''}
            {s.tercatat ? ` · tercatat ${s.tercatat}` : ''}
          </span>
        </div>
        <div className={`kta-harga ${beku ? '' : naikTurun(k.chg)}`}>
          {fmtHarga(k.harga)}
          {/* Lencana menempel pada HARGA, bukan di kaki kartu: angka itu
              yang paling gampang disalahbaca sebagai harga hari ini. */}
          <small>{beku ? <LencanaBeku beku={k.beku} sejak={k.beku_sejak} /> : <>{fmtPct(k.chg)} · {k.tgl}</>}</small>
        </div>
      </div>

      <div className="panel-b">
        <div className="blok-grid">

          <div className="blok">
            <h4>Struktur Harga</h4>
            {/* Emiten yang berhenti diperdagangkan tetap punya bar tiap hari
                bursa — harga dibekukan, volume nol. Indikatornya jadi terhitung
                di atas deret datar dan tampil seolah pembacaan sah: RSI WIKA
                39,98, SCPI 10,67 (tak berpindah tangan sejak 2013). Angka yang
                terbaca "jenuh jual" padahal lahir dari harga yang tak bergerak.
                Barisnya TETAP ada supaya tata letak kartu seragam; nilainya
                yang diganti, berikut sebabnya. */}
            {beku ? (
              <>
                <div className="baris"><span>MA20</span><span className="lb-mati">—</span></div>
                <div className="baris"><span>MA50</span><span className="lb-mati">—</span></div>
                <div className="baris"><span>MA200</span><span className="lb-mati">—</span></div>
                <div className="baris"><span>ATR 14 hari</span><span className="lb-mati">—</span></div>
                <div className="baris"><span>RSI 14</span><span className="lb-mati">—</span></div>
                <div className="baris"><span>StochRSI</span><span className="lb-mati">—</span></div>
                <div className="asal">
                  <b>Tidak dihitung:</b> emiten ini tidak diperdagangkan
                  {k.beku_sejak ? ` sejak ${k.beku_sejak}` : ''} — {(k.beku ?? 0).toLocaleString('id-ID')} hari
                  bursa berturut tanpa transaksi. Harga {fmtHarga(k.harga)} yang tampil adalah harga
                  transaksi terakhir, bukan harga hari ini. Rata-rata bergerak, ATR, dan RSI di atas
                  deret yang tak bergerak akan menghasilkan angka yang terlihat sah tapi tak berarti
                  apa-apa, jadi sengaja dikosongkan.
                </div>
              </>
            ) : (
              <>
                <div className="baris"><span>MA20</span><span className={naikTurun(k.harga - (k.ma20 ?? k.harga))}>{fmtDes(k.ma20)}</span></div>
                <div className="baris"><span>MA50</span><span className={naikTurun(k.harga - (k.ma50 ?? k.harga))}>{fmtDes(k.ma50)}</span></div>
                <div className="baris"><span>MA200</span><span className={naikTurun(k.harga - (k.ma200 ?? k.harga))}>{fmtDes(k.ma200)}</span></div>
                <div className="baris"><span>ATR 14 hari</span><span>{fmtDes(k.atr)} ({fmtPct0(k.atr_pct)})</span></div>
                <div className="baris"><span>RSI 14</span><span>{fmtDes(k.rsi)}</span></div>
                <div className="baris"><span>StochRSI</span><span>{k.stochrsi ? `K ${Math.round(k.stochrsi[0])} / D ${Math.round(k.stochrsi[1])}` : '—'}</span></div>
                <div className="asal"><b>Asal:</b> {k.n.toLocaleString('id-ID')} lilin harian sejak {k.mulai}. MA/ATR/RSI/StochRSI dihitung dari deret penutupan &amp; ATR Wilder 14 hari.</div>
              </>
            )}
          </div>

          <div className="blok">
            <h4>Level · n Sentuhan</h4>
            {resAsc.map((lv, i) => <BarisLevel key={`r${i}`} tipe="R" urutan={resAsc.length - i} lv={lv} />)}
            <div className="lvl lvl-acuan"><span><b>harga</b> {fmtHarga(k.harga)}</span><em>penutupan</em></div>
            {k.support.map((lv, i) => <BarisLevel key={`s${i}`} tipe="S" urutan={i + 1} lv={lv} />)}
            {resAsc.length === 0 && k.support.length === 0 && <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>Belum ada klaster yang cukup jauh dari harga sekarang.</p>}
            <div className="asal"><b>Asal:</b> klaster pivot fraktal (jendela ±5 lilin) dari 500 lilin terakhir, digabung bila jaraknya &lt;0,75 ATR. Jumlah anggota klaster = &quot;n sentuhan&quot; — berapa kali harga benar-benar berbalik di level itu.</div>
          </div>

          <div className="blok">
            <h4>Karakter Emiten</h4>
            <div className="baris"><span>Efficiency Ratio 20h</span><span>{fmtDes(k.er, 3)}</span></div>
            <div className="baris"><span>Persentil pasar</span><span>{k.er_persentil == null ? '—' : Math.round(k.er_persentil)}</span></div>
            <div className="baris"><span>Likuiditas (median 20h)</span><span>Rp {fRingkas(k.likuiditas_median20)}/hari</span></div>
            <div className="asal">
              <b>Vonis:</b> {k.er_persentil == null || !k.er_n_populasi ? 'belum cukup data.' : (
                k.er_persentil >= 50
                  ? `persentil ${Math.round(k.er_persentil)} dari ${k.er_n_populasi} emiten — lebih trending daripada mayoritas pasar.`
                  : `persentil ${Math.round(k.er_persentil)} dari ${k.er_n_populasi} emiten — lebih sideways daripada mayoritas pasar.`
              )}
            </div>
          </div>

          <div className="blok">
            <h4>Musiman — {namaBulan}</h4>
            <div className="baris"><span>Naik</span><span>{k.musiman.naik} dari {k.musiman.n} tahun</span></div>
            <div className="baris"><span>Angka mentah</span><span>{fmtPct0(k.musiman.mentah, 0)}</span></div>
            <div className="baris"><span>Setelah disusutkan</span><span>{fmtPct0(k.musiman.tersusut, 0)}</span></div>
            <div className="baris"><span>Selang 95% (Wilson)</span><span>{fmtPct0(k.musiman.bawah, 0)} – {fmtPct0(k.musiman.atas, 0)}</span></div>
            <div className="baris"><span>Median imbal bulan ini</span><span className={naikTurun(k.musiman.median)}>{fmtPct(k.musiman.median)}</span></div>
            <div className="baris"><span>Peluang dasar emiten</span><span>{fmtPct0(k.musiman.dasar, 0)} ({k.musiman.total_bulan} bulan)</span></div>
            <div className="asal"><b>Baca dengan hati-hati:</b> n={k.musiman.n} pengamatan (satu per tahun). Selang Wilson yang lebar berarti pola belum bisa dibedakan dari kebetulan.</div>
          </div>

          <BlokAsing k={k} />

          <div className="blok">
            <h4>Fundamental Ringkas</h4>
            <div className="baris"><span>PER</span><span>{f.pe == null ? '—' : `${fmtDes(f.pe, 1)}×`}</span></div>
            <div className="baris"><span>PBV</span><span>{f.pb == null ? '—' : `${fmtDes(f.pb, 2)}×`}</span></div>
            <div className="baris"><span>ROE</span><span>{f.roe == null ? '—' : fmtPct0(f.roe * 100, 1)}</span></div>
            <div className="baris"><span>DER</span><span>{f.der == null ? '—' : fmtPct0(f.der, 1)}</span></div>
            <div className="baris"><span>Pendapatan YoY</span><span className={naikTurun(f.rev_yoy)}>{fmtPct(f.rev_yoy, 1)}</span></div>
            <div className="baris"><span>Laba Bersih YoY</span><span className={naikTurun(f.ni_yoy)}>{fmtPct(f.ni_yoy, 1)}</span></div>
            <div className="asal"><b>Asal:</b> ringkasan fundamental{f.updated ? `, diperbarui ${f.updated}` : ''}.</div>
          </div>

        </div>

        <div className="blok" style={{ marginTop: 12 }}>
          <h4>
            Skenario &amp; Ekspektasi Waktu — dihitung dari {k.target[0]?.fp.n?.toLocaleString('id-ID') ?? '—'} hari mulai
            {k.target[0]?.fp.n_efektif != null && ` (≈${k.target[0].fp.n_efektif.toLocaleString('id-ID')} jendela bebas)`}
          </h4>
          <div className="tp-tbl-wrap" style={{ overflowX: 'auto' }}>
            <table className="tp-tbl">
              <thead>
                <tr>
                  <th>Level</th><th>Jarak</th><th>Target dulu</th><th>Pembatal dulu</th>
                  <th>Tak keduanya</th><th>Median waktu</th><th>Q1–Q3</th>
                </tr>
              </thead>
              <tbody>
                {k.target.map((t, i) => <BarisSkenario key={i} t={t} />)}
              </tbody>
            </table>
          </div>
          <div className="tp-kartu-wrap">
            {k.target.map((t, i) => <KartuSkenario key={i} t={t} />)}
          </div>
          <div className="asal">
            <b>Pembatal tesis:</b> tersentuh intraday di bawah {fmtHarga(k.stop)} ({fmtPct(-k.stop_pct, 2)}).
            {k.stop_asal === 'fallback5pct' && <>
              {' '}<b>Catatan:</b> level ini BUKAN dari klaster support historis — deteksi klaster
              tak menemukan level yang cukup teruji, jadi dipakai patokan seragam −5% dari harga.
              Seluruh tabel skenario di atas berdiri di atas patokan itu; perlakukan sebagai
              batas disiplin, bukan level teknikal.
            </>}
            <br /><b>Asal:</b> first-passage empiris, horizon 20 hari bursa — dari tiap hari historis, target atau pembatal mana yang tersentuh lebih dulu (low/high intraday, bukan penutupan). Kalau keduanya tersentuh hari yang sama, dihitung sebagai pembatal (konservatif, urutan intraday tak diketahui dari lilin harian).
            <br /><b>n</b> = jumlah hari mulai; jendela {'>'}1 hari saling beririsan, jadi n bukan bukti bebas sebanyak itu — ≈n/20 jendela bebas ({'"'}jendela bebas{'"'} di atas) adalah perkiraan yang lebih jujur.
          </div>
        </div>

        {peringatanAtr && k.atr_pct != null && (
          <div className="catat awas" style={{ marginTop: 12 }}>
            <b>Peringatan yang dihasilkan metode ini sendiri.</b> Jarak ke pembatal ({fmtPct0(k.stop_pct)}) lebih kecil
            daripada satu ATR harian ({fmtPct0(k.atr_pct)}) — level itu berada di dalam ayunan harian normal emiten
            ini. Tabel skenario di atas membuktikannya sendiri: lihat baris level terdekat, peluang pembatal
            tersentuh lebih dulu setara lemparan koin, bukan rencana.
          </div>
        )}

        <div className="tesis">
          <p><b>Yang terbaca.</b> {tesis.terbaca.join(' ')}</p>
          <p><b>Yang membatalkan.</b> {tesis.membatalkan.join(' ')}</p>
          <p><b>Yang perlu diingat.</b> {tesis.perluDiingat.join(' ')}</p>
        </div>
      </div>
    </article>
  )
}

/** Kalimat kompak posisi harga vs MA20/50/200, dikelompokkan per arah
 *  ("Di atas MA20 & MA50, di bawah MA200") — dipakai HANYA di kartu ringkas;
 *  Lengkap punya narasi lebih lengkap lewat `bangunTesis()`. */
function ringkasStruktur(k: KartuEmiten): string | null {
  type Bag = { arah: 'atas' | 'bawah'; label: string }
  const item = ([
    k.ma20 != null ? { arah: k.harga >= k.ma20 ? 'atas' : 'bawah', label: 'MA20' } : null,
    k.ma50 != null ? { arah: k.harga >= k.ma50 ? 'atas' : 'bawah', label: 'MA50' } : null,
    k.ma200 != null ? { arah: k.harga >= k.ma200 ? 'atas' : 'bawah', label: 'MA200' } : null,
  ] as (Bag | null)[]).filter((x): x is Bag => x !== null)
  if (item.length === 0) return null
  const grup: { arah: string; label: string[] }[] = []
  for (const it of item) {
    const akhir = grup[grup.length - 1]
    if (akhir && akhir.arah === it.arah) akhir.label.push(it.label)
    else grup.push({ arah: it.arah, label: [it.label] })
  }
  const teks = grup.map((g) => `di ${g.arah} ${g.label.join(' & ')}`).join(', ')
  return teks.charAt(0).toUpperCase() + teks.slice(1)
}

/**
 * Kartu Ringkas — satu kartu padat seukuran ponsel per emiten (tab Ringkas
 * `/kartu?tab=ringkas`). SENGAJA jauh lebih sedikit dari tab Lengkap: cuma
 * S1/R1 (bukan enam level), satu angka first-passage (R1), musiman & S2/S3/
 * R2/R3 disembunyikan di balik "Lihat detail" (bukan dihapus — tetap bisa
 * dicapai tanpa pindah tab). TIDAK ADA skor tunggal, ekspektasi dalam jam,
 * ENTRY/SL/R:R, atau penanda "HIT" — lihat CLAUDE.md kenapa.
 */
function KartuRingkasSatuEmiten({ kode }: { kode: string }) {
  const { data: k, status } = useKartu(kode)
  const kamus = useKamusEmiten()
  const nama = kamus?.emiten.find((e) => e.kode === kode)?.nama

  if (status === 'memuat') {
    return <div className="panel kta-kartu kta-ringkas"><div className="panel-b"><p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>Memuat {kode}…</p></div></div>
  }
  if (status === 'belum-tersedia' || !k) {
    return (
      <div className="panel kta-kartu kta-ringkas">
        <div className="panel-b">
          <p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>Kartu {kode} belum tersedia.</p>
        </div>
      </div>
    )
  }

  // Basi dihitung dari hari BURSA sejak `dihitung`, bukan tanggal kalender
  // (lib/tanggalBursa.ts — proyek ini melarang `new Date()` lepas untuk
  // aritmetika tanggal semacam ini, sudah dua kali jadi bug).
  const selisih = hariBursaSejak(k.dihitung, todayIsoJakarta())
  const tier = tingkatBasi(selisih)
  // Momentum (RSI/StochRSI/ER/asing 5h) diredam kalau basi >=5 hari bursa —
  // LEVEL tidak, level bergerak lambat, momentun yang basi itu yang bohong.
  const redupStyle = tier === 'basi' ? { opacity: 0.55 } : undefined

  const struktur = ringkasStruktur(k)
  const s1 = k.support[0]
  const r1 = k.resistance[0]
  const t1 = k.target[0]
  const f1 = t1?.fp
  const takKeduanya1 = f1 ? hitungTakKeduanya(f1) : null
  const peringatanAtr = pembatalDalamAtr(k)
  const s = k.sektor
  const berisiko = papanBerisiko(s.papan)
  const asingP5 = k.asing?.periode['5']
  const satBeli = k.asing?.satuan.beli ?? 'lembar'

  return (
    <article className="panel kta-kartu kta-ringkas">
      <div className="panel-h kta-kepala">
        <div>
          <a className="tick kta-tik" href={`/grafik?kode=${kode}`}>{kode}</a>
          <span className="kta-nama">{nama ?? s.nama ?? kode}</span>
        </div>
        <div className={`kta-harga ${naikTurun(k.chg)}`}>
          {fmtHarga(k.harga)}
          <small>{fmtPct(k.chg)} · {k.tgl}</small>
        </div>
      </div>

      <div className="panel-b">
        {tier !== 'segar' && (
          <span className={tier === 'basi' ? 'badge badge-risiko kta-basi' : 'chip-t kta-basi'}>
            {tier === 'basi' ? '⚠ ' : ''}data {selisih} hari bursa lalu
          </span>
        )}

        {struktur && (
          <p className="kta-struktur">
            {struktur} · ATR <span style={redupStyle}>{fmtPct0(k.atr_pct)}</span> · RSI <span style={redupStyle}>{fmtDes(k.rsi, 0)}</span>
          </p>
        )}

        {r1 && <BarisLevel tipe="R" urutan={1} lv={r1} />}
        {s1 && <BarisLevel tipe="S" urutan={1} lv={s1} />}

        {f1 && (
          <div className="baris">
            <span>R1 tersentuh dulu</span>
            <span className="up">{fmtPct0(f1.p_kena)} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(n≈{f1.n_efektif ?? '—'})</span></span>
          </div>
        )}
        {takKeduanya1 != null && (
          <div className="baris"><span>Tak keduanya</span><span>{fmtPct0(takKeduanya1)}</span></div>
        )}
        {f1?.median_hari != null && (
          <div className="baris"><span>Median waktu</span><span>{fmtDes(f1.median_hari, f1.median_hari % 1 ? 1 : 0)} hb</span></div>
        )}

        <div className="kta-chip-baris">
          {s.sektor && <span className="chip-t">{s.sektor_en ?? s.sektor}</span>}
          {k.er_persentil != null && k.er_n_populasi != null && (
            <span className="chip-t" style={redupStyle}>Karakter: persentil {Math.round(k.er_persentil)} dari {k.er_n_populasi}</span>
          )}
          {k.stochrsi && (
            <span className="chip-t" style={redupStyle}>StochRSI {Math.round(k.stochrsi[0])}/{Math.round(k.stochrsi[1])}</span>
          )}
          {berisiko && <span className="badge badge-risiko">⚠ Papan {s.papan}</span>}
        </div>

        <div className="baris">
          <span>Asing net 5h</span>
          {asingP5
            ? <span className={naikTurun(asingP5.net)} style={redupStyle}>{asingP5.net >= 0 ? '+' : ''}{fRingkas(asingP5.net)} {satBeli}</span>
            : <span style={{ color: 'var(--text3)' }}>belum tersedia</span>}
        </div>

        {peringatanAtr && k.atr_pct != null && (
          <div className="catat awas kta-awas-ringkas">
            Pembatal ({fmtPct0(k.stop_pct)}) ada di dalam satu ATR harian ({fmtPct0(k.atr_pct)}) — bukan level yang berarti, lemparan koin.
          </div>
        )}

        <RencanaJejak kode={kode} />

        <details className="kta-lihat">
          <summary>Lihat detail</summary>
          <div className="asal" style={{ marginTop: 6 }}>
            {(k.resistance.length > 1 || k.support.length > 1) && (
              <div style={{ marginBottom: 8 }}>
                {k.resistance.slice(1).map((lv, i) => <BarisLevel key={`r${i}`} tipe="R" urutan={i + 2} lv={lv} />)}
                {k.support.slice(1).map((lv, i) => <BarisLevel key={`s${i}`} tipe="S" urutan={i + 2} lv={lv} />)}
              </div>
            )}
            <div className="baris"><span>Musiman {BULAN[Number(k.tgl.slice(5, 7)) - 1]}</span><span>{k.musiman.naik} dari {k.musiman.n} tahun naik</span></div>
            <div className="baris"><span>Selang 95% (Wilson)</span><span>{fmtPct0(k.musiman.bawah, 0)} – {fmtPct0(k.musiman.atas, 0)} (n={k.musiman.n})</span></div>
            <p style={{ margin: '8px 0 0' }}>
              <b>Asal:</b> S/R dari klaster pivot fraktal (500 lilin terakhir sejak {k.mulai}). First-passage dari
              seluruh riwayat, horizon 20 hari bursa, disentuh low/high intraday (bukan penutupan). Musiman dari
              imbal bulanan + selang Wilson. Rincian penuh &amp; tabel skenario R2/R3 ada di tab Lengkap.
            </p>
          </div>
        </details>
      </div>
    </article>
  )
}

type UrutScreener = { kunci: keyof BarisTabel; arah: 'naik' | 'turun'; klik: (k: keyof BarisTabel) => void }

/** Judul kolom yang bisa diklik untuk mengurutkan — sama pola dengan `thSort`
 *  di TopStocks.tsx/TopBroker.tsx, disalin bukan diimpor karena `keyof`-nya
 *  berbeda tipe per tabel (kemampuan generik tak menyeberang berkas di sini). */
function thSortScreener(s: UrutScreener, k: keyof BarisTabel, label: string, kanan = false) {
  const aktif = s.kunci === k
  return (
    <th className={kanan ? 'r' : undefined}>
      <button type="button" className="th-sort" onClick={() => s.klik(k)}>
        {label}{aktif ? (s.arah === 'naik' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/**
 * Tab "Semua" (`/kartu?tab=semua`) — C3 backlog, tabel penyaring SELURUH
 * emiten yang lolos ambang (`data-idx/json/kartu/ringkas.json`), bukan kartu
 * satu-per-satu. SENGAJA tanpa kolom peluang (`p_kena`/`harapan`): kolom itu
 * fungsi geometri jarak, bukan kualitas emiten — lihat kepala kartuRingkas.ts.
 * Saringan berupa kalimat kondisi + jumlah lolos, nol chip aktif bawaan.
 */
function TabelScreenerKartu() {
  const indeks = useIndeksKartu()
  const dataTerkini = useRingkasKartu()
  const [tanggal, setTanggal] = useState<string | null>(null)
  const dataArsip = useArsipKartu(tanggal)
  const data = tanggal ? dataArsip : dataTerkini
  const sempit = useLayarSempit()
  const [aktif, setAktif] = useState<string[]>(CHIP_BAWAAN)
  const [sembunyikanPendek, setSembunyikanPendek] = useState(false)
  const [sembunyikanTipis, setSembunyikanTipis] = useState(false)
  const [tingkatLikuiditas, setTingkatLikuiditas] = useState('semua')
  const [cari, setCari] = useState('')
  const [catatanKode, setCatatanKode] = useState<string | null>(null)
  const ukuranHalaman = sempit ? 25 : 100
  const [tampil, setTampil] = useState(ukuranHalaman)

  const barisTabel = useMemo(() => (data ? data.emiten.map(keBarisTabel) : []), [data])
  const barisKualitas = useMemo(
    () => saringKualitas(barisTabel, sembunyikanPendek, sembunyikanTipis),
    [barisTabel, sembunyikanPendek, sembunyikanTipis],
  )
  // Set 150-teratas dihitung dari SELURUH baris (tak ikut tersaring chip/cari
  // lain) — "semesta" meniru cara IDX sendiri mengurutkan pasar, bukan
  // sub-populasi hasil saringan pembaca. Cuma dihitung saat tingkat itu aktif.
  const teratasLikuiditas = useMemo(
    () => (tingkatLikuiditas === 'semesta' ? kodePeringkatTeratas(barisTabel, (b) => b.likuiditas, 150, (b) => b.kode) : null),
    [barisTabel, tingkatLikuiditas],
  )
  const hasilChip = useMemo(() => saring(barisKualitas, aktif, cari), [barisKualitas, aktif, cari])
  const hasil = useMemo(
    () => hasilChip.filter((b) => ujiLikuiditas(b, tingkatLikuiditas, (x) => x.likuiditas, teratasLikuiditas, (x) => x.kode)),
    [hasilChip, tingkatLikuiditas, teratasLikuiditas],
  )
  const s = useUrut<BarisTabel>(hasil, 'kode', 'naik')
  const nLolosLikuiditas = useMemo(
    () => barisTabel.filter((b) => ujiLikuiditas(b, tingkatLikuiditas, (x) => x.likuiditas, teratasLikuiditas, (x) => x.kode)).length,
    [barisTabel, tingkatLikuiditas, teratasLikuiditas],
  )

  // Saringan/cari/tanggal baru = mulai dari halaman pertama lagi, bukan
  // menyambung dari batas lama (yang bisa lebih besar dari hasil baru).
  useEffect(() => {
    setTampil(ukuranHalaman)
  }, [aktif, cari, ukuranHalaman, tanggal, sembunyikanPendek, sembunyikanTipis, tingkatLikuiditas])
  useEffect(() => { setCatatanKode(null) }, [tanggal])

  function toggleChip(id: string) {
    setAktif((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  }

  const tersediaArsip = indeks?.arsip?.length ? new Set(indeks.arsip) : undefined
  const tanggalAktif = tanggal ?? (data?.diperbarui ? data.diperbarui.slice(0, 10) : '')

  // "Semua" tab HANYA menampilkan ringkasan per tanggal — kartu penuh per
  // emiten (tab Lengkap/Ringkas) cuma untuk tanggal terkini. Klik kode saat
  // tanggal lampau dipilih menampilkan catatan, bukan pindah halaman.
  function klikKode(e: React.MouseEvent, kode: string) {
    if (tanggal) {
      e.preventDefault()
      setCatatanKode(kode)
    }
  }

  if (!data) return <p style={{ color: 'var(--text3)', fontSize: 12.5 }}>Memuat daftar emiten…</p>

  const tampilBaris = s.urut.slice(0, tampil)
  const sisa = s.urut.length - tampilBaris.length
  const nRiwayatPendek = barisTabel.filter((b) => b.kualitas?.riwayat === 'pendek').length
  const nLikuiditasTipis = barisTabel.filter((b) => b.kualitas?.likuiditas === 'tipis').length

  return (
    <div className="panel kta-screener">
      <div className="panel-b">
        {/* Bilah kendali berkelompok — sistem tata C+A (lantai.css). Tanggal
            · Saring; Cari di grup-kanan. */}
        <div className="bilah-kendali kta-screener-alat">
          {tersediaArsip && (
            <>
              <div className="grup-k">
                <DatePicker
                  value={tanggalAktif}
                  onChange={setTanggal}
                  tersedia={tersediaArsip}
                  ariaLabel="Tanggal data"
                />
                {tanggal && (
                  <button type="button" className="chip-t" onClick={() => setTanggal(null)}>Tanggal terkini</button>
                )}
              </div>
              <span className="pemisah-v" aria-hidden="true" />
            </>
          )}
          <div className="grup-k">
            <span className="grup-lbl">Saring</span>
            {SARINGAN.map((sar) => {
              const jumlah = barisTabel.filter(sar.uji).length
              return (
                <button
                  key={sar.id} type="button"
                  className={`chip-t${aktif.includes(sar.id) ? ' on' : ''}`}
                  onClick={() => toggleChip(sar.id)}
                >
                  {sar.label} · {jumlah}
                </button>
              )
            })}
            <button
              type="button"
              className={`chip-t${sembunyikanPendek ? '' : ' on'}`}
              onClick={() => setSembunyikanPendek((v) => !v)}
              title="Riwayat < 250 lilin — di luar populasi statistik (ER persentil, median pasar)"
            >
              Riwayat pendek · {nRiwayatPendek}
            </button>
            <button
              type="button"
              className={`chip-t${sembunyikanTipis ? '' : ' on'}`}
              onClick={() => setSembunyikanTipis((v) => !v)}
              title="Likuiditas < Rp500 jt/hari (median 20h) — di luar populasi statistik"
            >
              Likuiditas tipis · {nLikuiditasTipis}
            </button>
            <Dropdown
              opsi={TINGKAT_LIKUIDITAS.map((t) => ({ nilai: t.id, label: t.label }))}
              nilai={tingkatLikuiditas}
              onGanti={setTingkatLikuiditas}
              ariaLabel="Likuiditas"
              placeholder="Semua likuiditas"
            />
          </div>
          <span className="pemisah-v" aria-hidden="true" />
          <div className="grup-k grup-kanan">
            <span className="af-cari kta-screener-cari">
              <input
                className="inp" type="search" placeholder="Cari emiten: BUMI, BBCA…" value={cari}
                onChange={(e) => setCari(e.target.value.toUpperCase())}
              />
            </span>
          </div>
        </div>
      </div>

      {catatanKode && (
        <p className="asal" role="status" style={{ padding: '0 14px 10px' }}>
          Kartu lengkap {catatanKode} tersedia untuk tanggal terkini; tabel ini ringkasan per tanggal.{' '}
          <button type="button" className="btn-p" onClick={() => setCatatanKode(null)}>Tutup</button>
        </p>
      )}

      <div className="board-tbl-wrap">
        <table className="tbl kta-screener-tbl">
          <thead>
            <tr>
              {thSortScreener(s, 'kode', 'Kode')}
              {thSortScreener(s, 'harga', 'Harga', true)}
              {thSortScreener(s, 'chg', '%chg', true)}
              {thSortScreener(s, 'ma20_pct', 'vs MA20', true)}
              {thSortScreener(s, 's1_pct', 'Jarak S1', true)}
              {thSortScreener(s, 'r1_pct', 'Jarak R1', true)}
              {thSortScreener(s, 'er_persentil', 'ER persentil', true)}
              {thSortScreener(s, 'likuiditas', 'Likuiditas', true)}
              {thSortScreener(s, 'tgl', 'Data')}
            </tr>
          </thead>
          <tbody>
            {tampilBaris.map((b) => (
              <tr key={b.kode}>
                <td>
                  <a href={`/grafik?kode=${b.kode}`} className="tick" onClick={(e) => klikKode(e, b.kode)}>{b.kode}</a>
                  {b.kualitas?.riwayat === 'pendek' && (
                    <span className="chip-t kta-lencana" title={`${b.kualitas.lilin.toLocaleString('id-ID')} lilin`}>riwayat &lt; 250 lilin</span>
                  )}
                  {b.kualitas?.likuiditas === 'tipis' && (
                    <span className="chip-t kta-lencana" title="likuiditas median 20 hari di bawah Rp500 jt/hari">likuiditas &lt; Rp500jt/hari</span>
                  )}
                </td>
                <td className="r num">{keFraksi(b.harga, 'dekat').toLocaleString('id-ID')}</td>
                <td className={`r num ${b.chg == null ? '' : b.chg >= 0 ? 'up' : 'dn'}`}>{fp(b.chg)}</td>
                <td className={`r num ${b.ma20_pct == null ? '' : b.ma20_pct >= 0 ? 'up' : 'dn'}`}>
                  {b.ma20_pct == null ? '—' : fp(b.ma20_pct)}
                </td>
                <td className="r num">{b.s1_pct == null ? '—' : `${fp(b.s1_pct)} (${fN(b.s1_atr, 1)} ATR)`}</td>
                <td className="r num">{b.r1_pct == null ? '—' : `${fp(b.r1_pct)} (${fN(b.r1_atr, 1)} ATR)`}</td>
                <td className="r num">{b.er_persentil == null ? '—' : Math.round(b.er_persentil)}</td>
                <td className="r num">{fRingkas(b.likuiditas)}</td>
                <td className="num">{b.tgl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tampilBaris.length === 0 && (
        <p style={{ color: 'var(--text3)', fontSize: 12.5, padding: '10px 14px' }}>
          Tak ada emiten cocok dengan saringan/kata cari ini.
        </p>
      )}

      {sisa > 0 && (
        <div style={{ padding: '10px 14px' }}>
          <button type="button" className="btn-p" onClick={() => setTampil((t) => t + ukuranHalaman)}>
            Muat {Math.min(sisa, ukuranHalaman)} lagi
          </button>
        </div>
      )}

      <div className="asal kta-screener-kaki">
        <b>{data.emiten.length}</b> emiten · {data.tak_lolos.riwayat ?? 0} riwayat pendek ·{' '}
        {data.tak_lolos.likuiditas ?? 0} likuiditas tipis (ikut ditampilkan, di luar populasi statistik)
        {tingkatLikuiditas !== 'semua' && <> · <b>{nLolosLikuiditas}</b> lolos tingkat likuiditas "{TINGKAT_LIKUIDITAS.find((t) => t.id === tingkatLikuiditas)?.label}"</>} ·{' '}
        menampilkan {hasil.length} sesudah saringan · diperbarui {data.diperbarui}
        {tanggal ? ` · tanggal ${tanggal}` : ''}. Tidak ada kolom peluang tersentuh (p_kena) di tabel ini — itu
        fungsi jarak, bukan kualitas emiten.
      </div>
    </div>
  )
}

/**
 * Kartu Analisa Emiten (`/kartu`) — kartu per emiten dirakit dari berkas
 * turunan `data-idx/json/kartu/<KODE>.json` (ditulis
 * `scripts/riset/kartu_analisa.py --tulis`, JANGAN dihitung ulang di sini).
 * Tata letak & isi mengikuti Bagian 2 `docs/riset/kartu-analisa.html`
 * (rancangan yang sudah disetujui) — tesis & peringatan dirakit dari data
 * lewat `bangunTesis()`/`pembatalDalamAtr()`, bukan diketik untuk emiten
 * tertentu, supaya berlaku untuk emiten mana pun yang ada di `index.json`.
 *
 * SENGAJA tidak ada: skor tunggal (belum dikalibrasi — lihat modul Python),
 * bahasa ajakan beli/jual, dan jalur berkas/nama fungsi di layar.
 */
type TabKartu = 'lengkap' | 'ringkas' | 'semua'

export function KartuAnalisa() {
  const indeks = useIndeksKartu()
  const kamus = useKamusEmiten()
  const [param, setParam] = useSearchParams()
  const [filter, setFilter] = useState<string>(() => {
    const q = (param.get('kode') ?? '').trim().toUpperCase()
    return /^[A-Z0-9]{2,6}$/.test(q) ? q : ''
  })
  const tabParam = param.get('tab')
  const tab: TabKartu = tabParam === 'ringkas' ? 'ringkas' : tabParam === 'semua' ? 'semua' : 'lengkap'

  function pilihTab(t: TabKartu) {
    setParam((lama) => {
      const baru = new URLSearchParams(lama)
      if (t !== 'lengkap') baru.set('tab', t); else baru.delete('tab')
      return baru
    }, { replace: true })
  }

  const opsi = useMemo<OpsiDropdown[]>(() => {
    const dasar: OpsiDropdown[] = [{ nilai: '', label: 'Semua emiten' }]
    if (!indeks) return dasar
    return dasar.concat(
      indeks.emiten.map((e) => ({
        nilai: e.kode,
        label: `${e.kode}${kamus ? ` — ${kamus.emiten.find((x) => x.kode === e.kode)?.nama ?? ''}` : ''}`,
      })),
    )
  }, [indeks, kamus])

  function pilih(kode: string) {
    setFilter(kode)
    setParam((lama) => {
      const baru = new URLSearchParams(lama)
      if (kode) baru.set('kode', kode); else baru.delete('kode')
      return baru
    }, { replace: true })
  }

  const daftarTampil = useMemo(() => {
    if (!indeks) return []
    if (filter) return indeks.emiten.filter((e) => e.kode === filter)
    if (indeks.emiten.length > BATAS_TAMPIL_SEMUA) return []
    return indeks.emiten
  }, [indeks, filter])

  return (
    <div className="lantai">
      <div className="vhead">
        <h1>Kartu Analisa Emiten</h1>
        <span className="sub">
          struktur harga, level, musiman &amp; fundamental — tiap angka membawa asal-usulnya ·{' '}
          <Link to="/metodologi" className="kd-tautan">Metodologi &amp; sumber data →</Link>
        </span>
      </div>

      {tab !== 'semua' && (
        <div className="panel kta-pilih">
          <div className="panel-b">
            {/* Bilah kendali — sistem tata C+A (lantai.css). Satu kelompok:
                pilih emiten; jumlah tersedia di grup-kanan. */}
            <div className="bilah-kendali">
              <div className="grup-k">
                <Dropdown opsi={opsi} nilai={filter} onGanti={pilih} ariaLabel="Pilih emiten" placeholder="Semua emiten" />
              </div>
              {indeks && (
                <>
                  <span className="pemisah-v" aria-hidden="true" />
                  <div className="grup-k grup-kanan">
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{indeks.emiten.length} emiten tersedia · diperbarui {indeks.diperbarui}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Bentuk kartu">
        <button
          type="button" role="tab" aria-selected={tab === 'lengkap'}
          className={`tab${tab === 'lengkap' ? ' on' : ''}`}
          onClick={() => pilihTab('lengkap')}
        >
          Lengkap
        </button>
        <button
          type="button" role="tab" aria-selected={tab === 'ringkas'}
          className={`tab${tab === 'ringkas' ? ' on' : ''}`}
          onClick={() => pilihTab('ringkas')}
        >
          Ringkas
        </button>
        <button
          type="button" role="tab" aria-selected={tab === 'semua'}
          className={`tab${tab === 'semua' ? ' on' : ''}`}
          onClick={() => pilihTab('semua')}
        >
          Semua
        </button>
      </div>

      {tab === 'semua' && <TabelScreenerKartu />}

      {tab !== 'semua' && !indeks && <p style={{ color: 'var(--text3)', fontSize: 12.5 }}>Memuat daftar emiten…</p>}

      {tab !== 'semua' && indeks && daftarTampil.length === 0 && !filter && (
        <p style={{ color: 'var(--text3)', fontSize: 12.5 }}>Pilih satu emiten dari daftar di atas untuk melihat kartunya.</p>
      )}

      {tab === 'lengkap' && daftarTampil.map((e) => <KartuSatuEmiten key={e.kode} kode={e.kode} />)}
      {tab === 'ringkas' && daftarTampil.map((e) => <KartuRingkasSatuEmiten key={e.kode} kode={e.kode} />)}

      <div className="catat">
        <b>Metode.</b> Seluruh angka di kartu ini dihitung dari data harga historis PAPAN sendiri — klaster
        support/resistance dari pivot fraktal, ekspektasi waktu dari first-passage empiris, musiman dari imbal
        bulanan dengan selang Wilson. Tidak ada skor tunggal: skor gabungan baru ditampilkan setelah dikalibrasi
        dari arsip kartu ini sendiri.
      </div>

      <footer className="kta-kaki">
        <p><strong>Disclaimer.</strong> Seluruh isi halaman ini bersifat <strong>edukatif dan informasional</strong>.
        Ini <strong>bukan rekomendasi investasi</strong>, bukan ajakan membeli atau menjual efek apa pun, dan
        <strong> bukan nasihat dari penasihat investasi berizin</strong>. Angka probabilitas, level harga, dan
        ekspektasi waktu di sini adalah ringkasan statistik dari data historis — kinerja masa lalu tidak menjamin
        hasil di masa depan, dan tidak ada satu pun angka di halaman ini yang merupakan prediksi.</p>
        <p><strong>Manajemen risiko.</strong> Tabel skenario di tiap kartu menunjukkan bahwa pada mayoritas kejadian
        historis, harga tidak menyentuh target maupun pembatal dalam horizon yang diukur — hasil paling sering
        terjadi adalah &quot;tidak terjadi apa-apa&quot;. Setiap keputusan transaksi menanggung risiko kehilangan
        sebagian atau seluruh modal. Batasi ukuran posisi terhadap total portofolio, tetapkan batas kerugian
        sebelum masuk (bukan sesudahnya), dan sebarkan risiko antar-emiten dan antar-sektor. Emiten di Papan
        Pemantauan Khusus menanggung risiko tambahan yang tidak tercermin di rasio keuangan mana pun. Keputusan
        tetap sepenuhnya berada pada masing-masing pembaca.</p>
      </footer>
    </div>
  )
}
