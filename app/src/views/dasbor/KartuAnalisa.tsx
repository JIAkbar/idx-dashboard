import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dropdown, type OpsiDropdown } from '../../components/dasbor/Dropdown'
import { useKamusEmiten } from '../../lib/dasbor/kamusEmiten'
import { fRingkas } from '../../lib/dasbor/stockDetailFormat'
import { BULAN } from '../../lib/seasonality'
import {
  useIndeksKartu, useKartu, pembatalDalamAtr, bangunTesis,
  type KartuEmiten, type LevelSR, type TargetItem, type FirstPassage,
} from '../../lib/dasbor/kartuAnalisa'
import './KartuAnalisa.css'

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

/** Satu baris tabel skenario first-passage (horizon 20 hari — kolom utama kartu). */
function BarisSkenario({ t }: { t: TargetItem }) {
  const f: FirstPassage = t.fp
  const takKeduanya = f.n ? 100 - (f.p_kena ?? 0) - (f.p_stop ?? 0) : null
  return (
    <tr>
      <td>{fmtHarga(t.harga)}</td>
      <td>{fmtPct(t.pct, 2)}</td>
      <td className="up">{fmtPct0(f.p_kena)}</td>
      <td className="dn">{fmtPct0(f.p_stop)}</td>
      <td>{takKeduanya == null ? '—' : fmtPct0(takKeduanya)}</td>
      <td>{f.median_hari == null ? '—' : `${fmtDes(f.median_hari, f.median_hari % 1 ? 1 : 0)} hb`}</td>
      <td>{f.q1 == null || f.q3 == null ? '—' : `${f.q1}–${f.q3}`}</td>
      <td className={naikTurun(f.harapan)}>{fmtPct(f.harapan, 2)}</td>
    </tr>
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
      <div className="baris">
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

  return (
    <article className="panel kta-kartu">
      <div className="panel-h kta-kepala">
        <div>
          <a className="tick kta-tik" href={`/grafik?kode=${kode}`}>{kode}</a>
          <span className="kta-nama">
            {nama ?? s.nama ?? kode} · {[s.sektor, s.subindustri].filter(Boolean).join(' / ')}
            {' · Papan '}{s.papan ?? '—'}{s.papan === 'Pemantauan Khusus' ? ' ⚠' : ''}
            {s.tercatat ? ` · tercatat ${s.tercatat}` : ''}
          </span>
        </div>
        <div className={`kta-harga ${naikTurun(k.chg)}`}>
          {fmtHarga(k.harga)}
          <small>{fmtPct(k.chg)} · {k.tgl}</small>
        </div>
      </div>

      <div className="panel-b">
        <div className="blok-grid">

          <div className="blok">
            <h4>Struktur Harga</h4>
            <div className="baris"><span>MA20</span><span className={naikTurun(k.harga - (k.ma20 ?? k.harga))}>{fmtDes(k.ma20)}</span></div>
            <div className="baris"><span>MA50</span><span className={naikTurun(k.harga - (k.ma50 ?? k.harga))}>{fmtDes(k.ma50)}</span></div>
            <div className="baris"><span>MA200</span><span className={naikTurun(k.harga - (k.ma200 ?? k.harga))}>{fmtDes(k.ma200)}</span></div>
            <div className="baris"><span>ATR 14 hari</span><span>{fmtDes(k.atr)} ({fmtPct0(k.atr_pct)})</span></div>
            <div className="baris"><span>RSI 14</span><span>{fmtDes(k.rsi)}</span></div>
            <div className="baris"><span>StochRSI</span><span>{k.stochrsi ? `K ${Math.round(k.stochrsi[0])} / D ${Math.round(k.stochrsi[1])}` : '—'}</span></div>
            <div className="asal"><b>Asal:</b> {k.n.toLocaleString('id-ID')} lilin harian sejak {k.mulai}. MA/ATR/RSI/StochRSI dihitung dari deret penutupan &amp; ATR Wilder 14 hari.</div>
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
          <h4>Skenario &amp; Ekspektasi Waktu — dihitung dari {k.target[0]?.fp.n?.toLocaleString('id-ID') ?? '—'} hari historis</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="tp-tbl">
              <thead>
                <tr>
                  <th>Level</th><th>Jarak</th><th>Target dulu</th><th>Pembatal dulu</th>
                  <th>Tak keduanya</th><th>Median waktu</th><th>Q1–Q3</th><th>Harapan</th>
                </tr>
              </thead>
              <tbody>
                {k.target.map((t, i) => <BarisSkenario key={i} t={t} />)}
              </tbody>
            </table>
          </div>
          <div className="asal">
            <b>Pembatal tesis:</b> penutupan di bawah {fmtHarga(k.stop)} ({fmtPct(-k.stop_pct, 2)}).
            <br /><b>Asal:</b> first-passage empiris, horizon 20 hari bursa — dari tiap hari historis, target atau pembatal mana yang tersentuh lebih dulu. Kalau keduanya tersentuh hari yang sama, dihitung sebagai pembatal (konservatif, urutan intraday tak diketahui dari lilin harian).
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
export function KartuAnalisa() {
  const indeks = useIndeksKartu()
  const kamus = useKamusEmiten()
  const [param, setParam] = useSearchParams()
  const [filter, setFilter] = useState<string>(() => {
    const q = (param.get('kode') ?? '').trim().toUpperCase()
    return /^[A-Z0-9]{2,6}$/.test(q) ? q : ''
  })

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
        <span className="sub">struktur harga, level, musiman &amp; fundamental — tiap angka membawa asal-usulnya</span>
      </div>

      <div className="panel kta-pilih">
        <div className="panel-b" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Dropdown opsi={opsi} nilai={filter} onGanti={pilih} ariaLabel="Pilih emiten" placeholder="Semua emiten" />
          {indeks && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{indeks.emiten.length} emiten tersedia · diperbarui {indeks.diperbarui}</span>}
        </div>
      </div>

      {!indeks && <p style={{ color: 'var(--text3)', fontSize: 12.5 }}>Memuat daftar emiten…</p>}

      {indeks && daftarTampil.length === 0 && !filter && (
        <p style={{ color: 'var(--text3)', fontSize: 12.5 }}>Pilih satu emiten dari daftar di atas untuk melihat kartunya.</p>
      )}

      {daftarTampil.map((e) => <KartuSatuEmiten key={e.kode} kode={e.kode} />)}

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
