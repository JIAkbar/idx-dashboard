import { useEffect, useMemo, useState } from 'react'
import type { ChartConfiguration } from 'chart.js/auto'
import { useChartCanvas, bacaTokenTema } from '../../../lib/dasbor/useChartJs'
import { useTheme } from '../../../context/ThemeContext'
import type { BarHarga } from '../../../lib/dasbor/neoPapanData'
import { porsiBergerak } from '../../../lib/dasbor/neoPapan'
import { muatUniverseSektor, type UniverseSektor } from './kandidat'
import { TOKEN_SERI, Kosong, Sumber } from './bersama'
import { InfoIndikator, type ItemInfoIndikator } from '../../../components/dasbor/InfoIndikator'

/** Modal "i" — penjelasan kendali & legenda chart (sweep Johan 27 Agu). */
const INFO_ACTIVITY: ItemInfoIndikator[] = [
  { nama: 'Sektor IDX-IC', isi: 'Kelompokkan garis menurut sektor resmi IDX-IC.' },
  { nama: 'Papan pencatatan', isi: 'Kelompokkan garis menurut papan pencatatan bursa; kelompok yang isinya cuma satu emiten dibuang supaya garisnya tak mewakili satu saham saja.' },
  { nama: '(sampel-aktif/anggota) dan ⚠', isi: 'Legenda tiap garis memuat jumlah anggota sampel yang benar-benar bertransaksi dibanding anggota aslinya. Tanda ⚠ berarti satu emiten menyumbang lebih dari 30% nilai kelompok itu hari itu — garisnya condong ke satu saham, bukan mewakili kelompok merata.' },
  { nama: 'Porsi nilai transaksi', isi: 'Porsi nilai transaksi kelompok terhadap total sampel, dihitung sebagai rata-rata bergerak 20 hari bursa — bukan terhadap seluruh nilai transaksi pasar (lihat catatan cakupan di bawah chart).' },
]

const HARI_TAMPIL = 180

/** Nilai transaksi harian tiap kandidat, per tanggal (map bersama seluruh kandidat). */
function nilaiPerTanggal(kand: string[], bars: Map<string, BarHarga[]>): Map<string, number>[] {
  return kand.map((k) => new Map((bars.get(k) ?? []).map((b) => [b.t, b.val])))
}

export function ActivityTab() {
  const { theme } = useTheme()
  const [uni, setUni] = useState<UniverseSektor | null | undefined>(undefined)
  // Mode Index DIHILANGKAN (PENAJAMAN2 §5): nol deret indeks & nol daftar
  // konstituen di arsip. Penggantinya mode PAPAN pencatatan — lonjakan
  // aktivitas papan Pemantauan Khusus adalah sinyal risiko yang tak
  // ditampilkan pesaing mana pun.
  const [jenis, setJenis] = useState<'sektor' | 'papan'>('sektor')

  useEffect(() => {
    let batal = false
    muatUniverseSektor().then((u) => { if (!batal) setUni(u) })
    return () => { batal = true }
  }, [])

  const kalender = useMemo(() => {
    if (!uni) return []
    const set = new Set<string>()
    for (const b of uni.bars.values()) for (const bar of b) set.add(bar.t)
    return [...set].sort().slice(-HARI_TAMPIL)
  }, [uni])

  const grup = useMemo(() => {
    if (!uni) return {} as Record<string, string[]>
    if (jenis === 'sektor') return uni.perSektor
    // "Ekonomi Baru" = SATU emiten berjubah nama papan (PENAJAMAN3) — garis
    // kelompok dari satu saham menyesatkan; dibuang dari mode Papan.
    const g: Record<string, string[]> = {}
    for (const [p, isi] of Object.entries(uni.perPapan)) {
      if ((uni.papanJumlah[p] ?? isi.length) > 1) g[p] = isi
    }
    return g
  }, [uni, jenis])

  /** Statistik kejujuran per grup di jendela tampil: n AKTIF (anggota sampel
   *  yang benar-benar bertransaksi) + porsi top-1 (konsentrasi). */
  const statGrup = useMemo(() => {
    if (!uni || !kalender.length) return {} as Record<string, { aktif: number; top1: number; top1Kode: string }>
    const keluar: Record<string, { aktif: number; top1: number; top1Kode: string }> = {}
    const kalSet = new Set(kalender)
    for (const [g, anggota] of Object.entries(grup)) {
      let total = 0
      let maks = 0
      let maksKode = ''
      let aktif = 0
      for (const k of anggota) {
        const jml = (uni.bars.get(k) ?? []).reduce((a, b) => (kalSet.has(b.t) ? a + b.val : a), 0)
        if (jml > 0) aktif++
        total += jml
        if (jml > maks) { maks = jml; maksKode = k }
      }
      keluar[g] = { aktif, top1: total ? maks / total : 0, top1Kode: maksKode }
    }
    return keluar
  }, [uni, grup, kalender])

  const seri = useMemo(() => {
    if (!uni || !kalender.length) return null
    const nama = Object.keys(grup).filter((g) => g && g !== '-').sort()
    const semuaMap = [...uni.bars.values()].map((b) => new Map(b.map((x) => [x.t, x.val])))
    const totalPerHari = kalender.map((t) => semuaMap.reduce((a, m) => a + (m.get(t) ?? 0), 0))
    return nama.map((g) => {
      const map = nilaiPerTanggal(grup[g], uni.bars)
      const nilaiGrup = kalender.map((t) => map.reduce((a, m) => a + (m.get(t) ?? 0), 0))
      return { nama: g, share: porsiBergerak(nilaiGrup, totalPerHari, 20) }
    })
  }, [uni, grup, kalender])

  // Hook QA dev-only (pola __papanChart): uji terima PENAJAMAN2 §Kriteria-2
  // menghitung ulang nilai Activity dari berkas mentah — butuh daftar anggota
  // grup & sampel penyebutnya.
  useEffect(() => {
    if (import.meta.env.DEV && uni) {
      ;(window as Window & { __papanActivity?: unknown }).__papanActivity = {
        grup, kalender, sampel: [...uni.bars.keys()],
        seri: seri?.map((s) => ({ nama: s.nama, akhir: s.share[s.share.length - 1] })),
      }
    }
  }, [uni, grup, kalender, seri])

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!seri) return null
    const abu = bacaTokenTema('--text2')
    return {
      type: 'line',
      data: {
        labels: kalender,
        datasets: seri.map((s, i) => {
          const st = statGrup[s.nama]
          // Legenda jujur (PENAJAMAN3 B1): SAMPEL-AKTIF / ANGGOTA-ASLI + ⚠
          // bila satu emiten menyumbang >30% nilai kelompok — "Utama (10/271)"
          // supaya garisnya tak mengaku seluruh papan/sektor.
          const total = (jenis === 'papan' ? uni?.papanJumlah[s.nama] : uni?.sektorJumlah[s.nama])
            ?? (grup[s.nama]?.length ?? 0)
          const label = st
            ? `${s.nama} (${st.aktif}/${total}${st.top1 > 0.3 ? ' ⚠' : ''})`
            : s.nama
          return {
            label, data: s.share.map((v) => v * 100),
            borderColor: bacaTokenTema(TOKEN_SERI[i % TOKEN_SERI.length]),
            borderWidth: 1.5, pointRadius: 0, tension: 0.15,
          }
        }),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: abu, boxWidth: 10, font: { size: 9 } } },
          tooltip: {
            callbacks: {
              // Konsentrasi dibuka, bukan disembunyikan (PENAJAMAN3): garis
              // "Keuangan" praktis tiga bank besar — top-3 kontributor +
              // porsinya tampil di tooltip tanggal yang di-hover.
              afterLabel: (c) => {
                if (!uni) return ''
                const nama = Object.keys(grup).filter((g) => g && g !== '-').sort()[c.datasetIndex]
                const anggota = grup[nama] ?? []
                const t = kalender[c.dataIndex]
                const nilai = anggota
                  .map((k) => ({ k, v: (uni.bars.get(k) ?? []).find((b) => b.t === t)?.val ?? 0 }))
                  .sort((a, b) => b.v - a.v)
                const total = nilai.reduce((a, x) => a + x.v, 0)
                if (!total) return ''
                return 'top-3: ' + nilai.slice(0, 3)
                  .map((x) => `${x.k} ${((x.v / total) * 100).toFixed(0)}%`)
                  .join(' · ')
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: abu, maxTicksLimit: 10 }, grid: { display: false } },
          y: { min: 0, ticks: { color: abu, callback: (v) => v + '%' }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }
  }, [seri, kalender, theme, jenis, uni, grup, statGrup])
  const ref = useChartCanvas(config)

  if (uni === undefined) return <Kosong>Memuat sampel…</Kosong>
  if (!uni) return <Kosong>Data screener untuk membangun sampel belum tersedia.</Kosong>

  return (
    <section className="panel panel-b">
      <h2>{jenis === 'sektor' ? 'Sector' : 'Papan'} Activity</h2>
      <p className="np-sub">Porsi nilai transaksi kelompok terhadap sampel, rata-rata bergerak 20 hari bursa.</p>
      <div className="np-baris">
        <button type="button" className={'chip-t' + (jenis === 'sektor' ? ' on' : '')} onClick={() => setJenis('sektor')}>Sektor IDX-IC</button>
        <button type="button" className={'chip-t' + (jenis === 'papan' ? ' on' : '')} onClick={() => setJenis('papan')}>Papan pencatatan</button>
        <InfoIndikator judul="Indikator Sector/Papan Activity" item={INFO_ACTIVITY} />
        {jenis === 'papan' && uni && (
          <span className="muted" style={{ fontSize: 11 }}>
            sampel {uni.perPapanJumlah} emiten terlikuid per papan · anggota sebenarnya:{' '}
            {Object.entries(uni.papanJumlah).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(' · ')}
          </span>
        )}
      </div>
      <div className="chart-wrap" style={{ height: 420, marginTop: 10 }}><canvas ref={ref} /></div>
      <div className="np-peringatan">
        Definisi PAPAN sendiri: porsi dihitung terhadap SAMPEL emiten paling likuid
        (yang sama dipakai Rotation Chart, {uni.perSektorJumlah} per sektor) — bukan terhadap seluruh nilai
        transaksi pasar, karena itu butuh riwayat harga seluruh emiten yang tidak diunduh di peramban.
      </div>
      <Sumber>Nilai transaksi harian sampel emiten dari arsip harga PAPAN, dikelompokkan per sektor IDX-IC atau papan pencatatan. Mode Indeks tidak disediakan: deret indeks dan daftar konstituennya tidak ada di arsip — menebak keanggotaan menghasilkan angka salah diam-diam.</Sumber>
    </section>
  )
}
