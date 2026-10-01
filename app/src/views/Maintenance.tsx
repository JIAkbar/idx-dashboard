import { useRef, type RefObject } from 'react'
import './Maintenance.css'
import isi from './pemeliharaan.json'

/**
 * Halaman tutup sementara — satu-satunya yang tayang saat PAPAN direnovasi.
 *
 * Perintah Johan 1 Sep 2026: *"karena masih tahap renovasi jadi lebih baik
 * papan di tutup dulu untuk sementara, berikan icon papan terbaru dan under
 * maintenance"*. Dirancang ulang 1 Okt 2026 (#256 A): *"buatkan landing page
 * under maintenance yang top dewa"* + *"tutup saja papan"*.
 *
 * ## Empat batasan, dan tiga di antaranya soal apa yang TIDAK dilakukan
 *
 * 1. **Nol fetch data.** Tak satu pun permintaan jaringan dari halaman ini.
 *    Ia satu-satunya halaman publik selama renovasi, jadi ia juga satu-satunya
 *    yang bisa membocorkan alamat sumber data ke siapa pun yang membuka panel
 *    jaringan peramban. Ikon, latar candle, dan pita berjalan digambar inline;
 *    fonnya fon sistem — bahkan permintaan gambar atau fon pun tak ada.
 * 2. **Tanpa tanggal janji, tanpa angka pura-pura.** "Segera kembali", bukan
 *    tanggal. Pita berjalan memuat NAMA bagian PAPAN, bukan harga: angka yang
 *    terlihat seperti kutipan bursa tapi bukan data hidup adalah kebohongan
 *    yang tayang publik.
 * 3. **Tak memakai konteks aplikasi.** Tidak ada ThemeProvider/AuthProvider di
 *    atasnya: gerbangnya berada di LUAR seluruh penyedia konteks, supaya
 *    menutup PAPAN tak bergantung pada satu pun bagian yang sedang direnovasi.
 *    Karena itu temanya dari `prefers-color-scheme` murni.
 * 4. **Tanpa tautan ke mana pun.** Tak ada tombol "coba lagi" atau tautan
 *    masuk — keduanya cuma memancing orang menemukan rute yang sengaja
 *    ditutup. (Satu-satunya tautan menuju bagian di halaman ini sendiri.)
 *
 * ## Laporan di bawah layar pertama (#266, Johan 1 Okt 2026)
 *
 * *"halaman sekarang sudah under maintenance tapi tetep harus tetap ber
 * kontribusi"*: potret IHSG, rekam jejak Deep Dive, dan Deep Dive terbaru.
 * Batasan 1 tetap: angkanya dibakukan saat build lewat `pemeliharaan.json`
 * (`scripts/ringkas_pemeliharaan.py`), bukan diambil dari jaringan. Deep Dive
 * baru hanya tampil bila `deepdive.disetujui`; drafnya ditinjau Johan dulu.
 */

// Nama bagian PAPAN yang sedang dibenahi — label, bukan data.
const BAGIAN = [
  'Arus Broker', 'Aliran Asing', 'Kartu Analisa', 'Screener', 'Bandarmologi',
  'Harian Papan', 'Watchlist', 'Seasonality', 'Berkas Emiten', 'Kartu Pagi',
]

// Siluet candle dekoratif [tinggi tubuh, panjang sumbu, posisi y, naik?].
// Statis, bukan deret harga — hanya pola yang dikenali mata pembaca pasar.
const CANDLE: Array<[number, number, number, boolean]> = [
  [38, 22, 70, true], [30, 18, 82, false], [46, 26, 64, true], [26, 14, 90, true],
  [52, 30, 58, false], [34, 20, 76, true], [60, 28, 50, true], [28, 16, 86, false],
  [44, 24, 66, true], [36, 22, 74, false], [56, 30, 54, true], [32, 18, 80, true],
  [48, 26, 60, false], [40, 20, 70, true], [62, 32, 46, true], [30, 16, 84, false],
  [50, 28, 58, true], [38, 22, 72, true],
]

function LatarCandle() {
  const lebar = 34
  return (
    <svg className="mt-candle" viewBox={`0 0 ${CANDLE.length * lebar} 160`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {CANDLE.map(([tubuh, sumbu, y, naik], i) => {
        const x = i * lebar + lebar / 2
        return (
          <g key={i} className={naik ? 'mt-c-naik' : 'mt-c-turun'} style={{ animationDelay: `${(i % 6) * 0.7}s` }}>
            <line x1={x} x2={x} y1={y - sumbu / 2} y2={y + tubuh + sumbu / 2} />
            <rect x={x - 7} y={y} width={14} height={tubuh} rx={2} />
          </g>
        )
      })}
    </svg>
  )
}

const angka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const rp = (v: number) => angka.format(v)
const persen = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${angka.format(Math.abs(v))}%`
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tgl = (iso: string) => `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const kelasArah = (v: number) => (v < 0 ? 'mt-turun-teks' : v > 0 ? 'mt-naik-teks' : '')

function PotretIhsg() {
  const h = isi.ihsg
  return (
    <section className="mt-bagian" aria-labelledby="mt-ihsg">
      <header>
        <p className="mt-eyebrow">Kondisi pasar · {tgl(h.tanggal)}</p>
        <h2 id="mt-ihsg">IHSG sedang dalam tren turun</h2>
      </header>
      <div className="mt-angka-besar">
        <strong>{rp(h.close)}</strong>
        <span className={kelasArah(h.hari_pct)}>{persen(h.hari_pct)} hari ini</span>
      </div>
      <dl className="mt-kisi">
        <div><dt>5 hari bursa</dt><dd className={kelasArah(h.lima_pct)}>{persen(h.lima_pct)}</dd></div>
        <div><dt>20 hari bursa</dt><dd className={kelasArah(h.duapuluh_pct)}>{persen(h.duapuluh_pct)}</dd></div>
        <div><dt>Dari puncak {tgl(h.puncak_tanggal)} ({rp(h.puncak)})</dt><dd className={kelasArah(h.dari_puncak_pct)}>{persen(h.dari_puncak_pct)}</dd></div>
        <div><dt>Rata-rata 20 / 50 hari</dt><dd>{rp(Math.round(h.sma20))} / {rp(Math.round(h.sma50))}</dd></div>
        <div><dt>Rata-rata 200 hari</dt><dd>{rp(Math.round(h.sma200))}</dd></div>
      </dl>
      <p className="mt-ket">
        Indeks ditutup di bawah rata-rata 20, 50, dan 200 harinya. Di fase seperti ini,
        jaga ukuran posisi dan tentukan batas rugi sebelum masuk.
      </p>
    </section>
  )
}

const STATUS: Record<string, string> = {
  terbukti: 'Level tercapai berurutan',
  sebagian: 'Sebagian tercapai',
  'belum terjadi': 'Level belum tersentuh',
}

function RekamJejak() {
  const n = isi.jejak.length
  const ok = isi.jejak.filter((j) => j.status === 'terbukti').length
  return (
    <section className="mt-bagian" aria-labelledby="mt-jejak">
      <header>
        <p className="mt-eyebrow">Arsip, bukan rekomendasi</p>
        <h2 id="mt-jejak">Rekam jejak Deep Dive</h2>
        <p className="mt-ket">
          {ok} dari {n} terbitan Agustus mencapai level naiknya berurutan dalam 5 hari bursa,
          dan tak satu pun menyentuh batas invalidasinya. Semuanya terbit saat IHSG masih
          naik, dan lima kasus belum cukup sebagai bukti statistik.
        </p>
      </header>
      <div className="mt-tabel-bungkus">
        <table className="mt-tabel">
          <thead>
            <tr><th>Emiten</th><th>Data s.d.</th><th>Harga acuan</th><th>Level naik</th><th>Invalidasi</th><th>Harga H+5</th><th>Gerak</th><th>Hasil</th></tr>
          </thead>
          <tbody>
            {isi.jejak.map((j) => (
              <tr key={j.kode + j.tanggal}>
                <td><b>{j.kode}</b></td>
                <td>{tgl(j.tanggal)}</td>
                <td>{rp(j.harga_acuan)}</td>
                <td>{j.level_bull.length ? j.level_bull.map(rp).join(' → ') : '—'}</td>
                <td>{j.level_invalid.map(rp).join(', ')}</td>
                <td>{rp(j.harga_h5)}</td>
                <td className={kelasArah(j.gerak_pct)}>{persen(j.gerak_pct)}</td>
                <td><span className={`mt-pil ${j.status === 'terbukti' ? 'mt-pil-ok' : 'mt-pil-tunggu'}`}>{STATUS[j.status] ?? j.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DeepDiveBaru() {
  const dd = isi.deepdive
  if (!dd || !dd.disetujui) return null
  // `pengantar` hanya ada di draf sejak #268; tipe JSON draf lama tak memuatnya.
  const pengantar = (dd as { pengantar?: string }).pengantar
  return (
    <section className="mt-bagian" aria-labelledby="mt-dd">
      <header>
        <p className="mt-eyebrow">Deep Dive · data s.d. {tgl(dd.tanggal)}</p>
        <h2 id="mt-dd">Siapa yang menampung saat pasar turun</h2>
        {pengantar && <p className="mt-ket">{pengantar}</p>}
        <p className="mt-catatan">{dd.metode}</p>
      </header>
      {dd.emiten.map((e) => (
        <article key={e.kode} className="mt-kartu">
          <h3>{e.kode} · {e.judul}</h3>
          <p>{e.tesis}</p>
          <p><b>Asimetri:</b> {e.asimetri}</p>
          <ul>{e.lapis.map((l) => <li key={l}>{l}</li>)}</ul>
          <dl className="mt-skenario">
            <div className="mt-s-naik"><dt>Konfirmasi</dt><dd>{e.konfirmasi}</dd></div>
            <div className="mt-s-naik"><dt>Rute</dt><dd>{e.rute.map(rp).join(' → ')}</dd></div>
            <div className="mt-s-batal"><dt>Invalidasi</dt><dd>{e.invalidasi}</dd></div>
            <div><dt>Peluang 5 hari bursa</dt><dd>capai R1 {e.peluang.R1}% · R2 {e.peluang.R2}% · sentuh S1 {e.peluang.S1}%</dd></div>
          </dl>
          <p><b>Risiko:</b> {e.risiko}</p>
        </article>
      ))}
      {(dd.gugur as { kode: string; alasan: string }[]).map((g) => (
        <p key={g.kode} className="mt-catatan"><b>{g.kode} tidak dilanjutkan.</b> {g.alasan}</p>
      ))}
    </section>
  )
}

type Kal = { skor?: number | string; jebakan?: number | string; n: number; p: number }
type Rezim = 'bullish' | 'bearish'
const pp = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${angka.format(Math.abs(v))} pp`
const prs = (p: number) => `${angka.format(Math.round(p * 1000) / 10)}%`

function LencanaSinyal({ s }: { s: { lift: number; lolos: boolean; gugur?: boolean; jebakan: boolean } }) {
  const [teks, kelas] = s.lolos ? ['Lolos', 'mt-pil-ok'] : s.jebakan ? ['Penjebak', 'mt-turun-teks']
    : s.gugur ? ['Gugur di uji akhir', 'mt-pil-tunggu'] : ['—', 'mt-pil-tunggu']
  return <span className="mt-m-lenc"><span className={kelasArah(s.lift)}>{pp(s.lift)}</span><span className={`mt-pil ${kelas}`}>{teks}</span></span>
}

function ModalPeluang({ dlg }: { dlg: RefObject<HTMLDialogElement | null> }) {
  const p = isi.peluang
  const rez = p.rezim as Rezim
  const nama = p.nama_sinyal as Record<string, string>
  // Sinyal lolos dipakai hanya bila periode uji akhir menegaskannya (lihat scripts/riset/peluang_naik.py).
  const adaLolos = (p.terkonfirmasi as Record<Rezim, boolean>)[rez]
  const kal = (adaLolos ? p.kalibrasi[rez] : p.kalibrasi[`${rez}_jebakan` as 'bullish_jebakan']) as Kal[]
  const tutup = () => dlg.current?.close()
  return (
    <dialog
      ref={dlg}
      className="mt-modal"
      aria-labelledby="mt-m-judul"
      onClick={(e) => { if (e.target === e.currentTarget) tutup() }}
    >
      <div className="mt-modal-isi">
        <button type="button" className="mt-modal-tutup" onClick={tutup} aria-label="Tutup">✕</button>
        <h2 id="mt-m-judul">Peluang Naik</h2>
        <p className="mt-m-baris">
          <span className={`mt-pil ${rez === 'bullish' ? 'mt-pil-ok' : 'mt-turun-teks'}`}>Rezim {rez}</span>
          <span className="mt-ket">IHSG {rp(p.ihsg.close)} vs rata-rata 200 hari {rp(p.ihsg.ma200)}</span>
        </p>
        <p className="mt-ket">
          Yang diukur: peluang harga naik {p.definisi.target_pct}% lebih dulu sebelum turun {p.definisi.batas_pct}% dalam{' '}
          {p.definisi.hari} hari bursa. Diuji pada {angka.format(p.cakupan.observasi)} observasi dari {p.cakupan.emiten} emiten likuid,
          dengan data latih {p.definisi.latih}, validasi {p.definisi.validasi} untuk memilih sinyal, dan uji akhir{' '}
          {p.definisi.uji} untuk menghitung angka peluang. Kolom bullish/bearish menunjukkan selisih terhadap rata-rata di periode validasi. Sebanyak {p.cakupan.sinyal_diuji} sinyal
          dari 13 buku (termasuk Technical Analysis for Mega Profit) dan riset akademik diuji.
        </p>

        <h3>Temuan utama</h3>
        {!adaLolos && (
          <p className="mt-m-temuan">
            Di pasar {rez}, tidak ada satu pun sinyal yang menaikkan peluang di atas rata-rata.
            Yang terbukti hanya sinyal yang MENJEBAK.
          </p>
        )}
        <ul className="mt-m-kal">
          {kal.map((k, i) => {
            const label = adaLolos ? `Skor ${k.skor}` : `${k.jebakan} sinyal penjebak`
            return <li key={i}><span>{label}</span><b>{prs(k.p)}</b><span className="mt-ket">{angka.format(k.n)} observasi</span></li>
          })}
        </ul>

        <h3>Sinyal yang diuji</h3>
        <div className="mt-tabel-bungkus">
          <table className="mt-tabel">
            <thead><tr><th>Sinyal · asal</th><th>Bullish</th><th>Bearish</th></tr></thead>
            <tbody>
              {p.sinyal.map((s) => (
                <tr key={s.nama}>
                  <td className="mt-m-wrap">{s.nama}<span className="mt-m-asal">{s.asal}</span></td>
                  <td><LencanaSinyal s={s.bullish} /></td>
                  <td><LencanaSinyal s={s.bearish} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Tanpa sinyal penjebak (paling likuid)</h3>
        <p className="mt-ket">15 teratas dari {p.jumlah_tanpa_jebakan} emiten tanpa sinyal penjebak.</p>
        <ul className="mt-m-kode">
          {p.teratas.slice(0, 15).map((t) => (
            <li key={t.kode}><a href={`/v2/kartu?kode=${t.kode}`}><b>{t.kode}</b> {rp(t.harga)} · {prs(t.p)}</a></li>
          ))}
        </ul>

        <h3>Sebaiknya dihindari saat ini</h3>
        <ul className="mt-m-kode mt-m-panjang">
          {p.hindari.map((h) => (
            <li key={h.kode}><a href={`/v2/kartu?kode=${h.kode}`}><b>{h.kode}</b></a>
              <span className="mt-ket">{h.jebakan.map((j) => nama[j] ?? j).join('; ')}</span></li>
          ))}
        </ul>

        <h3>Siaga bila pasar berbalik bullish</h3>
        <p className="mt-ket">
          Emiten dengan sinyal bullish aktif hari ini.
          {rez === 'bearish' && ' Di rezim sekarang, sinyal yang ditandai penjebak justru menurunkan peluang, jadi belum bisa dipercaya.'}
        </p>
        <ul className="mt-m-kode mt-m-panjang">
          {p.siaga_bullish.map((s) => (
            <li key={s.kode}><a href={`/v2/kartu?kode=${s.kode}`}><b>{s.kode}</b></a>
              <span className="mt-ket">{s.sinyal.length} sinyal bullish{s.jebakan_kini.length ? ` · ${s.jebakan_kini.length} penjebak kini` : ''}</span></li>
          ))}
        </ul>

        <p className="mt-catatan">
          Catatan metode: observasi saling bertumpuk, jadi rentang keyakinan terlalu sempit. Emiten yang sudah delisting
          tidak ada di data. Hitungan tanpa biaya transaksi. Ini peta peluang, bukan janji.
        </p>
        <p className="mt-catatan">Informasi ini bersifat edukatif, bukan ajakan membeli atau menjual.</p>
      </div>
    </dialog>
  )
}

export function Maintenance() {
  const dlg = useRef<HTMLDialogElement>(null)
  const pita = [...BAGIAN, ...BAGIAN]
  return (
    <div className="mt-halaman">
    <main className="mt-akar">
      <div className="mt-grid" aria-hidden="true" />
      <div className="mt-sorot" aria-hidden="true" />
      <LatarCandle />

      <div className="mt-isi">
        {/* Geometri sama dengan favicon edisi kedua: empat siku pengukur
            mengepung dua bilah nilai. Bilah-bilahnya "mengisi" pelan sebagai
            penanda kerja yang sedang berjalan. */}
        <svg className="mt-ikon" viewBox="0 0 64 64" role="img" aria-label="Lambang PAPAN">
          <g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="square">
            <path d="M11 22V11H22" />
            <path d="M42 11H53V22" />
            <path d="M11 42V53H22" />
            <path d="M42 53H53V42" />
          </g>
          <rect x="20" y="26" width="24" height="7" className="mt-bilah" />
          <rect x="20" y="37" width="14" height="7" className="mt-bilah mt-bilah2" />
        </svg>

        <p className="mt-status" role="status">
          <span className="mt-titik" aria-hidden="true" />
          Sedang direnovasi
        </p>

        <h1 className="mt-nama">PAPAN</h1>
        <p className="mt-sub">Pusat Analisa Pasar Nusantara</p>

        <p className="mt-pesan">
          Kami sedang merapikan data dan tampilan supaya setiap angka yang kamu
          baca lebih lengkap dan lebih bisa dipercaya.
        </p>
        <p className="mt-kembali">Segera kembali.</p>
        <a className="mt-ke-laporan" href="#laporan">Sementara itu, catatan pasar hari ini ↓</a>
        <div className="mt-aksi">
          <a className="mt-tombol" href="/v2/kartu">Coba Kartu Emiten v2</a>
          <button type="button" className="mt-tombol" onClick={() => dlg.current?.showModal()}>Peluang Naik hari ini</button>
        </div>
      </div>

      <div className="mt-pita" aria-hidden="true">
        <div className="mt-pita-jalan">
          {pita.map((b, i) => (
            <span key={i} className="mt-pita-item">
              <span className="mt-pita-tanda">◆</span>
              {b}
              <span className="mt-pita-ket">dibenahi</span>
            </span>
          ))}
        </div>
      </div>
    </main>
    <ModalPeluang dlg={dlg} />
    <div className="mt-laporan" id="laporan">
      <PotretIhsg />
      <DeepDiveBaru />
      <RekamJejak />
      <p className="mt-catatan">
        Informasi ini bersifat edukatif, bukan ajakan membeli atau menjual. Keputusan dan
        risiko investasi sepenuhnya ada pada pembaca.
      </p>
    </div>
    </div>
  )
}
