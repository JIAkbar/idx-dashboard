import { useEffect, useMemo, useState } from 'react'
import { HARI, ringkasHarian, vonisUji, type RingkasHarian } from '../../lib/seasonality'
import { pesanGalat } from '../../lib/pesanGalat'
import { IkonMenu, IKON_PERINGATAN } from '../../components/dasbor/IkonMenu'

const RENTANG: Array<[string, number]> = [
  ['Semua', 0], ['1 thn', 1], ['2 thn', 2], ['3 thn', 3], ['5 thn', 5], ['10 thn', 10], ['20 thn', 20],
]

const WARNA = ['var(--red)', 'var(--amber)', 'var(--blue)', 'var(--green)', 'var(--text)']

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
  const [tahun, setTahun] = useState(0)
  const [maju, setMaju] = useState(1)

  useEffect(() => {
    fetch('/data-idx/json/ihsg_harian.json')
      .then((r) => r.json())
      .then((d: { tutup: Record<string, number> }) => setTutup(d.tutup))
      .catch((e: unknown) => setGalat(pesanGalat(e, 'Gagal memuat data IHSG harian.')))
  }, [])

  const sejak = tahun ? new Date().getUTCFullYear() - tahun + 1 : 0

  const r: RingkasHarian | null = useMemo(
    () => (tutup ? ringkasHarian('IHSG', tutup, sejak) : null),
    [tutup, sejak],
  )

  // Animasi berjalan SEKALI tiap ganti rentang, lalu berhenti di hasil akhir.
  // Diulang terus-menerus, angkanya jadi sulit dibaca justru karena
  // gerakannya — padahal angka itulah yang dicari orang.
  useEffect(() => {
    if (!r) return
    const kurangGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (kurangGerak) { setMaju(1); return }
    setMaju(0)
    let batal = false
    const mulai = performance.now()
    const DURASI = 2200
    const tik = (t: number) => {
      if (batal) return
      const p = Math.min(1, (t - mulai) / DURASI)
      setMaju(p)
      if (p < 1) requestAnimationFrame(tik)
    }
    const id = requestAnimationFrame(tik)
    return () => { batal = true; cancelAnimationFrame(id) }
  }, [r])

  if (galat) return <div className="panel panel-b"><p className="muted">{galat}</p></div>
  if (!r) return <div className="fd-empty"><p>Memuat data IHSG…</p></div>

  const v = vonisUji(r.uji)
  const urut = [...r.perHari].sort((a, b) => b.kumulatif - a.kumulatif)

  return (
    <>
      <section className="panel">
        <div className="panel-b sea-hari-kepala">
          <div className="sea-tahun">
            <span className="lbl">Rentang</span>
            {RENTANG.map(([label, th]) => (
              <button key={label} type="button" className={'bchip bchip-klik' + (tahun === th ? ' on' : '')}
                onClick={() => setTahun(th)}>{label}</button>
            ))}
          </div>
          <span className="v-note">
            IHSG · {r.mulai} → {r.akhir} · {r.totalObservasi.toLocaleString('id-ID')} hari bursa
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <span className="lbl">Kalau hanya memegang di satu hari</span>
          <span className="v-note">pertumbuhan kumulatif sejak {r.mulai.slice(0, 4)}</span>
        </div>
        <div className="panel-b">
          <Balapan r={r} maju={maju} onLompat={() => setMaju(1)} />
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

/** Grafik balapan: lima garis kumulatif yang tumbuh bersamaan. */
function Balapan({ r, maju, onLompat }: { r: RingkasHarian; maju: number; onLompat: () => void }) {
  const W = 900, H = 340
  const PAD = { atas: 14, kanan: 104, bawah: 26, kiri: 56 }
  const sampai = Math.max(2, Math.floor(r.jejak.length * maju))
  const tampak = r.jejak.slice(0, sampai)

  // Skala dari SELURUH jejak, bukan cuma yang tampak. Kalau ikut tumbuh,
  // garisnya terlihat diam sementara sumbunya yang bergerak — dan justru
  // perlombaannya yang jadi tak terlihat.
  const semua = r.jejak.flatMap((j) => j.nilai)
  const min = Math.min(0, ...semua)
  const maks = Math.max(...semua)
  const x = (i: number) => PAD.kiri + (i / Math.max(1, r.jejak.length - 1)) * (W - PAD.kiri - PAD.kanan)
  const y = (v: number) => PAD.atas + (1 - (v - min) / Math.max(1e-9, maks - min)) * (H - PAD.atas - PAD.bawah)
  const akhir = tampak[tampak.length - 1]

  return (
    <div className="sea-balapan">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
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
              d={tampak.map((j, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(j.nilai[h]).toFixed(1)}`).join(' ')}
              fill="none" stroke={WARNA[h]} strokeWidth="1.8" strokeLinejoin="round"
            />
            {akhir && (
              <>
                <circle cx={x(tampak.length - 1)} cy={y(akhir.nilai[h])} r="3.5" fill={WARNA[h]} />
                <text x={x(tampak.length - 1) + 8} y={y(akhir.nilai[h]) + 4} fill={WARNA[h]} className="sb-label">
                  {nama} {akhir.nilai[h] >= 0 ? '+' : ''}{Math.round(akhir.nilai[h])}%
                </text>
              </>
            )}
          </g>
        ))}
        {akhir && (
          <text x={PAD.kiri} y={H - 6} className="sb-sumbu">
            {tampak[0].tgl} &rarr; {akhir.tgl}
          </text>
        )}
      </svg>
      {maju < 1 && (
        <button type="button" className="bchip bchip-klik sb-lompat" onClick={onLompat}>
          Langsung ke hasil akhir
        </button>
      )}
    </div>
  )
}
