import { useEffect, useMemo, useState } from 'react'
import { useIhsgOhlc, type BarisOhlc } from '../../lib/dasbor/ihsgOhlc'
import { fetchHari, type DataHarian } from '../../lib/dasbor/dataHarian'
import {
  bulanDiary, performaIhsg, rentangIhsg, selDiary, tallyDiary, type KotakDiary,
} from '../../lib/dasbor/diaryPasar'
import { LangkahTanggal } from './LangkahTanggal'

/**
 * Panel "Diary Pasar" — kalender IHSG berwarna, tally hari naik/turun,
 * performa sembilan periode, rentang Rendah-Tinggi, dan DETAIL per tanggal.
 *
 * Acuannya panel "IDX Diary" RTI Business (empat tangkapan layar Johan di
 * `data ide/`, 21 Agu 2026): sel tanggal bisa DIKLIK dan menjawab dengan
 * angka hari itu (IHSG, nilai, volume, frekuensi), performa sampai 3Y/5Y,
 * dan tiap periode punya baris rentang rendah-tinggi berikut posisi harga
 * sekarang di dalamnya. Rumus & kalibrasinya di `lib/dasbor/diaryPasar.ts`.
 *
 * Tiga sumber data, dan cuma satu yang benar-benar unduhan baru:
 *   - `ihsg_ohlc_ringkas.json` (13 KB) — kalender, tally, dan lilin harian;
 *     sudah ditarik halaman ini.
 *   - `ohlc/IHSG.json` (36 tahun, tinggi/rendah intraday) — SELURUH performa
 *     dan rentang, semua periode dari satu deret. Sejak 6 Sep 2026 ia
 *     menggantikan `ihsg_harian.json` yang cuma punya penutupan: dengan dua
 *     sumber, rentang 3Y/5Y tampil lebih SEMPIT daripada rentang 1Y —
 *     mustahil, dan yang salah bukan hitungannya melainkan datanya.
 *   - `ds_<tanggal>.json` — detail SATU hari, ditarik saat tanggalnya
 *     diklik, lewat `fetchHari` yang cache modulnya dibagi panel lain.
 */

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum']

const fpoin = (v: number): string =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fpersen = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2).replace('.', ',')}%`
const fangka = (v: number, des = 0): string =>
  v.toLocaleString('id-ID', { minimumFractionDigits: des, maximumFractionDigits: des })

/** Nilai transaksi — masukan MILIAR rupiah, satuan berkas hariannya. */
const fnilai = (miliar: number): string =>
  miliar >= 1000 ? `Rp ${fangka(miliar / 1000, 2)} T` : `Rp ${fangka(miliar)} M`
/** Volume — masukan JUTA lembar. */
const fvolume = (juta: number): string =>
  juta >= 1000 ? `${fangka(juta / 1000, 2)} miliar lembar` : `${fangka(juta)} juta lembar`

function Sel({ k, dipilih, onPilih }: {
  k: KotakDiary | null
  dipilih: string | null
  onPilih: (tanggal: string) => void
}) {
  if (!k) return <td className="dia-sel dia-kosong" />
  const s = k.sel
  if (!s) {
    // Hari kerja tanpa data = bursa libur. Tetap diberi angka, tanpa warna:
    // menghapusnya membuat pekan yang ada liburnya tampak bergeser, dan
    // mewarnainya netral berarti mengaku tahu arah hari yang tak pernah
    // diperdagangkan.
    return <td className="dia-sel dia-libur" title="Bursa libur atau belum ada datanya">{k.hari}</td>
  }
  return (
    <td className={`dia-sel dia-${s.arah}${dipilih === s.tanggal ? ' dia-pilih' : ''}`}>
      {/* Tombol di DALAM sel, bukan sel yang diubah display-nya —
          `display:flex` pada <td> membuatnya berhenti berperilaku sel tabel
          (aturan proyek yang sudah dibayar). */}
      <button
        type="button"
        onClick={() => onPilih(s.tanggal)}
        title={`${s.tanggal} · ${fpersen(s.persen)} — klik untuk detail hari itu`}
        aria-label={`Detail ${s.tanggal}`}
      >
        {k.hari}
      </button>
    </td>
  )
}

export function PanelDiary() {
  const baris = useIhsgOhlc()
  // Geser bulan. 0 = bulan hari bursa terakhir, −1 = bulan sebelumnya. Tak
  // pernah maju melewati 0: bulan depan belum ada datanya sama sekali.
  const [geser, setGeser] = useState(0)
  // Tanggal yang diklik + isi berkas hariannya ("Tap date for detail" RTI).
  const [pilih, setPilih] = useState<string | null>(null)
  const [detail, setDetail] = useState<DataHarian | null>(null)
  const [detailGagal, setDetailGagal] = useState(false)
  // Deret OHLC 36 tahun — dasar SELURUH performa & rentang. Sebelum ia tiba,
  // panel tetap menampilkan kalender dan tally dari deret 250 hari; barisnya
  // yang menunggu, bukan seluruh panel.
  const [panjang, setPanjang] = useState<BarisOhlc[] | null>(null)

  useEffect(() => {
    let batal = false
    fetch('/data-idx/json/ohlc/IHSG.json')
      .then((r) => r.json())
      .then((j: { d?: BarisOhlc[] }) => {
        if (!batal && j.d?.length) setPanjang(j.d)
      })
      .catch(() => {}) // gagal = performa & rentang tak tampil; kalender utuh
    return () => { batal = true }
  }, [])

  useEffect(() => {
    if (!pilih) return
    let batal = false
    setDetail(null)
    setDetailGagal(false)
    // Nama berkas harian mengikuti tanggalnya sendiri: ds_yymmdd.
    const stem = `ds_${pilih.slice(2, 4)}${pilih.slice(5, 7)}${pilih.slice(8, 10)}`
    fetchHari(stem)
      .then((d) => { if (!batal) setDetail(d) })
      .catch(() => { if (!batal) setDetailGagal(true) })
    return () => { batal = true }
  }, [pilih])

  const sel = useMemo(() => (baris ? selDiary(baris) : []), [baris])

  // Bawaannya TANGGAL TERAKHIR sudah terpilih (Johan 21 Agu 2026: "secara
  // default terbuka tanggal terakhir gini yaa") — panel langsung menjawab
  // "hari bursa terakhir bagaimana" tanpa perlu satu klik pun. Hanya sekali,
  // saat data pertama tiba: sesudah itu pilihan (termasuk MENUTUP kartunya
  // dengan klik kedua) milik pembaca, bukan milik efek ini.
  const [autoTerpasang, setAutoTerpasang] = useState(false)
  useEffect(() => {
    if (autoTerpasang || !sel.length) return
    setPilih(sel[sel.length - 1].tanggal)
    setAutoTerpasang(true)
  }, [sel, autoTerpasang])
  // Keduanya dari deret PANJANG saja — bukan campuran dua sumber. Itu yang
  // dulu membuat 3Y/5Y punya satuan berbeda dari tetangganya di layar yang sama.
  const performa = useMemo(() => (panjang ? performaIhsg(panjang) : []), [panjang])
  const rentang = useMemo(() => (panjang ? rentangIhsg(panjang) : []), [panjang])

  const bulan = useMemo(() => {
    if (!sel.length) return null
    const akhir = new Date(`${sel[sel.length - 1].tanggal}T00:00:00Z`)
    akhir.setUTCMonth(akhir.getUTCMonth() + geser)
    return bulanDiary(sel, akhir.getUTCFullYear(), akhir.getUTCMonth() + 1)
  }, [sel, geser])

  /**
   * Tally MENGIKUTI bulan yang sedang ditampilkan — jendela 30 harinya
   * berakhir di hari terakhir bulan itu, bukan selalu di data terbaru.
   *
   * Versi pertama menambatkannya ke data terbaru, dan Johan menangkap
   * salahnya dari layar: kalender digeser ke Juni, angka di bawahnya masih
   * milik Agustus — panel yang separuh atasnya menjawab "Juni" dan separuh
   * bawahnya menjawab "Agustus" tanpa memberi tahu.
   */
  const tally = useMemo(() => {
    if (!bulan) return null
    const p2 = (x: number) => String(x).padStart(2, '0')
    const ujung = new Date(Date.UTC(bulan.tahun, bulan.bulan, 0)).getUTCDate()
    const batas = `${bulan.tahun}-${p2(bulan.bulan)}-${p2(ujung)}`
    return tallyDiary(sel.filter((s) => s.tanggal <= batas), 30)
  }, [sel, bulan])

  if (!baris || !bulan || !tally) return null

  // Bulan terjauh yang datanya ada — batas mundur tombol langkah.
  const batasMundur = sel.length
    ? (() => {
      const a = new Date(`${sel[0].tanggal}T00:00:00Z`)
      const b = new Date(`${sel[sel.length - 1].tanggal}T00:00:00Z`)
      return -((b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()))
    })()
    : 0

  const maks = Math.max(...performa.map((p) => Math.abs(p.persen ?? 0)), 1)
  const selPilih = pilih ? sel.find((s) => s.tanggal === pilih) ?? null : null

  return (
    // marginBottom dibuang — lihat catatan sama di PanelBreadth: jarak
    // antar-section diurus gap `.lantai`, satu tempat saja.
    <section className="panel dia-panel">
      <div className="panel-h">
        <span className="lbl">Diary Pasar · IHSG</span>
        <span className="dia-nav">
        <LangkahTanggal
          arah="mundur"
          onClick={() => setGeser((g) => Math.max(batasMundur, g - 1))}
          disabled={geser <= batasMundur}
          ukuran="sebaris"
          label="Bulan sebelumnya"
        />
        <span className="dia-bulan-nama">{NAMA_BULAN[bulan.bulan - 1]} {bulan.tahun}</span>
        <LangkahTanggal
          arah="maju"
          onClick={() => setGeser((g) => Math.min(0, g + 1))}
          disabled={geser >= 0}
          ukuran="sebaris"
          label="Bulan berikutnya"
        />
        </span>
      </div>
      <div className="panel-b dia-isi">
        <div className="dia-kiri">
          <table className="dia-kal">
            <thead>
              <tr>{HARI_PENDEK.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {bulan.minggu.map((m, i) => (
                <tr key={i}>
                  {m.map((kotak, k) => (
                    <Sel key={k} k={kotak} dipilih={pilih}
                      onPilih={(t) => setPilih((lama) => (lama === t ? null : t))} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Detail hari yang diklik — jawaban "Tap date for detail" RTI.
              Angka pasarnya datang dari berkas harian; kalau berkasnya tak
              ada (hari cadangan Yahoo), yang tampil tetap jujur: cuma harga,
              plus keterangan kenapa. */}
          {selPilih && (
            <div className="dia-detail">
              <div className="dia-detail-kepala">
                <b>{selPilih.tanggal}</b>
                <span className={`num ${selPilih.arah === 'turun' ? 'down' : 'up'}`}>
                  {fangka(selPilih.tutup, 2)} · {fpersen(selPilih.persen)} ({fpoin(selPilih.poin)})
                </span>
              </div>
              {detail ? (
                <dl>
                  {detail.ihsg_high !== undefined && detail.ihsg_low !== undefined && (
                    <div><dt>Rentang hari</dt><dd className="num">{fangka(detail.ihsg_low, 2)} – {fangka(detail.ihsg_high, 2)}</dd></div>
                  )}
                  {detail.val_idr_today !== undefined && (
                    <div><dt>Nilai</dt><dd className="num">{fnilai(detail.val_idr_today)}</dd></div>
                  )}
                  {detail.vol_today !== undefined && (
                    <div><dt>Volume</dt><dd className="num">{fvolume(detail.vol_today)}</dd></div>
                  )}
                  {detail.freq_today !== undefined && (
                    <div><dt>Frekuensi</dt><dd className="num">{fangka(detail.freq_today * 1000)} kali</dd></div>
                  )}
                  {detail.nf_today_idr !== undefined && (
                    <div><dt>Net asing</dt>
                      <dd className={`num ${detail.nf_today_idr >= 0 ? 'up' : 'down'}`}>
                        {detail.nf_today_idr >= 0 ? '+' : '−'}{fnilai(Math.abs(detail.nf_today_idr))}
                      </dd></div>
                  )}
                </dl>
              ) : (
                <p className="sub">{detailGagal
                  ? 'Berkas statistik hari itu tidak tersedia — hanya harga yang tercatat.'
                  : 'Memuat detail…'}</p>
              )}
            </div>
          )}

          <div className="dia-tally">
            <div className="dia-tally-baris">
              <span className="dia-pil dia-naik">{tally.hariNaik} hari naik</span>
              <span className="num up">{fpoin(tally.poinNaik)} ({fpersen(tally.persenNaik)})</span>
            </div>
            <div className="dia-tally-baris">
              <span className="dia-pil dia-turun">{tally.hariTurun} hari turun</span>
              <span className="num down">{fpoin(tally.poinTurun)} ({fpersen(tally.persenTurun)})</span>
            </div>
            <div className="dia-tally-baris dia-bersih">
              <span className="sub">
                Kumulatif 30 hari{geser < 0 ? ` s/d akhir ${NAMA_BULAN[bulan.bulan - 1]}` : ''} ({tally.hari} hari bursa)
              </span>
              <span className={`num ${tally.poinBersih >= 0 ? 'up' : 'down'}`}>
                {fpoin(tally.poinBersih)} ({fpersen(tally.persenBersih)})
              </span>
            </div>
          </div>
        </div>

        <div className="dia-kanan">
          <span className="sub">Performa IHSG</span>
          {performa.map((p) => (
            <div className="dia-perf" key={p.id}>
              <span className="dia-perf-lbl">{p.id}</span>
              <span className="dia-perf-bar">
                {p.persen !== null && (
                  <i
                    className={p.persen >= 0 ? 'up' : 'down'}
                    style={{ width: `${(Math.abs(p.persen) / maks) * 100}%` }}
                  />
                )}
              </span>
              <span className={`num dia-perf-nilai ${p.persen === null ? '' : p.persen >= 0 ? 'up' : 'down'}`}>
                {p.persen === null ? '—' : fpersen(p.persen)}
              </span>
            </div>
          ))}

          <span className="sub dia-rentang-judul">Rentang Rendah–Tinggi</span>
          {rentang.map((r) => (
            <div className="dia-perf" key={`r-${r.id}`}
              title="Tertinggi/terendah INTRADAY sepanjang periode itu, dari deret 36 tahun">
              <span className="dia-perf-lbl">{r.id}</span>
              {/* Warna isi bar mengikuti POSISI harga dalam rentangnya, bukan
                  hiasan (Johan 5 Sep 2026: "bar nya berikan warna dong"):
                  sepertiga bawah merah = merapat ke terendah, sepertiga atas
                  hijau = merapat ke tertinggi, tengah amber. Satu skema untuk
                  semua baris supaya sederet bar bisa dibaca sekilas sebagai
                  "harga sedang di mana", bukan warna berbeda per baris. */}
              <span className="dia-rentang-bar">
                <b className={r.posisi < 100 / 3 ? 'bawah' : r.posisi > 200 / 3 ? 'atas' : 'tengah'}
                  style={{ width: `${r.posisi}%` }} />
                <i style={{ left: `${r.posisi}%` }} />
              </span>
              <span className="num dia-rentang-nilai">
                {fangka(r.rendah)} – {fangka(r.tinggi)}
              </span>
            </div>
          ))}
          {/* Catatan kaki "·t = …" DIBUANG (Johan 5 Sep 2026: "teks ini di
              hapus saja"). Peringatannya TIDAK hilang: kalimat lengkapnya
              pindah ke tooltip baris yang bersangkutan (lihat `title` di atas),
              dan penjelasan panjangnya tetap di Metodologi. Satu baris teks
              yang selalu tampil untuk hal yang hanya berlaku pada dua dari
              sembilan baris memang lebih mahal daripada nilainya. */}
        </div>
      </div>
    </section>
  )
}
