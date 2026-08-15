import { useEffect, useMemo, useState } from 'react'
import { HARI, ringkasHarian, vonisUji, type RingkasHarian } from '../../lib/seasonality'
import { pesanGalat } from '../../lib/pesanGalat'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

/** Tiap pilihan menghitung batas bawahnya sendiri saat diklik — bukan disimpan
 *  sebagai tanggal tetap, supaya MTD/YTD tetap benar kalau halaman dibiarkan
 *  terbuka melewati tengah malam atau pergantian bulan. */
const RENTANG: Array<[string, () => string]> = [
  ['Semua', () => ''],
  ['MTD', () => new Date().toISOString().slice(0, 8) + '01'],
  ['YTD', () => new Date().getUTCFullYear() + '-01-01'],
  ['1 thn', () => geser(1)],
  ['2 thn', () => geser(2)],
  ['3 thn', () => geser(3)],
  ['5 thn', () => geser(5)],
  ['10 thn', () => geser(10)],
  ['20 thn', () => geser(20)],
]

function geser(tahun: number): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - tahun)
  return d.toISOString().slice(0, 10)
}

/** Ikut mendengarkan perubahan, bukan sekadar membaca sekali saat render:
 *  memutar ponsel ke lanskap mengubah jawabannya, dan grafik yang menyimpan
 *  ukuran lama akan tergambar dengan skala yang salah sampai dipaksa render. */
function useLayarSempit(batas = 700): boolean {
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

const WARNA = ['var(--red)', 'var(--amber)', 'var(--blue)', 'var(--green)', 'var(--text)']
const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/**
 * Pola hari dalam seminggu — tab kedua Seasonality.
 *
 * Untuk sekarang IHSG saja: datanya sudah ada (ihsg_harian.json, 8.849 hari
 * sejak 1990) sementara harga harian per emiten baru akan dipanen. Memisah
 * keduanya membuat bagian yang siap tidak ikut tertahan.
 *
 * Grafik balapannya meniru bentuk yang beredar untuk pasar AS, tapi dengan
 * satu tambahan yang justru menentukan: hasilnya diuji lawan pengacakan
 * sebelum disebut pola. Bentuk aslinya cuma menampilkan garis yang menang,
 * dan garis selalu punya pemenang — bahkan pada data acak.
 */
export function SeasonalityHarian() {
  const [tutup, setTutup] = useState<Record<string, number> | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [pilih, setPilih] = useState('Semua')

  useEffect(() => {
    fetch('/data-idx/json/ihsg_harian.json')
      .then((r) => r.json())
      .then((d: { tutup: Record<string, number> }) => setTutup(d.tutup))
      .catch((e: unknown) => setGalat(pesanGalat(e, 'Gagal memuat data IHSG harian.')))
  }, [])

  const sejak = (RENTANG.find(([n]) => n === pilih)?.[1] ?? (() => ''))()

  const r: RingkasHarian | null = useMemo(
    () => (tutup ? ringkasHarian('IHSG', tutup, sejak) : null),
    [tutup, sejak],
  )

  if (galat) return <div className="panel panel-b"><p className="muted">{galat}</p></div>
  if (!tutup) return <div className="fd-empty"><p>Memuat data IHSG…</p></div>

  const v = r ? vonisUji(r.uji) : null
  const urut = r ? [...r.perHari].sort((a, b) => b.kumulatif - a.kumulatif) : []

  return (
    <>
      <section className="panel">
        <div className="panel-b sea-hari-kepala">
          <div className="sea-tahun">
            <span className="lbl">Rentang</span>
            {RENTANG.map(([label]) => (
              <button key={label} type="button" className={'bchip bchip-klik' + (pilih === label ? ' on' : '')}
                onClick={() => setPilih(label)}>{label}</button>
            ))}
          </div>
          <span className="v-note">
            {r
              ? `IHSG · ${r.mulai} → ${r.akhir} · ${r.totalObservasi.toLocaleString('id-ID')} hari bursa`
              : 'IHSG · rentang ini belum cukup panjang'}
          </span>
        </div>
      </section>

      {!r && (
        <div className="fd-empty" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: 14 }}>Rentang ini belum punya satu pun perubahan harga.</p>
        </div>
      )}

      {/* Sampel tipis TIDAK disembunyikan — ditampilkan dengan peringatan yang
          menyebut angkanya. Menolak menghitung menyembunyikan mekanismenya;
          yang dibutuhkan pembaca adalah tahu setipis apa dasarnya. */}
      {r && r.totalObservasi < 25 && (
        <div className="sea-tipis">
          <b>Dasarnya tipis: {r.totalObservasi} perubahan harga.</b> Dibagi lima hari, tiap hari
          cuma punya sekitar {Math.round(r.totalObservasi / 5)} pengamatan — satu hari yang
          kebetulan meledak bisa menentukan seluruh urutannya. Angka di bawah benar secara
          hitungan, tapi belum berarti apa-apa sebagai pola.
        </div>
      )}

      {r && v && <>

      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Kalau hanya memegang di satu hari</span>
          <span className="v-note">pertumbuhan kumulatif sejak {r.mulai.slice(0, 4)}</span>
        </div>
        <div className="panel-b">
          <Balapan r={r} kunci={pilih} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-h"><span className="lbl">Rincian per hari</span></div>
        <div className="panel-b" style={{ overflowX: 'auto' }}>
          <table className="tbl sea-hari-tbl">
            <thead>
              <tr>
                <th>Hari</th>
                <th className="num">Kumulatif</th>
                <th className="num">Rata-rata/hari</th>
                <th className="num">Median</th>
                <th className="num">Peluang naik</th>
                <th className="num">Selang 95%</th>
                <th className="num">n</th>
              </tr>
            </thead>
            <tbody>
              {urut.map((h) => (
                <tr key={h.hari}>
                  <td><b style={{ color: WARNA[h.hari] }}>{HARI[h.hari]}</b></td>
                  <td className={'num ' + (h.kumulatif >= 0 ? 'up' : 'dn')}>
                    {h.kumulatif >= 0 ? '+' : ''}{h.kumulatif.toFixed(1)}%
                  </td>
                  <td className={'num ' + (h.rata2 >= 0 ? 'up' : 'dn')}>
                    {h.rata2 >= 0 ? '+' : ''}{h.rata2.toFixed(4)}%
                  </td>
                  <td className="num">{h.median >= 0 ? '+' : ''}{h.median.toFixed(3)}%</td>
                  <td className="num"><b>{h.tersusut.toFixed(1)}%</b></td>
                  <td className="num muted">{h.bawah.toFixed(0)}&ndash;{h.atas.toFixed(0)}%</td>
                  <td className="num muted">{h.n.toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={'panel-b sea-vonis-hari' + (v.kuat ? ' kuat' : '')}>
          {r.uji && (
            <span>
              <b>{HARI[r.uji.bulanJuara - 1]}</b> paling sering naik ({r.uji.peluangJuara}%) ·{' '}
              <span className="pv">p = {r.uji.pValue.toFixed(4)}</span>
            </span>
          )}
          <span className="ks">{v.teks}</span>
        </div>
      </section>

      </>}

      <p className="sea-kaki">
        <IkonMenu d={IKON_PERINGATAN} size={12} />{' '}
        <b>Angka kumulatif mudah disalahbaca.</b> &minus;86% bukan berarti &ldquo;rugi 86%&rdquo; —
        itu hasil pengalian ribuan hari berturut-turut, dan pengali di bawah 1 menghancurkan lebih
        cepat daripada yang di atas 1 membangun. Rata-rata harian lebih jujur menggambarkan
        wataknya. <b>Dan ini bukan strategi:</b> selisih sepersepuluh persen per hari habis oleh fee
        sekali transaksi. Yang dijawab halaman ini adalah <b>kapan pasar cenderung lemah</b>, bukan
        kapan harus membeli.
      </p>
    </>
  )
}

/**
 * Grafik balapan: lima garis kumulatif yang tumbuh bersamaan.
 *
 * Animasinya digerakkan CSS (stroke-dashoffset), BUKAN state React per frame.
 * Versi pertama menyetel state 60 kali per detik, dan tiap penyetelan memaksa
 * seluruh komponen — termasuk tabel tujuh kolomnya — dihitung ulang. Hasilnya
 * tersendat persis di bagian yang seharusnya mulus.
 *
 * Dengan dashoffset, path digambar sekali lalu compositor yang menganimasikan
 * penyingkapannya. Tak ada render ulang sama sekali selama animasi berjalan.
 */
function Balapan({ r, kunci }: { r: RingkasHarian; kunci: string }) {
  // viewBox lebih sempit di layar kecil. Ukuran teks di dalam SVG ikut
  // diskalakan bersama viewBox-nya: kotak 900 lebar yang dipaksa masuk ke
  // 394px menyusutkan label 12px jadi sekitar 5px — ada di layar, tak terbaca.
  // Kotak yang lebih kecil dan lebih jangkung membuat skalanya mendekati 1:1.
  const sempit = useLayarSempit()
  const W = sempit ? 460 : 900
  const H = sempit ? 320 : 348
  const PAD = sempit
    ? { atas: 12, kanan: 78, bawah: 30, kiri: 42 }
    : { atas: 14, kanan: 104, bawah: 34, kiri: 56 }

  const semua = r.jejak.flatMap((j) => j.nilai)
  const min = Math.min(0, ...semua)
  const maks = Math.max(...semua)
  const x = (i: number) => PAD.kiri + (i / Math.max(1, r.jejak.length - 1)) * (W - PAD.kiri - PAD.kanan)
  const y = (v: number) => PAD.atas + (1 - (v - min) / Math.max(1e-9, maks - min)) * (H - PAD.atas - PAD.bawah)
  const akhir = r.jejak[r.jejak.length - 1]

  // Penanda waktu dipilih menurut panjang rentangnya: di bawah 2 tahun tiap
  // bulan (atau tiap 2 bulan kalau padat), di atas itu tiap tahun. Menampilkan
  // 36 label bulan pada rentang 30 tahun cuma menghasilkan pita hitam.
  const tanda = useMemo(() => {
    const hari = r.jejak.length
    const perTahun = hari > 480
    const hasil: Array<{ i: number; tgl: string; label: string }> = []
    let terakhir = ''
    r.jejak.forEach((j, i) => {
      const kunci = perTahun ? j.tgl.slice(0, 4) : j.tgl.slice(0, 7)
      if (kunci === terakhir) return
      terakhir = kunci
      hasil.push({
        i, tgl: j.tgl,
        label: perTahun ? kunci : BLN_PENDEK[Number(j.tgl.slice(5, 7)) - 1] + (j.tgl.slice(5, 7) === '01' ? ` '${j.tgl.slice(2, 4)}` : ''),
      })
    })
    // Kalau masih terlalu rapat, ambil selang seling sampai muat. Label yang
    // saling menimpa lebih buruk daripada label yang lebih jarang.
    const maksLabel = sempit ? 7 : 14
    if (hasil.length <= maksLabel) return hasil
    const lompat = Math.ceil(hasil.length / maksLabel)
    return hasil.filter((_, i) => i % lompat === 0)
  }, [r.jejak, sempit])

  // Panjang jalur ditaksir dari jarak antar titik. Cukup: nilainya cuma perlu
  // TIDAK LEBIH PENDEK dari panjang sebenarnya, karena dipakai sebagai dash
  // yang harus mampu menutupi seluruh garis sebelum disingkap.
  const panjang = HARI.map((_, h) => {
    let L = 0
    for (let i = 1; i < r.jejak.length; i++) {
      const dx = x(i) - x(i - 1)
      const dy = y(r.jejak[i].nilai[h]) - y(r.jejak[i - 1].nilai[h])
      L += Math.hypot(dx, dy)
    }
    return Math.ceil(L) + 10
  })

  return (
    <div className="sea-balapan">
      {/* key memaksa elemen dibuat ulang saat rentang berganti — animasi CSS
          tidak akan mengulang sendiri kalau elemennya cuma diperbarui. */}
      <svg key={kunci} viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label="Pertumbuhan kumulatif IHSG per hari dalam seminggu">
        <line x1={PAD.kiri} x2={W - PAD.kanan} y1={y(0)} y2={y(0)}
          stroke="var(--line2)" strokeDasharray="3 4" />
        <text x={PAD.kiri - 8} y={y(0) + 4} textAnchor="end" className="sb-sumbu">0%</text>
        <text x={PAD.kiri - 8} y={y(maks) + 10} textAnchor="end" className="sb-sumbu">{Math.round(maks)}%</text>
        {min < -1 && (
          <text x={PAD.kiri - 8} y={y(min) - 2} textAnchor="end" className="sb-sumbu">{Math.round(min)}%</text>
        )}

        {HARI.map((nama, h) => (
          <g key={nama}>
            <path
              className="sb-garis"
              style={{ ['--L' as string]: panjang[h] }}
              d={r.jejak.map((j, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(j.nilai[h]).toFixed(1)}`).join(' ')}
              fill="none" stroke={WARNA[h]} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
            />
            <g className="sb-ujung">
              <circle cx={x(r.jejak.length - 1)} cy={y(akhir.nilai[h])} r="3.5" fill={WARNA[h]} />
              <text x={x(r.jejak.length - 1) + 8} y={y(akhir.nilai[h]) + 4} fill={WARNA[h]} className="sb-label">
                {nama} {akhir.nilai[h] >= 0 ? '+' : ''}{Math.round(akhir.nilai[h])}%
              </text>
            </g>
          </g>
        ))}
        {/* Sumbu waktu: penanda BULAN untuk rentang pendek, TAHUN untuk
            rentang panjang. Tanpa ini, garis yang naik-turun tak punya
            jangkar — orang melihat bentuk tapi tak tahu kapan itu terjadi. */}
        {tanda.map((t) => (
          <g key={t.tgl}>
            <line x1={x(t.i)} x2={x(t.i)} y1={PAD.atas} y2={H - PAD.bawah}
              stroke="var(--line)" strokeWidth="1" opacity="0.5" />
            <text x={x(t.i)} y={H - 6} textAnchor="middle" className="sb-sumbu">{t.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
